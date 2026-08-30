import { inPlayAddEl, inPlayListEl, inPlayRefreshEl, inPlaySaveEl, inPlayStatusEl, setStatus } from './dom.js';
import { adminJson, putJson, withPanel } from './http.js';
import { confirmDiscard, trackDirty } from './dirty.js';
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

/* Dirty when the rows on screen differ from what the server last gave us. */
let savedSnapshot = '[]';

function currentSnapshot() {
  return JSON.stringify(collectRows());
}

export function inPlayDirty() {
  if (!inPlayListEl) return false;
  return currentSnapshot() !== savedSnapshot;
}

trackDirty('in-play', inPlayDirty);

export function renderInPlayRow(item) {
  const row = document.createElement('div');
  row.className = 'vos-dm-inplay-row';
  const initialEmblem = (item && item.emblem) || '';

  const nameEl = document.createElement('input');
  nameEl.className = 'vos-dm-inplay-name';
  nameEl.setAttribute('list', 'vos-dm-inplay-pages');
  nameEl.placeholder = 'Pick a wiki entry or type a custom name';
  nameEl.maxLength = 120;
  const roleEl = document.createElement('input');
  roleEl.className = 'vos-dm-inplay-role';
  roleEl.placeholder = "Role / context (e.g. 'Missing fiance')";
  roleEl.maxLength = 120;
  const emblemSelectEl = document.createElement('select');
  emblemSelectEl.className = 'vos-dm-inplay-emblem-select';
  buildEmblemOptions(initialEmblem).forEach((option) => {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    if (option.value === initialEmblem) el.selected = true;
    emblemSelectEl.appendChild(el);
  });
  const emblemCustomEl = document.createElement('input');
  emblemCustomEl.className = 'vos-dm-inplay-emblem-custom';
  emblemCustomEl.placeholder = '2-3 char';
  emblemCustomEl.maxLength = 8;
  emblemCustomEl.hidden = true;
  const removeEl = document.createElement('button');
  removeEl.className = 'vos-dm-button is-danger';
  removeEl.type = 'button';
  removeEl.setAttribute('aria-label', 'Remove row');
  removeEl.textContent = '×';
  const linkEl = document.createElement('input');
  linkEl.type = 'hidden';
  linkEl.className = 'vos-dm-inplay-link';
  const kindEl = document.createElement('input');
  kindEl.type = 'hidden';
  kindEl.className = 'vos-dm-inplay-kind';
  row.append(nameEl, roleEl, emblemSelectEl, emblemCustomEl, removeEl, linkEl, kindEl);

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

  removeEl.addEventListener('click', () => row.remove());
  return row;
}

export function renderInPlayList(items) {
  inPlayListEl.innerHTML = '';
  (items || []).forEach((item) => inPlayListEl.appendChild(renderInPlayRow(item)));
  savedSnapshot = currentSnapshot();
}

function collectRows() {
  const rows = Array.from(inPlayListEl.querySelectorAll('.vos-dm-inplay-row'));
  return rows.map((row) => {
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
  });
}

/* Loads on tab open (not at import time), and never silently wipes rows the
 * DM is mid-edit on. */
export function refreshInPlay() {
  if (!confirmDiscard('in-play', 'Reload and discard the unsaved in-play rows?')) return null;
  return withPanel(inPlayStatusEl, inPlayRefreshEl, async () => {
    await loadWikiPages();
    const data = await adminJson('/api/in-play');
    renderInPlayList(data.items || []);
    setStatus(inPlayStatusEl, `Loaded ${data.items ? data.items.length : 0} rows.`);
  });
}

export async function saveInPlay() {
  const collected = collectRows();
  const items = collected.filter((item) => item.name);
  const skipped = collected.length - items.length;
  await withPanel(inPlayStatusEl, inPlaySaveEl, async () => {
    const data = await putJson('/api/in-play', { items });
    savedSnapshot = JSON.stringify(collectRows());
    const skippedNote = skipped
      ? ` ${skipped} row${skipped === 1 ? '' : 's'} without a name skipped.`
      : '';
    setStatus(inPlayStatusEl, `Saved ${data.count || 0} rows.${skippedNote}`, skipped > 0);
  }, { loading: 'Saving…' });
}

if (inPlayAddEl) inPlayAddEl.addEventListener('click', () => {
  inPlayListEl.appendChild(renderInPlayRow(null));
});

if (inPlayRefreshEl) inPlayRefreshEl.addEventListener('click', refreshInPlay);

if (inPlaySaveEl) inPlaySaveEl.addEventListener('click', saveInPlay);
