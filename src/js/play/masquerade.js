/* The Masquerade.
 *
 * Donning a mask, and becoming something else while wearing it.
 *
 * The ten minutes are game time, so the app does not count them — a wall
 * clock ticking through table talk was always wrong, and the table keeps its
 * own time. What makes this more than a toggle is the form: assuming one
 * replaces the statblock with a creature's, with the feature's overrides
 * applied and visible — her Intelligence stays, every DC in the creature's
 * block becomes her spell save DC, and her own hit points are held aside for
 * the revert.
 */
import { loadJsonCached } from './reference.js';

export function loadMasquerade() {
  return loadJsonCached('/data/play/masquerade.json');
}

export function loadForms() {
  return loadJsonCached('/data/play/forms.json');
}

/* Which masks a character actually chose.
 *
 * The subclass grants two of four, and Foundry knows which by the presence of
 * the feature on the sheet — so this reads the character rather than assuming.
 */
export function masksFor(model, masquerade) {
  if (!model || !masquerade) return [];
  const owned = new Set(
    (model.features || [])
      .map((feature) => (feature.name || '').toLowerCase())
      .filter((name) => name.startsWith('maschera '))
      .map((name) => name.split(' ')[1]),
  );
  return Object.values(masquerade.masks)
    .filter((mask) => owned.has(mask.key))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* The Challenge Rating ceiling: 1 at third level, 3 from sixth.
 * Read from The Hidden Power rather than hard-coded to a number. */
export function formCrCap(model) {
  return (model && model.level >= 6) ? 3 : 1;
}

export function formsForMask(forms, mask, cap) {
  if (!forms || !mask || !mask.type) return [];
  return (forms[mask.type] || []).filter((creature) => creature.crValue <= cap);
}

/* A creature's statblock, rewritten as the feature says it applies.
 *
 * Only Intelligence, memories and alignment stay the character's, and the
 * creature's DCs use her spell save DC. Showing the substitution rather than
 * silently rewriting the text means a player can see why the number differs
 * from the book.
 */
export function formOverrides(creature, model) {
  const notes = [];
  const spellDc = model && model.spellcasting && model.spellcasting.dc;
  const int = (model && (model.abilities || []).find((a) => a.key === 'int')) || null;

  if (int && creature.abilities && creature.abilities.int !== int.score) {
    notes.push({
      label: 'Intelligence',
      value: `${int.score} (${int.mod >= 0 ? '+' : ''}${int.mod})`,
      why: 'Yours — only Intelligence, memories and alignment stay.',
    });
  }
  if (spellDc) {
    notes.push({
      label: 'Save DC',
      value: String(spellDc),
      why: "Any DC in this creature's abilities uses your spell save DC.",
    });
  }
  notes.push({
    label: 'Bardic Inspiration',
    value: 'kept',
    why: 'Retained in any form. You cannot cast unless the form can.',
  });
  return notes;
}
