/* View or Create.
 *
 * Studio used to be three addresses for one room — a page under the wiki, a
 * separate Art Submissions route, and a gallery anchor halfway down. Two
 * modes replace all of it, and the mode you were in survives a reload so a
 * generation you left running is where you left it.
 */
import { studio } from './state.js';

const MODES = ['view', 'create'];

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
  if (params.get('image') || params.get('gallery') || params.get('scope')
      || params.get('filter') || params.get('favorites') === '1') {
    return 'view';
  }
  return 'view';
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
}

/* A finished generation belongs in the library, so the app goes and shows it
 * rather than leaving the piece behind a tab the player has to find. */
export function showInLibrary() {
  setStudioMode('view');
}
