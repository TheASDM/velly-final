/* Render a normalised statblock.
 *
 * Built for a phone first, because that is what people have at the table: the
 * numbers you reach for mid-turn (AC, HP, the six abilities, skill totals) sit
 * at the top at a size you can read without zooming, and everything that is
 * reference material — feature text, spell descriptions, item blurbs — is
 * collapsed behind <details> so the sheet stays short enough to thumb through.
 *
 * Feature and spell descriptions arrive from normalize.js already run through
 * the sanitiser, so they are inserted as HTML on purpose. Everything else is
 * escaped here.
 */
import { signed } from './labels.js';

/* Play state for the sheet currently being rendered.
 *
 * Set once per renderStatblock() call rather than threaded through every
 * function. This module renders one sheet at a time and synchronously, so a
 * module-level context is honest about that rather than pretending otherwise.
 * Null means "build only" — the sheet renders exactly as it did before play
 * state existed, which is what the DM's read-only views want.
 */
let ctx = null;

const spentSlots = (level) => (ctx && ctx.play ? Number(ctx.play.slots[String(level)] || 0) : 0);
const spentUses = (feature) => (ctx && ctx.play ? Number(ctx.play.uses[feature] || 0) : 0);
const live = () => Boolean(ctx && ctx.play && ctx.interactive);

/* Entries a player has tucked away. Hiding is a reading preference, not play
 * state, so it works even when the play layer failed to load. */
const isHidden = (id) => Boolean(id && ctx && ctx.hidden && ctx.hidden.has(id));
const canHide = () => Boolean(ctx && ctx.hideable);

/* Resources the player pinned to the play bar. Same kind of preference. */
const isPinned = (id) => Boolean(id && ctx && ctx.pinned && ctx.pinned.has(id));
const canPin = () => Boolean(ctx && ctx.hideable && ctx.pinned);

/* data-play marks an element the controls can bind to. Rendering it only when
 * interactive keeps the read-only sheet free of dead affordances. */
function bind(attrs) {
  if (!live()) return '';
  return ' ' + Object.entries(attrs)
    .map(([key, value]) => `${key}="${esc(value)}"`)
    .join(' ');
}

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]),
  );
}

const num = (value) => (value == null || value === '' ? '—' : esc(value));

function chips(values, className = '') {
  const items = (values ?? []).filter(Boolean);
  if (!items.length) return '';
  return `<ul class="vos-sb-chips ${className}">${
    items.map((value) => `<li>${esc(value)}</li>`).join('')
  }</ul>`;
}

function section(title, body, options = {}) {
  if (!body) return '';
  const id = options.id ? ` id="${esc(options.id)}"` : '';
  return `<section class="vos-sb-section"${id}>
    <h3 class="vos-sb-section-title">${esc(title)}</h3>
    ${body}
  </section>`;
}

/* ── Header and vitals ─────────────────────────────────────────────── */

function renderHeader(model) {
  const line = [model.classLine, model.race, model.background]
    .filter(Boolean).join(' · ');
  const sub = [model.size, model.alignment].filter(Boolean).join(' · ');
  /* The player page already puts the name, class and species in the app bar,
   * so repeating them here only pushes the numbers down. One quiet line keeps
   * the rest of the identity legible. */
  if (ctx && ctx.identity === 'compact') {
    const bits = [model.background, sub].filter(Boolean).join(' · ');
    return bits ? `<p class="vos-sb-ident">${esc(bits)}</p>` : '';
  }
  return `<header class="vos-sb-head">
    <h2 class="vos-sb-name">${esc(model.name)}</h2>
    ${line ? `<p class="vos-sb-line">${esc(line)}</p>` : ''}
    ${sub ? `<p class="vos-sb-sub">${esc(sub)}</p>` : ''}
  </header>`;
}

function renderVitals(model) {
  const v = model.vitals;
  const play = ctx && ctx.play;
  // Foundry's hit points are a starting point; once play begins they are the
  // play layer's to report.
  const current = play && play.hp.current != null ? play.hp.current : v.hp.value;
  const tempHp = play ? play.hp.temp : v.hp.temp;
  const spentDice = play ? Number(play.hitDiceSpent || 0) : 0;

  const hp = v.hp.max != null ? `${num(current)}<span class="vos-sb-of">/${num(v.hp.max)}</span>` : num(current);
  const temp = tempHp ? `<span class="vos-sb-temp">+${esc(tempHp)} temp</span>` : '';

  /* Hit points lead and take the width, because they are the number that
     changes. The other five are a single even row underneath — the old order
     left hit dice stranded on a third row of its own. */
  const cells = [
    { label: 'Hit Points', value: hp + temp, hero: true, play: { 'data-play': 'hp' } },
    { label: 'AC', value: num(v.ac) },
    { label: 'Initiative', value: v.initiative == null ? '—' : esc(signed(v.initiative)) },
    { label: 'Speed', value: esc(v.speed || '—') },
    // "Proficiency" overflows its cell on a phone and wraps mid-word.
    { label: 'Prof', value: v.prof == null ? '—' : esc(signed(v.prof)) },
    {
      label: 'Hit Dice',
      value: hitDiceValue(v, spentDice),
      play: { 'data-play': 'hitdice' },
    },
  ];

  const flags = [v.inspiration ? 'Inspiration' : ''].filter(Boolean);

  return `<div class="vos-sb-vitals">
    ${cells.map((cell) => `<div class="vos-sb-vital${cell.hero ? ' is-hero' : ''}"${
      cell.play ? bind(cell.play) : ''
    }>
      <span class="vos-sb-vital-label">${esc(cell.label)}</span>
      <span class="vos-sb-vital-value">${cell.value}</span>
    </div>`).join('')}
  </div>${renderExhaustion(model)}${flags.length ? chips(flags, 'is-flags') : ''}`;
}

function hitDiceValue(vitals, spent) {
  // "3/3 d8" from the build; play state only knows how many are gone.
  const match = /^(\d+)\/(\d+)\s*(.*)$/.exec(vitals.hitDice || '');
  if (!match) return esc(vitals.hitDice || '—');
  const total = Number(match[2]);
  const left = Math.max(0, total - spent);
  return `${left}<span class="vos-sb-of">/${total}</span> <span class="vos-sb-die">${esc(match[3])}</span>`;
}

/* The death clock. Six is fatal at this table, so it is shown as a track with
 * its cost spelled out rather than as a number someone has to interpret. */
function renderExhaustion(model) {
  const play = ctx && ctx.play;
  if (!play) return '';
  const level = Number(play.exhaustion || 0);
  const dying = (play.conditions || []).includes('dying');
  const pips = Array.from({ length: 6 }, (_, i) =>
    `<span class="vos-sb-exh-pip${i < level ? ' is-on' : ''}"${
      bind({ 'data-play': 'exhaustion', 'data-value': i + 1 })
    }></span>`).join('');

  const cost = level
    ? `<span class="vos-sb-exh-cost">−${level * 2} to d20 tests · −${level * 5} ft</span>`
    : '<span class="vos-sb-exh-cost">no penalty</span>';

  return `<div class="vos-sb-exh${dying ? ' is-dying' : ''}"${bind({ 'data-play': 'exhaustion-row' })}>
    <span class="vos-sb-exh-label">Exhaustion</span>
    <span class="vos-sb-exh-track">${pips}</span>
    ${cost}
    ${dying ? '<span class="vos-sb-dying">Dying</span>' : ''}
  </div>`;
}

/* ── Abilities and skills ──────────────────────────────────────────── */

function renderAbilities(model) {
  if (!model.abilities.length) return '';
  return `<div class="vos-sb-abilities">
    ${model.abilities.map((ability) => `<div class="vos-sb-ability${ability.proficient ? ' is-proficient' : ''}">
      <span class="vos-sb-ability-name">${esc(ability.short)}</span>
      <span class="vos-sb-ability-mod">${esc(signed(ability.mod))}</span>
      <span class="vos-sb-ability-score">${num(ability.score)}</span>
      <span class="vos-sb-ability-save">save ${esc(signed(ability.save))}</span>
    </div>`).join('')}
  </div>`;
}

/* Proficiency is not a boolean. dnd5e reports 0, 0.5 (half — Jack of All
 * Trades and friends), 1, or 2 (expertise), and half-proficiency must not read
 * as full or the sheet overstates what the character is good at. */
function proficiencyTier(rank) {
  const value = Number(rank) || 0;
  if (value >= 2) return { key: 'expert', title: 'Expertise' };
  if (value >= 1) return { key: 'prof', title: 'Proficient' };
  if (value > 0) return { key: 'half', title: 'Half proficiency' };
  return { key: 'none', title: 'Not proficient' };
}

function proficiencyDot(rank) {
  const tier = proficiencyTier(rank);
  return `<span class="vos-sb-dot is-${tier.key}" title="${tier.title}" aria-label="${tier.title}"></span>`;
}

function renderSkills(model) {
  if (!model.skills.length) return '';
  const rows = model.skills.map((skill) => `<li class="vos-sb-skill${skill.rank >= 1 ? ' is-proficient' : ''}">
    ${proficiencyDot(skill.rank)}
    <span class="vos-sb-skill-name">${esc(skill.label)}</span>
    <span class="vos-sb-skill-ability">${esc(skill.abilityShort)}</span>
    <span class="vos-sb-skill-total">${esc(signed(skill.total))}</span>
  </li>`).join('');

  const passives = [
    model.passives.perception != null ? `Passive Perception ${model.passives.perception}` : '',
    model.passives.investigation != null ? `Passive Investigation ${model.passives.investigation}` : '',
    model.passives.insight != null ? `Passive Insight ${model.passives.insight}` : '',
  ].filter(Boolean);

  return `<ul class="vos-sb-skills">${rows}</ul>${chips(passives, 'is-passive')}`;
}

function renderTools(model) {
  if (!model.tools.length) return '';
  return `<ul class="vos-sb-skills is-tools">${model.tools.map((tool) => `<li class="vos-sb-skill${tool.rank >= 1 ? ' is-proficient' : ''}">
    ${proficiencyDot(tool.rank)}
    <span class="vos-sb-skill-name">${esc(tool.label)}</span>
    <span class="vos-sb-skill-total">${esc(signed(tool.total))}</span>
  </li>`).join('')}</ul>`;
}

/* ── Spellcasting ──────────────────────────────────────────────────── */

/* A pip per slot, filled while unspent. Tapping a filled pip spends it and a
 * spent one gives it back, which is one gesture rather than a stepper. */
function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

function slotPips(slot) {
  const remaining = slotsLeft(slot);
  const pips = [];
  for (let i = 0; i < slot.max; i += 1) {
    const spent = i >= remaining;
    pips.push(`<span class="vos-sb-pip${spent ? ' is-spent' : ''}"${bind({
      'data-play': slot.pact ? 'pact' : 'slot',
      'data-level': slot.level,
      'data-spent': spent ? '1' : '0',
      role: 'button',
      tabindex: '0',
      'aria-label': `Level ${slot.level} slot, ${spent ? 'spent' : 'available'}`,
    })}></span>`);
  }
  return `<span class="vos-sb-pips" aria-label="${remaining} of ${slot.max} remaining">${pips.join('')}</span>`;
}

/* Pact slots are counted in their own field, not in the per-level map, so they
 * have to be read from there or the pips never move. */
function slotsLeft(slot) {
  if (!(ctx && ctx.play)) return slot.value;
  const spent = slot.pact ? Number(ctx.play.pact || 0) : spentSlots(slot.level);
  return Math.max(0, slot.max - spent);
}

function renderSpellcasting(model) {
  const sc = model.spellcasting;
  if (!sc) return '';

  // "Intelligence" cannot fit a third of a phone; the three-letter code can.
  const abilityShort = sc.ability
    ? sc.ability.slice(0, 3).toUpperCase()
    : (sc.abilityLabel || '').slice(0, 3).toUpperCase();
  const header = `<div class="vos-sb-spell-head">
    ${sc.abilityLabel ? `<div><span class="vos-sb-vital-label">Ability</span><span class="vos-sb-vital-value" title="${esc(sc.abilityLabel)}">${esc(abilityShort)}</span></div>` : ''}
    ${sc.dc != null ? `<div><span class="vos-sb-vital-label">Save DC</span><span class="vos-sb-vital-value">${esc(sc.dc)}</span></div>` : ''}
    ${sc.attack != null ? `<div><span class="vos-sb-vital-label">Attack</span><span class="vos-sb-vital-value">${esc(signed(sc.attack))}</span></div>` : ''}
  </div>`;

  const slots = sc.slots.length
    ? `<ul class="vos-sb-slots">${sc.slots.map((slot) => `<li>
        <span class="vos-sb-slot-level">${
          slot.pact
            ? `Pact${slot.level ? ` · level ${slot.level}` : ''}`
            : `Level ${slot.level}`
        }</span>
        ${slotPips(slot)}
        <span class="vos-sb-slot-count">${slotsLeft(slot)}/${slot.max}</span>
      </li>`).join('')}</ul>`
    : '';

  const spellEntry = (group, spell) => ({
    name: spell.name,
    marker: spell.always ? 'always' : (spell.prepared ? 'prepared' : ''),
    meta: [
      group.pact && spell.level > 0 ? `${ordinal(spell.level)}-level spell` : '',
      spell.school,
      ...spell.meta,
      ...(spell.methods || []).filter((m) => m !== 'Prepared'),
    ].filter(Boolean),
    description: spell.description,
  });

  const hidden = [];
  const groups = model.spells.map((group) => {
    const shown = group.spells.filter((spell) => {
      if (isHidden(spell.id)) {
        hidden.push({ ...spellEntry(group, spell), showId: spell.id });
        return false;
      }
      return true;
    });
    if (!shown.length) return '';
    return `<div class="vos-sb-spell-group">
    <h4 class="vos-sb-spell-level">${esc(group.label)}${
      group.slots && group.slots.max > 0
        ? ` <span class="vos-sb-slot-count">${
            slotsLeft({ ...group.slots, level: group.level, pact: group.pact })}/${
            group.slots.max}</span>`
        : ''
    }</h4>
    <ul class="vos-sb-entries">${shown.map((spell) => renderEntry({
      ...spellEntry(group, spell),
      hideId: spell.id,
    })).join('')}</ul>
  </div>`;
  }).join('');

  return header + slots + groups + hiddenStash(hidden, 'spell');
}

/* ── Collapsible entry (feature, spell, item) ──────────────────────── */

/* Charges on a feature. The build says how many there are; the play layer says
 * how many are gone, so the two are combined here rather than either being
 * trusted alone. */
function renderUses(entry) {
  const spent = entry.id ? spentUses(entry.id) : 0;
  const left = Math.max(0, entry.uses.max - spent);
  const recovery = entry.uses.recovery
    ? ` <span class="vos-sb-uses-recovery">${esc(entry.uses.recovery)}</span>` : '';
  return `<span class="vos-sb-uses"${bind({
    'data-play': 'charge',
    'data-feature': entry.id || '',
    'data-max': entry.uses.max,
    role: 'button',
    tabindex: '0',
    'aria-label': `${left} of ${entry.uses.max} uses remaining`,
  })}>${esc(left)}/${esc(entry.uses.max)}${recovery}</span>`;
}

/* Feather's eye / eye-off, inline so they inherit currentColor. */
const ICON_HIDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const ICON_SHOW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

/* The hide/restore control sits on the collapsed row, so tucking something
 * away never requires opening it first. It cancels the details toggle in the
 * page handler, and the whole list re-renders anyway. */
function entryToggle(entry) {
  if (!canHide()) return '';
  if (entry.hideId) {
    return `<button type="button" class="vos-sb-entry-toggle"
      data-hide-entry="${esc(entry.hideId)}" title="Hide from my sheet"
      aria-label="Hide ${esc(entry.name)} from my sheet">${ICON_HIDE}</button>`;
  }
  if (entry.showId) {
    return `<button type="button" class="vos-sb-entry-toggle is-show"
      data-show-entry="${esc(entry.showId)}" title="Put back on my sheet"
      aria-label="Put ${esc(entry.name)} back on my sheet">${ICON_SHOW}</button>`;
  }
  return '';
}

function renderEntry(entry) {
  const meta = (entry.meta ?? []).filter(Boolean);
  const summary = `<summary class="vos-sb-entry-head">
    <span class="vos-sb-entry-name">${esc(entry.name)}</span>
    ${entry.marker ? `<span class="vos-sb-marker" title="${esc(entry.marker)}">${esc(entry.marker)}</span>` : ''}
    ${entry.uses ? renderUses(entry) : ''}
    ${meta.length ? `<span class="vos-sb-entry-meta">${meta.map(esc).join(' · ')}</span>` : ''}
    ${entryToggle(entry)}
  </summary>`;

  // description is pre-sanitised HTML from normalize.js
  const body = entry.description
    ? `<div class="vos-sb-entry-body">${entry.description}</div>`
    : '<div class="vos-sb-entry-body is-empty">No description.</div>';

  return `<li class="vos-sb-entry"><details>${summary}${body}</details></li>`;
}

/* Where hidden entries wait. They stay whole — still openable and readable in
 * place — so nothing a character has can be lost, only tucked away. Callers
 * pass fully built renderEntry descriptors with showId set. */
function hiddenStash(entries, noun) {
  if (!canHide() || !entries.length) return '';
  const label = `${entries.length} hidden ${noun}${entries.length === 1 ? '' : 's'}`;
  return `<details class="vos-sb-hidden">
    <summary>${esc(label)}</summary>
    <p class="vos-sb-hidden-hint">Still yours — tap a name to read it, or the eye to put it back.</p>
    <ul class="vos-sb-entries">${entries.map(renderEntry).join('')}</ul>
  </details>`;
}

function renderFeatures(model) {
  if (!model.features.length) return '';
  const featureEntry = (feature) => ({
    id: feature.id,
    name: feature.name,
    uses: feature.uses,
    meta: [feature.activation, feature.source].filter(Boolean),
    description: feature.description,
  });

  const hidden = [];
  const groups = new Map();
  model.features.forEach((feature) => {
    if (isHidden(feature.id)) {
      hidden.push({ ...featureEntry(feature), showId: feature.id });
      return;
    }
    if (!groups.has(feature.kind)) groups.set(feature.kind, []);
    groups.get(feature.kind).push(feature);
  });

  return [...groups.entries()].map(([kind, entries]) => `<div class="vos-sb-feature-group">
    <h4 class="vos-sb-group-title">${esc(kind)}</h4>
    <ul class="vos-sb-entries">${entries.map((feature) => renderEntry({
      ...featureEntry(feature),
      hideId: feature.id,
    })).join('')}</ul>
  </div>`).join('') + hiddenStash(hidden, 'feature');
}

function renderInventory(model) {
  if (!model.inventory.length) return '';
  const coins = ['pp', 'gp', 'ep', 'sp', 'cp']
    .filter((key) => Number(model.currency?.[key]) > 0)
    .map((key) => `${model.currency[key]} ${key}`);

  /* What is inside what. An item whose container is present in the inventory
   * lives inside that entry — open the bag to see it — rather than loose in
   * the list pretending to be carried on a belt. */
  const byId = new Map(model.inventory.map((item) => [item.id, item]));
  const contents = new Map();
  model.inventory.forEach((item) => {
    if (item.container && byId.has(item.container)) {
      if (!contents.has(item.container)) contents.set(item.container, []);
      contents.get(item.container).push(item);
    }
  });
  const topLevel = model.inventory.filter(
    (item) => !(item.container && byId.has(item.container)),
  );

  const contentsHtml = (item) => {
    const inside = contents.get(item.id) ?? [];
    if (!inside.length) return '';
    return `<ul class="vos-sb-contents">${inside.map((held) => `<li>
      <span class="vos-sb-contents-name">${esc(held.name)}</span>
      ${held.quantity > 1 ? `<span class="vos-sb-contents-qty">×${esc(held.quantity)}</span>` : ''}
      ${held.equipped ? '<span class="vos-sb-contents-note">equipped</span>' : ''}
    </li>`).join('')}</ul>`;
  };

  const itemEntry = (item) => {
    const inside = contents.get(item.id) ?? [];
    return {
      name: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
      marker: item.equipped ? 'equipped' : '',
      meta: [
        item.kind,
        inside.length ? `${inside.length} item${inside.length === 1 ? '' : 's'}` : '',
        ...item.meta,
        item.rarity,
      ].filter(Boolean),
      description: [item.description, contentsHtml(item)].filter(Boolean).join('') || '',
    };
  };
  const hidden = topLevel.filter((item) => isHidden(item.id))
    .map((item) => ({ ...itemEntry(item), showId: item.id }));
  const shown = topLevel.filter((item) => !isHidden(item.id));

  return `${coins.length ? chips(coins, 'is-coins') : ''}
  <ul class="vos-sb-entries">${shown.map((item) => renderEntry({
    ...itemEntry(item),
    hideId: item.id,
  })).join('')}</ul>${hiddenStash(hidden, 'item')}`;
}

/* ── Resources ─────────────────────────────────────────────────────── */

/* Everything with a limited number of uses, at the top where it is read
 * rather than buried in the feature that owns it.
 *
 * Uses were only ever shown inside the Features list, which meant a player
 * had to remember they had Relentless Endurance before they could look up
 * whether they still had it. That is exactly backwards: the count is what you
 * scan for, and the description is what you open when the count surprises you.
 *
 * Features you switch on live here too. A switched-on one expands in place to
 * say what it is doing, so there is one card per resource rather than a
 * tracker in one section and a separate panel somewhere else contradicting it.
 */
function resourceList(model) {
  const activatable = new Map((model.activatable ?? []).map((entry) => [entry.id, entry]));
  return (model.features ?? [])
    .filter((feature) => feature.uses && feature.uses.max > 0)
    .map((feature) => ({
      id: feature.id,
      name: feature.name,
      max: feature.uses.max,
      recovery: feature.uses.recovery,
      switchable: activatable.get(feature.id) ?? null,
    }));
}

/* Pips while they can be counted at a glance; a number once they cannot. */
const PIP_LIMIT = 6;

function resourcePips(resource, left) {
  if (resource.max > PIP_LIMIT) {
    return `<span class="vos-sb-res-count">${left}<i>/${resource.max}</i></span>`;
  }
  return `<span class="vos-sb-res-pips">${
    Array.from({ length: resource.max }, (_, i) => {
      const spent = i >= left;
      return `<span class="vos-sb-res-pip${spent ? ' is-spent' : ''}"${bind({
        'data-play': 'charge-pip',
        'data-feature': resource.id,
        'data-max': resource.max,
        'data-spent': spent ? '1' : '0',
        role: 'button',
        tabindex: '0',
        'aria-label': spent
          ? `Restore a use of ${resource.name}`
          : `Spend a use of ${resource.name}`,
      })}></span>`;
    }).join('')
  }</span>`;
}

/* A push-pin, filled while the resource sits on the bar. */
const ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 15.24V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z"/></svg>';

/* Pinning puts this counter on the play bar as a quick-spend button — for
 * the resources no structural rule places there but a player reaches for
 * anyway (Lucky is the archetype). */
function resourcePin(resource) {
  if (!canPin()) return '';
  const pinnedOn = isPinned(resource.id);
  return `<button type="button" class="vos-sb-res-pin${pinnedOn ? ' is-on' : ''}"
    data-${pinnedOn ? 'unpin' : 'pin'}-entry="${esc(resource.id)}"
    title="${pinnedOn ? 'Take off the play bar' : 'Pin to the play bar'}"
    aria-label="${pinnedOn
      ? `Take ${esc(resource.name)} off the play bar`
      : `Pin ${esc(resource.name)} to the play bar`}"
    aria-pressed="${pinnedOn}">${ICON_PIN}</button>`;
}

function renderResource(model, resource) {
  const left = Math.max(0, resource.max - spentUses(resource.id));
  const on = Boolean(ctx && ctx.play && (ctx.play.active || {})[resource.id]);
  const grants = on && resource.switchable ? resource.switchable.grants : [];
  const related = on && resource.switchable ? (resource.switchable.related || []) : [];

  return `<li class="vos-sb-res${on ? ' is-on' : ''}${left ? '' : ' is-empty'}">
    <div class="vos-sb-res-head">
      <span class="vos-sb-res-name">${esc(resource.name)}</span>
      ${resourcePin(resource)}
      ${on ? `<button type="button" class="vos-sb-res-end"${bind({
        'data-play': 'end-feature', 'data-feature': resource.id,
      })}>End</button>` : ''}
      ${resource.switchable && !on ? `<button type="button" class="vos-sb-res-use"${bind({
        'data-play': 'feature', 'data-feature': resource.id,
      })}${left ? '' : ' disabled'}>Use</button>` : ''}
    </div>
    ${resourcePips(resource, left)}
    ${resource.recovery ? `<span class="vos-sb-res-recovery">${esc(resource.recovery)}</span>` : ''}
    ${grants.length ? `<ul class="vos-sb-res-grants">${
      grants.map((grant) => `<li>${esc(grant)}</li>`).join('')
    }</ul>` : ''}
    ${related.length ? `<p class="vos-sb-res-related">Riding on it: ${
      related.map((entry) => `<b>${esc(entry.name)}</b>`).join(', ')} — under Features.</p>` : ''}
  </li>`;
}

function renderResources(model) {
  const resources = resourceList(model);
  if (!resources.length) return '';
  return `<ul class="vos-sb-resources">${
    resources.map((resource) => renderResource(model, resource)).join('')
  }</ul>`;
}

/* ── Attacks ───────────────────────────────────────────────────────── */

/* Which features are switched on right now, as the model knows them. */
function activeFeatures(model) {
  const on = (ctx && ctx.play && ctx.play.active) || {};
  return (model.activatable ?? []).filter((feature) => on[feature.id]);
}

/* A live bonus that applies to this kind of attack, attributed to whatever is
 * granting it. Attribution matters: "+2" alone looks like part of the weapon,
 * and a player who forgets they are raging will keep adding it after it ends. */
function liveBonuses(model, attackKind) {
  return activeFeatures(model)
    .map((feature) => {
      const mod = feature.modifiers?.[attackKind];
      if (!mod) return null;
      const parts = [];
      if (mod.attack) parts.push(`${mod.attack > 0 ? '+' : ''}${mod.attack} hit`);
      if (mod.damage) parts.push(`${mod.damage > 0 ? '+' : ''}${mod.damage} dmg`);
      return parts.length ? { name: feature.name, text: parts.join(' ') } : null;
    })
    .filter(Boolean);
}

/* Defenses a switched-on feature is granting right now, so the Defenses
 * section changes when Rage starts rather than staying at its resting value
 * while a panel elsewhere contradicts it. Each one names its source. */
function liveDefenses(model, bucket) {
  return activeFeatures(model).flatMap((feature) =>
    (feature.modifiers?.[bucket] ?? []).map((what) => ({ what, from: feature.name })));
}

function defenseRow(label, values, live) {
  if (!values.length && !live.length) return '';
  return `<p class="vos-sb-defense"><span>${esc(label)}</span>
    <ul class="vos-sb-chips">
      ${values.map((value) => `<li>${esc(value)}</li>`).join('')}
      ${live.map((entry) => `<li class="is-live" title="From ${esc(entry.from)}">${
        esc(entry.what)} <i>${esc(entry.from)}</i></li>`).join('')}
    </ul></p>`;
}

function renderAttackRow(model, attack) {
  const bonuses = liveBonuses(model, attack.attackKind);
  const notes = [attack.range, attack.mastery ? `${attack.mastery} mastery` : '']
    .filter(Boolean)
    .concat(attack.properties ?? []);

  return `<li class="vos-sb-attack${attack.equipped ? ' is-equipped' : ''}">
    <div class="vos-sb-attack-name">
      ${esc(attack.name)}
      ${attack.variant ? `<span class="vos-sb-attack-variant">${esc(attack.variant)}</span>` : ''}
    </div>
    <div class="vos-sb-attack-hit" aria-label="${attack.toHit ? `${esc(attack.toHit)} to hit` : 'attack bonus unknown'}">
      ${attack.toHit ? esc(attack.toHit) : '<span class="is-unknown" title="Re-push from Foundry to fill this in">—</span>'}
    </div>
    <div class="vos-sb-attack-dmg">
      ${esc(attack.damage || '—')}
      ${bonuses.map((bonus) => `<span class="vos-sb-attack-bonus">${
        esc(bonus.text)} <i>${esc(bonus.name)}</i></span>`).join('')}
    </div>
    ${notes.length ? `<div class="vos-sb-attack-notes">${notes.map(esc).join(' · ')}</div>` : ''}
  </li>`;
}

function renderAttacks(model) {
  const attacks = model.attacks ?? [];
  if (!attacks.length) return '';
  return `<ul class="vos-sb-attacks">
    <li class="vos-sb-attack is-head" aria-hidden="true">
      <div class="vos-sb-attack-name">Attack</div>
      <div class="vos-sb-attack-hit">Hit</div>
      <div class="vos-sb-attack-dmg">Damage</div>
    </li>
    ${attacks.map((attack) => renderAttackRow(model, attack)).join('')}
  </ul>`;
}

/* ── Entry point ───────────────────────────────────────────────────── */

/* Conditions currently on the character. Dying is shown in the exhaustion row
 * instead, next to the consequences it carries, so it is not repeated here. */
function renderConditions(model) {
  const play = ctx && ctx.play;
  if (!play) return '';
  const active = (play.conditions || []).filter((c) => c !== 'dying');
  const body = active.length
    ? active.map((c) => `<li${bind({ 'data-play': 'condition', 'data-condition': c })}>${
        esc(c.charAt(0).toUpperCase() + c.slice(1))
      }</li>`).join('')
    : `<li class="is-empty"${bind({ 'data-play': 'conditions' })}>Add a condition</li>`;
  return `<ul class="vos-sb-chips is-conditions"${bind({ 'data-play': 'conditions' })}>${body}</ul>`;
}

export function renderStatblock(model, meta = {}) {
  if (!model) return '';
  ctx = {
    play: meta.play || null,
    limits: meta.limits || null,
    interactive: meta.interactive !== false,
    /* 'compact' drops the big name header — for pages that already carry the
     * character's name in their own chrome. */
    identity: meta.identity || 'full',
    // A Set of entry ids the player has hidden, and whether hiding is offered.
    hidden: meta.hidden || null,
    hideable: Boolean(meta.hideable),
    // A Set of resource ids the player pinned to the play bar.
    pinned: meta.pinned || null,
  };

  const warning = model.meta?.hasDerived === false
    ? `<p class="vos-sb-warning">This export has no derived block, so AC, hit points and
       proficiency bonus are missing. Re-export with the current Foundry macro.</p>`
    : '';

  return `<article class="vos-sb">
    ${renderHeader(model)}
    ${warning}
    ${renderVitals(model)}
    ${renderConditions(model)}
    ${section('Resources', renderResources(model), { id: 'sb-resources' })}
    ${section('Attacks', renderAttacks(model), { id: 'sb-attacks' })}
    ${section('Abilities', renderAbilities(model), { id: 'sb-abilities' })}
    ${section('Skills', renderSkills(model), { id: 'sb-skills' })}
    ${section('Tools', renderTools(model), { id: 'sb-tools' })}
    ${section('Proficiencies', [
      chips(model.proficiencies.languages, 'is-languages'),
      chips(model.proficiencies.armor),
      chips(model.proficiencies.weapons),
      chips(model.proficiencies.masteries),
    ].filter(Boolean).join(''), { id: 'sb-proficiencies' })}
    ${section('Defenses', [
      defenseRow('Resistant', model.defenses.resistances, liveDefenses(model, 'resistances')),
      defenseRow('Immune', model.defenses.immunities, liveDefenses(model, 'immunities')),
      defenseRow('Vulnerable', model.defenses.vulnerabilities, liveDefenses(model, 'vulnerabilities')),
      model.defenses.conditionImmunities.length ? `<p class="vos-sb-defense"><span>Condition immune</span>${chips(model.defenses.conditionImmunities)}</p>` : '',
      model.senses.length ? `<p class="vos-sb-defense"><span>Senses</span>${chips(model.senses)}</p>` : '',
    ].filter(Boolean).join(''), { id: 'sb-defenses' })}
    ${section('Spellcasting', renderSpellcasting(model), { id: 'sb-spells' })}
    ${section('Features', renderFeatures(model), { id: 'sb-features' })}
    ${section('Equipment', renderInventory(model), { id: 'sb-equipment' })}
  </article>`;
}
