/* Unsaved-work tracking.
 *
 * Each editor registers a predicate; the console warns before the tab
 * closes while any of them reports unsaved work, and editors call
 * confirmDiscard() before replacing their own content. */

import { confirmSheet } from './confirm.js';

const sources = new Map(); // key -> () => boolean

export function trackDirty(key, isDirty) {
  sources.set(key, isDirty);
}

export function anyDirty() {
  for (const isDirty of sources.values()) {
    try {
      if (isDirty()) return true;
    } catch (error) { /* a broken predicate must not block unload */ }
  }
  return false;
}

/* True means "go ahead" — either nothing is unsaved or the DM said discard. */
export async function confirmDiscard(key, message) {
  const isDirty = sources.get(key);
  if (!isDirty) return true;
  let dirty = false;
  try { dirty = !!isDirty(); } catch (error) { dirty = false; }
  if (!dirty) return true;
  return confirmSheet(message || 'Discard unsaved changes?', {
    confirmLabel: 'Discard',
    danger: true,
  });
}

window.addEventListener('beforeunload', (event) => {
  if (!anyDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});
