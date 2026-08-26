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
  const hp = v.hp.max != null ? `${num(v.hp.value)}<span class="vos-sb-of">/${num(v.hp.max)}</span>` : num(v.hp.value);
  const temp = v.hp.temp ? `<span class="vos-sb-temp">+${esc(v.hp.temp)} temp</span>` : '';

  const cells = [
    { label: 'AC', value: num(v.ac) },
    { label: 'Hit Points', value: hp + temp, wide: true },
    { label: 'Initiative', value: v.initiative == null ? '—' : esc(signed(v.initiative)) },
    { label: 'Speed', value: esc(v.speed || '—') },
    { label: 'Proficiency', value: v.prof == null ? '—' : esc(signed(v.prof)) },
    { label: 'Hit Dice', value: esc(v.hitDice || '—') },
  ];

  const flags = [
    v.inspiration ? 'Inspiration' : '',
    v.exhaustion ? `Exhaustion ${v.exhaustion}` : '',
    v.deathSaves.success || v.deathSaves.failure
      ? `Death saves ${v.deathSaves.success}✓ / ${v.deathSaves.failure}✗` : '',
  ].filter(Boolean);

  return `<div class="vos-sb-vitals">
    ${cells.map((cell) => `<div class="vos-sb-vital${cell.wide ? ' is-wide' : ''}">
      <span class="vos-sb-vital-label">${esc(cell.label)}</span>
      <span class="vos-sb-vital-value">${cell.value}</span>
    </div>`).join('')}
  </div>${flags.length ? chips(flags, 'is-flags') : ''}`;
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

/* rank: 0 none, 1 proficient, 2 expertise. */
function proficiencyDot(rank) {
  const title = rank >= 2 ? 'Expertise' : rank === 1 ? 'Proficient' : 'Not proficient';
  return `<span class="vos-sb-dot is-rank-${rank >= 2 ? 2 : rank}" title="${title}" aria-label="${title}"></span>`;
}

function renderSkills(model) {
  if (!model.skills.length) return '';
  const rows = model.skills.map((skill) => `<li class="vos-sb-skill${skill.rank ? ' is-proficient' : ''}">
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
  return `<ul class="vos-sb-skills is-tools">${model.tools.map((tool) => `<li class="vos-sb-skill${tool.rank ? ' is-proficient' : ''}">
    ${proficiencyDot(tool.rank)}
    <span class="vos-sb-skill-name">${esc(tool.label)}</span>
    <span class="vos-sb-skill-total">${esc(signed(tool.total))}</span>
  </li>`).join('')}</ul>`;
}

/* ── Spellcasting ──────────────────────────────────────────────────── */

function slotPips(slot) {
  const pips = [];
  for (let i = 0; i < slot.max; i += 1) {
    pips.push(`<span class="vos-sb-pip${i < slot.value ? '' : ' is-spent'}"></span>`);
  }
  return `<span class="vos-sb-pips" aria-label="${slot.value} of ${slot.max} remaining">${pips.join('')}</span>`;
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
        <span class="vos-sb-slot-level">Level ${slot.level}</span>
        ${slotPips(slot)}
        <span class="vos-sb-slot-count">${slot.value}/${slot.max}</span>
      </li>`).join('')}</ul>`
    : '';

  const groups = model.spells.map((group) => `<div class="vos-sb-spell-group">
    <h4 class="vos-sb-spell-level">${esc(group.label)}${
      group.slots ? ` <span class="vos-sb-slot-count">${group.slots.value}/${group.slots.max}</span>` : ''
    }</h4>
    <ul class="vos-sb-entries">${group.spells.map((spell) => renderEntry({
      name: spell.name,
      marker: spell.prepared ? 'prepared' : '',
      meta: [spell.school, ...spell.meta],
      description: spell.description,
    })).join('')}</ul>
  </div>`).join('');

  return header + slots + groups;
}

/* ── Collapsible entry (feature, spell, item) ──────────────────────── */

function renderEntry(entry) {
  const meta = (entry.meta ?? []).filter(Boolean);
  const summary = `<summary class="vos-sb-entry-head">
    <span class="vos-sb-entry-name">${esc(entry.name)}</span>
    ${entry.marker ? `<span class="vos-sb-marker" title="${esc(entry.marker)}">${esc(entry.marker)}</span>` : ''}
    ${entry.uses ? `<span class="vos-sb-uses">${esc(entry.uses.value)}/${esc(entry.uses.max)}${
      entry.uses.recovery ? ` <span class="vos-sb-uses-recovery">${esc(entry.uses.recovery)}</span>` : ''
    }</span>` : ''}
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

export function renderStatblock(model) {
  if (!model) return '';

  const warning = model.meta?.hasDerived === false
    ? `<p class="vos-sb-warning">This export has no derived block, so AC, hit points and
       proficiency bonus are missing. Re-export with the current Foundry macro.</p>`
    : '';

  return `<article class="vos-sb">
    ${renderHeader(model)}
    ${warning}
    ${renderVitals(model)}
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
