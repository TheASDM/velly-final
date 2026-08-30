/* The global chat bundle, loaded in the app shell on every page.
 *
 * Owns the app-bar bubble, the unread badge, the overlay, and the bridge
 * from the service worker — a push arriving while you read a wiki page
 * moves the count without a poll, and tapping the banner opens the thread
 * in place rather than navigating away.
 */
import { applyCount, syncBadge } from './badge.js';
import { closeOverlay, initOverlay, isOverlayOpen, getOverlayPanel, openOverlay } from './overlay.js';

// Comfortably inside the server's "they are watching" window, so an open
// tab never falls out of it between beats.
const PRESENCE_HEARTBEAT_MS = 25000;

const isMessagesPage = () => document.body.classList.contains('vos-is-messages-page');

/* /messages/ mounts the same component full-page and registers itself here,
 * so a push tap opens the thread there instead of stacking an overlay on
 * top of it. */
const api = {
  open(threadKey) {
    if (api.pagePanel) {
      if (threadKey && api.pagePanel.hasThread(threadKey)) api.pagePanel.openThread(threadKey);
      return;
    }
    openOverlay(threadKey);
  },
  close: () => closeOverlay(),
  isOpen: () => isOverlayOpen(),
  refreshBadge: syncBadge,
  pagePanel: null,
};
window.VOS_CHAT = api;

function handleServiceWorkerMessage(event) {
  const data = event.data || {};
  if (data.type === 'VOS_IM_PUSH') {
    if (typeof data.unread === 'number') applyCount(data.unread);
    else syncBadge();
    const panel = api.pagePanel || getOverlayPanel();
    if (panel && (api.pagePanel || isOverlayOpen())) panel.refresh().catch(() => {});
    return;
  }
  if (data.type === 'VOS_IM_OPEN') {
    api.open(data.threadKey || null);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // The bubble is the door to the overlay everywhere except the page that
  // already is the overlay.
  const button = document.getElementById('vos-chat-button');
  if (button && isMessagesPage()) button.hidden = true;
  else initOverlay();

  // The pill and the panel are the same conversation: when one of them
  // finishes an exchange with Enzo, the other catches up.
  window.addEventListener('vos:enzo-exchange', (event) => {
    if (!event.detail || event.detail.source === 'panel') return;
    const panel = api.pagePanel || getOverlayPanel();
    if (panel && (api.pagePanel || isOverlayOpen())) panel.refresh().catch(() => {});
    syncBadge();
  });

  syncBadge();
  window.addEventListener('focus', syncBadge);
  window.addEventListener('vos:im-read', syncBadge);
  window.addEventListener('vos:identity-ready', syncBadge);

  // A slow heartbeat while the tab is on screen. It keeps the bubble count
  // honest without a push, and — because the same request touches presence
  // — it is how the server knows not to send a notification for a message
  // you are sitting there looking at. Stops dead when the tab is hidden,
  // which is exactly when a notification becomes useful again.
  let heartbeat = null;
  const stopHeartbeat = () => {
    if (heartbeat) window.clearInterval(heartbeat);
    heartbeat = null;
  };
  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') syncBadge();
      else stopHeartbeat();
    }, PRESENCE_HEARTBEAT_MS);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncBadge();
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  });
  if (document.visibilityState === 'visible') startHeartbeat();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
  }
});
