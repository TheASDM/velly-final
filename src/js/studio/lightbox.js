import { studio } from './state.js';
import { toggleGalleryShare } from './gallery-actions.js';
import { clearObjectUrl, entryTitle, fmtRel, setImageSrc, shareToggleLabel, visibilityBadge } from './gallery-view.js';
import { escapeHtml } from './generation.js';
import { getCurrentAuthToken, getCurrentCreatorName, openStudioLogin, requestHeaders } from './identity.js';
import { setStatus } from './jobs.js';

export function openLightbox(e) {
    studio.currentLightboxEntry = e;
    if (studio.pinMenuEl) studio.pinMenuEl.hidden = true;
    setImageSrc(studio.lightImg, e.image_url, e);
    studio.lightImg.alt = entryTitle(e);
    if (studio.lightFavorite) {
      studio.lightFavorite.dataset.favoriteId = e.id;
      const isFav = studio.favoriteIds.has(e.id);
      studio.lightFavorite.classList.toggle('is-favorited', isFav);
      studio.lightFavorite.textContent = isFav ? '♥' : '♡';
    }
    const who = e.created_by ? `By ${escapeHtml(e.created_by)}` : 'Anonymous';
    let html = `<strong>${escapeHtml(entryTitle(e))}</strong>`;
    if (e.prompt && e.prompt !== e.title) {
      html += `<div class="vos-art-lightbox-prompt">${escapeHtml(e.prompt)}</div>`;
    }
    if (e.grounded_in && e.grounded_in.length) {
      const chips = e.grounded_in.map(n =>
        `<span class="vos-art-grounded-chip">${escapeHtml(n)}</span>`
      ).join('');
      html += `<div class="vos-art-grounded" style="justify-content:center;margin-top:0.55rem;">${chips}</div>`;
    }
    if (e.enhanced_prompt && e.enhanced_prompt !== e.prompt) {
      html += `<details class="vos-art-details" style="margin-top:0.8rem;">
        <summary>How Enzo saw it</summary>
        <div class="vos-art-enhanced">${escapeHtml(e.enhanced_prompt)}</div>
      </details>`;
    }
    html += `<div class="vos-art-lightbox-byline">${who} · ${fmtRel(e.created_at)}</div>`;
    studio.lightCap.innerHTML = html;
    const row = document.createElement('div');
    row.className = 'vos-art-visibility-row';
    row.style.justifyContent = 'center';
    row.appendChild(visibilityBadge(e));
    if (e.can_share) {
      const shareToggle = document.createElement('button');
      shareToggle.type = 'button';
      shareToggle.className = 'vos-art-share-toggle';
      shareToggle.textContent = shareToggleLabel(e);
      shareToggle.addEventListener('click', () => toggleGalleryShare(e, shareToggle));
      row.appendChild(shareToggle);
    }
    studio.lightCap.appendChild(row);
    if (studio.lightDelete) studio.lightDelete.hidden = !e.can_delete;
    studio.lightbox.classList.add('is-open');
    studio.lightbox.setAttribute('aria-hidden', 'false');
    // Scroll the lightbox back to top so the image is visible whenever a
    // new entry is opened, even after the previous one scrolled down.
    studio.lightbox.scrollTop = 0;
  }

export function closeLightbox() {
    studio.lightbox.classList.remove('is-open');
    studio.lightbox.setAttribute('aria-hidden', 'true');
    clearObjectUrl(studio.lightImg);
    studio.lightImg.src = '';
    studio.currentLightboxEntry = null;
    if (studio.pinMenuEl) studio.pinMenuEl.hidden = true;
    if (studio.lightDelete) studio.lightDelete.hidden = true;
  }

export async function loadWikiPagesIndex() {
    if (studio.wikiPagesByTitle) return studio.wikiPagesByTitle;
    try {
      const r = await fetch('/data/wiki-pages.json', { cache: 'default' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const map = new Map();
      (Array.isArray(data) ? data : []).forEach((entry) => {
        if (!entry || !entry.title) return;
        map.set(entry.title.toLowerCase(), entry);
      });
      studio.wikiPagesByTitle = map;
    } catch (e) {
      studio.wikiPagesByTitle = new Map();
    }
    return studio.wikiPagesByTitle;
  }

export function resolveWikiPageForName(map, name) {
    if (!name) return null;
    const key = name.toLowerCase();
    if (map.has(key)) return map.get(key);
    for (const [title, entry] of map.entries()) {
      if (title.includes(key) || key.includes(title)) return entry;
    }
    return null;
  }

export async function togglePinMenu(entry) {
    if (!studio.pinMenuEl) return;
    if (!studio.pinMenuEl.hidden) {
      studio.pinMenuEl.hidden = true;
      return;
    }
    studio.pinMenuEl.innerHTML = '<div class="vos-art-pin-empty">Loading wiki entries…</div>';
    studio.pinMenuEl.hidden = false;

    const map = await loadWikiPagesIndex();
    const grounded = Array.isArray(entry.grounded_in) ? entry.grounded_in : [];
    const candidates = [];
    const seen = new Set();
    grounded.forEach((name) => {
      const match = resolveWikiPageForName(map, name);
      if (!match || seen.has(match.url)) return;
      seen.add(match.url);
      candidates.push({ name, page: match });
    });

    studio.pinMenuEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'vos-art-pin-menu-title';
    title.textContent = 'Pin to wiki';
    studio.pinMenuEl.appendChild(title);

    if (!candidates.length) {
      const empty = document.createElement('div');
      empty.className = 'vos-art-pin-empty';
      empty.textContent = grounded.length
        ? 'None of the grounded entities match a published wiki page.'
        : 'This image has no grounded entities to pin to.';
      studio.pinMenuEl.appendChild(empty);
      return;
    }

    candidates.forEach((cand) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vos-art-pin-option';
      const labelWrap = document.createElement('span');
      const nameEl = document.createElement('div');
      nameEl.textContent = cand.page.title;
      labelWrap.appendChild(nameEl);
      btn.appendChild(labelWrap);
      const kind = document.createElement('span');
      kind.className = 'vos-art-pin-option-kind';
      kind.textContent = cand.page.kind || 'Wiki';
      btn.appendChild(kind);
      btn.addEventListener('click', () => pinImageToWiki(entry, cand.page, btn));
      studio.pinMenuEl.appendChild(btn);
    });
  }

export async function pinImageToWiki(entry, page, button) {
    const creator = getCurrentCreatorName();
    if (!creator || !getCurrentAuthToken()) {
      setStatus('Log in to pin images.', true);
      studio.pinMenuEl.hidden = true;
      await openStudioLogin();
      return;
    }
    button.disabled = true;
    const originalText = button.firstChild ? button.firstChild.textContent : '';
    button.firstChild && (button.firstChild.textContent = 'Pinning…');
    try {
      const r = await fetch(
        studio.API_BASE + '/api/gallery/' + encodeURIComponent(entry.id)
          + '/pin?name=' + encodeURIComponent(creator),
        {
          method: 'POST',
          headers: requestHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ wiki_url: page.url }),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      if (data.already_pinned) {
        setStatus('Already pinned to ' + page.title + '.');
      } else {
        setStatus('Pinned to ' + page.title + '. It will appear after the next site build.');
      }
    } catch (e) {
      setStatus('Pin failed: ' + e.message, true);
    } finally {
      button.disabled = false;
      button.firstChild && (button.firstChild.textContent = originalText);
      studio.pinMenuEl.hidden = true;
    }
  }
