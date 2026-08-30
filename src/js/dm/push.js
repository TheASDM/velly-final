import { bodyEl, form, pushSubsEl, pushSubsRefreshEl, pushSubsStatusEl, sendEl, setStatus, statusEl, titleEl, urlEl } from './dom.js';
import { adminJson, postJson, withPanel } from './http.js';
import { recipientsFor, resetRecipients } from './messages.js';

export function refreshPushSubscribers() {
  return withPanel(pushSubsStatusEl, pushSubsRefreshEl, async () => {
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const recipients = recipientsFor('vos-dm-push-recipients', statusEl);
  if (recipients === undefined) return;
  await withPanel(statusEl, sendEl, async () => {
    const data = await postJson('/api/push/send', {
      title: titleEl.value.trim(),
      body: bodyEl.value.trim(),
      url: urlEl.value.trim() || '/',
      recipients,
    });
    resetRecipients('vos-dm-push-recipients');
    setStatus(statusEl, `Sent ${data.sent} of ${data.attempted}. Pruned ${data.pruned}.`);
  }, { loading: 'Sending…' });
});
