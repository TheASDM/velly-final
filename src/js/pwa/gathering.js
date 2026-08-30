import { authHeaders } from './identity.js';
import { initRsvpControls } from './rsvp.js';

export function gatheringDaysLabel(iso) {
  const target = new Date(iso + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
  if (days < 0) return 'In the past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`;
  }
  return target.toLocaleDateString();
}

export function renderGathering(root, gathering) {
  const body = root.querySelector('[data-ng-body]');
  const empty = root.querySelector('[data-ng-empty]');
  if (!gathering) {
    if (body) body.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  if (body) body.hidden = false;
  if (empty) empty.hidden = true;

  const dateEl = root.querySelector('[data-ng-date]');
  if (dateEl) {
    dateEl.textContent = new Date(gathering.date + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }
  const whereEl = root.querySelector('[data-ng-where]');
  if (whereEl) {
    whereEl.textContent = [gathering.timeLabel, gathering.location, gathering.notes]
      .filter(Boolean).join(' · ');
  }
  const countdownEl = root.querySelector('[data-ng-countdown]');
  if (countdownEl) {
    const label = gatheringDaysLabel(gathering.date);
    if (label) {
      countdownEl.textContent = label;
      countdownEl.hidden = false;
    }
  }
  const tasksEl = root.querySelector('[data-ng-tasks]');
  if (tasksEl) {
    tasksEl.innerHTML = '';
    (gathering.tasks || []).forEach((task) => {
      const li = document.createElement('li');
      li.className = 'vos-task-row';
      const check = document.createElement('span');
      check.className = 'vos-task-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      const main = document.createElement('span');
      main.className = 'vos-task-main';
      main.textContent = task.text;
      li.append(check, main);
      if (task.due) {
        const due = document.createElement('span');
        due.className = 'vos-task-date';
        due.textContent = 'Due ' + new Date(task.due + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'short', day: 'numeric',
        });
        li.appendChild(due);
      }
      tasksEl.appendChild(li);
    });
    tasksEl.hidden = !tasksEl.children.length;
  }
  const icsEl = root.querySelector('[data-ng-ics]');
  if (icsEl) {
    icsEl.href = gathering.icsUrl;
    icsEl.hidden = false;
  }
  const rsvp = root.querySelector('.vos-rsvp-control');
  if (rsvp && !rsvp.getAttribute('data-event-id')) {
    rsvp.setAttribute('data-event-id', gathering.eventKey);
  }
}

export async function initNextGathering() {
  const roots = document.querySelectorAll('[data-next-gathering]');
  if (!roots.length) return;
  let gathering = null;
  try {
    // Signed-in readers get location and notes; anonymous readers get the
    // stripped shape.
    const response = await fetch('/api/calendar/next', {
      cache: 'no-store',
      headers: authHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) gathering = data.gathering;
  } catch (error) { /* leave the fallback state */ }
  roots.forEach((root) => renderGathering(root, gathering));
  // RSVP controls inside gathering blocks only got their event id now.
  initRsvpControls();
  window.dispatchEvent(new CustomEvent('vos:next-gathering', { detail: { gathering } }));
}
