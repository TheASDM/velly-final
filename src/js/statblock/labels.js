/* Foundry dnd5e stores nearly everything as a short code — "prf", "lgt",
 * "grg", "enc". These are the display names.
 *
 * Anything not listed falls back to a title-cased version of the code, so
 * homebrew and module content still reads sensibly instead of vanishing or
 * showing raw slugs.
 */

export const ABILITIES = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const SKILLS = {
  acr: 'Acrobatics', ani: 'Animal Handling', arc: 'Arcana', ath: 'Athletics',
  dec: 'Deception', his: 'History', ins: 'Insight', itm: 'Intimidation',
  inv: 'Investigation', med: 'Medicine', nat: 'Nature', prc: 'Perception',
  prf: 'Performance', per: 'Persuasion', rel: 'Religion', slt: 'Sleight of Hand',
  ste: 'Stealth', sur: 'Survival',
};

export const SIZES = {
  tiny: 'Tiny', sm: 'Small', med: 'Medium',
  lg: 'Large', huge: 'Huge', grg: 'Gargantuan',
};

export const ARMOR_PROF = {
  lgt: 'Light armor', med: 'Medium armor', hvy: 'Heavy armor', shl: 'Shields',
};

export const WEAPON_PROF = {
  sim: 'Simple weapons', mar: 'Martial weapons',
  simM: 'Simple melee', simR: 'Simple ranged',
  marM: 'Martial melee', marR: 'Martial ranged',
};

/* Foundry tool/instrument baseItem ids. */
export const TOOLS = {
  tinker: "Tinker's Tools", thief: "Thieves' Tools", herb: 'Herbalism Kit',
  disg: 'Disguise Kit', forg: 'Forgery Kit', navg: "Navigator's Tools",
  pois: "Poisoner's Kit", alchemist: "Alchemist's Supplies", brewer: "Brewer's Supplies",
  calligrapher: "Calligrapher's Supplies", carpenter: "Carpenter's Tools",
  cartographer: "Cartographer's Tools", cobbler: "Cobbler's Tools", cook: "Cook's Utensils",
  glassblower: "Glassblower's Tools", jeweler: "Jeweler's Tools", leatherworker: "Leatherworker's Tools",
  mason: "Mason's Tools", painter: "Painter's Supplies", potter: "Potter's Tools",
  smith: "Smith's Tools", tinker_tools: "Tinker's Tools", weaver: "Weaver's Tools",
  woodcarver: "Woodcarver's Tools",
  bagpipes: 'Bagpipes', drum: 'Drum', dulcimer: 'Dulcimer', flute: 'Flute',
  lute: 'Lute', lyre: 'Lyre', horn: 'Horn', panflute: 'Pan Flute',
  shawm: 'Shawm', viol: 'Viol',
};

export const SPELL_SCHOOLS = {
  abj: 'Abjuration', con: 'Conjuration', div: 'Divination', enc: 'Enchantment',
  evo: 'Evocation', ill: 'Illusion', nec: 'Necromancy', trs: 'Transmutation',
};

export const ACTIVATION = {
  action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction',
  minute: 'Minute', hour: 'Hour', day: 'Day', special: 'Special',
  legendary: 'Legendary Action', mythic: 'Mythic Action', lair: 'Lair Action',
  crew: 'Crew Action', encounter: 'Per Encounter', turnStart: 'Turn Start',
  turnEnd: 'Turn End',
};

export const SPELL_PREP = {
  prepared: 'Prepared', always: 'Always Prepared', pact: 'Pact Magic',
  atwill: 'At Will', innate: 'Innate', ritual: 'Ritual',
};

/* Recovery periods for limited-use features. */
export const RECOVERY = {
  sr: 'Short Rest', lr: 'Long Rest', day: 'Day', charges: 'Charges',
  dawn: 'Dawn', dusk: 'Dusk', round: 'Round', turn: 'Turn',
};

/* Item types worth separating on the sheet. Anything else lands in inventory. */
export const ITEM_KIND = {
  weapon: 'Weapon', equipment: 'Equipment', consumable: 'Consumable',
  tool: 'Tool', loot: 'Loot', container: 'Container', backpack: 'Container',
};

const WORD_BREAK = /([a-z0-9])([A-Z])/g;

/* Fallback for an unmapped code: "animalHandling" -> "Animal Handling",
 * "half-plate" -> "Half Plate". */
export function humanize(code) {
  const text = String(code ?? '').trim();
  if (!text) return '';
  return text
    .replace(WORD_BREAK, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function lookup(map, code, fallback) {
  const key = String(code ?? '');
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return fallback === undefined ? humanize(key) : fallback;
}

/* Foundry writes a bare number as e.g. 2; sheets want "+2" / "-1". */
export function signed(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return number >= 0 ? `+${number}` : `${number}`;
}
