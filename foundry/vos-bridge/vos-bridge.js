/* Vallombrosa Bridge — push character statblocks to the campaign app.
 *
 * Foundry stores raw inputs and computes the numbers that matter (AC, max HP,
 * every modifier, skill totals, spell DC) at runtime, then discards them on
 * export. This module reads them off the *prepared* actor and posts them, so
 * the app never has to reimplement 5e's maths and can never disagree with the
 * table.
 *
 * Shape of the thing:
 *
 *   - Outbound only. It POSTs to the app over HTTPS; nothing listens here and
 *     nothing writes back into Foundry. The app cannot reach this server, and
 *     does not need to.
 *   - GM only. Every connected client sees the same updateActor hook, so
 *     without this guard five browsers would race to push the same character.
 *   - Client-scoped settings. The endpoint and token live in *this browser's*
 *     storage, not in world settings — world settings sync to every player, so
 *     a token stored there would be readable from any player's console.
 *   - Debounced. Dragging an HP bar fires updateActor per tick; we coalesce.
 */

const MODULE_ID = 'vos-bridge';
const EXPORT_VERSION = 1;
const DEBOUNCE_MS = 2500;

const SKILL_KEYS = [
  'acr', 'ani', 'arc', 'ath', 'dec', 'his', 'ins', 'itm', 'inv',
  'med', 'nat', 'prc', 'prf', 'per', 'rel', 'slt', 'ste', 'sur',
];
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const pending = new Map();

function setting(key) {
  try { return game.settings.get(MODULE_ID, key); } catch (error) { return null; }
}

function log(...args) {
  console.log(`${MODULE_ID} |`, ...args);
}

/* `save` is a number on some system versions and an object on others. */
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

/* Read the computed values off the prepared actor. Optional chaining
 * throughout on purpose: field locations move between dnd5e versions, and a
 * field we cannot find should arrive as null rather than throwing away the
 * whole push. */
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
    tools[key] = {
      ability: tool.ability ?? null,
      total: tool.total ?? null,
      proficient: tool.value ?? 0,
    };
  }

  const spells = {};
  for (const [key, slot] of Object.entries(sys.spells ?? {})) {
    if (!slot || typeof slot !== 'object') continue;
    // `level` matters for pact magic, where every slot is the same level and
    // that level is the whole point.
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
    raceName: sys.details?.race?.name ?? actor.items.find((i) => i.type === 'race')?.name ?? null,
    backgroundName: sys.details?.background?.name
      ?? actor.items.find((i) => i.type === 'background')?.name ?? null,
  };
}

function buildPayload(actor) {
  const source = actor.toObject();
  return {
    vosExport: {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      system: game.system.version,
      via: MODULE_ID,
    },
    name: actor.name,
    img: actor.img,
    system: source.system,
    items: source.items,
    derived: deriveActor(actor),
  };
}

async function push(actor, { quiet = true } = {}) {
  const endpoint = setting('endpoint');
  const token = setting('token');
  if (!endpoint || !token) {
    if (!quiet) ui.notifications.error('Vallombrosa Bridge: set the app URL and token in module settings.');
    return false;
  }

  let response;
  try {
    response = await fetch(`${endpoint.replace(/\/+$/, '')}/api/statblocks/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildPayload(actor)),
    });
  } catch (error) {
    // Network failures are expected (app restarting, laptop asleep). Never let
    // one interrupt play with a dialog.
    log(`push failed for ${actor.name}:`, error);
    if (!quiet) ui.notifications.error(`Vallombrosa Bridge: could not reach the app (${error.message}).`);
    return false;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const reason = body.error || `HTTP ${response.status}`;
    log(`push rejected for ${actor.name}: ${reason}`);
    // 422 means the actor is not a roster player — an NPC, most likely. That is
    // normal and not worth telling anyone about.
    if (!quiet && response.status !== 422) {
      ui.notifications.warn(`Vallombrosa Bridge: ${actor.name} — ${reason}`);
    }
    return false;
  }

  const body = await response.json().catch(() => ({}));
  log(`pushed ${actor.name} -> ${body.playerName}`);
  if (!quiet) ui.notifications.info(`Vallombrosa Bridge: pushed ${actor.name}.`);
  return true;
}

function schedule(actor) {
  if (!game.user.isGM) return;
  if (!setting('enabled')) return;
  if (actor?.type !== 'character') return;

  clearTimeout(pending.get(actor.id));
  pending.set(actor.id, setTimeout(() => {
    pending.delete(actor.id);
    push(actor);
  }, DEBOUNCE_MS));
}

/* Items carry features, spells and inventory, so an item change is a sheet
 * change. The hooks hand us the item; the actor is its parent. */
function scheduleFromItem(item) {
  if (item?.parent?.documentName === 'Actor') schedule(item.parent);
}

async function pushAll() {
  /* Every character, not only player-owned ones. A character the GM owns — a
   * test character, or one whose player has not been assigned yet — has no
   * player owner to filter on and was being skipped silently. The app knows the
   * roster and answers 422 for anything that is not on it, which the push
   * treats as normal, so letting it decide is both simpler and correct. */
  const actors = game.actors.filter((actor) => actor.type === 'character');
  if (!actors.length) {
    ui.notifications.warn('Vallombrosa Bridge: no characters to push.');
    return;
  }
  ui.notifications.info(`Vallombrosa Bridge: pushing ${actors.length} character(s)…`);
  let sent = 0;
  for (const actor of actors) {
    if (await push(actor, { quiet: false })) sent += 1;
  }
  ui.notifications.info(`Vallombrosa Bridge: ${sent}/${actors.length} pushed.`);
}

Hooks.once('init', () => {
  // Client scope keeps the token in this browser only. A world-scoped setting
  // is replicated to every connected player, token included.
  game.settings.register(MODULE_ID, 'endpoint', {
    name: 'App URL',
    hint: 'Base URL of the Vallombrosa app, e.g. https://app.example.com',
    scope: 'client',
    config: true,
    type: String,
    default: '',
  });
  game.settings.register(MODULE_ID, 'token', {
    name: 'Ingest token',
    hint: 'Matches STATBLOCK_INGEST_TOKEN on the app. Stored in this browser only.',
    scope: 'client',
    config: true,
    type: String,
    default: '',
  });
  game.settings.register(MODULE_ID, 'enabled', {
    name: 'Push on change',
    hint: 'Push a character a few seconds after it changes. Turn off to push only by hand.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.registerMenu(MODULE_ID, 'pushAll', {
    name: 'Push all characters',
    label: 'Push now',
    hint: 'Send every player-owned character to the app.',
    icon: 'fas fa-cloud-arrow-up',
    type: class extends FormApplication {
      render() { pushAll(); return this; }
    },
    restricted: true,
  });
});

Hooks.once('ready', () => {
  if (!game.user.isGM) return;

  Hooks.on('updateActor', (actor) => schedule(actor));
  Hooks.on('createItem', scheduleFromItem);
  Hooks.on('updateItem', scheduleFromItem);
  Hooks.on('deleteItem', scheduleFromItem);

  // Exposed so the push can be driven from a macro or the console.
  game.modules.get(MODULE_ID).api = { push, pushAll, buildPayload };

  const configured = Boolean(setting('endpoint') && setting('token'));
  log(configured ? 'ready' : 'ready — set the app URL and token in module settings');
});
