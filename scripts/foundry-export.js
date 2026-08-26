/* Export characters from Foundry for the Vallombrosa app.
 *
 * Paste this into a Foundry macro (Script type) and run it. It writes one JSON
 * file per selected character to your browser's download folder; drop those on
 * the VPS and load them with import_statblocks.py.
 *
 * Why this exists rather than using Foundry's own "Export Data":
 *
 *   toObject() gives you *source* data — what was typed in. It has
 *   `ac: {calc: "default"}` with no number, `hp.max: null`, ability scores with
 *   no modifiers, and skills whose `value` is a proficiency rank rather than a
 *   bonus. Foundry computes the real numbers at runtime and throws them away on
 *   export. The app would have to reimplement 5e's maths to get them back, and
 *   would then disagree with your table the first time an effect or a magic
 *   item changed something.
 *
 * So this captures the source data AND a `derived` block read off the prepared
 * actor. The app renders `derived` and never does 5e arithmetic. If Foundry
 * says AC is 14, the app says 14.
 *
 * Tested against dnd5e 5.1.x on Foundry v13. The optional chaining throughout
 * is deliberate: field locations move between system versions, and a missing
 * field should come through as null rather than throwing and losing the export.
 */

const SKILL_KEYS = [
  'acr', 'ani', 'arc', 'ath', 'dec', 'his', 'ins', 'itm', 'inv',
  'med', 'nat', 'prc', 'prf', 'per', 'rel', 'slt', 'ste', 'sur',
];
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/* `save` is a number in some system versions and an object in others. */
function saveValue(ability) {
  const save = ability?.save;
  if (save == null) return null;
  return typeof save === 'object' ? (save.value ?? save.total ?? null) : save;
}

/* Limited uses are stored as formulas — "@prof", "max(1, @abilities.cha.mod)",
 * "@scale.barbarian.rages" — and only the prepared item knows what they come to.
 * Without this, a Barbarian's Rage and a Bard's mask uses arrive as unusable
 * strings and the sheet shows no charges at all.
 */
function deriveItemUses(actor) {
  const out = {};
  for (const item of actor.items ?? []) {
    const uses = item.system?.uses;
    if (!uses) continue;
    const max = Number(uses.max);
    if (!Number.isFinite(max) || max <= 0) continue;
    out[item.id] = {
      max,
      spent: Number(uses.spent ?? 0) || 0,
      recovery: (uses.recovery ?? []).map((r) => r?.period).filter(Boolean),
    };
  }
  return out;
}

/* Attack rolls and damage, as Foundry has worked them out.
 *
 * Source data has the pieces — an ability, a base damage die, properties — but
 * not the answer. The bonus a player needs mid-turn folds in proficiency, the
 * relevant modifier, weapon magic and any active effect, and only the prepared
 * activity knows it. Reaching for `labels` in a few places because their exact
 * home moves between system versions; anything not found is simply absent, and
 * the sheet falls back to showing the damage dice without a bonus.
 */
function deriveAttacks(actor) {
  const out = {};
  for (const item of actor.items ?? []) {
    const activities = item.system?.activities;
    if (!activities) continue;

    // An ActivityCollection in 5.x, a plain object in older builds.
    const list = typeof activities.values === 'function'
      ? Array.from(activities.values())
      : Object.values(activities);

    const rows = [];
    for (const activity of list) {
      if (activity?.type !== 'attack') continue;
      // Before activities existed these labels lived on the item itself.
      const labels = { ...(item.labels ?? {}), ...(activity.labels ?? {}) };
      const damages = Array.isArray(labels.damages)
        ? labels.damages.map((d) => d?.formula ?? d?.label ?? d).filter(Boolean)
        : [];
      rows.push({
        id: activity.id ?? activity._id ?? null,
        name: activity.name || item.name,
        toHit: labels.toHit ?? labels.modifier ?? null,
        damage: damages.join(' plus ') || labels.damage || null,
        range: labels.range ?? null,
        save: labels.save ?? null,
      });
    }
    if (rows.length) out[item.id] = rows;
  }
  return out;
}

/* Class scale values — a barbarian's rage damage, a bard's inspiration die.
 * These are formulas everywhere else and numbers only here. */
function deriveScale(actor) {
  const scale = actor.system?.scale;
  if (!scale) return {};
  const out = {};
  for (const [cls, values] of Object.entries(scale)) {
    for (const [key, value] of Object.entries(values ?? {})) {
      const resolved = value?.value ?? value?.number ?? value;
      if (typeof resolved === 'number' || typeof resolved === 'string') {
        out[`${cls}.${key}`] = resolved;
      } else if (value?.die || value?.faces) {
        out[`${cls}.${key}`] = `${value.number ?? 1}d${value.die ?? value.faces}`;
      }
    }
  }
  return out;
}

function deriveActor(actor) {
  const sys = actor.system ?? {};
  const abilities = {};
  for (const key of ABILITY_KEYS) {
    const ability = sys.abilities?.[key];
    if (!ability) continue;
    abilities[key] = {
      value: ability.value ?? null,
      mod: ability.mod ?? null,
      save: saveValue(ability),
      proficient: ability.proficient ?? 0,
    };
  }

  const skills = {};
  for (const key of SKILL_KEYS) {
    const skill = sys.skills?.[key];
    if (!skill) continue;
    skills[key] = {
      ability: skill.ability ?? null,
      total: skill.total ?? null,
      passive: skill.passive ?? null,
      proficient: skill.value ?? 0,
    };
  }

  const tools = {};
  for (const [key, tool] of Object.entries(sys.tools ?? {})) {
    tools[key] = { ability: tool.ability ?? null, total: tool.total ?? null, proficient: tool.value ?? 0 };
  }

  // Spell slots: source data carries `value` (remaining) but `max` is derived.
  const spells = {};
  for (const [key, slot] of Object.entries(sys.spells ?? {})) {
    if (!slot || typeof slot !== 'object') continue;
    spells[key] = { value: slot.value ?? 0, max: slot.max ?? 0, level: slot.level ?? null };
  }

  const classes = Object.entries(actor.classes ?? {}).map(([identifier, item]) => ({
    identifier,
    name: item?.name ?? identifier,
    levels: item?.system?.levels ?? null,
    subclass: item?.subclass?.name ?? null,
  }));

  return {
    level: sys.details?.level ?? null,
    prof: sys.attributes?.prof ?? null,
    ac: sys.attributes?.ac?.value ?? null,
    hp: {
      value: sys.attributes?.hp?.value ?? null,
      max: sys.attributes?.hp?.max ?? null,
      temp: sys.attributes?.hp?.temp ?? 0,
      tempmax: sys.attributes?.hp?.tempmax ?? 0,
    },
    hitDice: { value: sys.attributes?.hd?.value ?? null, max: sys.attributes?.hd?.max ?? null },
    initiative: sys.attributes?.init?.total ?? sys.attributes?.init?.mod ?? null,
    spellDc: sys.attributes?.spelldc ?? sys.attributes?.spell?.dc ?? null,
    spellAbility: sys.attributes?.spellcasting ?? null,
    movement: sys.attributes?.movement ?? null,
    senses: sys.attributes?.senses ?? null,
    abilities,
    skills,
    tools,
    spells,
    classes,
    itemUses: deriveItemUses(actor),
    attacks: deriveAttacks(actor),
    scale: deriveScale(actor),
    // Resolved labels for the id-pointers in details.
    raceName: actor.system?.details?.race?.name ?? actor.items?.find?.((i) => i.type === 'race')?.name ?? null,
    backgroundName: actor.system?.details?.background?.name
      ?? actor.items?.find?.((i) => i.type === 'background')?.name ?? null,
  };
}

function exportActor(actor) {
  const source = actor.toObject();
  return {
    // Stamped so the importer can refuse a file it does not understand.
    vosExport: { version: 1, exportedAt: new Date().toISOString(), system: game.system.version },
    name: actor.name,
    img: actor.img,
    system: source.system,
    items: source.items,
    derived: deriveActor(actor),
  };
}

function download(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Selected tokens if there are any, otherwise every player-owned character.
const selected = canvas.tokens.controlled.map((token) => token.actor).filter(Boolean);
const actors = selected.length
  ? selected
  : game.actors.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner);

if (!actors.length) {
  ui.notifications.warn('No characters to export. Select tokens, or give a character a player owner.');
} else {
  for (const actor of actors) {
    const slug = actor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    download(`statblock-${slug}.json`, exportActor(actor));
  }
  ui.notifications.info(`Exported ${actors.length} character(s).`);
}
