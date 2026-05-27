---
title: Submit Lore
description: Submit a player-suggested item, person, place, faction, or lore entry for DM review.
permalink: /submit-lore/
published: true
date: 2026-05-26T00:00:00.000Z
tags: tools, submissions, lore
editor: markdown
dateCreated: 2026-05-26T00:00:00.000Z
autoIndex: false
---

<style>
.vos-submit-lore {
  max-width: 920px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}
.vos-submit-form {
  display: grid;
  gap: 0.85rem;
}
.vos-submit-form label {
  display: grid;
  gap: 0.35rem;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-submit-form input,
.vos-submit-form select,
.vos-submit-form textarea {
  width: 100%;
  border: 1px solid rgba(201,168,76,0.25);
  border-radius: 6px;
  background: rgba(7,6,10,0.72);
  color: var(--vos-cream);
  font: 1rem 'EB Garamond', Georgia, serif;
  line-height: 1.4;
  padding: 0.65rem 0.75rem;
}
.vos-submit-form textarea {
  min-height: 120px;
  resize: vertical;
}
.vos-submit-status {
  min-height: 1.4em;
  color: var(--vos-text);
}
.vos-submit-status.is-error {
  color: var(--vos-quest-bright);
}
.vos-submit-actions {
  display: flex;
  justify-content: flex-end;
}
.vos-submit-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: start;
  padding: 0.9rem;
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 8px;
  background: rgba(7,6,10,0.42);
}
.vos-submit-card h3 {
  margin: 0;
}
.vos-submit-card p {
  margin: 0.35rem 0 0;
}
.vos-submit-card img {
  width: 96px;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid rgba(201,168,76,0.28);
  border-radius: 6px;
}
.vos-submit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}
.vos-submit-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0.15rem 0.5rem;
  border: 1px solid rgba(201,168,76,0.22);
  border-radius: 999px;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-submit-empty {
  color: rgba(233,225,208,0.64);
  font-style: italic;
}
.vos-submit-card.is-rejected {
  border-left: 3px solid rgba(228, 130, 130, 0.6);
}
.vos-submit-reject-reason {
  margin-top: 0.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(228, 130, 130, 0.35);
  border-radius: 6px;
  background: rgba(40, 18, 18, 0.55);
  color: #f3d4d4;
  font-size: 0.92rem;
  line-height: 1.4;
}
.vos-submit-reject-label {
  display: block;
  margin-bottom: 0.18rem;
  color: rgba(243, 196, 196, 0.85);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vos-submit-reject-text {
  display: block;
  overflow-wrap: break-word;
  word-break: break-word;
}
.vos-submit-resubmit {
  margin-top: 0.65rem;
  align-self: start;
}
@media (max-width: 560px) {
  .vos-submit-card {
    grid-template-columns: 1fr;
  }
  .vos-submit-card img {
    width: 100%;
    max-height: 220px;
  }
}
</style>

<div class="vos-submit-lore">
  <section class="vos-section-header" aria-labelledby="vos-submit-title">
    <p class="vos-section-kicker">Wiki Drafts</p>
    <h1 class="vos-section-title" id="vos-submit-title">Submit Lore</h1>
    <p class="vos-section-subtitle">Create a DM-reviewed draft for a new item, person, place, faction, or lore entry.</p>
  </section>

  <section class="vos-compact-panel" aria-labelledby="vos-submit-login-title">
    <div class="vos-panel-head">
      <h2 class="vos-panel-title" id="vos-submit-login-title">Identity</h2>
      <button class="vos-button" id="vos-submit-login" type="button">Log In</button>
    </div>
    <p id="vos-submit-identity" class="vos-submit-status">Checking login...</p>
  </section>

  <section class="vos-compact-panel" aria-labelledby="vos-submit-form-title">
    <div class="vos-panel-head">
      <h2 class="vos-panel-title" id="vos-submit-form-title">New Entry</h2>
      <span class="vos-panel-note">DM approval required</span>
    </div>
    <form class="vos-submit-form" id="vos-submit-form">
      <label>
        Type
        <select id="vos-submit-kind" required>
          <option value="item">Item</option>
          <option value="person">Person</option>
          <option value="place">Place</option>
          <option value="faction">Faction</option>
          <option value="lore">Lore</option>
        </select>
      </label>
      <label>
        Title
        <input id="vos-submit-entry-title" type="text" maxlength="120" placeholder="Kaligor, The Cask and Cube, Master Sarto..." required>
      </label>
      <label>
        Short Description
        <textarea id="vos-submit-description" maxlength="2500" placeholder="What is this? Include the important visible details, rules hooks, tone, and what players should know." required></textarea>
      </label>
      <label>
        Connections
        <textarea id="vos-submit-connections" placeholder="One per line, like:
Owner: Lotan
Near: The Tiered Gardens
Opposes: The Fog Wardens"></textarea>
      </label>
      <label>
        Notes For DM
        <textarea id="vos-submit-notes" maxlength="2000" placeholder="Optional: anything uncertain, private, or needing approval before it becomes wiki canon."></textarea>
      </label>
      <div class="vos-submit-actions">
        <button class="vos-button" id="vos-submit-send" type="submit">Submit Draft</button>
      </div>
      <div class="vos-submit-status" id="vos-submit-status" role="status" aria-live="polite"></div>
    </form>
  </section>

  <section class="vos-compact-panel" aria-labelledby="vos-submit-mine-title">
    <div class="vos-panel-head">
      <h2 class="vos-panel-title" id="vos-submit-mine-title">My Submissions</h2>
      <button class="vos-button" id="vos-submit-refresh" type="button">Refresh</button>
    </div>
    <div class="vos-row-chip-list" id="vos-submit-list"></div>
    <div class="vos-submit-status" id="vos-submit-list-status" role="status" aria-live="polite"></div>
  </section>
</div>

<script>
(function () {
  const form = document.getElementById('vos-submit-form');
  const kindEl = document.getElementById('vos-submit-kind');
  const titleEl = document.getElementById('vos-submit-entry-title');
  const descriptionEl = document.getElementById('vos-submit-description');
  const connectionsEl = document.getElementById('vos-submit-connections');
  const notesEl = document.getElementById('vos-submit-notes');
  const sendEl = document.getElementById('vos-submit-send');
  const statusEl = document.getElementById('vos-submit-status');
  const identityEl = document.getElementById('vos-submit-identity');
  const loginEl = document.getElementById('vos-submit-login');
  const listEl = document.getElementById('vos-submit-list');
  const listStatusEl = document.getElementById('vos-submit-list-status');
  const refreshEl = document.getElementById('vos-submit-refresh');
  let pollTimer = null;

  function setStatus(target, text, isError) {
    if (!target) return;
    target.textContent = text || '';
    target.classList.toggle('is-error', !!isError);
  }

  function pwa() {
    return window.VOS_PWA || null;
  }

  function authHeaders(extra) {
    const app = pwa();
    if (app && app.authHeaders) return app.authHeaders(extra || {});
    return extra || {};
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
    if (name) {
      setStatus(identityEl, `Submitting as ${name}.`);
      loginEl.textContent = 'Switch';
      return name;
    }
    setStatus(identityEl, 'Log in before submitting a draft.', true);
    loginEl.textContent = 'Log In';
    return null;
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
      status.className = 'vos-submit-chip';
      status.textContent = item.status || 'submitted';
      meta.append(kind, status);
      if (item.status !== 'rejected' && item.error_message) {
        const warning = document.createElement('span');
        warning.className = 'vos-submit-chip';
        warning.textContent = 'Needs DM';
        meta.appendChild(warning);
      }
      main.append(title, summary, meta);

      // Rejected submissions: surface the DM's reason and offer a one-tap
      // "Edit & resubmit" that prefills the form above with this draft's
      // fields. The rejected row is left in history as a record.
      if (item.status === 'rejected') {
        const reasonRow = document.createElement('div');
        reasonRow.className = 'vos-submit-reject-reason';
        const reasonLabel = document.createElement('span');
        reasonLabel.className = 'vos-submit-reject-label';
        reasonLabel.textContent = 'DM feedback:';
        const reasonText = document.createElement('span');
        reasonText.className = 'vos-submit-reject-text';
        reasonText.textContent = item.error_message || 'Rejected by DM';
        reasonRow.append(reasonLabel, reasonText);
        main.appendChild(reasonRow);

        const resubmit = document.createElement('button');
        resubmit.type = 'button';
        resubmit.className = 'vos-button vos-submit-resubmit';
        resubmit.textContent = 'Edit & resubmit';
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
    if (kindEl) kindEl.value = item.kind || kindEl.value;
    if (titleEl) titleEl.value = item.title || '';
    if (descriptionEl) descriptionEl.value = item.short_description || '';
    if (connectionsEl) {
      const list = Array.isArray(item.connections) ? item.connections : [];
      connectionsEl.value = list.join('\n');
    }
    if (notesEl) notesEl.value = item.notes || '';
    setStatus(statusEl, 'Loaded for editing — change what the DM flagged, then submit again.');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (titleEl && typeof titleEl.focus === 'function') titleEl.focus();
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
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
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

  loginEl.addEventListener('click', async () => {
    await ensurePlayer(true);
    await syncIdentity();
    await refreshMine();
  });

  refreshEl.addEventListener('click', refreshMine);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
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
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setStatus(statusEl, 'Submitted. Draft generation has started.');
      form.reset();
      kindEl.value = 'item';
      await refreshMine();
    } catch (error) {
      setStatus(statusEl, error.message, true);
    } finally {
      sendEl.disabled = false;
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    syncIdentity().then(refreshMine).catch(() => {});
  });
})();
</script>
