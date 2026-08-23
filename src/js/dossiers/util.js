/* Shared helpers for the dossier browser. */

export function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

// Answer keys carry their section as a prefix ("P1 - your tell"). Strip it for
// display; the prefix is data, not a label.
export function label(key) {
  return String(key || '').replace(/^P1 - /, '').replace(/^P2 - /, '').replace(/^vitals - /, '');
}

export function trimmed(character, key) {
  return ((character.answers || {})[key] || '').trim();
}

export function isAnswered(character, key) {
  return trimmed(character, key) !== '';
}

export function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10);
}

export function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

export function highlight(text, query) {
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return esc(text).replace(new RegExp('(' + pattern + ')', 'ig'), '<mark>$1</mark>');
}
