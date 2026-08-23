import { esc, highlight, label } from '../util.js';

/* Free-text search across every answer. Matches on the answer body, the field
 * label, and the prompt, so "who do you owe" finds the question as well as the
 * answers to it. */
export function viewSearch(model, query) {
  const needle = query.trim().toLowerCase();

  const hits = [];
  model.characters.forEach((character) => {
    Object.keys(character.answers || {}).forEach((key) => {
      const value = (character.answers[key] || '').trim();
      if (!value) return;
      const haystack = `${value} ${label(key)} ${model.prompts[key] || ''}`.toLowerCase();
      if (haystack.includes(needle)) hits.push({ character, key, value });
    });
  });

  const dossierCount = new Set(hits.map((h) => h.character.id)).size;

  const body = hits.length
    ? model.characters.map((character) => {
      const mine = hits.filter((h) => h.character.id === character.id);
      if (!mine.length) return '';
      return `<section class="sec">
        <div class="sec-head">
          <h3 style="color:${esc(character.color)}">${esc(character.name)}</h3>
          <span class="line"></span>
          <span class="count">${mine.length} hit${mine.length > 1 ? 's' : ''}</span>
        </div>
        ${mine.map((hit) => `<div class="hit" style="--c:${esc(character.color)}">
          <div class="who">${esc(label(hit.key))}</div>
          <div class="a">${highlight(hit.value, query.trim())}</div>
        </div>`).join('')}
      </section>`;
    }).join('')
    : `<div class="empty-state"><b>Nothing matches that.</b>
        Try a name, a district, or a fragment of a phrase.</div>`;

  return `<div class="dossier-head">
    <div class="eyebrow">Search</div>
    <h2>${esc(query.trim())}</h2>
    <p class="lede">${hits.length} match${hits.length === 1 ? '' : 'es'} across
      ${dossierCount} dossier${dossierCount === 1 ? '' : 's'}.</p>
  </div>${body}`;
}
