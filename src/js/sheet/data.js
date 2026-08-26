/* Fetch helpers for the character sheets.
 *
 * Both endpoints are gated server-side: /api/sheet resolves the player from the
 * verified token and never accepts a name, and /api/sheets is DM-gated by
 * _admin_error_response(). Any check in the UI is presentation, not security.
 */

export function whenPwaReady(timeoutMs = 6000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    (function poll() {
      if (window.VOS_PWA) return resolve(window.VOS_PWA);
      if (Date.now() - startedAt > timeoutMs) return resolve(null);
      setTimeout(poll, 80);
    })();
  });
}

function authHeaders(extra) {
  const pwa = window.VOS_PWA;
  if (pwa && pwa.authHeaders) return pwa.authHeaders(extra || {});
  return extra || {};
}

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function loadMySheet() {
  return getJson('/api/sheet');
}

export function loadAllSheets() {
  return getJson('/api/sheets');
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
