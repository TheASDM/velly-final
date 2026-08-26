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
  SPELL_SCHOOLS, ACTIVATION, SPELL_PREP, RECOVERY, ITEM_KIND, TOOLS, WEAPON_PROPERTIES,
  humanize, lookup,
} from './labels.js';
import { plainText, richText } from './html.js';
import { describeEffects, effectModifiers } from './effects.js';

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

/* Limited uses.
 *
 * The source item stores a formula — "@prof", "@scale.barbarian.rages" — so the
 * number only exists on the prepared actor. The bridge captures it as
 * derived.itemUses, which is preferred here; the source value is a fallback for
 * the features whose maximum is a plain number, and for exports made before the
 * bridge captured this.
 */
function usesOf(item, derivedUses) {
  const uses = item.system?.uses;
  if (!uses) return null;

  const resolved = derivedUses?.[item._id];
  const max = Number(resolved?.max ?? uses.max);
  if (!Number.isFinite(max) || max <= 0) return null;

  const spent = Number(resolved?.spent ?? uses.spent ?? 0) || 0;
  const periods = resolved?.recovery
    ?? (Array.isArray(uses.recovery) ? uses.recovery.map((r) => r?.period) : []);
  const recovery = periods && periods.length ? lookup(RECOVERY, periods[0], '') : '';

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
  const derivedUses = doc.derived?.itemUses;
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
      uses: usesOf(item, derivedUses),
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

/* Preparation, across two schema generations.
 *
 * dnd5e 5.2 replaced `preparation: {mode, prepared}` with `method` and a
 * numeric `prepared`, where 0 is known but unprepared, 1 is prepared, and 2 is
 * always prepared — which is what cantrips and granted spells are. Reading the
 * old shape against a 5.2 export finds nothing at all, which is exactly what
 * was happening, so both are read here.
 */
function preparationOf(item) {
  const sys = item.system ?? {};
  if (typeof sys.prepared === 'number') {
    return {
      prepared: sys.prepared >= 1,
      always: sys.prepared >= 2,
      method: lookup(SPELL_PREP, sys.method, ''),
    };
  }
  const legacy = sys.preparation ?? {};
  const mode = legacy.mode ?? '';
  return {
    prepared: legacy.prepared === true || mode === 'always' || mode === 'atwill',
    always: mode === 'always' || mode === 'atwill' || mode === 'innate',
    method: lookup(SPELL_PREP, mode, ''),
  };
}

function spells(doc) {
  const slotSource = doc.derived?.spells ?? doc.system?.spells ?? {};
  const items = (doc.items ?? []).filter((item) => item.type === 'spell');
  if (!items.length) return [];

  const byLevel = new Map();
  const seen = new Map();
  items.forEach((item) => {
    const level = Number(item.system?.level ?? 0);
    const prep = preparationOf(item);

    // Foundry's default name for an item someone created and never filled in.
    // They are not spells and there is nothing to show for them.
    if (!item.name || (item.name.trim() === 'New Spell' && !item.system?.description?.value)) {
      return;
    }

    /* The same spell can arrive more than once — a subclass grants Disguise
     * Self as always-prepared while a species already granted it innately, and
     * both are real, separate items. Two identical rows read as a bug, so they
     * merge into one that keeps the strongest preparation and remembers where
     * each copy came from. */
    const key = `${item.name.toLowerCase()}::${level}`;
    const existing = seen.get(key);
    if (existing) {
      existing.prepared = existing.prepared || prep.prepared;
      existing.always = existing.always || prep.always;
      if (prep.method && !existing.methods.includes(prep.method)) {
        existing.methods.push(prep.method);
      }
      return;
    }

    if (!byLevel.has(level)) byLevel.set(level, []);
    const entry = {
      id: item._id,
      name: item.name,
      level,
      school: lookup(SPELL_SCHOOLS, item.system?.school, ''),
      prepared: prep.prepared,
      always: prep.always,
      mode: prep.method,
      sourceClass: item.system?.sourceClass ?? '',
      methods: prep.method ? [prep.method] : [],
      meta: spellMeta(item),
      description: richText(item.system?.description?.value),
    };
    byLevel.get(level).push(entry);
    seen.set(key, entry);
  });

  const groups = [...byLevel.keys()]
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

  return regroupForPactMagic(groups, slotSource);
}

/* Pact Magic casts everything at one level.
 *
 * A level 3 warlock casting Burning Hands casts it as a 2nd-level spell —
 * always, with no choice in the matter. Listing it under "Level 1" describes
 * where the spell came from rather than what happens when they cast it, which
 * is the thing a player needs mid-turn. So every spell they can cast with a
 * pact slot collapses into one group named for the level it goes off at.
 *
 * Only for casters whose slots are *entirely* pact. A warlock multiclassed into
 * a full caster has real levelled slots too, and there the base level matters
 * again.
 */
function regroupForPactMagic(groups, slotSource) {
  const pact = slotSource.pact;
  const pactLevel = Number(pact?.level ?? 0);
  const pactMax = Number(pact?.max ?? 0);
  const hasLevelledSlots = Object.entries(slotSource)
    .some(([key, slot]) => /^spell[1-9]$/.test(key) && Number(slot?.max ?? 0) > 0);

  if (!pactMax || !pactLevel || hasLevelledSlots) return groups;

  const cantrips = groups.filter((group) => group.level === 0);
  const castable = groups.filter((group) => group.level > 0 && group.level <= pactLevel);
  // Mystic Arcanum sits above the pact level and is cast at its own, once per
  // rest, so it keeps its own heading.
  const arcanum = groups.filter((group) => group.level > pactLevel);

  if (!castable.length) return groups;

  return [
    ...cantrips,
    {
      level: pactLevel,
      label: `Cast at level ${pactLevel}`,
      pact: true,
      slots: { value: Number(pact.value ?? 0), max: pactMax },
      spells: castable
        .flatMap((group) => group.spells)
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    },
    ...arcanum,
  ];
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

/* ── Attacks ───────────────────────────────────────────────────────── */

/* What it takes to swing the thing.
 *
 * The two numbers a player wants mid-turn — what they add to the roll and what
 * dice they throw — are derived, not stored: the bonus folds in proficiency,
 * an ability modifier, the weapon's own magic and anything currently buffing
 * them. Only the prepared activity knows the answer, so the bridge captures it
 * and this reads it back.
 *
 * Without that capture the damage dice are still recoverable from source, and
 * that is what an older export shows: the dice, and no claimed bonus. A blank
 * where a number should be is honest. A number this file invented would not be.
 */
function damageFromSource(activity, item) {
  /* A weapon's own die lives on the item and the activity says whether it
     counts — `includeBase`. Adding it unconditionally would double the damage
     of any activity that already lists its own parts. */
  const base = activity?.damage?.includeBase !== false && item?.system?.damage?.base
    ? [item.system.damage.base] : [];
  return [...(activity?.damage?.parts ?? []), ...base]
    .map((part) => {
      if (!part?.number || !part?.denomination) return '';
      const types = (part.types ?? []).map(humanize).join('/');
      const bonus = part.bonus ? ` + ${part.bonus}` : '';
      return `${part.number}d${part.denomination}${bonus}${types ? ` ${types}` : ''}`;
    })
    .filter(Boolean)
    .join(' plus ');
}

function rangeFromSource(activity, item) {
  const range = activity?.range?.value ? activity.range : item?.system?.range;
  if (!range?.value) return '';
  const units = range.units || 'ft';
  return range.long ? `${range.value}/${range.long} ${units}.` : `${range.value} ${units}.`;
}

/* Foundry's own key for an attack: melee/ranged crossed with weapon/spell.
 * Its effects target these exact keys, so using them here means a damage bonus
 * lands on precisely the attacks Foundry would land it on. */
function attackKind(activity) {
  const type = activity?.attack?.type ?? {};
  const reach = type.value === 'ranged' ? 'r' : 'm';
  const kind = type.classification === 'spell' ? 'sak' : 'wak';
  return `${reach}${kind}`;
}

function attacks(doc) {
  const derived = doc.derived?.attacks ?? {};
  const rows = [];

  for (const item of doc.items ?? []) {
    /* Spells are excluded even when they attack. Fire Bolt has a to-hit and a
       damage die, but it already has a home in the spell list, and a player
       looking for it looks there. Weapons and the features that grant attacks
       have nowhere else to be. */
    if (item.type !== 'weapon' && item.type !== 'feat') continue;

    const activities = item.system?.activities;
    if (!activities || typeof activities !== 'object') continue;

    const captured = derived[item._id] ?? [];
    /* An Unarmed Strike carries Damage, Grapple and Shove; only one is an
       attack, so the count that decides whether to name the variant is of
       attacks, not of activities. */
    const attackActivities = Object.values(activities).filter((a) => a?.type === 'attack');

    attackActivities.forEach((activity, index) => {
      const found = captured.find((row) => row.id === activity._id) ?? captured[index] ?? {};
      const properties = (item.system?.properties ?? [])
        .map((code) => lookup(WEAPON_PROPERTIES, code));

      rows.push({
        id: `${item._id}:${activity._id ?? index}`,
        itemId: item._id,
        name: item.name,
        /* An item with one attack is just itself; the activity name only earns
           its place when a weapon offers a choice (thrown, versatile). */
        variant: attackActivities.length > 1 ? (activity.name || '') : '',
        toHit: found.toHit ?? null,
        damage: found.damage || damageFromSource(activity, item) || '',
        range: found.range || rangeFromSource(activity, item),
        attackKind: attackKind(activity),
        kind: item.type === 'weapon' ? 'weapon' : 'feature',
        equipped: item.system?.equipped === true,
        mastery: item.system?.mastery ? humanize(item.system.mastery) : '',
        properties,
      });
    });
  }

  /* A row with neither a bonus nor a die has nothing to tell anyone. Before
     the bridge captures attacks these are the items whose numbers are entirely
     derived; after it, they fill in and reappear. */
  return rows
    .filter((row) => row.toHit || row.damage)
    .sort((a, b) =>
      Number(b.equipped) - Number(a.equipped)
      || Number(/unarmed/i.test(a.name)) - Number(/unarmed/i.test(b.name))
      || a.name.localeCompare(b.name));
}

/* ── Activatable features ──────────────────────────────────────────── */

/* Features a player turns on, spends a use for, and then wants to see the
 * consequences of — Rage being the one this was built for.
 *
 * The test is deliberately structural rather than a list of names: a feature
 * with limited uses that carries an Active Effect is, by construction, a thing
 * you switch on that changes your numbers. Spells are excluded because they
 * already have a home, and duplicating Longstrider onto the play bar would be
 * two places to tap for one thing.
 */
function activatable(doc, derivedUses) {
  const context = { scale: doc.derived?.scale ?? {}, prof: doc.derived?.prof ?? null };

  return (doc.items ?? [])
    .filter((item) => item.type === 'feat')
    .map((item) => {
      const uses = usesOf(item, derivedUses);
      const grants = describeEffects(item, context);
      if (!uses || !grants.length) return null;
      return {
        id: item._id,
        name: item.name,
        uses,
        grants,
        modifiers: effectModifiers(item, context),
        activation: activationOf(item),
      };
    })
    .filter(Boolean);
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

  /* Levelled slots, and Pact Magic.
   *
   * A warlock's slots are a separate pool: every one is the same level, and
   * they come back on a Short Rest rather than a Long one. Filtering to
   * spell1..9 dropped them entirely, so a warlock showed either nothing or —
   * if their class was misconfigured — someone else's slots. */
  const spellSource = derived.spells ?? sys.spells ?? {};
  const slots = Object.entries(spellSource)
    .filter(([key, slot]) => /^spell[1-9]$/.test(key) && Number(slot?.max ?? 0) > 0)
    .map(([key, slot]) => ({
      level: Number(key.replace('spell', '')),
      value: Number(slot.value ?? 0),
      max: Number(slot.max ?? 0),
      pact: false,
    }))
    .sort((a, b) => a.level - b.level);

  const pactSlot = spellSource.pact;
  if (Number(pactSlot?.max ?? 0) > 0) {
    slots.push({
      level: Number(pactSlot.level ?? 0) || null,
      value: Number(pactSlot.value ?? 0),
      max: Number(pactSlot.max ?? 0),
      pact: true,
    });
  }

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
    attacks: attacks(doc),
    activatable: activatable(doc, doc.derived?.itemUses),
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
