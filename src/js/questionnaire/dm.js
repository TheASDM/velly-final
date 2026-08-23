import { authHeaders, el, state } from './core.js';
import { renderRecord } from './record.js';

let dmRecords = {};

// Walk one character's record in document order. Same sources renderRecord
// reads (state.data.part1, character.part2, character.vitals, codaKey), so
// the exported prompts are the on-screen prompts — no duplicated strings.
function sectionsFor(charKey) {
  const data = state.data;
  const character = data.characters[charKey];
  const sections = [
    { heading: "Part One — everyone answers these", kind: 'prose', fields: data.part1 },
    { heading: "Part Two — your character's own questions", kind: 'prose', fields: character.part2 },
  ];
  character.vitals.forEach((group) => {
    sections.push({ heading: 'Part Three — ' + group.group, kind: 'vitals', fields: group.fields });
  });
  sections.push({
    heading: 'One more thing',
    kind: 'prose',
    fields: [{ key: data.codaKey, prompt: data.codaPrompt, title: 'Anything else?' }],
  });
  return sections;
}

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = el('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stampNow() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
}

// Mirrors render_markdown() in export_questionnaires.py. A browser can't
// write a folder, so every player goes into one document.
function recordsToMarkdown() {
  const data = state.data;
  const lines = ['# Questionnaire export', '', 'Exported ' + new Date().toISOString() + '.', ''];

  Object.keys(data.characters).forEach((charKey) => {
    const character = data.characters[charKey];
    const record = dmRecords[character.player] || {};
    const answers = record.answers || {};

    lines.push('---', '', '# ' + character.name, '',
      '**Player:** ' + character.player + '  ',
      '**Role:** ' + (character.role || '') + '  ',
      '**Status:** ' + (record.status || 'draft') + '  ',
      '**Submitted:** ' + (record.submitted_at || '—') + '  ',
      '**Last updated:** ' + (record.updated_at || '—'), '');

    sectionsFor(charKey).forEach((section) => {
      lines.push('## ' + section.heading, '');
      section.fields.forEach((field) => {
        const raw = answers[field.key];
        const has = typeof raw === 'string' && raw.trim() !== '';
        if (section.kind === 'vitals') {
          const onFile = field.value || '';
          let shown;
          if (has && field.onFile && raw.trim() !== onFile.trim()) {
            shown = raw.trim() + '  _(changed from on-file “' + onFile + '”)_';
          } else if (has) shown = raw.trim();
          else if (onFile) shown = onFile + '  _(on file, unchanged)_';
          else shown = '_(blank)_';
          lines.push('- **' + field.label + ':** ' + shown);
        } else {
          lines.push('### ' + (field.title || field.key), '', '> ' + field.prompt, '',
            has ? raw.trim() : '_(blank)_', '');
        }
      });
      lines.push('');
    });
  });

  return lines.join('\n').replace(/\s+$/, '') + '\n';
}

export function renderDmExport() {
  const bar = el('div', 'dm-export');
  const hasRecords = Object.keys(dmRecords).length > 0;

  [
    ['Download JSON', () => download(
      'questionnaires-' + stampNow() + '.json',
      JSON.stringify({ exported_at: new Date().toISOString(), records: Object.values(dmRecords) }, null, 2) + '\n',
      'application/json',
    )],
    ['Download Markdown', () => download(
      'questionnaires-' + stampNow() + '.md', recordsToMarkdown(), 'text/markdown',
    )],
  ].forEach(([label, onClick]) => {
    const button = el('button', '', label);
    button.type = 'button';
    // Nothing loaded means the fetch failed or the session isn't DM —
    // better to disable than hand back an empty backup.
    if (!hasRecords) button.disabled = true;
    else button.addEventListener('click', onClick);
    bar.appendChild(button);
  });

  if (!hasRecords) {
    bar.appendChild(el('span', 'dm-export-note', 'No records loaded — sign in as DM to export.'));
  }

  // This view proofs one record as the player sees it. Reading and comparing
  // across the whole table is the dossier browser's job.
  const readLink = el('a', 'dm-export-link', 'Read all dossiers →');
  readLink.href = '/dossiers/';
  bar.appendChild(readLink);

  return bar;
}

export function renderDmPicker(activeKey) {
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

export async function initDm() {
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
