/* The chat overlay: one bubble in the app bar, one panel over every page.
 *
 * Mobile is a full-screen sheet with the body locked behind it; desktop is
 * a right-docked panel that leaves the page readable and usable — no scrim,
 * no focus trap, because it is meant to sit open beside what you are doing.
 * Escape and the Android back gesture close it either way, and the page
 * beneath never navigates.
 */
import { createChatPanel } from './panel.js';
import { applyCount, syncBadge } from './badge.js';

const DESKTOP = '(min-width: 701px)';
const HISTORY_MARK = 'vosChatOpen';

let panel = null;
let host = null;
let open = false;
let pushedHistory = false;

function isDesktop() {
  return !!(window.matchMedia && window.matchMedia(DESKTOP).matches);
}

function setButtonState() {
  const button = document.getElementById('vos-chat-button');
  if (!button) return;
  button.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function ensurePanel() {
  if (panel) return panel;
  host = document.createElement('div');
  host.className = 'vos-chat-host';
  host.hidden = true;
  panel = createChatPanel({
    mode: 'overlay',
    onUnreadChange: applyCount,
    onCloseRequest: () => closeOverlay(),
  });
  host.append(panel.root);
  document.body.append(host);
  return panel;
}

export async function openOverlay(threadKey) {
  ensurePanel();
  if (!open) {
    open = true;
    host.hidden = false;
    document.body.classList.toggle('vos-chat-open', true);
    if (!isDesktop()) document.body.classList.add('vos-chat-locked');
    setButtonState();
    // One history entry, so the Android back gesture closes the panel
    // instead of leaving the page you were reading.
    try {
      window.history.pushState({ [HISTORY_MARK]: true }, '');
      pushedHistory = true;
    } catch (error) { pushedHistory = false; }
  }
  panel.setActive(true);
  const name = await panel.boot();
  if (!name) return;
  await panel.refresh();
  if (threadKey && panel.hasThread(threadKey)) panel.openThread(threadKey);
  else if (!panel.openKey) panel.restore();
}

export function closeOverlay(fromPopState) {
  if (!open) return;
  open = false;
  if (host) host.hidden = true;
  document.body.classList.remove('vos-chat-open', 'vos-chat-locked');
  setButtonState();
  if (panel) panel.setActive(false);
  syncBadge();
  if (pushedHistory && !fromPopState) {
    pushedHistory = false;
    try { window.history.back(); } catch (error) { /* nothing to go back to */ }
  } else {
    pushedHistory = false;
  }
}

export function toggleOverlay() {
  if (open) closeOverlay();
  else openOverlay();
}

export function isOverlayOpen() {
  return open;
}

export function getOverlayPanel() {
  return panel;
}

export function initOverlay() {
  const button = document.getElementById('vos-chat-button');
  if (button) button.addEventListener('click', () => toggleOverlay());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      closeOverlay();
    }
  });

  window.addEventListener('popstate', () => {
    if (open) closeOverlay(true);
  });

  // A width change while open swaps sheet for dock; the body lock only
  // belongs to the sheet.
  if (window.matchMedia) {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => {
      if (!open) return;
      document.body.classList.toggle('vos-chat-locked', !isDesktop());
    };
    if (query.addEventListener) query.addEventListener('change', onChange);
    else if (query.addListener) query.addListener(onChange);
  }
}
