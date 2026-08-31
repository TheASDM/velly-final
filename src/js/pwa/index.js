import { AUTH_TOKEN_KEY, PLAYER_KEY, getStorage, renderSafeMarkdown } from './core.js';
import { initNextGathering } from './gathering.js';
import { announceIdentity, authHeaders, getAuthConfig, loadRoster, lookupRoster, roster } from './identity.js';
import { authSession, clearIdentity, ensureIdentity, getActivePlayerName, isAuthenticated, syncAuthSession } from './identity-modal.js';
import { closeUserMenu, getProfileDisplayName, refreshAvatar, syncUploadedAvatar, toggleUserMenu, updateIdentityControls } from './profile.js';
import { disablePush, enablePush, getPushStatus, maybeShowPushPrompt, maybeSyncExistingSubscription } from './push.js';
import { initRsvpControls } from './rsvp.js';
import { enhanceWikiLinkedLists } from './wiki.js';
import { initCharacterBar } from './character-bar.js';
import { beginPreview, exitPreview, initPreview, isPreviewing, previewState } from './preview.js';
import { initEnzoActions, openEnzoThread } from './enzo-actions.js';

window.VOS_PWA = {
  getPlayerName: () => getStorage(PLAYER_KEY),
  getAuthToken: () => getStorage(AUTH_TOKEN_KEY),
  isAuthenticated: () => isAuthenticated(),
  /* A preview is not a DM, anywhere, for any purpose. The server refuses a
     preview token at every DM door; this is the same answer for the UI, so
     the two never disagree about what the reader is allowed to see. */
  isDm: () => !isPreviewing() && !!((authSession && authSession.isDm) || getStorage(PLAYER_KEY) === 'DM'),
  isPreviewing,
  getPreview: previewState,
  beginPreview,
  exitPreview,
  getAuthSession: () => authSession,
  authHeaders,
  ensureIdentity,
  openIdentitySettings: () => ensureIdentity({ force: true }),
  signOut: clearIdentity,
  refreshAvatar: () => refreshAvatar(),
  refreshUploadedAvatar: () => syncUploadedAvatar(),
  getPushStatus,
  enablePush,
  disablePush,
  getRoster: () => roster.slice(),
  lookupPlayer: lookupRoster,
  getProfileDisplayName,
  renderSafeMarkdown,
  initRsvpControls,
  openEnzoThread,
};

window.addEventListener('DOMContentLoaded', () => {
  // First, so no page paints a frame of a preview that looks like a real
  // signed-in session.
  initPreview();
  initEnzoActions();
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
  /* The menu's entry point is a door to the roster, not a picker of its own —
     the roster lives under Players in The Table, beside the sheets. */
  const previewItem = document.getElementById('vos-user-menu-preview');
  if (previewItem) previewItem.addEventListener('click', (event) => {
    event.preventDefault();
    closeUserMenu();
    window.location.href = '/party/?area=players';
  });
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
      refreshAvatar(config);
    });
    ensureIdentity();
    /* One role check owns the whole medallion — the ring, the number and the
       destination. Painting hit points and then relabelling the tab "The
       Table" was two decisions that disagreed. */
    initCharacterBar();
    maybeSyncExistingSubscription();
    maybeShowPushPrompt();
  });
  window.addEventListener('focus', () => refreshAvatar());
});
