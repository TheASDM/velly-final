/* Fetch helpers for the character sheets.
 *
 * Both endpoints are gated server-side: /api/sheet resolves the player from the
 * verified token and never accepts a name, and /api/sheets is DM-gated by
 * _admin_error_response(). Any check in the UI is presentation, not security.
 */

import { getJson, whenPwaReady } from '../shared/pwa.js';

export { whenPwaReady };

export function loadMySheet() {
  return getJson('/api/sheet');
}

/* Handouts the DM has given this character. The DM may name another player,
 * which is what "view as" reads — the server enforces who may ask. */
export function loadHandouts(playerName) {
  const query = playerName ? `?playerName=${encodeURIComponent(playerName)}` : '';
  return getJson(`/api/handouts${query}`);
}

export function loadAllSheets() {
  return getJson('/api/sheets');
}

/* The DM's monster bench. DM-gated server-side — the bench names what the
 * DM has prepped, so it never ships in the public static build. */
export function loadMonsterBench() {
  return getJson('/api/play/monsters');
}

/* Roster display names and colors, so a sheet can be labelled the same way the
 * player appears everywhere else in the app. */
export async function loadRoster() {
  try {
    const roster = await getJson('/data/players.json');
    const byName = {};
    roster.forEach((entry) => { byName[entry.name] = entry; });
    return byName;
  } catch (error) {
    return {};
  }
}
