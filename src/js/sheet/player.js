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

const root = document.getElementById('vos-sheet-root');
const indexEl = document.getElementById('vos-sheet-index');
const tabsEl = document.getElementById('vos-sheet-tabs');

let payload = null;
let seat = {};
let view = 'story';

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
    root.innerHTML = renderStatblock(normalizeStatblock(payload.statblock.data));
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

function wire() {
  if (!tabsEl) return;
  tabsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button || button.disabled) return;
    view = button.dataset.view;
    render();
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
}

if (root) boot();
