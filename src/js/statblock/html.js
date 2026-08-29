/* Turn Foundry's description HTML into something safe to put on the page.
 *
 * Two problems to solve, in order.
 *
 * 1. Foundry's enricher syntax. Descriptions are littered with @UUID[...]{Label},
 *    @item[Tinker's Tools|XPHB], &Reference[skill=Performance] and [[/damage 1d6]].
 *    Foundry resolves those at render time against its own world; we cannot, so
 *    we reduce each to the readable text it stands for.
 *
 * 2. The HTML itself. This arrives from module imports (plutonium, compendium
 *    packs) by way of a JSON file, so it is not authored by us and must not be
 *    trusted with innerHTML as-is. Everything goes through an allowlist: known
 *    tags are rebuilt onto a fresh tree, all attributes are dropped except
 *    table spans, and anything else is unwrapped to its text. Images go too —
 *    they point at Foundry asset paths (assets/srd5e/..., modules/plutonium/...)
 *    that resolve to nothing here.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'code', 'pre',
  'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span', 'div', 'section',
]);

/* Dropped whole, contents and all — as opposed to unwrapped. */
const DROP_ENTIRELY = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'img', 'svg', 'video',
  'audio', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta',
]);

const SPAN_ATTRS = new Set(['colspan', 'rowspan']);

/* ── Enrichers ─────────────────────────────────────────────────────── */

/* @UUID[Actor.x.Item.y]{Creature Type} -> Creature Type
 * @item[Tinker's Tools|XPHB]           -> Tinker's Tools
 * @variantrule[Bonus Action|XPHB]      -> Bonus Action
 * Anything with an explicit {Label} uses the label; otherwise we take the
 * first |-segment of the target, which is the name in every Foundry form.
 * The tag name is not worth allowlisting: Foundry keeps minting new ones
 * (@variantrule, @action, @condition...) and every one we miss leaves its
 * raw syntax in a player-facing description. */
function replaceDocLinks(text) {
  return text.replace(
    /@[A-Za-z]+\[([^\]]*)\](?:\{([^}]*)\})?/g,
    (_match, target, label) => {
      if (label) return label;
      const first = String(target).split('|')[0];
      const tail = first.split('.').pop();
      return tail || first;
    },
  );
}

/* &Reference[skill=AnimalHandling]{Animal Handling} -> Animal Handling
 * &Reference[skill=Performance]                     -> Performance
 * &Reference[condition=charmed]                     -> charmed */
function replaceReferences(text) {
  return text.replace(
    /&(?:amp;)?Reference\[([^\]]*)\](?:\{([^}]*)\})?/gi,
    (_match, body, label) => {
      if (label) return label;
      const value = String(body).split('=').pop().trim();
      return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    },
  );
}

/* [[/damage 1d6 type=psychic]] -> 1d6 psychic
 * [[/r 1d6]]                   -> 1d6
 * [[/check ability=dex dc=15]] -> DC 15 Dexterity check
 * [[/save ability=wis dc=13]]  -> DC 13 Wisdom save
 * Foundry also allows a trailing {Label}, which wins when present. */
function replaceRolls(text) {
  const ABILITY = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  };
  return text.replace(/\[\[\/([a-z]+)([^\]]*)\]\](?:\{([^}]*)\})?/gi, (_match, verb, body, label) => {
    if (label) return label;
    const args = String(body).trim();
    const kind = verb.toLowerCase();

    if (kind === 'check' || kind === 'save' || kind === 'skill' || kind === 'concentration') {
      const dc = args.match(/dc=(\d+)/i);
      const ability = args.match(/(?:ability|skill)=([a-z]+)/i);
      const name = ability ? (ABILITY[ability[1].toLowerCase()] || ability[1]) : '';
      const noun = kind === 'save' || kind === 'concentration' ? 'save' : 'check';
      return [dc ? `DC ${dc[1]}` : '', name, noun].filter(Boolean).join(' ');
    }

    // /r, /roll, /damage, /heal: keep the formula, plus a damage type if given.
    const formula = args.replace(/\b\w+=[^\s]+/g, '').trim();
    const type = args.match(/type=([a-z]+)/i);
    return [formula, type ? type[1] : ''].filter(Boolean).join(' ');
  });
}

export function cleanEnrichers(html) {
  let text = String(html ?? '');
  text = replaceDocLinks(text);
  text = replaceReferences(text);
  text = replaceRolls(text);
  return text;
}

/* ── Sanitiser ─────────────────────────────────────────────────────── */

function sanitizeNode(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.nodeValue);
  if (node.nodeType !== 1) return null;

  const tag = node.tagName.toLowerCase();
  if (DROP_ENTIRELY.has(tag)) return null;

  const children = [];
  node.childNodes.forEach((child) => {
    const clean = sanitizeNode(child, doc);
    if (clean) children.push(clean);
  });

  // Not on the allowlist (<a>, <font>, unknown): keep the words, lose the tag.
  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = doc.createDocumentFragment();
    children.forEach((child) => fragment.appendChild(child));
    return fragment;
  }

  const element = doc.createElement(tag);
  if (tag === 'td' || tag === 'th') {
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (SPAN_ATTRS.has(name) && /^\d{1,3}$/.test(attr.value)) {
        element.setAttribute(name, attr.value);
      }
    }
  }
  children.forEach((child) => element.appendChild(child));
  return element;
}

export function sanitizeHtml(html) {
  const source = String(html ?? '');
  if (!source.trim()) return '';
  if (typeof DOMParser === 'undefined') return '';

  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const output = document.createDocumentFragment();
  parsed.body.childNodes.forEach((child) => {
    const clean = sanitizeNode(child, document);
    if (clean) output.appendChild(clean);
  });

  const holder = document.createElement('div');
  holder.appendChild(output);
  return holder.innerHTML;
}

/* The whole pipeline: enrichers resolved, then sanitised. */
export function richText(html) {
  return sanitizeHtml(cleanEnrichers(html));
}

/* Plain text version, for summaries and search. */
export function plainText(html) {
  return cleanEnrichers(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
