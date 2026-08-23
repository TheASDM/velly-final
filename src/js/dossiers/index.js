/* Player dossiers (/dossiers/) — DM-only.
 *
 * A reading surface over every submitted character record: per-player dossiers,
 * a cross-reference view that puts one shared question to the whole table, and
 * search across every answer.
 *
 * This is the read side. /questionnaire/ remains the write side — the player's
 * own record, and the DM's interactive proofing view of it.
 *
 * Access is enforced server-side: /api/questionnaire/all is DM-gated by
 * _admin_error_response(). The checks here are UX, not security.
 */
import { loadDossiers } from './data.js';
import { esc, percent } from './util.js';
import { viewOverview } from './views/overview.js';
import { viewDossier } from './views/dossier.js';
import { chorusKeys, viewChorus } from './views/chorus.js';
import { viewSearch } from './views/search.js';

const root = document.getElementById('vos-dossiers-root');
const rosterEl = document.getElementById('vos-dossiers-roster');
const searchEl = document.getElementById('vos-dossiers-q');
const blanksEl = document.getElementById('vos-dossiers-blanks');
const toolbarEl = document.getElementById('vos-dossiers-toolbar');

let model = null;
const state = { view: 'overview', id: null, chorusKey: null, query: '', blanks: true };

function whenPwaReady(timeoutMs = 6000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    (function poll() {
      if (window.VOS_PWA) return resolve(window.VOS_PWA);
      if (Date.now() - startedAt > timeoutMs) return resolve(null);
      setTimeout(poll, 80);
    })();
  });
}

function notice(message, detail) {
  if (toolbarEl) toolbarEl.hidden = true;
  if (rosterEl) rosterEl.innerHTML = '';
  root.innerHTML = `<div class="empty-state"><b>${esc(message)}</b>${esc(detail || '')}</div>`;
}

function renderRoster() {
  if (!rosterEl) return;
  rosterEl.innerHTML = model.characters.map((character) => {
    const active = state.view === 'dossier' && state.id === character.id && !state.query;
    return `<button class="nav-item${active ? ' is-on' : ''}" data-char="${esc(character.id)}"
      style="--c:${esc(character.color)}">
      <span class="nav-row">
        <span class="nav-name">${esc(character.short)}</span>
        <span class="nav-meta">${character.answered}/${character.total}</span>
      </span>
      <span class="nav-role">${esc(character.role.split('·')[0].trim())}</span>
      <span class="meter"><i style="width:${percent(character.answered, character.total)}%"></i></span>
    </button>`;
  }).join('');

  document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
    button.classList.toggle(
      'is-on', state.view === button.dataset.view && !state.query
    );
  });
}

function currentCharacter() {
  return model.characters.find((c) => c.id === state.id) || model.characters[0];
}

function render() {
  const wide = state.view === 'overview' || state.view === 'chorus';
  root.classList.toggle('is-wide', wide && !state.query);

  if (state.query.trim()) root.innerHTML = viewSearch(model, state.query);
  else if (state.view === 'dossier') root.innerHTML = viewDossier(model, currentCharacter(), state.blanks);
  else if (state.view === 'chorus') root.innerHTML = viewChorus(model, state.chorusKey, state.blanks);
  else root.innerHTML = viewOverview(model);

  renderRoster();
}

function clearSearch() {
  state.query = '';
  if (searchEl) searchEl.value = '';
}

function wireEvents() {
  document.addEventListener('click', (event) => {
    const openChar = event.target.closest('[data-char]');
    if (openChar) {
      state.view = 'dossier';
      state.id = openChar.dataset.char;
      clearSearch();
      render();
      root.scrollIntoView({ block: 'start' });
      return;
    }
    const openView = event.target.closest('[data-view]');
    if (openView) {
      state.view = openView.dataset.view;
      clearSearch();
      render();
      root.scrollIntoView({ block: 'start' });
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'vos-dossier-chorus') {
      state.chorusKey = event.target.value;
      render();
    }
  });

  if (blanksEl) {
    blanksEl.addEventListener('change', () => {
      state.blanks = blanksEl.checked;
      render();
    });
  }

  if (searchEl) {
    let timer;
    searchEl.addEventListener('input', (event) => {
      clearTimeout(timer);
      const value = event.target.value;
      timer = setTimeout(() => { state.query = value; render(); }, 140);
    });
  }

  document.addEventListener('keydown', (event) => {
    const inField = /input|select|textarea/i.test(event.target.tagName);
    if (event.key === '/' && !inField && searchEl) {
      event.preventDefault();
      searchEl.focus();
    }
    if (event.key === 'Escape' && searchEl) {
      clearSearch();
      searchEl.blur();
      render();
    }
  });
}

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;

  if (!name) {
    notice('Sign in to open the dossiers.', 'These are the players’ character records — DM only.');
    return;
  }
  if (!(name === 'DM' || (pwa && pwa.isDm && pwa.isDm()))) {
    notice('DM only.', 'Your own record lives at /questionnaire/.');
    return;
  }

  try {
    model = await loadDossiers();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      notice('That session isn’t authorised.', 'Sign in as the DM and try again.');
    } else {
      notice('Could not load the dossiers.', error.message || 'Try again in a moment.');
    }
    return;
  }

  if (!model.characters.length) {
    notice('No character records yet.', 'They appear here once players start filling them in.');
    return;
  }

  state.chorusKey = (chorusKeys(model)[0] || {}).key || null;
  if (toolbarEl) toolbarEl.hidden = false;
  wireEvents();
  render();
}

if (root) boot();
