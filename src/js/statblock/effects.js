/* What a feature actually does, in words a player can act on.
 *
 * Foundry already knows. An activatable feature carries Active Effects whose
 * `changes` are the mechanical truth — Rage's effect says it adds
 * `+@scale.barbarian.rage-damage` to melee weapon damage, grants resistance to
 * three damage types, and sets Strength checks and saves to advantage. Reading
 * that beats re-encoding the barbarian chapter here: when the DM edits the
 * feature in Foundry, the sheet follows, and a homebrew feature nobody wrote
 * code for still explains itself.
 *
 * The trade is that a change key is not English, so this module is a
 * translation table. Anything it cannot translate is shown verbatim rather than
 * dropped — an odd-looking line is a much smaller failure than a missing one
 * when someone is deciding whether to spend their last Rage.
 */
import { humanize } from './labels.js';

/* Foundry's CONST.ACTIVE_EFFECT_MODES. */
const ADD = 2;
const DOWNGRADE = 3;
const UPGRADE = 4;
const OVERRIDE = 5;

const ATTACK_KINDS = {
  mwak: 'melee weapon attacks',
  rwak: 'ranged weapon attacks',
  msak: 'melee spell attacks',
  rsak: 'ranged spell attacks',
};

const TRAITS = {
  dr: (what) => `Resistance to ${what}`,
  di: (what) => `Immunity to ${what}`,
  dv: (what) => `Vulnerability to ${what}`,
  ci: (what) => `Immune to the ${what} condition`,
};

const ABILITY_NAMES = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const MOVEMENT = { walk: 'Speed', fly: 'Fly speed', swim: 'Swim speed', climb: 'Climb speed', burrow: 'Burrow speed' };

/* Roll modes are numbers: 1 advantage, -1 disadvantage. */
function rollMode(value) {
  const n = Number(value);
  if (n > 0) return 'Advantage';
  if (n < 0) return 'Disadvantage';
  return '';
}

/* Formulas reach here as written — "+@scale.barbarian.rage-damage", "@prof".
 * The bridge captures resolved scale values, so most become a number; anything
 * still unresolved is tidied into something readable rather than shown raw. */
function resolveFormula(formula, scale = {}, prof = null) {
  let text = String(formula ?? '').trim();
  if (!text) return '';

  text = text.replace(/@scale\.([\w-]+)\.([\w-]+)/g, (match, cls, key) => {
    const value = scale[`${cls}.${key}`];
    return value == null ? `your ${humanize(key).toLowerCase()}` : String(value);
  });
  if (prof != null) text = text.replace(/@prof\b/g, String(prof));

  // "++2" from a leading sign meeting a signed value.
  return text.replace(/^\+\s*\+/, '+').replace(/\s+/g, ' ').trim();
}

function isNumeric(text) {
  return /^[+-]?\d+$/.test(String(text ?? '').trim());
}

function stripSign(text) {
  return String(text ?? '').replace(/^\s*[+-]\s*/, '').trim();
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function withSign(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  return /^[+-]/.test(trimmed) ? trimmed : `+${trimmed}`;
}

/* One change → one line. Returns null only for changes with nothing to say. */
function describeChange(change, context) {
  const key = String(change?.key ?? '');
  const mode = Number(change?.mode ?? ADD);
  const raw = change?.value;
  const value = resolveFormula(raw, context.scale, context.prof);
  if (!key) return null;

  let match = key.match(/^system\.traits\.(dr|di|dv|ci)\.value$/);
  if (match) return TRAITS[match[1]](humanize(value).toLowerCase());

  match = key.match(/^system\.bonuses\.(mwak|rwak|msak|rsak)\.(damage|attack)$/);
  if (match) {
    const [, kind, what] = match;
    const noun = what === 'damage' ? 'damage' : 'to hit';
    /* Resolved, it is a modifier: "+2 damage on melee weapon attacks".
       Unresolved, it is the name of one: "Your rage damage to melee ...". */
    return isNumeric(value)
      ? `${withSign(value)} ${noun} on ${ATTACK_KINDS[kind]}`
      : `${capitalize(stripSign(value))} added to ${ATTACK_KINDS[kind]}`;
  }

  match = key.match(/^system\.abilities\.(\w+)\.(check|save)\.roll\.mode$/);
  if (match) {
    const mood = rollMode(value);
    const ability = ABILITY_NAMES[match[1]] ?? humanize(match[1]);
    return mood ? `${mood} on ${ability} ${match[2] === 'save' ? 'saving throws' : 'checks'}` : null;
  }

  match = key.match(/^system\.abilities\.(\w+)\.value$/);
  if (match) {
    const ability = ABILITY_NAMES[match[1]] ?? humanize(match[1]);
    if (mode === OVERRIDE) return `${ability} becomes ${value}`;
    if (mode === UPGRADE) return `${ability} is at least ${value}`;
    if (mode === DOWNGRADE) return `${ability} is at most ${value}`;
    return `${withSign(value)} ${ability}`;
  }

  if (key === 'system.attributes.ac.bonus') return `${withSign(value)} AC`;
  if (key === 'system.attributes.ac.value') return `AC becomes ${value}`;
  if (key === 'system.attributes.hp.tempmax') return `${withSign(value)} maximum hit points`;
  if (key === 'system.attributes.init.bonus') return `${withSign(value)} initiative`;
  if (key === 'system.bonuses.abilities.save') return `${withSign(value)} to saving throws`;
  if (key === 'system.bonuses.abilities.check') return `${withSign(value)} to ability checks`;
  if (key === 'system.bonuses.abilities.skill') return `${withSign(value)} to skill checks`;
  if (key === 'system.bonuses.spell.dc') return `${withSign(value)} spell save DC`;

  match = key.match(/^system\.attributes\.movement\.(\w+)$/);
  if (match) {
    const label = MOVEMENT[match[1]] ?? `${humanize(match[1])} speed`;
    if (mode === OVERRIDE) return `${label} becomes ${value} ft.`;
    return `${withSign(value)} ft. ${label.toLowerCase()}`;
  }

  match = key.match(/^system\.skills\.(\w+)\.roll\.mode$/);
  if (match) {
    const mood = rollMode(value);
    return mood ? `${mood} on ${humanize(match[1])} checks` : null;
  }

  /* Untranslated, but still shown. The key is trimmed to its last two
     segments, which is usually the readable part. */
  const tail = key.replace(/^system\./, '').split('.').slice(-2).map(humanize).join(' ');
  return value ? `${tail}: ${value}` : null;
}

/* Every effect on an item, flattened to the lines it grants.
 *
 * `context` carries what formulas need: `scale` from the derived block and the
 * proficiency bonus. Both are optional — an older export just yields wordier
 * lines ("+rage damage" rather than "+2 damage"). */
export function describeEffects(item, context = {}) {
  const effects = Array.isArray(item?.effects) ? item.effects : [];
  const lines = [];
  const seen = new Set();

  for (const effect of effects) {
    for (const change of effect.changes ?? []) {
      const line = describeChange(change, context);
      if (!line || seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
    }
  }
  return mergeTraitLines(lines);
}

/* Rage grants its three resistances as three separate changes, which reads as
 * three bullets saying almost the same thing. One line, three words. */
function mergeTraitLines(lines) {
  const buckets = new Map();
  const out = [];

  for (const line of lines) {
    const match = line.match(/^(Resistance to|Immunity to|Vulnerability to) (.+)$/);
    if (!match) { out.push(line); continue; }
    if (!buckets.has(match[1])) {
      buckets.set(match[1], []);
      out.push({ prefix: match[1] });
    }
    buckets.get(match[1]).push(match[2]);
  }

  return out.map((entry) => {
    if (typeof entry === 'string') return entry;
    const parts = buckets.get(entry.prefix);
    const joined = parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
      : parts[0];
    return `${entry.prefix} ${joined}`;
  });
}

/* The same effects again, as numbers rather than sentences.
 *
 * The prose above is for a player reading what Rage does. This is for the
 * attack rows, which need to know that melee weapon damage is up by two and
 * which attacks that applies to. Both read the same `changes`, so they cannot
 * drift apart — and the attack kinds are Foundry's own (`mwak`, `rwak`), not a
 * melee/ranged guess made here.
 */
export function effectModifiers(item, context = {}) {
  const out = {};
  for (const effect of Array.isArray(item?.effects) ? item.effects : []) {
    for (const change of effect.changes ?? []) {
      const key = String(change?.key ?? '');

      const trait = key.match(/^system\.traits\.(dr|di|dv)\.value$/);
      if (trait) {
        const bucket = { dr: 'resistances', di: 'immunities', dv: 'vulnerabilities' }[trait[1]];
        const what = humanize(String(change.value ?? '').trim());
        if (what) out[bucket] = [...(out[bucket] ?? []), what];
        continue;
      }

      const match = key.match(/^system\.bonuses\.(mwak|rwak|msak|rsak)\.(damage|attack)$/);
      if (!match) continue;
      const value = resolveFormula(change.value, context.scale, context.prof);
      if (!isNumeric(value)) continue;      // an unresolved formula is not a number
      const [, kind, what] = match;
      out[kind] = { ...(out[kind] ?? {}), [what]: Number(stripSign(value)) };
    }
  }
  return out;
}
