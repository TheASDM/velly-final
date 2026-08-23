import { studio } from './state.js';
import { assetUrl, buildGalleryCard, entryTitle, normalizeGalleryScope, renderGallery, setGalleryRefreshing, syncGalleryChrome } from './gallery-view.js';
import { escapeHtml } from './generation.js';
import { getCurrentAuthToken, getCurrentCreatorName, hasAuthenticatedCreator, openStudioLogin, requestHeaders } from './identity.js';
import { setStatus } from './jobs.js';
import { openLightbox } from './lightbox.js';
import { tryOpenPending } from './references.js';

export async function fetchFavorites() {
    const creator = getCurrentCreatorName();
    if (!creator) return;
    try {
      const r = await fetch(
        studio.API_BASE + '/api/gallery/favorites?name=' + encodeURIComponent(creator),
        { cache: 'no-store', headers: requestHeaders() }
      );
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      studio.favoriteIds.clear();
      (data.ids || []).forEach((id) => studio.favoriteIds.add(id));
      // Re-apply heart state to any already-rendered cards.
      document.querySelectorAll('[data-favorite-id]').forEach((btn) => {
        const id = btn.getAttribute('data-favorite-id');
        const isFav = studio.favoriteIds.has(id);
        btn.classList.toggle('is-favorited', isFav);
        btn.textContent = isFav ? '♥' : '♡';
      });
    } catch (e) {}
  }

export async function loadGallery(options = {}) {
    studio.currentGalleryScope = normalizeGalleryScope(studio.currentGalleryScope);
    syncGalleryChrome();
    const quiet = !!options.quiet;
    const append = !!options.append;
    if (!quiet || !studio.galleryHasLoaded) studio.countEl.textContent = 'Loading…';
    setGalleryRefreshing(true);
    if (!append) {
      studio.galleryOffset = 0;
    }
    if (studio.loadMoreEl) {
      studio.loadMoreEl.disabled = true;
      studio.loadMoreEl.textContent = append ? 'Loading…' : 'Load more';
    }

    if (['mine', 'favorites'].includes(studio.currentGalleryScope) && !hasAuthenticatedCreator()) {
      studio.galleryEl.innerHTML = `<div class="vos-art-empty">Log in to view your private Studio library.</div>`;
      studio.countEl.textContent = studio.currentGalleryScope === 'favorites' ? 'Favorites' : 'My Studio';
      setGalleryRefreshing(false);
      if (studio.loadMoreEl) studio.loadMoreEl.hidden = true;
      return;
    }

    const params = new URLSearchParams({ limit: String(studio.GALLERY_PAGE), offset: String(studio.galleryOffset) });
    if (studio.currentGalleryScope === 'favorites') {
      const creator = getCurrentCreatorName();
      params.set('favorites', '1');
      if (creator) params.set('name', creator);
    } else {
      params.set('scope', studio.currentGalleryScope);
    }
    const url = studio.API_BASE + '/api/gallery?' + params.toString();
    try {
      const r = await fetch(url, { cache: 'no-store', headers: requestHeaders() });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      studio.galleryHasLoaded = true;
      const entries = data.entries || [];
      studio.galleryTotal = data.total || 0;
      if (append) {
        appendGallery(entries);
      } else {
        renderGallery(entries, studio.galleryTotal);
      }
      studio.galleryOffset += entries.length;
      if (studio.loadMoreEl) {
        studio.loadMoreEl.hidden = studio.galleryOffset >= studio.galleryTotal;
        studio.loadMoreEl.disabled = false;
        studio.loadMoreEl.textContent = 'Load more';
      }
      fetchFavorites();
    } catch (error) {
      studio.countEl.textContent = 'Gallery unavailable.';
      if (!studio.galleryHasLoaded) {
        studio.galleryEl.innerHTML = `<div class="vos-art-empty">${escapeHtml(error.message || 'Could not reach the gallery.')}</div>`;
      }
      if (studio.loadMoreEl) {
        studio.loadMoreEl.disabled = false;
      }
    } finally {
      setGalleryRefreshing(false);
    }
  }

export function appendGallery(entries) {
    if (!entries || !entries.length) return;
    const frag = document.createDocumentFragment();
    entries.forEach((e) => frag.appendChild(buildGalleryCard(e)));
    studio.galleryEl.appendChild(frag);
    const config = studio.GALLERY_SCOPES[studio.currentGalleryScope] || studio.GALLERY_SCOPES.mine;
    const noun = config.noun;
    studio.countEl.textContent = `${studio.galleryTotal} ${noun}${studio.galleryTotal === 1 ? '' : 's'}`;
    // Honor a pending deep-link if the requested image has now arrived.
    if (studio.pendingOpenImageId) tryOpenPending();
  }

export async function toggleFavorite(entry, button) {
    const creator = getCurrentCreatorName();
    if (!creator || !getCurrentAuthToken()) {
      setStatus('Log in to favorite gallery images.', true);
      await openStudioLogin();
      return;
    }
    const wasFav = studio.favoriteIds.has(entry.id);
    const method = wasFav ? 'DELETE' : 'POST';
    button.disabled = true;
    try {
      const r = await fetch(
        studio.API_BASE + '/api/gallery/' + encodeURIComponent(entry.id)
          + '/favorite?name=' + encodeURIComponent(creator),
        { method, headers: requestHeaders() }
      );
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (wasFav) studio.favoriteIds.delete(entry.id);
      else studio.favoriteIds.add(entry.id);
      const isFav = studio.favoriteIds.has(entry.id);
      // Update every button for this entry (card + lightbox can both exist).
      document.querySelectorAll('[data-favorite-id="' + entry.id + '"]').forEach((b) => {
        b.classList.toggle('is-favorited', isFav);
        b.textContent = isFav ? '♥' : '♡';
      });
    } catch (e) {
      // Quiet failure — toggle back if needed and just leave the heart.
    } finally {
      button.disabled = false;
    }
  }

export async function toggleGalleryShare(entry, button) {
    if (!entry || !entry.can_share) return;
    if (!hasAuthenticatedCreator()) {
      setStatus('Log in before changing gallery sharing.', true);
      await openStudioLogin();
      return;
    }
    const makeShared = !(entry.is_shared || entry.visibility === 'shared');
    const method = makeShared ? 'POST' : 'DELETE';
    const originalText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = makeShared ? 'Sharing…' : 'Updating…';
    }
    try {
      const r = await fetch(
        studio.API_BASE + '/api/gallery/' + encodeURIComponent(entry.id) + '/share',
        { method, headers: requestHeaders() }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const updated = data.entry || {};
      setStatus(makeShared ? 'Shared to the group gallery.' : 'Returned to private.', false, { clearAfter: 4000 });
      if (studio.currentLightboxEntry && studio.currentLightboxEntry.id === entry.id) {
        studio.currentLightboxEntry = { ...studio.currentLightboxEntry, ...updated };
        openLightbox(studio.currentLightboxEntry);
      }
      await loadGallery({ quiet: true });
    } catch (error) {
      setStatus('Sharing update failed: ' + error.message, true);
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

export async function shareEntry(entry) {
    const url = absoluteUrl(entry.image_url);
    const title = `Vallombrosa: ${entryTitle(entry).slice(0, 80)}`;
    const text = entryTitle(entry);

    let file = null;
    try {
      const r = await fetch(url, { cache: 'force-cache', headers: requestHeaders() });
      if (r.ok) {
        const blob = await r.blob();
        file = new File([blob], 'vallombrosa.png', { type: blob.type || 'image/png' });
      }
    } catch (e) {}

    if (navigator.share) {
      try {
        const payload = { title, text, url };
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          payload.files = [file];
        }
        await navigator.share(payload);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user cancelled
      }
    }

    // Fallback: copy the URL to clipboard. Always offer a download too.
    try {
      await navigator.clipboard.writeText(url);
      const shared = entry && (entry.is_shared || entry.visibility === 'shared');
      setStatus(shared
        ? 'Image link copied to clipboard.'
        : 'Private image link copied. Only you and the DM can open it.');
    } catch (e) {
      setStatus('Couldn’t share automatically — long-press the image to save.', true);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vallombrosa-' + entry.id + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

export function absoluteUrl(url) {
    const resolved = assetUrl(url);
    if (/^https?:/i.test(resolved)) return resolved;
    return window.location.origin + resolved;
  }
