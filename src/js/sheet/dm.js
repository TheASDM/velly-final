/* Every character sheet, DM-only (/sheets/).
 *
 * The read side for the DM: pick a player, then flip between the sheet they
 * read and the sheet behind it. The DM variant carries the arc spoilers, so it
 * is labelled plainly rather than blending in with the player copy.
 *
 * Access is enforced server-side — /api/sheets is DM-gated by
 * _admin_error_response(). The check here is UX, not security.
 */
import { renderSheet, sheetSections } from './render.js';
import { loadAllSheets, loadRoster, whenPwaReady } from './data.js';
import { normalizeStatblock } from '../statblock/normalize.js';
import { renderStatblock } from '../statblock/render.js';

const root = document.getElementById('vos-sheets-root');
const rosterEl = document.getElementById('vos-sheets-roster');
const toolbarEl = document.getElementById('vos-sheets-toolbar');
const indexEl = document.getElementById('vos-sheets-index');

let sheets = [];
let roster = {};
const state = { player: null, variant: 'dm' };

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

function notice(message, detail) {
  if (toolbarEl) toolbarEl.hidden = true;
  if (rosterEl) rosterEl.innerHTML = '';
  if (indexEl) indexEl.hidden = true;
  root.innerHTML = `<div class="empty-state"><b>${esc(message)}</b>${esc(detail || '')}</div>`;
}

function current() {
  return sheets.find((sheet) => sheet.playerName === state.player) || sheets[0];
}

function seatFor(sheet) {
  return roster[sheet.playerName] || {};
}

function shortName(sheet) {
  const seat = seatFor(sheet);
  return seat.display || sheet.playerName.split(' ')[0].replace(/[“”"]/g, '');
}

function renderRoster() {
  if (!rosterEl) return;
  rosterEl.innerHTML = sheets.map((sheet) => {
    const active = sheet.playerName === state.player;
    const seat = seatFor(sheet);
    const has = [
      sheet.dm ? 'DM' : null,
      sheet.player ? 'player' : null,
      sheet.statblock ? 'stats' : null,
    ].filter(Boolean).join(' + ');
    return `<button class="nav-item${active ? ' is-on' : ''}" type="button"
      data-player="${esc(sheet.playerName)}" style="--c:${esc(seat.color || '#d4a574')}">
      <span class="nav-row"><span class="nav-name">${esc(shortName(sheet))}</span></span>
      <span class="nav-role">${esc(has || 'no sheet')}</span>
    </button>`;
  }).join('');
}

function renderToolbar() {
  if (!toolbarEl) return;
  const sheet = current();
  toolbarEl.hidden = false;
  toolbarEl.querySelectorAll('[data-variant]').forEach((button) => {
    const variant = button.dataset.variant;
    button.classList.toggle('is-on', state.variant === variant);
    button.disabled = !(sheet && sheet[variant]);
    button.setAttribute('aria-pressed', String(state.variant === variant));
  });
}

function renderIndex(markdown) {
  if (!indexEl) return;
  const sections = sheetSections(markdown);
  if (sections.length < 3) { indexEl.hidden = true; return; }
  indexEl.innerHTML = sections
    .map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`)
    .join('');
  indexEl.hidden = false;
}

function render() {
  const sheet = current();
  if (!sheet) {
    notice('No sheets yet.', 'Import them with import_sheets.py and they appear here.');
    return;
  }

  state.player = sheet.playerName;
  // Fall back to whichever variant this player actually has.
  if (!sheet[state.variant]) {
    state.variant = sheet.dm ? 'dm' : sheet.player ? 'player' : 'statblock';
  }

  renderRoster();
  renderToolbar();

  const entry = sheet[state.variant];
  if (!entry) {
    root.innerHTML = `<div class="empty-state"><b>No ${esc(state.variant)} sheet for ${esc(shortName(sheet))}.</b></div>`;
    if (indexEl) indexEl.hidden = true;
    return;
  }

  renderViewAs(sheet);
  root.classList.toggle('is-dm-variant', state.variant === 'dm');

  if (state.variant === 'statblock') {
    root.innerHTML = renderStatblock(normalizeStatblock(entry.data));
    if (indexEl) indexEl.hidden = true;
    const statSeat = seatFor(sheet);
    if (statSeat.color) root.style.setProperty('--sheet-accent', statSeat.color);
    return;
  }

  root.innerHTML = renderSheet(entry.markdown, {
    eyebrow: state.variant === 'dm' ? 'DM sheet — spoilers' : 'Player sheet — what they read',
    fallbackTitle: shortName(sheet),
  });
  const seat = seatFor(sheet);
  if (seat.color) root.style.setProperty('--sheet-accent', seat.color);
  renderIndex(entry.markdown);
}

/* A way through to the player's own sheet, live and interactive, rather than
 * this read-only copy of it. */
function renderViewAs(sheet) {
  let link = document.getElementById('vos-view-as');
  if (!sheet.statblock) {
    if (link) link.remove();
    return;
  }
  if (!link) {
    link = document.createElement('a');
    link.id = 'vos-view-as';
    link.className = 'vos-view-as';
    toolbarEl.parentNode.insertBefore(link, toolbarEl.nextSibling);
  }
  link.href = `/sheet/?as=${encodeURIComponent(sheet.playerName)}`;
  link.textContent = `Open ${shortName(sheet)}'s sheet as they see it`;
}

function wire() {
  if (rosterEl) {
    rosterEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-player]');
      if (!button) return;
      state.player = button.dataset.player;
      render();
      root.scrollIntoView({ block: 'start' });
    });
  }
  if (toolbarEl) {
    toolbarEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-variant]');
      if (!button || button.disabled) return;
      state.variant = button.dataset.variant;
      render();
    });
  }
}

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;

  if (!name) {
    notice('Sign in to open the sheets.', 'These are every character sheet — DM only.');
    return;
  }
  if (!(name === 'DM' || (pwa && pwa.isDm && pwa.isDm()))) {
    notice('DM only.', 'Your own sheet lives at /sheet/.');
    return;
  }

  let payload;
  try {
    payload = await loadAllSheets();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      notice('That session isn’t authorised.', 'Sign in as the DM and try again.');
    } else {
      notice('Could not load the sheets.', error.message || 'Try again in a moment.');
    }
    return;
  }

  sheets = payload.sheets || [];
  if (!sheets.length) {
    notice('No sheets yet.', 'Import them with import_sheets.py and they appear here.');
    return;
  }

  roster = await loadRoster();
  state.player = sheets[0].playerName;
  wire();
  render();
}

if (root) boot();
