/* The unread count, in the two places it belongs: the app-bar bubble and,
 * on an installed app, the home-screen icon.
 *
 * Quiet on failure — a badge is never worth an error banner. */
import { authHeaders } from '../shared/pwa.js';

let lastCount = 0;

export function applyCount(unread) {
  lastCount = Math.max(0, unread || 0);
  const badge = document.getElementById('vos-chat-count');
  if (badge) {
    badge.textContent = lastCount > 99 ? '99+' : String(lastCount);
    badge.hidden = lastCount === 0;
  }
  const button = document.getElementById('vos-chat-button');
  if (button) {
    button.setAttribute(
      'aria-label',
      lastCount ? `Chat — ${lastCount} unread` : 'Chat'
    );
  }
  // iOS needs the installed PWA on 16.4+ for this to show anywhere.
  try {
    if (lastCount > 0 && navigator.setAppBadge) navigator.setAppBadge(lastCount);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch (error) { /* unsupported, or denied */ }
}

export function getCount() {
  return lastCount;
}

export async function syncBadge() {
  const pwa = window.VOS_PWA;
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (!name || (pwa.isPreviewing && pwa.isPreviewing())) {
    applyCount(0);
    return;
  }
  try {
    const response = await fetch('/api/im/threads', {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const data = await response.json();
    applyCount((data.threads || []).reduce(
      (sum, thread) => sum + (thread.unread || 0), 0
    ));
  } catch (error) { /* stays as it was */ }
}
