import { PUSH_DISMISSED_KEY, getStorage, isStandalone, removeNode, setStorage, trapFocus, urlBase64ToUint8Array } from './core.js';
import { authHeaders, getAuthConfig } from './identity.js';
import { ensureIdentity, getActivePlayerName } from './identity-modal.js';

export async function getPushConfig() {
  const response = await fetch('/api/push/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Push is unavailable.');
  return response.json();
}

export async function registerSubscription(name, subscription) {
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

export function pushSupported() {
  return 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function getPushStatus() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return 'disabled';
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'enabled' : 'disabled';
}

export async function enablePush() {
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

export async function disablePush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
}

export async function maybeSyncExistingSubscription() {
  const config = await getAuthConfig();
  const name = getActivePlayerName(config);
  if (!name || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await registerSubscription(name, subscription).catch(() => null);
}

export async function maybeShowPushPrompt() {
  // Offer push anywhere the browser actually supports it. On iOS that
  // means the installed app only (Safari tabs can't subscribe — the
  // install card in pwa-manager.js handles the nudge there); desktop
  // browsers qualify without installing.
  const pushCapable = 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
  if (!pushCapable) return;
  const isIosBrowser = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIosBrowser && !isStandalone()) return;
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

window.addEventListener('vos:identity-ready', () => maybeShowPushPrompt());
