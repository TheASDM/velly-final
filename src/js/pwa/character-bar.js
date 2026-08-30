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
 * The DM is exempt — their "character" is a test wizard, and their app bar
 * should keep saying where they are.
 */
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
 * table. Same slot, same mask, different door — and the active ring follows
 * /party/ instead of /sheet/. */
function paintDmTab() {
  const tab = document.getElementById('vos-nav-sheet');
  if (!tab) return;
  tab.href = '/party/';
  const label = tab.querySelector('.vos-app-tab-label');
  if (label) label.textContent = 'The Table';
  const onParty = window.location.pathname === '/party/';
  tab.classList.toggle('is-active', onParty);
  if (onParty) tab.setAttribute('aria-current', 'page');
  else tab.removeAttribute('aria-current');
}

export function initCharacterBar() {
  const pwa = window.VOS_PWA;
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (!name) return;
  if (name === 'DM' || (pwa.isDm && pwa.isDm())) {
    paintDmTab();
    return;
  }

  const known = cached(name);
  if (known) paint(known);

  fetchIdentity().then((character) => {
    if (!character) return;
    remember(name, character);
    paint(character);
  });
}
