/* Unread instant-message badge: a count on the user menu's Messages link
 * and a dot on the menu button, refreshed on load, on focus, and when the
 * inbox marks a thread read. Quiet on failure — a badge is never worth an
 * error banner. */
import { authHeaders } from './identity.js';

function applyBadge(unread) {
  const link = document.querySelector('#vos-user-menu a[href="/messages/"]');
  if (link) {
    let badge = link.querySelector('.vos-im-menu-badge');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'vos-im-menu-badge';
        link.appendChild(badge);
      }
      badge.textContent = String(unread);
    } else if (badge) {
      badge.remove();
    }
  }
  const button = document.getElementById('vos-app-identity-button');
  if (button) {
    let dot = button.querySelector('.vos-im-dot');
    if (unread > 0) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'vos-im-dot';
        dot.setAttribute('aria-hidden', 'true');
        button.appendChild(dot);
      }
    } else if (dot) {
      dot.remove();
    }
  }
}

export async function syncImBadge() {
  const pwa = window.VOS_PWA;
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (!name) return;
  try {
    const response = await fetch('/api/im/threads', {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const data = await response.json();
    const unread = (data.threads || []).reduce(
      (sum, thread) => sum + (thread.unread || 0), 0
    );
    applyBadge(unread);
  } catch (error) { /* stays as it was */ }
}

export function initImBadge() {
  syncImBadge();
  window.addEventListener('focus', syncImBadge);
  window.addEventListener('vos:im-read', syncImBadge);
}
