/* Enzo, offered inside the work — and honest about how much of him exists.
 *
 * The app describes a contextual Enzo who knows what page you are on and what
 * you are permitted to know. That is not built. What these buttons did was
 * seed the floating widget with a generic question and let it look like the
 * real thing, which is the worst of both: it is not contextual, and it hides
 * that it is not.
 *
 * So they say "Coming Soon" and hand you the conversation that does work —
 * Enzo's thread in Messages, which is stored, scrollable, and his half of an
 * actual back-and-forth. When the contextual version lands, these become it.
 *
 * Mark up an action with data-enzo-ask on any button.
 */

function playerName() {
  const pwa = window.VOS_PWA;
  return (pwa && pwa.getPlayerName && pwa.getPlayerName()) || '';
}

/* Server-side this is _enzo_thread_key(): the two names sorted and joined,
 * so "Enzo" leads for every player whose name sorts after it. Built the same
 * way here rather than guessed at. */
export function enzoThreadKey(name) {
  const who = name || playerName();
  if (!who) return null;
  return ['Enzo', who].sort().join('|');
}

/* Open Enzo's conversation, brought to the front. VOS_CHAT.open() puts it in
 * the overlay on every page, and on /messages/ — which is that panel already
 * — it selects the thread in place instead of stacking a second one. */
export function openEnzoThread() {
  const chat = window.VOS_CHAT;
  const key = enzoThreadKey();
  if (chat && chat.open) {
    chat.open(key);
    return true;
  }
  // No chat bundle on this page. The full-page conversation is the same
  // thread, so send them there rather than doing nothing.
  window.location.href = '/messages/';
  return true;
}

export function initEnzoActions() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-enzo-ask]');
    if (!trigger) return;
    event.preventDefault();
    openEnzoThread();
  });
}
