import { recordsListEl, recordsRefreshEl, recordsStatusEl, setStatus } from './dom.js';
import { adminJson, withPanel } from './http.js';
import { playerNames } from './roster.js';

export function refreshQuestionnaires() {
  return withPanel(recordsStatusEl, recordsRefreshEl, async () => {
    const [names, data] = await Promise.all([
      playerNames(),
      adminJson('/api/questionnaire/all'),
    ]);
    const byPlayer = {};
    (data.records || []).forEach((record) => {
      byPlayer[record.playerName] = record;
    });
    recordsListEl.innerHTML = '';
    names.forEach((name) => {
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
  });
}
