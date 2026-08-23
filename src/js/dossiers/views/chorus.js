/* Cross-reference: one shared question, every voice at once. Only questions
 * everyone was asked qualify — Part I and the vitals dossier. Part II is
 * per-character by design, so it has nothing to compare against. */
import { esc, label, trimmed } from '../util.js';

export function chorusKeys(model) {
  const keys = model.p1.map((key) => ({ key, group: 'Part One' }));
  model.vitalsGroups.forEach((group) => {
    group.fields.forEach((field) => {
      keys.push({ key: field.key, group: 'Vitals · ' + group.label });
    });
  });
  return keys;
}

export function viewChorus(model, activeKey, showBlanks) {
  const keys = chorusKeys(model);
  const groups = [...new Set(keys.map((k) => k.group))];
  const prompt = model.prompts[activeKey] || '';
  const answeredCount = model.characters.filter((c) => trimmed(c, activeKey)).length;

  const options = groups.map((group) => {
    const items = keys.filter((k) => k.group === group).map((k) =>
      `<option value="${esc(k.key)}"${k.key === activeKey ? ' selected' : ''}>${
        esc(label(k.key))}</option>`).join('');
    return `<optgroup label="${esc(group)}">${items}</optgroup>`;
  }).join('');

  const voices = model.characters.map((character) => {
    const value = trimmed(character, activeKey);
    if (!value && !showBlanks) return '';
    return `<div class="voice" style="--c:${esc(character.color)}">
      <div class="who">${esc(character.short)}</div>
      <div class="txt${value ? '' : ' none'}">${value ? esc(value) : 'no answer'}</div>
    </div>`;
  }).join('');

  return `
  <div class="dossier-head">
    <div class="eyebrow">One question · ${model.characters.length} voices</div>
    <h2>Cross-reference</h2>
    <p class="lede">Pick a shared question and read every answer at once. Useful for spotting
      overlaps, contradictions, and who left the same blank.</p>
    <div class="picker">
      <label class="hint" for="vos-dossier-chorus">Question</label>
      <select id="vos-dossier-chorus">${options}</select>
      <span class="hint">${answeredCount} of ${model.characters.length} answered</span>
    </div>
  </div>
  <div class="chorus-prompt">${esc(label(activeKey))}</div>
  ${prompt ? `<div class="chorus-sub">${esc(prompt)}</div>` : ''}
  <div class="voices">${voices || '<div class="empty-state">Nobody answered this one.</div>'}</div>`;
}
