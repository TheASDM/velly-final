/* Handouts — write one, choose who receives it, hand it over.
 *
 * The audience checkboxes come from the roster file, not a hand-kept list,
 * and the DM's own seat is left out: handouts are for characters. Editing
 * reuses the same form — the id field decides whether saving creates or
 * updates, so there is one path for both and they cannot drift.
 */
import {
  authHeaders, getToken, handoutCancelEl, handoutFormEl, handoutIdEl,
  handoutImageEl, handoutPlayersEl, handoutSaveEl, handoutTextEl,
  handoutTitleEl, handoutsListEl, handoutsStatusEl, setStatus,
} from './state.js';

let rosterLoaded = false;

async function ensureRoster() {
  if (rosterLoaded || !handoutPlayersEl) return;
  let roster = [];
  try {
    roster = await (await fetch('/data/players.json', { cache: 'no-store' })).json();
  } catch (error) {
    setStatus(handoutsStatusEl, 'Could not load the roster.', true);
    return;
  }
  handoutPlayersEl.innerHTML = '';
  roster.filter((seat) => seat.name !== 'DM').forEach((seat) => {
    const label = document.createElement('label');
    label.className = 'vos-dm-handout-player';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = seat.name;
    label.append(box, document.createTextNode(seat.display || seat.name));
    handoutPlayersEl.appendChild(label);
  });
  rosterLoaded = true;
}

function chosenPlayers() {
  return [...handoutPlayersEl.querySelectorAll('input:checked')].map((box) => box.value);
}

function resetForm() {
  handoutIdEl.value = '';
  handoutTitleEl.value = '';
  handoutTextEl.value = '';
  handoutPlayersEl.querySelectorAll('input').forEach((box) => { box.checked = false; });
  handoutSaveEl.textContent = 'Give Handout';
  handoutCancelEl.hidden = true;
}

export function cancelHandoutEdit() {
  resetForm();
  setStatus(handoutsStatusEl, '');
}

function startEdit(handout) {
  handoutIdEl.value = String(handout.id);
  handoutTitleEl.value = handout.title;
  handoutTextEl.value = handout.markdown;
  handoutPlayersEl.querySelectorAll('input').forEach((box) => {
    box.checked = (handout.players || []).includes(box.value);
  });
  handoutSaveEl.textContent = 'Save Changes';
  handoutCancelEl.hidden = false;
  handoutTitleEl.focus();
}

export async function refreshHandouts() {
  const token = getToken(handoutsStatusEl);
  if (!token) return;
  await ensureRoster();
  setStatus(handoutsStatusEl, 'Loading...');
  try {
    const response = await fetch('/api/handouts/all', {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    handoutsListEl.innerHTML = '';
    (data.handouts || []).forEach((handout) => {
      const li = document.createElement('li');
      li.className = 'vos-dm-cal-event';
      const text = document.createElement('span');
      const audience = (handout.players || []).join(', ') || 'nobody';
      text.textContent = `${handout.title} — ${audience}`;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => startEdit(handout));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => deleteHandout(handout));
      li.append(text, edit, remove);
      handoutsListEl.appendChild(li);
    });
    if (!handoutsListEl.children.length) {
      const li = document.createElement('li');
      li.className = 'vos-dm-avail-empty';
      li.textContent = 'Nothing handed out yet.';
      handoutsListEl.appendChild(li);
    }
    setStatus(handoutsStatusEl, '');
  } catch (error) {
    setStatus(handoutsStatusEl, error.message, true);
  }
}

export async function saveHandout(eventArg) {
  eventArg.preventDefault();
  const token = getToken(handoutsStatusEl);
  if (!token) return;

  const id = handoutIdEl.value.trim();
  const body = {
    title: handoutTitleEl.value.trim(),
    markdown: handoutTextEl.value.trim(),
    players: chosenPlayers(),
  };
  setStatus(handoutsStatusEl, 'Saving...');
  try {
    const response = await fetch(id ? `/api/handouts/${id}` : '/api/handouts', {
      method: id ? 'PUT' : 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    resetForm();
    setStatus(handoutsStatusEl, id ? 'Updated.' : 'Handed out.');
    refreshHandouts();
  } catch (error) {
    setStatus(handoutsStatusEl, error.message, true);
  }
}

/* Upload the chosen image and drop its markdown line into the text at the
 * cursor. The image is the DM's draft until a saved handout references it —
 * players can only fetch what their own handouts mention. */
export async function attachHandoutImage() {
  const file = handoutImageEl.files && handoutImageEl.files[0];
  if (!file) return;
  const token = getToken(handoutsStatusEl);
  if (!token) return;

  const form = new FormData();
  form.append('image', file);
  setStatus(handoutsStatusEl, 'Uploading image...');
  try {
    const response = await fetch('/api/handouts/image', {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    const text = handoutTextEl.value;
    const at = handoutTextEl.selectionStart != null ? handoutTextEl.selectionStart : text.length;
    const line = `${at && text[at - 1] !== '\n' ? '\n' : ''}${data.markdown}\n`;
    handoutTextEl.value = text.slice(0, at) + line + text.slice(at);
    setStatus(handoutsStatusEl, 'Image attached — it shows where the line sits.');
  } catch (error) {
    setStatus(handoutsStatusEl, error.message, true);
  } finally {
    handoutImageEl.value = '';
  }
}

async function deleteHandout(handout) {
  if (!window.confirm(`Take back "${handout.title}"? The players lose it too.`)) return;
  const token = getToken(handoutsStatusEl);
  if (!token) return;
  try {
    const response = await fetch(`/api/handouts/${handout.id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    if (handoutIdEl.value === String(handout.id)) resetForm();
    refreshHandouts();
  } catch (error) {
    setStatus(handoutsStatusEl, error.message, true);
  }
}
