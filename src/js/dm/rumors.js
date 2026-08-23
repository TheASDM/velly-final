import { authHeaders, getToken, rumorAddEl, rumorTextEl, rumorsListEl, rumorsStatusEl, setStatus } from './state.js';

export async function refreshRumors() {
  const token = getToken(rumorsStatusEl);
  if (!token) return;
  setStatus(rumorsStatusEl, 'Loading...');
  try {
    const response = await fetch('/api/rumors', {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    rumorsListEl.innerHTML = '';
    (data.rumors || []).forEach((rumor) => {
      const li = document.createElement('li');
      li.className = 'vos-dm-cal-event';
      const text = document.createElement('span');
      text.textContent = rumor.text;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => deleteRumor(rumor));
      li.append(text, remove);
      rumorsListEl.appendChild(li);
    });
    if (!rumorsListEl.children.length) {
      const li = document.createElement('li');
      li.className = 'vos-dm-avail-empty';
      li.textContent = 'No rumors on the wind. Add some.';
      rumorsListEl.appendChild(li);
    }
    setStatus(rumorsStatusEl, '');
  } catch (error) {
    setStatus(rumorsStatusEl, error.message, true);
  }
}

export async function addRumor(eventArg) {
  eventArg.preventDefault();
  const token = getToken(rumorsStatusEl);
  if (!token) return;
  const text = rumorTextEl.value.trim();
  if (!text) {
    setStatus(rumorsStatusEl, 'Write the rumor first.', true);
    return;
  }
  rumorAddEl.disabled = true;
  setStatus(rumorsStatusEl, 'Adding...');
  try {
    const response = await fetch('/api/rumors', {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    rumorTextEl.value = '';
    setStatus(rumorsStatusEl, 'Added.');
    await refreshRumors();
  } catch (error) {
    setStatus(rumorsStatusEl, error.message, true);
  } finally {
    rumorAddEl.disabled = false;
  }
}

export async function deleteRumor(rumor) {
  const token = getToken(rumorsStatusEl);
  if (!token) return;
  setStatus(rumorsStatusEl, 'Deleting...');
  try {
    const response = await fetch(`/api/rumors/${rumor.id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    setStatus(rumorsStatusEl, 'Deleted.');
    await refreshRumors();
  } catch (error) {
    setStatus(rumorsStatusEl, error.message, true);
  }
}
