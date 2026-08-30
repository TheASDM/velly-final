/* Handouts — write one, choose who receives it, hand it over.
 *
 * The audience checkboxes come from the shared roster, and the DM's own seat
 * is left out: handouts are for characters. Editing reuses the same form —
 * the id field decides whether saving creates or updates, so there is one
 * path for both and they cannot drift. */
import {
  handoutCancelEl, handoutFormEl, handoutIdEl, handoutImageEl,
  handoutPlayersEl, handoutSaveEl, handoutTextEl, handoutTitleEl,
  handoutsListEl, handoutsStatusEl, setStatus,
} from './dom.js';
import { adminJson, deleteJson, withPanel } from './http.js';
import { authHeaders } from './session.js';
import { loadRoster } from './roster.js';
import { confirmDiscard, trackDirty } from './dirty.js';
import { confirmSheet } from './confirm.js';
import { renderSheet } from '../sheet/render.js';
import { wireImageZoom } from '../components/image-zoom.js';

if (handoutsListEl) wireImageZoom(handoutsListEl);

let rosterLoaded = false;
let lastHandouts = [];
/* The one handout whose preview is open. One at a time: proofing is a
 * one-document activity, and two open previews is a scroll of confusion. */
let previewId = null;

/* The form counts as unsaved work once it has any content that isn't the
 * saved handout it was loaded from. */
function formSnapshot() {
  return JSON.stringify({
    id: handoutIdEl.value,
    title: handoutTitleEl.value.trim(),
    text: handoutTextEl.value.trim(),
    players: chosenPlayers(),
  });
}

let cleanSnapshot = null;

function markClean() {
  cleanSnapshot = formSnapshot();
}

export function handoutFormDirty() {
  if (cleanSnapshot === null) markClean();
  return formSnapshot() !== cleanSnapshot;
}

trackDirty('handout-form', () => {
  // An empty compose form is never "work".
  if (!handoutTitleEl.value.trim() && !handoutTextEl.value.trim()) return false;
  return handoutFormDirty();
});

async function ensureRoster() {
  if (rosterLoaded || !handoutPlayersEl) return;
  const roster = await loadRoster();
  if (!roster.length) {
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
  markClean();
}

function chosenPlayers() {
  if (!handoutPlayersEl) return [];
  return [...handoutPlayersEl.querySelectorAll('input:checked')].map((box) => box.value);
}

function resetForm() {
  handoutIdEl.value = '';
  handoutTitleEl.value = '';
  handoutTextEl.value = '';
  handoutPlayersEl.querySelectorAll('input').forEach((box) => { box.checked = false; });
  handoutSaveEl.textContent = 'Give Handout';
  handoutCancelEl.hidden = true;
  markClean();
}

export async function cancelHandoutEdit() {
  if (!(await confirmDiscard('handout-form', 'Discard this handout draft?'))) return;
  resetForm();
  setStatus(handoutsStatusEl, '');
}

async function startEdit(handout) {
  if (!(await confirmDiscard('handout-form', 'Discard the handout you are composing and edit this one instead?'))) return;
  handoutIdEl.value = String(handout.id);
  handoutTitleEl.value = handout.title;
  handoutTextEl.value = handout.markdown;
  handoutPlayersEl.querySelectorAll('input').forEach((box) => {
    box.checked = (handout.players || []).includes(box.value);
  });
  handoutSaveEl.textContent = 'Save Changes';
  handoutCancelEl.hidden = false;
  markClean();
  handoutTitleEl.focus();
}

export function refreshHandouts() {
  return withPanel(handoutsStatusEl, null, async () => {
    await ensureRoster();
    const data = await adminJson('/api/handouts/all');
    lastHandouts = data.handouts || [];
    renderHandoutsList();
    setStatus(handoutsStatusEl, '');
  });
}

function renderHandoutsList() {
  handoutsListEl.innerHTML = '';
  lastHandouts.forEach((handout) => {
    const li = document.createElement('li');
    li.className = 'vos-dm-cal-event';
    const text = document.createElement('span');
    const audience = (handout.players || []).join(', ') || 'nobody';
    text.textContent = `${handout.title} — ${audience}`;
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.textContent = previewId === handout.id ? 'Close' : 'Preview';
    preview.addEventListener('click', () => {
      previewId = previewId === handout.id ? null : handout.id;
      renderHandoutsList();
    });
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => startEdit(handout));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteHandout(handout));
    li.append(text, preview, edit, remove);
    handoutsListEl.appendChild(li);

    // The preview is the players' own renderer verbatim — what the DM proofs
    // here is exactly what the Handouts tab shows them.
    if (previewId === handout.id) {
      const pane = document.createElement('li');
      pane.className = 'vos-dm-handout-preview';
      pane.innerHTML = `<div class="vos-handout-body">${
        renderSheet(handout.markdown, { fallbackTitle: handout.title })}</div>`;
      handoutsListEl.appendChild(pane);
    }
  });
  if (!handoutsListEl.children.length) {
    const li = document.createElement('li');
    li.className = 'vos-dm-avail-empty';
    li.textContent = 'Nothing handed out yet.';
    handoutsListEl.appendChild(li);
  }
}

export async function saveHandout(eventArg) {
  eventArg.preventDefault();
  const id = handoutIdEl.value.trim();
  const title = handoutTitleEl.value.trim();
  const markdown = handoutTextEl.value.trim();
  const players = chosenPlayers();
  // A handout addressed to nobody "succeeds" and then no player ever sees
  // it — refuse it here, with the reason.
  if (!title) {
    setStatus(handoutsStatusEl, 'Give the handout a title.', true);
    return;
  }
  if (!markdown) {
    setStatus(handoutsStatusEl, 'Write the handout text first.', true);
    return;
  }
  if (!players.length) {
    setStatus(handoutsStatusEl, 'Choose at least one player to receive it.', true);
    return;
  }
  await withPanel(handoutsStatusEl, handoutSaveEl, async () => {
    const body = { title, markdown, players };
    if (id) {
      await adminJson(`/api/handouts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await adminJson('/api/handouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    resetForm();
    await refreshHandouts();
    setStatus(handoutsStatusEl, id ? 'Updated.' : 'Handed out.');
  }, { loading: 'Saving…' });
}

/* Upload the chosen image and drop its markdown line into the text at the
 * cursor. The image is the DM's draft until a saved handout references it —
 * players can only fetch what their own handouts mention. */
export async function attachHandoutImage() {
  const file = handoutImageEl.files && handoutImageEl.files[0];
  if (!file) return;
  await withPanel(handoutsStatusEl, null, async () => {
    const form = new FormData();
    form.append('image', file);
    const response = await fetch('/api/handouts/image', {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    const text = handoutTextEl.value;
    const at = handoutTextEl.selectionStart != null ? handoutTextEl.selectionStart : text.length;
    const line = `${at && text[at - 1] !== '\n' ? '\n' : ''}${data.markdown}\n`;
    handoutTextEl.value = text.slice(0, at) + line + text.slice(at);
    handoutImageEl.value = '';
    setStatus(handoutsStatusEl, 'Image attached — it shows where the line sits.');
  }, { loading: 'Uploading image…' });
}

async function deleteHandout(handout) {
  if (!(await confirmSheet(`Take back "${handout.title}"? The players lose it too.`, { confirmLabel: 'Take back', danger: true }))) return null;
  return withPanel(handoutsStatusEl, null, async () => {
    await deleteJson(`/api/handouts/${encodeURIComponent(handout.id)}`);
    if (handoutIdEl.value === String(handout.id)) resetForm();
    await refreshHandouts();
  }, { loading: 'Deleting…' });
}
