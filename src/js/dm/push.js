import { recipientsFor } from './messages.js';
import { authHeaders, bodyEl, form, getToken, postJson, pushSubsEl, pushSubsStatusEl, sendEl, setStatus, statusEl, titleEl, urlEl } from './state.js';

export async function refreshPushSubscribers() {
  const token = getToken(pushSubsStatusEl);
  if (!token) return;
  setStatus(pushSubsStatusEl, 'Loading...');
  try {
    const response = await fetch('/api/push/subscribers', {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
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
  } catch (error) {
    setStatus(pushSubsStatusEl, error.message, true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = getToken(statusEl);
  if (!token) return;
  const recipients = recipientsFor('vos-dm-push-recipients', statusEl);
  if (recipients === undefined) return;

  sendEl.disabled = true;
  setStatus(statusEl, 'Sending...');

  try {
    const data = await postJson('/api/push/send', token, {
      title: titleEl.value.trim(),
      body: bodyEl.value.trim(),
      url: urlEl.value.trim() || '/',
      recipients,
    });
    setStatus(statusEl, `Sent ${data.sent} of ${data.attempted}. Pruned ${data.pruned}.`);
  } catch (error) {
    setStatus(statusEl, error.message, true);
  } finally {
    sendEl.disabled = false;
  }
});
