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
  deleteMessage, editMessage, fetchMessages, fetchOlderMessages, fetchProfiles, fetchThreads,
  markThreadRead, sendMessage, sendTyping, setReaction, setThreadMuted,
  streamToEnzo,
} from './api.js';
import { renderBubble } from './bubble.js';
import { ACCEPT, createAttachmentTray, wireFileIntake } from './attachments.js';
import { openImageViewer } from '../components/image-zoom.js';
import {
  clearChatState, getDraft, getListWidth, getOpenKey, getScrollTop,
  setStateIdentity,
  setDraft, setListWidth, setOpenKey, setScrollTop,
} from './state.js';

// Typing indicators only mean anything if the poll is faster than a
// sentence. Six players at 4s is ~90 requests a minute worst case, and it
// stops dead the moment the tab blurs or the thread closes.
const POLL_ACTIVE_MS = 4000;
const THREAD_LIST_REFRESH_MS = 12000;
const TYPING_HEARTBEAT_MS = 3000;
const PRESENCE_ONLINE_MS = 5 * 60 * 1000;
const EDIT_WINDOW_MS = 60 * 60 * 1000;
const PUSH_ASKED_KEY = 'vos:chat:push-asked';
// The Party and Enzo are pinned above the sort — the table's own channel and
// its loremaster are always there and are never meaningfully "recent", so
// ranking them by last activity only shuffles the two rows everybody reaches
// for most.
const ENZO_SENDER = 'Enzo';
const PINNED_KINDS = ['party', 'enzo'];
const LIST_MIN_W = 184;
const LIST_MAX_W = 340;
const EMPTY_COPY = {
  party: 'The party channel is quiet. Break the silence.',
  enzo: 'Ask Enzo about the valley, its people, or the rules.',
  tester: 'Vesper is waiting at the bell. Use the local push console to send a test.',
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

function newClientMessageId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  // UUIDv4 fallback for older installed WebViews. Randomness is collision
  // avoidance, not authorization; the signed sender credential remains that.
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  let avatars = {};
  let filterText = '';
  let openKey = null;
  let openKind = null;
  let openMuted = false;
  let lastId = 0;
  let since = '';
  let pollTimer = null;
  let threadGeneration = 0;
  let lastListRefreshAt = 0;
  let pendingSeq = 0;
  let active = mode === 'page';
  let booted = false;
  let stateIdentity = null;
  let lifecycleGeneration = 0;
  let requestController = new AbortController();
  let threadFetchSeq = 0;
  let appliedThreadFetchSeq = 0;
  let listFetchSeq = 0;
  let appliedListFetchSeq = 0;

  // Per-thread depth, reset on every open.
  const messagesById = new Map();
  let reactions = {};
  let receipts = {};
  let presence = {};
  let typingNames = [];
  let replyTo = null;
  let editing = null;
  let lastTypingAt = 0;
  let lastReadSent = 0;
  let hasOlder = false;
  let loadingOlder = false;

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
        <div class="vos-chat-list-pane">
          <div class="vos-chat-filter">
            <svg class="vos-chat-filter-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
            <input type="search" class="vos-chat-filter-input" autocomplete="off"
                   placeholder="Filter" aria-label="Filter conversations">
          </div>
          <div class="vos-chat-pinned" aria-label="Pinned conversations"></div>
          <div class="vos-chat-list" role="listbox" aria-label="Conversations" tabindex="0"></div>
        </div>
        <div class="vos-chat-resizer" role="separator" aria-orientation="vertical"
             aria-label="Resize the conversation list" tabindex="0"></div>
        <section class="vos-chat-thread" aria-label="Conversation">
          <button type="button" class="vos-chat-older" hidden>Load earlier messages</button>
          <div class="vos-chat-messages" aria-live="polite"></div>
          <button type="button" class="vos-chat-jump" hidden aria-label="Jump to the newest message">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
          </button>
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
  const listPaneEl = root.querySelector('.vos-chat-list-pane');
  const listEl = root.querySelector('.vos-chat-list');
  const filterInputEl = root.querySelector('.vos-chat-filter-input');
  const pinnedEl = root.querySelector('.vos-chat-pinned');
  const resizerEl = root.querySelector('.vos-chat-resizer');
  const jumpEl = root.querySelector('.vos-chat-jump');
  const olderEl = root.querySelector('.vos-chat-older');
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
      syncSendEnabled();
      scrollToLatest();
    },
  });

  function syncSendEnabled() {
    const hasText = !!inputEl.value.trim();
    const hasFiles = !editing && tray.hasReady;
    sendEl.disabled = tray.uploading || !(hasText || hasFiles);
  }

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
    return !!openKey;
  }

  // ── Bubble context ───────────────────────────────────────────────────

  const bubbleContext = {
    get playerName() { return playerName; },
    displayName,
    renderMarkdown,
    formatDate,
    formatStamp: (value) => formatStamp(value),
    isAssistant: (sender) => sender === ENZO_SENDER,
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
      syncSendEnabled();
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
    regroup();
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

  /* Initials, the way the rest of the app does them: up to two letters from
   * the display name, gold on dark. Shown until a portrait loads and left in
   * place for anyone who has none. */
  function monogram(name) {
    const words = displayName(name).replace(/["'']/g, '').split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function avatarFor(thread) {
    const wrap = el('span', 'vos-chat-avatar');
    if (thread.kind === 'party') {
      wrap.classList.add('is-party');
      wrap.append(el('span', 'vos-chat-avatar-text', '∴'));
      wrap.title = 'The Party';
      return wrap;
    }
    if (thread.kind === 'enzo') {
      wrap.classList.add('is-enzo');
      wrap.append(el('span', 'vos-chat-avatar-text', '✦'));
      return wrap;
    }
    wrap.append(el('span', 'vos-chat-avatar-text', monogram(thread.label)));
    const url = avatars[thread.label];
    if (url) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      img.src = url;
      // The monogram stays underneath, so a portrait that 404s degrades to
      // initials instead of a hole.
      img.addEventListener('error', () => img.remove());
      wrap.append(img);
    }
    return wrap;
  }

  /* now / 4m / 2h / Tue / Aug 12 — the shape a list wants, where the exact
   * minute matters less than how long ago. */
  function formatStamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function fullStamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function previewText(thread) {
    if (!thread.last) return 'No messages yet';
    if (thread.last.deleted) return 'Message removed';
    const body = thread.last.body
      || ((thread.last.attachments || []).length ? 'Sent a file' : '');
    const who = thread.last.sender === playerName ? 'You: ' : '';
    return `${who}${body}` || 'No messages yet';
  }

  /* Most recent activity first, from anyone in the thread — the API already
   * hands us the last message per thread, so this needs no extra request and
   * no server-side ordering. Threads nobody has written in yet fall to the
   * bottom, alphabetically, because there is no activity to rank them by.
   * Unread threads are NOT floated: a badge says what is unread, and moving
   * a row out from under the cursor to say it is a worse way to say it. */
  function sortThreads(list) {
    return list.slice().sort((a, b) => {
      const at = a.last ? Date.parse(a.last.created_at) : NaN;
      const bt = b.last ? Date.parse(b.last.created_at) : NaN;
      const aHas = !Number.isNaN(at);
      const bHas = !Number.isNaN(bt);
      if (aHas && bHas) return bt - at;
      if (aHas) return -1;
      if (bHas) return 1;
      return displayName(a.label).localeCompare(displayName(b.label));
    });
  }

  function matchesFilter(thread) {
    if (!filterText) return true;
    const needle = filterText.toLowerCase();
    if (displayName(thread.label).toLowerCase().includes(needle)) return true;
    return previewText(thread).toLowerCase().includes(needle);
  }

  /* Rows are built once and patched afterwards.
   *
   * This used to be `listEl.textContent = ''` on every poll, which threw away
   * the row under the pointer, the focused row, and the list's scroll
   * position four seconds at a time. Now each row is keyed, updated in place,
   * and only moved when the order genuinely changed. */
  const rowsByKey = new Map();

  function paintRow(row, thread) {
    row.dataset.key = thread.key;
    row.classList.toggle('is-open', thread.key === openKey);
    row.classList.toggle('is-unread', !!thread.unread);
    row.classList.toggle('is-muted', !!thread.muted);
    row.setAttribute('aria-selected', thread.key === openKey ? 'true' : 'false');

    const avatarSlot = row.querySelector('.vos-chat-row-avatar');
    avatarSlot.textContent = '';
    avatarSlot.append(avatarFor(thread));
    if (thread.kind === 'direct') {
      const dot = presenceDot(thread.label);
      if (dot) avatarSlot.append(dot);
    }

    row.querySelector('.vos-chat-row-name').textContent = displayName(thread.label);

    const preview = row.querySelector('.vos-chat-row-preview');
    preview.textContent = previewText(thread);
    preview.classList.toggle('is-empty', !thread.last);

    const stamp = row.querySelector('.vos-chat-row-time');
    if (thread.last) {
      stamp.textContent = formatStamp(thread.last.created_at);
      stamp.title = fullStamp(thread.last.created_at);
      stamp.hidden = false;
    } else {
      stamp.textContent = '';
      stamp.removeAttribute('title');
      stamp.hidden = true;
    }

    const badge = row.querySelector('.vos-chat-count');
    if (thread.unread) {
      badge.textContent = thread.unread > 99 ? '99+' : String(thread.unread);
      badge.hidden = false;
      badge.setAttribute('aria-label', `${thread.unread} unread`);
    } else {
      badge.textContent = '';
      badge.hidden = true;
    }

    const muted = row.querySelector('.vos-chat-row-muted');
    muted.hidden = !thread.muted;

    row.setAttribute('aria-label',
      `${displayName(thread.label)}${thread.unread ? `, ${thread.unread} unread` : ''}`);
  }

  function buildRow(thread) {
    const row = el('button', 'vos-chat-row');
    row.type = 'button';
    row.setAttribute('role', 'option');
    row.tabIndex = -1;
    row.innerHTML = `
      <span class="vos-chat-row-avatar"></span>
      <span class="vos-chat-row-text">
        <span class="vos-chat-row-name"></span>
        <span class="vos-chat-row-preview"></span>
      </span>
      <span class="vos-chat-row-side">
        <span class="vos-chat-row-time"></span>
        <span class="vos-chat-row-badges">
          <span class="vos-chat-row-muted" title="Muted" hidden>🔕</span>
          <span class="vos-chat-count" hidden></span>
        </span>
      </span>
    `;
    row.addEventListener('click', () => openThread(thread.key));
    return row;
  }

  /* The two pinned rows, drawn as feature cards rather than list rows.
   *
   * The Party leads and carries the party portrait behind a scrim — it is
   * the table's own channel and the one everybody opens first, so it is
   * allowed to be the loudest thing in the panel. Enzo sits directly under
   * it, plainly a fixture too but quieter, and violet rather than gold
   * because he is not one of the players. */
  const PIN_COPY = {
    party: { name: 'The Party', empty: 'The whole table, in one thread' },
    enzo: { name: 'Enzo', empty: 'Ask about the valley' },
  };

  function buildPinnedRow(variant) {
    const row = el('button', `vos-chat-pin vos-chat-pin--${variant}`);
    row.type = 'button';
    if (variant === 'party') row.append(el('span', 'vos-chat-pin-art'));
    else row.append(el('span', 'vos-chat-pin-mark', '✦'));
    const text = el('span', 'vos-chat-pin-text');
    text.append(el('span', 'vos-chat-pin-name', PIN_COPY[variant].name));
    text.append(el('span', 'vos-chat-pin-sub'));
    row.append(text);
    const side = el('span', 'vos-chat-pin-side');
    side.append(el('span', 'vos-chat-pin-time'));
    side.append(el('span', 'vos-chat-count'));
    row.append(side);
    return row;
  }

  function paintPinnedRow(row, thread, variant) {
    row.dataset.key = thread.key;
    row.classList.toggle('is-open', thread.key === openKey);
    row.classList.toggle('is-unread', !!thread.unread);
    row.querySelector('.vos-chat-pin-sub').textContent =
      thread.last ? previewText(thread) : PIN_COPY[variant].empty;

    const stamp = row.querySelector('.vos-chat-pin-time');
    if (thread.last) {
      stamp.textContent = formatStamp(thread.last.created_at);
      stamp.title = fullStamp(thread.last.created_at);
      stamp.hidden = false;
    } else {
      stamp.textContent = '';
      stamp.hidden = true;
    }

    const badge = row.querySelector('.vos-chat-count');
    if (thread.unread) {
      badge.textContent = thread.unread > 99 ? '99+' : String(thread.unread);
      badge.hidden = false;
    } else {
      badge.textContent = '';
      badge.hidden = true;
    }

    row.setAttribute('aria-label',
      `${PIN_COPY[variant].name}${thread.unread ? `, ${thread.unread} unread` : ''}`);
  }

  /* Built once and repainted, for the same reason the list rows are: a poll
   * every four seconds must not take the focus off a card somebody is about
   * to press, or make the browser re-decode the party portrait. */
  const pinnedRows = new Map();

  function renderPinned() {
    PINNED_KINDS.forEach((variant) => {
      const thread = threads.find((entry) => entry.kind === variant);
      let row = pinnedRows.get(variant);
      if (!thread) {
        if (row) { row.remove(); pinnedRows.delete(variant); }
        return;
      }
      if (!row) {
        row = buildPinnedRow(variant);
        row.addEventListener('click', () => {
          const key = row.dataset.key;
          if (key) openThread(key);
        });
        pinnedRows.set(variant, row);
        pinnedEl.append(row);
      }
      paintPinnedRow(row, thread, variant);
    });
    pinnedEl.hidden = !pinnedEl.children.length;
  }

  function renderList() {
    // The pinned pair are drawn above; the list is everything else.
    const rest = sortThreads(
      threads.filter((thread) => !PINNED_KINDS.includes(thread.kind)),
    ).filter(matchesFilter);

    // Drop rows for threads that are gone or filtered out.
    const wanted = new Set(rest.map((thread) => thread.key));
    rowsByKey.forEach((row, key) => {
      if (!wanted.has(key)) {
        row.remove();
        rowsByKey.delete(key);
      }
    });

    const emptyEl = listEl.querySelector('.vos-chat-list-empty');
    if (emptyEl) emptyEl.remove();

    // Patch content, then put each row where it belongs. insertBefore on a
    // node already in position is a no-op in every engine, so a poll that
    // changes nothing touches nothing.
    let cursor = null;
    rest.forEach((thread) => {
      let row = rowsByKey.get(thread.key);
      if (!row) {
        row = buildRow(thread);
        rowsByKey.set(thread.key, row);
      }
      paintRow(row, thread);
      const next = cursor ? cursor.nextSibling : listEl.firstChild;
      if (next !== row) listEl.insertBefore(row, next);
      cursor = row;
    });

    if (!rest.length) {
      listEl.append(el('p', 'vos-chat-list-empty',
        filterText ? 'No conversations match that.' : 'No conversations yet.'));
    }

    // One row is reachable by Tab; the arrows move between them.
    const rows = [...listEl.querySelectorAll('.vos-chat-row')];
    const current = rows.find((row) => row.classList.contains('is-open')) || rows[0];
    rows.forEach((row) => { row.tabIndex = row === current ? 0 : -1; });

    renderPinned();
    onUnreadChange(totalUnread());
  }

  async function loadThreads() {
    const generation = lifecycleGeneration;
    const sequence = ++listFetchSeq;
    const data = await fetchThreads({ signal: requestController.signal });
    if (generation !== lifecycleGeneration || sequence < appliedListFetchSeq) return threads;
    appliedListFetchSeq = sequence;
    threads = data.threads || [];
    presence = { ...presence, ...(data.presence || {}) };
    lastListRefreshAt = Date.now();
    renderList();
    return threads;
  }

  /* Faces for the list. One request on boot, and a failure just means
   * monograms — the roster endpoint already carries the avatar URL, curated
   * portrait or self-uploaded, so nothing new had to be built for this. */
  async function loadAvatars() {
    try {
      const generation = lifecycleGeneration;
      const data = await fetchProfiles({ signal: requestController.signal });
      if (generation !== lifecycleGeneration) return;
      const next = {};
      (data.profiles || []).forEach((profile) => {
        if (profile && profile.name && profile.avatarUrl) {
          next[profile.name] = profile.avatarUrl;
        }
      });
      avatars = next;
    } catch (error) {
      avatars = {};
    }
  }

  // ── Conversation ─────────────────────────────────────────────────────

  function dayKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function dayLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (dayKey(date) === dayKey(today)) return 'Today';
    if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
    const sameYear = date.getFullYear() === today.getFullYear();
    return date.toLocaleDateString([], sameYear
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* Grouping is a second pass over what is already rendered, and it only
   * ever toggles classes or inserts a day separator — no bubble is rebuilt
   * and none of them move, so a message arriving mid-read shifts nothing
   * above it. A run breaks on a new sender, a gap of more than five
   * minutes, or a change of day. */
  const GROUP_GAP_MS = 5 * 60 * 1000;

  function regroup() {
    const bubbles = [...messagesEl.querySelectorAll('.vos-chat-bubble[data-id]')];
    let previous = null;
    let previousDay = null;

    bubbles.forEach((bubble) => {
      const sender = bubble.dataset.sender || '';
      const at = Date.parse(bubble.dataset.at || '');
      const day = dayKey(bubble.dataset.at);

      const newDay = day && day !== previousDay;
      const gap = previous ? Math.abs(at - Date.parse(previous.dataset.at || '')) : Infinity;
      const starts = newDay || !previous
        || previous.dataset.sender !== sender
        || !(gap < GROUP_GAP_MS);

      // The separator belongs to the bubble that opens the day, so it moves
      // with it and cannot be orphaned by a delete.
      const existing = bubble.previousElementSibling;
      const hasSeparator = existing && existing.classList.contains('vos-chat-day');
      if (newDay) {
        if (hasSeparator) {
          existing.textContent = dayLabel(bubble.dataset.at);
        } else {
          const separator = el('div', 'vos-chat-day', dayLabel(bubble.dataset.at));
          separator.setAttribute('role', 'separator');
          messagesEl.insertBefore(separator, bubble);
        }
      } else if (hasSeparator) {
        existing.remove();
      }

      bubble.classList.toggle('is-group-start', starts);
      if (previous) previous.classList.toggle('is-group-end', starts);
      previous = bubble;
      previousDay = day || previousDay;
    });

    if (previous) previous.classList.add('is-group-end');
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
    if (!isTalkThread() || !lastId || !active) return;
    if (document.visibilityState !== 'visible' || !atBottom()) return;
    const key = openKey;
    const generation = threadGeneration;
    const pointer = lastId;
    if (pointer <= lastReadSent) return;
    const previousPointer = lastReadSent;
    lastReadSent = pointer;
    try {
      const data = await markThreadRead(key, pointer);
      if (openKey !== key || generation !== threadGeneration) return;
      lastReadSent = Math.max(lastReadSent, data.lastReadId || 0);
      const thread = threads.find((entry) => entry.key === key);
      if (thread) thread.unread = 0;
      renderList();
      window.dispatchEvent(new CustomEvent('vos:im-read'));
    } catch (error) {
      if (openKey === key && generation === threadGeneration) lastReadSent = previousPointer;
    }
  }

  async function fetchNew(options = {}) {
    if (!isTalkThread()) return;
    const key = openKey;
    const generation = threadGeneration;
    const sequence = ++threadFetchSeq;
    const requestedAfter = lastId;
    const oldReactionState = JSON.stringify(reactions);
    const data = await fetchMessages(
      key, lastId, since, { signal: requestController.signal },
    );
    if (openKey !== key || generation !== threadGeneration
        || sequence < appliedThreadFetchSeq) return;
    appliedThreadFetchSeq = sequence;
    if (!requestedAfter) {
      hasOlder = !!data.hasOlder;
      olderEl.hidden = !hasOlder;
    }
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
    const wasAtBottom = options.preservePosition ? false : atBottom();
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
      regroup();
      // Only follow the conversation if you were already at the bottom of
      // it. Someone else's message must not yank the view while you read.
      if (wasAtBottom) scrollToLatest();
      else syncJump();
      if (wasAtBottom) markRead();
      const thread = threads.find((entry) => entry.key === key);
      if (thread) thread.last = messages[messages.length - 1];
      renderList();
    } else if ((data.revised && data.revised.length)
               || oldReactionState !== JSON.stringify(reactions)) {
      // Reactions are independent entities. They can move without a new or
      // edited message, so a reaction-only poll still repaints its bubbles.
      messagesEl.querySelectorAll('.vos-chat-bubble[data-id]').forEach((node) => {
        redrawMessage(node.dataset.id);
      });
      regroup();
    }
    renderTyping();
    renderReceipts();
    renderHeadPresence();
    // A message may have arrived while the tab was hidden. The hidden fetch
    // correctly refused to mark it read; the first visible catch-up should
    // acknowledge it if the reader is still at the bottom.
    if (!options.preservePosition && atBottom()) markRead();
    if (data.hasNewer && openKey === key && generation === threadGeneration) {
      window.setTimeout(() => fetchNew().catch(() => {}), 0);
    }
  }

  async function loadOlder() {
    if (!isTalkThread() || !hasOlder || loadingOlder || !messagesById.size) return;
    const key = openKey;
    const generation = threadGeneration;
    const beforeId = Math.min(...messagesById.keys());
    const previousHeight = messagesEl.scrollHeight;
    const previousTop = messagesEl.scrollTop;
    loadingOlder = true;
    olderEl.disabled = true;
    olderEl.textContent = 'Loading…';
    try {
      const data = await fetchOlderMessages(
        key, beforeId, { signal: requestController.signal },
      );
      if (openKey !== key || generation !== threadGeneration) return;
      reactions = data.reactions || reactions;
      receipts = data.receipts || receipts;
      presence = { ...presence, ...(data.presence || {}) };
      const fragment = document.createDocumentFragment();
      (data.messages || []).forEach((message) => {
        messagesById.set(message.id, message);
        fragment.append(messageBubble(message));
      });
      messagesEl.insertBefore(fragment, messagesEl.firstChild);
      // Quotes that pointed beyond the first page can now resolve.
      messagesEl.querySelectorAll('.vos-chat-bubble[data-id]').forEach((node) => {
        redrawMessage(node.dataset.id);
      });
      regroup();
      hasOlder = !!data.hasOlder;
      messagesEl.scrollTop = previousTop + (messagesEl.scrollHeight - previousHeight);
      renderReceipts();
      setStatus('');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(error.message, true);
    } finally {
      if (openKey === key && generation === threadGeneration) {
        loadingOlder = false;
        olderEl.disabled = false;
        olderEl.textContent = 'Load earlier messages';
        olderEl.hidden = !hasOlder;
      }
    }
  }

  function schedulePoll() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(async () => {
      pollTimer = null;
      if (!active || document.visibilityState !== 'visible' || !isTalkThread()) return;
      try { await fetchNew(); } catch (error) { /* retry next tick */ }
      if (Date.now() - lastListRefreshAt >= THREAD_LIST_REFRESH_MS) {
        await loadThreads().catch(() => {});
      }
      if (isTalkThread()) schedulePoll();
    }, POLL_ACTIVE_MS);
  }

  function stopPoll() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = null;
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
    lastReadSent = 0;
    appliedThreadFetchSeq = 0;
    hasOlder = false;
    loadingOlder = false;
    olderEl.hidden = true;
    olderEl.disabled = false;
    olderEl.textContent = 'Load earlier messages';
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
    threadGeneration += 1;
    setOpenKey(key);
    panelEl.classList.add('is-thread-open');
    backEl.hidden = false;
    resetThreadState();

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
    const readOnly = openKind === 'tester';
    muteEl.hidden = openKind === 'enzo' || readOnly;
    muteEl.textContent = openMuted ? 'Unmute' : 'Mute';
    muteEl.setAttribute('aria-pressed', openMuted ? 'true' : 'false');
    composerEl.hidden = readOnly;
    placeholderEl.hidden = true;
    messagesEl.textContent = '';
    inputEl.value = getDraft(key);
    autogrow();
    syncSendEnabled();
    renderList();
    renderHeadPresence();

    const saved = getScrollTop(key);
    try {
      await fetchNew({ preservePosition: saved != null });
      regroup();
      if (!messagesEl.querySelector('.vos-chat-bubble')) {
        messagesEl.append(el('p', 'vos-chat-empty', EMPTY_COPY[openKind] || EMPTY_COPY.direct));
      }
      if (saved != null) messagesEl.scrollTop = saved;
      if (atBottom()) markRead();
      syncJump();
      setStatus('');
    } catch (error) {
      setStatus(error.message, true);
    }
    schedulePoll();
    if (!COARSE_POINTER && !readOnly) inputEl.focus();
  }

  function closeThread() {
    if (isTalkThread()) {
      setScrollTop(openKey, messagesEl.scrollTop);
      setDraft(openKey, editing ? '' : inputEl.value);
      stopTyping();
    }
    openKey = null;
    threadGeneration += 1;
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
    syncSendEnabled();
    inputEl.focus();
  });

  // ── Typing heartbeat ─────────────────────────────────────────────────

  function beatTyping() {
    // Enzo does not read the room.
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
  async function deliverToEnzo(
    bubble, key, text, attachmentIds, generation, clientMessageId,
  ) {
    const typing = typingRow();
    if (openKey === key && threadGeneration === generation) {
      messagesEl.append(typing);
      scrollToLatest();
    }
    let reply = null;
    let streamError = null;
    try {
      const options = attachmentIds && attachmentIds.length
        ? { attachments: attachmentIds } : {};
      options.clientMessageId = clientMessageId;
      await streamToEnzo(key, text, options, (name, payload) => {
        // The stream belongs to the thread that started it. If the reader has
        // moved elsewhere, leave the server to finish and let a later fetch
        // hydrate this thread; never paint into the newly selected one.
        if (openKey !== key || threadGeneration !== generation) return;
        if (name === 'sent' && payload.message) {
          if (payload.message.id > lastId) lastId = payload.message.id;
          bubble.replaceWith(messageBubble(payload.message));
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
      }, { signal: requestController.signal });
      if (streamError) setStatus(streamError, true);
      maybeAskForPush();
      window.dispatchEvent(new CustomEvent('vos:enzo-exchange', {
        detail: { key, source: 'panel' },
      }));
    } catch (error) {
      failBubble(bubble, {
        key, text, attachmentIds, generation, kind: 'enzo', clientMessageId,
      }, error);
    } finally {
      typing.remove();
      if (reply) reply.remove();
    }
  }

  function failBubble(bubble, payload, error) {
    if (!bubble.isConnected || openKey !== payload.key
        || threadGeneration !== payload.generation) return;
    bubble.classList.add('is-failed');
    const meta = bubble.querySelector('.vos-chat-bubble-meta');
    if (meta) meta.textContent = `Failed: ${error.message} — tap to retry`;
    bubble.addEventListener('click', function retry() {
      bubble.classList.remove('is-failed');
      if (meta) meta.textContent = 'Sending…';
      // The same client id makes an ambiguous retry safe, and the complete
      // payload means a retry can never silently drop its quote or files.
      deliver(bubble, payload);
    }, { once: true });
  }

  async function deliver(bubble, payload) {
    const { key, text, replyToId, attachmentIds, clientMessageId, generation, kind } = payload;
    if (kind === 'enzo') {
      return deliverToEnzo(
        bubble, key, text, attachmentIds, generation, clientMessageId,
      );
    }
    try {
      const data = await sendMessage(
        key, text, replyToId, attachmentIds, clientMessageId,
      );
      const message = data.message;
      if (openKey === key && threadGeneration === generation) {
        if (message.id > lastId) lastId = message.id;
        bubble.replaceWith(messageBubble(message));
        scrollToLatest();
        markRead();
        renderReceipts();
      }
      const thread = threads.find((entry) => entry.key === key);
      if (thread) {
        thread.last = message;
        thread.unread = 0;
        renderList();
      }
      maybeAskForPush();
    } catch (error) {
      failBubble(bubble, payload, error);
    }
  }

  async function saveEdit(text) {
    const target = editing;
    sendEl.disabled = true;
    try {
      const data = await editMessage(target.id, text);
      messagesById.set(data.message.id, data.message);
      redrawMessage(data.message.id);
      editing = null;
      inputEl.value = getDraft(openKey);
      renderContext();
      autogrow();
      setStatus('');
    } catch (error) {
      // Stay in edit mode with the attempted correction intact.
      setStatus(error.message, true);
    } finally {
      syncSendEnabled();
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
    const payload = {
      key: openKey,
      kind: openKind,
      generation: threadGeneration,
      text,
      replyToId,
      attachmentIds,
      clientMessageId: newClientMessageId(),
    };
    replyTo = null;
    renderContext();
    inputEl.value = '';
    setDraft(openKey, '');
    tray.clear();
    autogrow();
    syncSendEnabled();
    stopTyping();
    setStatus('');
    deliver(bubble, payload);
  });

  inputEl.addEventListener('input', () => {
    autogrow();
    syncSendEnabled();
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

  let filterTimer = null;
  filterInputEl.addEventListener('input', () => {
    // Debounced so typing does not reorder the list under the cursor on
    // every keystroke.
    if (filterTimer) window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      filterTimer = null;
      filterText = filterInputEl.value.trim();
      renderList();
    }, 120);
  });
  filterInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filterInputEl.value) {
      event.stopPropagation();
      filterInputEl.value = '';
      filterText = '';
      renderList();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const first = listEl.querySelector('.vos-chat-row');
      if (first) first.focus();
    }
  });

  /* Arrow keys walk the list, Enter opens. The rows are buttons, so Enter
   * and Space already fire their click — only the movement is ours. */
  listEl.addEventListener('keydown', (event) => {
    const rows = [...listEl.querySelectorAll('.vos-chat-row')];
    if (!rows.length) return;
    const index = rows.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = rows[Math.min(index + 1, rows.length - 1)];
    else if (event.key === 'ArrowUp') next = index <= 0 ? null : rows[index - 1];
    else if (event.key === 'Home') next = rows[0];
    else if (event.key === 'End') next = rows[rows.length - 1];
    else return;
    event.preventDefault();
    if (!next && event.key === 'ArrowUp') {
      filterInputEl.focus();
      return;
    }
    if (next) {
      rows.forEach((row) => { row.tabIndex = row === next ? 0 : -1; });
      next.focus();
    }
  });

  /* The list/thread split, dragged and remembered. Pointer events rather
   * than mouse so a trackpad, a pen and a touch drag all behave. */
  function applyListWidth(px) {
    const width = Math.round(Math.min(LIST_MAX_W, Math.max(LIST_MIN_W, px)));
    root.style.setProperty('--vos-chat-list-w', `${width}px`);
    return width;
  }

  const savedWidth = getListWidth();
  if (savedWidth) applyListWidth(savedWidth);

  resizerEl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    resizerEl.setPointerCapture(event.pointerId);
    panelEl.classList.add('is-resizing');
    const origin = listPaneEl.getBoundingClientRect().left;
    const move = (moveEvent) => applyListWidth(moveEvent.clientX - origin);
    const done = (upEvent) => {
      resizerEl.removeEventListener('pointermove', move);
      resizerEl.removeEventListener('pointerup', done);
      resizerEl.removeEventListener('pointercancel', done);
      panelEl.classList.remove('is-resizing');
      setListWidth(applyListWidth(upEvent.clientX - origin));
    };
    resizerEl.addEventListener('pointermove', move);
    resizerEl.addEventListener('pointerup', done);
    resizerEl.addEventListener('pointercancel', done);
  });
  resizerEl.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 32 : 8;
    const current = listPaneEl.getBoundingClientRect().width;
    if (event.key === 'ArrowLeft') setListWidth(applyListWidth(current - step));
    else if (event.key === 'ArrowRight') setListWidth(applyListWidth(current + step));
    else return;
    event.preventDefault();
  });

  /* The jump button appears only once you have scrolled away from the
   * bottom, and `atBottom` is also what decides whether an arriving message
   * scrolls the view — reading back through a thread should not be yanked
   * out from under you by someone else typing. */
  function atBottom() {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 72;
  }

  function syncJump() {
    const away = isTalkThread() && !atBottom();
    jumpEl.hidden = !away;
  }

  let scrollSaveTimer = null;
  messagesEl.addEventListener('scroll', () => {
    syncJump();
    // The button has to answer instantly; the bookmark can wait. Writing
    // sessionStorage on every scroll frame is a JSON round-trip per event.
    if (scrollSaveTimer) window.clearTimeout(scrollSaveTimer);
    scrollSaveTimer = window.setTimeout(() => {
      scrollSaveTimer = null;
      if (isTalkThread()) {
        setScrollTop(openKey, messagesEl.scrollTop);
        if (atBottom()) markRead();
      }
    }, 200);
  }, { passive: true });

  jumpEl.addEventListener('click', () => {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
    jumpEl.hidden = true;
  });

  backEl.addEventListener('click', closeThread);
  olderEl.addEventListener('click', loadOlder);

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
    const generation = lifecycleGeneration;
    const pwa = await whenPwaReady();
    if (generation !== lifecycleGeneration) return null;
    if (pwa && pwa.isPreviewing && pwa.isPreviewing()) {
      setStateIdentity(null);
      setStatus('Messaging is unavailable while previewing a player.', true);
      return null;
    }
    playerName = pwa && pwa.ensureIdentity
      ? await pwa.ensureIdentity().catch(() => null)
      : null;
    if (generation !== lifecycleGeneration) return null;
    if (!playerName) {
      setStateIdentity(null);
      setStatus('Sign in to see your messages.', true);
      booted = false;
      return null;
    }
    setStateIdentity(playerName);
    stateIdentity = playerName;
    setStatus('Loading…');
    try {
      await Promise.all([loadAvatars(), loadThreads()]);
      if (generation !== lifecycleGeneration) return null;
      setStatus('');
    } catch (error) {
      if (generation === lifecycleGeneration && error.name !== 'AbortError') {
        setStatus(error.message, true);
      }
    }
    return playerName;
  }

  function resetForIdentity(nextName = null) {
    const previousName = playerName || stateIdentity;
    lifecycleGeneration += 1;
    threadGeneration += 1;
    requestController.abort();
    requestController = new AbortController();
    stopPoll();
    // The identity event fires after credentials change. A network "stopped
    // typing" request here could mutate the incoming seat, so invalidate the
    // local lease and let the old server row expire naturally.
    lastTypingAt = 0;
    if (scrollSaveTimer) window.clearTimeout(scrollSaveTimer);
    scrollSaveTimer = null;
    if (filterTimer) window.clearTimeout(filterTimer);
    filterTimer = null;

    // A session ending is a privacy boundary. Keep no drafts, scroll
    // bookmarks, open-thread pointers, or rendered entities from that seat.
    if (previousName && previousName !== nextName) clearChatState(previousName);
    setStateIdentity(nextName);
    stateIdentity = nextName;
    playerName = null;
    booted = false;
    threads = [];
    avatars = {};
    presence = {};
    filterText = '';
    filterInputEl.value = '';
    openKey = null;
    openKind = null;
    openMuted = false;
    lastListRefreshAt = 0;
    appliedListFetchSeq = 0;
    listEl.textContent = '';
    pinnedEl.textContent = '';
    rowsByKey.clear();
    pinnedRows.clear();
    messagesEl.textContent = '';
    inputEl.value = '';
    panelEl.classList.remove('is-thread-open');
    backEl.hidden = true;
    muteEl.hidden = true;
    composerEl.hidden = true;
    placeholderEl.hidden = false;
    placeholderEl.textContent = 'Pick a conversation.';
    titleEl.textContent = 'Chat';
    titleLinkEl.hidden = true;
    headPresenceEl.hidden = true;
    jumpEl.hidden = true;
    resetThreadState();
    setStatus(nextName ? '' : 'Sign in to see your messages.', !nextName);
    onUnreadChange(0);
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
    resetForIdentity,
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
      if (threads.some((thread) => thread.key === key)) {
        openThread(key);
      } else {
        setOpenKey(null);
      }
    },
    hasThread(key) {
      return threads.some((thread) => thread.key === key);
    },
    totalUnread,
  };
}
