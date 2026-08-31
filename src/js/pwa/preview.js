/* Preview as a player.
 *
 * The old version of this was a link on The Table — "View" — that opened one
 * player's sheet with ?as= in the address. It answered "what does their sheet
 * say", which is a smaller question than "what does their app look like", and
 * it only worked on the one page that knew about the parameter.
 *
 * This is a credential instead of a flag. The server mints a short-lived
 * token that IS that player (POST /api/auth/preview, DM only), and the client
 * wears it. Every endpoint scopes to them without knowing preview exists, and
 * the DM-only doors close because the server refuses a preview token at them —
 * hiding the buttons was never the part that mattered.
 *
 * The DM's own credential is stashed, never overwritten, so Exit Preview is a
 * local restore. Leaving must not depend on the network.
 */
import { AUTH_TOKEN_KEY, PLAYER_KEY, escapeHtml, getStorage, removeStorage, setStorage } from './core.js';

const PREVIEW_KEY = 'vos.preview';
const STASH_KEY = 'vos.preview.dmSeat';

export function previewState() {
  try {
    const raw = JSON.parse(getStorage(PREVIEW_KEY) || 'null');
    if (!raw || !raw.player) return null;
    // The token's own expiry is the server's business; this only stops the
    // strip outliving it visibly.
    if (raw.expiresAt && Date.now() > raw.expiresAt) {
      clearPreview();
      return null;
    }
    return raw;
  } catch (error) { return null; }
}

export function isPreviewing() {
  return !!previewState();
}

/* The seat the DM will get back. Read by the nav so the middle of the tab bar
 * keeps saying The Table while they are wearing someone else's face. */
export function stashedDmSeat() {
  try {
    return JSON.parse(getStorage(STASH_KEY) || 'null');
  } catch (error) { return null; }
}

function clearPreview() {
  removeStorage(PREVIEW_KEY);
}

export async function beginPreview(playerName) {
  const dmToken = getStorage(AUTH_TOKEN_KEY);
  const dmName = getStorage(PLAYER_KEY);

  const response = await fetch('/api/auth/preview', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(dmToken ? { Authorization: `Bearer ${dmToken}` } : {}) },
    body: JSON.stringify({ player: playerName }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);

  // Stash first. If the tab dies between these two writes, the worst case is
  // a stash with no preview, which costs nothing.
  setStorage(STASH_KEY, JSON.stringify({ name: dmName, token: dmToken }));
  setStorage(PREVIEW_KEY, JSON.stringify({
    player: body.playerName,
    actor: dmName || 'DM',
    expiresAt: Date.now() + (body.expiresIn || 3600) * 1000,
  }));
  setStorage(PLAYER_KEY, body.playerName);
  setStorage(AUTH_TOKEN_KEY, body.token);
  window.location.href = '/';
}

export function exitPreview({ to = '/party/' } = {}) {
  const seat = stashedDmSeat();
  clearPreview();
  removeStorage(STASH_KEY);
  if (seat && seat.name) setStorage(PLAYER_KEY, seat.name);
  else removeStorage(PLAYER_KEY);
  if (seat && seat.token) setStorage(AUTH_TOKEN_KEY, seat.token);
  else removeStorage(AUTH_TOKEN_KEY);
  window.location.href = to;
}

/* A strip, not a card. The previous treatment for this idea was a block of
 * warning the size of a paragraph, sitting above the content it was warning
 * about — which pushed the actual page down every screen of a preview.
 *
 * Warning-toned because edits here are live and land on that player. If the
 * mode ever becomes read-only this should go neutral and say so. */
export function renderPreviewStrip() {
  const state = previewState();
  const existing = document.getElementById('vos-preview-strip');
  if (!state) {
    if (existing) existing.remove();
    document.body.classList.remove('vos-is-previewing');
    return;
  }
  document.body.classList.add('vos-is-previewing');
  if (existing) return;

  const strip = document.createElement('div');
  strip.id = 'vos-preview-strip';
  strip.className = 'vos-preview-strip';
  strip.setAttribute('role', 'status');
  strip.innerHTML = `
    <span class="vos-preview-who">Previewing <b>${escapeHtml(state.player)}</b></span>
    <span class="vos-preview-warn">Changes affect this player</span>
    <button type="button" class="vos-preview-exit">Exit Preview</button>
  `;
  strip.querySelector('.vos-preview-exit').addEventListener('click', () => exitPreview());

  const bar = document.querySelector('.vos-app-bar');
  if (bar && bar.parentNode) bar.parentNode.insertBefore(strip, bar.nextSibling);
  else document.body.insertBefore(strip, document.body.firstChild);
}

export function initPreview() {
  renderPreviewStrip();
}
