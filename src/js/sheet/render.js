/* Render the DM's character-sheet markdown.
 *
 * These sheets are a narrow, consistent dialect rather than arbitrary markdown,
 * so this parses that dialect directly instead of reaching for a general
 * renderer. What the sheets actually use:
 *
 *   # NAME                     the character, or "DM SHEET — Name"
 *   *Species · Class · 19*     a tagline of ·-separated facts
 *   > premise                  the one-paragraph hook
 *   ## SECTION                 section headings
 *   **Label:** value           runs of these read as a facts list
 *   | | |                      a headerless two-column table (cast lists)
 *   | She believes | Actually  a real two-column comparison table
 *   ---                        a rule between DM-sheet movements
 *
 * Inline escaping is delegated to renderSafeMarkdownInline from the PWA core so
 * there is one implementation of that, and it is the audited one — everything
 * here is block structure on top of it.
 */
import { escapeHtml, renderSafeMarkdownInline as inline } from '../pwa/core.js';

const HEADING = /^(#{1,4})\s+(.+)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER = /^\s*\|[\s:|-]+\|\s*$/;
const LABEL_LINE = /^\*\*([^*]{1,80}?):?\*\*[:：]?\s*(.*)$/;
const RULE = /^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/;

/* A |---|---| separator. The character class alone would also swallow the
 * headerless `| | |` row the cast lists open with, which would promote the
 * first real row into a header — so require an actual dash. */
function isDivider(line) {
  return TABLE_DIVIDER.test(line) && line.includes('-');
}

function splitRow(line) {
  const match = line.match(TABLE_ROW);
  if (!match) return null;
  return match[1].split('|').map((cell) => cell.trim());
}

/* A "·"-separated tagline reads better as discrete chips than as one run-on
 * line, especially at phone width where it would otherwise wrap mid-fact. */
function renderTagline(text) {
  const parts = String(text || '')
    .split(/\s*[·|•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return `<p class="vos-sheet-tagline">${inline(text)}</p>`;
  const chips = parts.map((part) => `<span class="vos-sheet-chip">${inline(part)}</span>`).join('');
  return `<p class="vos-sheet-tagline">${chips}</p>`;
}

function renderTable(rows) {
  const [head, ...body] = rows;
  const headless = head.every((cell) => !cell);

  // Headerless two-column tables are the cast lists ("YOUR PEOPLE"). A real
  // table would force a cramped two-column grid on a phone; a definition list
  // stacks cleanly and keeps the name prominent.
  if (headless && rows.every((row) => row.length === 2)) {
    const items = body
      .filter((row) => row.some((cell) => cell))
      .map(([name, detail]) => (
        `<div class="vos-sheet-person">
           <dt>${inline(name)}</dt>
           <dd>${inline(detail)}</dd>
         </div>`
      ))
      .join('');
    return `<dl class="vos-sheet-people">${items}</dl>`;
  }

  const headCells = head.map((cell) => `<th scope="col">${inline(cell)}</th>`).join('');
  const bodyRows = body
    .filter((row) => row.some((cell) => cell))
    .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
    .join('');
  return (
    `<div class="vos-sheet-table-wrap">
       <table class="vos-sheet-table">
         <thead><tr>${headCells}</tr></thead>
         <tbody>${bodyRows}</tbody>
       </table>
     </div>`
  );
}

function renderFacts(entries) {
  const items = entries
    .map(([label, value]) => (
      `<div class="vos-sheet-fact">
         <dt>${inline(label)}</dt>
         <dd>${value ? inline(value) : '<span class="vos-sheet-blank">—</span>'}</dd>
       </div>`
    ))
    .join('');
  return `<dl class="vos-sheet-facts">${items}</dl>`;
}

/* Turn the body of one section into HTML. Consumes line-runs greedily so that
 * consecutive label lines collapse into a single facts list. */
function renderBlocks(lines) {
  const out = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) { index += 1; continue; }

    if (RULE.test(line)) {
      out.push('<hr class="vos-sheet-rule">');
      index += 1;
      continue;
    }

    // Table: a row, optionally followed by a |---|---| divider.
    if (splitRow(line)) {
      const rows = [];
      while (index < lines.length && splitRow(lines[index])) {
        if (!isDivider(lines[index])) rows.push(splitRow(lines[index]));
        index += 1;
      }
      if (rows.length) out.push(renderTable(rows));
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      out.push(`<blockquote class="vos-sheet-quote">${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ul class="vos-sheet-list">${items.join('')}</ul>`);
      continue;
    }

    // A run of "**Label:** value" lines becomes one facts list. A label line
    // whose value is empty keeps its slot so the gap is visible.
    if (LABEL_LINE.test(line)) {
      const entries = [];
      while (index < lines.length && LABEL_LINE.test(lines[index])) {
        const [, label, value] = lines[index].match(LABEL_LINE);
        entries.push([label, value]);
        index += 1;
      }
      out.push(renderFacts(entries));
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !splitRow(lines[index]) &&
      !RULE.test(lines[index]) &&
      !LABEL_LINE.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !HEADING.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length) {
      const text = paragraph.join(' ');
      // A lone italic line is a flourish, not prose — the sheets close on one.
      const flourish = paragraph.length === 1 && /^\*[^*].*\*$/.test(text);
      const cls = flourish ? ' class="vos-sheet-flourish"' : '';
      out.push(`<p${cls}>${inline(text)}</p>`);
    }
  }

  return out.join('');
}

/* Split the document into a head region (everything before the first ##) and
 * the sections after it. */
function parse(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const head = { title: '', lines: [] };
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    const heading = line.match(HEADING);
    if (heading && heading[1].length === 1 && !head.title) {
      head.title = heading[2].trim();
      return;
    }
    if (heading && heading[1].length >= 2) {
      current = { title: heading[2].trim(), lines: [] };
      sections.push(current);
      return;
    }
    (current ? current.lines : head.lines).push(line);
  });

  return { head, sections };
}

function renderHead(head, meta) {
  const lines = head.lines.filter((line) => line.trim() && !RULE.test(line));
  const parts = [];

  // The first bare italic line is the tagline; a quote is the premise; anything
  // else in the head is supporting meta (the DM sheets put a warning here).
  let taglineUsed = false;
  const rest = [];
  lines.forEach((line) => {
    const text = line.trim();
    if (!taglineUsed && /^\*[^*].*\*$/.test(text)) {
      parts.push(renderTagline(text.replace(/^\*|\*$/g, '')));
      taglineUsed = true;
      return;
    }
    if (!taglineUsed && /·/.test(text) && !/^[>*]/.test(text) && !LABEL_LINE.test(text)) {
      parts.push(renderTagline(text));
      taglineUsed = true;
      return;
    }
    rest.push(line);
  });

  const title = head.title || meta.fallbackTitle || 'Character sheet';
  const eyebrow = meta.eyebrow ? `<p class="vos-sheet-eyebrow">${escapeHtml(meta.eyebrow)}</p>` : '';

  return (
    `<header class="vos-sheet-head">
       ${eyebrow}
       <h1 class="vos-sheet-name">${inline(title)}</h1>
       ${parts.join('')}
       ${renderBlocks(rest)}
     </header>`
  );
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

/* Render a full sheet. `meta.eyebrow` labels the sheet (e.g. the variant), and
 * `meta.fallbackTitle` covers a sheet with no # heading. */
export function renderSheet(markdown, meta = {}) {
  const { head, sections } = parse(markdown);
  const body = sections
    .map((section) => (
      `<section class="vos-sheet-section" id="sheet-${slug(section.title)}">
         <h2 class="vos-sheet-section-title">${inline(section.title)}</h2>
         ${renderBlocks(section.lines)}
       </section>`
    ))
    .join('');

  return `<article class="vos-sheet">${renderHead(head, meta)}${body}</article>`;
}

/* Section titles, for building a jump list alongside a long sheet. */
export function sheetSections(markdown) {
  return parse(markdown).sections.map((section) => ({
    title: section.title,
    id: `sheet-${slug(section.title)}`,
  }));
}

export function sheetTitle(markdown) {
  return parse(markdown).head.title;
}
