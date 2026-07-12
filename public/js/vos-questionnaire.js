/* Character record questionnaire (/questionnaire/).
 *
 * One page serves every player: the record definition lives in
 * /data/questionnaire.json (shared Part I questions + per-character
 * Part II, vitals dossier, and roll tables, extracted from the original
 * record-*.html documents). The signed-in player sees only their own
 * character's record. Answers live in the questionnaires table:
 * autosaved as they type (debounced), plus a manual Save button and a
 * "Seal and send" submit that marks the record submitted.
 *
 * Dice rolls are rerollable — the result is just an answer the player
 * can overwrite. The DM gets a character picker and a fully interactive
 * proofing mode: every control works, but nothing is ever saved to the
 * player's record.
 */
(function () {
  const root = document.getElementById('vos-q-root');
  if (!root) return;

  const AUTOSAVE_DELAY = 2500;
  const state = {
    data: null,
    charKey: null,
    playerName: null,
    proofing: false, // DM preview: everything works, nothing saves
    dirty: false,
    saveTimer: null,
    saving: false,
    status: 'draft',
  };

  function whenPwaReady(timeoutMs = 6000) {
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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function notice(message, buttonLabel, onClick) {
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

  const CREST_SVG = '<svg class="crest" viewBox="0 0 140 66" aria-hidden="true">'
    + '<path d="M14,22 C14,10 42,7 70,16 C98,7 126,10 126,22 C130,42 106,61 70,61 C34,61 10,42 14,22 Z"'
    + ' fill="var(--accent)" fill-opacity="0.12" stroke="var(--accent)" stroke-width="1.4"/>'
    + '<ellipse cx="49" cy="31" rx="15" ry="9" fill="var(--ink)" stroke="var(--accent)" stroke-width="1.2"/>'
    + '<ellipse cx="91" cy="31" rx="15" ry="9" fill="var(--ink)" stroke="var(--accent)" stroke-width="1.2"/>'
    + '<path d="M70,16 L70,26" stroke="var(--accent)" stroke-width="1.2"/></svg>';

  const DIE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M12 2.2 20.5 7.4 V16.6 L12 21.8 L3.5 16.6 V7.4 Z"/>'
    + '<path d="M12 2.2 V8.2 M3.5 7.4 L12 8.2 L20.5 7.4 M12 8.2 L6.6 11.2 L5.2 16.2 M12 8.2 L17.4 11.2'
    + ' L18.8 16.2 M6.6 11.2 L12 21.8 M17.4 11.2 L12 21.8 M6.6 11.2 H17.4"/></svg>';

  // ── Answer collection ───────────────────────────────────────────────

  function collectAnswers() {
    const answers = {};
    root.querySelectorAll('[data-answer-key]').forEach((input) => {
      const value = input.value.trim();
      if (value) answers[input.dataset.answerKey] = input.value;
    });
    return answers;
  }

  function setSaveState(text, cls) {
    const stateEl = document.getElementById('vos-q-savestate');
    if (!stateEl) return;
    stateEl.textContent = text || '';
    stateEl.className = 'savestate' + (cls ? ' ' + cls : '');
  }

  async function save(submit) {
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

  function markDirty() {
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

  // ── Rendering ───────────────────────────────────────────────────────

  function fieldBlock(question, index, answers, rowsDefault) {
    const wrap = el('div', 'field');
    const label = el('label');
    const num = el('span', 'num', String(index + 1).padStart(2, '0'));
    label.appendChild(num);
    if (question.title) {
      const strong = el('strong', null, question.title + '. ');
      label.appendChild(strong);
    }
    label.appendChild(document.createTextNode(question.prompt));
    const textarea = el('textarea');
    textarea.rows = rowsDefault;
    textarea.dataset.answerKey = question.key;
    textarea.value = answers[question.key] || '';
    textarea.addEventListener('input', markDirty);
    wrap.append(label, textarea);
    return wrap;
  }

  function partHead(roman, title, small) {
    const head = el('div', 'part-head');
    if (roman) head.appendChild(el('span', 'roman', roman));
    const titleEl = el('span', 'part-title', title);
    if (small) titleEl.appendChild(el('small', null, small));
    head.append(titleEl, el('span', 'rule'));
    return head;
  }

  function vitalsField(field, answers, tables) {
    const wrap = el('div', 'vfield' + (field.wide ? ' wide' : ''));
    const label = el('label', null, field.label + ' ');
    const input = el('input');
    input.type = 'text';
    input.dataset.answerKey = field.key;
    const saved = answers[field.key];
    input.value = saved !== undefined ? saved : (field.value || '');
    if (field.placeholder) input.placeholder = field.placeholder;
    else if (!field.onFile) input.placeholder = '…';
    input.addEventListener('input', markDirty);

    if (field.onFile) {
      input.readOnly = true;
      const chip = el('span', 'onfile', 'on file');
      const edit = el('button', 'js-edit', 'edit');
      edit.type = 'button';
      edit.addEventListener('click', () => {
        input.readOnly = false;
        input.classList.add('unlocked');
        chip.textContent = 'editing';
        edit.remove();
        input.focus();
      });
      label.append(chip, edit);
    }

    if (field.roll && tables[field.roll]) {
      const row = el('div', 'rollrow');
      const die = el('button', 'die js-roll');
      die.type = 'button';
      die.innerHTML = DIE_SVG;
      die.title = 'Roll a random result. Roll again if you change your mind, or type your own.';
      die.setAttribute('aria-label', die.title);
      die.addEventListener('click', () => {
        const table = tables[field.roll];
        input.value = table[Math.floor(Math.random() * table.length)];
        die.title = 'Rolled: ' + input.value + ' — roll again or type your own.';
        markDirty();
      });
      row.append(input, die);
      wrap.append(label, row);
    } else {
      wrap.append(label, input);
    }
    return wrap;
  }

  function renderRecord(charKey, answers) {
    const data = state.data;
    const character = data.characters[charKey];
    root.textContent = '';

    if (state.proofing) {
      root.appendChild(renderDmPicker(charKey));
      root.appendChild(el('p', 'dm-note',
        `Proofing as ${character.player} — everything works, but nothing you type or roll here is saved.`));
    }

    const doc = el('div', 'doc');
    const header = el('header');
    header.innerHTML = CREST_SVG;
    header.appendChild(el('p', 'eyebrow', 'Valley of Shadows · Character Record'));
    header.appendChild(el('h1', null, character.name));
    header.appendChild(el('p', 'role', character.role));
    header.appendChild(el('p', 'intro', character.intro));
    header.appendChild(el('p', 'aside', character.aside));
    doc.appendChild(header);

    const partOne = el('section', 'part');
    partOne.appendChild(partHead('I', 'Part One', 'Everyone answers these'));
    data.part1.forEach((question, i) => {
      partOne.appendChild(fieldBlock(question, i, answers, 3));
    });
    doc.appendChild(partOne);

    const partTwo = el('section', 'part');
    partTwo.appendChild(partHead('II', 'Part Two', "Your character's own questions"));
    character.part2.forEach((question, i) => {
      partTwo.appendChild(fieldBlock(question, i, answers, 4));
    });
    doc.appendChild(partTwo);

    const partThree = el('section', 'part');
    partThree.appendChild(partHead('III', 'Part Three',
      "Vitals and dossier. Fields marked 'on file' are set, but tap edit to change them. A few can be rolled with the die."));
    character.vitals.forEach((group) => {
      partThree.appendChild(el('h3', 'vgroup', group.group));
      const grid = el('div', 'vgrid');
      group.fields.forEach((field) => {
        grid.appendChild(vitalsField(field, answers, data.tables));
      });
      partThree.appendChild(grid);
    });
    doc.appendChild(partThree);

    const coda = el('section', 'part coda');
    coda.appendChild(partHead('', 'One more thing',
      "Anything you want me to know that the questions didn't ask"));
    const codaField = el('div', 'field');
    const codaLabel = el('label', null, 'Anything else?');
    const codaArea = el('textarea');
    codaArea.rows = 6;
    codaArea.placeholder = data.codaPrompt;
    codaArea.dataset.answerKey = data.codaKey;
    codaArea.value = answers[data.codaKey] || '';
    codaArea.addEventListener('input', markDirty);
    codaField.append(codaLabel, codaArea);
    coda.appendChild(codaField);
    doc.appendChild(coda);

    if (!state.proofing) {
      const savebar = el('div', 'savebar');
      const saveButton = el('button', 'btn-save', 'Save');
      saveButton.type = 'button';
      saveButton.addEventListener('click', () => save(false));
      const saveStateEl = el('span', 'savestate');
      saveStateEl.id = 'vos-q-savestate';
      savebar.append(saveButton, saveStateEl);
      doc.appendChild(savebar);

      const seal = el('div', 'seal');
      const sealButton = el('button', 'btn-seal', 'Seal and send');
      sealButton.type = 'button';
      sealButton.addEventListener('click', () => save(true));
      seal.appendChild(sealButton);
      seal.appendChild(el('p', null,
        'Everything autosaves as you type — seal it when you’re done so the DM knows it’s ready.'));
      doc.appendChild(seal);
    }

    const footer = el('footer', null, 'Venturia · Seravalle');
    root.appendChild(doc);
    root.appendChild(footer);

    if (!state.proofing && state.status === 'submitted') {
      setSaveState('Sealed and sent ✓ You can still edit and re-seal.', 'is-saved');
    }
  }

  // ── DM view ─────────────────────────────────────────────────────────

  let dmRecords = {};

  function renderDmPicker(activeKey) {
    const picker = el('div', 'dm-picker');
    Object.keys(state.data.characters).forEach((key) => {
      const character = state.data.characters[key];
      const button = el('button', activeKey === key ? 'is-active' : '',
        character.name.split(' ')[0].replace(/[“”"]/g, ''));
      button.type = 'button';
      button.addEventListener('click', () => {
        state.charKey = key;
        renderRecord(key, (dmRecords[character.player] || {}).answers || {});
      });
      picker.appendChild(button);
    });
    return picker;
  }

  async function initDm() {
    state.proofing = true;
    try {
      const response = await fetch('/api/questionnaire/all', {
        cache: 'no-store', headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        (data.records || []).forEach((record) => {
          dmRecords[record.playerName] = record;
        });
      }
    } catch (error) { /* picker still works, just empty */ }
    const firstKey = Object.keys(state.data.characters)[0];
    const character = state.data.characters[firstKey];
    renderRecord(firstKey, (dmRecords[character.player] || {}).answers || {});
  }

  // ── Boot ────────────────────────────────────────────────────────────

  async function boot() {
    const pwa = await whenPwaReady();
    try {
      const response = await fetch('/data/questionnaire.json', { cache: 'no-store' });
      state.data = await response.json();
    } catch (error) {
      notice('Could not load the record. Try again in a moment.');
      return;
    }

    const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
    if (!name) {
      notice('Sign in to open your character record.', 'Choose your name', async () => {
        const chosen = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity({ force: true }) : null;
        if (chosen) boot();
      });
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

  boot();
})();
