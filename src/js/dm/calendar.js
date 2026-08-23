import { authHeaders, calCancelEl, calDateEl, calEventsEl, calFormEl, calKindEl, calLocationEl, calNotesEl, calSaveEl, calStatusEl, calTasksEl, calTimeEl, calTitleEl, getToken, setStatus } from './state.js';

export const AVAIL_RANGE = (() => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + 3, 0)),
  };
})();

export function prettyDate(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export let editingEventId = null;

export function parseTaskLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const match = line.match(/^(.*?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*$/);
      return match ? { text: match[1].trim(), due: match[2] } : { text: line };
    })
    .filter((task) => task.text);
}

export function taskLines(tasks) {
  return (tasks || [])
    .map((task) => (task.due ? `${task.text} | ${task.due}` : task.text))
    .join('\n');
}

export function enterEditMode(event) {
  editingEventId = event.id;
  calDateEl.value = event.date;
  calTitleEl.value = event.title;
  calTimeEl.value = event.timeLabel || '';
  calLocationEl.value = event.location || '';
  calNotesEl.value = event.notes || '';
  calKindEl.value = event.kind;
  if (calTasksEl) calTasksEl.value = taskLines(event.tasks);
  calSaveEl.textContent = 'Save Changes';
  if (calCancelEl) calCancelEl.hidden = false;
  setStatus(calStatusEl, `Editing "${event.title}".`);
  calFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function exitEditMode() {
  editingEventId = null;
  calFormEl.reset();
  calSaveEl.textContent = 'Add to Calendar';
  if (calCancelEl) calCancelEl.hidden = true;
}

export async function refreshCalendarEvents() {
  setStatus(calStatusEl, 'Loading...');
  try {
    const response = await fetch(
      `/api/calendar/events?from=${AVAIL_RANGE.from}`,
      { cache: 'no-store' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    calEventsEl.innerHTML = '';
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nextSession = (data.events || []).find(
      (event) => event.kind === 'session' && event.date >= todayIso
    );
    (data.events || []).forEach((event) => {
      const li = document.createElement('li');
      li.className = 'vos-dm-cal-event';
      const when = document.createElement('strong');
      when.textContent = prettyDate(event.date);
      const what = document.createElement('span');
      what.textContent = [event.title, event.timeLabel, event.location]
        .filter(Boolean).join(' · ');
      li.append(when, what);
      if (nextSession && event.id === nextSession.id) {
        const badge = document.createElement('span');
        badge.className = 'vos-dm-cal-next-badge';
        badge.textContent = 'Next Gathering';
        li.appendChild(badge);
      }
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => enterEditMode(event));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => deleteCalendarEvent(event));
      li.append(edit, remove);
      calEventsEl.appendChild(li);
    });
    if (!calEventsEl.children.length) {
      const li = document.createElement('li');
      li.className = 'vos-dm-avail-empty';
      li.textContent = 'Nothing scheduled from this month on.';
      calEventsEl.appendChild(li);
    }
    setStatus(calStatusEl, '');
  } catch (error) {
    setStatus(calStatusEl, error.message, true);
  }
}

export async function saveCalendarEvent(eventArg) {
  eventArg.preventDefault();
  const token = getToken(calStatusEl);
  if (!token) return;
  if (!calDateEl.value || !calTitleEl.value.trim()) {
    setStatus(calStatusEl, 'Date and title are required.', true);
    return;
  }
  calSaveEl.disabled = true;
  setStatus(calStatusEl, 'Saving...');
  try {
    const url = editingEventId
      ? `/api/calendar/events/${editingEventId}`
      : '/api/calendar/events';
    const response = await fetch(url, {
      method: editingEventId ? 'PUT' : 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        date: calDateEl.value,
        title: calTitleEl.value.trim(),
        timeLabel: calTimeEl.value.trim(),
        location: calLocationEl.value.trim(),
        notes: calNotesEl.value.trim(),
        kind: calKindEl.value,
        tasks: calTasksEl ? parseTaskLines(calTasksEl.value) : [],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const wasEdit = !!editingEventId;
    exitEditMode();
    setStatus(calStatusEl, wasEdit ? 'Updated.' : 'Scheduled.');
    await refreshCalendarEvents();
  } catch (error) {
    setStatus(calStatusEl, error.message, true);
  } finally {
    calSaveEl.disabled = false;
  }
}

export async function deleteCalendarEvent(event) {
  const token = getToken(calStatusEl);
  if (!token) return;
  if (!window.confirm(`Delete "${event.title}" on ${prettyDate(event.date)}?`)) return;
  setStatus(calStatusEl, 'Deleting...');
  try {
    const response = await fetch(`/api/calendar/events/${event.id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    if (editingEventId === event.id) exitEditMode();
    setStatus(calStatusEl, 'Deleted.');
    await refreshCalendarEvents();
  } catch (error) {
    setStatus(calStatusEl, error.message, true);
  }
}
