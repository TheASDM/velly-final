import { AVAIL_RANGE, prettyDate } from './calendar.js';
import { DEFAULT_PLAYERS, authHeaders, availStatusEl, availSubmittedEl, availSummaryEl, getToken, initGoogleButton, npcResultEl, persistSession, setStatus } from './state.js';

export let npcTables = null;

export async function rollNpc() {
  if (!npcTables) {
    try {
      const response = await fetch('/data/questionnaire.json', { cache: 'default' });
      const data = await response.json();
      npcTables = data.tables || {};
    } catch (error) {
      npcTables = null;
      if (npcResultEl) npcResultEl.textContent = 'Could not load the tables.';
      return;
    }
  }
  const pick = (name) => {
    const table = npcTables[name] || [];
    return table[Math.floor(Math.random() * table.length)] || '';
  };
  const card = document.createElement('div');
  card.className = 'vos-dm-npc-card';
  const who = document.createElement('strong');
  who.textContent = `${pick('npcFirst')} ${pick('npcFamily')} — ${pick('npcRole')}`;
  const detail = document.createElement('div');
  detail.textContent = `Tell: ${pick('tells')} Mark: ${pick('marks')}. Voice: ${pick('voice')}`;
  card.append(who, detail);
  const placeholder = npcResultEl.querySelector('.vos-dm-avail-empty');
  if (placeholder) placeholder.remove();
  npcResultEl.prepend(card);
  while (npcResultEl.children.length > 5) npcResultEl.lastChild.remove();
}

export function availabilityChip(entry) {
  const chip = document.createElement('span');
  chip.className = `vos-dm-avail-chip is-${entry.rating}`;
  const symbols = { preferred: '★', available: '✓', unavailable: '✕' };
  chip.textContent = `${symbols[entry.rating]} ${entry.player}`;
  return chip;
}

export async function refreshAvailabilitySummary() {
  const token = getToken(availStatusEl);
  if (!token) return;
  setStatus(availStatusEl, 'Loading...');
  try {
    const response = await fetch(
      `/api/availability/summary?from=${AVAIL_RANGE.from}&to=${AVAIL_RANGE.to}`,
      { headers: authHeaders(token), cache: 'no-store' }
    );
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      persistSession(null);
      initGoogleButton();
      throw new Error(data.error || 'Session expired — sign in again.');
    }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    const days = data.days || {};
    const submitted = data.submitted || [];

    // Who has and hasn't weighed in (the DM doesn't count).
    const submittedNames = new Set(submitted.map((s) => s.player));
    const missing = DEFAULT_PLAYERS.filter(
      (name) => name !== 'DM' && !submittedNames.has(name)
    );
    availSubmittedEl.innerHTML = '';
    const submittedLine = document.createElement('div');
    submittedLine.append('Submitted: ');
    const submittedStrong = document.createElement('strong');
    submittedStrong.textContent = submitted.length
      ? submitted.map((s) => s.player).join(', ')
      : 'nobody yet';
    submittedLine.appendChild(submittedStrong);
    availSubmittedEl.appendChild(submittedLine);
    if (missing.length) {
      const missingLine = document.createElement('div');
      missingLine.append('Waiting on: ');
      const missingStrong = document.createElement('strong');
      missingStrong.textContent = missing.join(', ');
      missingLine.appendChild(missingStrong);
      availSubmittedEl.appendChild(missingLine);
    }

    const weekendDays = [];
    const weekdayDays = [];
    Object.keys(days).sort().forEach((dateIso) => {
      const dow = new Date(dateIso + 'T00:00:00').getDay();
      (dow === 0 || dow === 6 ? weekendDays : weekdayDays).push(dateIso);
    });

    availSummaryEl.innerHTML = '';

    const weekendGroup = document.createElement('div');
    weekendGroup.className = 'vos-dm-avail-group';
    const weekendHeading = document.createElement('h3');
    weekendHeading.textContent = 'Weekends (best first)';
    weekendGroup.appendChild(weekendHeading);
    const scored = weekendDays.map((dateIso) => {
      const entries = days[dateIso];
      const counts = { preferred: 0, available: 0, unavailable: 0 };
      entries.forEach((entry) => { counts[entry.rating] += 1; });
      return {
        dateIso,
        entries,
        counts,
        score: counts.preferred * 2 + counts.available - counts.unavailable * 3,
      };
    }).sort((a, b) => b.score - a.score || a.dateIso.localeCompare(b.dateIso));
    scored.forEach((day) => {
      const box = document.createElement('div');
      box.className = 'vos-dm-avail-day';
      const head = document.createElement('div');
      head.className = 'vos-dm-avail-day-head';
      const label = document.createElement('strong');
      label.textContent = prettyDate(day.dateIso);
      const score = document.createElement('span');
      score.className = 'vos-dm-avail-score';
      score.textContent =
        `★${day.counts.preferred} ✓${day.counts.available} ✕${day.counts.unavailable}`;
      head.append(label, score);
      const chips = document.createElement('div');
      chips.className = 'vos-dm-avail-chips';
      day.entries.forEach((entry) => chips.appendChild(availabilityChip(entry)));
      box.append(head, chips);
      const withTimes = day.entries.filter((entry) => entry.times && entry.times.length);
      if (withTimes.length) {
        const times = document.createElement('div');
        times.className = 'vos-dm-avail-times';
        times.textContent = withTimes
          .map((entry) => `${entry.player}: ${entry.times.join(', ')}`)
          .join(' · ');
        box.appendChild(times);
      }
      weekendGroup.appendChild(box);
    });
    if (!scored.length) {
      const empty = document.createElement('div');
      empty.className = 'vos-dm-avail-empty';
      empty.textContent = 'No weekend availability submitted yet.';
      weekendGroup.appendChild(empty);
    }
    availSummaryEl.appendChild(weekendGroup);

    const weekdayGroup = document.createElement('div');
    weekdayGroup.className = 'vos-dm-avail-group';
    const weekdayHeading = document.createElement('h3');
    weekdayHeading.textContent = 'Weekday evening conflicts';
    weekdayGroup.appendChild(weekdayHeading);
    weekdayDays.forEach((dateIso) => {
      const box = document.createElement('div');
      box.className = 'vos-dm-avail-day';
      const head = document.createElement('div');
      head.className = 'vos-dm-avail-day-head';
      const label = document.createElement('strong');
      label.textContent = prettyDate(dateIso);
      head.appendChild(label);
      const chips = document.createElement('div');
      chips.className = 'vos-dm-avail-chips';
      days[dateIso].forEach((entry) => chips.appendChild(availabilityChip(entry)));
      box.append(head, chips);
      weekdayGroup.appendChild(box);
    });
    if (!weekdayDays.length) {
      const empty = document.createElement('div');
      empty.className = 'vos-dm-avail-empty';
      empty.textContent = 'No weekday conflicts reported.';
      weekdayGroup.appendChild(empty);
    }
    availSummaryEl.appendChild(weekdayGroup);

    setStatus(availStatusEl, 'Updated.');
  } catch (error) {
    setStatus(availStatusEl, error.message, true);
  }
}
