/* Which model compiles the prompt.
 *
 * Two providers exist so the same request can be drawn both ways and
 * compared. The console sets the one the whole table gets; this row lets the
 * DM override it for a single generation, and it is rendered only for the DM
 * seat — a player is served a compiler and never told there is a choice.
 *
 * The endpoint is DM-gated too, so a player who finds the button in the
 * bundle still cannot use it: the server ignores `compiler` from anyone but
 * the DM. */
import { studio } from './state.js';
import { isCurrentDm, requestHeaders } from './identity.js';

export function selectedCompiler() {
  /* Only ever sent when the DM picked something other than what is already
     active — the server would ignore it anyway, and leaving it off keeps the
     ordinary request identical to a player's. */
  if (!isCurrentDm()) return null;
  if (!studio.selectedCompiler) return null;
  return studio.selectedCompiler === studio.activeCompiler ? null : studio.selectedCompiler;
}

function rememberCompiler(key) {
  try {
    if (key) localStorage.setItem(studio.COMPILER_KEY, key);
    else localStorage.removeItem(studio.COMPILER_KEY);
  } catch (e) { /* private mode — the pick just does not persist */ }
}

function rememberedCompiler() {
  try {
    return localStorage.getItem(studio.COMPILER_KEY) || '';
  } catch (e) {
    return '';
  }
}

function renderCompilerNote() {
  if (!studio.compilerNoteEl) return;
  const active = (studio.compilerProviders || []).find(p => p.key === studio.activeCompiler);
  const activeLabel = active ? active.label : studio.activeCompiler;
  const overridden = studio.selectedCompiler && studio.selectedCompiler !== studio.activeCompiler;
  studio.compilerNoteEl.textContent = overridden
    ? `The table is on ${activeLabel}. This piece only will use your pick.`
    : `The table is on ${activeLabel}. Change it for everyone in Campaign Settings → Art.`;
}

function paintCompilerButtons() {
  (studio.compilerChoicesEl.querySelectorAll('[data-compiler]') || []).forEach((button) => {
    const on = button.dataset.compiler === studio.selectedCompiler;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.classList.toggle('is-active', on);
  });
  renderCompilerNote();
}

function pickCompiler(key) {
  studio.selectedCompiler = key;
  rememberCompiler(key);
  paintCompilerButtons();
}

export async function loadCompilerChoice() {
  if (!studio.compilerEl || !studio.compilerChoicesEl) return;
  if (!isCurrentDm()) {
    studio.compilerEl.hidden = true;
    return;
  }
  let data;
  try {
    const response = await fetch(studio.API_BASE + '/api/studio/compiler', {
      cache: 'no-store',
      headers: requestHeaders(),
    });
    if (!response.ok) return;
    data = await response.json();
  } catch (e) {
    return;
  }

  studio.activeCompiler = data.active || null;
  studio.compilerProviders = (data.providers || []).filter(p => p.configured);
  if (studio.compilerProviders.length < 2) {
    /* Only one provider has credentials on this server, so there is nothing
       to compare and nothing worth taking up a row for. */
    studio.compilerEl.hidden = true;
    return;
  }

  const remembered = rememberedCompiler();
  studio.selectedCompiler = studio.compilerProviders.some(p => p.key === remembered)
    ? remembered
    : studio.activeCompiler;

  studio.compilerChoicesEl.innerHTML = '';
  studio.compilerProviders.forEach((provider) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vos-art-compiler-btn';
    button.dataset.compiler = provider.key;
    button.textContent = provider.label;
    button.title = `${provider.vendor} — ${provider.model}`;
    button.addEventListener('click', () => pickCompiler(provider.key));
    studio.compilerChoicesEl.appendChild(button);
  });

  paintCompilerButtons();
  studio.compilerEl.hidden = false;
}
