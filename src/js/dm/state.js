import { loadAdminDataOnce } from './tabs.js';

export const SESSION_KEY = 'vos.dmSession';

export const COOKIE_AUTH_TOKEN = '__vos_cookie_auth__';

export let dmSession = null;

try {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) dmSession = JSON.parse(raw);
} catch (e) {}

export function persistSession(session) {
  dmSession = session;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
  renderAuthState();
  if (isSessionLive()) loadAdminDataOnce();
}

export function isSessionLive() {
  if (!dmSession || (!dmSession.session_token && !dmSession.cookie_auth)) return false;
  if (dmSession.cookie_auth) return true;
  if (dmSession.expires_at && Date.now() >= dmSession.expires_at) return false;
  return true;
}

export function renderAuthState() {
  if (!authSignedOutEl) return;
  const live = isSessionLive();
  authSignedOutEl.hidden = live;
  authSignedInEl.hidden = !live;
  if (live) {
    authEmailEl.textContent = dmSession.email || 'DM';
  }
}

export const DEFAULT_PLAYERS = [
  'Caravel "Car" Asteri',
  'Kryton Novelli',
  'Lotan',
  'Noname',
  'Orabella',
  'Roxanya "Roxy"',
  'Valentro',
  'DM',
];

export const authSignedOutEl = document.getElementById('vos-dm-auth-signed-out');

export const authSignedInEl  = document.getElementById('vos-dm-auth-signed-in');

export const authBlockedEl   = document.getElementById('vos-dm-auth-blocked');

export const authEmailEl     = document.getElementById('vos-dm-auth-email');

export const authStatusEl    = document.getElementById('vos-dm-auth-status');

export const googleButtonEl  = document.getElementById('vos-dm-google-button');

export const signOutEl       = document.getElementById('vos-dm-sign-out');

export const messageForm = document.getElementById('vos-dm-message-form');

export const messageTitleEl = document.getElementById('vos-dm-message-heading');

export const messageBodyEl = document.getElementById('vos-dm-message-body');

export const messageUrlEl = document.getElementById('vos-dm-message-url');

export const messageStatusEl = document.getElementById('vos-dm-message-status');

export const messageSendEl = document.getElementById('vos-dm-message-send');

export const historyEl = document.getElementById('vos-dm-history');

export const historyStatusEl = document.getElementById('vos-dm-history-status');

export const historyRefreshEl = document.getElementById('vos-dm-history-refresh');

export const showDeletedEl = document.getElementById('vos-dm-show-deleted');

export const rsvpRefreshEl = document.getElementById('vos-dm-rsvp-refresh');

export const rsvpStatusEl = document.getElementById('vos-dm-rsvp-status');

export const rsvpListEl = document.getElementById('vos-dm-rsvps');

export const rsvpGoingEl = document.getElementById('vos-rsvp-going');

export const rsvpMaybeEl = document.getElementById('vos-rsvp-maybe');

export const rsvpOutEl = document.getElementById('vos-rsvp-out');

export const form = document.getElementById('vos-dm-push-form');

export const titleEl = document.getElementById('vos-dm-title');

export const bodyEl = document.getElementById('vos-dm-body');

export const urlEl = document.getElementById('vos-dm-url');

export const statusEl = document.getElementById('vos-dm-status');

export const sendEl = document.getElementById('vos-dm-send');

export const recipientPickers = new Map();

export const calFormEl = document.getElementById('vos-dm-cal-form');

export const calDateEl = document.getElementById('vos-dm-cal-date');

export const calTitleEl = document.getElementById('vos-dm-cal-title');

export const calTimeEl = document.getElementById('vos-dm-cal-time');

export const calLocationEl = document.getElementById('vos-dm-cal-location');

export const calNotesEl = document.getElementById('vos-dm-cal-notes');

export const calKindEl = document.getElementById('vos-dm-cal-kind');

export const calTasksEl = document.getElementById('vos-dm-cal-tasks');

export const calSaveEl = document.getElementById('vos-dm-cal-save');

export const calCancelEl = document.getElementById('vos-dm-cal-cancel');

export const calEventsEl = document.getElementById('vos-dm-cal-events');

export const calStatusEl = document.getElementById('vos-dm-cal-status');

export const calRefreshEl = document.getElementById('vos-dm-cal-refresh');

export const pushSubsEl = document.getElementById('vos-dm-push-subs');

export const pushSubsStatusEl = document.getElementById('vos-dm-subs-status');

export const pushSubsRefreshEl = document.getElementById('vos-dm-subs-refresh');

export const rumorFormEl = document.getElementById('vos-dm-rumor-form');

export const rumorTextEl = document.getElementById('vos-dm-rumor-text');

export const rumorAddEl = document.getElementById('vos-dm-rumor-add');

export const rumorsListEl = document.getElementById('vos-dm-rumors-list');

export const rumorsStatusEl = document.getElementById('vos-dm-rumors-status');

export const rumorsRefreshEl = document.getElementById('vos-dm-rumors-refresh');

export const handoutFormEl = document.getElementById('vos-dm-handout-form');

export const handoutIdEl = document.getElementById('vos-dm-handout-id');

export const handoutTitleEl = document.getElementById('vos-dm-handout-title');

export const handoutTextEl = document.getElementById('vos-dm-handout-text');

export const handoutPlayersEl = document.getElementById('vos-dm-handout-players');

export const handoutImageEl = document.getElementById('vos-dm-handout-image');

export const handoutSaveEl = document.getElementById('vos-dm-handout-save');

export const handoutCancelEl = document.getElementById('vos-dm-handout-cancel');

export const handoutsListEl = document.getElementById('vos-dm-handouts-list');

export const handoutsStatusEl = document.getElementById('vos-dm-handouts-status');

export const handoutsRefreshEl = document.getElementById('vos-dm-handouts-refresh');

export const npcRollEl = document.getElementById('vos-dm-npc-roll');

export const npcResultEl = document.getElementById('vos-dm-npc-result');

export const recordsListEl = document.getElementById('vos-dm-records-list');

export const recordsStatusEl = document.getElementById('vos-dm-records-status');

export const recordsRefreshEl = document.getElementById('vos-dm-records-refresh');

export const availSummaryEl = document.getElementById('vos-dm-avail-summary');

export const availSubmittedEl = document.getElementById('vos-dm-avail-submitted');

export const availStatusEl = document.getElementById('vos-dm-avail-status');

export const availRefreshEl = document.getElementById('vos-dm-avail-refresh');

export const loreListEl = document.getElementById('vos-dm-lore-list');

export const loreBulkBarEl = document.getElementById('vos-dm-lore-bulk-bar');

export const loreSelectAllEl = document.getElementById('vos-dm-lore-select-all');

export const loreSelectCountEl = document.getElementById('vos-dm-lore-select-count');

export const loreBulkPublishEl = document.getElementById('vos-dm-lore-bulk-publish');

export const loreBulkRejectEl = document.getElementById('vos-dm-lore-bulk-reject');

export const selectedLoreIds = new Set();

export const wikiQueryEl = document.getElementById('vos-dm-wiki-query');

export const wikiLoadEl = document.getElementById('vos-dm-wiki-load');

export const wikiRebuildEl = document.getElementById('vos-dm-wiki-rebuild');

export const wikiForm = document.getElementById('vos-dm-wiki-form');

export const wikiContentRowEl = document.getElementById('vos-dm-wiki-content-row');

export const wikiContentEl = document.getElementById('vos-dm-wiki-content');

export const wikiMetaEl = document.getElementById('vos-dm-wiki-meta');

export const wikiOpenEl = document.getElementById('vos-dm-wiki-open');

export const wikiSaveEl = document.getElementById('vos-dm-wiki-save');

export const wikiStatusEl = document.getElementById('vos-dm-wiki-status');

export const inPlayListEl = document.getElementById('vos-dm-inplay-list');

export const inPlayStatusEl = document.getElementById('vos-dm-inplay-status');

export const inPlayAddEl = document.getElementById('vos-dm-inplay-add');

export const inPlayRefreshEl = document.getElementById('vos-dm-inplay-refresh');

export const inPlaySaveEl = document.getElementById('vos-dm-inplay-save');

export const loreForm = document.getElementById('vos-dm-lore-form');

export const loreRefreshEl = document.getElementById('vos-dm-lore-refresh');

export const loreStatusEl = document.getElementById('vos-dm-lore-status');

export const loreTitleEl = document.getElementById('vos-dm-lore-entry-title');

export const loreSlugEl = document.getElementById('vos-dm-lore-slug');

export const loreSummaryEl = document.getElementById('vos-dm-lore-summary');

export const loreMarkdownEl = document.getElementById('vos-dm-lore-markdown');

export const loreImagePromptEl = document.getElementById('vos-dm-lore-image-prompt');

export const loreImageEl = document.getElementById('vos-dm-lore-image');

export const loreRedraftEl = document.getElementById('vos-dm-lore-redraft');

export const loreSaveEl = document.getElementById('vos-dm-lore-save');

export const loreRejectEl = document.getElementById('vos-dm-lore-reject');

export const loreRejectReasonEl = document.getElementById('vos-dm-lore-reject-reason');

export const lorePublishEl = document.getElementById('vos-dm-lore-publish');

export function getToken(statusTarget) {
  if (!isSessionLive()) {
    if (statusTarget) {
      setStatus(statusTarget, 'Sign in as DM first.', true);
    }
    return null;
  }
  if (dmSession.cookie_auth) return COOKIE_AUTH_TOKEN;
  return dmSession.session_token;
}

export function isCookieAuthToken(token) {
  return token === COOKIE_AUTH_TOKEN;
}

export function authHeaders(token, headers) {
  return {
    ...(headers || {}),
    ...(token && !isCookieAuthToken(token) ? { 'Authorization': 'Bearer ' + token } : {}),
  };
}

export let googleClientId = null;

export async function bootAdminAuth() {
  const appSession = await fetch('/api/admin/session', { cache: 'no-store' }).catch(() => null);
  if (appSession && appSession.ok) {
    const data = await appSession.json().catch(() => ({}));
    if (data && data.signed_in && data.app_auth) {
      persistSession({
        session_token: '',
        cookie_auth: true,
        email: data.email || 'DM',
      });
      return;
    }
  }

  try {
    const r = await fetch('/api/admin/config', { cache: 'no-store' });
    if (!r.ok) throw new Error('admin/config ' + r.status);
    const data = await r.json();
    if (!data.configured) {
      authSignedOutEl.hidden = true;
      authBlockedEl.hidden = false;
      return;
    }
    googleClientId = data.google_client_id;
  } catch (e) {
    setStatus(authStatusEl, 'Could not reach the auth server.', true);
    return;
  }
  // If we already have a non-expired session, render that.
  if (isSessionLive()) {
    renderAuthState();
    // Server-side re-check so a revoked allowlist takes effect promptly.
    const r = await fetch('/api/admin/session', {
      cache: 'no-store',
      headers: dmSession.session_token ? { Authorization: 'Bearer ' + dmSession.session_token } : {},
    });
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      if (data && data.signed_in) return;
    }
    // Server rejected — wipe and prompt again.
    persistSession(null);
  }
  renderAuthState();
  initGoogleButton();
}

export function initGoogleButton() {
  if (!googleClientId || !googleButtonEl) return;
  // GIS loads async; retry until it's ready.
  if (!(window.google && window.google.accounts && window.google.accounts.id)) {
    setTimeout(initGoogleButton, 120);
    return;
  }
  googleButtonEl.innerHTML = '';
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential,
    ux_mode: 'popup',
    auto_select: false,
  });
  window.google.accounts.id.renderButton(googleButtonEl, {
    theme: 'filled_black',
    text: 'signin_with',
    size: 'large',
    shape: 'pill',
    logo_alignment: 'left',
  });
}

export async function handleGoogleCredential(response) {
  if (!response || !response.credential) {
    setStatus(authStatusEl, 'No credential returned from Google.', true);
    return;
  }
  setStatus(authStatusEl, 'Verifying with the server…');
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data.error || 'HTTP ' + r.status);
    }
    const ttlMs = (data.expires_in || (7 * 24 * 3600)) * 1000;
    persistSession({
      session_token: data.session_token,
      email: data.email,
      expires_at: Date.now() + ttlMs,
    });
    setStatus(authStatusEl, '');
  } catch (e) {
    setStatus(authStatusEl, e.message, true);
  }
}

export function signOut() {
  if (dmSession && dmSession.cookie_auth) {
    fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {});
  }
  persistSession(null);
  // Re-render the Google button so the user can sign back in.
  initGoogleButton();
  setStatus(authStatusEl, 'Signed out.');
}

if (signOutEl) signOutEl.addEventListener('click', signOut);

bootAdminAuth();

export function setStatus(target, text, isError) {
  if (!target) return;
  target.textContent = text || '';
  target.classList.toggle('is-error', !!isError);
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function adminJson(url, token, options) {
  const headers = authHeaders(token, options && options.headers);
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    // Session expired or revoked — wipe locally and force re-auth.
    persistSession(null);
    initGoogleButton();
    throw new Error(data.error || 'Session expired — sign in again.');
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export let rebuildPollTimer = null;

export function rebuildStatusText(rebuild) {
  if (!rebuild) return '';
  const state = rebuild.state || 'idle';
  if (state === 'queued') return 'Rebuild queued.';
  if (state === 'running') {
    const step = rebuild.current_step && rebuild.current_step !== 'starting'
      ? ` (${rebuild.current_step})`
      : '';
    return `Rebuild running${step}.`;
  }
  if (state === 'succeeded') return 'Rebuild complete.';
  if (state === 'failed') return `Rebuild failed: ${rebuild.error || 'check logs'}`;
  if (state === 'disabled') return 'Auto rebuild is disabled.';
  return '';
}

export function setStatusWithRebuild(target, base, rebuild) {
  const extra = rebuildStatusText(rebuild);
  setStatus(target, [base, extra].filter(Boolean).join(' '), rebuild && rebuild.state === 'failed');
}

export function pollRebuildStatus(target) {
  if (rebuildPollTimer) window.clearTimeout(rebuildPollTimer);
  const token = getToken(target);
  if (!token) return;
  rebuildPollTimer = window.setTimeout(async () => {
    try {
      const data = await adminJson('/api/admin/rebuild', token);
      const rebuild = data.rebuild || {};
      setStatusWithRebuild(target, '', rebuild);
      if (rebuild.state === 'queued' || rebuild.state === 'running') {
        pollRebuildStatus(target);
      }
    } catch (error) {
      setStatus(target, error.message, true);
    }
  }, 2500);
}

export async function triggerRebuild(target, reason) {
  const token = getToken(target);
  if (!token) return null;
  const data = await adminJson('/api/admin/rebuild', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, knowledge: true }),
  });
  const rebuild = data.rebuild || {};
  setStatusWithRebuild(target, '', rebuild);
  if (rebuild.state === 'queued' || rebuild.state === 'running') {
    pollRebuildStatus(target);
  }
  return rebuild;
}

export async function postJson(url, token, body) {
  return adminJson(url, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
