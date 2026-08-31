/* Where you were, kept in sessionStorage.
 *
 * A multi-page static site tears the panel down on every navigation, so the
 * open thread, its scroll position and any unsent draft are written here and
 * read back when the bubble reopens. That is as close to a persistent panel
 * as this shape of app gets. Session-scoped on purpose: closing the tab is
 * meant to forget. */

const KEY_PREFIX = 'vos:chat:state:';
const LEGACY_KEY = 'vos:chat:state';
let activeIdentity = null;

function emptyState() {
  return { openKey: null, scrollTop: {}, drafts: {} };
}

function stateKey(identity = activeIdentity) {
  return identity ? `${KEY_PREFIX}${encodeURIComponent(identity)}` : null;
}

/* Chrome, unlike conversation, is meant to be remembered. Where you dragged
 * the split is a preference, not a place in a thread, so it lives in
 * localStorage while everything above stays session-scoped. */
const LAYOUT_KEY = 'vos:chat:layout';

function read() {
  try {
    const key = stateKey();
    if (!key) return emptyState();
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      openKey: typeof parsed.openKey === 'string' ? parsed.openKey : null,
      scrollTop: parsed.scrollTop && typeof parsed.scrollTop === 'object' ? parsed.scrollTop : {},
      drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
    };
  } catch (error) {
    return emptyState();
  }
}

function write(state) {
  try {
    const key = stateKey();
    if (key) window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch (error) { /* private mode, quota — the panel still works */ }
}

export function setStateIdentity(identity) {
  activeIdentity = typeof identity === 'string' && identity ? identity : null;
  // The pre-isolation key may contain another seat's drafts. It has no safe
  // owner, so migrate by deletion rather than guessing.
  try { window.sessionStorage.removeItem(LEGACY_KEY); } catch (error) { /* unavailable */ }
}

export function clearChatState(identity = activeIdentity) {
  try {
    const key = stateKey(identity);
    if (key) window.sessionStorage.removeItem(key);
  } catch (error) { /* unavailable */ }
}

export function getOpenKey() {
  return read().openKey;
}

export function setOpenKey(key) {
  const state = read();
  state.openKey = key || null;
  write(state);
}

export function getDraft(key) {
  return (read().drafts || {})[key] || '';
}

export function setDraft(key, text) {
  const state = read();
  if (text) state.drafts[key] = text.slice(0, 4000);
  else delete state.drafts[key];
  write(state);
}

export function getScrollTop(key) {
  const value = (read().scrollTop || {})[key];
  return typeof value === 'number' ? value : null;
}

export function setScrollTop(key, value) {
  const state = read();
  state.scrollTop[key] = Math.max(0, Math.round(value || 0));
  write(state);
}

export function getListWidth() {
  try {
    const value = Number(window.localStorage.getItem(LAYOUT_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (error) {
    return null;
  }
}

export function setListWidth(px) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, String(Math.round(px)));
  } catch (error) { /* private mode — the split just resets next visit */ }
}
