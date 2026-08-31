/* Hit points on the navigation medallion.
 *
 * The character sheet holds the middle of the rail, and the ring around it is
 * how much of the character is left. That number is the single most-checked
 * thing at a table, and reading it used to cost a tap and a page load.
 *
 * Cheap by construction: one request per session, cached in sessionStorage,
 * and refreshed when the sheet itself reports a change. A gauge in the chrome
 * of every page cannot cost a round trip per page.
 */
const KEY = 'vos-sheet-hp';
const CIRCUMFERENCE = 126;            // 2πr for r=20, matching the SVG

function elements() {
  const tab = document.querySelector('[data-vos-sheet-tab]');
  if (!tab) return null;
  return {
    tab,
    fill: tab.querySelector('.vos-hero-ring-fill'),
    text: tab.querySelector('[data-vos-sheet-hp]'),
    value: tab.querySelector('[data-vos-sheet-hp-value]'),
  };
}

/* Four states rather than a gradient: a player needs to know which band they
 * are in, and "bloodied" is a decision point, not a shade. */
function band(current, max) {
  if (!max || current == null) return null;
  if (current <= 0) return 'down';
  const share = current / max;
  if (share <= 0.25) return 'bloodied';
  if (share <= 0.5) return 'hurt';
  return 'ok';
}

function paint(state) {
  const parts = elements();
  if (!parts || !state) return;
  const { current, max } = state;
  const tone = band(current, max);
  if (!tone) return;

  const share = Math.max(0, Math.min(1, max ? current / max : 0));
  parts.fill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - share));
  parts.tab.dataset.hp = tone;

  if (parts.value) parts.value.textContent = `${current}/${max}`;
  parts.text.hidden = false;

  const label = tone === 'down' ? 'down' : `${current} of ${max} hit points`;
  parts.tab.setAttribute('aria-label', `Open character sheet; ${label}`);
}

function cached() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch { return null; }
}

function remember(state) {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

async function fetchHp() {
  const pwa = window.VOS_PWA;
  if (!pwa || !pwa.getPlayerName || !pwa.getPlayerName()) return null;
  try {
    const headers = pwa.authHeaders ? pwa.authHeaders() : {};
    const response = await fetch('/api/play', { cache: 'no-store', headers });
    if (!response.ok) return null;
    const body = await response.json();
    const max = (body.limits || {}).maxHp;
    const current = ((body.state || {}).hp || {}).current;
    if (max == null) return null;
    return { current: current == null ? max : current, max };
  } catch { return null; }
}

/* The DM's medallion is The Table, and a hit-point ring on it would be a
 * player's number worn by someone who is not that player. Blank it. */
export function clearSheetBadge() {
  const parts = elements();
  if (!parts) return;
  parts.text.hidden = true;
  if (parts.value) parts.value.textContent = '';
  delete parts.tab.dataset.hp;
  if (parts.fill) parts.fill.style.strokeDashoffset = String(CIRCUMFERENCE);
}

export function initSheetBadge() {
  if (!elements()) return;

  // Paint from cache immediately so the ring never appears late.
  const known = cached();
  if (known) paint(known);

  const refresh = async () => {
    const state = await fetchHp();
    if (state) { remember(state); paint(state); }
  };

  refresh();
  // The sheet broadcasts after any operation that moves hit points.
  window.addEventListener('vos:play-state', (event) => {
    const detail = event.detail || {};
    if (detail.hp) { remember(detail.hp); paint(detail.hp); }
    else refresh();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
