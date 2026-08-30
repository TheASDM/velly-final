/* The chat component: thread list, conversation, composer.
 *
 * One implementation, two mounts — the app-bar overlay on every page, and
 * /messages/ full-page as the cold-start target for a push tap. Nothing
 * here knows which; `mode` only decides whether a close button is drawn.
 *
 * Sends are optimistic: the bubble appears immediately and a failed send
 * stays visible with tap-to-retry instead of vanishing. One poll carries
 * everything an open thread needs — new messages, rewrites of ones it
 * already has, reactions, who is typing, who has read how far — and it
 * runs only while the panel is on screen, the tab is visible, and a thread
 * is open.
 */
import { escapeHtml, whenPwaReady } from '../shared/pwa.js';
import {
  deleteMessage, dismissAnnouncement, editMessage, fetchAnnouncements,
  fetchMessages, fetchThreads, markThreadRead, sendMessage, sendTyping,
  setReaction, setThreadMuted, streamToEnzo,
} from './api.js';
import { renderBubble } from './bubble.js';
import { ACCEPT, createAttachmentTray, wireFileIntake } from './attachments.js';
import { openImageViewer } from '../components/image-zoom.js';
import { getDraft, getOpenKey, getScrollTop, setDraft, setOpenKey, setScrollTop } from './state.js';

// Typing indicators only mean anything if the poll is faster than a
// sentence. Six players at 4s is ~90 requests a minute worst case, and it
// stops dead the moment the tab blurs or the thread closes.
const POLL_ACTIVE_MS = 4000;
const TYPING_HEARTBEAT_MS = 3000;
const PRESENCE_ONLINE_MS = 5 * 60 * 1000;
const EDIT_WINDOW_MS = 60 * 60 * 1000;
const ANNOUNCEMENTS_KEY = '@announcements';
const PUSH_ASKED_KEY = 'vos:chat:push-asked';
const EMPTY_COPY = {
  party: 'The party channel is quiet. Break the silence.',
  enzo: 'Ask Enzo about the valley, its people, or the rules.',
  direct: 'No messages yet — say something.',
};
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
 * channel, Enzo) fall through unchanged. */
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

function formatAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isOnline(lastSeenAt) {
  const date = new Date(lastSeenAt);
  return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() < PRESENCE_ONLINE_MS;
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
  let openKind = null;
  let openMuted = false;
  let lastId = 0;
  let since = '';
  let pollTimer = null;
  let pendingSeq = 0;
  let active = mode === 'page';
  let booted = false;

  // Per-thread depth, reset on every open.
  const messagesById = new Map();
  let reactions = {};
  let receipts = {};
  let presence = {};
  let typingNames = [];
  let replyTo = null;
  let editing = null;
  let lastTypingAt = 0;

  // ── Shell ────────────────────────────────────────────────────────────
  const root = el('div', `vos-chat vos-chat--${mode}`);
  root.innerHTML = `
    <div class="vos-chat-panel" role="dialog" aria-label="Chat">
      <header class="vos-chat-head">
        <button type="button" class="vos-chat-back" aria-label="Back to conversations" hidden>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h2 class="vos-chat-title">Chat</h2>
        <a class="vos-chat-title-link" href="/profile/" hidden>Profile</a>
        <span class="vos-chat-head-presence" hidden></span>
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
          <div class="vos-chat-typing-live" hidden></div>
          <form class="vos-chat-composer" hidden>
            <div class="vos-chat-context" hidden>
              <span class="vos-chat-context-label"></span>
              <span class="vos-chat-context-text"></span>
              <button type="button" class="vos-chat-context-cancel" aria-label="Cancel">×</button>
            </div>
            <div class="vos-chat-tray" hidden></div>
            <div class="vos-chat-composer-row">
              <button type="button" class="vos-chat-attach" aria-label="Attach a file" title="Attach a file">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.8 1.8 0 0 1-2.5-2.5l7.8-7.8"/></svg>
              </button>
              <input type="file" class="vos-chat-file-input" accept="${ACCEPT}" multiple hidden>
              <textarea class="vos-chat-input" rows="1" maxlength="4000"
                        placeholder="Write a message…" aria-label="Message"></textarea>
              <button type="submit" class="vos-chat-send">Send</button>
            </div>
          </form>
        </section>
      </div>
      <p class="vos-chat-status" role="status" aria-live="polite"></p>
    </div>
  `;

  const panelEl = root.querySelector('.vos-chat-panel');
  const backEl = root.querySelector('.vos-chat-back');
  const titleEl = root.querySelector('.vos-chat-title');
  const titleLinkEl = root.querySelector('.vos-chat-title-link');
  const headPresenceEl = root.querySelector('.vos-chat-head-presence');
  const muteEl = root.querySelector('.vos-chat-mute');
  const closeEl = root.querySelector('.vos-chat-close');
  const listEl = root.querySelector('.vos-chat-list');
  const messagesEl = root.querySelector('.vos-chat-messages');
  const placeholderEl = root.querySelector('.vos-chat-placeholder');
  const typingLiveEl = root.querySelector('.vos-chat-typing-live');
  const composerEl = root.querySelector('.vos-chat-composer');
  const contextEl = root.querySelector('.vos-chat-context');
  const contextLabelEl = root.querySelector('.vos-chat-context-label');
  const contextTextEl = root.querySelector('.vos-chat-context-text');
  const contextCancelEl = root.querySelector('.vos-chat-context-cancel');
  const trayEl = root.querySelector('.vos-chat-tray');
  const attachEl = root.querySelector('.vos-chat-attach');
  const fileInputEl = root.querySelector('.vos-chat-file-input');
  const threadPaneEl = root.querySelector('.vos-chat-thread');
  const inputEl = root.querySelector('.vos-chat-input');
  const sendEl = root.querySelector('.vos-chat-send');
  const statusEl = root.querySelector('.vos-chat-status');

  const tray = createAttachmentTray({
    trayEl,
    getThreadKey: () => openKey,
    onChange: () => {
      sendEl.disabled = tray.uploading;
      scrollToLatest();
    },
  });

  function canAttach() {
    return isTalkThread() && !editing;
  }

  attachEl.addEventListener('click', () => fileInputEl.click());
  fileInputEl.addEventListener('change', () => {
    tray.addFiles(fileInputEl.files);
    fileInputEl.value = '';
  });
  wireFileIntake(root, threadPaneEl, (files) => tray.addFiles(files), canAttach);

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function totalUnread() {
    return threads.reduce((sum, thread) => sum + (thread.unread || 0), 0);
  }

  function isTalkThread() {
    return !!openKey && openKey !== ANNOUNCEMENTS_KEY;
  }

  // ── Bubble context ───────────────────────────────────────────────────

  const bubbleContext = {
    get playerName() { return playerName; },
    displayName,
    renderMarkdown,
    formatDate,
    showSenders: () => openKind === 'party',
    profileHref: (name) => `/profile/?p=${encodeURIComponent(name)}`,
    getReactions: (id) => reactions[String(id)] || [],
    getMessage: (id) => messagesById.get(Number(id)) || null,
    canEdit: (message) => message.sender === playerName
      && Date.now() - new Date(message.created_at).getTime() < EDIT_WINDOW_MS,
    closeOtherActions: (except) => {
      messagesEl.querySelectorAll('.vos-chat-bubble.has-actions').forEach((node) => {
        if (node !== except && node.vosCloseActions) node.vosCloseActions();
      });
    },
    onReact: async (message, emoji, on) => {
      try {
        const data = await setReaction(message.id, emoji, on);
        reactions[String(message.id)] = data.reactions;
        redrawMessage(message.id);
      } catch (error) {
        setStatus(error.message, true);
      }
    },
    onReply: (message) => {
      editing = null;
      replyTo = message;
      renderContext();
      inputEl.focus();
    },
    onEdit: (message) => {
      replyTo = null;
      editing = message;
      inputEl.value = message.body || '';
      renderContext();
      autogrow();
      inputEl.focus();
    },
    onDelete: async (message) => {
      if (!window.confirm('Delete this message for everyone?')) return;
      try {
        await deleteMessage(message.id);
        const stored = messagesById.get(message.id);
        if (stored) messagesById.set(message.id, { ...stored, deleted: true, body: '' });
        redrawMessage(message.id);
      } catch (error) {
        setStatus(error.message, true);
      }
    },
    onOpenImage: (file) => openImageViewer(file.url, file.filename || ''),
    onJump: (id) => {
      const target = messagesEl.querySelector(`[data-id="${id}"]`);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.classList.add('is-highlit');
      window.setTimeout(() => target.classList.remove('is-highlit'), 1400);
    },
  };

  function messageBubble(message) {
    messagesById.set(message.id, message);
    return renderBubble(message, bubbleContext);
  }

  function redrawMessage(id) {
    const existing = messagesEl.querySelector(`[data-id="${id}"]`);
    const message = messagesById.get(Number(id));
    if (!existing || !message) return;
    existing.replaceWith(messageBubble(message));
    renderReceipts();
  }

  // ── Thread list ──────────────────────────────────────────────────────

  function presenceDot(name) {
    const seen = presence[name];
    if (!seen) return null;
    const dot = el('span', `vos-chat-presence${isOnline(seen) ? ' is-online' : ''}`);
    dot.title = isOnline(seen) ? 'Online now' : `Last seen ${formatAgo(seen)}`;
    dot.setAttribute('aria-label', dot.title);
    return dot;
  }

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
    const label = el('span', 'vos-chat-row-label');
    if (thread.kind === 'direct') {
      const dot = presenceDot(thread.label);
      if (dot) label.append(dot);
    }
    label.append(el('span', null, displayName(thread.label)));
    row.append(label);
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
    presence = { ...presence, ...(data.presence || {}) };
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

  function announcementCard(message) {
    const card = el('article', 'vos-chat-announcement');
    const head = el('div', 'vos-chat-announcement-head');
    head.append(el('span', 'vos-chat-announcement-title', message.title || 'DM message'));
    head.append(el('span', 'vos-chat-bubble-meta', formatDate(message.created_at)));
    const body = el('div', 'vos-chat-announcement-body vos-safe-markdown');
    body.innerHTML = renderMarkdown(message.body || '');
    const dismiss = el('button', 'vos-chat-bubble-menu', '×');
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

  /* "Seen by" is nearly free: chat_reads already holds a pointer per
   * (thread, reader), so this only exposes what the unread count was
   * already computed from — and only to members of the thread. */
  function renderReceipts() {
    const existing = messagesEl.querySelector('.vos-chat-receipt');
    if (existing) existing.remove();
    if (openKind !== 'direct' && openKind !== 'party') return;
    const mine = [...messagesById.values()]
      .filter((message) => message.sender === playerName && !message.deleted);
    if (!mine.length) return;
    const newest = mine.reduce((a, b) => (a.id > b.id ? a : b));
    const seenBy = Object.entries(receipts)
      .filter(([, pointer]) => (pointer || 0) >= newest.id)
      .map(([name]) => displayName(name));
    if (!seenBy.length) return;
    const line = el('div', 'vos-chat-receipt',
      openKind === 'direct' ? 'Seen' : `Seen by ${seenBy.join(', ')}`);
    const anchor = messagesEl.querySelector(`[data-id="${newest.id}"]`);
    if (anchor) anchor.after(line);
    else messagesEl.append(line);
  }

  function renderTyping() {
    const names = typingNames.filter((name) => name !== playerName);
    if (!names.length) {
      typingLiveEl.hidden = true;
      typingLiveEl.textContent = '';
      return;
    }
    typingLiveEl.hidden = false;
    typingLiveEl.textContent = '';
    const label = names.length === 1
      ? `${displayName(names[0])} is typing`
      : `${names.map(displayName).join(', ')} are typing`;
    typingLiveEl.append(el('span', 'vos-chat-typing-who', label));
    const dots = el('span', 'vos-chat-typing-dots');
    dots.append(el('i'), el('i'), el('i'));
    typingLiveEl.append(dots);
  }

  function renderHeadPresence() {
    const thread = threads.find((entry) => entry.key === openKey);
    if (!thread || thread.kind !== 'direct' || !presence[thread.label]) {
      headPresenceEl.hidden = true;
      return;
    }
    const seen = presence[thread.label];
    headPresenceEl.hidden = false;
    headPresenceEl.textContent = isOnline(seen) ? 'online' : `last seen ${formatAgo(seen)}`;
    headPresenceEl.classList.toggle('is-online', isOnline(seen));
  }

  async function markRead() {
    if (!isTalkThread() || !lastId) return;
    try {
      await markThreadRead(openKey, lastId);
      const thread = threads.find((entry) => entry.key === openKey);
      if (thread) thread.unread = 0;
      renderList();
      window.dispatchEvent(new CustomEvent('vos:im-read'));
    } catch (error) { /* the badge catches up on the next refresh */ }
  }

  async function fetchNew() {
    if (!isTalkThread()) return;
    const key = openKey;
    const data = await fetchMessages(key, lastId, since);
    if (openKey !== key) return; // switched threads mid-flight
    since = data.now || since;
    reactions = data.reactions || {};
    receipts = data.receipts || {};
    presence = { ...presence, ...(data.presence || {}) };
    typingNames = data.typing || [];

    // A rewrite or a delete lands on a message the client already has, so
    // it arrives separately from anything new.
    (data.revised || []).forEach((message) => {
      messagesById.set(message.id, message);
      redrawMessage(message.id);
    });

    const messages = data.messages || [];
    if (messages.length) {
      const empty = messagesEl.querySelector('.vos-chat-empty');
      if (empty) empty.remove();
      messages.forEach((message) => {
        const existing = messagesEl.querySelector(`[data-id="${message.id}"]`);
        if (existing) {
          messagesById.set(message.id, message);
          existing.replaceWith(messageBubble(message));
          return;
        }
        messagesEl.append(messageBubble(message));
        if (message.id > lastId) lastId = message.id;
      });
      scrollToLatest();
      markRead();
    } else if (data.revised && data.revised.length) {
      // Reaction and receipt state moved even though no message did.
      messagesEl.querySelectorAll('.vos-chat-bubble[data-id]').forEach((node) => {
        redrawMessage(node.dataset.id);
      });
    }
    renderTyping();
    renderReceipts();
    renderHeadPresence();
  }

  function schedulePoll() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(async () => {
      pollTimer = null;
      if (!active || document.visibilityState !== 'visible' || !isTalkThread()) return;
      try { await fetchNew(); } catch (error) { /* retry next tick */ }
      if (isTalkThread()) schedulePoll();
    }, POLL_ACTIVE_MS);
  }

  function stopPoll() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = null;
  }

  function showAnnouncements() {
    titleEl.textContent = 'From the DM';
    muteEl.hidden = true;
    composerEl.hidden = true;
    placeholderEl.hidden = true;
    headPresenceEl.hidden = true;
    titleLinkEl.hidden = true;
    typingLiveEl.hidden = true;
    messagesEl.textContent = '';
    messagesEl.classList.add('is-announcements');
    announcements.forEach((message) => messagesEl.append(announcementCard(message)));
    messagesEl.scrollTop = 0;
  }

  function resetThreadState() {
    messagesById.clear();
    reactions = {};
    receipts = {};
    typingNames = [];
    replyTo = null;
    editing = null;
    since = '';
    lastId = 0;
    tray.clear();
    renderContext();
    renderTyping();
  }

  async function openThread(key) {
    if (isTalkThread()) {
      setScrollTop(openKey, messagesEl.scrollTop);
      setDraft(openKey, editing ? '' : inputEl.value);
      stopTyping();
    }
    openKey = key;
    setOpenKey(key);
    panelEl.classList.add('is-thread-open');
    backEl.hidden = false;
    messagesEl.classList.remove('is-announcements');
    resetThreadState();

    if (key === ANNOUNCEMENTS_KEY) {
      openKind = null;
      renderList();
      showAnnouncements();
      setStatus('');
      return;
    }

    const thread = threads.find((entry) => entry.key === key);
    openKind = thread ? thread.kind : null;
    openMuted = !!(thread && thread.muted);
    titleEl.textContent = thread ? displayName(thread.label) : key;
    // Enzo is not a person; everyone else in a direct thread has a profile.
    const person = openKind === 'direct' && thread ? thread.label : null;
    titleLinkEl.hidden = !person;
    if (person) {
      titleLinkEl.href = `/profile/?p=${encodeURIComponent(person)}`;
      titleLinkEl.setAttribute('aria-label', `${displayName(person)}'s profile`);
    }
    muteEl.hidden = openKind === 'enzo';
    muteEl.textContent = openMuted ? 'Unmute' : 'Mute';
    muteEl.setAttribute('aria-pressed', openMuted ? 'true' : 'false');
    composerEl.hidden = false;
    placeholderEl.hidden = true;
    messagesEl.textContent = '';
    inputEl.value = getDraft(key);
    autogrow();
    renderList();
    renderHeadPresence();

    try {
      await fetchNew();
      if (!messagesEl.querySelector('.vos-chat-bubble')) {
        messagesEl.append(el('p', 'vos-chat-empty', EMPTY_COPY[openKind] || EMPTY_COPY.direct));
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
    if (isTalkThread()) {
      setScrollTop(openKey, messagesEl.scrollTop);
      setDraft(openKey, editing ? '' : inputEl.value);
      stopTyping();
    }
    openKey = null;
    openKind = null;
    setOpenKey(null);
    panelEl.classList.remove('is-thread-open');
    backEl.hidden = true;
    muteEl.hidden = true;
    composerEl.hidden = true;
    placeholderEl.hidden = false;
    headPresenceEl.hidden = true;
    titleLinkEl.hidden = true;
    typingLiveEl.hidden = true;
    messagesEl.textContent = '';
    messagesEl.classList.remove('is-announcements');
    titleEl.textContent = 'Chat';
    resetThreadState();
    stopPoll();
    renderList();
    loadThreads().catch(() => {});
  }

  // ── Composer context: replying to, or editing ────────────────────────

  function renderContext() {
    attachEl.hidden = !!editing;
    if (editing) {
      contextEl.hidden = false;
      contextLabelEl.textContent = 'Editing';
      contextTextEl.textContent = editing.body || '';
      sendEl.textContent = 'Save';
      return;
    }
    if (replyTo) {
      contextEl.hidden = false;
      contextLabelEl.textContent = `Replying to ${displayName(replyTo.sender)}`;
      contextTextEl.textContent = replyTo.deleted ? 'Message removed' : (replyTo.body || '');
      sendEl.textContent = 'Send';
      return;
    }
    contextEl.hidden = true;
    contextLabelEl.textContent = '';
    contextTextEl.textContent = '';
    sendEl.textContent = 'Send';
  }

  contextCancelEl.addEventListener('click', () => {
    if (editing) inputEl.value = getDraft(openKey);
    replyTo = null;
    editing = null;
    renderContext();
    autogrow();
    inputEl.focus();
  });

  // ── Typing heartbeat ─────────────────────────────────────────────────

  function beatTyping() {
    // Enzo does not read the room, and an announcement has no composer.
    if (!isTalkThread() || openKind === 'enzo') return;
    const now = Date.now();
    if (now - lastTypingAt < TYPING_HEARTBEAT_MS) return;
    lastTypingAt = now;
    sendTyping(openKey, true);
  }

  function stopTyping() {
    if (!lastTypingAt || !openKey || openKind === 'enzo') return;
    lastTypingAt = 0;
    sendTyping(openKey, false);
  }

  // ── Optimistic send ──────────────────────────────────────────────────

  function pendingBubble(text) {
    const bubble = el('div', 'vos-chat-bubble is-mine is-pending');
    bubble.dataset.pending = String(++pendingSeq);
    const body = el('div', 'vos-chat-bubble-body', text);
    bubble.append(body, el('div', 'vos-chat-bubble-meta', 'Sending…'));
    return bubble;
  }

  function typingRow() {
    const row = el('div', 'vos-chat-typing');
    row.append(el('span', 'vos-chat-typing-who', 'Enzo is typing'));
    const dots = el('span', 'vos-chat-typing-dots');
    dots.append(el('i'), el('i'), el('i'));
    row.append(dots);
    return row;
  }

  /* Enzo's reply arrives token by token over SSE, and the server stores
   * both halves before the stream closes — so the pill and this panel are
   * reading the same conversation, not two copies of one. */
  async function deliverToEnzo(bubble, key, text, attachmentIds) {
    const typing = typingRow();
    messagesEl.append(typing);
    scrollToLatest();
    let reply = null;
    let streamError = null;
    try {
      const options = attachmentIds && attachmentIds.length
        ? { attachments: attachmentIds } : {};
      await streamToEnzo(key, text, options, (name, payload) => {
        if (name === 'sent' && payload.message) {
          if (payload.message.id > lastId) lastId = payload.message.id;
          if (openKey === key) bubble.replaceWith(messageBubble(payload.message));
          return;
        }
        if (name === 'token') {
          if (!reply) {
            typing.remove();
            reply = el('div', 'vos-chat-bubble is-streaming');
            reply.append(el('div', 'vos-chat-bubble-body', ''));
            messagesEl.append(reply);
          }
          const body = reply.querySelector('.vos-chat-bubble-body');
          body.textContent += payload.text || '';
          scrollToLatest();
          return;
        }
        if (name === 'message' && payload.message) {
          if (payload.message.id > lastId) lastId = payload.message.id;
          if (reply) reply.replaceWith(messageBubble(payload.message));
          else messagesEl.append(messageBubble(payload.message));
          reply = null;
          scrollToLatest();
          markRead();
          return;
        }
        if (name === 'error') streamError = payload.message || 'Enzo lost the thread.';
      });
      if (streamError) setStatus(streamError, true);
      maybeAskForPush();
      window.dispatchEvent(new CustomEvent('vos:enzo-exchange', {
        detail: { key, source: 'panel' },
      }));
    } catch (error) {
      failBubble(bubble, key, text, error);
    } finally {
      typing.remove();
      if (reply) reply.remove();
    }
  }

  function failBubble(bubble, key, text, error) {
    bubble.classList.add('is-failed');
    const meta = bubble.querySelector('.vos-chat-bubble-meta');
    if (meta) meta.textContent = `Failed: ${error.message} — tap to retry`;
    bubble.addEventListener('click', function retry() {
      bubble.classList.remove('is-failed');
      if (meta) meta.textContent = 'Sending…';
      // No attachment ids on a retry: if the first attempt claimed them
      // the second cannot, and if it did not they are already gone.
      deliver(bubble, key, text);
    }, { once: true });
  }

  async function deliver(bubble, key, text, replyToId, attachmentIds) {
    if (openKind === 'enzo') return deliverToEnzo(bubble, key, text, attachmentIds);
    try {
      const data = await sendMessage(key, text, replyToId, attachmentIds);
      const message = data.message;
      if (message.id > lastId) lastId = message.id;
      if (openKey === key) {
        bubble.replaceWith(messageBubble(message));
        scrollToLatest();
        markRead();
        renderReceipts();
      }
      maybeAskForPush();
    } catch (error) {
      failBubble(bubble, key, text, error);
    }
  }

  async function saveEdit(text) {
    const target = editing;
    editing = null;
    inputEl.value = getDraft(openKey);
    renderContext();
    autogrow();
    try {
      const data = await editMessage(target.id, text);
      messagesById.set(data.message.id, data.message);
      redrawMessage(data.message.id);
      setStatus('');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function autogrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 144)}px`;
  }

  composerEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = inputEl.value.trim();
    if (!isTalkThread()) return;
    if (editing) {
      if (!text) return;
      return saveEdit(text);
    }
    const attachmentIds = tray.take();
    if (attachmentIds === null) {
      setStatus('Still uploading — one moment.', false);
      return;
    }
    // A photo with no caption is a message; nothing at all is not.
    if (!text && !attachmentIds.length) return;
    const empty = messagesEl.querySelector('.vos-chat-empty');
    if (empty) empty.remove();
    const bubble = pendingBubble(text || (attachmentIds.length === 1 ? '1 file' : `${attachmentIds.length} files`));
    messagesEl.append(bubble);
    scrollToLatest();
    const replyToId = replyTo ? replyTo.id : null;
    replyTo = null;
    renderContext();
    inputEl.value = '';
    setDraft(openKey, '');
    tray.clear();
    autogrow();
    stopTyping();
    setStatus('');
    deliver(bubble, openKey, text, replyToId, attachmentIds);
  });

  inputEl.addEventListener('input', () => {
    autogrow();
    if (openKey && !editing) setDraft(openKey, inputEl.value);
    if (inputEl.value.trim()) beatTyping();
  });

  inputEl.addEventListener('blur', stopTyping);

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (replyTo || editing)) {
      event.stopPropagation();
      contextCancelEl.click();
      return;
    }
    if (COARSE_POINTER) return; // Enter is a newline on touch keyboards
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composerEl.requestSubmit();
    }
  });

  inputEl.addEventListener('focus', () => window.setTimeout(scrollToLatest, 250));

  // The software keyboard shrinks the visual viewport under the sheet. Keep
  // the newest message in view when it does, or the line you just sent ends
  // up behind the keyboard.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (isTalkThread()) scrollToLatest();
    });
  }

  // A tap on empty space closes any open action bar.
  messagesEl.addEventListener('click', (event) => {
    if (event.target.closest('.vos-chat-bubble')) return;
    bubbleContext.closeOtherActions(null);
  });

  backEl.addEventListener('click', closeThread);

  if (closeEl) closeEl.addEventListener('click', () => onCloseRequest());

  muteEl.addEventListener('click', async () => {
    if (!isTalkThread()) return;
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (active && isTalkThread()) {
        fetchNew().catch(() => {});
        schedulePoll();
      }
    } else {
      stopPoll();
      stopTyping();
    }
  });

  return {
    root,
    boot,
    get playerName() { return playerName; },
    /* The panel only polls while it is on screen. */
    setActive(value) {
      active = !!value;
      if (active && isTalkThread()) {
        fetchNew().catch(() => {});
        schedulePoll();
      } else if (!active) {
        stopPoll();
        stopTyping();
      }
    },
    async refresh() {
      if (!playerName) return;
      await loadAnnouncements();
      await loadThreads().catch(() => {});
      if (isTalkThread()) await fetchNew().catch(() => {});
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
