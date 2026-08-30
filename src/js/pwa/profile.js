import { PLAYER_KEY, PROFILE_AVATAR_FALLBACK, getStorage } from './core.js';
import { getAuthConfig, lookupRoster } from './identity.js';
import { authSession, getActivePlayerName } from './identity-modal.js';

export function setAvatarBadge(active) {
  const badge = document.getElementById('vos-app-avatar-badge');
  if (badge) badge.hidden = !active;
}

export function getProfileDisplayName(name) {
  const entry = lookupRoster(name);
  return (entry && entry.display) || name || '';
}

export function updateProfileAvatar(name) {
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

export function updateIdentityControls(config = null) {
  const name = getActivePlayerName(config);
  const displayName = getProfileDisplayName(name);
  const label = document.getElementById('vos-app-identity-label');
  const identityButton = document.getElementById('vos-app-identity-button');
  const profileButton = document.getElementById('vos-profile-button');
  const text = name ? displayName : 'Log in';
  const action = name ? `Menu — ${displayName}` : 'Log in';

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
  const signInItem = document.getElementById('vos-user-menu-sign-in');
  const signOutItem = document.getElementById('vos-user-menu-sign-out');
  const displayNameEl = document.getElementById('vos-user-menu-name');
  const isDm = !!((authSession && authSession.isDm) || name === 'DM');
  if (dmSection) dmSection.hidden = !isDm;
  if (signInItem) signInItem.hidden = !!name;
  if (signOutItem) signOutItem.hidden = !name;
  if (displayNameEl) displayNameEl.textContent = name ? getProfileDisplayName(name) : 'Not signed in';
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

export async function syncAvatarBadge(config = null) {
  const activeConfig = config || await getAuthConfig();
  const name = getActivePlayerName(activeConfig);
  setAvatarBadge(!!name);
}
