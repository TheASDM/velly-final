import { setStatus, wikiContentEl, wikiContentRowEl, wikiLoadEl, wikiMetaEl, wikiOpenEl, wikiQueryEl, wikiSaveEl, wikiStatusEl } from './dom.js';
import { adminJson, putJson, withPanel } from './http.js';
import { followRebuild } from './rebuild.js';
import { confirmDiscard, trackDirty } from './dirty.js';

export let loadedWikiEntry = null;

export let wikiPagesByTitle = null;

export let wikiPages = [];

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
  if (!confirmDiscard('wiki-editor', 'Discard unsaved wiki edits and load another page?')) {
    return null;
  }
  return withPanel(wikiStatusEl, wikiLoadEl, async () => {
    const data = await adminJson(`/api/admin/wiki-entry?url=${encodeURIComponent(wikiUrl)}`);
    renderWikiEntry(data.entry || {});
    if (wikiQueryEl.value.trim().startsWith('/en/')) {
      wikiQueryEl.value = (data.entry && data.entry.url) || wikiUrl;
    }
    setStatus(wikiStatusEl, 'Loaded.');
  }, { loading: 'Loading wiki source…' });
}

export async function saveWikiEntry(event) {
  event.preventDefault();
  if (!loadedWikiEntry) return;
  if (!window.confirm('Save this wiki source file?')) return;
  await withPanel(wikiStatusEl, wikiSaveEl, async () => {
    const data = await putJson('/api/admin/wiki-entry', {
      url: loadedWikiEntry.url,
      content: wikiContentEl.value,
      expected_hash: loadedWikiEntry.hash,
    });
    renderWikiEntry(data.entry || {});
    followRebuild(wikiStatusEl, 'Saved.', data.rebuild);
  }, { loading: 'Saving wiki source…' });
  wikiSaveEl.disabled = !loadedWikiEntry;
}

export async function loadWikiPages() {
  if (wikiPagesByTitle) return wikiPagesByTitle;
  try {
    const response = await fetch('/data/wiki-pages.json', { cache: 'default' });
    if (!response.ok) return new Map();
    const data = await response.json();
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
