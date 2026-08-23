import { STRIP } from '../data.js';
import { esc, label, shortDate, trimmed } from '../util.js';

function qa(model, character, key, part, showBlanks) {
  const value = trimmed(character, key);
  if (!value && !showBlanks) return '';
  const prompt = model.prompts[key] || '';
  return `<div class="qa${value ? '' : ' empty'}">
    <div class="label">${esc(part)}</div>
    <div class="q">${esc(label(key))}</div>
    ${prompt ? `<div class="prompt">${esc(prompt)}</div>` : ''}
    <div class="a${value ? '' : ' none'}">${value ? esc(value) : 'No answer yet'}</div>
  </div>`;
}

// A vitals cell has three states: the player's own value, the value they
// overrode (worth flagging — it contradicts the record on file), or the on-file
// value standing in for a blank.
function vitalsRow(character, field, showBlanks) {
  const value = trimmed(character, field.key);
  const onFile = (character.onFile[field.key] || '').trim();
  if (!value && !onFile && !showBlanks) return '';

  let shown = '—';
  let note = '';
  let empty = true;
  if (value && onFile && value !== onFile) {
    shown = value; note = `changed from on file: ${onFile}`; empty = false;
  } else if (value) {
    shown = value; empty = false;
  } else if (onFile) {
    shown = onFile; note = 'on file, unchanged'; empty = false;
  }

  return `<div class="vrow">
    <dt>${esc(field.label)}</dt>
    <dd${empty ? ' class="none"' : ''}>${esc(shown)}${
      note ? `<span class="chg">${esc(note)}</span>` : ''}</dd>
  </div>`;
}

function vitalsSection(model, character, showBlanks) {
  const groups = model.vitalsGroups.map((group) => {
    const rows = group.fields.map((f) => vitalsRow(character, f, showBlanks)).join('');
    if (!rows.trim()) return '';
    return `<div class="vgroup">
      <h4>${esc(group.label)}</h4>
      <dl class="vgrid">${rows}</dl>
    </div>`;
  }).join('');
  return groups || '<div class="empty-state">Nothing filled in yet.</div>';
}

export function viewDossier(model, character, showBlanks) {
  const p1Done = model.p1.filter((k) => trimmed(character, k)).length;
  const p2Done = character.p2.filter((k) => trimmed(character, k)).length;
  const coda = trimmed(character, model.codaKey);

  const strip = STRIP.map((entry) => {
    const value = trimmed(character, entry.key);
    return `<div class="cell">
      <div class="k">${esc(entry.label)}</div>
      <div class="v${value ? '' : ' none'}">${value ? esc(value) : 'not answered'}</div>
    </div>`;
  }).join('');

  return `
  <div class="dossier-head">
    <div class="eyebrow">${esc(character.player)} · dossier</div>
    <h2>${esc(character.name)}</h2>
    <div class="role">${esc(character.role)}</div>
    <div class="tags">
      <span class="tag ${character.status === 'submitted' ? 'done' : 'draft'}">${esc(character.status)}</span>
      <span class="tag"><b>${character.answered}/${character.total}</b> answered</span>
      <span class="tag">submitted <b>${shortDate(character.submitted)}</b></span>
      <span class="tag">updated <b>${shortDate(character.updated)}</b></span>
    </div>
    <div class="jump">
      <a href="#s-table">At the table</a><a href="#s-vitals">Vitals</a>
      <a href="#s-p1">Part One</a><a href="#s-p2">Part Two</a>
    </div>
  </div>

  <section class="sec" id="s-table">
    <div class="sec-head"><h3>At the table</h3><span class="line"></span>
      <span class="count">the six that come up most</span></div>
    <div class="strip">${strip}</div>
  </section>

  <section class="sec" id="s-vitals">
    <div class="sec-head"><h3>Vitals</h3><span class="line"></span>
      <span class="count">quick reference</span></div>
    ${vitalsSection(model, character, showBlanks)}
  </section>

  <section class="sec" id="s-p1">
    <div class="sec-head"><h3>Part One · everyone answers these</h3><span class="line"></span>
      <span class="count">${p1Done}/${model.p1.length}</span></div>
    ${model.p1.map((k) => qa(model, character, k, 'Part One', showBlanks)).join('')
      || '<div class="empty-state">No answers here.</div>'}
  </section>

  <section class="sec" id="s-p2">
    <div class="sec-head"><h3>Part Two · ${esc(character.short)}’s own questions</h3>
      <span class="line"></span><span class="count">${p2Done}/${character.p2.length}</span></div>
    ${character.p2.map((k) => qa(model, character, k, 'Part Two', showBlanks)).join('')
      || '<div class="empty-state">No answers here.</div>'}
  </section>

  ${coda ? `<section class="sec">
    <div class="sec-head"><h3>One more thing</h3><span class="line"></span></div>
    <div class="qa"><div class="q">Anything else</div><div class="a">${esc(coda)}</div></div>
  </section>` : ''}`;
}
