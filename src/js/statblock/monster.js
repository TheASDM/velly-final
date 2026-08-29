/* Render a 5etools bestiary entry as the book's stat block.
 *
 * A different animal from the character sheet: no play state, no Foundry
 * derived block — the JSON is the finished statement of what the creature is,
 * so this only has to translate its shorthand (via cleanEnrichers) and lay it
 * out the way thirty years of stat blocks have taught everyone to read.
 */
import { cleanEnrichers } from './html.js';
import { signed } from './labels.js';

const SIZES = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
const ALIGNMENT = {
  L: 'lawful', N: 'neutral', C: 'chaotic', G: 'good', E: 'evil',
  U: 'unaligned', A: 'any alignment', NX: 'neutral', NY: 'neutral',
};
/* XP by challenge rating, for the ratings a table actually meets. */
const XP = {
  0: '10', '1/8': '25', '1/4': '50', '1/2': '100',
  1: '200', 2: '450', 3: '700', 4: '1,100', 5: '1,800', 6: '2,300',
  7: '2,900', 8: '3,900', 9: '5,000', 10: '5,900',
};

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]),
  );
}

/* Every string out of the JSON goes through the enricher cleaner first, so
 * {@atk mw}, {@hit 4} and {@dc 12} read as the book prints them. */
function text(value) {
  return esc(cleanEnrichers(value));
}

const mod = (score) => signed(Math.floor((Number(score) - 10) / 2));

function headline(mon) {
  const size = (mon.size ?? []).map((code) => SIZES[code] ?? code).join(' or ');
  const type = typeof mon.type === 'string'
    ? mon.type
    : [mon.type?.type, mon.type?.tags?.length ? `(${mon.type.tags.join(', ')})` : '']
      .filter(Boolean).join(' ');
  const alignment = (mon.alignment ?? [])
    .map((code) => (typeof code === 'string' ? ALIGNMENT[code] ?? code : ''))
    .filter(Boolean).join(' ');
  return [size, type].filter(Boolean).join(' ') + (alignment ? `, ${alignment}` : '');
}

function acLine(mon) {
  return (mon.ac ?? []).map((entry) => {
    if (typeof entry === 'number') return String(entry);
    const from = (entry.from ?? []).map(cleanEnrichers).join(', ');
    return `${entry.ac}${from ? ` (${from})` : ''}${entry.condition ? ` ${cleanEnrichers(entry.condition)}` : ''}`;
  }).join(', ');
}

function hpLine(mon) {
  const hp = mon.hp ?? {};
  if (hp.special) return cleanEnrichers(hp.special);
  return `${hp.average ?? '—'}${hp.formula ? ` (${hp.formula})` : ''}`;
}

function speedLine(mon) {
  const speed = mon.speed ?? {};
  return ['walk', 'fly', 'swim', 'climb', 'burrow']
    .filter((key) => speed[key])
    .map((key) => {
      const raw = speed[key];
      const feet = typeof raw === 'number' ? raw : raw.number;
      const condition = typeof raw === 'object' && raw.condition ? ` ${cleanEnrichers(raw.condition)}` : '';
      return `${key === 'walk' ? '' : `${key} `}${feet} ft.${condition}`;
    })
    .join(', ');
}

/* Damage vulnerabilities, resistances and immunities share one shape: plain
 * strings, plus objects that scope a list with a note. */
function damageList(values, key) {
  return (values ?? []).map((entry) => {
    if (typeof entry === 'string') return entry;
    if (entry.special) return cleanEnrichers(entry.special);
    const inner = damageList(entry[key], key);
    return `${inner}${entry.note ? ` ${cleanEnrichers(entry.note)}` : ''}`;
  }).join(', ');
}

function crLine(mon) {
  const cr = typeof mon.cr === 'object' ? mon.cr?.cr : mon.cr;
  if (cr == null) return '';
  return `${cr}${XP[cr] ? ` (${XP[cr]} XP)` : ''}`;
}

function statRows(mon) {
  const rows = [
    ['Saving Throws', mon.save && Object.entries(mon.save)
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)} ${value}`).join(', ')],
    ['Skills', mon.skill && Object.entries(mon.skill)
      .filter(([key]) => key !== 'other')
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)} ${value}`).join(', ')],
    ['Damage Vulnerabilities', damageList(mon.vulnerable, 'vulnerable')],
    ['Damage Resistances', damageList(mon.resist, 'resist')],
    ['Damage Immunities', damageList(mon.immune, 'immune')],
    ['Condition Immunities', (mon.conditionImmune ?? []).join(', ')],
    ['Senses', [...(mon.senses ?? []), mon.passive != null ? `passive Perception ${mon.passive}` : '']
      .filter(Boolean).join(', ')],
    ['Languages', (mon.languages ?? []).join(', ') || '—'],
    ['Challenge', crLine(mon)],
  ];
  return rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<p class="vos-mon-stat"><b>${label}</b> ${text(value)}</p>`)
    .join('');
}

function abilityGrid(mon) {
  return `<div class="vos-mon-abilities">${
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => `<div>
      <span class="vos-mon-ab-name">${key.toUpperCase()}</span>
      <span class="vos-mon-ab-score">${esc(mon[key])}</span>
      <span class="vos-mon-ab-mod">${esc(mod(mon[key]))}</span>
    </div>`).join('')
  }</div>`;
}

/* 5etools entries: strings, lists, and named sub-blocks, nested freely. */
function entriesHtml(entries) {
  return (entries ?? []).map((entry) => {
    if (typeof entry === 'string') return `<p>${text(entry)}</p>`;
    if (!entry || typeof entry !== 'object') return '';
    if (entry.type === 'list') {
      return `<ul>${(entry.items ?? [])
        .map((item) => `<li>${typeof item === 'string' ? text(item) : entriesHtml([item])}</li>`)
        .join('')}</ul>`;
    }
    if (Array.isArray(entry.entries)) {
      return `${entry.name ? `<p class="vos-mon-subhead">${text(entry.name)}.</p>` : ''}${
        entriesHtml(entry.entries)}`;
    }
    return '';
  }).join('');
}

/* A named feature: the first sentence rides the bold name, as printed. */
function featureHtml(feature) {
  const entries = feature.entries ?? [];
  const [first, ...rest] = entries;
  const lead = typeof first === 'string'
    ? `<p class="vos-mon-feature"><b>${text(feature.name)}.</b> ${text(first)}</p>`
    : `<p class="vos-mon-feature"><b>${text(feature.name)}.</b></p>${entriesHtml([first].filter(Boolean))}`;
  return lead + entriesHtml(rest);
}

function featureSection(title, features) {
  if (!features || !features.length) return '';
  return `<h4 class="vos-mon-h">${esc(title)}</h4>${features.map(featureHtml).join('')}`;
}

/* Innate spellcasting, 2024-style: a header sentence, then spells grouped by
 * frequency. `hidden` names the groups the header already covers in prose. */
const SPELL_FREQ = { will: 'At Will', daily: '/Day', rest: '/Rest', restLong: '/Long Rest' };

function spellGroups(sc) {
  const hidden = new Set(sc.hidden ?? []);
  return Object.keys(SPELL_FREQ)
    .filter((freq) => sc[freq] && !hidden.has(freq))
    .map((freq) => {
      const value = sc[freq];
      if (Array.isArray(value)) {
        return `<p class="vos-mon-spells"><b>${SPELL_FREQ[freq]}:</b> ${
          value.map((spell) => text(spell)).join(', ')}</p>`;
      }
      // {"1": [...], "1e": [...]} — the "e" suffix is the book's "each".
      return Object.entries(value).map(([count, spells]) => `<p class="vos-mon-spells"><b>${
        count.replace(/e$/, '')}${SPELL_FREQ[freq]}${/e$/.test(count) ? ' Each' : ''}:</b> ${
        spells.map((spell) => text(spell)).join(', ')}</p>`).join('');
    })
    .join('');
}

function spellcastingHtml(sc) {
  return `<p class="vos-mon-feature"><b>${text(sc.name)}.</b> ${
    (sc.headerEntries ?? []).map((entry) => text(entry)).join(' ')}</p>${spellGroups(sc)}`;
}

/* Where each casting block prints: 2024 blocks say so via displayAs. */
function spellcastingFor(mon, placement) {
  return (mon.spellcasting ?? [])
    .filter((sc) => (sc.displayAs ?? 'trait') === placement)
    .map(spellcastingHtml)
    .join('');
}

export function renderMonster(mon) {
  return `<article class="vos-mon">
    <header class="vos-mon-head">
      <h3 class="vos-mon-name">${text(mon.name)}</h3>
      <p class="vos-mon-line">${text(headline(mon))}</p>
    </header>
    <div class="vos-mon-vitals">
      <p class="vos-mon-stat"><b>Armor Class</b> ${text(acLine(mon))}</p>
      <p class="vos-mon-stat"><b>Hit Points</b> ${text(hpLine(mon))}</p>
      <p class="vos-mon-stat"><b>Speed</b> ${text(speedLine(mon))}</p>
    </div>
    ${abilityGrid(mon)}
    <div class="vos-mon-stats">${statRows(mon)}</div>
    ${featureSection('Traits', mon.trait)}
    ${spellcastingFor(mon, 'trait')}
    ${featureSection('Actions', mon.action)}
    ${spellcastingFor(mon, 'action')}
    ${featureSection('Bonus Actions', mon.bonus)}
    ${spellcastingFor(mon, 'bonus')}
    ${featureSection('Reactions', mon.reaction)}
    ${featureSection('Legendary Actions', mon.legendary)}
    ${(mon.variant ?? []).map((variant) => `<div class="vos-mon-variant">
      <h4 class="vos-mon-h">Variant: ${text(variant.name)}</h4>
      ${entriesHtml(variant.entries)}
    </div>`).join('')}
  </article>`;
}
