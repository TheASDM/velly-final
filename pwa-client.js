(function () {
  const PLAYER_KEY = 'vos.playerName';
  const AUTH_TOKEN_KEY = 'vos.authToken';
  const PUSH_DISMISSED_KEY = 'vos.pushPromptDismissed';
  const DM_SEEN_KEY = 'vos.dmMessage.seenId';
  const STUDIO_SEEN_JOB_KEY = 'vos.studio.seenDoneJobId';
  const AUTH_CONFIG_CACHE_KEY = 'vos.authConfig.cache';
  const AUTH_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
  const ROSTER_URL = '/data/players.json';
  const PROFILE_AVATAR_FALLBACK = '/images/app-profiles/unmapped.png';

  // Player roster (display name + avatar) lives in _data/players.json and
  // is fetched once at startup. Used as a fallback list when /api/auth/config
  // is unreachable, and to resolve display names + avatars.
  let roster = [];
  let rosterPromise = null;

  function loadRoster() {
    if (rosterPromise) return rosterPromise;
    rosterPromise = fetch(ROSTER_URL, { cache: 'default' })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((data) => {
        roster = Array.isArray(data) ? data : [];
        return roster;
      });
    return rosterPromise;
  }

  function rosterNames() {
    return roster.map((p) => p.name);
  }

  function lookupRoster(name) {
    return roster.find((p) => p.name === name) || null;
  }

  let identityPromise = null;
  let authConfigPromise = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function getStorage(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function setStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (error) {}
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (error) {}
  }

  function announceIdentity(name) {
    window.dispatchEvent(new CustomEvent('vos:identity', { detail: { name } }));
  }

  function removeNode(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  // Read the most recent successful /api/auth/config response from
  // localStorage, returning null if missing or older than the cache TTL.
  function readAuthConfigCache() {
    try {
      const raw = getStorage(AUTH_CONFIG_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || !parsed.data) return null;
      if (Date.now() - parsed.ts > AUTH_CONFIG_CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) { return null; }
  }

  // Three attempts with exponential backoff (100ms, 300ms, 900ms). Only
  // retries on network errors or 5xx; 4xx returns short-circuit since they
  // won't get healthier on retry.
  async function fetchWithRetry(url, options, attempts) {
    const tries = attempts || 3;
    let lastError = null;
    for (let i = 0; i < tries; i += 1) {
      try {
        const response = await fetch(url, options);
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      if (i < tries - 1) {
        const delay = 100 * Math.pow(3, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Network failure');
  }

  async function getAuthConfig() {
    if (authConfigPromise) return authConfigPromise;
    authConfigPromise = (async () => {
      try {
        const response = await fetchWithRetry('/api/auth/config', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          try {
            setStorage(AUTH_CONFIG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
          } catch (e) {}
          hideConnectionBanner();
          return data;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        const cached = readAuthConfigCache();
        if (cached) return cached;
        showConnectionBanner();
        await loadRoster();
        return {
          loginRequired: false,
          authConfigured: true,
          players: rosterNames(),
        };
      }
    })();
    return authConfigPromise;
  }

  function authHeaders(headers = {}) {
    const token = getStorage(AUTH_TOKEN_KEY);
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  // Confine keyboard focus to `element` while a modal is open. Tab cycles
  // within the modal; Shift+Tab wraps backwards; Esc invokes onEscape.
  // Returns a release function that detaches the listener and restores
  // focus to whatever had it before the trap was installed.
  function trapFocus(element, options) {
    const opts = options || {};
    const previousFocus = document.activeElement;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function getFocusable() {
      return Array.from(element.querySelectorAll(focusableSelector));
    }

    function onKeyDown(event) {
      if (event.key === 'Escape' && typeof opts.onEscape === 'function') {
        event.preventDefault();
        opts.onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    element.addEventListener('keydown', onKeyDown);

    requestAnimationFrame(() => {
      const target = opts.initialFocus || getFocusable()[0];
      if (target && typeof target.focus === 'function') {
        try { target.focus(); } catch (e) {}
      }
    });

    return function release() {
      element.removeEventListener('keydown', onKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        try { previousFocus.focus(); } catch (e) {}
      }
    };
  }

  // Toast-style banner shown when /api/auth/config can't be reached and
  // the client is operating off cached or fallback data. Hidden again as
  // soon as a real config response arrives.
  function showConnectionBanner() {
    let banner = document.getElementById('vos-connection-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'vos-connection-banner';
      banner.className = 'vos-connection-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.textContent = 'Connection lost — using offline data.';
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  }

  function hideConnectionBanner() {
    const banner = document.getElementById('vos-connection-banner');
    if (banner) banner.hidden = true;
  }

  function clearIdentity() {
    removeStorage(PLAYER_KEY);
    removeStorage(AUTH_TOKEN_KEY);
    removeStorage(PUSH_DISMISSED_KEY);
    setAvatarBadge(false);
    updateIdentityControls();
  }

  function getActivePlayerName(config = null) {
    const name = getStorage(PLAYER_KEY);
    if (!name) return null;
    if (config && config.loginRequired && !getStorage(AUTH_TOKEN_KEY)) return null;
    return name;
  }

  function setAvatarBadge(active) {
    const badge = document.getElementById('vos-app-avatar-badge');
    if (badge) badge.hidden = !active;
  }

  function getProfileDisplayName(name) {
    const entry = lookupRoster(name);
    return (entry && entry.display) || name || '';
  }

  function updateProfileAvatar(name) {
    const profileButton = document.getElementById('vos-profile-button');
    const img = document.getElementById('vos-app-avatar-img');
    if (!profileButton || !img) return;

    const displayName = getProfileDisplayName(name);
    const labelName = displayName || 'profile';
    const entry = lookupRoster(name);
    const src = (entry && entry.avatar) || PROFILE_AVATAR_FALLBACK;
    const alt = displayName || 'Unmapped profile';
    profileButton.setAttribute('aria-label', name ? `Open profile — ${displayName}` : 'Log in');
    profileButton.title = name ? `Open profile — ${displayName}` : 'Log in';

    if (img.dataset.avatarSrc === src && img.classList.contains('is-loaded')) {
      img.alt = alt;
      return;
    }

    img.classList.remove('is-loaded');
    img.alt = labelName;
    img.dataset.avatarSrc = src;

    const probe = new Image();
    probe.onload = () => {
      if (img.dataset.avatarSrc !== src) return;
      img.src = src;
      img.alt = alt;
      img.classList.add('is-loaded');
    };
    probe.onerror = () => {
      if (src === PROFILE_AVATAR_FALLBACK || img.dataset.avatarSrc !== src) return;
      img.dataset.avatarSrc = PROFILE_AVATAR_FALLBACK;
      const fallback = new Image();
      fallback.onload = () => {
        if (img.dataset.avatarSrc !== PROFILE_AVATAR_FALLBACK) return;
        img.src = PROFILE_AVATAR_FALLBACK;
        img.alt = alt;
        img.classList.add('is-loaded');
      };
      fallback.src = PROFILE_AVATAR_FALLBACK;
    };
    probe.src = src;
  }

  function updateIdentityControls(config = null) {
    const name = getActivePlayerName(config);
    const displayName = getProfileDisplayName(name);
    const label = document.getElementById('vos-app-identity-label');
    const identityButton = document.getElementById('vos-app-identity-button');
    const profileButton = document.getElementById('vos-profile-button');
    const text = name ? `Welcome, ${displayName}` : 'Log in';
    const action = name ? 'Switch player' : 'Log in';

    if (label) label.textContent = text;
    if (identityButton) {
      identityButton.classList.toggle('is-authenticated', !!name);
      identityButton.setAttribute('aria-label', action);
      identityButton.title = action;
    }
    if (profileButton) {
      profileButton.setAttribute('aria-label', name ? `Open profile — ${displayName}` : action);
      profileButton.title = name ? `Open profile — ${displayName}` : action;
    }
    updateProfileAvatar(name);
  }

  async function syncAvatarBadge(config = null) {
    const activeConfig = config || await getAuthConfig();
    const name = getActivePlayerName(activeConfig);
    if (!name) {
      setAvatarBadge(false);
      return;
    }

    let hasBadge = false;
    try {
      const url = `/api/messages?limit=1&name=${encodeURIComponent(name)}`;
      const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data && data.messages && data.messages[0];
        if (message && message.id && getStorage(DM_SEEN_KEY) !== String(message.id)) {
          hasBadge = true;
        }
      }
    } catch (error) {}

    try {
      const url = `/api/studio/jobs?mine=1&name=${encodeURIComponent(name)}`;
      const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const done = jobs.find((job) => job.status === 'done');
        if (done && getStorage(STUDIO_SEEN_JOB_KEY) !== String(done.id || done.jobId)) {
          hasBadge = true;
        }
      }
    } catch (error) {}

    setAvatarBadge(hasBadge);
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      output[i] = rawData.charCodeAt(i);
    }
    return output;
  }

  function renderLegacyIdentity(card, resolve) {
    card.innerHTML = `
      <div class="vos-identity-title" id="vos-identity-title">Who are you?</div>
      <div class="vos-identity-options"></div>
    `;
    const options = card.querySelector('.vos-identity-options');
    rosterNames().forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', () => {
        setStorage(PLAYER_KEY, name);
        removeStorage(AUTH_TOKEN_KEY);
        updateIdentityControls({ loginRequired: false });
        announceIdentity(name);
        identityPromise = null;
        removeNode(card);
        resolve(name);
        maybeShowPushPrompt();
      });
      options.appendChild(button);
    });
  }

  function renderLoginIdentity(card, config, resolve) {
    const players = Array.isArray(config.players) && config.players.length ? config.players : rosterNames();
    const existing = getStorage(PLAYER_KEY);
    const titleText = existing ? 'Switch player' : 'Log in';
    const buttonText = existing ? 'Switch' : 'Log in';
    card.innerHTML = `
      <form class="vos-identity-form">
        <div class="vos-identity-title" id="vos-identity-title">${titleText}</div>
        <label class="vos-identity-field">
          <span>Player</span>
          <select name="name" required></select>
        </label>
        <label class="vos-identity-field">
          <span>Invite code</span>
          <input name="code" type="password" autocomplete="current-password" inputmode="text" required>
        </label>
        <div class="vos-identity-status" role="status" aria-live="polite"></div>
        <div class="vos-identity-actions">
          <button class="vos-identity-cancel" type="button">Cancel</button>
          <button class="vos-identity-submit" type="submit">${buttonText}</button>
        </div>
      </form>
    `;

    const form = card.querySelector('form');
    const select = card.querySelector('select[name="name"]');
    const codeInput = card.querySelector('input[name="code"]');
    const status = card.querySelector('.vos-identity-status');
    const cancel = card.querySelector('.vos-identity-cancel');
    const submit = card.querySelector('.vos-identity-submit');

    players.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === existing) option.selected = true;
      select.appendChild(option);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = select.value;
      const code = codeInput.value.trim();
      if (!name || !code) return;

      submit.disabled = true;
      status.textContent = 'Checking...';
      status.classList.remove('is-error');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, code }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setStorage(PLAYER_KEY, data.playerName || name);
        setStorage(AUTH_TOKEN_KEY, data.token || '');
        updateIdentityControls(config);
        announceIdentity(data.playerName || name);
        identityPromise = null;
        removeNode(card);
        resolve(data.playerName || name);
        maybeShowPushPrompt();
      } catch (error) {
        status.textContent = error.message || 'Login failed.';
        status.classList.add('is-error');
        submit.disabled = false;
      }
    });

    cancel.addEventListener('click', () => {
      const activeName = getActivePlayerName(config);
      identityPromise = null;
      removeNode(card);
      resolve(activeName);
    });

    codeInput.focus();
  }

  function ensureIdentity(options = {}) {
    if (identityPromise) return identityPromise;

    identityPromise = getAuthConfig().then((config) => new Promise((resolve) => {
      const existing = getStorage(PLAYER_KEY);
      const token = getStorage(AUTH_TOKEN_KEY);
      const loginRequired = !!config.loginRequired;
      if (existing && !options.force && (!loginRequired || token)) {
        updateIdentityControls(config);
        resolve(existing);
        return;
      }

      removeNode(document.querySelector('.vos-identity-card'));
      const card = document.createElement('div');
      card.className = 'vos-identity-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', 'vos-identity-title');

      document.body.appendChild(card);

      // Wrap resolve so the focus trap releases (and restores focus) the
      // instant any code path tears down the card. Each render function
      // calls resolve() right before removeNode(card), so wrapping resolve
      // covers cancel, successful login, and legacy player pick.
      let release = null;
      const wrappedResolve = (value) => {
        if (release) {
          try { release(); } catch (e) {}
          release = null;
        }
        resolve(value);
      };

      if (loginRequired) {
        renderLoginIdentity(card, config, wrappedResolve);
      } else {
        renderLegacyIdentity(card, wrappedResolve);
      }

      release = trapFocus(card, {
        onEscape: () => {
          wrappedResolve(getActivePlayerName(config));
          removeNode(card);
        },
      });
    })).finally(() => {
      identityPromise = null;
    });

    return identityPromise;
  }

  async function getPushConfig() {
    const response = await fetch('/api/push/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Push is unavailable.');
    return response.json();
  }

  async function registerSubscription(name, subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Could not save subscription.');
    }
  }

  function pushSupported() {
    return 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
  }

  // Resolves to one of: 'unsupported', 'denied', 'enabled', 'disabled'.
  // 'disabled' means the device could subscribe but hasn't.
  async function getPushStatus() {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return 'disabled';
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'enabled' : 'disabled';
  }

  // Subscribe this device to push. Throws on any failure (permission
  // denied, server misconfigured, no identity, etc.) — caller renders the
  // resulting message.
  async function enablePush() {
    const name = await ensureIdentity();
    if (!pushSupported()) {
      throw new Error('Push is not supported on this device.');
    }

    const config = await getPushConfig();
    if (!config.publicKey || !config.pushConfigured) {
      throw new Error('Push is not configured on this server.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission was not granted.');
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
    }

    await registerSubscription(name, subscription);
    setStorage(PUSH_DISMISSED_KEY, '1');
  }

  // Unsubscribe this device from push. The server-side record is left
  // alone (delivery will start failing, which is a cheap-to-clean signal).
  async function disablePush() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await subscription.unsubscribe();
  }

  async function maybeSyncExistingSubscription() {
    const config = await getAuthConfig();
    const name = getActivePlayerName(config);
    if (!name || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await registerSubscription(name, subscription).catch(() => null);
  }

  async function maybeShowPushPrompt() {
    if (!isStandalone()) return;
    if (getStorage(PUSH_DISMISSED_KEY) === '1') return;
    if (window.Notification && Notification.permission === 'denied') return;
    const authConfig = await getAuthConfig();
    if (!getActivePlayerName(authConfig)) return;

    const existing = document.getElementById('vos-push-card');
    if (existing) return;

    try {
      const config = await getPushConfig();
      if (!config.publicKey || !config.pushConfigured) return;
    } catch (error) {
      return;
    }

    const card = document.createElement('div');
    card.className = 'vos-push-card';
    card.id = 'vos-push-card';
    card.innerHTML = `
      <div class="vos-push-title">Session Reminders</div>
      <p class="vos-push-text">Enable session reminders on this device.</p>
      <div class="vos-push-status" aria-live="polite"></div>
      <div class="vos-push-actions">
        <button class="vos-push-enable" type="button">Enable</button>
        <button class="vos-push-dismiss" type="button" aria-label="Dismiss">×</button>
      </div>
    `;

    const enableButton = card.querySelector('.vos-push-enable');
    const dismissButton = card.querySelector('.vos-push-dismiss');
    const status = card.querySelector('.vos-push-status');

    document.body.appendChild(card);

    let releasePushTrap = null;
    const closeCard = () => {
      if (releasePushTrap) {
        try { releasePushTrap(); } catch (e) {}
        releasePushTrap = null;
      }
      removeNode(card);
    };

    enableButton.addEventListener('click', async () => {
      enableButton.disabled = true;
      status.textContent = 'Enabling...';
      try {
        await enablePush();
        status.textContent = 'Enabled on this device.';
        setTimeout(closeCard, 900);
      } catch (error) {
        enableButton.disabled = false;
        status.textContent = error.message;
      }
    });

    dismissButton.addEventListener('click', () => {
      setStorage(PUSH_DISMISSED_KEY, '1');
      closeCard();
    });

    releasePushTrap = trapFocus(card, {
      onEscape: () => {
        setStorage(PUSH_DISMISSED_KEY, '1');
        closeCard();
      },
    });
  }

  function enhanceWikiLinkedLists() {
    const shells = document.querySelectorAll('.vos-is-wiki-page .vos-page-shell:not(.vos-home-shell)');
    shells.forEach((shell) => {
      shell.querySelectorAll(':scope > ul, :scope > ol').forEach((list) => {
        const items = Array.from(list.children).filter((item) => item.matches('li'));
        if (items.length < 2) return;

        const linkedItems = items.filter((item) => item.querySelector('a[href]'));
        const mostlyLinks = linkedItems.length === items.length ||
          (linkedItems.length >= 3 && linkedItems.length / items.length >= 0.7);
        if (!mostlyLinks) return;

        list.classList.add('vos-linked-row-list');
        items.forEach((item) => {
          const firstLink = item.querySelector('a[href]');
          if (!firstLink) return;

          item.classList.add('vos-linked-row');
          item.setAttribute('role', 'link');
          item.setAttribute('tabindex', '0');
          item.addEventListener('click', (event) => {
            if (event.target.closest('a, button, input, textarea, select, label')) return;
            window.location.href = firstLink.href;
          });
          item.addEventListener('keydown', (event) => {
            if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            window.location.href = firstLink.href;
          });
        });
      });
    });
  }

  function initRsvpControls() {
    document.querySelectorAll('.vos-rsvp-control[data-event-id]').forEach((rsvp) => {
      if (rsvp.dataset.ready === '1') return;
      rsvp.dataset.ready = '1';

      const eventId = rsvp.getAttribute('data-event-id');
      const statusEl = rsvp.querySelector('.vos-rsvp-status');
      const buttons = Array.from(rsvp.querySelectorAll('[data-status]'));
      if (!eventId || !statusEl || !buttons.length) return;

      function setStatus(text, isError) {
        statusEl.textContent = text || '';
        statusEl.classList.toggle('is-error', !!isError);
      }

      function setSelected(status) {
        buttons.forEach((button) => {
          const active = button.dataset.status === status;
          button.classList.toggle('is-selected', active);
          button.setAttribute('aria-checked', active ? 'true' : 'false');
        });
      }

      async function getPlayerName() {
        if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
          return window.VOS_PWA.ensureIdentity();
        }
        return getStorage(PLAYER_KEY);
      }

      async function loadExisting(name) {
        if (!name) return;
        const url = `/api/rsvp?eventId=${encodeURIComponent(eventId)}&name=${encodeURIComponent(name)}`;
        const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
        if (response.status === 401 || response.status === 403) {
          clearIdentity();
          const newName = await ensureIdentity({ force: true });
          if (newName) await loadExisting(newName);
          return;
        }
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        if (data.status) setSelected(data.status);
      }

      buttons.forEach((button) => {
        button.addEventListener('click', async () => {
          const name = await getPlayerName();
          if (!name) {
            setStatus('Choose your name first.', true);
            return;
          }

          buttons.forEach((candidate) => { candidate.disabled = true; });
          setStatus('Saving...');

          try {
            const response = await fetch('/api/rsvp', {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                eventId,
                name,
                status: button.dataset.status,
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            setSelected(button.dataset.status);
            setStatus('Saved.');
          } catch (error) {
            setStatus(error.message, true);
          } finally {
            buttons.forEach((candidate) => { candidate.disabled = false; });
          }
        });
      });

      getPlayerName().then(loadExisting).catch(() => {});
    });
  }

  window.VOS_PWA = {
    getPlayerName: () => getStorage(PLAYER_KEY),
    getAuthToken: () => getStorage(AUTH_TOKEN_KEY),
    authHeaders,
    ensureIdentity,
    openIdentitySettings: () => ensureIdentity({ force: true }),
    signOut: clearIdentity,
    refreshAvatarBadge: () => syncAvatarBadge(),
    getPushStatus,
    enablePush,
    disablePush,
    getRoster: () => roster.slice(),
    lookupPlayer: lookupRoster,
    getProfileDisplayName,
  };

  window.addEventListener('DOMContentLoaded', () => {
    enhanceWikiLinkedLists();
    initRsvpControls();
    // The avatar button is now an <a href="/settings/"> — let the browser
    // navigate. Identity switching lives inside settings (and is still
    // reachable from the "Welcome, X" pill on the right of the app bar).
    const identityButton = document.getElementById('vos-app-identity-button');
    if (identityButton) {
      identityButton.addEventListener('click', () => ensureIdentity({ force: true }));
    }
    // Load the player roster first so display names + avatars resolve on
    // the first paint, then fan out the rest of the startup work.
    loadRoster().then(() => {
      getAuthConfig().then((config) => {
        updateIdentityControls(config);
        const activeName = getActivePlayerName(config);
        if (activeName) announceIdentity(activeName);
        syncAvatarBadge(config);
      });
      ensureIdentity();
      maybeSyncExistingSubscription();
      maybeShowPushPrompt();
    });
    window.addEventListener('vos:avatar-badge-refresh', () => syncAvatarBadge());
    window.addEventListener('focus', () => syncAvatarBadge());
  });
})();
