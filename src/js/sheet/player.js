/* The player's own character sheet (/sheet/).
 *
 * Two views of one character: the story sheet the DM writes, and the statblock
 * imported from Foundry. Both come from /api/sheet in a single response, which
 * resolves whose they are from the token — there is nothing here that selects a
 * player, and that is the point.
 */
import { renderSheet, sheetSections } from './render.js';
import { loadAllSheets, loadMySheet, loadRoster, whenPwaReady } from './data.js';
import { normalizeStatblock } from '../statblock/normalize.js';
import { renderStatblock } from '../statblock/render.js';
import { loadPlayState } from '../play/api.js';
import { createControls } from '../play/controls.js';
import { clock } from '../play/masquerade.js';

const root = document.getElementById('vos-sheet-root');
const indexEl = document.getElementById('vos-sheet-index');
const tabsEl = document.getElementById('vos-sheet-tabs');

let payload = null;
let seat = {};
let view = 'story';
let play = null;        // { state, limits } — null until the stats tab is opened
let controls = null;
/* Set when the DM is viewing someone else's sheet. Everything downstream reads
 * it, so "view as" is the same page rather than a second implementation that
 * could drift from what the player actually sees. */
let viewingAs = null;
let statModel = null;
let maskTimer = null;

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
    renderMaskBanner();
    renderFormBlock();
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

/* The mask banner.
 *
 * The countdown ticks locally for smoothness but is anchored to the remaining
 * time the server reported, so a locked phone or a reloaded tab picks up the
 * real answer rather than a drifted one.
 */
/* Whose sheet this is. Unmistakable, because acting here changes their
 * character rather than yours. */
function renderViewingAs() {
  if (!viewingAs) return;
  if (document.getElementById('vos-viewing-as')) return;
  const bar = document.createElement('div');
  bar.id = 'vos-viewing-as';
  bar.className = 'vos-viewing-as';
  bar.innerHTML = `<span>Viewing as <b>${esc(seat.display || viewingAs)}</b> — changes apply to them</span>
    <a href="/party/">Back to the table</a>`;
  const page = document.querySelector('.vos-sheet-page');
  if (page) page.insertBefore(bar, page.firstChild);
}

function renderMaskBanner() {
  let banner = document.getElementById('vos-mask-banner');
  const mask = play && play.state.mask;
  if (view !== 'stats' || !mask) {
    if (banner) banner.remove();
    clearInterval(maskTimer);
    maskTimer = null;
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'vos-mask-banner';
    banner.className = 'vos-mask-banner';
    root.parentNode.insertBefore(banner, root);
    banner.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mask-action]');
      if (!button || !controls) return;
      const action = button.dataset.maskAction;
      if (action === 'form') controls.openForms();
      if (action === 'revert') controls.apply({ op: 'revertForm' });
      if (action === 'pause') controls.apply({ op: mask.paused ? 'resumeMask' : 'pauseMask' });
      if (action === 'remove') controls.apply({ op: 'removeMask' });
    });
  }

  const anchor = Date.now();
  const paint = () => {
    const left = mask.paused
      ? mask.remainingMs
      : Math.max(0, mask.remainingMs - (Date.now() - anchor));
    const form = play.state.form;
    banner.className = `vos-mask-banner${mask.paused ? ' is-paused' : ''}${left <= 0 ? ' is-out' : ''}`;
    banner.innerHTML = `
      <span class="vos-mask-name">${form ? form.creature : mask.key}</span>
      <span class="vos-mask-clock">${clock(left)}${mask.paused ? ' paused' : ''}</span>
      <button type="button" class="vos-mask-btn" data-mask-action="pause"
              aria-label="${mask.paused ? 'Resume' : 'Pause'} the timer">${
        mask.paused ? '▶' : '❚❚'}</button>
      ${form
        ? '<button type="button" class="vos-mask-btn is-text" data-mask-action="revert">Revert</button>'
        : '<button type="button" class="vos-mask-btn is-text" data-mask-action="form">Assume form</button>'}
      <button type="button" class="vos-mask-btn is-text" data-mask-action="remove">Remove</button>`;
  };

  paint();
  clearInterval(maskTimer);
  maskTimer = mask.paused ? null : setInterval(paint, 1000);
}

/* The bar lives at the bottom because that is where a thumb is. It holds the
 * three things touched every round and nothing else. */
/* Only a College of the Masquerade bard has masks, and the sheet says so —
 * the feature is on the character or it is not. */
function hasMasks() {
  return Boolean(statModel && (statModel.features || [])
    .some((f) => (f.name || '').toLowerCase().startsWith('maschera ')));
}

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
      if (button.dataset.bar === 'mask') controls.openMasks();
      if (button.dataset.bar === 'prepare') controls.openPrepare();
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
    ${hasMasks() ? '<button type="button" class="vos-play-bar-btn" data-bar="mask">Mask</button>' : ''}
    ${statModel && statModel.spellcasting
      ? '<button type="button" class="vos-play-bar-btn" data-bar="prepare">Spells</button>' : ''}
    <button type="button" class="vos-play-bar-btn" data-bar="rest">Rest</button>`;
}

/* While transformed the creature's statblock goes above the character's, so
 * what you can do right now is what you read first. */
async function renderFormBlock() {
  const existing = document.getElementById('vos-form-block');
  if (existing) existing.remove();
  if (!controls || !play || !play.state.form) return;

  const html = await controls.formStatblockHtml();
  if (!html || !play.state.form) return;
  const holder = document.createElement('div');
  holder.id = 'vos-form-block';
  holder.innerHTML = html;
  root.parentNode.insertBefore(holder, root);
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

/* Whose sheet? Shown to the DM in place of their own, which does not exist.
 *
 * Built from the same DM-gated collection the view itself reads, so a player
 * who has no sheet is listed as unavailable rather than offered and then
 * failing on the next screen.
 */
async function renderPicker() {
  if (tabsEl) tabsEl.hidden = true;
  if (indexEl) indexEl.hidden = true;
  root.innerHTML = '<div class="empty-state"><b>Loading the roster…</b></div>';

  let sheets = [];
  try {
    sheets = (await loadAllSheets()).sheets || [];
  } catch (error) {
    notice('Could not load the roster.', error.message || 'Try again in a moment.');
    return;
  }

  const roster = await loadRoster();
  if (!sheets.length) {
    notice('No sheets yet.', 'Push characters from Foundry and they appear here.');
    return;
  }

  const cards = sheets.map((entry) => {
    const seat = roster[entry.playerName] || {};
    const has = [entry.statblock ? 'stats' : null, entry.player ? 'story' : null]
      .filter(Boolean).join(' · ');
    const label = seat.display || entry.playerName;
    return `<a class="vos-sheet-pick" href="/sheet/?as=${encodeURIComponent(entry.playerName)}"
               style="--c:${esc(seat.color || '#d4a574')}">
      <b>${esc(label)}</b>
      <span>${esc(has || 'nothing pushed yet')}</span>
    </a>`;
  }).join('');

  root.innerHTML = `<div class="vos-sheet-picker">
    <p class="vos-sheet-pick-lede">Nothing pushed for your own character yet.
    Open someone else's — you will see it exactly as they do.</p>
    <div class="vos-sheet-picks">${cards}</div>
  </div>`;
}

/* One player's sheet, taken from the DM's collection.
 *
 * /api/sheet cannot be told whose sheet to return — that is deliberate, and
 * tested — so the DM's view reads /api/sheets, which is DM-gated already,
 * rather than opening a second door into the player endpoint.
 */
async function loadSheetAs(playerName) {
  const body = await loadAllSheets();
  const entry = (body.sheets || []).find((s) => s.playerName === playerName);
  if (!entry) {
    const error = new Error(`No sheet for ${playerName}.`);
    error.status = 404;
    throw error;
  }
  return {
    playerName,
    sheet: entry.player || entry.dm || null,
    statblock: entry.statblock || null,
  };
}

/* Play state is fetched once, lazily. A player who only wants to reread their
 * backstory should not pay for it. */
async function ensurePlay() {
  if (play || !payload.statblock) return;
  if (!statModel) statModel = normalizeStatblock(payload.statblock.data);
  try {
    const body = await loadPlayState(viewingAs);
    play = { state: body.state, limits: body.limits };
  } catch (error) {
    // The sheet is still worth reading without it, so this degrades to the
    // read-only statblock rather than an error page.
    return;
  }

  render();
  controls = createControls({
    root,
    playerName: viewingAs,
    model: statModel,
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

  const asked = new URLSearchParams(window.location.search).get('as');
  const isDm = name === 'DM' || (pwa && pwa.isDm && pwa.isDm());
  if (asked && asked !== name) {
    if (!isDm) {
      notice('That is not your sheet.', 'Yours is at /sheet/.');
      return;
    }
    viewingAs = asked;
  }

  try {
    payload = viewingAs ? await loadSheetAs(viewingAs) : await loadMySheet();
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
    // The DM has their own character like anyone else; if it has not been
    // pushed yet, offering the roster is more useful than an empty page.
    if (isDm) { await renderPicker(); return; }
    notice('No sheet yet.', 'Your DM writes these \u2014 it will appear here once yours is ready.');
    return;
  }

  const roster = await loadRoster();
  seat = roster[payload.playerName] || {};
  if (seat.color) root.style.setProperty('--sheet-accent', seat.color);

  view = viewingAs ? 'stats' : (hasStory ? 'story' : 'stats');
  renderViewingAs();
  wire();
  render();
  if (hasStats) ensurePlay();
}

if (root) boot();
