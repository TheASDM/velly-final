/* The canonical copies of the helpers every page bundle needs.
 *
 * These used to exist as a dozen near-identical (and quietly divergent)
 * copies — three authHeaders signatures, escapeHtml variants that missed the
 * apostrophe, five whenPwaReady polls. One definition each, imported by
 * everything esbuild bundles. */

/* Resolve window.VOS_PWA once the pwa-client bundle has booted; null after
 * the timeout so callers can degrade instead of hanging. */
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

/* The signed-in player's auth headers, merged over `extra`. Safe to call
 * before the PWA client loads — it just returns `extra`. */
export function authHeaders(extra) {
  const pwa = window.VOS_PWA;
  if (pwa && pwa.authHeaders) return pwa.authHeaders(extra || {});
  return extra || {};
}

/* Full HTML escaping including the apostrophe — two of the old copies
 * missed it, which is exactly how attribute injection slips in. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Authenticated JSON GET with uniform error shaping. */
export async function getJson(url, options) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...(options || {}),
    headers: authHeaders((options || {}).headers),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}
