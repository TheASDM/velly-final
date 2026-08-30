/* The monster reference (/monsters/).
 *
 * The DM's bench of stat blocks, rendered from curated bestiary data so a
 * fight can be run from a phone without the book. One creature at a time,
 * picked from a tab row ordered by Challenge Rating — mid-encounter you flip
 * between two or three blocks constantly, and a tab flip beats a scroll hunt.
 * The selection lives in the URL hash, so the back button and a shared link
 * both land on the right creature.
 *
 * The page is unlisted and asks for the DM seat before showing anything; the
 * bench data itself comes from /api/play/monsters, which is DM-gated
 * server-side — the client check is presentation, not security.
 */
import { renderMonster } from '../statblock/monster.js';
import { loadMonsterBench, whenPwaReady } from '../sheet/data.js';

const root = document.getElementById('vos-monsters-root');

let monsters = [];

function notice(message, detail) {
  root.innerHTML = `<div class="empty-state"><b>${message}</b>${detail || ''}</div>`;
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const crOf = (mon) => (typeof mon.cr === 'object' ? mon.cr?.cr : mon.cr) ?? '—';

function selected() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  return monsters.find((mon) => slug(mon.name) === hash) || monsters[0];
}

function render() {
  const current = selected();
  root.innerHTML = `
    <nav class="vos-mon-index" role="tablist" aria-label="Pick a monster">${
  monsters.map((mon) => `<a href="#${slug(mon.name)}" role="tab"
        class="${mon === current ? 'is-on' : ''}"
        aria-selected="${mon === current}">${mon.name}<i>${crOf(mon)}</i></a>`).join('')
}</nav>
    ${renderMonster(current)}`;

  // On a phone the tab row scrolls; the active tab should never be the one
  // hiding off the edge.
  const active = root.querySelector('.vos-mon-index .is-on');
  if (active && active.scrollIntoView) {
    active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  const isDm = name === 'DM' || (pwa && pwa.isDm && pwa.isDm());
  if (!isDm) {
    notice('The other side of the screen.', 'This bench is the DM’s.');
    return;
  }

  try {
    monsters = (await loadMonsterBench()).monster || [];
  } catch (error) {
    notice('Could not load the bench.', 'Try again in a moment.');
    return;
  }
  if (!monsters.length) {
    notice('Nothing on the bench yet.');
    return;
  }

  window.addEventListener('hashchange', render);
  render();
}

if (root) boot();
