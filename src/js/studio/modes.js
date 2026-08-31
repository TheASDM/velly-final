/* View or Create.
 *
 * Studio used to be three addresses for one room — a page under the wiki, a
 * separate Art Submissions route, and a gallery anchor halfway down. Two
 * modes replace all of it, and the mode you were in survives a reload so a
 * generation you left running is where you left it.
 */
import { studio } from './state.js';

const MODES = ['view', 'create'];
const KINDS = ['art', 'lore'];

function panels() {
  return Array.from(document.querySelectorAll('[data-studio-panel]'));
}

function tabs() {
  return Array.from(document.querySelectorAll('[data-studio-mode]'));
}

export function setStudioMode(mode, { keepUrl = false } = {}) {
  const next = MODES.includes(mode) ? mode : 'view';
  studio.mode = next;

  panels().forEach((panel) => { panel.hidden = panel.dataset.studioPanel !== next; });
  tabs().forEach((tab) => {
    const active = tab.dataset.studioMode === next;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    /* Only the selected tab is in the tab order; the arrow keys move between
       them, which is what a tablist promises a keyboard. */
    tab.tabIndex = active ? 0 : -1;
  });

  if (keepUrl) return next;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState({}, '', url.toString());
  } catch (error) { /* history is a convenience here, not a dependency */ }
  return next;
}

/* Which mode to open in. An explicit ?tab= wins; a link that names a piece or
 * a library filter means someone is coming to look at something, not to make
 * something. */
function initialMode() {
  const params = studio.urlParams;
  const asked = (params.get('tab') || '').toLowerCase();
  if (MODES.includes(asked)) return asked;
  if (KINDS.includes((params.get('kind') || '').toLowerCase())) return 'create';
  return 'view';
}

/* Art or Lore, inside Create.
 *
 * Lore used to be a link to /submit-lore/, so choosing it left Studio — and
 * with it the View/Create tabs, which is what made the page feel like it had
 * fallen out of the app. Both are panels here, and the choice is in the
 * address so a link can open either one.
 */
export function setStudioKind(kind, { keepUrl = false } = {}) {
  const next = KINDS.includes(kind) ? kind : 'art';
  studio.kind = next;

  document.querySelectorAll('[data-studio-kind-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.studioKindPanel !== next;
  });
  document.querySelectorAll('[data-studio-kind]').forEach((tab) => {
    const active = tab.dataset.studioKind === next;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  if (keepUrl) return next;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('kind', next);
    window.history.replaceState({}, '', url.toString());
  } catch (error) { /* the address is a convenience */ }
  return next;
}

function initStudioKinds() {
  const bar = document.getElementById('vos-studio-kinds');
  if (!bar) return;
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-studio-kind]');
    if (!button) return;
    setStudioKind(button.dataset.studioKind);
  });
  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const order = Array.from(document.querySelectorAll('[data-studio-kind]'));
    const at = order.findIndex((t) => t.dataset.studioKind === studio.kind);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const target = order[(at + step + order.length) % order.length];
    if (!target) return;
    event.preventDefault();
    setStudioKind(target.dataset.studioKind);
    target.focus();
  });
  const asked = (studio.urlParams.get('kind') || '').toLowerCase();
  setStudioKind(KINDS.includes(asked) ? asked : 'art', { keepUrl: true });
}

export function initStudioModes() {
  const bar = document.getElementById('vos-studio-modes');
  if (!bar) return;

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-studio-mode]');
    if (!button) return;
    setStudioMode(button.dataset.studioMode);
  });

  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const order = tabs();
    const at = order.findIndex((tab) => tab.dataset.studioMode === studio.mode);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const target = order[(at + step + order.length) % order.length];
    if (!target) return;
    event.preventDefault();
    setStudioMode(target.dataset.studioMode);
    target.focus();
  });

  setStudioMode(initialMode(), { keepUrl: true });
  initStudioKinds();
}

/* A finished generation belongs in the library, so the app goes and shows it
 * rather than leaving the piece behind a tab the player has to find. */
export function showInLibrary() {
  setStudioMode('view');
}
