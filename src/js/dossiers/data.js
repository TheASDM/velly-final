/* Assemble the dossier model from live sources.
 *
 * Nothing here is baked at build time — the questions come from
 * /api/questionnaire/definitions, the roster (display names + colors) from
 * /data/players.json, and the answers from /api/questionnaire/all. Both API
 * sources are DM-gated server-side.
 */

// The handful of answers worth surfacing before anything else. Keys must exist
// in the shared Part I set.
export const STRIP = [
  { label: 'Owes', key: 'P1 - who you owe' },
  { label: '3am person', key: 'P1 - your 3am person' },
  { label: 'Mask', key: 'P1 - your mask' },
  { label: 'Tell', key: 'P1 - your tell' },
  { label: 'Vice', key: 'P1 - your vice' },
  { label: 'Wants', key: 'P1 - what you want' },
];

const FALLBACK_COLOR = '#D0AE5E';

import { getJson } from '../shared/pwa.js';

// Every character shares the same vitals group structure (build_questionnaire.py
// derives them from one template), so the first entry defines the shape.
function vitalsGroupsFrom(characters) {
  const first = Object.values(characters)[0];
  if (!first) return [];
  return first.vitals.map((group) => ({
    label: group.group,
    fields: group.fields.map((field) => ({ key: field.key, label: field.label })),
  }));
}

function promptIndex(definitions) {
  const prompts = {};
  definitions.part1.forEach((q) => { prompts[q.key] = q.prompt; });
  Object.values(definitions.characters).forEach((character) => {
    character.part2.forEach((q) => { prompts[q.key] = q.prompt; });
  });
  prompts[definitions.codaKey] = definitions.codaPrompt;
  return prompts;
}

// Index the on-file vitals values so the view can show what's on record for a
// field the player left blank, and flag the ones they overrode.
function onFileIndex(character) {
  const index = {};
  character.vitals.forEach((group) => {
    group.fields.forEach((field) => {
      if (field.onFile && field.value) index[field.key] = field.value;
    });
  });
  return index;
}

/* Counts must match render_markdown() in export_questionnaires.py: a blank
 * vitals field that has an on-file value still counts as known. */
function tally(definitions, character, answers) {
  const onFile = onFileIndex(character);
  const keys = [
    ...definitions.part1.map((q) => q.key),
    ...character.part2.map((q) => q.key),
    ...character.vitals.flatMap((g) => g.fields.map((f) => f.key)),
    definitions.codaKey,
  ];
  let answered = 0;
  keys.forEach((key) => {
    const value = (answers[key] || '').trim();
    if (value || (!value && onFile[key])) answered += 1;
  });
  return { answered, total: keys.length };
}

export async function loadDossiers() {
  const [definitions, roster, payload] = await Promise.all([
    getJson('/api/questionnaire/definitions'),
    getJson('/data/players.json'),
    getJson('/api/questionnaire/all'),
  ]);

  const byPlayer = {};
  (payload.records || []).forEach((record) => { byPlayer[record.playerName] = record; });
  const rosterByName = {};
  roster.forEach((entry) => { rosterByName[entry.name] = entry; });

  const characters = Object.keys(definitions.characters).map((key) => {
    const character = definitions.characters[key];
    const record = byPlayer[character.player] || {};
    const answers = record.answers || {};
    const seat = rosterByName[character.player] || {};
    const { answered, total } = tally(definitions, character, answers);

    return {
      id: key,
      player: character.player,
      name: character.name,
      short: seat.display || character.name.split(' ')[0].replace(/[“”"]/g, ''),
      role: character.role || '',
      color: seat.color || FALLBACK_COLOR,
      status: record.status || 'draft',
      submitted: record.submitted_at || null,
      updated: record.updated_at || null,
      answers,
      onFile: onFileIndex(character),
      p2: character.part2.map((q) => q.key),
      answered,
      total,
    };
  });

  return {
    p1: definitions.part1.map((q) => q.key),
    codaKey: definitions.codaKey,
    prompts: promptIndex(definitions),
    vitalsGroups: vitalsGroupsFrom(definitions.characters),
    characters,
  };
}
