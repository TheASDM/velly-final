/* Foundry actor JSON -> the model the sheet renders.
 *
 * Everything numeric comes from the `derived` block that scripts/foundry-export.js
 * captures off the prepared actor, so the app never does 5e arithmetic and never
 * disagrees with the table. Where `derived` is missing (an older export, or a
 * file someone made by hand) we fall back to the source data and compute only
 * what is unambiguous — ability modifiers and the values that follow from them.
 * AC and max HP are never guessed; they show as unknown instead of wrong.
 */
import {
  ABILITIES, ABILITY_ORDER, SKILLS, SIZES, ARMOR_PROF, WEAPON_PROF,
  SPELL_SCHOOLS, ACTIVATION, SPELL_PREP, RECOVERY, ITEM_KIND, TOOLS, humanize, lookup,
} from './labels.js';
import { plainText, richText } from './html.js';

const modifierOf = (score) => (score == null ? null : Math.floor((Number(score) - 10) / 2));

function list(trait) {
  const values = Array.isArray(trait?.value) ? trait.value : [];
  const custom = String(trait?.custom ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...values.map((code) => humanize(code)), ...custom];
}

/* ── Identity ──────────────────────────────────────────────────────── */

function classLine(doc) {
  const classes = doc.derived?.classes;
  if (Array.isArray(classes) && classes.length) {
    return classes
      .map((entry) => [entry.subclass, entry.name, entry.levels].filter(Boolean).join(' '))
      .join(' / ');
  }
  // Fall back to the class items themselves.
  const items = (doc.items ?? []).filter((item) => item.type === 'class');
  if (!items.length) return '';
  return items.map((item) => [item.name, item.system?.levels].filter(Boolean).join(' ')).join(' / ');
}

/* details.race / .background / .originalClass are _id pointers into items[]. */
function resolveById(doc, id) {
  if (!id) return null;
  return (doc.items ?? []).find((item) => item._id === id) ?? null;
}

/* ── Abilities and skills ──────────────────────────────────────────── */

function abilities(doc) {
  const derived = doc.derived?.abilities ?? {};
  const source = doc.system?.abilities ?? {};
  return ABILITY_ORDER
    .filter((key) => source[key] || derived[key])
    .map((key) => {
      const from = derived[key] ?? {};
      const score = from.value ?? source[key]?.value ?? null;
      const mod = from.mod ?? modifierOf(score);
      const proficient = Number(from.proficient ?? source[key]?.proficient ?? 0) > 0;
      return {
        key,
        label: ABILITIES[key],
        short: key.toUpperCase(),
        score,
        mod,
        save: from.save ?? (mod == null ? null : mod + (proficient ? (doc.derived?.prof ?? 0) : 0)),
        proficient,
      };
    });
}

function skills(doc, abilityIndex) {
  const derived = doc.derived?.skills ?? {};
  const source = doc.system?.skills ?? {};
  const prof = doc.derived?.prof ?? 0;

  return Object.keys(SKILLS)
    .filter((key) => source[key] || derived[key])
    .map((key) => {
      const from = derived[key] ?? {};
      const ability = from.ability ?? source[key]?.ability ?? 'int';
      const rank = Number(from.proficient ?? source[key]?.value ?? 0);
      const mod = abilityIndex[ability]?.mod ?? null;
      const total = from.total ?? (mod == null ? null : mod + prof * rank);
      return {
        key,
        label: SKILLS[key],
        ability,
        abilityShort: ability.toUpperCase(),
        rank,
        total,
        passive: from.passive ?? (total == null ? null : 10 + total),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function tools(doc, abilityIndex) {
  const derived = doc.derived?.tools ?? {};
  const source = doc.system?.tools ?? {};
  const prof = doc.derived?.prof ?? 0;
  return Object.keys({ ...source, ...derived }).map((key) => {
    const from = derived[key] ?? {};
    const ability = from.ability ?? source[key]?.ability ?? 'int';
    const rank = Number(from.proficient ?? source[key]?.value ?? 0);
    const mod = abilityIndex[ability]?.mod ?? null;
    return {
      key,
      label: lookup(TOOLS, key),
      ability,
      rank,
      total: from.total ?? (mod == null ? null : mod + prof * rank),
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

/* ── Vitals ────────────────────────────────────────────────────────── */

function speedLine(doc) {
  const movement = doc.derived?.movement
    ?? (doc.items ?? []).find((item) => item.type === 'race')?.system?.movement
    ?? doc.system?.attributes?.movement
    ?? {};
  const units = movement.units || 'ft';
  const parts = ['walk', 'fly', 'swim', 'climb', 'burrow']
    .filter((key) => Number(movement[key]) > 0)
    .map((key) => (key === 'walk' ? `${movement[key]} ${units}.` : `${humanize(key)} ${movement[key]} ${units}.`));
  if (movement.hover) parts.push('hover');
  return parts.join(', ');
}

function senseList(doc) {
  const senses = doc.derived?.senses ?? doc.system?.attributes?.senses ?? {};
  const units = senses.units || 'ft';
  const parts = ['darkvision', 'blindsight', 'tremorsense', 'truesight']
    .filter((key) => Number(senses[key]) > 0)
    .map((key) => `${humanize(key)} ${senses[key]} ${units}.`);
  if (senses.special) parts.push(String(senses.special));
  return parts;
}

function hitDice(doc) {
  const hd = doc.derived?.hitDice;
  const classes = doc.derived?.classes ?? [];
  // 5.2.x keeps the die on the class item as hd.denomination; older builds
  // used system.hitDice. Read both so either export shows a die.
  const denominations = (doc.items ?? [])
    .filter((item) => item.type === 'class')
    .map((item) => item.system?.hd?.denomination ?? item.system?.hitDice)
    .filter(Boolean);
  const denomination = denominations[0] ?? null;
  const levels = classes.reduce((sum, entry) => sum + (entry.levels ?? 0), 0)
    || doc.derived?.level
    || null;
  if (!denomination || !levels) return hd?.max != null ? `${hd.value ?? hd.max}/${hd.max}` : '';
  return `${hd?.value ?? levels}/${levels} ${denomination}`;
}

/* ── Items ─────────────────────────────────────────────────────────── */

function usesOf(item) {
  const uses = item.system?.uses;
  if (!uses) return null;
  const max = Number(uses.max);
  if (!max) return null;
  const spent = Number(uses.spent ?? 0);
  const recovery = Array.isArray(uses.recovery) && uses.recovery.length
    ? lookup(RECOVERY, uses.recovery[0].period, '')
    : '';
  return { value: Math.max(0, max - spent), max, recovery };
}

/* The first activation on an item, which is what the sheet shows as its cost. */
function activationOf(item) {
  const activities = item.system?.activities;
  const first = activities && typeof activities === 'object' ? Object.values(activities)[0] : null;
  const activation = first?.activation ?? item.system?.activation;
  if (!activation?.type) return '';
  const label = lookup(ACTIVATION, activation.type);
  const count = Number(activation.value ?? 0);
  return count > 1 ? `${count} ${label}s` : label;
}

function featureKind(item) {
  const subtype = item.system?.type?.value;
  if (item.type === 'feat') return lookup({ race: 'Species', class: 'Class', background: 'Background', feat: 'Feat', monster: 'Monster' }, subtype, 'Feature');
  return lookup({ race: 'Species', background: 'Background', class: 'Class', subclass: 'Subclass' }, item.type, humanize(item.type));
}

function features(doc) {
  const wanted = new Set(['feat', 'race', 'background', 'class', 'subclass']);
  const seen = new Set();

  return (doc.items ?? [])
    .filter((item) => wanted.has(item.type))
    .filter((item) => {
      // Imported species grant duplicate entries (two "Languages" feats on the
      // sample). Same name and same body is the same feature twice.
      const fingerprint = `${item.name}::${plainText(item.system?.description?.value).slice(0, 120)}`;
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .map((item) => ({
      id: item._id,
      name: item.name,
      kind: featureKind(item),
      requirements: item.system?.requirements ?? '',
      source: [item.system?.source?.book, item.system?.source?.page].filter(Boolean).join(' '),
      rules: item.system?.source?.rules ?? '',
      activation: activationOf(item),
      uses: usesOf(item),
      description: richText(item.system?.description?.value),
      summary: plainText(item.system?.description?.value).slice(0, 220),
    }));
}

function spellMeta(item) {
  const sys = item.system ?? {};
  const bits = [];
  const activation = activationOf(item);
  if (activation) bits.push(activation);
  if (sys.range?.units === 'self') bits.push('Self');
  else if (sys.range?.value) bits.push(`${sys.range.value} ${sys.range.units || 'ft'}.`);
  else if (sys.range?.units === 'touch') bits.push('Touch');
  const props = Array.isArray(sys.properties) ? sys.properties : [];
  if (props.includes('concentration')) bits.push('Concentration');
  if (props.includes('ritual')) bits.push('Ritual');
  return bits;
}

function spells(doc) {
  const slotSource = doc.derived?.spells ?? doc.system?.spells ?? {};
  const items = (doc.items ?? []).filter((item) => item.type === 'spell');
  if (!items.length) return [];

  const byLevel = new Map();
  items.forEach((item) => {
    const level = Number(item.system?.level ?? 0);
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push({
      id: item._id,
      name: item.name,
      level,
      school: lookup(SPELL_SCHOOLS, item.system?.school, ''),
      prepared: item.system?.preparation?.prepared === true,
      mode: lookup(SPELL_PREP, item.system?.preparation?.mode, ''),
      meta: spellMeta(item),
      description: richText(item.system?.description?.value),
    });
  });

  return [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => {
      const slot = slotSource[`spell${level}`] ?? {};
      return {
        level,
        label: level === 0 ? 'Cantrips' : `Level ${level}`,
        slots: level === 0 ? null : { value: slot.value ?? 0, max: slot.max ?? 0 },
        spells: byLevel.get(level).sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
}

function inventory(doc) {
  const wanted = new Set(['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack']);
  return (doc.items ?? [])
    .filter((item) => wanted.has(item.type))
    .map((item) => {
      const sys = item.system ?? {};
      const meta = [];
      if (item.type === 'weapon') {
        const base = sys.damage?.base;
        if (base?.number && base?.denomination) {
          const types = (base.types ?? []).map(humanize).join('/');
          meta.push(`${base.number}d${base.denomination}${types ? ` ${types}` : ''}`);
        }
        if (sys.range?.value) meta.push(`${sys.range.value}/${sys.range.long ?? ''} ${sys.range.units || 'ft'}.`.replace('/ ', ' '));
      }
      if (item.type === 'equipment' && sys.armor?.value) meta.push(`AC ${sys.armor.value}`);
      if (sys.type?.value) {
        meta.push(item.type === 'weapon'
          ? lookup(WEAPON_PROF, sys.type.value)
          : lookup(TOOLS, sys.type.value));
      }
      return {
        id: item._id,
        name: item.name,
        kind: lookup(ITEM_KIND, item.type),
        quantity: Number(sys.quantity ?? 1),
        weight: sys.weight?.value ?? null,
        equipped: sys.equipped === true,
        rarity: sys.rarity ? humanize(sys.rarity) : '',
        meta,
        description: richText(sys.description?.value),
      };
    })
    .sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.name.localeCompare(b.name));
}

/* ── Entry point ───────────────────────────────────────────────────── */

export function normalizeStatblock(raw) {
  const doc = raw && typeof raw === 'object' ? raw : {};
  const sys = doc.system ?? {};
  const derived = doc.derived ?? {};

  const spellItems = (doc.items ?? []).filter((item) => item.type === 'spell').length;

  const abilityRows = abilities(doc);
  const abilityIndex = Object.fromEntries(abilityRows.map((row) => [row.key, row]));
  const skillRows = skills(doc, abilityIndex);
  const skillIndex = Object.fromEntries(skillRows.map((row) => [row.key, row]));

  const raceItem = resolveById(doc, sys.details?.race);
  const backgroundItem = resolveById(doc, sys.details?.background);

  const hp = derived.hp ?? sys.attributes?.hp ?? {};
  const spellDc = derived.spellDc ?? null;
  const spellAbility = derived.spellAbility ?? sys.attributes?.spellcasting ?? '';

  const slots = Object.entries(derived.spells ?? sys.spells ?? {})
    .filter(([key, slot]) => /^spell[1-9]$/.test(key) && Number(slot?.max ?? 0) > 0)
    .map(([key, slot]) => ({
      level: Number(key.replace('spell', '')),
      value: Number(slot.value ?? 0),
      max: Number(slot.max ?? 0),
    }))
    .sort((a, b) => a.level - b.level);

  return {
    name: doc.name ?? 'Unnamed',
    level: derived.level ?? null,
    classLine: classLine(doc),
    // The identifiers, kept separate from the display line: a subclass caster
    // prepares from another class's list, and matching on a formatted string
    // would be guesswork.
    classes: (derived.classes ?? []).map((entry) => ({
      identifier: entry.identifier ?? '',
      name: entry.name ?? '',
      levels: entry.levels ?? null,
      subclass: entry.subclass ?? null,
    })),
    race: derived.raceName ?? raceItem?.name ?? '',
    background: derived.backgroundName ?? backgroundItem?.name ?? '',
    size: lookup(SIZES, sys.traits?.size, ''),
    alignment: sys.details?.alignment ?? '',
    xp: sys.details?.xp?.value ?? null,

    vitals: {
      ac: derived.ac ?? null,
      hp: {
        value: hp.value ?? null,
        max: hp.max ?? null,
        temp: hp.temp ?? 0,
        tempmax: hp.tempmax ?? 0,
      },
      initiative: derived.initiative ?? abilityIndex.dex?.mod ?? null,
      prof: derived.prof ?? null,
      speed: speedLine(doc),
      hitDice: hitDice(doc),
      inspiration: sys.attributes?.inspiration === true,
      exhaustion: Number(sys.attributes?.exhaustion ?? 0),
      deathSaves: {
        success: Number(sys.attributes?.death?.success ?? 0),
        failure: Number(sys.attributes?.death?.failure ?? 0),
      },
    },

    abilities: abilityRows,
    skills: skillRows,
    tools: tools(doc, abilityIndex),
    passives: {
      perception: skillIndex.prc?.passive ?? null,
      investigation: skillIndex.inv?.passive ?? null,
      insight: skillIndex.ins?.passive ?? null,
    },
    senses: senseList(doc),

    // A spell DC alone proves nothing — dnd5e derives one for every actor,
    // so a Barbarian arrives with DC 11 and no magic. Require actual slots or
    // actual spells before claiming this character casts.
    spellcasting: (!slots.length && !spellItems) ? null : {
      ability: spellAbility,
      abilityLabel: lookup(ABILITIES, spellAbility, ''),
      dc: spellDc,
      // dc = 8 + proficiency + modifier, so the attack bonus is just dc - 8.
      attack: spellDc == null ? null : spellDc - 8,
      slots,
    },

    proficiencies: {
      armor: (sys.traits?.armorProf?.value ?? []).map((code) => lookup(ARMOR_PROF, code))
        .concat(list({ custom: sys.traits?.armorProf?.custom })),
      weapons: (sys.traits?.weaponProf?.value ?? []).map((code) => lookup(WEAPON_PROF, code))
        .concat(list({ custom: sys.traits?.weaponProf?.custom })),
      languages: list(sys.traits?.languages),
      masteries: (sys.traits?.weaponProf?.mastery?.value ?? []).map(humanize),
    },

    defenses: {
      resistances: list(sys.traits?.dr),
      immunities: list(sys.traits?.di),
      vulnerabilities: list(sys.traits?.dv),
      conditionImmunities: list(sys.traits?.ci),
    },

    features: features(doc),
    spells: spells(doc),
    inventory: inventory(doc),
    currency: sys.currency ?? {},

    meta: {
      exportedAt: doc.vosExport?.exportedAt ?? null,
      system: doc.vosExport?.system ?? null,
      /* No derived block means an export from before the macro, or a hand-made
         file. The sheet warns rather than quietly showing blanks. */
      hasDerived: Boolean(doc.derived),
    },
  };
}
