import { adminJson, getToken, inPlayAddEl, inPlayListEl, inPlayRefreshEl, inPlaySaveEl, inPlayStatusEl, setStatus } from './state.js';
import { loadWikiPages, wikiPagesByTitle } from './wiki.js';

export const EMBLEM_PRESETS = ['PC', 'NPC', 'DM', 'Loc', 'Fac', 'Lore', 'Item', 'Map', 'Cre', 'Cul', 'Gov', 'Ses', 'Upd', 'Tbl'];

export const EMBLEM_SKIP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'on', 'to']);

export function autoEmblem(name) {
  const words = String(name || '')
    .replace(/['']/g, '')
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w && !EMBLEM_SKIP_WORDS.has(w));
  if (!words.length) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
}

export function buildEmblemOptions(currentEmblem) {
  const seen = new Set();
  const options = [{ value: '', label: 'Auto (from name)' }];
  EMBLEM_PRESETS.forEach((e) => {
    if (!seen.has(e)) { seen.add(e); options.push({ value: e, label: e }); }
  });
  // Keep the existing emblem visible if it's not in the preset list
  // (e.g. legacy two-letter codes like FW / OV / CC). Add it as its own
  // option above "Custom" so the dropdown round-trips cleanly.
  if (currentEmblem && !seen.has(currentEmblem) && currentEmblem !== '__custom__') {
    options.push({ value: currentEmblem, label: currentEmblem });
    seen.add(currentEmblem);
  }
  options.push({ value: '__custom__', label: 'Custom…' });
  return options;
}

export function renderInPlayRow(item) {
  const row = document.createElement('div');
  row.className = 'vos-dm-inplay-row';
  const initialEmblem = (item && item.emblem) || '';
  const optionsHtml = buildEmblemOptions(initialEmblem)
    .map((o) => `<option value="${o.value}"${o.value === initialEmblem ? ' selected' : ''}>${o.label}</option>`)
    .join('');

  row.innerHTML =
    `<input class="vos-dm-inplay-name" list="vos-dm-inplay-pages" placeholder="Pick a wiki entry or type a custom name" maxlength="120">` +
    `<input class="vos-dm-inplay-role" placeholder="Role / context (e.g. 'Missing fiance')" maxlength="120">` +
    `<select class="vos-dm-inplay-emblem-select">${optionsHtml}</select>` +
    `<input class="vos-dm-inplay-emblem-custom" placeholder="2-3 char" maxlength="8" hidden>` +
    `<button class="vos-dm-button is-danger" type="button" aria-label="Remove row">×</button>` +
    `<input type="hidden" class="vos-dm-inplay-link">` +
    `<input type="hidden" class="vos-dm-inplay-kind">`;

  const nameEl = row.querySelector('.vos-dm-inplay-name');
  const roleEl = row.querySelector('.vos-dm-inplay-role');
  const linkEl = row.querySelector('.vos-dm-inplay-link');
  const kindEl = row.querySelector('.vos-dm-inplay-kind');
  const emblemSelectEl = row.querySelector('.vos-dm-inplay-emblem-select');
  const emblemCustomEl = row.querySelector('.vos-dm-inplay-emblem-custom');

  if (item) {
    nameEl.value = item.name || '';
    roleEl.value = item.role || '';
    linkEl.value = item.link || '';
    kindEl.value = item.kind || '';
  }

  // Sync the link/kind hidden fields whenever the title matches a known
  // wiki entry. Manually-typed entries leave them blank — the in-play
  // chip just shows the name without a hyperlink.
  function syncWikiLookup() {
    if (!wikiPagesByTitle) return;
    const match = wikiPagesByTitle.get(nameEl.value.trim());
    if (match) {
      linkEl.value = match.url || '';
      kindEl.value = match.kind || '';
      row.classList.add('is-wiki-linked');
    } else {
      if (linkEl.value && wikiPagesByTitle.has(nameEl.dataset.lastMatchedTitle || '')) {
        linkEl.value = '';
        kindEl.value = '';
      }
      row.classList.remove('is-wiki-linked');
    }
    nameEl.dataset.lastMatchedTitle = match ? match.title : '';
  }
  nameEl.addEventListener('input', syncWikiLookup);
  nameEl.addEventListener('change', syncWikiLookup);
  syncWikiLookup();

  function syncEmblemCustomVisibility() {
    emblemCustomEl.hidden = emblemSelectEl.value !== '__custom__';
  }
  emblemSelectEl.addEventListener('change', syncEmblemCustomVisibility);
  syncEmblemCustomVisibility();

  row.querySelector('button').addEventListener('click', () => row.remove());
  return row;
}

export function renderInPlayList(items) {
  inPlayListEl.innerHTML = '';
  (items || []).forEach((item) => inPlayListEl.appendChild(renderInPlayRow(item)));
}

export async function refreshInPlay() {
  setStatus(inPlayStatusEl, 'Loading...');
  try {
    await loadWikiPages();
    const response = await fetch('/api/in-play', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    renderInPlayList(data.items || []);
    setStatus(inPlayStatusEl, `Loaded ${data.items ? data.items.length : 0} rows.`);
  } catch (error) {
    setStatus(inPlayStatusEl, error.message, true);
  }
}

export async function saveInPlay() {
  const token = getToken(inPlayStatusEl);
  if (!token) return;
  const rows = Array.from(inPlayListEl.querySelectorAll('.vos-dm-inplay-row'));
  const items = rows.map((row) => {
    const name = row.querySelector('.vos-dm-inplay-name').value.trim();
    const role = row.querySelector('.vos-dm-inplay-role').value.trim();
    const link = row.querySelector('.vos-dm-inplay-link').value.trim();
    const kind = row.querySelector('.vos-dm-inplay-kind').value.trim();
    const selectVal = row.querySelector('.vos-dm-inplay-emblem-select').value;
    const customVal = row.querySelector('.vos-dm-inplay-emblem-custom').value.trim();
    let emblem = '';
    if (selectVal === '__custom__') emblem = customVal;
    else if (selectVal) emblem = selectVal;
    else emblem = autoEmblem(name);
    return { name, role, kind, emblem, link };
  }).filter((item) => item.name);

  inPlaySaveEl.disabled = true;
  setStatus(inPlayStatusEl, 'Saving...');
  try {
    const data = await adminJson('/api/in-play', token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    setStatus(inPlayStatusEl, `Saved ${data.count || 0} rows.`);
    await refreshInPlay();
  } catch (error) {
    setStatus(inPlayStatusEl, error.message, true);
  } finally {
    inPlaySaveEl.disabled = false;
  }
}

if (inPlayAddEl) inPlayAddEl.addEventListener('click', () => {
  inPlayListEl.appendChild(renderInPlayRow(null));
});

if (inPlayRefreshEl) inPlayRefreshEl.addEventListener('click', refreshInPlay);

if (inPlaySaveEl) inPlaySaveEl.addEventListener('click', saveInPlay);

if (inPlayListEl) refreshInPlay();
