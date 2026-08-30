/* /messages/ — the same chat component, mounted full-page.
 *
 * It exists for one reason: a push tap on a cold start has nowhere to put
 * an overlay, so the notification's URL lands here and the thread opens
 * from the hash. Everything else reaches chat through the app-bar bubble.
 */
import { createChatPanel } from './panel.js';
import { applyCount, syncBadge } from './badge.js';

const mount = document.getElementById('vos-chat-page');

async function boot() {
  if (!mount) return;
  const panel = createChatPanel({ mode: 'page', onUnreadChange: applyCount });
  mount.append(panel.root);
  panel.setActive(true);
  if (window.VOS_CHAT) window.VOS_CHAT.pagePanel = panel;

  const name = await panel.boot();
  if (!name) return;

  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hash && panel.hasThread(hash)) panel.openThread(hash);
  else panel.restore();

  window.addEventListener('focus', () => panel.refresh().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') panel.refresh().catch(() => {});
  });
  syncBadge();
}

boot();
