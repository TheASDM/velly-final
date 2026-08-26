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

  const cells = [
    { label: 'AC', value: num(v.ac) },
    { label: 'Hit Points', value: hp + temp, wide: true, play: { 'data-play': 'hp' } },
    { label: 'Initiative', value: v.initiative == null ? '—' : esc(signed(v.initiative)) },
    { label: 'Speed', value: esc(v.speed || '—') },
    { label: 'Proficiency', value: v.prof == null ? '—' : esc(signed(v.prof)) },
    {
      label: 'Hit Dice',
      value: hitDiceValue(v, spentDice),
      play: { 'data-play': 'hitdice' },
    },
  ];

  const flags = [v.inspiration ? 'Inspiration' : ''].filter(Boolean);

  return `<div class="vos-sb-vitals">
    ${cells.map((cell) => `<div class="vos-sb-vital${cell.wide ? ' is-wide' : ''}"${
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

  const header = `<div class="vos-sb-spell-head">
    ${sc.abilityLabel ? `<div><span class="vos-sb-vital-label">Ability</span><span class="vos-sb-vital-value is-small">${esc(sc.abilityLabel)}</span></div>` : ''}
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

  const groups = model.spells.map((group) => `<div class="vos-sb-spell-group">
    <h4 class="vos-sb-spell-level">${esc(group.label)}${
      group.slots ? ` <span class="vos-sb-slot-count">${slotsLeft({ ...group.slots, level: group.level })}/${group.slots.max}</span>` : ''
    }</h4>
    <ul class="vos-sb-entries">${group.spells.map((spell) => renderEntry({
      name: spell.name,
      marker: spell.always ? 'always' : (spell.prepared ? 'prepared' : ''),
      meta: [spell.school, ...spell.meta],
      description: spell.description,
    })).join('')}</ul>
  </div>`).join('');

  return header + slots + groups;
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

function renderEntry(entry) {
  const meta = (entry.meta ?? []).filter(Boolean);
  const summary = `<summary class="vos-sb-entry-head">
    <span class="vos-sb-entry-name">${esc(entry.name)}</span>
    ${entry.marker ? `<span class="vos-sb-marker" title="${esc(entry.marker)}">${esc(entry.marker)}</span>` : ''}
    ${entry.uses ? renderUses(entry) : ''}
    ${meta.length ? `<span class="vos-sb-entry-meta">${meta.map(esc).join(' · ')}</span>` : ''}
  </summary>`;

  // description is pre-sanitised HTML from normalize.js
  const body = entry.description
    ? `<div class="vos-sb-entry-body">${entry.description}</div>`
    : '<div class="vos-sb-entry-body is-empty">No description.</div>';

  return `<li class="vos-sb-entry"><details>${summary}${body}</details></li>`;
}

function renderFeatures(model) {
  if (!model.features.length) return '';
  const groups = new Map();
  model.features.forEach((feature) => {
    if (!groups.has(feature.kind)) groups.set(feature.kind, []);
    groups.get(feature.kind).push(feature);
  });

  return [...groups.entries()].map(([kind, entries]) => `<div class="vos-sb-feature-group">
    <h4 class="vos-sb-group-title">${esc(kind)}</h4>
    <ul class="vos-sb-entries">${entries.map((feature) => renderEntry({
      id: feature.id,
      name: feature.name,
      uses: feature.uses,
      meta: [feature.activation, feature.source].filter(Boolean),
      description: feature.description,
    })).join('')}</ul>
  </div>`).join('');
}

function renderInventory(model) {
  if (!model.inventory.length) return '';
  const coins = ['pp', 'gp', 'ep', 'sp', 'cp']
    .filter((key) => Number(model.currency?.[key]) > 0)
    .map((key) => `${model.currency[key]} ${key}`);

  return `${coins.length ? chips(coins, 'is-coins') : ''}
  <ul class="vos-sb-entries">${model.inventory.map((item) => renderEntry({
    name: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
    marker: item.equipped ? 'equipped' : '',
    meta: [item.kind, ...item.meta, item.rarity].filter(Boolean),
    description: item.description,
  })).join('')}</ul>`;
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
  ctx = { play: meta.play || null, limits: meta.limits || null, interactive: meta.interactive !== false };

  const warning = model.meta?.hasDerived === false
    ? `<p class="vos-sb-warning">This export has no derived block, so AC, hit points and
       proficiency bonus are missing. Re-export with the current Foundry macro.</p>`
    : '';

  return `<article class="vos-sb">
    ${renderHeader(model)}
    ${warning}
    ${renderVitals(model)}
    ${renderConditions(model)}
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
      model.defenses.resistances.length ? `<p class="vos-sb-defense"><span>Resistant</span>${chips(model.defenses.resistances)}</p>` : '',
      model.defenses.immunities.length ? `<p class="vos-sb-defense"><span>Immune</span>${chips(model.defenses.immunities)}</p>` : '',
      model.defenses.vulnerabilities.length ? `<p class="vos-sb-defense"><span>Vulnerable</span>${chips(model.defenses.vulnerabilities)}</p>` : '',
      model.defenses.conditionImmunities.length ? `<p class="vos-sb-defense"><span>Condition immune</span>${chips(model.defenses.conditionImmunities)}</p>` : '',
      model.senses.length ? `<p class="vos-sb-defense"><span>Senses</span>${chips(model.senses)}</p>` : '',
    ].filter(Boolean).join(''), { id: 'sb-defenses' })}
    ${section('Spellcasting', renderSpellcasting(model), { id: 'sb-spells' })}
    ${section('Features', renderFeatures(model), { id: 'sb-features' })}
    ${section('Equipment', renderInventory(model), { id: 'sb-equipment' })}
  </article>`;
}
