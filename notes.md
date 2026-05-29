---
title: Notes
description: Private notes for the signed-in player.
permalink: /notes/
published: false
autoIndex: false
---

<style>
.vos-notes-panel {
  max-width: 1120px;
  margin: 0 auto;
}
.vos-notes-scope {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.25rem;
  border: 1px solid rgba(212, 165, 116, 0.18);
  border-radius: 8px;
  background: rgba(8, 7, 11, 0.52);
}
.vos-notes-scope[hidden] {
  display: none;
}
.vos-notes-scope button {
  min-height: 34px;
  padding: 0.42rem 0.68rem;
}
.vos-notes-scope button.is-selected {
  border-color: rgba(212, 165, 116, 0.68);
  background: rgba(212, 165, 116, 0.17);
  color: var(--vos-cream);
}
.vos-notes-layout {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  gap: 0.85rem;
}
.vos-notes-list {
  display: grid;
  align-content: start;
  gap: 0.45rem;
  min-height: 280px;
}
.vos-notes-list button.vos-row-chip {
  width: 100%;
  text-align: left;
  cursor: pointer;
}
.vos-notes-list button.vos-row-chip.is-selected {
  border-color: rgba(212, 165, 116, 0.68);
  background: rgba(212, 165, 116, 0.12);
}
.vos-notes-editor {
  display: grid;
  gap: 0.72rem;
  min-width: 0;
}
.vos-notes-editor label {
  display: grid;
  gap: 0.32rem;
  color: rgba(212, 165, 116, 0.78);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vos-notes-editor input,
.vos-notes-editor textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(212, 165, 116, 0.22);
  border-radius: 8px;
  background: rgba(6, 5, 9, 0.82);
  color: var(--vos-cream);
  font: inherit;
}
.vos-notes-editor input {
  min-height: 42px;
  padding: 0.58rem 0.68rem;
}
.vos-notes-editor textarea {
  min-height: 420px;
  padding: 0.72rem 0.78rem;
  line-height: 1.45;
  resize: vertical;
}
.vos-notes-editor-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}
.vos-notes-empty {
  margin: 0;
  color: rgba(212, 199, 173, 0.7);
  font-style: italic;
}
@media (max-width: 760px) {
  .vos-notes-layout {
    grid-template-columns: 1fr;
  }
  .vos-panel-head {
    align-items: flex-start;
  }
  .vos-notes-editor textarea {
    min-height: 340px;
  }
}
</style>

<section class="vos-compact-panel vos-notes-panel" aria-labelledby="vos-notes-title">
  <div class="vos-panel-head">
    <h2 class="vos-panel-title" id="vos-notes-title">Notes</h2>
    <div class="vos-settings-actions">
      <button class="vos-button" id="vos-notes-new" type="button">New</button>
      <button class="vos-button" id="vos-notes-refresh" type="button">Refresh</button>
    </div>
  </div>

  <div class="vos-notes-scope" id="vos-notes-scope" hidden>
    <button class="vos-button is-selected" type="button" data-scope="private">Mine</button>
    <button class="vos-button" type="button" data-scope="dm">DM</button>
  </div>

  <div class="vos-settings-status" id="vos-notes-status" role="status" aria-live="polite">Loading...</div>

  <div class="vos-notes-layout">
    <aside class="vos-notes-list" id="vos-notes-list" aria-label="Saved notes"></aside>
    <form class="vos-notes-editor" id="vos-notes-form">
      <label>
        Title
        <input id="vos-notes-title-input" type="text" maxlength="140" autocomplete="off">
      </label>
      <label>
        Body
        <textarea id="vos-notes-body" spellcheck="true"></textarea>
      </label>
      <div class="vos-notes-editor-actions">
        <button class="vos-button" id="vos-notes-delete" type="button" disabled>Delete</button>
        <button class="vos-button" id="vos-notes-save" type="submit">Save</button>
      </div>
    </form>
  </div>
</section>

<script>
(function () {
  const statusEl = document.getElementById('vos-notes-status');
  const listEl = document.getElementById('vos-notes-list');
  const formEl = document.getElementById('vos-notes-form');
  const titleEl = document.getElementById('vos-notes-title-input');
  const bodyEl = document.getElementById('vos-notes-body');
  const saveEl = document.getElementById('vos-notes-save');
  const deleteEl = document.getElementById('vos-notes-delete');
  const newEl = document.getElementById('vos-notes-new');
  const refreshEl = document.getElementById('vos-notes-refresh');
  const scopeEl = document.getElementById('vos-notes-scope');

  let pwa = null;
  let currentScope = 'private';
  let currentNoteId = null;
  let notes = [];
  let dirty = false;

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function noteDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function markDirty() {
    dirty = true;
    setStatus('Unsaved changes.');
  }

  function canSwitch() {
    return !dirty || window.confirm('Discard unsaved changes?');
  }

  function authHeaders(extra) {
    return pwa && pwa.authHeaders ? pwa.authHeaders(extra || {}) : (extra || {});
  }

  async function apiJson(url, options) {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: authHeaders(options && options.headers),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function setEditor(note) {
    currentNoteId = note ? note.id : null;
    titleEl.value = note ? note.title || '' : '';
    bodyEl.value = note ? note.body || '' : '';
    deleteEl.disabled = !currentNoteId;
    dirty = false;
    renderList();
  }

  function renderList() {
    listEl.innerHTML = '';
    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-notes-empty';
      empty.textContent = 'No notes yet.';
      listEl.appendChild(empty);
      return;
    }
    notes.forEach((note) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vos-row-chip' + (note.id === currentNoteId ? ' is-selected' : '');
      button.innerHTML = `
        <span>
          <span class="vos-row-chip-title"></span>
          <span class="vos-row-chip-meta"></span>
        </span>
        <span class="vos-row-chip-badge"></span>
      `;
      button.querySelector('.vos-row-chip-title').textContent = note.title || 'Untitled Note';
      button.querySelector('.vos-row-chip-meta').textContent = (note.body || '').replace(/\s+/g, ' ').slice(0, 120);
      button.querySelector('.vos-row-chip-badge').textContent = noteDate(note.updated_at);
      button.addEventListener('click', () => {
        if (!canSwitch()) return;
        setEditor(note);
        setStatus('Loaded.');
      });
      listEl.appendChild(button);
    });
  }

  async function loadNotes(selectId) {
    refreshEl.disabled = true;
    setStatus('Loading...');
    try {
      const data = await apiJson(`/api/notes?scope=${encodeURIComponent(currentScope)}`);
      notes = Array.isArray(data.notes) ? data.notes : [];
      const selected = notes.find((note) => note.id === selectId) || notes[0] || null;
      setEditor(selected);
      setStatus(notes.length ? 'Updated.' : 'No notes yet.');
    } catch (error) {
      setStatus(error.message || 'Could not load notes.', true);
    } finally {
      refreshEl.disabled = false;
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    saveEl.disabled = true;
    setStatus('Saving...');
    try {
      const payload = {
        scope: currentScope,
        title: titleEl.value.trim(),
        body: bodyEl.value.trim(),
      };
      const url = currentNoteId ? `/api/notes/${encodeURIComponent(currentNoteId)}` : '/api/notes';
      const method = currentNoteId ? 'PUT' : 'POST';
      const data = await apiJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      dirty = false;
      await loadNotes(data.note && data.note.id);
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message || 'Could not save note.', true);
    } finally {
      saveEl.disabled = false;
    }
  }

  async function deleteNote() {
    if (!currentNoteId) return;
    if (!window.confirm('Delete this note?')) return;
    deleteEl.disabled = true;
    setStatus('Deleting...');
    try {
      await apiJson(`/api/notes/${encodeURIComponent(currentNoteId)}`, { method: 'DELETE' });
      dirty = false;
      await loadNotes();
      setStatus('Deleted.');
    } catch (error) {
      setStatus(error.message || 'Could not delete note.', true);
    } finally {
      deleteEl.disabled = !currentNoteId;
    }
  }

  async function boot() {
    pwa = window.VOS_PWA;
    const name = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity().catch(() => null) : null;
    if (!name) {
      setStatus('Sign in to use notes.', true);
      return;
    }
    if (pwa && pwa.isDm && pwa.isDm()) {
      scopeEl.hidden = false;
    }
    await loadNotes();
  }

  titleEl.addEventListener('input', markDirty);
  bodyEl.addEventListener('input', markDirty);
  formEl.addEventListener('submit', saveNote);
  deleteEl.addEventListener('click', deleteNote);
  newEl.addEventListener('click', () => {
    if (!canSwitch()) return;
    setEditor(null);
    titleEl.focus();
    setStatus('New note.');
  });
  refreshEl.addEventListener('click', () => {
    if (!canSwitch()) return;
    loadNotes(currentNoteId);
  });
  scopeEl.querySelectorAll('[data-scope]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.scope === currentScope || !canSwitch()) return;
      currentScope = button.dataset.scope;
      scopeEl.querySelectorAll('[data-scope]').forEach((candidate) => {
        candidate.classList.toggle('is-selected', candidate === button);
      });
      setEditor(null);
      loadNotes();
    });
  });

  window.addEventListener('DOMContentLoaded', boot);
})();
</script>
