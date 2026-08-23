import { DEFAULT_PLAYERS, authHeaders, getToken, recordsListEl, recordsStatusEl, setStatus } from './state.js';

export async function refreshQuestionnaires() {
  const token = getToken(recordsStatusEl);
  if (!token) return;
  setStatus(recordsStatusEl, 'Loading...');
  try {
    const response = await fetch('/api/questionnaire/all', {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const byPlayer = {};
    (data.records || []).forEach((record) => {
      byPlayer[record.playerName] = record;
    });
    recordsListEl.innerHTML = '';
    DEFAULT_PLAYERS.filter((name) => name !== 'DM').forEach((name) => {
      const record = byPlayer[name];
      const li = document.createElement('li');
      const who = document.createElement('strong');
      who.textContent = name;
      const status = document.createElement('span');
      if (!record) {
        status.textContent = 'not started';
      } else if (record.status === 'submitted') {
        status.textContent = 'sealed ' + new Date(record.submitted_at).toLocaleDateString();
      } else {
        status.textContent = 'draft · ' + new Date(record.updated_at).toLocaleDateString();
      }
      li.append(who, status);
      recordsListEl.appendChild(li);
    });
    setStatus(recordsStatusEl, 'Updated.');
  } catch (error) {
    setStatus(recordsStatusEl, error.message, true);
  }
}
