/* The player's own character sheet (/sheet/).
 *
 * One sheet, theirs, read-only. The server resolves whose it is from the token,
 * so there is nothing here that selects a player — that is the point.
 */
import { renderSheet, sheetSections } from './render.js';
import { loadMySheet, loadRoster, whenPwaReady } from './data.js';

const root = document.getElementById('vos-sheet-root');
const indexEl = document.getElementById('vos-sheet-index');

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

function notice(message, detail) {
  if (indexEl) indexEl.hidden = true;
  root.innerHTML = `<div class="empty-state"><b>${esc(message)}</b>${esc(detail || '')}</div>`;
}

function renderIndex(markdown) {
  if (!indexEl) return;
  const sections = sheetSections(markdown);
  if (sections.length < 3) { indexEl.hidden = true; return; }
  indexEl.innerHTML = sections
    .map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`)
    .join('');
  indexEl.hidden = false;
}

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;

  if (!name) {
    notice('Sign in to read your sheet.', 'It is only visible to you and the DM.');
    return;
  }

  let payload;
  try {
    payload = await loadMySheet();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      notice('That session isn’t authorised.', 'Sign in again and try once more.');
    } else {
      notice('Could not load your sheet.', error.message || 'Try again in a moment.');
    }
    return;
  }

  if (!payload.sheet || !payload.sheet.markdown) {
    notice('No sheet yet.', 'Your DM writes these — it will appear here once yours is ready.');
    return;
  }

  const roster = await loadRoster();
  const seat = roster[payload.playerName] || {};
  const markdown = payload.sheet.markdown;

  root.innerHTML = renderSheet(markdown, {
    eyebrow: 'Character sheet',
    fallbackTitle: seat.display || payload.playerName,
  });
  if (seat.color) root.style.setProperty('--sheet-accent', seat.color);
  renderIndex(markdown);
}

if (root) boot();
