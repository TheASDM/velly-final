import { AUTH_TOKEN_KEY, PLAYER_KEY, PUSH_DISMISSED_KEY, getStorage, removeNode, removeStorage, setStorage, trapFocus } from './core.js';
import { announceIdentity, getAuthConfig, renderAuthReturnStatus, rosterNames } from './identity.js';
import { setAvatarBadge, updateIdentityControls } from './profile.js';
import { maybeShowPushPrompt } from './push.js';
import { previewState } from './preview.js';

export let authSession = null;

export let identityPromise = null;

export function clearIdentity() {
  removeStorage(PLAYER_KEY);
  removeStorage(AUTH_TOKEN_KEY);
  removeStorage(PUSH_DISMISSED_KEY);
  authSession = null;
  fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {});
  setAvatarBadge(false);
  updateIdentityControls();
}

export function getActivePlayerName(config = null) {
  const name = getStorage(PLAYER_KEY);
  if (!name) return null;
  if (config && config.loginRequired && !getStorage(AUTH_TOKEN_KEY) && !(authSession && authSession.ok)) return null;
  return name;
}

export function isAuthenticated(config = null) {
  const name = getStorage(PLAYER_KEY);
  if (!name) return false;
  if (config && config.loginRequired === false) return true;
  return !!(getStorage(AUTH_TOKEN_KEY) || (authSession && authSession.ok));
}

export async function syncAuthSession(config = null) {
  /* While previewing, the session is the preview and nothing else gets a
     vote. /api/auth/session answers from the cookie, which is still the DM's
     — asking it here would put the DM's name back over the player's. */
  const preview = previewState();
  if (preview) {
    authSession = {
      ok: true,
      loginRequired: true,
      playerName: preview.player,
      isDm: false,
      preview: true,
      previewActor: preview.actor,
    };
    return authSession;
  }
  const activeConfig = config || await getAuthConfig();
  if (!activeConfig.loginRequired) {
    authSession = { ok: true, loginRequired: false, isDm: getStorage(PLAYER_KEY) === 'DM' };
    return authSession;
  }
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) {
      authSession = null;
      removeStorage(AUTH_TOKEN_KEY);
      return null;
    }
    const data = await response.json().catch(() => null);
    if (data && data.playerName) {
      authSession = data;
      setStorage(PLAYER_KEY, data.playerName);
      return authSession;
    }
  } catch (error) {}
  authSession = null;
  return null;
}

export function renderLegacyIdentity(card, resolve) {
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

export function renderLoginIdentity(card, config, resolve) {
  const providers = Array.isArray(config.providers) ? config.providers : [];
  const players = Array.isArray(config.players) && config.players.length ? config.players : rosterNames();
  const existing = getStorage(PLAYER_KEY);
  const titleText = existing ? 'Switch player' : 'Log in';
  const buttonText = existing ? 'Switch' : 'Log in';
  const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  const providerHtml = providers.length ? `
      <div class="vos-identity-oauth-options">
        ${providers.map((provider) => {
          const href = `${provider.login_url}?next=${next}`;
          const primary = provider.primary ? ' is-primary' : '';
          const disabled = provider.configured ? '' : ' is-disabled';
          const label = provider.label || `Continue with ${provider.id}`;
          return provider.configured
            ? `<a class="vos-identity-oauth${primary}" href="${href}">${label}</a>`
            : `<span class="vos-identity-oauth${disabled}">${label} unavailable</span>`;
        }).join('')}
      </div>
    ` : '';

  if (providerHtml && !config.legacyCodeLogin) {
    card.innerHTML = `
      <div class="vos-identity-form">
        <div class="vos-identity-title" id="vos-identity-title">${titleText}</div>
        ${providerHtml}
        <div class="vos-identity-status" role="status" aria-live="polite"></div>
        <div class="vos-identity-actions">
          <button class="vos-identity-cancel" type="button">Cancel</button>
        </div>
      </div>
    `;
    const cancelOnly = card.querySelector('.vos-identity-cancel');
    renderAuthReturnStatus(card.querySelector('.vos-identity-status'));
    cancelOnly.addEventListener('click', () => {
      const activeName = getActivePlayerName(config);
      identityPromise = null;
      removeNode(card);
      resolve(activeName);
    });
    return;
  }

  card.innerHTML = `
    <form class="vos-identity-form">
      <div class="vos-identity-title" id="vos-identity-title">${titleText}</div>
      ${providerHtml}
      ${providerHtml ? '<div class="vos-identity-divider">or use an invite code</div>' : ''}
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
  renderAuthReturnStatus(status);

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
      authSession = {
        ok: true,
        playerName: data.playerName || name,
        isDm: (data.playerName || name) === 'DM',
        loginRequired: true,
      };
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

export function ensureIdentity(options = {}) {
  if (identityPromise) return identityPromise;

  identityPromise = getAuthConfig().then(async (config) => {
    await syncAuthSession(config);
    return new Promise((resolve) => {
    const existing = getStorage(PLAYER_KEY);
    const loginRequired = !!config.loginRequired;
    if (existing && !options.force && (!loginRequired || isAuthenticated(config))) {
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
  });
  }).finally(() => {
    identityPromise = null;
  });

  return identityPromise;
}
