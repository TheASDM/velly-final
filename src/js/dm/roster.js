/* One roster for the whole console.
 *
 * /data/players.json is the canonical seat list (the same file the auth maps
 * and records key off). Everything that needs names — read receipts, the
 * Records list, availability's "waiting on", recipient pickers, handout
 * audiences — awaits this one fetch instead of keeping its own copy. */

let rosterPromise = null;

export function loadRoster() {
  if (!rosterPromise) {
    rosterPromise = fetch('/data/players.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : []))
      .then((seats) => (Array.isArray(seats) ? seats : []))
      .catch(() => {
        // Let a transient failure retry on the next call instead of caching [].
        rosterPromise = null;
        return [];
      });
  }
  return rosterPromise;
}

export async function playerNames({ includeDm = false } = {}) {
  const seats = await loadRoster();
  return seats
    .map((seat) => seat && seat.name)
    .filter((name) => name && (includeDm || name !== 'DM'));
}

export async function displayNameFor(name) {
  const seats = await loadRoster();
  const seat = seats.find((entry) => entry && entry.name === name);
  return (seat && seat.display) || name;
}
