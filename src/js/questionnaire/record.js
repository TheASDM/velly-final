import {
  CREST_SVG,
  DIE_SVG,
  el,
  markDirty,
  root,
  save,
  setSaveState,
  state,
} from './core.js';
import { renderDmExport, renderDmPicker } from './dm.js';

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

  // Suggestion die: appends an inspiration line instead of replacing
  // whatever the player already wrote.
  const suggestTable = question.suggest && state.data.tables[question.suggest];
  if (suggestTable) {
    const row = el('div', 'rollrow');
    const die = el('button', 'die js-roll');
    die.type = 'button';
    die.innerHTML = DIE_SVG;
    die.title = 'Stuck? Roll a suggestion — it adds a line you can edit or delete.';
    die.setAttribute('aria-label', die.title);
    die.addEventListener('click', () => {
      const pick = suggestTable[Math.floor(Math.random() * suggestTable.length)];
      textarea.value = textarea.value.trim()
        ? textarea.value.replace(/\s+$/, '') + '\n' + pick
        : pick;
      markDirty();
    });
    row.append(textarea, die);
    wrap.append(label, row);
  } else {
    wrap.append(label, textarea);
  }
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

export function renderRecord(charKey, answers) {
  const data = state.data;
  const character = data.characters[charKey];
  root.textContent = '';

  if (state.proofing) {
    root.appendChild(renderDmPicker(charKey));
    root.appendChild(renderDmExport());
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
