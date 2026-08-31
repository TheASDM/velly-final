/* One auth: the DM console rides the same VOS_PWA identity as every other
 * page. The server has always accepted the DM's player token on the admin
 * endpoints — the old parallel vos.dmSession (Google GSI button, session
 * JWT, separate expiry) was client-only complexity, and its failure modes
 * (hidden auth panels, empty Google button, unnoticed expiry) came with it.
 *
 * There is always a rendered auth state: signed out, signed in as the DM,
 * or signed in as someone else. No network call gates the rendering. */

import {
  authBlockedEl, authEmailEl, authPanelEl, authSignedOutEl, authStatusEl,
  setStatus, signInEl, switchAccountEl,
} from './dom.js';
import { whenPwaReady } from '../shared/pwa.js';

let pwa = null;
let live = false;
const liveHooks = [];
const deadHooks = [];

export function isSessionLive() {
  return live;
}

/* Multiple subscribers, unlike the old single-slot hook that let a second
 * subscriber silently overwrite the first. A hook registered after the
 * session is already live runs immediately. */
export function onSessionLive(hook) {
  liveHooks.push(hook);
  if (live) {
    try { hook(); } catch (error) { /* a broken hook must not block others */ }
  }
}

export function onSessionDead(hook) {
  deadHooks.push(hook);
}

export function authHeaders(headers) {
  if (pwa && pwa.authHeaders) return pwa.authHeaders(headers || {});
  return headers || {};
}

/* Gate for panel actions: shows the sign-in nudge in the panel's own status
 * line when the DM seat isn't live. */
export function ensureLive(statusTarget) {
  if (!live) setStatus(statusTarget, 'Sign in as the DM first.', true);
  return live;
}

export function dmDisplayName() {
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  return name || 'DM';
}

function computeLive() {
  if (!pwa) return false;
  const name = pwa.getPlayerName && pwa.getPlayerName();
  if (!name) return false;
  return name === 'DM' || !!(pwa.isDm && pwa.isDm());
}

/* The panel is only worth its space when something is wrong. Signed in, it
 * said "Signed in as DM" under an app bar already reading DM, beside a menu
 * already offering Sign out — a screenful of a fact you could see. */
function renderAuthState() {
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (authSignedOutEl) authSignedOutEl.hidden = !!name;
  if (authBlockedEl) authBlockedEl.hidden = !name || live;
  if (authPanelEl) authPanelEl.hidden = live;
  if (live && authEmailEl) authEmailEl.textContent = name || 'DM';
}

function syncSession() {
  const wasLive = live;
  live = computeLive();
  renderAuthState();
  if (live && !wasLive) {
    setStatus(authStatusEl, '');
    liveHooks.forEach((hook) => {
      try { hook(); } catch (error) { /* isolate hooks from each other */ }
    });
  }
  if (!live && wasLive) {
    deadHooks.forEach((hook) => {
      try { hook(); } catch (error) { /* same */ }
    });
  }
}

/* Called by the HTTP layer on a 401: the token the PWA holds is stale or
 * revoked. Drop to signed-out locally and say why — the old console kept
 * saying "Signed in" while every request failed. */
export function sessionExpired(message) {
  const wasLive = live;
  live = false;
  renderAuthState();
  if (authPanelEl) authPanelEl.hidden = false;
  if (authSignedOutEl) authSignedOutEl.hidden = false;
  if (authBlockedEl) authBlockedEl.hidden = true;
  setStatus(authStatusEl, message || 'Session expired — sign in again.', true);
  if (wasLive) {
    deadHooks.forEach((hook) => {
      try { hook(); } catch (error) { /* same */ }
    });
  }
}

async function requestSignIn() {
  if (!pwa || !pwa.ensureIdentity) return;
  await pwa.ensureIdentity({ force: true });
  syncSession();
}

export async function bootAdminAuth() {
  pwa = await whenPwaReady();
  if (!pwa) {
    if (authSignedOutEl) authSignedOutEl.hidden = false;
    setStatus(authStatusEl, 'The app shell failed to load — refresh the page.', true);
    return;
  }
  if (signInEl) signInEl.addEventListener('click', requestSignIn);
  if (switchAccountEl) switchAccountEl.addEventListener('click', requestSignIn);
  window.addEventListener('vos:identity', syncSession);
  syncSession();
}
