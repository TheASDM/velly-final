import { rumorAddEl, rumorTextEl, rumorsListEl, rumorsRefreshEl, rumorsStatusEl, setStatus } from './dom.js';
import { adminJson, deleteJson, postJson, withPanel } from './http.js';

export function refreshRumors() {
  return withPanel(rumorsStatusEl, rumorsRefreshEl, async () => {
    const data = await adminJson('/api/rumors');
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
  });
}

export async function addRumor(eventArg) {
  eventArg.preventDefault();
  const text = rumorTextEl.value.trim();
  if (!text) {
    setStatus(rumorsStatusEl, 'Write the rumor first.', true);
    return;
  }
  await withPanel(rumorsStatusEl, rumorAddEl, async () => {
    await postJson('/api/rumors', { text });
    rumorTextEl.value = '';
    await refreshRumors();
    setStatus(rumorsStatusEl, 'Added.');
  }, { loading: 'Adding…' });
}

export function deleteRumor(rumor) {
  return withPanel(rumorsStatusEl, null, async () => {
    await deleteJson(`/api/rumors/${encodeURIComponent(rumor.id)}`);
    await refreshRumors();
    setStatus(rumorsStatusEl, 'Deleted.');
  }, { loading: 'Deleting…' });
}
