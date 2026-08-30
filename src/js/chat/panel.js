/* The chat component: thread list, conversation, composer.
 *
 * One implementation, two mounts — the app-bar overlay on every page, and
 * /messages/ full-page as the cold-start target for a push tap. Nothing
 * here knows which; `mode` only decides whether a close button is drawn.
 *
 * Sends are optimistic: the bubble appears immediately and a failed send
 * stays visible with tap-to-retry instead of vanishing. A poll runs only
 * while the panel is active, the tab is visible and a thread is open.
 */
import { escapeHtml, whenPwaReady } from '../shared/pwa.js';
import {
  deleteMessage, dismissAnnouncement, fetchAnnouncements, fetchMessages,
  fetchThreads, markThreadRead, sendMessage, setThreadMuted,
} from './api.js';
import { getDraft, getOpenKey, getScrollTop, setDraft, setOpenKey, setScrollTop } from './state.js';

const POLL_MS = 15000;
const ANNOUNCEMENTS_KEY = '@announcements';
const PUSH_ASKED_KEY = 'vos:chat:push-asked';
// A finger, not a pointer: Enter makes a newline on touch, the Send button
// sends, and nothing auto-focuses the composer there.
const COARSE_POINTER = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderMarkdown(value) {
  const renderer = window.VOS_RENDER_MARKDOWN
    || (window.VOS_PWA && window.VOS_PWA.renderSafeMarkdown);
  if (renderer) return renderer(value || '');
  return escapeHtml(value).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

/* The roster's short name — "Car", "Roxy", "Valen". A thread row is a
 * label, a preview and a count on one line at 390px; the full
 * `Caravel "Car" Asteri` eats the whole row. Non-roster labels (the party
 * channel) fall through unchanged. */
function displayName(name) {
  const pwa = window.VOS_PWA;
  if (pwa && pwa.getProfileDisplayName) return pwa.getProfileDisplayName(name) || name;
  return name;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* Ask for notification permission the first time you send — at sign-in it
 * is a demand from a stranger, here it is obviously about this message. */
async function maybeAskForPush() {
  try {
    if (window.localStorage.getItem(PUSH_ASKED_KEY) === '1') return;
    const pwa = window.VOS_PWA;
    if (!pwa || !pwa.getPushStatus || !pwa.enablePush) return;
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    if (await pwa.getPushStatus() !== 'disabled') return;
    window.localStorage.setItem(PUSH_ASKED_KEY, '1');
    await pwa.enablePush();
  } catch (error) { /* declining is an answer */ }
}

export function createChatPanel(options) {
  const mode = (options && options.mode) || 'overlay';
  const onUnreadChange = (options && options.onUnreadChange) || (() => {});
  const onCloseRequest = (options && options.onCloseRequest) || (() => {});

  let playerName = null;
  let threads = [];
  let announcements = [];
  let openKey = null;
  let openMuted = false;
  let lastId = 0;
  let pollTimer = null;
  let pendingSeq = 0;
  let active = mode === 'page';
  let booted = false;

  // ── Shell ────────────────────────────────────────────────────────────
  const root = el('div', `vos-chat vos-chat--${mode}`);
  root.innerHTML = `
    <div class="vos-chat-panel" role="dialog" aria-label="Chat">
      <header class="vos-chat-head">
        <button type="button" class="vos-chat-back" aria-label="Back to conversations" hidden>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h2 class="vos-chat-title">Chat</h2>
        <div class="vos-chat-head-actions">
          <button type="button" class="vos-chat-mute" aria-pressed="false" hidden>Mute</button>
          ${mode === 'overlay' ? '<button type="button" class="vos-chat-close" aria-label="Close chat"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' : ''}
        </div>
      </header>
      <div class="vos-chat-body">
        <div class="vos-chat-list" aria-label="Conversations"></div>
        <section class="vos-chat-thread" aria-label="Conversation">
          <div class="vos-chat-messages" aria-live="polite"></div>
          <p class="vos-chat-placeholder">Pick a conversation.</p>
          <form class="vos-chat-composer" hidden>
            <textarea class="vos-chat-input" rows="1" maxlength="4000"
                      placeholder="Write a message…" aria-label="Message"></textarea>
            <button type="submit" class="vos-chat-send">Send</button>
          </form>
        </section>
      </div>
      <p class="vos-chat-status" role="status" aria-live="polite"></p>
    </div>
  `;

  const panelEl = root.querySelector('.vos-chat-panel');
  const backEl = root.querySelector('.vos-chat-back');
  const titleEl = root.querySelector('.vos-chat-title');
  const muteEl = root.querySelector('.vos-chat-mute');
  const closeEl = root.querySelector('.vos-chat-close');
  const listEl = root.querySelector('.vos-chat-list');
  const messagesEl = root.querySelector('.vos-chat-messages');
  const placeholderEl = root.querySelector('.vos-chat-placeholder');
  const composerEl = root.querySelector('.vos-chat-composer');
  const inputEl = root.querySelector('.vos-chat-input');
  const statusEl = root.querySelector('.vos-chat-status');

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function totalUnread() {
    return threads.reduce((sum, thread) => sum + (thread.unread || 0), 0);
  }

  // ── Thread list ──────────────────────────────────────────────────────

  function announcementRow() {
    const row = el('button', 'vos-chat-row vos-chat-row--pinned');
    row.type = 'button';
    if (openKey === ANNOUNCEMENTS_KEY) row.classList.add('is-open');
    row.append(el('span', 'vos-chat-row-label', 'From the DM'));
    const latest = announcements[0];
    row.append(el('span', 'vos-chat-row-preview', latest ? (latest.title || 'DM message') : ''));
    const side = el('span', 'vos-chat-row-side');
    side.append(el('span', 'vos-chat-count', String(announcements.length)));
    row.append(side);
    row.addEventListener('click', () => openThread(ANNOUNCEMENTS_KEY));
    return row;
  }

  function threadRow(thread) {
    const row = el('button', 'vos-chat-row');
    row.type = 'button';
    if (thread.key === openKey) row.classList.add('is-open');
    if (thread.unread) row.classList.add('is-unread');
    row.append(el('span', 'vos-chat-row-label', displayName(thread.label)));
    if (thread.last) {
      const preview = thread.last.deleted
        ? 'Message removed'
        : `${thread.last.sender === playerName ? 'You: ' : ''}${thread.last.body}`;
      row.append(el('span', 'vos-chat-row-preview', preview));
    } else {
      row.append(el('span', 'vos-chat-row-preview', ''));
    }
    const side = el('span', 'vos-chat-row-side');
    if (thread.muted) {
      const muted = el('span', 'vos-chat-row-muted', '🔕');
      muted.title = 'Muted';
      side.append(muted);
    }
    if (thread.unread) side.append(el('span', 'vos-chat-count', String(thread.unread)));
    row.append(side);
    row.addEventListener('click', () => openThread(thread.key));
    return row;
  }

  function renderList() {
    listEl.textContent = '';
    if (announcements.length) listEl.append(announcementRow());
    threads.forEach((thread) => listEl.append(threadRow(thread)));
    onUnreadChange(totalUnread());
  }

  async function loadThreads() {
    const data = await fetchThreads();
    threads = data.threads || [];
    renderList();
    return threads;
  }

  async function loadAnnouncements() {
    try {
      const data = await fetchAnnouncements(playerName);
      announcements = Array.isArray(data.messages) ? data.messages : [];
    } catch (error) {
      announcements = [];
    }
  }

  // ── Conversation ─────────────────────────────────────────────────────

  function messageBubble(message) {
    const bubble = el('div', 'vos-chat-bubble');
    bubble.dataset.id = String(message.id);
    const mine = message.sender === playerName;
    bubble.classList.toggle('is-mine', mine);
    if (message.deleted) {
      bubble.classList.add('is-deleted');
      bubble.textContent = 'Message removed';
      return bubble;
    }
    if (openKey === 'party' && !mine) {
      bubble.append(el('div', 'vos-chat-bubble-sender', displayName(message.sender)));
    }
    const body = el('div', 'vos-chat-bubble-body vos-safe-markdown');
    body.innerHTML = renderMarkdown(message.body || '');
    bubble.append(body);
    bubble.append(el('div', 'vos-chat-bubble-meta', formatDate(message.created_at)));
    if (mine) {
      const remove = el('button', 'vos-chat-bubble-delete', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Delete this message');
      remove.addEventListener('click', async () => {
        if (!window.confirm('Delete this message for everyone?')) return;
        try {
          await deleteMessage(message.id);
          bubble.classList.add('is-deleted');
          bubble.textContent = 'Message removed';
        } catch (error) {
          setStatus(error.message, true);
        }
      });
      bubble.append(remove);
    }
    return bubble;
  }

  function announcementCard(message) {
    const card = el('article', 'vos-chat-announcement');
    const head = el('div', 'vos-chat-announcement-head');
    head.append(el('span', 'vos-chat-announcement-title', message.title || 'DM message'));
    head.append(el('span', 'vos-chat-bubble-meta', formatDate(message.created_at)));
    const body = el('div', 'vos-chat-announcement-body vos-safe-markdown');
    body.innerHTML = renderMarkdown(message.body || '');
    const dismiss = el('button', 'vos-chat-bubble-delete', '×');
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', 'Dismiss this announcement');
    dismiss.addEventListener('click', async () => {
      try {
        await dismissAnnouncement(message.id);
        announcements = announcements.filter((entry) => entry.id !== message.id);
        card.remove();
        renderList();
        if (!announcements.length) closeThread();
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    card.append(head, body, dismiss);
    return card;
  }

  function scrollToLatest() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function markRead() {
    if (!openKey || openKey === ANNOUNCEMENTS_KEY || !lastId) return;
    try {
      await markThreadRead(openKey, lastId);
      const thread = threads.find((entry) => entry.key === openKey);
      if (thread) thread.unread = 0;
      renderList();
      window.dispatchEvent(new CustomEvent('vos:im-read'));
    } catch (error) { /* the badge catches up on the next refresh */ }
  }

  async function fetchNew() {
    if (!openKey || openKey === ANNOUNCEMENTS_KEY) return;
    const key = openKey;
    const data = await fetchMessages(key, lastId);
    if (openKey !== key) return; // switched threads mid-flight
    const messages = data.messages || [];
    if (!messages.length) return;
    const empty = messagesEl.querySelector('.vos-chat-empty');
    if (empty) empty.remove();
    messages.forEach((message) => {
      const existing = messagesEl.querySelector(`[data-id="${message.id}"]`);
      if (existing) {
        existing.replaceWith(messageBubble(message));
        return;
      }
      messagesEl.append(messageBubble(message));
      if (message.id > lastId) lastId = message.id;
    });
    scrollToLatest();
    markRead();
  }

  function schedulePoll() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(async () => {
      pollTimer = null;
      if (active && document.visibilityState === 'visible' && openKey) {
        try { await fetchNew(); } catch (error) { /* retry next tick */ }
      }
      if (openKey) schedulePoll();
    }, POLL_MS);
  }

  function showAnnouncements() {
    titleEl.textContent = 'From the DM';
    muteEl.hidden = true;
    composerEl.hidden = true;
    placeholderEl.hidden = true;
    messagesEl.textContent = '';
    messagesEl.classList.add('is-announcements');
    announcements.forEach((message) => messagesEl.append(announcementCard(message)));
    messagesEl.scrollTop = 0;
  }

  async function openThread(key) {
    if (openKey && openKey !== ANNOUNCEMENTS_KEY) {
      setScrollTop(openKey, messagesEl.scrollTop);
      setDraft(openKey, inputEl.value);
    }
    openKey = key;
    setOpenKey(key);
    panelEl.classList.add('is-thread-open');
    backEl.hidden = false;
    messagesEl.classList.remove('is-announcements');

    if (key === ANNOUNCEMENTS_KEY) {
      renderList();
      showAnnouncements();
      setStatus('');
      return;
    }

    lastId = 0;
    const thread = threads.find((entry) => entry.key === key);
    openMuted = !!(thread && thread.muted);
    titleEl.textContent = thread ? displayName(thread.label) : key;
    muteEl.hidden = false;
    muteEl.textContent = openMuted ? 'Unmute' : 'Mute';
    muteEl.setAttribute('aria-pressed', openMuted ? 'true' : 'false');
    composerEl.hidden = false;
    placeholderEl.hidden = true;
    messagesEl.textContent = '';
    inputEl.value = getDraft(key);
    autogrow();
    renderList();

    try {
      await fetchNew();
      if (!messagesEl.children.length) {
        messagesEl.append(el('p', 'vos-chat-empty', key === 'party'
          ? 'The party channel is quiet. Break the silence.'
          : 'No messages yet — say something.'));
      }
      const saved = getScrollTop(key);
      if (saved != null) messagesEl.scrollTop = saved;
      setStatus('');
    } catch (error) {
      setStatus(error.message, true);
    }
    schedulePoll();
    if (!COARSE_POINTER) inputEl.focus();
  }

  function closeThread() {
    if (openKey && openKey !== ANNOUNCEMENTS_KEY) {
      setScrollTop(openKey, messagesEl.scrollTop);
      setDraft(openKey, inputEl.value);
    }
    openKey = null;
    setOpenKey(null);
    panelEl.classList.remove('is-thread-open');
    backEl.hidden = true;
    muteEl.hidden = true;
    composerEl.hidden = true;
    placeholderEl.hidden = false;
    messagesEl.textContent = '';
    messagesEl.classList.remove('is-announcements');
    titleEl.textContent = 'Chat';
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = null;
    renderList();
    loadThreads().catch(() => {});
  }

  // ── Optimistic send ──────────────────────────────────────────────────

  function pendingBubble(text) {
    const bubble = el('div', 'vos-chat-bubble is-mine is-pending');
    bubble.dataset.pending = String(++pendingSeq);
    const body = el('div', 'vos-chat-bubble-body', text);
    bubble.append(body, el('div', 'vos-chat-bubble-meta', 'Sending…'));
    return bubble;
  }

  async function deliver(bubble, key, text) {
    try {
      const data = await sendMessage(key, text);
      const message = data.message;
      if (message.id > lastId) lastId = message.id;
      if (openKey === key) {
        bubble.replaceWith(messageBubble(message));
        scrollToLatest();
        markRead();
      }
      maybeAskForPush();
    } catch (error) {
      bubble.classList.add('is-failed');
      const meta = bubble.querySelector('.vos-chat-bubble-meta');
      meta.textContent = `Failed: ${error.message} — tap to retry`;
      bubble.addEventListener('click', function retry() {
        bubble.classList.remove('is-failed');
        meta.textContent = 'Sending…';
        deliver(bubble, key, text);
      }, { once: true });
    }
  }

  function autogrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 144)}px`;
  }

  composerEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = inputEl.value.trim();
    if (!text || !openKey || openKey === ANNOUNCEMENTS_KEY) return;
    const empty = messagesEl.querySelector('.vos-chat-empty');
    if (empty) empty.remove();
    const bubble = pendingBubble(text);
    messagesEl.append(bubble);
    scrollToLatest();
    inputEl.value = '';
    setDraft(openKey, '');
    autogrow();
    deliver(bubble, openKey, text);
  });

  inputEl.addEventListener('input', () => {
    autogrow();
    if (openKey) setDraft(openKey, inputEl.value);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (COARSE_POINTER) return; // Enter is a newline on touch keyboards
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composerEl.requestSubmit();
    }
  });

  inputEl.addEventListener('focus', () => window.setTimeout(scrollToLatest, 250));

  backEl.addEventListener('click', closeThread);

  if (closeEl) closeEl.addEventListener('click', () => onCloseRequest());

  muteEl.addEventListener('click', async () => {
    if (!openKey || openKey === ANNOUNCEMENTS_KEY) return;
    try {
      const data = await setThreadMuted(openKey, !openMuted);
      openMuted = !!data.muted;
      muteEl.textContent = openMuted ? 'Unmute' : 'Mute';
      muteEl.setAttribute('aria-pressed', openMuted ? 'true' : 'false');
      const thread = threads.find((entry) => entry.key === openKey);
      if (thread) thread.muted = openMuted;
      renderList();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // ── Boot and lifecycle ───────────────────────────────────────────────

  async function boot() {
    if (booted) return playerName;
    booted = true;
    const pwa = await whenPwaReady();
    playerName = pwa && pwa.ensureIdentity
      ? await pwa.ensureIdentity().catch(() => null)
      : null;
    if (!playerName) {
      setStatus('Sign in to see your messages.', true);
      booted = false;
      return null;
    }
    setStatus('Loading…');
    try {
      await loadAnnouncements();
      await loadThreads();
      setStatus('');
    } catch (error) {
      setStatus(error.message, true);
    }
    return playerName;
  }

  return {
    root,
    boot,
    get playerName() { return playerName; },
    /* The panel only polls while it is on screen. */
    setActive(value) {
      active = !!value;
      if (active && openKey && openKey !== ANNOUNCEMENTS_KEY) {
        fetchNew().catch(() => {});
        schedulePoll();
      } else if (!active && pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    },
    async refresh() {
      if (!playerName) return;
      await loadAnnouncements();
      await loadThreads().catch(() => {});
      if (openKey && openKey !== ANNOUNCEMENTS_KEY) await fetchNew().catch(() => {});
    },
    openThread,
    closeThread,
    get openKey() { return openKey; },
    /* Reopen wherever the last page left off, if that thread still exists. */
    restore() {
      const key = getOpenKey();
      if (!key) return;
      if (key === ANNOUNCEMENTS_KEY ? announcements.length : threads.some((t) => t.key === key)) {
        openThread(key);
      } else {
        setOpenKey(null);
      }
    },
    hasThread(key) {
      return key === ANNOUNCEMENTS_KEY
        ? announcements.length > 0
        : threads.some((thread) => thread.key === key);
    },
    totalUnread,
  };
}

export { ANNOUNCEMENTS_KEY };
