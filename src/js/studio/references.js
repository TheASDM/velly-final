import { studio } from './state.js';
import { openLightbox } from './lightbox.js';

export async function loadReferences() {
    if (studio.referencesLoaded) return;
    studio.referencesLoaded = true;
    const body = document.getElementById('vos-art-references-body');
    if (!body) return;
    try {
      const r = await fetch(studio.API_BASE + '/api/descriptions');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const cats = data.categories || [];
      if (!cats.length) {
        body.innerHTML = '<div class="vos-art-references-cat">No references registered.</div>';
        return;
      }
      body.innerHTML = '';
      cats.forEach((cat) => {
        if (!cat.entries || !cat.entries.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'vos-art-references-cat';
        const h = document.createElement('h4');
        h.textContent = cat.label;
        wrap.appendChild(h);
        const names = document.createElement('div');
        names.className = 'vos-art-references-names';
        cat.entries.forEach((name) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'vos-art-references-name';
          chip.textContent = name;
          chip.title = 'Insert into prompt';
          chip.addEventListener('click', () => insertReferenceName(name));
          names.appendChild(chip);
        });
        wrap.appendChild(names);
        body.appendChild(wrap);
      });
    } catch (e) {
      body.innerHTML = '<div class="vos-art-references-cat">Couldn’t load references.</div>';
    }
  }

export function insertReferenceName(name) {
    const start = studio.promptEl.selectionStart || studio.promptEl.value.length;
    const end = studio.promptEl.selectionEnd || studio.promptEl.value.length;
    const before = studio.promptEl.value.slice(0, start);
    const after = studio.promptEl.value.slice(end);
    const sep = before && !/\s$/.test(before) ? ' ' : '';
    const trailing = after && !/^\s/.test(after) ? ' ' : '';
    studio.promptEl.value = before + sep + name + trailing + after;
    const caret = (before + sep + name).length;
    studio.promptEl.setSelectionRange(caret, caret);
    studio.promptEl.focus();
  }

export function tryOpenPending() {
    if (!studio.pendingOpenImageId) return;
    const card = studio.galleryEl.querySelector('[data-entry-id="' + studio.pendingOpenImageId + '"]');
    if (!card) return;
    try {
      const data = JSON.parse(card.dataset.entry);
      openLightbox(data);
    } catch (e) {}
    studio.pendingOpenImageId = null;
    // Clean the param so a refresh doesn't keep re-opening.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('image');
      window.history.replaceState({}, '', u.toString());
    } catch (e) {}
  }
