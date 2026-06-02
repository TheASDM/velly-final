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
  --submit-gold: #ddb77f;
  --submit-gold-dim: #9e815b;
  --submit-ink: #08070b;
  --submit-panel: rgba(13, 11, 17, 0.86);
  --submit-panel-strong: rgba(19, 16, 23, 0.96);
  --submit-border: rgba(221, 183, 127, 0.24);
  --submit-border-strong: rgba(221, 183, 127, 0.52);
  --submit-teal: #78b8ad;
  --submit-ruby: #b45d70;
  --submit-green: #8fbc83;
  max-width: 1120px;
  margin: 0 auto 2.5rem;
  display: grid;
  gap: 1rem;
}
.vos-submit-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
  padding: 0.2rem 0 1rem;
  border-bottom: 1px solid rgba(221, 183, 127, 0.18);
}
.vos-submit-kicker {
  margin: 0;
  color: var(--submit-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vos-submit-top h1 {
  margin: 0.12rem 0 0;
  padding: 0;
  border: 0;
  color: #f0d4a5;
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  letter-spacing: 0.04em;
  line-height: 1;
}
.vos-submit-top h1::after { content: none; }
.vos-submit-identity-card {
  min-width: min(100%, 260px);
  display: grid;
  gap: 0.55rem;
  justify-items: end;
}
.vos-submit-identity-text {
  margin: 0;
  color: rgba(232, 220, 200, 0.76);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.96rem;
  line-height: 1.35;
  text-align: right;
}
.vos-submit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.34fr);
  gap: 1rem;
  align-items: start;
}
.vos-submit-panel {
  border: 1px solid var(--submit-border);
  border-radius: 8px;
  background:
    radial-gradient(ellipse 90% 50% at 18% 0%, rgba(221, 183, 127, 0.09), transparent 64%),
    linear-gradient(180deg, var(--submit-panel-strong), rgba(7, 6, 10, 0.96));
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
.vos-submit-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 1.05rem 0;
}
.vos-submit-panel-title {
  margin: 0;
  color: var(--submit-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.82rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vos-submit-panel-note {
  color: rgba(232, 220, 200, 0.58);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.92rem;
}
.vos-submit-form {
  display: grid;
  gap: 1rem;
  padding: 1rem 1.05rem 1.1rem;
}
.vos-submit-kind-select {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.vos-submit-type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}
.vos-submit-type {
  appearance: none;
  min-height: 58px;
  display: grid;
  gap: 0.18rem;
  align-content: center;
  padding: 0.62rem 0.72rem;
  border: 1px solid rgba(221, 183, 127, 0.26);
  border-radius: 8px;
  background: rgba(7, 6, 10, 0.54);
  color: rgba(232, 220, 200, 0.78);
  cursor: pointer;
  text-align: left;
}
.vos-submit-type strong {
  color: var(--submit-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.66rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.vos-submit-type span {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.86rem;
  line-height: 1.25;
}
.vos-submit-type:hover,
.vos-submit-type.is-active {
  border-color: var(--submit-border-strong);
  background: rgba(221, 183, 127, 0.11);
  color: var(--vos-cream);
}
.vos-submit-field {
  display: grid;
  gap: 0.42rem;
}
.vos-submit-field-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}
.vos-submit-label {
  color: var(--submit-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vos-submit-count {
  color: rgba(232, 220, 200, 0.46);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}
.vos-submit-form input,
.vos-submit-form textarea {
  width: 100%;
  border: 1px solid rgba(221, 183, 127, 0.26);
  border-radius: 8px;
  background: rgba(4, 4, 8, 0.74);
  color: var(--vos-cream);
  font: 1rem 'Crimson Text', Georgia, serif;
  line-height: 1.45;
  padding: 0.76rem 0.84rem;
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.5);
}
.vos-submit-form input:focus,
.vos-submit-form textarea:focus {
  outline: none;
  border-color: var(--submit-border-strong);
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.42), 0 0 0 3px rgba(221, 183, 127, 0.14);
}
.vos-submit-form textarea {
  min-height: 156px;
  max-height: 520px;
  resize: vertical;
  overflow-y: auto;
}
#vos-submit-connections {
  min-height: 118px;
}
#vos-submit-notes {
  min-height: 128px;
}
.vos-submit-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.25rem;
}
.vos-submit-secondary {
  appearance: none;
  min-height: 38px;
  padding: 0.5rem 0.78rem;
  border: 1px solid rgba(221, 183, 127, 0.26);
  border-radius: 6px;
  background: rgba(7, 6, 10, 0.48);
  color: rgba(221, 183, 127, 0.76);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.vos-submit-secondary:hover {
  border-color: var(--submit-border-strong);
  color: var(--vos-cream);
}
.vos-submit-status {
  min-height: 1.35em;
  color: rgba(232, 220, 200, 0.72);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.95rem;
  line-height: 1.35;
}
.vos-submit-status.is-error {
  color: #ff9a91;
}
.vos-submit-side {
  display: grid;
  gap: 1rem;
}
.vos-submit-ready {
  padding: 1rem;
}
.vos-submit-ready-list {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.vos-submit-ready-list li {
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr);
  gap: 0.48rem;
  align-items: start;
  color: rgba(232, 220, 200, 0.62);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.94rem;
  line-height: 1.32;
}
.vos-submit-ready-list li::before {
  content: '';
  width: 0.62rem;
  height: 0.62rem;
  margin-top: 0.33rem;
  border-radius: 50%;
  border: 1px solid rgba(221, 183, 127, 0.36);
  background: rgba(7, 6, 10, 0.58);
}
.vos-submit-ready-list li.is-done {
  color: rgba(232, 220, 200, 0.88);
}
.vos-submit-ready-list li.is-done::before {
  border-color: rgba(143, 188, 131, 0.72);
  background: var(--submit-green);
}
.vos-submit-draft-note {
  margin: 0.85rem 0 0;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(221, 183, 127, 0.14);
  color: rgba(232, 220, 200, 0.58);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.92rem;
  line-height: 1.35;
}
.vos-submit-list-panel {
  padding: 1rem;
}
.vos-submit-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
}
.vos-submit-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: start;
  padding: 0.9rem;
  border: 1px solid rgba(221, 183, 127, 0.18);
  border-radius: 8px;
  background: rgba(7, 6, 10, 0.46);
}
.vos-submit-card.is-rejected {
  border-color: rgba(180, 93, 112, 0.5);
}
.vos-submit-card h3 {
  margin: 0;
  color: #f0d4a5;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.vos-submit-card p {
  margin: 0.42rem 0 0;
  color: rgba(232, 220, 200, 0.76);
  font-family: 'Crimson Text', Georgia, serif;
  line-height: 1.38;
}
.vos-submit-card img {
  width: 104px;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid rgba(221, 183, 127, 0.28);
  border-radius: 6px;
  background: #08070b;
}
.vos-submit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.62rem;
}
.vos-submit-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.13rem 0.48rem;
  border: 1px solid rgba(221, 183, 127, 0.24);
  border-radius: 999px;
  color: var(--submit-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vos-submit-chip.is-needs-review {
  border-color: rgba(120, 184, 173, 0.42);
  color: #9dd8cf;
}
.vos-submit-chip.is-rejected {
  border-color: rgba(180, 93, 112, 0.5);
  color: #ee9faf;
}
.vos-submit-feedback {
  margin-top: 0.72rem;
  padding: 0.62rem 0.72rem;
  border: 1px solid rgba(180, 93, 112, 0.42);
  border-radius: 6px;
  background: rgba(60, 22, 30, 0.42);
  color: #f1d0d6;
  font-family: 'Crimson Text', Georgia, serif;
  line-height: 1.35;
}
.vos-submit-resubmit {
  margin-top: 0.65rem;
}
.vos-submit-empty {
  margin: 0;
  padding: 1.2rem;
  border: 1px dashed rgba(221, 183, 127, 0.24);
  border-radius: 8px;
  color: rgba(232, 220, 200, 0.58);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  text-align: center;
}
@media (max-width: 900px) {
  .vos-submit-top,
  .vos-submit-layout {
    grid-template-columns: 1fr;
  }
  .vos-submit-identity-card {
    justify-items: start;
  }
  .vos-submit-identity-text {
    text-align: left;
  }
  .vos-submit-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .vos-submit-lore {
    gap: 0.85rem;
  }
  .vos-submit-type-grid {
    grid-template-columns: 1fr;
  }
  .vos-submit-panel-head,
  .vos-submit-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .vos-submit-card {
    grid-template-columns: 1fr;
  }
  .vos-submit-card img {
    width: 100%;
    max-height: 240px;
  }
}
</style>

<div class="vos-submit-lore">
  <header class="vos-submit-top">
    <div>
      <p class="vos-submit-kicker">Wiki Drafts</p>
      <h1>Submit Lore</h1>
    </div>
    <div class="vos-submit-identity-card">
      <button class="vos-button" id="vos-submit-login" type="button">Log In</button>
      <p id="vos-submit-identity" class="vos-submit-identity-text">Checking login...</p>
    </div>
  </header>

  <div class="vos-submit-layout">
    <section class="vos-submit-panel" aria-labelledby="vos-submit-form-title">
      <div class="vos-submit-panel-head">
        <h2 class="vos-submit-panel-title" id="vos-submit-form-title">New Entry</h2>
        <span class="vos-submit-panel-note">DM review required</span>
      </div>

      <form class="vos-submit-form" id="vos-submit-form">
        <select id="vos-submit-kind" class="vos-submit-kind-select" required tabindex="-1" aria-hidden="true">
          <option value="item">Item</option>
          <option value="person">Person</option>
          <option value="place">Place</option>
          <option value="faction">Faction</option>
          <option value="lore">Lore</option>
          <option value="culture">Culture</option>
        </select>

        <div class="vos-submit-type-grid" id="vos-submit-kind-picker" role="group" aria-label="Entry type">
          <button class="vos-submit-type is-active" type="button" data-kind="item"><strong>Item</strong><span>Objects, gear, relics</span></button>
          <button class="vos-submit-type" type="button" data-kind="person"><strong>Person</strong><span>NPCs and notable figures</span></button>
          <button class="vos-submit-type" type="button" data-kind="place"><strong>Place</strong><span>Locations and districts</span></button>
          <button class="vos-submit-type" type="button" data-kind="faction"><strong>Faction</strong><span>Guilds, crews, powers</span></button>
          <button class="vos-submit-type" type="button" data-kind="lore"><strong>Lore</strong><span>History, rumors, records</span></button>
          <button class="vos-submit-type" type="button" data-kind="culture"><strong>Culture</strong><span>Festivals, rites, customs</span></button>
        </div>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Title</span>
            <span class="vos-submit-count" data-count-for="vos-submit-entry-title">0 / 120</span>
          </span>
          <input id="vos-submit-entry-title" type="text" maxlength="120" placeholder="Kaligor, The Cask and Cube, Master Sarto..." required>
        </label>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Player-Facing Lore</span>
            <span class="vos-submit-count" data-count-for="vos-submit-description">0 / 2500</span>
          </span>
          <textarea id="vos-submit-description" maxlength="2500" data-autogrow placeholder="What should the table know? Include visible details, tone, rules hooks, and anything that should become public wiki canon." required></textarea>
        </label>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Connections</span>
            <span class="vos-submit-count" data-count-for="vos-submit-connections">Optional</span>
          </span>
          <textarea id="vos-submit-connections" data-autogrow placeholder="Owner: Lotan&#10;Near: The Tiered Gardens&#10;Opposes: The Fog Wardens"></textarea>
        </label>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Notes For DM</span>
            <span class="vos-submit-count" data-count-for="vos-submit-notes">0 / 2000</span>
          </span>
          <textarea id="vos-submit-notes" maxlength="2000" data-autogrow placeholder="Optional: uncertainty, spoiler boundaries, private context, or what you want the DM to decide before publishing."></textarea>
        </label>

        <div class="vos-submit-actions">
          <button class="vos-submit-secondary" id="vos-submit-clear" type="button">Clear Draft</button>
          <button class="vos-button" id="vos-submit-send" type="submit">Submit Draft</button>
        </div>
        <div class="vos-submit-status" id="vos-submit-status" role="status" aria-live="polite"></div>
      </form>
    </section>

    <aside class="vos-submit-side" aria-label="Submission status">
      <section class="vos-submit-panel vos-submit-ready">
        <h2 class="vos-submit-panel-title">Ready Check</h2>
        <ul class="vos-submit-ready-list" id="vos-submit-ready-list">
          <li data-ready="identity">Signed in as a player</li>
          <li data-ready="title">Title is filled in</li>
          <li data-ready="description">Lore description has substance</li>
          <li data-ready="draft">Draft is saved locally</li>
        </ul>
        <p class="vos-submit-draft-note" id="vos-submit-draft-note">Draft autosave is active.</p>
      </section>
    </aside>
  </div>

  <section class="vos-submit-panel vos-submit-list-panel" aria-labelledby="vos-submit-mine-title">
    <div class="vos-submit-panel-head">
      <h2 class="vos-submit-panel-title" id="vos-submit-mine-title">My Submissions</h2>
      <button class="vos-submit-secondary" id="vos-submit-refresh" type="button">Refresh</button>
    </div>
    <div class="vos-submit-list" id="vos-submit-list"></div>
    <div class="vos-submit-status" id="vos-submit-list-status" role="status" aria-live="polite"></div>
  </section>
</div>

<script>
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
</script>
