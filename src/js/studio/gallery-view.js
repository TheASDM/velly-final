import { studio } from './state.js';
import { loadGallery, shareEntry, toggleFavorite, toggleGalleryShare } from './gallery-actions.js';
import { escapeHtml } from './generation.js';
import { getCurrentAuthToken, isCurrentDm, requestHeaders } from './identity.js';
import { deleteEntry } from './jobs.js';
import { openLightbox } from './lightbox.js';
import { tryOpenPending } from './references.js';

export function fmtRel(iso) {
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400)return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

export function assetUrl(url) {
    if (!url) return '';
    return /^https?:\/\//i.test(url) || url.startsWith('data:')
      ? url
      : studio.API_BASE + url;
  }

export function clearObjectUrl(img) {
    if (!img || !img.dataset || !img.dataset.objectUrl) return;
    try { URL.revokeObjectURL(img.dataset.objectUrl); } catch (e) {}
    delete img.dataset.objectUrl;
  }

export async function setImageSrc(img, url, entry, forceAuth = false) {
    if (!img) return;
    clearObjectUrl(img);
    const resolved = assetUrl(url);
    if (!resolved) {
      img.removeAttribute('src');
      return;
    }
    const privateEntry = entry && !(entry.is_shared || entry.visibility === 'shared');
    if ((privateEntry || forceAuth) && getCurrentAuthToken()) {
      try {
        const response = await fetch(resolved, {
          cache: privateEntry ? 'no-store' : 'force-cache',
          headers: requestHeaders(),
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        img.dataset.objectUrl = objectUrl;
        img.src = objectUrl;
        return;
      } catch (e) {
        if (privateEntry) {
          img.removeAttribute('src');
          return;
        }
      }
    }
    img.src = resolved;
  }

export function entryTitle(e) {
    return (e && (e.title || e.prompt)) || 'Gallery piece';
  }

export function normalizeGalleryScope(scope) {
    const candidate = studio.GALLERY_SCOPES[scope] ? scope : 'mine';
    if (candidate === 'all' && !isCurrentDm()) return 'mine';
    return candidate;
  }

export function syncDmMode() {
    const dm = isCurrentDm();
    document.body.classList.toggle('is-dm-mode', dm);
    const dmTab = studio.galleryTabsEl && studio.galleryTabsEl.querySelector('[data-gallery-scope="all"]');
    if (dmTab) dmTab.hidden = !dm;
    if (!dm && studio.currentGalleryScope === 'all') studio.currentGalleryScope = 'mine';
  }

export function syncGalleryChrome() {
    studio.currentGalleryScope = normalizeGalleryScope(studio.currentGalleryScope);
    const config = studio.GALLERY_SCOPES[studio.currentGalleryScope] || studio.GALLERY_SCOPES.mine;
    if (studio.galleryTitleEl) studio.galleryTitleEl.textContent = config.title;
    if (studio.galleryNoteEl) studio.galleryNoteEl.textContent = config.note;
    syncDmMode();
    if (studio.galleryTabsEl) {
      studio.galleryTabsEl.querySelectorAll('[data-gallery-scope]').forEach((button) => {
        const active = button.dataset.galleryScope === studio.currentGalleryScope;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }
  }

export function updateGalleryUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('favorites');
      url.searchParams.set('gallery', studio.currentGalleryScope);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }

export function setGalleryScope(scope, options = {}) {
    studio.currentGalleryScope = normalizeGalleryScope(scope);
    studio.galleryHasLoaded = false;
    studio.galleryOffset = 0;
    syncGalleryChrome();
    if (!options.keepUrl) updateGalleryUrl();
    return loadGallery({ quiet: !!options.quiet });
  }

export function visibilityBadge(entry) {
    const badge = document.createElement('span');
    const shared = !!entry.is_shared || entry.visibility === 'shared';
    badge.className = 'vos-art-visibility' + (shared ? '' : ' is-private');
    badge.textContent = shared ? 'Shared' : 'Private';
    return badge;
  }

export function shareToggleLabel(entry) {
    return entry && (entry.is_shared || entry.visibility === 'shared')
      ? 'Make Private'
      : 'Share to Group Gallery';
  }

export function buildGalleryCard(e) {
    const card = document.createElement('a');
    card.className = 'vos-art-card';
    card.href = assetUrl(e.image_url);
    card.dataset.entryId = e.id;
    card.dataset.entry = JSON.stringify(e);
    card.addEventListener('click', (evt) => {
      evt.preventDefault();
      openLightbox(e);
    });

    const actions = document.createElement('div');
    actions.className = 'vos-art-card-actions';

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'vos-art-icon-btn';
    favBtn.setAttribute('aria-label', 'Favorite this image');
    favBtn.title = 'Favorite';
    favBtn.dataset.favoriteId = e.id;
    const isFav = studio.favoriteIds.has(e.id);
    favBtn.classList.toggle('is-favorited', isFav);
    favBtn.textContent = isFav ? '♥' : '♡';
    favBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      toggleFavorite(e, favBtn);
    });

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'vos-art-icon-btn';
    shareBtn.setAttribute('aria-label', 'Export this image');
    shareBtn.title = 'Export image';
    shareBtn.textContent = '↗';
    shareBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      shareEntry(e);
    });

    actions.append(favBtn, shareBtn);
    card.appendChild(actions);

    if (e.can_delete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'vos-art-delete';
      del.title = 'Delete';
      del.setAttribute('aria-label', 'Delete this image');
      del.textContent = '✕';
      del.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        deleteEntry(e, del);
      });
      card.appendChild(del);
    }

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = entryTitle(e);
    setImageSrc(img, e.image_url, e);
    card.appendChild(img);
    const meta = document.createElement('div');
    meta.className = 'vos-art-card-meta';
    const title = document.createElement('span');
    title.className = 'vos-art-card-meta-title';
    title.textContent = entryTitle(e);
    meta.appendChild(title);
    if (e.grounded_in && e.grounded_in.length) {
      const chips = document.createElement('div');
      chips.className = 'vos-art-grounded';
      e.grounded_in.slice(0, 3).forEach(name => {
        const chip = document.createElement('span');
        chip.className = 'vos-art-grounded-chip';
        chip.textContent = name;
        chips.appendChild(chip);
      });
      meta.appendChild(chips);
    }
    const visibilityRow = document.createElement('div');
    visibilityRow.className = 'vos-art-visibility-row';
    visibilityRow.appendChild(visibilityBadge(e));
    if (e.can_share) {
      const shareToggle = document.createElement('button');
      shareToggle.type = 'button';
      shareToggle.className = 'vos-art-share-toggle';
      shareToggle.textContent = shareToggleLabel(e);
      shareToggle.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        toggleGalleryShare(e, shareToggle);
      });
      visibilityRow.appendChild(shareToggle);
    }
    meta.appendChild(visibilityRow);
    const byline = document.createElement('span');
    byline.className = 'vos-art-card-byline';
    const who = e.created_by ? `By ${e.created_by}` : 'Anonymous';
    byline.textContent = `${who} · ${fmtRel(e.created_at)}`;
    meta.appendChild(byline);
    card.appendChild(meta);
    return card;
  }

export function renderGallery(entries, total) {
    syncGalleryChrome();
    studio.galleryEl.innerHTML = '';
    const config = studio.GALLERY_SCOPES[studio.currentGalleryScope] || studio.GALLERY_SCOPES.mine;
    const noun = config.noun;
    studio.countEl.textContent = total === 0
      ? config.empty
      : `${total} ${noun}${total === 1 ? '' : 's'}`;
    if (!entries.length) {
      studio.galleryEl.innerHTML = `<div class="vos-art-empty">${escapeHtml(config.empty)}</div>`;
      if (studio.loadMoreEl) studio.loadMoreEl.hidden = true;
      return;
    }
    const frag = document.createDocumentFragment();
    entries.forEach((e) => frag.appendChild(buildGalleryCard(e)));
    studio.galleryEl.appendChild(frag);
    if (studio.pendingOpenImageId) tryOpenPending();
  }

export function setGalleryRefreshing(refreshing) {
    if (studio.refreshGalleryEl) {
      studio.refreshGalleryEl.disabled = refreshing;
      studio.refreshGalleryEl.classList.toggle('is-refreshing', refreshing);
    }
  }
