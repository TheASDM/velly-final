import { esc, label, percent, trimmed } from '../util.js';

const WORD = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight' };

// The four that say the most about a character at a glance.
const CARD_KEYS = [
  'P1 - who you owe',
  'P1 - your 3am person',
  'P1 - an unspoken fear',
  'P1 - what you want',
];

function card(character) {
  const rows = CARD_KEYS.map((key) => {
    const value = trimmed(character, key);
    return `<dt>${esc(label(key))}</dt><dd${value ? '' : ' class="none"'}>${
      value ? esc(value) : '—'}</dd>`;
  }).join('');

  return `<button class="card" data-char="${esc(character.id)}" style="--c:${esc(character.color)}">
    <h3>${esc(character.name)}</h3>
    <div class="role">${esc(character.role)}</div>
    <dl>${rows}</dl>
    <div class="foot">
      <span class="meter"><i style="width:${percent(character.answered, character.total)}%"></i></span>
      <span>${character.answered}/${character.total} · ${esc(character.status)}</span>
    </div>
  </button>`;
}

export function viewOverview(model) {
  const list = model.characters;
  const submitted = list.filter((c) => c.status === 'submitted').length;
  const answered = list.reduce((n, c) => n + c.answered, 0);
  const total = list.reduce((n, c) => n + c.total, 0);

  return `
  <div class="dossier-head">
    <div class="eyebrow">The table · ${list.length} questionnaires</div>
    <h2>All ${WORD[list.length] || list.length}</h2>
    <p class="lede">Every answer the players submitted, laid side by side. Open a name for the
      full dossier, or use Cross-reference to hear everyone answer the same question.</p>
    <div class="totals">
      <div><b>${list.length}</b> players</div>
      <div><b>${submitted}</b> submitted</div>
      <div><b>${list.length - submitted}</b> still draft</div>
      <div><b>${answered}</b> answers of ${total}</div>
    </div>
  </div>
  <div class="ov">${list.map(card).join('')}</div>`;
}
