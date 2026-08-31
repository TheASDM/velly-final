import { PLAYER_KEY, PROFILE_AVATAR_FALLBACK, getStorage } from './core.js';
import { authHeaders, getAuthConfig, lookupRoster } from './identity.js';
import { authSession, getActivePlayerName } from './identity-modal.js';

/* The signed-in player's own uploaded avatar, once we have asked for it. */
let uploadedAvatar = null;

export async function syncUploadedAvatar() {
  const name = getStorage(PLAYER_KEY);
  if (!name) {
    uploadedAvatar = null;
    return;
  }
  try {
    const response = await fetch(`/api/profiles/${encodeURIComponent(name)}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const data = await response.json();
    const url = data.profile && data.profile.avatarUrl;
    if (url && url.startsWith('/api/') && url !== uploadedAvatar) {
      uploadedAvatar = url;
      updateProfileAvatar(name);
    } else if (!url || !url.startsWith('/api/')) {
      if (uploadedAvatar) {
        uploadedAvatar = null;
        updateProfileAvatar(name);
      }
    }
  } catch (error) { /* the curated portrait is a fine answer */ }
}

export function getProfileDisplayName(name) {
  const entry = lookupRoster(name);
  return (entry && entry.display) || name || '';
}

/* The avatar and the menu are one control now, so the face lives inside the
 * button that opens the menu rather than beside it. */
function identityButton() {
  return document.getElementById('vos-app-identity-button');
}

export function updateProfileAvatar(name) {
  const img = document.getElementById('vos-app-avatar-img');
  if (!identityButton() || !img) return;

  const displayName = getProfileDisplayName(name);
  const labelName = displayName || 'profile';
  const entry = lookupRoster(name);
  // An uploaded avatar wins over the curated portrait. Resolved lazily so
  // the first paint is never blocked on a request.
  const src = uploadedAvatar || (entry && entry.avatar) || PROFILE_AVATAR_FALLBACK;
  const alt = displayName || 'Unmapped profile';

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

export function updateIdentityControls(config = null) {
  const name = getActivePlayerName(config);
  const displayName = getProfileDisplayName(name);
  const label = document.getElementById('vos-app-identity-label');
  const button = identityButton();
  const text = name ? displayName : 'Log in';
  const action = name ? `Menu — ${displayName}` : 'Log in';

  if (label) label.textContent = text;
  if (button) {
    button.classList.toggle('is-authenticated', !!name);
    button.setAttribute('aria-label', action);
    button.title = action;
  }
  updateUserMenuState();
  updateProfileAvatar(name);
}

export function updateWikiEditLink() {
  const link = document.getElementById('vos-wiki-edit-link');
  if (!link) return;
  const name = getStorage(PLAYER_KEY);
  const isDm = !!((authSession && authSession.isDm) || name === 'DM');
  const wikiUrl = link.getAttribute('data-wiki-url') || window.location.pathname;
  link.hidden = !isDm;
  if (isDm && wikiUrl) {
    link.href = `/dm/?wiki=${encodeURIComponent(wikiUrl)}#vos-dm-wiki-title`;
  }
}

export function updateUserMenuState() {
  const name = getStorage(PLAYER_KEY);
  const menu = document.getElementById('vos-user-menu');
  const dmSection = document.getElementById('vos-user-menu-dm');
  const playerSection = document.getElementById('vos-user-menu-player');
  const settingsItem = document.getElementById('vos-user-menu-settings');
  const signInItem = document.getElementById('vos-user-menu-sign-in');
  const signOutItem = document.getElementById('vos-user-menu-sign-out');
  const displayNameEl = document.getElementById('vos-user-menu-name');
  const isDm = !!((authSession && authSession.isDm) || name === 'DM');
  // The two roles keep two lists. A player has no reason to read past their
  // own submissions; the DM has no character record to keep.
  if (dmSection) dmSection.hidden = !isDm;
  if (playerSection) playerSection.hidden = isDm || !name;
  if (settingsItem) {
    settingsItem.textContent = isDm ? 'Account Settings' : 'Settings';
    settingsItem.hidden = !name;
  }
  if (signInItem) signInItem.hidden = !!name;
  if (signOutItem) signOutItem.hidden = !name;
  if (displayNameEl) {
    displayNameEl.textContent = name ? getProfileDisplayName(name) : 'Not signed in';
    displayNameEl.href = name ? `/profile/?p=${encodeURIComponent(name)}` : '/profile/';
  }
  if (menu && !name) menu.hidden = true;
  updateWikiEditLink();
}

export function closeUserMenu() {
  const menu = document.getElementById('vos-user-menu');
  const button = document.getElementById('vos-app-identity-button');
  if (menu) menu.hidden = true;
  if (button) button.setAttribute('aria-expanded', 'false');
}

export function toggleUserMenu() {
  const menu = document.getElementById('vos-user-menu');
  const button = document.getElementById('vos-app-identity-button');
  if (!menu || !button) return;
  const open = menu.hidden;
  updateUserMenuState();
  menu.hidden = !open;
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* Named for what it does. It used to also light a green dot that was on
 * whenever you were signed in — an indicator with one state, costing a third
 * of your own face to say something the face already said. */
export async function refreshAvatar(config = null) {
  const activeConfig = config || await getAuthConfig();
  if (getActivePlayerName(activeConfig)) syncUploadedAvatar();
}
