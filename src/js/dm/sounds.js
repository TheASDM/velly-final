/* The Syrinscape remote.
 *
 * Seventeen hundred soundsets do not want to be a list; they want to be a
 * search box. The library loads once per visit, typing filters it locally,
 * and opening a soundset fetches its moods and one-shots on demand. Tapping
 * a mood switches the table's soundscape; the row that is playing says so,
 * because at a loud table "did I hit it?" is a real question.
 */
import {
  authHeaders, getToken, setStatus, soundsListEl, soundsSearchEl,
  soundsStatusEl, soundsStopEl, soundsRefreshEl,
} from './state.js';

const SHOW_LIMIT = 60;

let library = null;          // [{uuid, name, full_name, category}] or null
let openSets = new Set();    // uuids expanded in the list
let details = {};            // uuid -> {moods, oneshots} | 'loading' | 'error'
let nowPlaying = null;       // pk of the mood we last started

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]),
  );
}

async function api(path, options) {
  const token = getToken(soundsStatusEl);
  if (!token) throw new Error('Sign in as DM first.');
  const response = await fetch(path, {
    cache: 'no-store',
    ...(options || {}),
    headers: authHeaders(token, (options || {}).headers),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function refreshSounds({ force = false } = {}) {
  if (library && !force) {
    renderSounds();
    return;
  }
  setStatus(soundsStatusEl, 'Loading the library...');
  try {
    const data = await api(`/api/sounds/soundsets${force ? '?refresh=1' : ''}`);
    library = data.soundsets || [];
    setStatus(soundsStatusEl, '');
    renderSounds();
  } catch (error) {
    setStatus(soundsStatusEl, error.message, true);
  }
}

function matches(term) {
  if (!term) return library;
  const needle = term.toLowerCase();
  return library.filter((set) =>
    set.full_name.toLowerCase().includes(needle)
    || set.category.toLowerCase().includes(needle));
}

function detailHtml(uuid) {
  const detail = details[uuid];
  if (detail === 'loading') return '<p class="vos-dm-sounds-note">Opening…</p>';
  if (detail === 'error' || !detail) return '<p class="vos-dm-sounds-note">Could not open this one.</p>';
  const moods = detail.moods.map((mood) => `
    <button type="button" class="vos-dm-sound${mood.pk === nowPlaying ? ' is-playing' : ''}"
            data-play="mood" data-pk="${mood.pk}">
      ${esc(mood.name)}${mood.pk === nowPlaying ? '<i>playing</i>' : ''}
    </button>`).join('');
  const oneshots = detail.oneshots.map((shot) => `
    <button type="button" class="vos-dm-sound is-oneshot" data-play="oneshot" data-pk="${shot.pk}">
      ${esc(shot.name)}<i>one-shot</i>
    </button>`).join('');
  return `
    ${moods ? `<div class="vos-dm-sounds-moods">${moods}</div>` : ''}
    ${oneshots ? `<div class="vos-dm-sounds-moods">${oneshots}</div>` : ''}
    ${!moods && !oneshots ? '<p class="vos-dm-sounds-note">Nothing playable in this set.</p>' : ''}`;
}

export function renderSounds() {
  if (!soundsListEl || library === null) return;
  const term = (soundsSearchEl && soundsSearchEl.value.trim()) || '';
  const found = matches(term);
  const shown = found.slice(0, SHOW_LIMIT);

  soundsListEl.innerHTML = `
    ${shown.map((set) => `
      <div class="vos-dm-soundset${openSets.has(set.uuid) ? ' is-open' : ''}">
        <button type="button" class="vos-dm-soundset-row" data-set="${esc(set.uuid)}">
          <b>${esc(set.name)}</b>
          <span>${esc(set.full_name !== set.name ? set.full_name : set.category)}</span>
        </button>
        ${openSets.has(set.uuid) ? `<div class="vos-dm-soundset-body">${detailHtml(set.uuid)}</div>` : ''}
      </div>`).join('')}
    ${found.length > shown.length
    ? `<p class="vos-dm-sounds-note">${found.length - shown.length} more match — narrow the search.</p>`
    : ''}
    ${!found.length ? '<p class="vos-dm-sounds-note">Nothing matches.</p>' : ''}`;
}

async function toggleSet(uuid) {
  if (openSets.has(uuid)) {
    openSets.delete(uuid);
    renderSounds();
    return;
  }
  openSets.add(uuid);
  if (!details[uuid] || details[uuid] === 'error') {
    details[uuid] = 'loading';
    renderSounds();
    try {
      const data = await api(`/api/sounds/soundsets/${encodeURIComponent(uuid)}`);
      details[uuid] = { moods: data.moods || [], oneshots: data.oneshots || [] };
    } catch (error) {
      details[uuid] = 'error';
      setStatus(soundsStatusEl, error.message, true);
    }
  }
  renderSounds();
}

async function play(kind, pk) {
  try {
    await api('/api/sounds/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, pk }),
    });
    if (kind === 'mood') nowPlaying = pk;
    setStatus(soundsStatusEl, kind === 'mood' ? 'Playing.' : 'Fired.');
    renderSounds();
  } catch (error) {
    setStatus(soundsStatusEl, error.message, true);
  }
}

export async function stopAllSounds() {
  try {
    await api('/api/sounds/stop-all', { method: 'POST' });
    nowPlaying = null;
    setStatus(soundsStatusEl, 'Silence.');
    renderSounds();
  } catch (error) {
    setStatus(soundsStatusEl, error.message, true);
  }
}

export function refreshSoundsHard() {
  library = null;
  details = {};
  refreshSounds({ force: true });
}

export function wireSounds() {
  if (!soundsListEl) return;
  soundsListEl.addEventListener('click', (event) => {
    const row = event.target.closest('[data-set]');
    if (row) {
      toggleSet(row.dataset.set);
      return;
    }
    const button = event.target.closest('[data-play]');
    if (button) play(button.dataset.play, Number(button.dataset.pk));
  });
  if (soundsSearchEl) soundsSearchEl.addEventListener('input', renderSounds);
  if (soundsStopEl) soundsStopEl.addEventListener('click', stopAllSounds);
  if (soundsRefreshEl) soundsRefreshEl.addEventListener('click', refreshSoundsHard);
}
