/* The monster reference (/monsters/).
 *
 * The DM's bench of stat blocks, rendered from curated bestiary data so a
 * fight can be run from a phone without the book. The page is unlisted and
 * asks for the DM seat before showing anything — the same courtesy gate the
 * rest of the DM surfaces use, not a vault.
 */
import { renderMonster } from '../statblock/monster.js';
import { whenPwaReady } from '../sheet/data.js';

const root = document.getElementById('vos-monsters-root');

function notice(message, detail) {
  root.innerHTML = `<div class="empty-state"><b>${message}</b>${detail || ''}</div>`;
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  const isDm = name === 'DM' || (pwa && pwa.isDm && pwa.isDm());
  if (!isDm) {
    notice('The other side of the screen.', 'This bench is the DM’s.');
    return;
  }

  let monsters = [];
  try {
    const response = await fetch('/data/play/monsters.json', { cache: 'no-store' });
    monsters = (await response.json()).monster || [];
  } catch (error) {
    notice('Could not load the bench.', 'Try again in a moment.');
    return;
  }
  if (!monsters.length) {
    notice('Nothing on the bench yet.');
    return;
  }

  root.innerHTML = `
    <nav class="vos-mon-index" aria-label="Jump to a monster">${
  monsters.map((mon) => `<a href="#${slug(mon.name)}">${mon.name}</a>`).join('')
}</nav>
    ${monsters.map((mon) => `<section class="vos-mon-slot" id="${slug(mon.name)}">${
    renderMonster(mon)}</section>`).join('')}`;
}

if (root) boot();
