/* /messages/ — the inbox, for everyone including the DM.
 *
 * A thread list (DM pinned first for players, then the other players, then
 * the party channel) with unread counts, and a thread view with a sticky
 * composer. Sends are optimistic: the bubble appears immediately, and a
 * failed send stays visible with a tap-to-retry instead of vanishing.
 * A 15-second poll runs only while the tab is visible and a thread is open;
 * the thread list refreshes on focus. DM announcements (the broadcast
 * system) keep their own stripe at the top — different thing, different
 * shape: announcements are one-way and dismissible, threads are talk.
 */
import { authHeaders, escapeHtml, getJson, whenPwaReady } from '../shared/pwa.js';

const statusEl = document.getElementById('vos-messages-page-status');
const announceRootEl = document.getElementById('vos-im-announcements');
const announceListEl = document.getElementById('vos-messages-page-list');
const threadsEl = document.getElementById('vos-im-threads');
const threadViewEl = document.getElementById('vos-im-thread');
const threadTitleEl = document.getElementById('vos-im-thread-title');
const messagesEl = document.getElementById('vos-im-messages');
const composerEl = document.getElementById('vos-im-composer');
const inputEl = document.getElementById('vos-im-input');
const backEl = document.getElementById('vos-im-back');
const muteEl = document.getElementById('vos-im-mute');

const POLL_MS = 15000;
// A finger, not a pointer: Enter makes a newline, the Send button sends,
// and nothing auto-focuses the composer (that would pop the keyboard over
// the conversation you came to read).
const COARSE_POINTER = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

let playerName = null;
let threads = [];
let openKey = null;
let openMuted = false;
let lastId = 0;
let pollTimer = null;
let pendingSeq = 0;

function setStatus(text, isError) {
  if (!statusEl) return;
  statusEl.textContent = text || '';
  statusEl.classList.toggle('is-error', !!isError);
}

function renderMarkdown(value) {
  const renderer = window.VOS_RENDER_MARKDOWN || (window.VOS_PWA && window.VOS_PWA.renderSafeMarkdown);
  if (renderer) return renderer(value || '');
  return escapeHtml(value).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

// ── Announcements stripe (the one-way broadcast system) ────────────────

async function loadAnnouncements() {
  try {
    const data = await getJson(`/api/messages?limit=5&name=${encodeURIComponent(playerName)}`);
    const messages = Array.isArray(data.messages) ? data.messages : [];
    announceListEl.innerHTML = '';
    if (!messages.length) {
      announceRootEl.hidden = true;
      return;
    }
    announceRootEl.hidden = false;
    messages.forEach((message) => {
      const row = document.createElement('article');
      row.className = 'vos-message-entry';
      const head = document.createElement('div');
      head.className = 'vos-message-entry-head';
      const title = document.createElement('span');
      title.className = 'vos-message-entry-title';
      title.textContent = message.title || 'DM Message';
      const date = document.createElement('span');
      date.className = 'vos-message-entry-date';
      date.textContent = formatDate(message.created_at);
      head.append(title, date);
      const body = document.createElement('div');
      body.className = 'vos-message-entry-body vos-safe-markdown';
      body.innerHTML = renderMarkdown(message.body || '');
      row.append(head, body);
      announceListEl.appendChild(row);
    });
  } catch (error) {
    announceRootEl.hidden = true;
  }
}

// ── Thread list ────────────────────────────────────────────────────────

async function loadThreads() {
  const data = await getJson('/api/im/threads');
  threads = data.threads || [];
  renderThreads();
  return threads;
}

function renderThreads() {
  threadsEl.innerHTML = '';
  threads.forEach((thread) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'vos-im-thread-row';
    if (thread.key === openKey) row.classList.add('is-open');
    const label = document.createElement('span');
    label.className = 'vos-im-thread-label';
    label.textContent = thread.label;
    row.appendChild(label);
    if (thread.last) {
      const preview = document.createElement('span');
      preview.className = 'vos-im-thread-preview';
      preview.textContent = thread.last.deleted
        ? 'Message removed'
        : `${thread.last.sender === playerName ? 'You: ' : ''}${thread.last.body}`;
      row.appendChild(preview);
    }
    const side = document.createElement('span');
    side.className = 'vos-im-thread-side';
    if (thread.muted) {
      const muted = document.createElement('span');
      muted.className = 'vos-im-muted-mark';
      muted.textContent = '🔕';
      side.appendChild(muted);
    }
    if (thread.unread) {
      const badge = document.createElement('span');
      badge.className = 'vos-im-unread';
      badge.textContent = String(thread.unread);
      side.appendChild(badge);
    }
    row.appendChild(side);
    row.addEventListener('click', () => openThread(thread.key));
    threadsEl.appendChild(row);
  });
}

// ── Thread view ────────────────────────────────────────────────────────

function messageBubble(message) {
  const bubble = document.createElement('div');
  bubble.className = 'vos-im-bubble';
  bubble.dataset.id = String(message.id);
  const mine = message.sender === playerName;
  bubble.classList.toggle('is-mine', mine);
  if (message.deleted) {
    bubble.classList.add('is-deleted');
    bubble.textContent = 'Message removed';
    return bubble;
  }
  if (openKey === 'party' && !mine) {
    const who = document.createElement('div');
    who.className = 'vos-im-bubble-sender';
    who.textContent = message.sender;
    bubble.appendChild(who);
  }
  const body = document.createElement('div');
  body.className = 'vos-im-bubble-body vos-safe-markdown';
  body.innerHTML = renderMarkdown(message.body || '');
  bubble.appendChild(body);
  const meta = document.createElement('div');
  meta.className = 'vos-im-bubble-meta';
  meta.textContent = formatDate(message.created_at);
  bubble.appendChild(meta);
  if (mine) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'vos-im-bubble-delete';
    remove.setAttribute('aria-label', 'Delete this message');
    remove.textContent = '×';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this message for everyone?')) return;
      try {
        await fetch(`/api/im/message/${message.id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        bubble.classList.add('is-deleted');
        bubble.textContent = 'Message removed';
      } catch (error) {
        setStatus('Could not delete the message.', true);
      }
    });
    bubble.appendChild(remove);
  }
  return bubble;
}

function scrollToLatest() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function markRead() {
  if (!openKey || !lastId) return;
  try {
    await postJson('/api/im/read', { threadKey: openKey, lastReadId: lastId });
    const thread = threads.find((t) => t.key === openKey);
    if (thread) thread.unread = 0;
    renderThreads();
    window.dispatchEvent(new CustomEvent('vos:im-read'));
  } catch (error) { /* unread badge catches up next refresh */ }
}

async function fetchNew() {
  if (!openKey) return;
  const key = openKey;
  const data = await getJson(
    `/api/im/thread/${encodeURIComponent(key)}?after=${lastId}`
  );
  if (openKey !== key) return; // switched threads mid-flight
  const messages = data.messages || [];
  if (!messages.length) return;
  messages.forEach((message) => {
    const existing = messagesEl.querySelector(`[data-id="${message.id}"]`);
    if (existing) {
      existing.replaceWith(messageBubble(message));
      return;
    }
    messagesEl.appendChild(messageBubble(message));
    if (message.id > lastId) lastId = message.id;
  });
  scrollToLatest();
  markRead();
}

async function openThread(key) {
  openKey = key;
  lastId = 0;
  const thread = threads.find((t) => t.key === key);
  openMuted = !!(thread && thread.muted);
  threadTitleEl.textContent = thread ? thread.label : key;
  muteEl.textContent = openMuted ? 'Unmute' : 'Mute';
  muteEl.setAttribute('aria-pressed', openMuted ? 'true' : 'false');
  messagesEl.innerHTML = '';
  threadViewEl.hidden = false;
  document.body.classList.add('vos-im-thread-open');
  renderThreads();
  try {
    await fetchNew();
    if (!messagesEl.children.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-im-empty';
      empty.textContent = key === 'party'
        ? 'The party channel is quiet. Break the silence.'
        : 'No messages yet — say something.';
      messagesEl.appendChild(empty);
    }
    setStatus('');
  } catch (error) {
    setStatus(error.message, true);
  }
  schedulePoll();
  if (!COARSE_POINTER) inputEl.focus();
}

function closeThread() {
  openKey = null;
  threadViewEl.hidden = true;
  document.body.classList.remove('vos-im-thread-open');
  if (pollTimer) window.clearTimeout(pollTimer);
  renderThreads();
  loadThreads().catch(() => {});
}

function schedulePoll() {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(async () => {
    if (document.visibilityState === 'visible' && openKey) {
      try { await fetchNew(); } catch (error) { /* retry next tick */ }
    }
    if (openKey) schedulePoll();
  }, POLL_MS);
}

// ── Optimistic send ────────────────────────────────────────────────────

function pendingBubble(text) {
  const bubble = document.createElement('div');
  bubble.className = 'vos-im-bubble is-mine is-pending';
  bubble.dataset.pending = String(++pendingSeq);
  const body = document.createElement('div');
  body.className = 'vos-im-bubble-body';
  body.textContent = text;
  const meta = document.createElement('div');
  meta.className = 'vos-im-bubble-meta';
  meta.textContent = 'Sending…';
  bubble.append(body, meta);
  return bubble;
}

async function deliver(bubble, key, text) {
  try {
    const data = await postJson(`/api/im/thread/${encodeURIComponent(key)}`, { body: text });
    const message = data.message;
    if (message.id > lastId) lastId = message.id;
    if (openKey === key) {
      bubble.replaceWith(messageBubble(message));
      scrollToLatest();
      markRead();
    }
  } catch (error) {
    bubble.classList.add('is-failed');
    const meta = bubble.querySelector('.vos-im-bubble-meta');
    meta.textContent = `Failed: ${error.message} — tap to retry`;
    bubble.addEventListener('click', function retry() {
      bubble.removeEventListener('click', retry);
      bubble.classList.remove('is-failed');
      meta.textContent = 'Sending…';
      deliver(bubble, key, text);
    }, { once: true });
  }
}

composerEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text || !openKey) return;
  const empty = messagesEl.querySelector('.vos-im-empty');
  if (empty) empty.remove();
  const bubble = pendingBubble(text);
  messagesEl.appendChild(bubble);
  scrollToLatest();
  inputEl.value = '';
  autogrow();
  deliver(bubble, openKey, text);
});

inputEl.addEventListener('keydown', (event) => {
  if (COARSE_POINTER) return; // Enter is a newline on touch keyboards
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composerEl.requestSubmit();
  }
});

// Autogrow up to the CSS max-height — a resize handle is useless on touch.
function autogrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 144)}px`;
}
inputEl.addEventListener('input', autogrow);

// When the software keyboard opens (or the visual viewport resizes under
// it), keep the newest message in view.
inputEl.addEventListener('focus', () => {
  window.setTimeout(scrollToLatest, 250);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (openKey) scrollToLatest();
  });
}

backEl.addEventListener('click', closeThread);

muteEl.addEventListener('click', async () => {
  if (!openKey) return;
  try {
    const data = await postJson('/api/im/mute', { threadKey: openKey, muted: !openMuted });
    openMuted = !!data.muted;
    muteEl.textContent = openMuted ? 'Unmute' : 'Mute';
    muteEl.setAttribute('aria-pressed', openMuted ? 'true' : 'false');
    const thread = threads.find((t) => t.key === openKey);
    if (thread) thread.muted = openMuted;
    renderThreads();
  } catch (error) {
    setStatus(error.message, true);
  }
});

// ── Boot ───────────────────────────────────────────────────────────────

async function boot() {
  const pwa = await whenPwaReady();
  playerName = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity().catch(() => null) : null;
  if (!playerName) {
    setStatus('Sign in to see your messages.', true);
    return;
  }
  setStatus('Loading…');
  try {
    await Promise.all([loadThreads(), loadAnnouncements()]);
    setStatus('');
  } catch (error) {
    setStatus(error.message, true);
    return;
  }
  // A push tap deep-links to /messages/#<thread key>.
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hash && threads.some((t) => t.key === hash)) openThread(hash);
}

window.addEventListener('focus', () => {
  if (playerName) loadThreads().catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && openKey) {
    fetchNew().catch(() => {});
  }
});

boot();
