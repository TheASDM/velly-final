import { formatDate, historyEl, historyStatusEl, messageBodyEl, messageForm, messageNotifyOnlyEl, messagePreviewBodyEl, messagePreviewEl, messagePreviewMetaEl, messagePreviewTitleEl, messagePreviewToggleEl, messageSendEl, messageStatusEl, messageTitleEl, messageUrlEl, recipientPickers, setStatus, showDeletedEl } from './dom.js';
import { adminJson, deleteJson, postJson, withPanel } from './http.js';
import { confirmSheet } from './confirm.js';
import { playerNames } from './roster.js';
import { renderMarkdown } from './wiki.js';

let rosterCache = [];

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
  rosterCache = await playerNames();
  document.querySelectorAll('[data-recipient-picker]').forEach((picker) => {
    const state = setupRecipientPicker(picker, rosterCache);
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

/* After a successful send, the audience must not leak into the next
 * message — an un-reset picker sent the next broadcast to the previous
 * message's recipients. */
export function resetRecipients(pickerId) {
  const picker = recipientPickers.get(pickerId);
  if (picker) picker.reset();
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
      ? rosterCache
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

export function refreshMessages() {
  return withPanel(historyStatusEl, null, async () => {
    if (!rosterCache.length) rosterCache = await playerNames();
    const includeDeleted = showDeletedEl.checked ? '1' : '0';
    const data = await adminJson(`/api/admin/messages?limit=30&includeDeleted=${includeDeleted}`);
    renderHistory(data.messages || []);
    setStatus(historyStatusEl, 'Updated.');
  });
}

export async function deleteMessage(id) {
  if (!(await confirmSheet('Delete this DM message from player views?', { confirmLabel: 'Delete', danger: true }))) return null;
  return withPanel(historyStatusEl, null, async () => {
    await deleteJson(`/api/admin/messages/${encodeURIComponent(id)}`);
    await refreshMessages();
    setStatus(historyStatusEl, 'Deleted.');
  }, { loading: 'Deleting…' });
}

messageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const recipients = recipientsFor('vos-dm-message-recipients', messageStatusEl);
  if (recipients === undefined) return;
  const notifyOnly = !!(messageNotifyOnlyEl && messageNotifyOnlyEl.checked);
  const payload = {
    title: messageTitleEl.value.trim(),
    body: messageBodyEl.value.trim(),
    url: messageUrlEl.value.trim() || '/',
    recipients,
  };
  await withPanel(messageStatusEl, messageSendEl, async () => {
    if (notifyOnly) {
      // A push alert with no in-app message card.
      const data = await postJson('/api/push/send', payload);
      resetRecipients('vos-dm-message-recipients');
      setStatus(messageStatusEl, `Notified ${data.sent} of ${data.attempted}. Pruned ${data.pruned}.`);
      return;
    }
    const data = await postJson('/api/messages', payload);
    const push = data.push || {};
    const pushNote = push.skipped
      ? 'Push skipped (not configured).'
      : `Push sent ${push.sent || 0} of ${push.attempted || 0}.`;
    messageBodyEl.value = '';
    resetRecipients('vos-dm-message-recipients');
    await refreshMessages();
    // After the refresh, so its own "Updated." can't swallow the result.
    setStatus(messageStatusEl, `Posted. ${pushNote}`);
  }, { loading: notifyOnly ? 'Notifying…' : 'Posting…' });
});


/* ── Preview ──────────────────────────────────────────────────────────
 *
 * Markdown you cannot see rendered is markdown you find out about after the
 * whole table has read it. This draws the announcement through the same
 * renderer Home uses (window.VOS_RENDER_MARKDOWN, via renderMarkdown) into
 * the same .vos-message-item / .vos-message-body.vos-safe-markdown classes
 * the card on Home is built from — so what appears here is not a rendering
 * of the same text, it is the same rendering.
 *
 * Empty is worth showing rather than hiding: an announcement whose body did
 * not survive the round trip should look empty here too.
 */
export function renderMessagePreview() {
  if (!messagePreviewEl) return;
  const title = (messageTitleEl && messageTitleEl.value.trim()) || 'News from the DM';
  const body = (messageBodyEl && messageBodyEl.value) || '';
  if (messagePreviewTitleEl) messagePreviewTitleEl.textContent = title;
  if (messagePreviewBodyEl) {
    messagePreviewBodyEl.innerHTML = body.trim()
      ? renderMarkdown(body)
      : '<p class="vos-dm-preview-empty">Nothing written yet.</p>';
  }
  if (messagePreviewMetaEl) messagePreviewMetaEl.textContent = formatDate(new Date().toISOString());
}

export function initMessagePreview() {
  if (!messagePreviewToggleEl || !messagePreviewEl) return;

  const setOpen = (open) => {
    messagePreviewEl.hidden = !open;
    messagePreviewToggleEl.setAttribute('aria-expanded', String(open));
    messagePreviewToggleEl.textContent = open ? 'Hide preview' : 'Preview';
    if (open) renderMessagePreview();
  };

  messagePreviewToggleEl.addEventListener('click', () => {
    setOpen(messagePreviewEl.hidden);
  });

  // Live while it is open: the point is to watch the markup resolve as you
  // type, not to keep pressing a button to ask.
  const onEdit = () => { if (!messagePreviewEl.hidden) renderMessagePreview(); };
  if (messageBodyEl) messageBodyEl.addEventListener('input', onEdit);
  if (messageTitleEl) messageTitleEl.addEventListener('input', onEdit);
}
