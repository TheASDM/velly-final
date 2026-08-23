import { DEFAULT_PLAYERS, adminJson, formatDate, getToken, historyEl, historyRefreshEl, historyStatusEl, messageBodyEl, messageForm, messageSendEl, messageStatusEl, messageTitleEl, messageUrlEl, postJson, recipientPickers, setStatus, showDeletedEl } from './state.js';
import { renderMarkdown } from './wiki.js';

export async function loadPlayers() {
  try {
    const response = await fetch('/api/auth/config', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json();
    return Array.isArray(data.players) && data.players.length ? data.players : DEFAULT_PLAYERS;
  } catch (error) {
    return DEFAULT_PLAYERS;
  }
}

export function setupRecipientPicker(picker, players) {
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

export async function initRecipientPickers() {
  const players = await loadPlayers();
  document.querySelectorAll('[data-recipient-picker]').forEach((picker) => {
    const state = setupRecipientPicker(picker, players);
    if (state) recipientPickers.set(picker.id, state);
  });
}

export function recipientsFor(pickerId, statusTarget) {
  const picker = recipientPickers.get(pickerId);
  if (!picker) return null;
  const recipients = picker.getRecipients();
  if (recipients && !recipients.length) {
    setStatus(statusTarget, 'Choose at least one player or select All players.', true);
    return undefined;
  }
  return recipients;
}

export function renderBadges(container, values) {
  values.forEach((value) => {
    const badge = document.createElement('span');
    badge.className = 'vos-dm-badge';
    badge.textContent = value;
    container.appendChild(badge);
  });
}

export function renderHistory(messages) {
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
    const body = document.createElement('div');
    const meta = document.createElement('div');
    const badges = document.createElement('div');
    const push = document.createElement('span');

    article.className = 'vos-dm-message';
    if (message.deleted_at) article.classList.add('is-deleted');
    head.className = 'vos-dm-message-head';
    title.className = 'vos-dm-message-title';
    actions.className = 'vos-dm-actions';
    body.className = 'vos-dm-message-body vos-safe-markdown';
    meta.className = 'vos-dm-meta';
    badges.className = 'vos-dm-badges';

    title.textContent = message.title || 'DM Message';
    body.innerHTML = renderMarkdown(message.body || '');
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

    // Read receipts: dismissed the card in-app ("seen"), tapped the
    // push notification ("tapped"), or neither yet.
    const audience = message.target_type === 'all'
      ? DEFAULT_PLAYERS.filter((name) => name !== 'DM')
      : (Array.isArray(message.recipients) ? message.recipients : []);
    const seen = message.seenBy || [];
    const opened = message.openedBy || [];
    const noSignal = audience.filter(
      (name) => !seen.includes(name) && !opened.includes(name)
    );
    const parts = [];
    if (seen.length) parts.push('Seen in app: ' + seen.join(', '));
    if (opened.length) parts.push('Tapped push: ' + opened.join(', '));
    if (noSignal.length) parts.push('No sign yet: ' + noSignal.join(', '));
    if (parts.length) {
      const receipts = document.createElement('div');
      receipts.className = 'vos-dm-meta';
      receipts.textContent = parts.join(' · ');
      article.appendChild(receipts);
    }

    historyEl.appendChild(article);
  });
}

export async function refreshMessages() {
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

export async function deleteMessage(id) {
  const token = getToken(historyStatusEl);
  if (!token) return;
  if (!window.confirm('Delete this DM message from player views?')) return;
  setStatus(historyStatusEl, 'Deleting...');
  try {
    await adminJson(`/api/admin/messages/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
    await refreshMessages();
    setStatus(historyStatusEl, 'Deleted.');
  } catch (error) {
    setStatus(historyStatusEl, error.message, true);
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
