/* Who has alerts on. Sending lives in the Compose tab (messages.js) — one
 * composer posts messages and, with the notify-only toggle, bare pushes. */
import { pushSubsEl, pushSubsStatusEl, setStatus } from './dom.js';
import { adminJson, withPanel } from './http.js';

export function refreshPushSubscribers() {
  return withPanel(pushSubsStatusEl, null, async () => {
    const data = await adminJson('/api/push/subscribers');
    pushSubsEl.innerHTML = '';
    (data.subscribed || []).forEach((sub) => {
      const li = document.createElement('li');
      const who = document.createElement('strong');
      who.textContent = sub.player;
      const status = document.createElement('span');
      status.textContent = sub.devices === 1 ? '1 device' : `${sub.devices} devices`;
      li.append(who, status);
      pushSubsEl.appendChild(li);
    });
    (data.missing || []).forEach((name) => {
      const li = document.createElement('li');
      li.style.opacity = '0.55';
      const who = document.createElement('strong');
      who.textContent = name;
      const status = document.createElement('span');
      status.textContent = 'no alerts';
      li.append(who, status);
      pushSubsEl.appendChild(li);
    });
    if (!pushSubsEl.children.length) {
      const li = document.createElement('li');
      li.textContent = 'Nobody has enabled alerts yet.';
      pushSubsEl.appendChild(li);
    }
    setStatus(pushSubsStatusEl, 'Stale devices only get pruned when a push to them fails.');
  });
}
