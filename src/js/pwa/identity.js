import { AUTH_CONFIG_CACHE_KEY, AUTH_CONFIG_CACHE_TTL_MS, AUTH_TOKEN_KEY, ROSTER_URL, getStorage, setStorage } from './core.js';
import { authSession, isAuthenticated } from './identity-modal.js';

export let roster = [];

export let rosterPromise = null;

export let authReturnStatus;

export function loadRoster() {
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

export function rosterNames() {
  return roster.map((p) => p.name);
}

export function lookupRoster(name) {
  return roster.find((p) => p.name === name) || null;
}

export let authConfigPromise = null;

export function getAuthReturnStatus() {
  if (authReturnStatus !== undefined) return authReturnStatus;
  try {
    const url = new URL(window.location.href);
    authReturnStatus = url.searchParams.get('auth') || '';
    if (authReturnStatus && window.history && window.history.replaceState) {
      url.searchParams.delete('auth');
      const cleaned = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', cleaned);
    }
  } catch (error) {
    authReturnStatus = '';
  }
  return authReturnStatus;
}

export function renderAuthReturnStatus(statusEl) {
  if (!statusEl) return;
  const status = getAuthReturnStatus();
  if (!status) return;
  if (status === 'ok') {
    statusEl.textContent = 'Discord approved the login, but this browser did not keep the session. Try again.';
    statusEl.classList.add('is-error');
    return;
  }
  statusEl.textContent = 'That OAuth account is not mapped to a Foglight player yet.';
  statusEl.classList.add('is-error');
}

export function announceIdentity(name) {
  window.dispatchEvent(new CustomEvent('vos:identity', {
    detail: {
      name,
      isDm: !!(authSession && authSession.isDm),
      authenticated: isAuthenticated(),
    },
  }));
}

export function readAuthConfigCache() {
  try {
    const raw = getStorage(AUTH_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts || !parsed.data) return null;
    if (Date.now() - parsed.ts > AUTH_CONFIG_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (e) { return null; }
}

export async function fetchWithRetry(url, options, attempts) {
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

export async function getAuthConfig() {
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

export function authHeaders(headers = {}) {
  const token = getStorage(AUTH_TOKEN_KEY);
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

export function showConnectionBanner() {
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

export function hideConnectionBanner() {
  const banner = document.getElementById('vos-connection-banner');
  if (banner) banner.hidden = true;
}
