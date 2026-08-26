/* The player's own character sheet (/sheet/).
 *
 * Two views of one character: the story sheet the DM writes, and the statblock
 * imported from Foundry. Both come from /api/sheet in a single response, which
 * resolves whose they are from the token — there is nothing here that selects a
 * player, and that is the point.
 */
import { renderSheet, sheetSections } from './render.js';
import { loadMySheet, loadRoster, whenPwaReady } from './data.js';
import { normalizeStatblock } from '../statblock/normalize.js';
import { renderStatblock } from '../statblock/render.js';
import { loadPlayState } from '../play/api.js';
import { createControls } from '../play/controls.js';

const root = document.getElementById('vos-sheet-root');
const indexEl = document.getElementById('vos-sheet-index');
const tabsEl = document.getElementById('vos-sheet-tabs');

let payload = null;
let seat = {};
let view = 'story';
let play = null;        // { state, limits } — null until the stats tab is opened
let controls = null;
let statModel = null;

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

function notice(message, detail) {
  if (indexEl) indexEl.hidden = true;
  if (tabsEl) tabsEl.hidden = true;
  root.innerHTML = `<div class="empty-state"><b>${esc(message)}</b>${esc(detail || '')}</div>`;
}

function renderIndex(markdown) {
  if (!indexEl) return;
  const sections = markdown ? sheetSections(markdown) : [];
  if (sections.length < 3) { indexEl.hidden = true; return; }
  indexEl.innerHTML = sections
    .map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`)
    .join('');
  indexEl.hidden = false;
}

function renderTabs() {
  if (!tabsEl) return;
  const available = {
    story: Boolean(payload.sheet && payload.sheet.markdown),
    stats: Boolean(payload.statblock && payload.statblock.data),
  };
  // With only one view there is nothing to switch between.
  if (!(available.story && available.stats)) { tabsEl.hidden = true; return; }
  tabsEl.hidden = false;
  tabsEl.querySelectorAll('[data-view]').forEach((button) => {
    const name = button.dataset.view;
    button.classList.toggle('is-on', view === name);
    button.setAttribute('aria-selected', String(view === name));
    button.disabled = !available[name];
  });
}

function render() {
  const hasStory = Boolean(payload.sheet && payload.sheet.markdown);
  const hasStats = Boolean(payload.statblock && payload.statblock.data);
  if (view === 'story' && !hasStory) view = 'stats';
  if (view === 'stats' && !hasStats) view = 'story';

  renderTabs();

  if (view === 'stats') {
    if (!statModel) statModel = normalizeStatblock(payload.statblock.data);
    root.innerHTML = renderStatblock(statModel, {
      play: play && play.state,
      limits: play && play.limits,
      interactive: Boolean(play),
    });
    renderPlayBar();
    if (indexEl) indexEl.hidden = true;
    return;
  }

  const markdown = payload.sheet.markdown;
  root.innerHTML = renderSheet(markdown, {
    eyebrow: 'Character sheet',
    fallbackTitle: seat.display || payload.playerName,
  });
  renderIndex(markdown);
}

/* The bar lives at the bottom because that is where a thumb is. It holds the
 * three things touched every round and nothing else. */
function renderPlayBar() {
  const page = document.querySelector('.vos-sheet-page');
  let bar = document.getElementById('vos-play-bar');
  if (view !== 'stats' || !play) {
    if (bar) bar.remove();
    if (page) page.classList.remove('has-play-bar');
    return;
  }
  if (page) page.classList.add('has-play-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'vos-play-bar';
    bar.className = 'vos-play-bar';
    document.body.appendChild(bar);
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bar]');
      if (!button || !controls) return;
      if (button.dataset.bar === 'hp') controls.openHpPad();
      if (button.dataset.bar === 'conditions') controls.openConditions();
      if (button.dataset.bar === 'rest') controls.openRests();
    });
  }

  const s = play.state;
  const max = (play.limits && play.limits.maxHp) || 0;
  const current = s.hp.current != null ? s.hp.current : max;
  const pct = max ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const conditions = (s.conditions || []).filter((c) => c !== 'dying').length;
  const dying = (s.conditions || []).includes('dying');

  bar.innerHTML = `
    <button type="button" class="vos-play-bar-hp${dying ? ' is-dying' : ''}" data-bar="hp"
            aria-label="Hit points ${current} of ${max}">
      <span class="vos-play-bar-fill" style="width:${pct}%"></span>
      <span class="vos-play-bar-hp-text">
        <b>${current}</b><i>/${max || '—'}</i>
        ${s.hp.temp ? `<em>+${s.hp.temp}</em>` : ''}
      </span>
      ${dying ? '<span class="vos-play-bar-dying">Dying</span>' : ''}
    </button>
    <button type="button" class="vos-play-bar-btn" data-bar="conditions">
      Conditions${conditions ? `<b>${conditions}</b>` : ''}
    </button>
    <button type="button" class="vos-play-bar-btn" data-bar="rest">Rest</button>`;
}

function wire() {
  if (!tabsEl) return;
  tabsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button || button.disabled) return;
    view = button.dataset.view;
    render();
    if (view === 'stats') ensurePlay();
  });
}

/* Play state is fetched once, lazily. A player who only wants to reread their
 * backstory should not pay for it. */
async function ensurePlay() {
  if (play || !payload.statblock) return;
  try {
    const body = await loadPlayState();
    play = { state: body.state, limits: body.limits };
  } catch (error) {
    // The sheet is still worth reading without it, so this degrades to the
    // read-only statblock rather than an error page.
    return;
  }

  render();
  controls = createControls({
    root,
    state: play.state,
    limits: play.limits,
    onState(next) {
      play.state = next;
      controls.setState(next, play.limits);
      render();
    },
  });
}

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;

  if (!name) {
    notice('Sign in to read your sheet.', 'It is only visible to you and the DM.');
    return;
  }

  try {
    payload = await loadMySheet();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      notice('That session isn\u2019t authorised.', 'Sign in again and try once more.');
    } else {
      notice('Could not load your sheet.', error.message || 'Try again in a moment.');
    }
    return;
  }

  const hasStory = Boolean(payload.sheet && payload.sheet.markdown);
  const hasStats = Boolean(payload.statblock && payload.statblock.data);
  if (!hasStory && !hasStats) {
    notice('No sheet yet.', 'Your DM writes these \u2014 it will appear here once yours is ready.');
    return;
  }

  const roster = await loadRoster();
  seat = roster[payload.playerName] || {};
  if (seat.color) root.style.setProperty('--sheet-accent', seat.color);

  view = hasStory ? 'story' : 'stats';
  wire();
  render();
  if (hasStats) ensurePlay();
}

if (root) boot();
