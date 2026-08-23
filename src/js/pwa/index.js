import { AUTH_TOKEN_KEY, PLAYER_KEY, getStorage, renderSafeMarkdown } from './core.js';
import { initNextGathering } from './gathering.js';
import { announceIdentity, authHeaders, getAuthConfig, loadRoster, lookupRoster, roster } from './identity.js';
import { authSession, clearIdentity, ensureIdentity, getActivePlayerName, isAuthenticated, syncAuthSession } from './identity-modal.js';
import { closeUserMenu, getProfileDisplayName, syncAvatarBadge, toggleUserMenu, updateIdentityControls } from './profile.js';
import { disablePush, enablePush, getPushStatus, maybeShowPushPrompt, maybeSyncExistingSubscription } from './push.js';
import { initRsvpControls } from './rsvp.js';
import { enhanceWikiLinkedLists } from './wiki.js';

window.VOS_PWA = {
  getPlayerName: () => getStorage(PLAYER_KEY),
  getAuthToken: () => getStorage(AUTH_TOKEN_KEY),
  isAuthenticated: () => isAuthenticated(),
  isDm: () => !!((authSession && authSession.isDm) || getStorage(PLAYER_KEY) === 'DM'),
  getAuthSession: () => authSession,
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
  renderSafeMarkdown,
  initRsvpControls,
};

window.addEventListener('DOMContentLoaded', () => {
  enhanceWikiLinkedLists();
  initRsvpControls();
  initNextGathering();
  // The avatar button is now an <a href="/settings/"> — let the browser
  // navigate. Identity switching lives inside settings (and is still
  // reachable from the "Welcome, X" pill on the right of the app bar).
  const identityButton = document.getElementById('vos-app-identity-button');
  if (identityButton) {
    identityButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      const config = await getAuthConfig();
      if (!getActivePlayerName(config)) {
        await ensureIdentity({ force: true });
        return;
      }
      toggleUserMenu();
    });
  }
  const signInItem = document.getElementById('vos-user-menu-sign-in');
  if (signInItem) signInItem.addEventListener('click', (event) => {
    event.preventDefault();
    closeUserMenu();
    ensureIdentity({ force: true });
  });
  const signOutItem = document.getElementById('vos-user-menu-sign-out');
  if (signOutItem) signOutItem.addEventListener('click', (event) => {
    event.preventDefault();
    closeUserMenu();
    clearIdentity();
    announceIdentity(null);
  });
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('vos-user-menu');
    const button = document.getElementById('vos-app-identity-button');
    if (!menu || menu.hidden) return;
    if (menu.contains(event.target) || (button && button.contains(event.target))) return;
    closeUserMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeUserMenu();
  });
  // Load the player roster first so display names + avatars resolve on
  // the first paint, then fan out the rest of the startup work.
  loadRoster().then(() => {
    getAuthConfig().then(async (config) => {
      await syncAuthSession(config);
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
