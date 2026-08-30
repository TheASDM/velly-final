/* Character record questionnaire (/questionnaire/).
 * The signed-in player sees their record; the DM receives proofing and export tools.
 */
import { authHeaders, notice, root, state, whenPwaReady } from './core.js';
import { initDm } from './dm.js';
import { renderRecord } from './record.js';

export async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (!name) {
    notice('Sign in to open your character record.', 'Choose your name', async () => {
      const chosen = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity({ force: true }) : null;
      if (chosen) boot();
    });
    return;
  }

  // The definitions endpoint is authenticated: players get only their own
  // character's prompts and vitals, the DM gets every character's.
  try {
    const response = await fetch('/api/questionnaire/definitions', {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (error) {
    notice('Could not load the record. Try again in a moment.');
    return;
  }

  if (name === 'DM' || (pwa && pwa.isDm && pwa.isDm())) {
    initDm();
    return;
  }

  const charKey = Object.keys(state.data.characters).find(
    (key) => state.data.characters[key].player === name
  );
  if (!charKey) {
    notice(`No character record is on file for ${name}. Tell the DM.`);
    return;
  }
  state.charKey = charKey;
  state.playerName = name;

  let answers = {};
  try {
    const response = await fetch(
      `/api/questionnaire?name=${encodeURIComponent(name)}`,
      { cache: 'no-store', headers: authHeaders() }
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      answers = data.answers || {};
      state.status = data.status || 'draft';
    }
  } catch (error) { /* start blank; autosave will surface errors */ }

  renderRecord(charKey, answers);
}

if (root) boot();
