(function () {
  const PLAYER_KEY = 'vos.playerName';
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

  function removeNode(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
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

  function ensureIdentity() {
    const existing = getStorage(PLAYER_KEY);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const card = document.createElement('div');
      card.className = 'vos-identity-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', 'vos-identity-title');
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
          removeNode(card);
          resolve(name);
          maybeShowPushPrompt();
        });
        options.appendChild(button);
      });

      document.body.appendChild(card);
    });
  }

  async function getPushConfig() {
    const response = await fetch('/api/push/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Push is unavailable.');
    return response.json();
  }

  async function registerSubscription(name, subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  window.VOS_PWA = {
    getPlayerName: () => getStorage(PLAYER_KEY),
    ensureIdentity,
  };

  window.addEventListener('DOMContentLoaded', () => {
    ensureIdentity();
    maybeSyncExistingSubscription();
    maybeShowPushPrompt();
  });
})();
