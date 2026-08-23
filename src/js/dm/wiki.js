import { adminJson, getToken, pollRebuildStatus, setStatus, setStatusWithRebuild, wikiContentEl, wikiContentRowEl, wikiLoadEl, wikiMetaEl, wikiOpenEl, wikiQueryEl, wikiSaveEl, wikiStatusEl } from './state.js';

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
  const token = getToken(wikiStatusEl);
  if (!token) return;
  await loadWikiPages();
  const wikiUrl = resolveWikiQuery(wikiQueryEl.value);
  loadedWikiEntry = null;
  wikiContentEl.value = '';
  wikiContentRowEl.hidden = true;
  wikiOpenEl.hidden = true;
  wikiSaveEl.disabled = true;
  wikiMetaEl.textContent = '';
  if (!wikiUrl) {
    setStatus(wikiStatusEl, 'Choose a known wiki page or paste a /en/... URL.', true);
    return;
  }
  wikiLoadEl.disabled = true;
  setStatus(wikiStatusEl, 'Loading wiki source...');
  try {
    const data = await adminJson(`/api/admin/wiki-entry?url=${encodeURIComponent(wikiUrl)}`, token);
    renderWikiEntry(data.entry || {});
    if (wikiQueryEl.value.trim().startsWith('/en/')) {
      wikiQueryEl.value = (data.entry && data.entry.url) || wikiUrl;
    }
    setStatus(wikiStatusEl, 'Loaded.');
  } catch (error) {
    setStatus(wikiStatusEl, error.message, true);
  } finally {
    wikiLoadEl.disabled = false;
    wikiSaveEl.disabled = !loadedWikiEntry;
  }
}

export async function saveWikiEntry(event) {
  event.preventDefault();
  const token = getToken(wikiStatusEl);
  if (!token || !loadedWikiEntry) return;
  if (!window.confirm('Save this wiki source file?')) return;
  wikiSaveEl.disabled = true;
  setStatus(wikiStatusEl, 'Saving wiki source...');
  try {
    const data = await adminJson('/api/admin/wiki-entry', token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: loadedWikiEntry.url,
        content: wikiContentEl.value,
        expected_hash: loadedWikiEntry.hash,
      }),
    });
    renderWikiEntry(data.entry || {});
    setStatusWithRebuild(wikiStatusEl, 'Saved.', data.rebuild);
    if (data.rebuild && (data.rebuild.state === 'queued' || data.rebuild.state === 'running')) {
      pollRebuildStatus(wikiStatusEl);
    }
  } catch (error) {
    setStatus(wikiStatusEl, error.message, true);
  } finally {
    wikiSaveEl.disabled = false;
  }
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
