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
