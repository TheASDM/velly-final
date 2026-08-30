import { setStatus, wikiContentEl, wikiContentRowEl, wikiLoadEl, wikiMetaEl, wikiOpenEl, wikiQueryEl, wikiSaveEl, wikiStatusEl } from './dom.js';
import { adminJson, putJson, withPanel } from './http.js';
import { followRebuild } from './rebuild.js';
import { confirmDiscard, trackDirty } from './dirty.js';
import { confirmSheet } from './confirm.js';

export let loadedWikiEntry = null;

export let wikiPagesByTitle = null;

export let wikiPages = [];

export { escapeHtml } from '../shared/pwa.js';
import { escapeHtml } from '../shared/pwa.js';

export function renderMarkdown(s) {
  const renderer = window.VOS_RENDER_MARKDOWN || (window.VOS_PWA && window.VOS_PWA.renderSafeMarkdown);
  if (renderer) return renderer(s || '');
  return escapeHtml(s).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

export function wikiEditorDirty() {
  return !!loadedWikiEntry && wikiContentEl.value !== (loadedWikiEntry.content || '');
}

trackDirty('wiki-editor', wikiEditorDirty);

export function resolveWikiQuery(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/en/')) return raw;
  const exact = wikiPagesByTitle && wikiPagesByTitle.get(raw);
  if (exact) return exact.url;
  const lower = raw.toLowerCase();
  const match = wikiPages.find((entry) =>
    (entry.title || '').toLowerCase() === lower ||
    (entry.url || '').toLowerCase() === lower
  );
  return match ? match.url : null;
}

export function renderWikiEntry(entry) {
  loadedWikiEntry = entry;
  wikiContentEl.value = entry.content || '';
  wikiContentRowEl.hidden = false;
  wikiSaveEl.disabled = false;
  wikiOpenEl.hidden = !entry.url;
  if (entry.url) wikiOpenEl.href = entry.url;
  const title = entry.title || entry.url || 'Wiki entry';
  wikiMetaEl.innerHTML = `${escapeHtml(title)} · <code>${escapeHtml(entry.source_file || '')}</code>`;
}

export async function loadWikiEntry() {
  await loadWikiPages();
  const wikiUrl = resolveWikiQuery(wikiQueryEl.value);
  if (!wikiUrl) {
    setStatus(wikiStatusEl, 'Choose a known wiki page or paste a /en/... URL.', true);
    return null;
  }
  // The editor keeps showing what it has until the new page has actually
  // arrived — and never silently discards edits in progress.
  if (!(await confirmDiscard('wiki-editor', 'Discard unsaved wiki edits and load another page?'))) {
    return null;
  }
  clearWikiConflict();
  return withPanel(wikiStatusEl, wikiLoadEl, async () => {
    const data = await adminJson(`/api/admin/wiki-entry?url=${encodeURIComponent(wikiUrl)}`);
    renderWikiEntry(data.entry || {});
    if (wikiQueryEl.value.trim().startsWith('/en/')) {
      wikiQueryEl.value = (data.entry && data.entry.url) || wikiUrl;
    }
    setStatus(wikiStatusEl, 'Loaded.');
  }, { loading: 'Loading wiki source…' });
}

function clearWikiConflict() {
  document.querySelectorAll('.vos-dm-conflict').forEach((el) => el.remove());
}

/* The save hit a 409: someone (or another tab) changed the file since it
 * was loaded. Show their version for manual merging and offer both exits —
 * neither of which happens silently. */
async function renderWikiConflict() {
  const data = await adminJson(
    `/api/admin/wiki-entry?url=${encodeURIComponent(loadedWikiEntry.url)}`
  );
  const theirs = data.entry || {};
  setStatus(wikiStatusEl, 'This page changed since you loaded it. Merge below.', true);

  const box = document.createElement('div');
  box.className = 'vos-dm-conflict';
  const note = document.createElement('p');
  note.className = 'vos-dm-helper';
  note.textContent =
    'Your editor keeps your version. Copy anything you need from theirs, then choose:';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Their version (current on disk)';
  const pre = document.createElement('pre');
  pre.textContent = theirs.content || '';
  details.append(summary, pre);
  const actions = document.createElement('div');
  actions.className = 'vos-dm-actions';
  const overwrite = document.createElement('button');
  overwrite.type = 'button';
  overwrite.className = 'vos-dm-button is-danger';
  overwrite.textContent = 'Overwrite with mine';
  overwrite.addEventListener('click', async () => {
    box.remove();
    await withPanel(wikiStatusEl, wikiSaveEl, async () => {
      const saved = await putJson('/api/admin/wiki-entry', {
        url: loadedWikiEntry.url,
        content: wikiContentEl.value,
        expected_hash: theirs.hash,
      });
      renderWikiEntry(saved.entry || {});
      followRebuild(wikiStatusEl, 'Saved over their version.', saved.rebuild);
    }, { loading: 'Saving…' });
  });
  const takeTheirs = document.createElement('button');
  takeTheirs.type = 'button';
  takeTheirs.className = 'vos-dm-button';
  takeTheirs.textContent = 'Load theirs (discard mine)';
  takeTheirs.addEventListener('click', () => {
    box.remove();
    renderWikiEntry(theirs);
    setStatus(wikiStatusEl, 'Loaded their version.');
  });
  actions.append(takeTheirs, overwrite);
  box.append(note, details, actions);
  wikiStatusEl.after(box);
}

export async function saveWikiEntry(event) {
  event.preventDefault();
  if (!loadedWikiEntry) return;
  if (!(await confirmSheet('Save this wiki source file?', { confirmLabel: 'Save' }))) return;
  clearWikiConflict();
  await withPanel(wikiStatusEl, wikiSaveEl, async () => {
    try {
      const data = await putJson('/api/admin/wiki-entry', {
        url: loadedWikiEntry.url,
        content: wikiContentEl.value,
        expected_hash: loadedWikiEntry.hash,
      });
      renderWikiEntry(data.entry || {});
      followRebuild(wikiStatusEl, 'Saved.', data.rebuild);
    } catch (error) {
      if (error.payload && error.payload.error_code === 'conflict') {
        await renderWikiConflict();
        return;
      }
      throw error;
    }
  }, { loading: 'Saving wiki source…' });
  wikiSaveEl.disabled = !loadedWikiEntry;
}

export async function loadWikiPages() {
  if (wikiPagesByTitle) return wikiPagesByTitle;
  try {
    // Live from the source tree, so a page created since the last build is
    // editable immediately. Falls back to the build's index offline.
    let data;
    try {
      data = (await adminJson('/api/admin/wiki-pages')).pages;
    } catch (error) {
      const response = await fetch('/data/wiki-pages.json', { cache: 'default' });
      if (!response.ok) return new Map();
      data = await response.json();
    }
    wikiPages = Array.isArray(data) ? data : [];
    const map = new Map();
    const datalists = [
      document.getElementById('vos-dm-inplay-pages'),
      document.getElementById('vos-dm-wiki-pages'),
    ].filter(Boolean);
    datalists.forEach((datalist) => { datalist.innerHTML = ''; });
    wikiPages.forEach((entry) => {
      if (!entry || !entry.title) return;
      map.set(entry.title, entry);
      datalists.forEach((datalist) => {
        const option = document.createElement('option');
        option.value = entry.title;
        option.label = entry.url || '';
        datalist.appendChild(option);
      });
    });
    wikiPagesByTitle = map;
    return map;
  } catch (error) {
    return new Map();
  }
}
