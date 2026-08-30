/* One fetch path for the whole console.
 *
 * Every panel action goes through withPanel(): the session gate, the loading
 * status, the disabled button, the error rendering, and the 401 handling all
 * live here once, instead of being copy-pasted (and diverging) per tab. */

import { setStatus } from './dom.js';
import { authHeaders, ensureLive, sessionExpired } from './session.js';

export async function adminJson(url, options) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...(options || {}),
    headers: authHeaders((options || {}).headers),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionExpired(data.error);
    throw new Error(data.error || 'Session expired — sign in again.');
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export function postJson(url, body) {
  return adminJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function putJson(url, body) {
  return adminJson(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteJson(url) {
  return adminJson(url, { method: 'DELETE' });
}

/* Run one panel action with uniform lifecycle. Returns the action's result —
 * coerced to true when the action resolves undefined — or null on failure,
 * so callers (and the tab loader) can tell success from failure. */
export async function withPanel(statusTarget, button, action, options) {
  if (!ensureLive(statusTarget)) return null;
  const loading = (options && options.loading) || 'Loading…';
  if (button) button.disabled = true;
  setStatus(statusTarget, loading);
  try {
    const result = await action();
    return result === undefined ? true : result;
  } catch (error) {
    setStatus(statusTarget, error.message, true);
    return null;
  } finally {
    if (button) button.disabled = false;
  }
}
