/* DM panel logic for /dm/. Extracted from dm.md so the browser can
 * cache it and the page markdown stays readable. No template values —
 * everything dynamic is read from the DOM or the API. */
(function () {
  const SESSION_KEY = 'vos.dmSession';
  const COOKIE_AUTH_TOKEN = '__vos_cookie_auth__';
  let dmSession = null;
  let adminDataLoaded = false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) dmSession = JSON.parse(raw);
  } catch (e) {}

  function persistSession(session) {
    dmSession = session;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    renderAuthState();
    if (isSessionLive()) loadAdminDataOnce();
  }

  function isSessionLive() {
    if (!dmSession || (!dmSession.session_token && !dmSession.cookie_auth)) return false;
    if (dmSession.cookie_auth) return true;
    if (dmSession.expires_at && Date.now() >= dmSession.expires_at) return false;
    return true;
  }

  function renderAuthState() {
    if (!authSignedOutEl) return;
    const live = isSessionLive();
    authSignedOutEl.hidden = live;
    authSignedInEl.hidden = !live;
    if (live) {
      authEmailEl.textContent = dmSession.email || 'DM';
    }
  }

  // Each tool view loads its data the first time it is shown, instead of
  // firing every fetch at sign-in.
  const loadedTabs = new Set();
  const TAB_LOADERS = {
    schedule: () => refreshCalendarEvents(),
    availability: () => refreshAvailabilitySummary(),
    rsvps: () => refreshRsvps(),
    message: () => {},
    history: () => refreshMessages(),
    push: () => refreshPushSubscribers(),
    wiki: () => {
      loadWikiPages();
      if (pendingWikiAutoLoad) {
        loadWikiEntry();
        pendingWikiAutoLoad = null;
      }
    },
    lore: () => {
      loadWikiPages(); // lore editor reuses the wiki page list
      refreshLoreSubmissions();
    },
    records: () => refreshQuestionnaires(),
    rumors: () => refreshRumors(),
    npc: () => {},
    inplay: () => {},
  };

  function loadTabData(view) {
    if (!isSessionLive() || loadedTabs.has(view) || !TAB_LOADERS[view]) return;
    loadedTabs.add(view);
    TAB_LOADERS[view]();
  }

  function activeTab() {
    const section = document.querySelector('[data-vos-view]:not([hidden])');
    return section ? section.dataset.vosView : 'schedule';
  }

  window.addEventListener('vos:view-shown', (event) => {
    loadTabData(event.detail.view);
  });

  function loadAdminDataOnce() {
    if (adminDataLoaded || !isSessionLive()) return;
    adminDataLoaded = true;
    // A ?page= deep link should land the DM in the wiki editor.
    if (pendingWikiAutoLoad && window.VOS_TABS) {
      window.VOS_TABS.show('wiki');
      return;
    }
    loadTabData(activeTab());
  }
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

  // DM auth UI: replaces the old admin-token text field. Once the user
  // completes Google sign-in we cache the server-signed JWT in
  // localStorage; from there every admin call sends Authorization:
  // Bearer <jwt>.
  const authSignedOutEl = document.getElementById('vos-dm-auth-signed-out');
  const authSignedInEl  = document.getElementById('vos-dm-auth-signed-in');
  const authBlockedEl   = document.getElementById('vos-dm-auth-blocked');
  const authEmailEl     = document.getElementById('vos-dm-auth-email');
  const authStatusEl    = document.getElementById('vos-dm-auth-status');
  const googleButtonEl  = document.getElementById('vos-dm-google-button');
  const signOutEl       = document.getElementById('vos-dm-sign-out');
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
  const calFormEl = document.getElementById('vos-dm-cal-form');
  const calDateEl = document.getElementById('vos-dm-cal-date');
  const calTitleEl = document.getElementById('vos-dm-cal-title');
  const calTimeEl = document.getElementById('vos-dm-cal-time');
  const calLocationEl = document.getElementById('vos-dm-cal-location');
  const calNotesEl = document.getElementById('vos-dm-cal-notes');
  const calKindEl = document.getElementById('vos-dm-cal-kind');
  const calTasksEl = document.getElementById('vos-dm-cal-tasks');
  const calSaveEl = document.getElementById('vos-dm-cal-save');
  const calCancelEl = document.getElementById('vos-dm-cal-cancel');
  const calEventsEl = document.getElementById('vos-dm-cal-events');
  const calStatusEl = document.getElementById('vos-dm-cal-status');
  const calRefreshEl = document.getElementById('vos-dm-cal-refresh');
  const pushSubsEl = document.getElementById('vos-dm-push-subs');
  const pushSubsStatusEl = document.getElementById('vos-dm-subs-status');
  const pushSubsRefreshEl = document.getElementById('vos-dm-subs-refresh');
  const rumorFormEl = document.getElementById('vos-dm-rumor-form');
  const rumorTextEl = document.getElementById('vos-dm-rumor-text');
  const rumorAddEl = document.getElementById('vos-dm-rumor-add');
  const rumorsListEl = document.getElementById('vos-dm-rumors-list');
  const rumorsStatusEl = document.getElementById('vos-dm-rumors-status');
  const rumorsRefreshEl = document.getElementById('vos-dm-rumors-refresh');
  const npcRollEl = document.getElementById('vos-dm-npc-roll');
  const npcResultEl = document.getElementById('vos-dm-npc-result');
  const recordsListEl = document.getElementById('vos-dm-records-list');
  const recordsStatusEl = document.getElementById('vos-dm-records-status');
  const recordsRefreshEl = document.getElementById('vos-dm-records-refresh');
  const availSummaryEl = document.getElementById('vos-dm-avail-summary');
  const availSubmittedEl = document.getElementById('vos-dm-avail-submitted');
  const availStatusEl = document.getElementById('vos-dm-avail-status');
  const availRefreshEl = document.getElementById('vos-dm-avail-refresh');
  const loreListEl = document.getElementById('vos-dm-lore-list');
  const loreBulkBarEl = document.getElementById('vos-dm-lore-bulk-bar');
  const loreSelectAllEl = document.getElementById('vos-dm-lore-select-all');
  const loreSelectCountEl = document.getElementById('vos-dm-lore-select-count');
  const loreBulkPublishEl = document.getElementById('vos-dm-lore-bulk-publish');
  const loreBulkRejectEl = document.getElementById('vos-dm-lore-bulk-reject');
  const selectedLoreIds = new Set();

  const wikiQueryEl = document.getElementById('vos-dm-wiki-query');
  const wikiLoadEl = document.getElementById('vos-dm-wiki-load');
  const wikiRebuildEl = document.getElementById('vos-dm-wiki-rebuild');
  const wikiForm = document.getElementById('vos-dm-wiki-form');
  const wikiContentRowEl = document.getElementById('vos-dm-wiki-content-row');
  const wikiContentEl = document.getElementById('vos-dm-wiki-content');
  const wikiMetaEl = document.getElementById('vos-dm-wiki-meta');
  const wikiOpenEl = document.getElementById('vos-dm-wiki-open');
  const wikiSaveEl = document.getElementById('vos-dm-wiki-save');
  const wikiStatusEl = document.getElementById('vos-dm-wiki-status');

  const inPlayListEl = document.getElementById('vos-dm-inplay-list');
  const inPlayStatusEl = document.getElementById('vos-dm-inplay-status');
  const inPlayAddEl = document.getElementById('vos-dm-inplay-add');
  const inPlayRefreshEl = document.getElementById('vos-dm-inplay-refresh');
  const inPlaySaveEl = document.getElementById('vos-dm-inplay-save');
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
  const loreRejectReasonEl = document.getElementById('vos-dm-lore-reject-reason');
  const lorePublishEl = document.getElementById('vos-dm-lore-publish');
  let selectedLoreId = null;
  let selectedLoreStatus = null;
  let loadedWikiEntry = null;
  let pendingWikiAutoLoad = null;
  let wikiPagesByTitle = null;
  let wikiPages = [];

  try {
    const params = new URLSearchParams(window.location.search);
    pendingWikiAutoLoad = params.get('wiki') || '';
    if (pendingWikiAutoLoad && wikiQueryEl) wikiQueryEl.value = pendingWikiAutoLoad;
  } catch (e) {}

  // Returns the session JWT to send as `Authorization: Bearer <token>`,
  // or null when the user is signed out. Mirrors the old getToken
  // signature so call sites stay tidy.
  function getToken(statusTarget) {
    if (!isSessionLive()) {
      if (statusTarget) {
        setStatus(statusTarget, 'Sign in as DM first.', true);
      }
      return null;
    }
    if (dmSession.cookie_auth) return COOKIE_AUTH_TOKEN;
    return dmSession.session_token;
  }

  function isCookieAuthToken(token) {
    return token === COOKIE_AUTH_TOKEN;
  }

  function authHeaders(token, headers) {
    return {
      ...(headers || {}),
      ...(token && !isCookieAuthToken(token) ? { 'Authorization': 'Bearer ' + token } : {}),
    };
  }

  // ── Google sign-in wiring ───────────────────────────────────────────
  let googleClientId = null;

  async function bootAdminAuth() {
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

  function initGoogleButton() {
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

  async function handleGoogleCredential(response) {
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

  function signOut() {
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

  let rebuildPollTimer = null;

  function rebuildStatusText(rebuild) {
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

  function setStatusWithRebuild(target, base, rebuild) {
    const extra = rebuildStatusText(rebuild);
    setStatus(target, [base, extra].filter(Boolean).join(' '), rebuild && rebuild.state === 'failed');
  }

  function pollRebuildStatus(target) {
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

  async function triggerRebuild(target, reason) {
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

  async function postJson(url, token, body) {
    return adminJson(url, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderMarkdown(s) {
    const renderer = window.VOS_RENDER_MARKDOWN || (window.VOS_PWA && window.VOS_PWA.renderSafeMarkdown);
    if (renderer) return renderer(s || '');
    return escapeHtml(s).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
  }

  function resolveWikiQuery(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.startsWith('/en/')) return raw;
    const exact = wikiPagesByTitle && wikiPagesByTitle.get(raw);
    if (exact) return exact.url;
    const lower = raw.toLowerCase();
    const match = wikiPages.find((entry) =>
      (entry.title || '').toLowerCase() === lower ||
      (entry.url || '').toLowerCase() === lower
    );
    return match ? match.url : null;
  }

  function renderWikiEntry(entry) {
    loadedWikiEntry = entry;
    wikiContentEl.value = entry.content || '';
    wikiContentRowEl.hidden = false;
    wikiSaveEl.disabled = false;
    wikiOpenEl.hidden = !entry.url;
    if (entry.url) wikiOpenEl.href = entry.url;
    const title = entry.title || entry.url || 'Wiki entry';
    wikiMetaEl.innerHTML = `${escapeHtml(title)} · <code>${escapeHtml(entry.source_file || '')}</code>`;
  }

  async function loadWikiEntry() {
    const token = getToken(wikiStatusEl);
    if (!token) return;
    await loadWikiPages();
    const wikiUrl = resolveWikiQuery(wikiQueryEl.value);
    loadedWikiEntry = null;
    wikiContentEl.value = '';
    wikiContentRowEl.hidden = true;
    wikiOpenEl.hidden = true;
    wikiSaveEl.disabled = true;
    wikiMetaEl.textContent = '';
    if (!wikiUrl) {
      setStatus(wikiStatusEl, 'Choose a known wiki page or paste a /en/... URL.', true);
      return;
    }
    wikiLoadEl.disabled = true;
    setStatus(wikiStatusEl, 'Loading wiki source...');
    try {
      const data = await adminJson(`/api/admin/wiki-entry?url=${encodeURIComponent(wikiUrl)}`, token);
      renderWikiEntry(data.entry || {});
      if (wikiQueryEl.value.trim().startsWith('/en/')) {
        wikiQueryEl.value = (data.entry && data.entry.url) || wikiUrl;
      }
      setStatus(wikiStatusEl, 'Loaded.');
    } catch (error) {
      setStatus(wikiStatusEl, error.message, true);
    } finally {
      wikiLoadEl.disabled = false;
      wikiSaveEl.disabled = !loadedWikiEntry;
    }
  }

  async function saveWikiEntry(event) {
    event.preventDefault();
    const token = getToken(wikiStatusEl);
    if (!token || !loadedWikiEntry) return;
    if (!window.confirm('Save this wiki source file?')) return;
    wikiSaveEl.disabled = true;
    setStatus(wikiStatusEl, 'Saving wiki source...');
    try {
      const data = await adminJson('/api/admin/wiki-entry', token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: loadedWikiEntry.url,
          content: wikiContentEl.value,
          expected_hash: loadedWikiEntry.hash,
        }),
      });
      renderWikiEntry(data.entry || {});
      setStatusWithRebuild(wikiStatusEl, 'Saved.', data.rebuild);
      if (data.rebuild && (data.rebuild.state === 'queued' || data.rebuild.state === 'running')) {
        pollRebuildStatus(wikiStatusEl);
      }
    } catch (error) {
      setStatus(wikiStatusEl, error.message, true);
    } finally {
      wikiSaveEl.disabled = false;
    }
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
      await adminJson(`/api/admin/messages/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
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
    // Drop any selections that aren't in the new list anymore (e.g.,
    // after a refresh that removed published / rejected items).
    const incomingIds = new Set(submissions.map((s) => s.id));
    for (const id of Array.from(selectedLoreIds)) {
      if (!incomingIds.has(id)) selectedLoreIds.delete(id);
    }

    if (!submissions.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-dm-empty';
      empty.textContent = 'No lore submissions yet.';
      loreListEl.appendChild(empty);
      loreForm.hidden = true;
      selectedLoreId = null;
      selectedLoreStatus = null;
      updateBulkBar();
      return;
    }

    submissions.forEach((submission) => {
      const row = document.createElement('div');
      row.className = 'vos-dm-submission-row';
      row.dataset.id = submission.id;

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'vos-dm-submission-check';
      check.checked = selectedLoreIds.has(submission.id);
      check.setAttribute('aria-label', `Select ${submission.title || 'submission'}`);
      check.addEventListener('change', () => {
        if (check.checked) selectedLoreIds.add(submission.id);
        else selectedLoreIds.delete(submission.id);
        updateBulkBar();
      });

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

      row.append(check, button);
      loreListEl.appendChild(row);
    });

    updateBulkBar();
  }

  function updateBulkBar() {
    if (!loreBulkBarEl) return;
    const rows = loreListEl.querySelectorAll('.vos-dm-submission-row');
    const hasRows = rows.length > 0;
    loreBulkBarEl.hidden = !hasRows;
    if (!hasRows) return;
    const count = selectedLoreIds.size;
    loreSelectCountEl.textContent = count === 0
      ? '0 selected'
      : `${count} selected`;
    loreBulkPublishEl.disabled = count === 0;
    loreBulkRejectEl.disabled = count === 0;
    // Header checkbox reflects the "select-all" state of visible rows.
    let allChecked = true;
    let anyChecked = false;
    rows.forEach((row) => {
      const cb = row.querySelector('.vos-dm-submission-check');
      if (cb && cb.checked) anyChecked = true;
      else allChecked = false;
    });
    loreSelectAllEl.checked = anyChecked && allChecked;
    loreSelectAllEl.indeterminate = anyChecked && !allChecked;
  }

  function toggleSelectAll() {
    const rows = loreListEl.querySelectorAll('.vos-dm-submission-row');
    const target = loreSelectAllEl.checked;
    rows.forEach((row) => {
      const id = row.dataset.id;
      const cb = row.querySelector('.vos-dm-submission-check');
      if (!cb) return;
      cb.checked = target;
      if (target) selectedLoreIds.add(id);
      else selectedLoreIds.delete(id);
    });
    updateBulkBar();
  }

  async function bulkPublishSelected() {
    const token = getToken(loreStatusEl);
    if (!token) return;
    const ids = Array.from(selectedLoreIds);
    if (!ids.length) return;
    const confirmText = ids.length === 1
      ? 'Publish 1 submission to the wiki?'
      : `Publish ${ids.length} submissions to the wiki?`;
    if (!window.confirm(confirmText)) return;

    loreBulkPublishEl.disabled = true;
    loreBulkRejectEl.disabled = true;
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      setStatus(loreStatusEl, `Publishing ${i + 1} / ${ids.length}...`);
      try {
        // Empty body — server falls back to stored title/slug/markdown/etc.
        // Retry once with overwrite=true so already-published rows refresh.
        try {
          await postJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}/publish`, token, { auto_rebuild: false });
        } catch (firstError) {
          await postJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}/publish`, token, { overwrite: true, auto_rebuild: false });
        }
        ok += 1;
      } catch (error) {
        failed += 1;
      }
    }
    selectedLoreIds.clear();
    await refreshLoreSubmissions();
    setStatus(
      loreStatusEl,
      failed
        ? `Published ${ok}, ${failed} failed.`
        : `Published ${ok}.`,
      failed > 0
    );
    if (ok > 0) {
      try {
        await triggerRebuild(loreStatusEl, `bulk lore publish: ${ok}`);
      } catch (error) {
        setStatus(loreStatusEl, error.message, true);
      }
    }
  }

  async function bulkRejectSelected() {
    const token = getToken(loreStatusEl);
    if (!token) return;
    const ids = Array.from(selectedLoreIds);
    if (!ids.length) return;
    const reason = window.prompt(
      `Reject ${ids.length === 1 ? '1 submission' : ids.length + ' submissions'}. Reason shown to players (optional):`,
      ''
    );
    // prompt() returns null on Cancel, '' on empty OK
    if (reason === null) return;
    const trimmed = reason.trim();

    loreBulkPublishEl.disabled = true;
    loreBulkRejectEl.disabled = true;
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      setStatus(loreStatusEl, `Rejecting ${i + 1} / ${ids.length}...`);
      try {
        await postJson(
          `/api/admin/lore-submissions/${encodeURIComponent(id)}/reject`,
          token,
          trimmed ? { reason: trimmed } : {}
        );
        ok += 1;
      } catch (error) {
        failed += 1;
      }
    }
    selectedLoreIds.clear();
    await refreshLoreSubmissions();
    setStatus(
      loreStatusEl,
      failed
        ? `Rejected ${ok}, ${failed} failed.`
        : `Rejected ${ok}.`,
      failed > 0
    );
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
    const reason = (loreRejectReasonEl && loreRejectReasonEl.value || '').trim();
    const confirmText = reason
      ? `Reject this submission with the reason above? The player will see it.`
      : 'Reject without a reason? (The player will only see "Rejected by DM".)';
    if (!window.confirm(confirmText)) return;
    loreRejectEl.disabled = true;
    setStatus(loreStatusEl, 'Rejecting...');
    try {
      await postJson(
        `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/reject`,
        token,
        reason ? { reason } : {}
      );
      if (loreRejectReasonEl) loreRejectReasonEl.value = '';
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
      setStatusWithRebuild(loreStatusEl, `Published: ${data.url}.`, data.rebuild);
      if (data.rebuild && (data.rebuild.state === 'queued' || data.rebuild.state === 'running')) {
        pollRebuildStatus(loreStatusEl);
      }
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
    // RSVPs are keyed to the next scheduled session in calendar_events.
    let eventId = null;
    let gatheringDate = '';
    try {
      const nextResponse = await fetch('/api/calendar/next', { cache: 'no-store' });
      const nextData = await nextResponse.json().catch(() => ({}));
      if (nextResponse.ok && nextData.gathering) {
        eventId = nextData.gathering.eventKey;
        gatheringDate = nextData.gathering.date;
      }
    } catch (error) { /* handled below */ }
    if (!eventId) {
      setStatus(rsvpStatusEl, 'No upcoming session is scheduled, so there is nothing to RSVP to.', true);
      return;
    }
    const rsvpHeading = document.getElementById('vos-dm-rsvp-title');
    if (rsvpHeading && gatheringDate) {
      rsvpHeading.textContent = 'RSVP Summary — ' + new Date(gatheringDate + 'T00:00:00')
        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    rsvpRefreshEl.disabled = true;
    setStatus(rsvpStatusEl, 'Loading...');

    try {
      const response = await fetch(`/api/rsvp?eventId=${encodeURIComponent(eventId)}`, {
        headers: authHeaders(token),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        persistSession(null);
        initGoogleButton();
        throw new Error(data.error || 'Session expired — sign in again.');
      }
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

  // ── Calendar events + availability (mirrors the /calendar page range:
  //    current month through the end of month + 2) ─────────────────────
  const AVAIL_RANGE = (() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth() + 3, 0)),
    };
  })();

  function prettyDate(isoDate) {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  let editingEventId = null;

  // Tasks are edited as plain lines; an optional "| YYYY-MM-DD" suffix
  // becomes the due date. Mirrors the server's {text, due} shape.
  function parseTaskLines(text) {
    return String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => {
        const match = line.match(/^(.*?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*$/);
        return match ? { text: match[1].trim(), due: match[2] } : { text: line };
      })
      .filter((task) => task.text);
  }

  function taskLines(tasks) {
    return (tasks || [])
      .map((task) => (task.due ? `${task.text} | ${task.due}` : task.text))
      .join('\n');
  }

  function enterEditMode(event) {
    editingEventId = event.id;
    calDateEl.value = event.date;
    calTitleEl.value = event.title;
    calTimeEl.value = event.timeLabel || '';
    calLocationEl.value = event.location || '';
    calNotesEl.value = event.notes || '';
    calKindEl.value = event.kind;
    if (calTasksEl) calTasksEl.value = taskLines(event.tasks);
    calSaveEl.textContent = 'Save Changes';
    if (calCancelEl) calCancelEl.hidden = false;
    setStatus(calStatusEl, `Editing "${event.title}".`);
    calFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitEditMode() {
    editingEventId = null;
    calFormEl.reset();
    calSaveEl.textContent = 'Add to Calendar';
    if (calCancelEl) calCancelEl.hidden = true;
  }

  async function refreshCalendarEvents() {
    setStatus(calStatusEl, 'Loading...');
    try {
      const response = await fetch(
        `/api/calendar/events?from=${AVAIL_RANGE.from}`,
        { cache: 'no-store' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      calEventsEl.innerHTML = '';
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const nextSession = (data.events || []).find(
        (event) => event.kind === 'session' && event.date >= todayIso
      );
      (data.events || []).forEach((event) => {
        const li = document.createElement('li');
        li.className = 'vos-dm-cal-event';
        const when = document.createElement('strong');
        when.textContent = prettyDate(event.date);
        const what = document.createElement('span');
        what.textContent = [event.title, event.timeLabel, event.location]
          .filter(Boolean).join(' · ');
        li.append(when, what);
        if (nextSession && event.id === nextSession.id) {
          const badge = document.createElement('span');
          badge.className = 'vos-dm-cal-next-badge';
          badge.textContent = 'Next Gathering';
          li.appendChild(badge);
        }
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => enterEditMode(event));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => deleteCalendarEvent(event));
        li.append(edit, remove);
        calEventsEl.appendChild(li);
      });
      if (!calEventsEl.children.length) {
        const li = document.createElement('li');
        li.className = 'vos-dm-avail-empty';
        li.textContent = 'Nothing scheduled from this month on.';
        calEventsEl.appendChild(li);
      }
      setStatus(calStatusEl, '');
    } catch (error) {
      setStatus(calStatusEl, error.message, true);
    }
  }

  async function saveCalendarEvent(eventArg) {
    eventArg.preventDefault();
    const token = getToken(calStatusEl);
    if (!token) return;
    if (!calDateEl.value || !calTitleEl.value.trim()) {
      setStatus(calStatusEl, 'Date and title are required.', true);
      return;
    }
    calSaveEl.disabled = true;
    setStatus(calStatusEl, 'Saving...');
    try {
      const url = editingEventId
        ? `/api/calendar/events/${editingEventId}`
        : '/api/calendar/events';
      const response = await fetch(url, {
        method: editingEventId ? 'PUT' : 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          date: calDateEl.value,
          title: calTitleEl.value.trim(),
          timeLabel: calTimeEl.value.trim(),
          location: calLocationEl.value.trim(),
          notes: calNotesEl.value.trim(),
          kind: calKindEl.value,
          tasks: calTasksEl ? parseTaskLines(calTasksEl.value) : [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const wasEdit = !!editingEventId;
      exitEditMode();
      setStatus(calStatusEl, wasEdit ? 'Updated.' : 'Scheduled.');
      await refreshCalendarEvents();
    } catch (error) {
      setStatus(calStatusEl, error.message, true);
    } finally {
      calSaveEl.disabled = false;
    }
  }

  async function deleteCalendarEvent(event) {
    const token = getToken(calStatusEl);
    if (!token) return;
    if (!window.confirm(`Delete "${event.title}" on ${prettyDate(event.date)}?`)) return;
    setStatus(calStatusEl, 'Deleting...');
    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (editingEventId === event.id) exitEditMode();
      setStatus(calStatusEl, 'Deleted.');
      await refreshCalendarEvents();
    } catch (error) {
      setStatus(calStatusEl, error.message, true);
    }
  }

  async function refreshQuestionnaires() {
    const token = getToken(recordsStatusEl);
    if (!token) return;
    setStatus(recordsStatusEl, 'Loading...');
    try {
      const response = await fetch('/api/questionnaire/all', {
        headers: authHeaders(token),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const byPlayer = {};
      (data.records || []).forEach((record) => {
        byPlayer[record.playerName] = record;
      });
      recordsListEl.innerHTML = '';
      DEFAULT_PLAYERS.filter((name) => name !== 'DM').forEach((name) => {
        const record = byPlayer[name];
        const li = document.createElement('li');
        const who = document.createElement('strong');
        who.textContent = name;
        const status = document.createElement('span');
        if (!record) {
          status.textContent = 'not started';
        } else if (record.status === 'submitted') {
          status.textContent = 'sealed ' + new Date(record.submitted_at).toLocaleDateString();
        } else {
          status.textContent = 'draft · ' + new Date(record.updated_at).toLocaleDateString();
        }
        li.append(who, status);
        recordsListEl.appendChild(li);
      });
      setStatus(recordsStatusEl, 'Updated.');
    } catch (error) {
      setStatus(recordsStatusEl, error.message, true);
    }
  }

  // ── Push subscribers ────────────────────────────────────────────────

  async function refreshPushSubscribers() {
    const token = getToken(pushSubsStatusEl);
    if (!token) return;
    setStatus(pushSubsStatusEl, 'Loading...');
    try {
      const response = await fetch('/api/push/subscribers', {
        headers: authHeaders(token),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      pushSubsEl.innerHTML = '';
      (data.subscribed || []).forEach((sub) => {
        const li = document.createElement('li');
        const who = document.createElement('strong');
        who.textContent = sub.player;
        const status = document.createElement('span');
        status.textContent = sub.devices === 1 ? '1 device' : `${sub.devices} devices`;
        li.append(who, status);
        pushSubsEl.appendChild(li);
      });
      (data.missing || []).forEach((name) => {
        const li = document.createElement('li');
        li.style.opacity = '0.55';
        const who = document.createElement('strong');
        who.textContent = name;
        const status = document.createElement('span');
        status.textContent = 'no alerts';
        li.append(who, status);
        pushSubsEl.appendChild(li);
      });
      if (!pushSubsEl.children.length) {
        const li = document.createElement('li');
        li.textContent = 'Nobody has enabled alerts yet.';
        pushSubsEl.appendChild(li);
      }
      setStatus(pushSubsStatusEl, 'Stale devices only get pruned when a push to them fails.');
    } catch (error) {
      setStatus(pushSubsStatusEl, error.message, true);
    }
  }

  // ── Tavern rumors ───────────────────────────────────────────────────

  async function refreshRumors() {
    const token = getToken(rumorsStatusEl);
    if (!token) return;
    setStatus(rumorsStatusEl, 'Loading...');
    try {
      const response = await fetch('/api/rumors', {
        headers: authHeaders(token),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      rumorsListEl.innerHTML = '';
      (data.rumors || []).forEach((rumor) => {
        const li = document.createElement('li');
        li.className = 'vos-dm-cal-event';
        const text = document.createElement('span');
        text.textContent = rumor.text;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => deleteRumor(rumor));
        li.append(text, remove);
        rumorsListEl.appendChild(li);
      });
      if (!rumorsListEl.children.length) {
        const li = document.createElement('li');
        li.className = 'vos-dm-avail-empty';
        li.textContent = 'No rumors on the wind. Add some.';
        rumorsListEl.appendChild(li);
      }
      setStatus(rumorsStatusEl, '');
    } catch (error) {
      setStatus(rumorsStatusEl, error.message, true);
    }
  }

  async function addRumor(eventArg) {
    eventArg.preventDefault();
    const token = getToken(rumorsStatusEl);
    if (!token) return;
    const text = rumorTextEl.value.trim();
    if (!text) {
      setStatus(rumorsStatusEl, 'Write the rumor first.', true);
      return;
    }
    rumorAddEl.disabled = true;
    setStatus(rumorsStatusEl, 'Adding...');
    try {
      const response = await fetch('/api/rumors', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      rumorTextEl.value = '';
      setStatus(rumorsStatusEl, 'Added.');
      await refreshRumors();
    } catch (error) {
      setStatus(rumorsStatusEl, error.message, true);
    } finally {
      rumorAddEl.disabled = false;
    }
  }

  async function deleteRumor(rumor) {
    const token = getToken(rumorsStatusEl);
    if (!token) return;
    setStatus(rumorsStatusEl, 'Deleting...');
    try {
      const response = await fetch(`/api/rumors/${rumor.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setStatus(rumorsStatusEl, 'Deleted.');
      await refreshRumors();
    } catch (error) {
      setStatus(rumorsStatusEl, error.message, true);
    }
  }

  // ── Quick NPC (client-side mash of the questionnaire roll tables) ────

  let npcTables = null;

  async function rollNpc() {
    if (!npcTables) {
      try {
        const response = await fetch('/data/questionnaire.json', { cache: 'default' });
        const data = await response.json();
        npcTables = data.tables || {};
      } catch (error) {
        npcTables = null;
        if (npcResultEl) npcResultEl.textContent = 'Could not load the tables.';
        return;
      }
    }
    const pick = (name) => {
      const table = npcTables[name] || [];
      return table[Math.floor(Math.random() * table.length)] || '';
    };
    const card = document.createElement('div');
    card.className = 'vos-dm-npc-card';
    const who = document.createElement('strong');
    who.textContent = `${pick('npcFirst')} ${pick('npcFamily')} — ${pick('npcRole')}`;
    const detail = document.createElement('div');
    detail.textContent = `Tell: ${pick('tells')} Mark: ${pick('marks')}. Voice: ${pick('voice')}`;
    card.append(who, detail);
    const placeholder = npcResultEl.querySelector('.vos-dm-avail-empty');
    if (placeholder) placeholder.remove();
    npcResultEl.prepend(card);
    while (npcResultEl.children.length > 5) npcResultEl.lastChild.remove();
  }

  function availabilityChip(entry) {
    const chip = document.createElement('span');
    chip.className = `vos-dm-avail-chip is-${entry.rating}`;
    const symbols = { preferred: '★', available: '✓', unavailable: '✕' };
    chip.textContent = `${symbols[entry.rating]} ${entry.player}`;
    return chip;
  }

  async function refreshAvailabilitySummary() {
    const token = getToken(availStatusEl);
    if (!token) return;
    setStatus(availStatusEl, 'Loading...');
    try {
      const response = await fetch(
        `/api/availability/summary?from=${AVAIL_RANGE.from}&to=${AVAIL_RANGE.to}`,
        { headers: authHeaders(token), cache: 'no-store' }
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        persistSession(null);
        initGoogleButton();
        throw new Error(data.error || 'Session expired — sign in again.');
      }
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      const days = data.days || {};
      const submitted = data.submitted || [];

      // Who has and hasn't weighed in (the DM doesn't count).
      const submittedNames = new Set(submitted.map((s) => s.player));
      const missing = DEFAULT_PLAYERS.filter(
        (name) => name !== 'DM' && !submittedNames.has(name)
      );
      availSubmittedEl.innerHTML = '';
      const submittedLine = document.createElement('div');
      submittedLine.append('Submitted: ');
      const submittedStrong = document.createElement('strong');
      submittedStrong.textContent = submitted.length
        ? submitted.map((s) => s.player).join(', ')
        : 'nobody yet';
      submittedLine.appendChild(submittedStrong);
      availSubmittedEl.appendChild(submittedLine);
      if (missing.length) {
        const missingLine = document.createElement('div');
        missingLine.append('Waiting on: ');
        const missingStrong = document.createElement('strong');
        missingStrong.textContent = missing.join(', ');
        missingLine.appendChild(missingStrong);
        availSubmittedEl.appendChild(missingLine);
      }

      const weekendDays = [];
      const weekdayDays = [];
      Object.keys(days).sort().forEach((dateIso) => {
        const dow = new Date(dateIso + 'T00:00:00').getDay();
        (dow === 0 || dow === 6 ? weekendDays : weekdayDays).push(dateIso);
      });

      availSummaryEl.innerHTML = '';

      const weekendGroup = document.createElement('div');
      weekendGroup.className = 'vos-dm-avail-group';
      const weekendHeading = document.createElement('h3');
      weekendHeading.textContent = 'Weekends (best first)';
      weekendGroup.appendChild(weekendHeading);
      const scored = weekendDays.map((dateIso) => {
        const entries = days[dateIso];
        const counts = { preferred: 0, available: 0, unavailable: 0 };
        entries.forEach((entry) => { counts[entry.rating] += 1; });
        return {
          dateIso,
          entries,
          counts,
          score: counts.preferred * 2 + counts.available - counts.unavailable * 3,
        };
      }).sort((a, b) => b.score - a.score || a.dateIso.localeCompare(b.dateIso));
      scored.forEach((day) => {
        const box = document.createElement('div');
        box.className = 'vos-dm-avail-day';
        const head = document.createElement('div');
        head.className = 'vos-dm-avail-day-head';
        const label = document.createElement('strong');
        label.textContent = prettyDate(day.dateIso);
        const score = document.createElement('span');
        score.className = 'vos-dm-avail-score';
        score.textContent =
          `★${day.counts.preferred} ✓${day.counts.available} ✕${day.counts.unavailable}`;
        head.append(label, score);
        const chips = document.createElement('div');
        chips.className = 'vos-dm-avail-chips';
        day.entries.forEach((entry) => chips.appendChild(availabilityChip(entry)));
        box.append(head, chips);
        const withTimes = day.entries.filter((entry) => entry.times && entry.times.length);
        if (withTimes.length) {
          const times = document.createElement('div');
          times.className = 'vos-dm-avail-times';
          times.textContent = withTimes
            .map((entry) => `${entry.player}: ${entry.times.join(', ')}`)
            .join(' · ');
          box.appendChild(times);
        }
        weekendGroup.appendChild(box);
      });
      if (!scored.length) {
        const empty = document.createElement('div');
        empty.className = 'vos-dm-avail-empty';
        empty.textContent = 'No weekend availability submitted yet.';
        weekendGroup.appendChild(empty);
      }
      availSummaryEl.appendChild(weekendGroup);

      const weekdayGroup = document.createElement('div');
      weekdayGroup.className = 'vos-dm-avail-group';
      const weekdayHeading = document.createElement('h3');
      weekdayHeading.textContent = 'Weekday evening conflicts';
      weekdayGroup.appendChild(weekdayHeading);
      weekdayDays.forEach((dateIso) => {
        const box = document.createElement('div');
        box.className = 'vos-dm-avail-day';
        const head = document.createElement('div');
        head.className = 'vos-dm-avail-day-head';
        const label = document.createElement('strong');
        label.textContent = prettyDate(dateIso);
        head.appendChild(label);
        const chips = document.createElement('div');
        chips.className = 'vos-dm-avail-chips';
        days[dateIso].forEach((entry) => chips.appendChild(availabilityChip(entry)));
        box.append(head, chips);
        weekdayGroup.appendChild(box);
      });
      if (!weekdayDays.length) {
        const empty = document.createElement('div');
        empty.className = 'vos-dm-avail-empty';
        empty.textContent = 'No weekday conflicts reported.';
        weekdayGroup.appendChild(empty);
      }
      availSummaryEl.appendChild(weekdayGroup);

      setStatus(availStatusEl, 'Updated.');
    } catch (error) {
      setStatus(availStatusEl, error.message, true);
    }
  }

  rsvpRefreshEl.addEventListener('click', refreshRsvps);
  calFormEl.addEventListener('submit', saveCalendarEvent);
  if (calCancelEl) calCancelEl.addEventListener('click', exitEditMode);
  calRefreshEl.addEventListener('click', refreshCalendarEvents);
  availRefreshEl.addEventListener('click', refreshAvailabilitySummary);
  if (recordsRefreshEl) recordsRefreshEl.addEventListener('click', refreshQuestionnaires);
  if (rumorFormEl) rumorFormEl.addEventListener('submit', addRumor);
  if (rumorsRefreshEl) rumorsRefreshEl.addEventListener('click', refreshRumors);
  if (npcRollEl) npcRollEl.addEventListener('click', rollNpc);
  if (pushSubsRefreshEl) pushSubsRefreshEl.addEventListener('click', refreshPushSubscribers);
  historyRefreshEl.addEventListener('click', refreshMessages);
  showDeletedEl.addEventListener('change', refreshMessages);
  loreRefreshEl.addEventListener('click', refreshLoreSubmissions);
  loreSaveEl.addEventListener('click', saveLoreSubmission);
  loreRedraftEl.addEventListener('click', redraftLoreSubmission);
  loreRejectEl.addEventListener('click', rejectLoreSubmission);
  loreForm.addEventListener('submit', publishLoreSubmission);
  if (loreSelectAllEl) loreSelectAllEl.addEventListener('change', toggleSelectAll);
  if (loreBulkPublishEl) loreBulkPublishEl.addEventListener('click', bulkPublishSelected);
  if (loreBulkRejectEl) loreBulkRejectEl.addEventListener('click', bulkRejectSelected);
  if (wikiLoadEl) wikiLoadEl.addEventListener('click', loadWikiEntry);
  if (wikiRebuildEl) wikiRebuildEl.addEventListener('click', async () => {
    wikiRebuildEl.disabled = true;
    setStatus(wikiStatusEl, 'Starting rebuild...');
    try {
      await triggerRebuild(wikiStatusEl, 'manual wiki editor rebuild');
    } catch (error) {
      setStatus(wikiStatusEl, error.message, true);
    } finally {
      wikiRebuildEl.disabled = false;
    }
  });
  if (wikiForm) wikiForm.addEventListener('submit', saveWikiEntry);
  if (wikiQueryEl) {
    wikiQueryEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadWikiEntry();
      }
    });
  }

  // ── Currently In Play editor ──────────────────────────────────────
  const EMBLEM_PRESETS = ['PC', 'NPC', 'DM', 'Loc', 'Fac', 'Lore', 'Item', 'Map', 'Cre', 'Cul', 'Gov', 'Ses', 'Upd', 'Tbl'];
  const EMBLEM_SKIP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'on', 'to']);

  // Best-effort 2-3 char emblem from a name: initials of significant
  // words, or the first 2 chars when there's only one word. Used as the
  // "Auto" fallback when the DM hasn't picked a preset.
  function autoEmblem(name) {
    const words = String(name || '')
      .replace(/['']/g, '')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w && !EMBLEM_SKIP_WORDS.has(w));
    if (!words.length) return '';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
  }

  async function loadWikiPages() {
    if (wikiPagesByTitle) return wikiPagesByTitle;
    try {
      const response = await fetch('/data/wiki-pages.json', { cache: 'default' });
      if (!response.ok) return new Map();
      const data = await response.json();
      wikiPages = Array.isArray(data) ? data : [];
      const map = new Map();
      const datalists = [
        document.getElementById('vos-dm-inplay-pages'),
        document.getElementById('vos-dm-wiki-pages'),
      ].filter(Boolean);
      datalists.forEach((datalist) => { datalist.innerHTML = ''; });
      wikiPages.forEach((entry) => {
        if (!entry || !entry.title) return;
        map.set(entry.title, entry);
        datalists.forEach((datalist) => {
          const option = document.createElement('option');
          option.value = entry.title;
          option.label = entry.url || '';
          datalist.appendChild(option);
        });
      });
      wikiPagesByTitle = map;
      return map;
    } catch (error) {
      return new Map();
    }
  }

  function buildEmblemOptions(currentEmblem) {
    const seen = new Set();
    const options = [{ value: '', label: 'Auto (from name)' }];
    EMBLEM_PRESETS.forEach((e) => {
      if (!seen.has(e)) { seen.add(e); options.push({ value: e, label: e }); }
    });
    // Keep the existing emblem visible if it's not in the preset list
    // (e.g. legacy two-letter codes like FW / OV / CC). Add it as its own
    // option above "Custom" so the dropdown round-trips cleanly.
    if (currentEmblem && !seen.has(currentEmblem) && currentEmblem !== '__custom__') {
      options.push({ value: currentEmblem, label: currentEmblem });
      seen.add(currentEmblem);
    }
    options.push({ value: '__custom__', label: 'Custom…' });
    return options;
  }

  function renderInPlayRow(item) {
    const row = document.createElement('div');
    row.className = 'vos-dm-inplay-row';
    const initialEmblem = (item && item.emblem) || '';
    const optionsHtml = buildEmblemOptions(initialEmblem)
      .map((o) => `<option value="${o.value}"${o.value === initialEmblem ? ' selected' : ''}>${o.label}</option>`)
      .join('');

    row.innerHTML =
      `<input class="vos-dm-inplay-name" list="vos-dm-inplay-pages" placeholder="Pick a wiki entry or type a custom name" maxlength="120">` +
      `<input class="vos-dm-inplay-role" placeholder="Role / context (e.g. 'Missing fiance')" maxlength="120">` +
      `<select class="vos-dm-inplay-emblem-select">${optionsHtml}</select>` +
      `<input class="vos-dm-inplay-emblem-custom" placeholder="2-3 char" maxlength="8" hidden>` +
      `<button class="vos-dm-button is-danger" type="button" aria-label="Remove row">×</button>` +
      `<input type="hidden" class="vos-dm-inplay-link">` +
      `<input type="hidden" class="vos-dm-inplay-kind">`;

    const nameEl = row.querySelector('.vos-dm-inplay-name');
    const roleEl = row.querySelector('.vos-dm-inplay-role');
    const linkEl = row.querySelector('.vos-dm-inplay-link');
    const kindEl = row.querySelector('.vos-dm-inplay-kind');
    const emblemSelectEl = row.querySelector('.vos-dm-inplay-emblem-select');
    const emblemCustomEl = row.querySelector('.vos-dm-inplay-emblem-custom');

    if (item) {
      nameEl.value = item.name || '';
      roleEl.value = item.role || '';
      linkEl.value = item.link || '';
      kindEl.value = item.kind || '';
    }

    // Sync the link/kind hidden fields whenever the title matches a known
    // wiki entry. Manually-typed entries leave them blank — the in-play
    // chip just shows the name without a hyperlink.
    function syncWikiLookup() {
      if (!wikiPagesByTitle) return;
      const match = wikiPagesByTitle.get(nameEl.value.trim());
      if (match) {
        linkEl.value = match.url || '';
        kindEl.value = match.kind || '';
        row.classList.add('is-wiki-linked');
      } else {
        if (linkEl.value && wikiPagesByTitle.has(nameEl.dataset.lastMatchedTitle || '')) {
          linkEl.value = '';
          kindEl.value = '';
        }
        row.classList.remove('is-wiki-linked');
      }
      nameEl.dataset.lastMatchedTitle = match ? match.title : '';
    }
    nameEl.addEventListener('input', syncWikiLookup);
    nameEl.addEventListener('change', syncWikiLookup);
    syncWikiLookup();

    function syncEmblemCustomVisibility() {
      emblemCustomEl.hidden = emblemSelectEl.value !== '__custom__';
    }
    emblemSelectEl.addEventListener('change', syncEmblemCustomVisibility);
    syncEmblemCustomVisibility();

    row.querySelector('button').addEventListener('click', () => row.remove());
    return row;
  }

  function renderInPlayList(items) {
    inPlayListEl.innerHTML = '';
    (items || []).forEach((item) => inPlayListEl.appendChild(renderInPlayRow(item)));
  }

  async function refreshInPlay() {
    setStatus(inPlayStatusEl, 'Loading...');
    try {
      await loadWikiPages();
      const response = await fetch('/api/in-play', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      renderInPlayList(data.items || []);
      setStatus(inPlayStatusEl, `Loaded ${data.items ? data.items.length : 0} rows.`);
    } catch (error) {
      setStatus(inPlayStatusEl, error.message, true);
    }
  }

  async function saveInPlay() {
    const token = getToken(inPlayStatusEl);
    if (!token) return;
    const rows = Array.from(inPlayListEl.querySelectorAll('.vos-dm-inplay-row'));
    const items = rows.map((row) => {
      const name = row.querySelector('.vos-dm-inplay-name').value.trim();
      const role = row.querySelector('.vos-dm-inplay-role').value.trim();
      const link = row.querySelector('.vos-dm-inplay-link').value.trim();
      const kind = row.querySelector('.vos-dm-inplay-kind').value.trim();
      const selectVal = row.querySelector('.vos-dm-inplay-emblem-select').value;
      const customVal = row.querySelector('.vos-dm-inplay-emblem-custom').value.trim();
      let emblem = '';
      if (selectVal === '__custom__') emblem = customVal;
      else if (selectVal) emblem = selectVal;
      else emblem = autoEmblem(name);
      return { name, role, kind, emblem, link };
    }).filter((item) => item.name);

    inPlaySaveEl.disabled = true;
    setStatus(inPlayStatusEl, 'Saving...');
    try {
      const data = await adminJson('/api/in-play', token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      setStatus(inPlayStatusEl, `Saved ${data.count || 0} rows.`);
      await refreshInPlay();
    } catch (error) {
      setStatus(inPlayStatusEl, error.message, true);
    } finally {
      inPlaySaveEl.disabled = false;
    }
  }

  if (inPlayAddEl) inPlayAddEl.addEventListener('click', () => {
    inPlayListEl.appendChild(renderInPlayRow(null));
  });
  if (inPlayRefreshEl) inPlayRefreshEl.addEventListener('click', refreshInPlay);
  if (inPlaySaveEl) inPlaySaveEl.addEventListener('click', saveInPlay);
  // Load once on page open so the DM sees the current saved list.
  if (inPlayListEl) refreshInPlay();

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
    loadAdminDataOnce();
  });
})();
