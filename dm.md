---
title: DM
description: DM tools for Vallombrosa.
permalink: /dm/
---

<style>
.vos-dm {
  max-width: 860px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}
.vos-dm-panel {
  border: 1px solid rgba(201,161,74,0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(18,16,23,0.94), rgba(8,7,11,0.98)),
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,161,74,0.06), transparent 70%);
  box-shadow: 0 16px 42px rgba(0,0,0,0.55);
  padding: clamp(1.2rem, 3vw, 1.8rem);
}
.vos-dm-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}
.vos-dm-panel-head h2 {
  margin: 0;
}
.vos-dm-form {
  display: grid;
  gap: 0.85rem;
}
.vos-dm-form label,
.vos-dm-recipient-picker legend,
.vos-dm-toggle {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-form label {
  display: grid;
  gap: 0.35rem;
}
.vos-dm-form input,
.vos-dm-form select,
.vos-dm-form textarea {
  width: 100%;
  border: 1px solid rgba(201,168,76,0.25);
  border-radius: 6px;
  background: rgba(7,6,10,0.72);
  color: var(--vos-cream);
  font: 1rem 'EB Garamond', Georgia, serif;
  line-height: 1.4;
  padding: 0.65rem 0.75rem;
}
.vos-dm-form textarea {
  min-height: 110px;
  resize: vertical;
}
.vos-dm-recipient-picker {
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 8px;
  padding: 0.85rem;
  margin: 0;
}
.vos-dm-recipient-picker legend {
  padding: 0 0.35rem;
}
.vos-dm-recipient-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.45rem;
  margin-top: 0.65rem;
}
.vos-dm-check {
  display: flex !important;
  align-items: center;
  gap: 0.55rem !important;
  min-height: 42px;
  padding: 0.52rem 0.65rem;
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 999px;
  background: rgba(7,6,10,0.42);
  color: var(--vos-text) !important;
  cursor: pointer;
  text-transform: none !important;
}
.vos-dm-check input {
  width: 1rem;
  min-width: 1rem;
  height: 1rem;
  accent-color: var(--vos-gold-bright);
}
.vos-dm-check:has(input:checked) {
  border-color: rgba(212,165,116,0.62);
  background: rgba(212,165,116,0.12);
  color: var(--vos-cream) !important;
}
.vos-dm-check.is-disabled {
  opacity: 0.45;
}
.vos-dm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.vos-dm-actions button,
.vos-dm-button {
  min-height: 44px;
  padding: 0.55rem 1rem;
  border: 1px solid rgba(212,165,116,0.44);
  border-radius: 6px;
  background: rgba(212,165,116,0.1);
  color: var(--vos-gold-bright);
  cursor: pointer;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-actions button:hover,
.vos-dm-button:hover {
  background: rgba(212,165,116,0.16);
  color: var(--vos-cream);
}
.vos-dm-button.is-danger {
  border-color: rgba(176,67,67,0.5);
  color: #f0a0a0;
}
.vos-dm-status {
  min-height: 1.4em;
  margin-top: 0.85rem;
  color: var(--vos-text);
}
.vos-dm-status.is-error {
  color: var(--vos-quest-bright);
}
.vos-dm-counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin: 0.85rem 0 1rem;
}
.vos-dm-count {
  border: 1px solid rgba(201,168,76,0.22);
  border-radius: 6px;
  background: rgba(7,6,10,0.5);
  padding: 0.75rem;
  text-align: center;
}
.vos-dm-count strong {
  display: block;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 1.35rem;
}
.vos-dm-count span {
  color: rgba(233,225,208,0.72);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-dm-rsvps,
.vos-dm-history {
  list-style: none;
  margin: 0;
  padding: 0;
}
.vos-dm-rsvps li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0;
  border-top: 1px solid rgba(139,115,85,0.24);
}
.vos-dm-rsvps span {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.vos-dm-message {
  display: grid;
  gap: 0.65rem;
  border-top: 1px solid rgba(139,115,85,0.24);
  padding: 1rem 0;
}
.vos-dm-message:first-child {
  border-top: 0;
}
.vos-dm-message.is-deleted {
  opacity: 0.55;
}
.vos-dm-message-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.vos-dm-message-title {
  margin: 0;
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.vos-dm-message-body {
  margin: 0;
  color: var(--vos-text);
  white-space: pre-wrap;
}
.vos-dm-meta,
.vos-dm-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.vos-dm-meta {
  color: rgba(233,225,208,0.62);
  font-size: 0.9rem;
}
.vos-dm-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.2rem 0.55rem;
  border: 1px solid rgba(201,168,76,0.24);
  border-radius: 999px;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-empty {
  color: rgba(233,225,208,0.64);
  font-style: italic;
}
.vos-dm-submission-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
  gap: 1rem;
}
.vos-dm-submission-list {
  display: grid;
  align-content: start;
  gap: 0.55rem;
}
.vos-dm-submission-item {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 8px;
  background: rgba(7,6,10,0.44);
  color: var(--vos-text);
  cursor: pointer;
  padding: 0.7rem;
  text-align: left;
}
.vos-dm-submission-item:hover,
.vos-dm-submission-item.is-selected {
  border-color: rgba(212,165,116,0.52);
  background: rgba(212,165,116,0.1);
}
.vos-dm-submission-title {
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.vos-dm-submission-meta {
  color: rgba(233,225,208,0.62);
  font-size: 0.9rem;
}
.vos-dm-submission-preview {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border: 1px solid rgba(201,168,76,0.24);
  border-radius: 6px;
  background: rgba(7,6,10,0.5);
}
.vos-dm-submission-editor textarea#vos-dm-lore-markdown {
  min-height: 360px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.86rem;
}
.vos-dm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.vos-dm-toggle input {
  accent-color: var(--vos-gold-bright);
}
@media (max-width: 560px) {
  .vos-dm-panel-head,
  .vos-dm-message-head {
    align-items: stretch;
    flex-direction: column;
  }
  .vos-dm-submission-grid { grid-template-columns: 1fr; }
  .vos-dm-counts { grid-template-columns: 1fr; }
  .vos-dm-actions { justify-content: stretch; }
  .vos-dm-actions button,
  .vos-dm-button { width: 100%; }
}
</style>

<div class="vos-dm">
  <h1>DM</h1>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-token-title">
    <h2 id="vos-dm-token-title">Admin Token</h2>
    <div class="vos-dm-form">
      <label>
        Admin Token
        <input id="vos-dm-token" type="password" autocomplete="current-password">
      </label>
    </div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-lore-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-lore-title">Lore Submissions</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-lore-refresh" type="button">Refresh</button>
      </div>
    </div>
    <div class="vos-dm-submission-grid">
      <div class="vos-dm-submission-list" id="vos-dm-lore-list"></div>
      <form class="vos-dm-form vos-dm-submission-editor" id="vos-dm-lore-form" hidden>
        <label>
          Title
          <input id="vos-dm-lore-entry-title" type="text">
        </label>
        <label>
          Slug
          <input id="vos-dm-lore-slug" type="text">
        </label>
        <label>
          Summary
          <textarea id="vos-dm-lore-summary"></textarea>
        </label>
        <img class="vos-dm-submission-preview" id="vos-dm-lore-image" alt="" hidden>
        <label>
          Markdown
          <textarea id="vos-dm-lore-markdown" spellcheck="false"></textarea>
        </label>
        <label>
          Image Prompt
          <textarea id="vos-dm-lore-image-prompt"></textarea>
        </label>
        <div class="vos-dm-actions">
          <button id="vos-dm-lore-redraft" type="button">Regenerate</button>
          <button class="vos-dm-button" id="vos-dm-lore-save" type="button">Save</button>
          <button class="vos-dm-button is-danger" id="vos-dm-lore-reject" type="button">Reject</button>
          <button id="vos-dm-lore-publish" type="submit">Publish</button>
        </div>
      </form>
    </div>
    <div class="vos-dm-status" id="vos-dm-lore-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-message-title">
    <h2 id="vos-dm-message-title">DM Message</h2>
    <form class="vos-dm-form" id="vos-dm-message-form">
      <label>
        Title
        <input id="vos-dm-message-heading" type="text" value="Message from the DM">
      </label>
      <label>
        Message
        <textarea id="vos-dm-message-body"></textarea>
      </label>
      <label>
        URL
        <input id="vos-dm-message-url" type="text" value="/">
      </label>
      <fieldset class="vos-dm-recipient-picker" id="vos-dm-message-recipients" data-recipient-picker>
        <legend>Recipients</legend>
        <label class="vos-dm-check">
          <input type="checkbox" data-all-recipients checked>
          <span>All players</span>
        </label>
        <div class="vos-dm-recipient-list" data-player-list></div>
      </fieldset>
      <div class="vos-dm-actions">
        <button id="vos-dm-message-send" type="submit">Post + Notify</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-message-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-history-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-history-title">Message History</h2>
      <div class="vos-dm-actions">
        <label class="vos-dm-toggle">
          <input id="vos-dm-show-deleted" type="checkbox">
          <span>Show deleted</span>
        </label>
        <button id="vos-dm-history-refresh" type="button">Refresh</button>
      </div>
    </div>
    <div class="vos-dm-history" id="vos-dm-history"></div>
    <div class="vos-dm-status" id="vos-dm-history-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-rsvp-title" data-event-id="{{ campaign.nextGathering.eventId }}">
    <h2 id="vos-dm-rsvp-title">RSVP Summary</h2>
    <div class="vos-dm-counts" aria-label="RSVP counts">
      <div class="vos-dm-count"><strong id="vos-rsvp-going">0</strong><span>Going</span></div>
      <div class="vos-dm-count"><strong id="vos-rsvp-maybe">0</strong><span>Maybe</span></div>
      <div class="vos-dm-count"><strong id="vos-rsvp-out">0</strong><span>Out</span></div>
    </div>
    <ul class="vos-dm-rsvps" id="vos-dm-rsvps"></ul>
    <div class="vos-dm-actions">
      <button id="vos-dm-rsvp-refresh" type="button">Refresh RSVPs</button>
    </div>
    <div class="vos-dm-status" id="vos-dm-rsvp-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-push-title">
    <h2 id="vos-dm-push-title">Test Push</h2>
    <form class="vos-dm-form" id="vos-dm-push-form">
      <label>
        Title
        <input id="vos-dm-title" type="text" value="Foglight">
      </label>
      <label>
        Message
        <textarea id="vos-dm-body">Test push from the DM page.</textarea>
      </label>
      <label>
        URL
        <input id="vos-dm-url" type="text" value="/">
      </label>
      <fieldset class="vos-dm-recipient-picker" id="vos-dm-push-recipients" data-recipient-picker>
        <legend>Recipients</legend>
        <label class="vos-dm-check">
          <input type="checkbox" data-all-recipients checked>
          <span>All players</span>
        </label>
        <div class="vos-dm-recipient-list" data-player-list></div>
      </fieldset>
      <div class="vos-dm-actions">
        <button id="vos-dm-send" type="submit">Send Test Push</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-status" role="status" aria-live="polite"></div>
  </section>
</div>

<script>
(function () {
  const TOKEN_KEY = 'vos.adminToken';
  const DEFAULT_PLAYERS = [
    'Caravel "Car" Asteri',
    'Kryton Novelli',
    'Lotan',
    'Noname',
    'Orabella',
    'Roxanya "Roxy"',
    'Valentro',
    'DM',
  ];

  const tokenEl = document.getElementById('vos-dm-token');
  const messageForm = document.getElementById('vos-dm-message-form');
  const messageTitleEl = document.getElementById('vos-dm-message-heading');
  const messageBodyEl = document.getElementById('vos-dm-message-body');
  const messageUrlEl = document.getElementById('vos-dm-message-url');
  const messageStatusEl = document.getElementById('vos-dm-message-status');
  const messageSendEl = document.getElementById('vos-dm-message-send');
  const historyEl = document.getElementById('vos-dm-history');
  const historyStatusEl = document.getElementById('vos-dm-history-status');
  const historyRefreshEl = document.getElementById('vos-dm-history-refresh');
  const showDeletedEl = document.getElementById('vos-dm-show-deleted');
  const rsvpPanel = document.querySelector('[data-event-id]');
  const rsvpRefreshEl = document.getElementById('vos-dm-rsvp-refresh');
  const rsvpStatusEl = document.getElementById('vos-dm-rsvp-status');
  const rsvpListEl = document.getElementById('vos-dm-rsvps');
  const rsvpGoingEl = document.getElementById('vos-rsvp-going');
  const rsvpMaybeEl = document.getElementById('vos-rsvp-maybe');
  const rsvpOutEl = document.getElementById('vos-rsvp-out');
  const form = document.getElementById('vos-dm-push-form');
  const titleEl = document.getElementById('vos-dm-title');
  const bodyEl = document.getElementById('vos-dm-body');
  const urlEl = document.getElementById('vos-dm-url');
  const statusEl = document.getElementById('vos-dm-status');
  const sendEl = document.getElementById('vos-dm-send');
  const recipientPickers = new Map();
  const loreListEl = document.getElementById('vos-dm-lore-list');
  const loreForm = document.getElementById('vos-dm-lore-form');
  const loreRefreshEl = document.getElementById('vos-dm-lore-refresh');
  const loreStatusEl = document.getElementById('vos-dm-lore-status');
  const loreTitleEl = document.getElementById('vos-dm-lore-entry-title');
  const loreSlugEl = document.getElementById('vos-dm-lore-slug');
  const loreSummaryEl = document.getElementById('vos-dm-lore-summary');
  const loreMarkdownEl = document.getElementById('vos-dm-lore-markdown');
  const loreImagePromptEl = document.getElementById('vos-dm-lore-image-prompt');
  const loreImageEl = document.getElementById('vos-dm-lore-image');
  const loreRedraftEl = document.getElementById('vos-dm-lore-redraft');
  const loreSaveEl = document.getElementById('vos-dm-lore-save');
  const loreRejectEl = document.getElementById('vos-dm-lore-reject');
  const lorePublishEl = document.getElementById('vos-dm-lore-publish');
  let selectedLoreId = null;
  let selectedLoreStatus = null;

  try {
    tokenEl.value = localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {}

  tokenEl.addEventListener('change', () => {
    try { localStorage.setItem(TOKEN_KEY, tokenEl.value.trim()); } catch (error) {}
  });

  function getToken(statusTarget) {
    const token = tokenEl.value.trim();
    if (!token) {
      setStatus(statusTarget, 'Enter the admin token.', true);
      tokenEl.focus();
      return null;
    }
    try { localStorage.setItem(TOKEN_KEY, token); } catch (error) {}
    return token;
  }

  function setStatus(target, text, isError) {
    if (!target) return;
    target.textContent = text || '';
    target.classList.toggle('is-error', !!isError);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  async function adminJson(url, token, options) {
    const headers = {
      'X-Admin-Token': token,
      ...(options && options.headers ? options.headers : {}),
    };
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function postJson(url, token, body) {
    return adminJson(url, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function loadPlayers() {
    try {
      const response = await fetch('/api/auth/config', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      return Array.isArray(data.players) && data.players.length ? data.players : DEFAULT_PLAYERS;
    } catch (error) {
      return DEFAULT_PLAYERS;
    }
  }

  function setupRecipientPicker(picker, players) {
    const all = picker.querySelector('[data-all-recipients]');
    const list = picker.querySelector('[data-player-list]');
    if (!all || !list) return null;

    players.forEach((name) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      const span = document.createElement('span');
      label.className = 'vos-dm-check';
      input.type = 'checkbox';
      input.value = name;
      span.textContent = name;
      label.append(input, span);
      list.appendChild(label);
    });

    const boxes = Array.from(list.querySelectorAll('input[type="checkbox"]'));

    function sync() {
      boxes.forEach((box) => {
        box.disabled = all.checked;
        if (all.checked) box.checked = false;
        box.closest('.vos-dm-check').classList.toggle('is-disabled', all.checked);
      });
    }

    all.addEventListener('change', sync);
    boxes.forEach((box) => {
      box.addEventListener('change', () => {
        if (box.checked) all.checked = false;
        sync();
      });
    });
    sync();

    return {
      getRecipients() {
        if (all.checked) return null;
        return boxes.filter((box) => box.checked).map((box) => box.value);
      },
      reset() {
        all.checked = true;
        boxes.forEach((box) => { box.checked = false; });
        sync();
      },
    };
  }

  async function initRecipientPickers() {
    const players = await loadPlayers();
    document.querySelectorAll('[data-recipient-picker]').forEach((picker) => {
      const state = setupRecipientPicker(picker, players);
      if (state) recipientPickers.set(picker.id, state);
    });
  }

  function recipientsFor(pickerId, statusTarget) {
    const picker = recipientPickers.get(pickerId);
    if (!picker) return null;
    const recipients = picker.getRecipients();
    if (recipients && !recipients.length) {
      setStatus(statusTarget, 'Choose at least one player or select All players.', true);
      return undefined;
    }
    return recipients;
  }

  function renderBadges(container, values) {
    values.forEach((value) => {
      const badge = document.createElement('span');
      badge.className = 'vos-dm-badge';
      badge.textContent = value;
      container.appendChild(badge);
    });
  }

  function renderHistory(messages) {
    historyEl.innerHTML = '';
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-dm-empty';
      empty.textContent = 'No DM messages yet.';
      historyEl.appendChild(empty);
      return;
    }

    messages.forEach((message) => {
      const article = document.createElement('article');
      const head = document.createElement('div');
      const title = document.createElement('h3');
      const actions = document.createElement('div');
      const body = document.createElement('p');
      const meta = document.createElement('div');
      const badges = document.createElement('div');
      const push = document.createElement('span');

      article.className = 'vos-dm-message';
      if (message.deleted_at) article.classList.add('is-deleted');
      head.className = 'vos-dm-message-head';
      title.className = 'vos-dm-message-title';
      actions.className = 'vos-dm-actions';
      body.className = 'vos-dm-message-body';
      meta.className = 'vos-dm-meta';
      badges.className = 'vos-dm-badges';

      title.textContent = message.title || 'DM Message';
      body.textContent = message.body || '';
      meta.textContent = `${formatDate(message.created_at)}${message.deleted_at ? ' · deleted' : ''}`;

      const targets = message.target_type === 'all'
        ? ['All players']
        : (Array.isArray(message.recipients) && message.recipients.length ? message.recipients : ['Selected players']);
      renderBadges(badges, targets);

      const summary = message.push || {};
      push.className = 'vos-dm-badge';
      push.textContent = `Push ${summary.sent || 0}/${summary.attempted || 0}`;
      badges.appendChild(push);

      if (!message.deleted_at) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'vos-dm-button is-danger';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteMessage(message.id));
        actions.appendChild(deleteButton);
      }

      head.append(title, actions);
      article.append(head, body, meta, badges);
      historyEl.appendChild(article);
    });
  }

  async function refreshMessages() {
    const token = getToken(historyStatusEl);
    if (!token) return;
    historyRefreshEl.disabled = true;
    setStatus(historyStatusEl, 'Loading...');
    try {
      const includeDeleted = showDeletedEl.checked ? '1' : '0';
      const data = await adminJson(`/api/admin/messages?limit=30&includeDeleted=${includeDeleted}`, token);
      renderHistory(data.messages || []);
      setStatus(historyStatusEl, 'Updated.');
    } catch (error) {
      setStatus(historyStatusEl, error.message, true);
    } finally {
      historyRefreshEl.disabled = false;
    }
  }

  async function deleteMessage(id) {
    const token = getToken(historyStatusEl);
    if (!token) return;
    if (!window.confirm('Delete this DM message from player views?')) return;
    setStatus(historyStatusEl, 'Deleting...');
    try {
      await adminJson(`/api/messages/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
      await refreshMessages();
      setStatus(historyStatusEl, 'Deleted.');
    } catch (error) {
      setStatus(historyStatusEl, error.message, true);
    }
  }

  function lorePayloadFromForm() {
    return {
      title: loreTitleEl.value.trim(),
      slug: loreSlugEl.value.trim(),
      summary: loreSummaryEl.value.trim(),
      markdown: loreMarkdownEl.value.trim(),
      image_prompt: loreImagePromptEl.value.trim(),
    };
  }

  function renderLoreList(submissions) {
    loreListEl.innerHTML = '';
    if (!submissions.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-dm-empty';
      empty.textContent = 'No lore submissions yet.';
      loreListEl.appendChild(empty);
      loreForm.hidden = true;
      selectedLoreId = null;
      selectedLoreStatus = null;
      return;
    }

    submissions.forEach((submission) => {
      const button = document.createElement('button');
      const title = document.createElement('span');
      const meta = document.createElement('span');
      button.type = 'button';
      button.className = 'vos-dm-submission-item';
      button.dataset.id = submission.id;
      if (submission.id === selectedLoreId) button.classList.add('is-selected');
      title.className = 'vos-dm-submission-title';
      meta.className = 'vos-dm-submission-meta';
      title.textContent = submission.title || 'Untitled';
      meta.textContent = `${submission.kindLabel || submission.kind} · ${submission.submitter} · ${submission.status}`;
      button.append(title, meta);
      button.addEventListener('click', () => selectLoreSubmission(submission.id));
      loreListEl.appendChild(button);
    });
  }

  function fillLoreForm(submission) {
    selectedLoreId = submission.id;
    selectedLoreStatus = submission.status || null;
    loreForm.hidden = false;
    loreTitleEl.value = submission.title || '';
    loreSlugEl.value = submission.slug || '';
    loreSummaryEl.value = submission.generated_summary || submission.short_description || '';
    loreMarkdownEl.value = submission.generated_markdown || '';
    loreImagePromptEl.value = submission.generated_image_prompt || '';
    if (submission.image_url) {
      loreImageEl.hidden = false;
      loreImageEl.src = `${submission.image_url}?v=${encodeURIComponent(submission.updated_at || Date.now())}`;
      loreImageEl.alt = submission.title || 'Draft image';
    } else {
      loreImageEl.hidden = true;
      loreImageEl.removeAttribute('src');
    }
    setStatus(loreStatusEl, submission.error_message || `Loaded ${submission.status}.`, !!submission.error_message);
  }

  async function refreshLoreSubmissions() {
    const token = getToken(loreStatusEl);
    if (!token) return;
    loreRefreshEl.disabled = true;
    setStatus(loreStatusEl, 'Loading...');
    try {
      const data = await adminJson('/api/admin/lore-submissions?limit=40', token);
      const submissions = data.submissions || [];
      renderLoreList(submissions);
      setStatus(loreStatusEl, 'Updated.');
      if (!selectedLoreId && submissions.length) {
        await selectLoreSubmission(submissions[0].id);
      } else if (selectedLoreId) {
        Array.from(loreListEl.querySelectorAll('.vos-dm-submission-item')).forEach((button) => {
          button.classList.toggle('is-selected', button.dataset.id === selectedLoreId);
        });
      }
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    } finally {
      loreRefreshEl.disabled = false;
    }
  }

  async function selectLoreSubmission(id) {
    const token = getToken(loreStatusEl);
    if (!token) return;
    selectedLoreId = id;
    setStatus(loreStatusEl, 'Loading draft...');
    try {
      const data = await adminJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}`, token);
      fillLoreForm(data.submission);
      Array.from(loreListEl.querySelectorAll('.vos-dm-submission-item')).forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.id === id);
      });
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    }
  }

  async function saveLoreSubmission() {
    if (!selectedLoreId) return;
    const token = getToken(loreStatusEl);
    if (!token) return;
    loreSaveEl.disabled = true;
    setStatus(loreStatusEl, 'Saving...');
    try {
      const data = await postJson(
        `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/save`,
        token,
        lorePayloadFromForm()
      );
      fillLoreForm(data.submission);
      await refreshLoreSubmissions();
      setStatus(loreStatusEl, 'Saved.');
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    } finally {
      loreSaveEl.disabled = false;
    }
  }

  async function redraftLoreSubmission() {
    if (!selectedLoreId) return;
    const token = getToken(loreStatusEl);
    if (!token) return;
    if (!window.confirm('Regenerate this draft? Current edits are replaced when the new draft finishes.')) return;
    loreRedraftEl.disabled = true;
    setStatus(loreStatusEl, 'Regenerating...');
    try {
      await postJson(`/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/draft`, token, {});
      await refreshLoreSubmissions();
      setStatus(loreStatusEl, 'Regeneration started.');
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    } finally {
      loreRedraftEl.disabled = false;
    }
  }

  async function rejectLoreSubmission() {
    if (!selectedLoreId) return;
    const token = getToken(loreStatusEl);
    if (!token) return;
    if (!window.confirm('Reject this submission?')) return;
    loreRejectEl.disabled = true;
    setStatus(loreStatusEl, 'Rejecting...');
    try {
      await postJson(`/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/reject`, token, {});
      await refreshLoreSubmissions();
      setStatus(loreStatusEl, 'Rejected.');
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    } finally {
      loreRejectEl.disabled = false;
    }
  }

  async function publishLoreSubmission(event) {
    event.preventDefault();
    if (!selectedLoreId) return;
    const token = getToken(loreStatusEl);
    if (!token) return;
    const confirmText = selectedLoreStatus === 'published'
      ? 'Republish and overwrite this wiki source file with the current draft?'
      : 'Publish this draft into the wiki source files?';
    if (!window.confirm(confirmText)) return;
    lorePublishEl.disabled = true;
    setStatus(loreStatusEl, 'Publishing...');
    try {
      const payload = lorePayloadFromForm();
      if (selectedLoreStatus === 'published') {
        payload.overwrite = true;
      }
      const data = await postJson(
        `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/publish`,
        token,
        payload
      );
      await refreshLoreSubmissions();
      const steps = (data.next_steps || []).join(' then ');
      setStatus(loreStatusEl, `Published: ${data.url}. Rebuild next: ${steps}`);
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    } finally {
      lorePublishEl.disabled = false;
    }
  }

  messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = getToken(messageStatusEl);
    if (!token) return;
    const recipients = recipientsFor('vos-dm-message-recipients', messageStatusEl);
    if (recipients === undefined) return;

    messageSendEl.disabled = true;
    setStatus(messageStatusEl, 'Posting...');

    try {
      const data = await postJson('/api/messages', token, {
        title: messageTitleEl.value.trim(),
        body: messageBodyEl.value.trim(),
        url: messageUrlEl.value.trim() || '/',
        recipients,
      });
      const push = data.push || {};
      setStatus(messageStatusEl, `Posted. Push sent ${push.sent || 0} of ${push.attempted || 0}.`);
      messageBodyEl.value = '';
      await refreshMessages();
    } catch (error) {
      setStatus(messageStatusEl, error.message, true);
    } finally {
      messageSendEl.disabled = false;
    }
  });

  async function refreshRsvps() {
    const token = getToken(rsvpStatusEl);
    if (!token) return;
    const eventId = rsvpPanel.getAttribute('data-event-id');
    if (!eventId) {
      setStatus(rsvpStatusEl, 'No event id is set for the next gathering.', true);
      return;
    }

    rsvpRefreshEl.disabled = true;
    setStatus(rsvpStatusEl, 'Loading...');

    try {
      const response = await fetch(`/api/rsvp?eventId=${encodeURIComponent(eventId)}`, {
        headers: { 'X-Admin-Token': token },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const counts = data.counts || {};
      rsvpGoingEl.textContent = counts.going || 0;
      rsvpMaybeEl.textContent = counts.maybe || 0;
      rsvpOutEl.textContent = counts.out || 0;

      rsvpListEl.innerHTML = '';
      (data.responses || []).forEach((item) => {
        const li = document.createElement('li');
        const name = document.createElement('strong');
        const status = document.createElement('span');
        name.textContent = item.player_name;
        status.textContent = item.status;
        li.append(name, status);
        rsvpListEl.appendChild(li);
      });
      if (!rsvpListEl.children.length) {
        const li = document.createElement('li');
        li.textContent = 'No RSVPs yet.';
        rsvpListEl.appendChild(li);
      }
      setStatus(rsvpStatusEl, 'Updated.');
    } catch (error) {
      setStatus(rsvpStatusEl, error.message, true);
    } finally {
      rsvpRefreshEl.disabled = false;
    }
  }

  rsvpRefreshEl.addEventListener('click', refreshRsvps);
  historyRefreshEl.addEventListener('click', refreshMessages);
  showDeletedEl.addEventListener('change', refreshMessages);
  loreRefreshEl.addEventListener('click', refreshLoreSubmissions);
  loreSaveEl.addEventListener('click', saveLoreSubmission);
  loreRedraftEl.addEventListener('click', redraftLoreSubmission);
  loreRejectEl.addEventListener('click', rejectLoreSubmission);
  loreForm.addEventListener('submit', publishLoreSubmission);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = getToken(statusEl);
    if (!token) return;
    const recipients = recipientsFor('vos-dm-push-recipients', statusEl);
    if (recipients === undefined) return;

    sendEl.disabled = true;
    setStatus(statusEl, 'Sending...');

    try {
      const data = await postJson('/api/push/send', token, {
        title: titleEl.value.trim(),
        body: bodyEl.value.trim(),
        url: urlEl.value.trim() || '/',
        recipients,
      });
      setStatus(statusEl, `Sent ${data.sent} of ${data.attempted}. Pruned ${data.pruned}.`);
    } catch (error) {
      setStatus(statusEl, error.message, true);
    } finally {
      sendEl.disabled = false;
    }
  });

  initRecipientPickers().then(() => {
    if (tokenEl.value.trim()) {
      refreshLoreSubmissions();
      refreshMessages();
      refreshRsvps();
    }
  });
})();
</script>
