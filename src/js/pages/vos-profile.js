/* /profile/ — who someone is at the table.
 *
 * Deliberately narrow: a face, a name, the character line the app bar
 * already shows its owner, a self-written bio, and last-seen. No hit
 * points, no notes, no records. The Message button opens the chat overlay
 * on the thread the server worked out, so the client never has to know how
 * a thread key is spelled.
 *
 * Your own profile is the only one with anything to edit, and the only
 * endpoints that write take no player name at all.
 */
import { authHeaders, escapeHtml, getJson, whenPwaReady } from '../shared/pwa.js';

const root = document.getElementById('vos-profile-root');
const PRESENCE_ONLINE_MS = 5 * 60 * 1000;
const BIO_MAX = 1200;

let me = null;
let profile = null;
let directory = [];

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

function formatAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : 'a while ago';
}

function isOnline(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() < PRESENCE_ONLINE_MS;
}

function avatar(entry, size) {
  const wrap = el('span', `vos-profile-face is-${size}`);
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.src = entry.avatarUrl;
  img.addEventListener('error', () => {
    img.src = '/images/app-profiles/unmapped.png';
  }, { once: true });
  wrap.append(img);
  if (entry.lastSeenAt && isOnline(entry.lastSeenAt)) {
    wrap.append(el('span', 'vos-profile-online'));
  }
  return wrap;
}

function setStatus(node, text, isError) {
  node.textContent = text || '';
  node.classList.toggle('is-error', !!isError);
}

// ── Editing your own ─────────────────────────────────────────────────

function bioEditor(reload) {
  const form = el('form', 'vos-profile-editor');
  form.append(el('label', 'vos-profile-label', 'Your bio'));
  const field = document.createElement('textarea');
  field.className = 'vos-profile-bio-input';
  field.maxLength = BIO_MAX;
  field.rows = 4;
  field.value = profile.bio || '';
  field.setAttribute('aria-label', 'Your bio');
  field.placeholder = 'A line or two — whatever you want the table to know.';
  form.append(field);

  const row = el('div', 'vos-profile-editor-row');
  const count = el('span', 'vos-profile-count');
  const save = el('button', 'vos-profile-save', 'Save');
  save.type = 'submit';
  row.append(count, save);
  form.append(row);
  const status = el('p', 'vos-profile-status');
  status.setAttribute('role', 'status');
  form.append(status);

  const updateCount = () => {
    count.textContent = `${field.value.length} / ${BIO_MAX}`;
  };
  updateCount();
  field.addEventListener('input', updateCount);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    save.disabled = true;
    setStatus(status, 'Saving…');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ bio: field.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setStatus(status, 'Saved.');
      await reload();
    } catch (error) {
      setStatus(status, error.message, true);
    } finally {
      save.disabled = false;
    }
  });
  return form;
}

function avatarControls(reload) {
  const row = el('div', 'vos-profile-avatar-actions');
  const status = el('p', 'vos-profile-status');
  status.setAttribute('role', 'status');

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.hidden = true;

  const pick = el('button', 'vos-profile-action', 'Change picture');
  pick.type = 'button';
  pick.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    setStatus(status, 'Uploading…');
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setStatus(status, '');
      // The app bar carries this face too.
      if (window.VOS_PWA && window.VOS_PWA.refreshAvatarBadge) {
        window.VOS_PWA.refreshAvatarBadge();
      }
      await reload();
    } catch (error) {
      setStatus(status, error.message, true);
    }
  });

  row.append(pick, input);

  if (profile.avatarUrl && profile.avatarUrl.startsWith('/api/')) {
    const remove = el('button', 'vos-profile-action', 'Use the campaign portrait');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      setStatus(status, 'Removing…');
      try {
        const response = await fetch('/api/profile/avatar', {
          method: 'DELETE', headers: authHeaders(),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setStatus(status, '');
        await reload();
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });
    row.append(remove);
  }

  const wrap = el('div');
  wrap.append(row, status);
  return wrap;
}

// ── The page ─────────────────────────────────────────────────────────

function directoryList() {
  const others = directory.filter((entry) => entry.name !== profile.name);
  if (!others.length) return null;
  const section = el('section', 'vos-profile-directory');
  section.append(el('h2', 'vos-profile-section-title', 'The table'));
  const list = el('div', 'vos-profile-people');
  others.forEach((entry) => {
    const link = el('a', 'vos-profile-person');
    link.href = `/profile/?p=${encodeURIComponent(entry.name)}`;
    link.append(avatar(entry, 'small'));
    const text = el('span', 'vos-profile-person-text');
    text.append(el('span', 'vos-profile-person-name', entry.display));
    text.append(el('span', 'vos-profile-person-seen',
      entry.lastSeenAt
        ? (isOnline(entry.lastSeenAt) ? 'online' : `last seen ${formatAgo(entry.lastSeenAt)}`)
        : ''));
    link.append(text);
    list.append(link);
  });
  section.append(list);
  return section;
}

function render(reload) {
  root.textContent = '';
  const card = el('section', 'vos-profile-card');

  const head = el('div', 'vos-profile-head');
  head.append(avatar(profile, 'large'));
  const identity = el('div', 'vos-profile-identity');
  identity.append(el('h1', 'vos-profile-name', profile.display));
  const character = profile.character;
  const line = character
    ? [character.name, [character.classLine, character.race].filter(Boolean).join(' · ')]
      .filter(Boolean).join(' — ')
    : (profile.isDm ? 'Dungeon Master' : '');
  if (line) identity.append(el('p', 'vos-profile-character', line));
  if (profile.lastSeenAt) {
    const seen = el('p', 'vos-profile-seen',
      isOnline(profile.lastSeenAt) ? 'Online now' : `Last seen ${formatAgo(profile.lastSeenAt)}`);
    seen.classList.toggle('is-online', isOnline(profile.lastSeenAt));
    identity.append(seen);
  }
  head.append(identity);
  card.append(head);

  if (profile.threadKey) {
    const message = el('button', 'vos-profile-message', `Message ${profile.display}`);
    message.type = 'button';
    message.addEventListener('click', () => {
      if (window.VOS_CHAT) window.VOS_CHAT.open(profile.threadKey);
      else window.location.href = `/messages/#${encodeURIComponent(profile.threadKey)}`;
    });
    card.append(message);
  }

  if (profile.bio) {
    const bio = el('div', 'vos-profile-bio vos-safe-markdown');
    bio.innerHTML = renderMarkdown(profile.bio);
    card.append(bio);
  } else if (!profile.isYou) {
    card.append(el('p', 'vos-profile-bio is-empty', 'No bio yet.'));
  }

  if (profile.isYou) {
    card.append(avatarControls(reload));
    card.append(bioEditor(reload));
  }

  root.append(card);
  const list = directoryList();
  if (list) root.append(list);
}

async function boot() {
  if (!root) return;
  const pwa = await whenPwaReady();
  me = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity().catch(() => null) : null;
  if (!me) {
    root.append(el('p', 'vos-profile-status is-error', 'Sign in to see profiles.'));
    return;
  }
  const requested = new URLSearchParams(window.location.search).get('p') || me;

  async function reload() {
    const [detail, list] = await Promise.all([
      getJson(`/api/profiles/${encodeURIComponent(requested)}`),
      getJson('/api/profiles').catch(() => ({ profiles: [] })),
    ]);
    profile = detail.profile;
    directory = list.profiles || [];
    render(reload);
  }

  try {
    await reload();
  } catch (error) {
    root.textContent = '';
    root.append(el('p', 'vos-profile-status is-error',
      error.status === 404 ? 'No such player.' : error.message));
  }
}

boot();
