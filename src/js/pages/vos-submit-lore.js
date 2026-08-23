(function () {
  const DRAFT_KEY = 'vos.submitLore.draft.v2';
  const form = document.getElementById('vos-submit-form');
  const kindEl = document.getElementById('vos-submit-kind');
  const kindPickerEl = document.getElementById('vos-submit-kind-picker');
  const titleEl = document.getElementById('vos-submit-entry-title');
  const descriptionEl = document.getElementById('vos-submit-description');
  const connectionsEl = document.getElementById('vos-submit-connections');
  const notesEl = document.getElementById('vos-submit-notes');
  const sendEl = document.getElementById('vos-submit-send');
  const clearEl = document.getElementById('vos-submit-clear');
  const statusEl = document.getElementById('vos-submit-status');
  const identityEl = document.getElementById('vos-submit-identity');
  const loginEl = document.getElementById('vos-submit-login');
  const listEl = document.getElementById('vos-submit-list');
  const listStatusEl = document.getElementById('vos-submit-list-status');
  const refreshEl = document.getElementById('vos-submit-refresh');
  const draftNoteEl = document.getElementById('vos-submit-draft-note');
  let pollTimer = null;
  let currentPlayer = '';
  let saveTimer = null;

  function pwa() {
    return window.VOS_PWA || null;
  }

  function authHeaders(extra) {
    const app = pwa();
    if (app && app.authHeaders) return app.authHeaders(extra || {});
    return extra || {};
  }

  function setStatus(target, text, isError) {
    if (!target) return;
    target.textContent = text || '';
    target.classList.toggle('is-error', !!isError);
  }

  async function ensurePlayer(force) {
    const app = pwa();
    if (!app) return null;
    const existing = app.getPlayerName && app.getPlayerName();
    if (existing && !force) return existing;
    return app.ensureIdentity ? app.ensureIdentity({ force: !!force }) : existing;
  }

  async function syncIdentity() {
    const name = await ensurePlayer(false);
    currentPlayer = name || '';
    if (name) {
      identityEl.textContent = 'Submitting as ' + name + '.';
      identityEl.classList.remove('is-error');
      loginEl.textContent = 'Switch';
    } else {
      identityEl.textContent = 'Log in before submitting a draft.';
      identityEl.classList.add('is-error');
      loginEl.textContent = 'Log In';
    }
    updateReadyState();
    return name;
  }

  function setKind(kind) {
    if (!kindEl || !kind) return;
    kindEl.value = kind;
    if (kindPickerEl) {
      kindPickerEl.querySelectorAll('[data-kind]').forEach((button) => {
        const active = button.dataset.kind === kind;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    saveDraftSoon();
  }

  function updateCounts() {
    document.querySelectorAll('[data-count-for]').forEach((counter) => {
      const field = document.getElementById(counter.dataset.countFor);
      if (!field) return;
      const max = Number(field.getAttribute('maxlength') || 0);
      if (!max) {
        counter.textContent = field.value.trim() ? field.value.trim().length + ' chars' : 'Optional';
        return;
      }
      counter.textContent = field.value.length + ' / ' + max;
    });
  }

  function autogrow(field) {
    if (!field) return;
    field.style.height = 'auto';
    const next = Math.min(Math.max(field.scrollHeight, 118), 520);
    field.style.height = next + 'px';
  }

  function updateReadyState() {
    const ready = {
      identity: !!currentPlayer,
      title: !!titleEl.value.trim(),
      description: descriptionEl.value.trim().length >= 40,
      draft: !!(titleEl.value.trim() || descriptionEl.value.trim() || connectionsEl.value.trim() || notesEl.value.trim()),
    };
    document.querySelectorAll('[data-ready]').forEach((item) => {
      item.classList.toggle('is-done', !!ready[item.dataset.ready]);
    });
    updateCounts();
  }

  function serializeDraft() {
    return {
      kind: kindEl.value,
      title: titleEl.value,
      description: descriptionEl.value,
      connections: connectionsEl.value,
      notes: notesEl.value,
      updatedAt: Date.now(),
    };
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializeDraft()));
      draftNoteEl.textContent = 'Draft saved locally.';
    } catch (e) {
      draftNoteEl.textContent = 'Draft autosave could not write locally.';
    }
    updateReadyState();
  }

  function saveDraftSoon() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 250);
    updateReadyState();
  }

  function restoreDraft() {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    } catch (e) {
      draft = null;
    }
    if (!draft || typeof draft !== 'object') {
      updateReadyState();
      return;
    }
    setKind(draft.kind || 'item');
    titleEl.value = draft.title || '';
    descriptionEl.value = draft.description || '';
    connectionsEl.value = draft.connections || '';
    notesEl.value = draft.notes || '';
    document.querySelectorAll('[data-autogrow]').forEach(autogrow);
    draftNoteEl.textContent = 'Restored your local draft.';
    updateReadyState();
  }

  function clearDraft() {
    form.reset();
    setKind('item');
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    document.querySelectorAll('[data-autogrow]').forEach(autogrow);
    draftNoteEl.textContent = 'Draft cleared.';
    setStatus(statusEl, '');
    updateReadyState();
  }

  function statusClass(status) {
    if (status === 'needs_review') return 'is-needs-review';
    if (status === 'rejected') return 'is-rejected';
    return '';
  }

  function statusLabel(status) {
    const labels = {
      submitted: 'Submitted',
      drafting: 'Drafting',
      needs_review: 'Needs Review',
      approved: 'Approved',
      rejected: 'Rejected',
      published: 'Published',
    };
    return labels[status] || status || 'Submitted';
  }

  function renderSubmissions(items) {
    listEl.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-submit-empty';
      empty.textContent = 'No submissions yet.';
      listEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('article');
      const main = document.createElement('div');
      const title = document.createElement('h3');
      const summary = document.createElement('p');
      const meta = document.createElement('div');
      const kind = document.createElement('span');
      const status = document.createElement('span');
      card.className = 'vos-submit-card';
      if (item.status === 'rejected') card.classList.add('is-rejected');
      title.textContent = item.title || 'Untitled';
      summary.textContent = item.generated_summary || item.short_description || '';
      meta.className = 'vos-submit-meta';
      kind.className = 'vos-submit-chip';
      kind.textContent = item.kindLabel || item.kind || 'Draft';
      status.className = 'vos-submit-chip ' + statusClass(item.status);
      status.textContent = statusLabel(item.status);
      meta.append(kind, status);
      if (item.status !== 'rejected' && item.error_message) {
        const warning = document.createElement('span');
        warning.className = 'vos-submit-chip is-rejected';
        warning.textContent = 'Needs DM';
        meta.appendChild(warning);
      }
      main.append(title, summary, meta);

      if (item.status === 'rejected') {
        const feedback = document.createElement('div');
        feedback.className = 'vos-submit-feedback';
        feedback.textContent = item.error_message || 'Rejected by DM.';
        main.appendChild(feedback);

        const resubmit = document.createElement('button');
        resubmit.type = 'button';
        resubmit.className = 'vos-submit-secondary vos-submit-resubmit';
        resubmit.textContent = 'Edit and Resubmit';
        resubmit.addEventListener('click', () => loadIntoForm(item));
        main.appendChild(resubmit);
      }

      card.appendChild(main);
      if (item.image_url) {
        const image = document.createElement('img');
        image.src = item.image_url;
        image.alt = item.title || 'Draft image';
        card.appendChild(image);
      }
      listEl.appendChild(card);
    });
  }

  function loadIntoForm(item) {
    if (!item) return;
    setKind(item.kind || kindEl.value);
    titleEl.value = item.title || '';
    descriptionEl.value = item.short_description || '';
    const list = Array.isArray(item.connections) ? item.connections : [];
    connectionsEl.value = list.map((entry) => {
      if (typeof entry === 'string') return entry;
      const relation = entry.relation || 'Connection';
      const target = entry.target || '';
      const note = entry.note ? ' (' + entry.note + ')' : '';
      return target ? relation + ': ' + target + note : '';
    }).filter(Boolean).join('\n');
    notesEl.value = item.notes || '';
    document.querySelectorAll('[data-autogrow]').forEach(autogrow);
    saveDraft();
    setStatus(statusEl, 'Loaded for editing. Submit again when ready.');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleEl.focus();
  }

  async function refreshMine() {
    const name = await syncIdentity();
    if (!name) return;
    refreshEl.disabled = true;
    setStatus(listStatusEl, 'Loading...');
    try {
      const response = await fetch('/api/lore-submissions/mine', {
        cache: 'no-store',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
      const submissions = data.submissions || [];
      renderSubmissions(submissions);
      const active = submissions.some((item) => ['submitted', 'drafting'].includes(item.status));
      if (active && !pollTimer) pollTimer = window.setInterval(refreshMine, 3500);
      if (!active && pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      setStatus(listStatusEl, 'Updated.');
    } catch (error) {
      setStatus(listStatusEl, error.message, true);
    } finally {
      refreshEl.disabled = false;
    }
  }

  kindPickerEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kind]');
    if (!button) return;
    setKind(button.dataset.kind);
  });

  [titleEl, descriptionEl, connectionsEl, notesEl].forEach((field) => {
    field.addEventListener('input', () => {
      if (field.matches('[data-autogrow]')) autogrow(field);
      saveDraftSoon();
    });
  });

  loginEl.addEventListener('click', async () => {
    await ensurePlayer(true);
    await syncIdentity();
    await refreshMine();
  });

  refreshEl.addEventListener('click', refreshMine);
  clearEl.addEventListener('click', clearDraft);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const name = await ensurePlayer(false);
    if (!name) {
      setStatus(statusEl, 'Log in before submitting a draft.', true);
      await ensurePlayer(true);
      await syncIdentity();
      return;
    }

    sendEl.disabled = true;
    setStatus(statusEl, 'Submitting...');
    try {
      const response = await fetch('/api/lore-submissions', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          kind: kindEl.value,
          title: titleEl.value.trim(),
          description: descriptionEl.value.trim(),
          connections: connectionsEl.value,
          notes: notesEl.value.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
      clearDraft();
      setStatus(statusEl, 'Submitted. Draft generation has started.');
      await refreshMine();
    } catch (error) {
      setStatus(statusEl, error.message, true);
    } finally {
      sendEl.disabled = false;
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    restoreDraft();
    syncIdentity().then(refreshMine).catch(() => {});
  });
})();
