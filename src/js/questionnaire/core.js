export const root = document.getElementById('vos-q-root');

const AUTOSAVE_DELAY = 2500;
export const state = {
  data: null,
  charKey: null,
  playerName: null,
  proofing: false, // DM preview: everything works, nothing saves
  dirty: false,
  saveTimer: null,
  saving: false,
  status: 'draft',
};

export { authHeaders, whenPwaReady } from '../shared/pwa.js';
import { authHeaders } from '../shared/pwa.js';

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function notice(message, buttonLabel, onClick) {
  root.textContent = '';
  const box = el('div', 'qnotice');
  box.appendChild(el('div', null, message));
  if (buttonLabel) {
    const button = el('button', null, buttonLabel);
    button.type = 'button';
    button.addEventListener('click', onClick);
    box.appendChild(button);
  }
  root.appendChild(box);
}

export const CREST_SVG = '<svg class="crest" viewBox="0 0 140 66" aria-hidden="true">'
  + '<path d="M14,22 C14,10 42,7 70,16 C98,7 126,10 126,22 C130,42 106,61 70,61 C34,61 10,42 14,22 Z"'
  + ' fill="var(--accent)" fill-opacity="0.12" stroke="var(--accent)" stroke-width="1.4"/>'
  + '<ellipse cx="49" cy="31" rx="15" ry="9" fill="var(--ink)" stroke="var(--accent)" stroke-width="1.2"/>'
  + '<ellipse cx="91" cy="31" rx="15" ry="9" fill="var(--ink)" stroke="var(--accent)" stroke-width="1.2"/>'
  + '<path d="M70,16 L70,26" stroke="var(--accent)" stroke-width="1.2"/></svg>';

export const DIE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
  + ' stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'
  + '<path d="M12 2.2 20.5 7.4 V16.6 L12 21.8 L3.5 16.6 V7.4 Z"/>'
  + '<path d="M12 2.2 V8.2 M3.5 7.4 L12 8.2 L20.5 7.4 M12 8.2 L6.6 11.2 L5.2 16.2 M12 8.2 L17.4 11.2'
  + ' L18.8 16.2 M6.6 11.2 L12 21.8 M17.4 11.2 L12 21.8 M6.6 11.2 H17.4"/></svg>';

// ── Answer collection ───────────────────────────────────────────────

export function collectAnswers() {
  const answers = {};
  root.querySelectorAll('[data-answer-key]').forEach((input) => {
    const value = input.value.trim();
    if (value) answers[input.dataset.answerKey] = input.value;
  });
  return answers;
}

export function setSaveState(text, cls) {
  const stateEl = document.getElementById('vos-q-savestate');
  if (!stateEl) return;
  stateEl.textContent = text || '';
  stateEl.className = 'savestate' + (cls ? ' ' + cls : '');
}

export async function save(submit) {
  if (state.proofing || state.saving) return;
  state.saving = true;
  clearTimeout(state.saveTimer);
  setSaveState(submit ? 'Sealing…' : 'Saving…');
  try {
    const response = await fetch(
      submit ? '/api/questionnaire/submit' : '/api/questionnaire',
      {
        method: submit ? 'POST' : 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: state.playerName, answers: collectAnswers() }),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    state.dirty = false;
    state.status = data.status || state.status;
    if (submit) {
      setSaveState('Sealed and sent to the DM ✓ You can still come back and edit.', 'is-saved');
    } else {
      const suffix = state.status === 'submitted' ? ' (already sealed)' : '';
      setSaveState('Saved ✓' + suffix, 'is-saved');
    }
  } catch (error) {
    setSaveState('Save failed: ' + error.message + ' — your text is still here, try again.', 'is-error');
  } finally {
    state.saving = false;
  }
}

export function markDirty() {
  if (state.proofing) return;
  state.dirty = true;
  setSaveState('Unsaved changes…');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => save(false), AUTOSAVE_DELAY);
}

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
// Best effort flush when the app is backgrounded (mobile PWA).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.dirty) save(false);
});
