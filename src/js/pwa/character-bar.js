/* The character's name in the chrome of every page.
 *
 * A signed-in player is their character everywhere in the app, not only on
 * the sheet — so the app bar carries the same identity the sheet shows: the
 * name where the page title was, the class line where the eyebrow was. Page
 * context survives in the bottom tabs and, on wiki pages, the breadcrumbs.
 *
 * Cheap by construction, the same way the hit-point medallion is: painted
 * from sessionStorage immediately, refreshed from /api/identity once, and
 * updated again only when a new statblock push changes the answer.
 *
 * The DM is exempt: they have no character, and their app bar should keep
 * saying where they are.
 */
import { clearSheetBadge, initSheetBadge } from './sheet-badge.js';
import { exitPreview, isPreviewing, stashedDmSeat } from './preview.js';

const KEY = 'vos-character-identity';

function elements() {
  return {
    title: document.querySelector('.vos-app-bar .vos-app-title'),
    eyebrow: document.querySelector('.vos-app-bar .vos-app-eyebrow'),
  };
}

function paint(identity) {
  if (!identity || !identity.name) return;
  const { title, eyebrow } = elements();
  if (!title || !eyebrow) return;
  title.textContent = identity.name;
  const line = [identity.classLine, identity.race].filter(Boolean).join(' · ');
  if (line) eyebrow.textContent = line;
}

function cached(name) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return stored && stored.player === name ? stored.character : null;
  } catch { return null; }
}

function remember(name, character) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ player: name, character }));
  } catch { /* private mode */ }
}

async function fetchIdentity() {
  const pwa = window.VOS_PWA;
  try {
    const headers = pwa.authHeaders ? pwa.authHeaders() : {};
    const response = await fetch('/api/identity', { cache: 'no-store', headers });
    if (!response.ok) return null;
    const body = await response.json();
    return body.character || null;
  } catch { return null; }
}

/* The DM has no sheet worth a medallion; their centre of gravity is the
 * table. The variant is declared in _data/navigation.js and emitted as data
 * attributes — this only applies what the nav data says.
 *
 * This is also the DM's way out of a preview: whatever seat they are looking
 * through, the middle of the rail still says The Table and still goes there.
 */
function paintDmTab() {
  const tab = document.getElementById('vos-nav-sheet');
  if (!tab || !tab.dataset.dmHref) return;
  tab.dataset.seat = 'dm';
  tab.href = tab.dataset.dmHref;
  const label = tab.querySelector('.vos-app-tab-label');
  if (label && tab.dataset.dmLabel) label.textContent = tab.dataset.dmLabel;
  tab.setAttribute('aria-label', `Open ${tab.dataset.dmLabel || 'the table'}`);
  clearSheetBadge();
  /* From inside a preview this is the way out, not just a link: The Table
     refuses a preview credential, so following the href would land the DM
     on "DM only." Take the seat back first, then go. */
  if (isPreviewing()) {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      exitPreview({ to: tab.dataset.dmHref });
    });
  }
  const active = window.location.pathname === tab.dataset.dmHref;
  tab.classList.toggle('is-active', active);
  if (active) tab.setAttribute('aria-current', 'page');
  else tab.removeAttribute('aria-current');
}

/* How many things at the table are waiting on the DM. A count, not a gauge —
 * it must not read as anybody's hit points. */
export function setTableBadge(count) {
  const badge = document.querySelector('[data-vos-table-badge]');
  if (!badge) return;
  const n = Number(count) || 0;
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.hidden = n <= 0;
  const tab = document.getElementById('vos-nav-sheet');
  if (tab && tab.dataset.seat === 'dm') {
    const base = `Open ${tab.dataset.dmLabel || 'the table'}`;
    tab.setAttribute('aria-label', n > 0 ? `${base}; ${n} waiting for review` : base);
  }
}

export function initCharacterBar() {
  const pwa = window.VOS_PWA;
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (!name) return;

  /* Keyed off the seat they will get back, not the one they are wearing.
     Inside a preview everything else on screen is the player's; the middle
     of the rail is the one thing that must still belong to the DM, because
     it is the way out. */
  const dmSeat = stashedDmSeat();
  if (dmSeat || name === 'DM' || (pwa.isDm && pwa.isDm())) {
    paintDmTab();
    return;
  }

  initSheetBadge();

  const known = cached(name);
  if (known) paint(known);

  fetchIdentity().then((character) => {
    if (!character) return;
    remember(name, character);
    paint(character);
  });
}
