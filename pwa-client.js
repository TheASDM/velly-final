(function () {
  const PLAYER_KEY = 'vos.playerName';
  const AUTH_TOKEN_KEY = 'vos.authToken';
  const PUSH_DISMISSED_KEY = 'vos.pushPromptDismissed';
  const PLAYERS = [
    'Caravel "Car" Asteri',
    'Kryton Novelli',
    'Lotan',
    'Noname',
    'Orabella',
    'Roxanya "Roxy"',
    'Valentro',
    'DM',
  ];
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

  async function getAuthConfig() {
    if (authConfigPromise) return authConfigPromise;
    authConfigPromise = fetch('/api/auth/config', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Login is unavailable.');
        return response.json();
      })
      .catch(() => ({
        loginRequired: false,
        authConfigured: true,
        players: PLAYERS,
      }));
    return authConfigPromise;
  }

  function authHeaders(headers = {}) {
    const token = getStorage(AUTH_TOKEN_KEY);
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  function clearIdentity() {
    removeStorage(PLAYER_KEY);
    removeStorage(AUTH_TOKEN_KEY);
    removeStorage(PUSH_DISMISSED_KEY);
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
    PLAYERS.forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', () => {
        setStorage(PLAYER_KEY, name);
        removeStorage(AUTH_TOKEN_KEY);
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
    const players = Array.isArray(config.players) && config.players.length ? config.players : PLAYERS;
    const existing = getStorage(PLAYER_KEY);
    card.innerHTML = `
      <form class="vos-identity-form">
        <div class="vos-identity-title" id="vos-identity-title">Log in</div>
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
          <button class="vos-identity-submit" type="submit">Log in</button>
        </div>
      </form>
    `;

    const form = card.querySelector('form');
    const select = card.querySelector('select[name="name"]');
    const codeInput = card.querySelector('input[name="code"]');
    const status = card.querySelector('.vos-identity-status');
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

    codeInput.focus();
  }

  function ensureIdentity(options = {}) {
    if (identityPromise) return identityPromise;

    identityPromise = getAuthConfig().then((config) => new Promise((resolve) => {
      const existing = getStorage(PLAYER_KEY);
      const token = getStorage(AUTH_TOKEN_KEY);
      const loginRequired = !!config.loginRequired;
      if (existing && !options.force && (!loginRequired || token)) {
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
      if (loginRequired) {
        renderLoginIdentity(card, config, resolve);
      } else {
        renderLegacyIdentity(card, resolve);
      }
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

  async function enablePush(button, status) {
    const name = await ensureIdentity();
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
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

    button.disabled = true;
    status.textContent = 'Enabling...';

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

  async function maybeSyncExistingSubscription() {
    const name = getStorage(PLAYER_KEY);
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
    if (!getStorage(PLAYER_KEY)) return;

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

    enableButton.addEventListener('click', async () => {
      try {
        await enablePush(enableButton, status);
        status.textContent = 'Enabled on this device.';
        setTimeout(() => removeNode(card), 900);
      } catch (error) {
        enableButton.disabled = false;
        status.textContent = error.message;
      }
    });

    dismissButton.addEventListener('click', () => {
      setStorage(PUSH_DISMISSED_KEY, '1');
      removeNode(card);
    });

    document.body.appendChild(card);
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
    ensureIdentity,
    openIdentitySettings: () => ensureIdentity({ force: true }),
    signOut: clearIdentity,
  };

  window.addEventListener('DOMContentLoaded', () => {
    enhanceWikiLinkedLists();
    initRsvpControls();
    const existingName = getStorage(PLAYER_KEY);
    if (existingName) announceIdentity(existingName);
    const profileButton = document.getElementById('vos-profile-button');
    if (profileButton) {
      profileButton.addEventListener('click', () => ensureIdentity({ force: true }));
    }
    ensureIdentity();
    maybeSyncExistingSubscription();
    maybeShowPushPrompt();
  });
})();
