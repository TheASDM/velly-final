/* Reference data the play controls read: condition rules, and a class spell list.
 *
 * Both are static files built by scripts/build_play_data.py and fetched once,
 * then held for the life of the page. The service worker caches them, so after
 * the first visit a player preparing spells at a table is not waiting on the
 * network.
 *
 * Two conditions deliberately disagree with the Player's Handbook: Exhaustion
 * and Dying come from House-Rules/simplification.md, because that is what this
 * table plays. The data marks them so the sheet can say so.
 */

const cache = new Map();

async function loadJson(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url, { cache: 'default' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      cache.delete(url);              // let a later attempt retry
      throw error;
    });
  cache.set(url, promise);
  return promise;
}

/* Shared with masquerade.js, which caches the same way. */
export function loadJsonCached(url) {
  return loadJson(url);
}

export function loadConditions() {
  return loadJson('/data/play/conditions.json');
}

/* Which spell list a character prepares from.
 *
 * A subclass caster borrows another class's list — an Arcane Trickster prepares
 * from the wizard list — so this maps the identifier Foundry reports rather
 * than assuming the class name is the list name.
 */
const LIST_FOR_CLASS = {
  bard: 'bard',
  cleric: 'cleric',
  ranger: 'ranger',
  warlock: 'warlock',
  wizard: 'wizard',
  rogue: 'wizard',        // Arcane Trickster
  fighter: 'wizard',      // Eldritch Knight
};

export function spellListNameFor(model) {
  const classes = (model && model.classes) || [];
  for (const entry of classes) {
    const key = String(entry.identifier || entry.name || '').toLowerCase();
    if (LIST_FOR_CLASS[key]) return LIST_FOR_CLASS[key];
  }
  return null;
}

export async function loadSpellList(name) {
  if (!name) return null;
  try {
    return await loadJson(`/data/play/spells-${name}.json`);
  } catch (error) {
    return null;
  }
}

/* How many spells this character prepares, from the class table.
 * Returns null when unknown, which the sheet shows as a count with no ceiling
 * rather than inventing one. */
export function preparedLimit(list, level) {
  if (!list || !Array.isArray(list.prepared) || !level) return null;
  const value = list.prepared[level - 1];
  return typeof value === 'number' ? value : null;
}

/* A stable key for a spell, matching the sublist hash so a prepared list
 * survives a rebuild of the reference data. */
export function spellKey(spell) {
  return `${spell.name.replace(/ /g, '%20').replace(/\//g, '%2f').toLowerCase()}_${
    String(spell.source || '').toLowerCase()}`;
}
