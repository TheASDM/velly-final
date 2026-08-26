const TITLE_FIXUPS = { dm: "DM", pcs: "PCs", npcs: "NPCs", vava: "VAVA", phb: "PHB" };

const titleCaseSlug = (slug) =>
  slug
    .replace(/-/g, " ")
    .replace(/\b\w+\b/g, (word) =>
      TITLE_FIXUPS[word.toLowerCase()] || word[0].toUpperCase() + word.slice(1),
    );

function wikiBreadcrumbs(currentUrl, currentTitle) {
  if (!currentUrl || typeof currentUrl !== "string" || !currentUrl.startsWith("/en/")) {
    return [];
  }
  const clean = currentUrl.replace(/\/$/, "");
  const parts = clean.replace(/^\/en\/?/, "").split("/").filter(Boolean);
  if (!parts.length) return [];

  const crumbs = [{ title: "Wiki", url: "/en/Venturia/" }];
  let build = "/en";
  let start = 0;
  if (parts[0] === "Venturia") {
    build = "/en/Venturia";
    start = 1;
    if (parts.length === 1) {
      crumbs[0] = { title: currentTitle || "Wiki", url: null };
      return crumbs;
    }
  }

  for (let index = start; index < parts.length; index += 1) {
    const part = parts[index];
    build += `/${part}`;
    const isLast = index === parts.length - 1;
    crumbs.push({
      title: isLast ? currentTitle || titleCaseSlug(part) : titleCaseSlug(part),
      url: isLast ? null : `${build}/`,
    });
  }
  return crumbs;
}

function wikiParentCrumb(crumbs) {
  if (!Array.isArray(crumbs) || crumbs.length < 2) return null;
  return crumbs[crumbs.length - 2];
}

function descendantTree(allPages, currentUrl) {
  if (!currentUrl) return { direct: [], subcategories: [] };
  let prefix = currentUrl;
  if (!prefix.endsWith("/")) prefix += "/";
  const direct = [];
  const subMap = {};

  for (const page of allPages || []) {
    const url = page.url;
    if (!url || typeof url !== "string" || !url.startsWith(prefix) || url === prefix) continue;
    const rest = url.slice(prefix.length).replace(/\/$/, "");
    if (!rest) continue;
    const segments = rest.split("/");
    const title = (page.data && page.data.title) || titleCaseSlug(segments.at(-1));
    const description = (page.data && page.data.description) || "";
    if (segments.length === 1) {
      direct.push({ url, title, description, slug: segments[0] });
    } else if (segments.length === 2) {
      const key = segments[0];
      if (!subMap[key]) subMap[key] = { key, pages: [], url: null, title: null };
      subMap[key].pages.push({ url, title, description });
    }
  }

  const remainingDirect = [];
  for (const item of direct) {
    const key = Object.keys(subMap).find(
      (candidate) => item.slug.toLowerCase() === candidate.toLowerCase() && !subMap[candidate].url,
    );
    if (key) {
      subMap[key].url = item.url;
      subMap[key].title = item.title;
    } else {
      remainingDirect.push(item);
    }
  }
  const subcategories = Object.values(subMap)
    .map((subcategory) => ({
      key: subcategory.key,
      title: subcategory.title || titleCaseSlug(subcategory.key),
      url: subcategory.url,
      pages: subcategory.pages.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return {
    direct: remainingDirect.sort((a, b) => a.title.localeCompare(b.title)),
    subcategories,
  };
}

/* Every browsable section of the wiki, discovered rather than listed.
 *
 * The hub used to name its sections by hand. That is fine on the day it is
 * written and wrong from the next page onward: Creatures grew to sixty-two
 * pages across four folders without ever being linked from the front door,
 * because nothing connected "a section exists" to "the hub mentions it".
 *
 * Deriving the list from the pages themselves makes an unlinked section
 * impossible instead of merely detectable. `SECTION_BLURBS` still lets each
 * one carry a hand-written line, because the blurb is editorial and the
 * inventory is not.
 */
const SECTION_ORDER = [
  "/en/Venturia/Characters/",
  "/en/Venturia/Locations/",
  "/en/Venturia/Factions/",
  "/en/Venturia/Creatures/",
  "/en/Venturia/Culture/",
  "/en/Venturia/Lore/",
  "/en/Venturia/Items/",
  "/en/Venturia/Maps/",
  "/en/Venturia/Government/",
  "/en/Session-Chronicles/",
  "/en/Articles/",
  "/en/House-Rules/",
  "/en/Class-Changes/",
  "/en/Updates/",
];

// Never surfaced to players. DM/ is unpublished; the hub itself is not a
// section of itself.
const SECTION_EXCLUDE = [
  /^\/en\/Venturia\/DM\//,     // unpublished by design
  /^\/en\/Tools\//,             // the Studio is a root tab, not an article
  /^\/en\/tags\//,              // a way through the wiki, not a part of it
  /^\/en\/Archive\//,
];

function sectionKeyFor(url) {
  // "/en/Venturia/Locations/burnt-quill/" -> "/en/Venturia/Locations/"
  //           "/en/Articles/using-enzo/" -> "/en/Articles/"
  const parts = url.split("/").filter(Boolean);       // ["en","Venturia","Locations",...]
  if (parts[0] !== "en" || parts.length < 2) return null;
  const depth = parts[1] === "Venturia" ? 3 : 2;
  if (parts.length < depth) return null;
  return "/" + parts.slice(0, depth).join("/") + "/";
}

function wikiSections(allPages) {
  const found = new Map();

  for (const page of allPages || []) {
    const url = page.url;
    if (!url || typeof url !== "string" || !url.startsWith("/en/")) continue;
    if (SECTION_EXCLUDE.some((pattern) => pattern.test(url))) continue;
    if ((page.data || {}).published === false) continue;

    const key = sectionKeyFor(url);
    if (!key) continue;

    if (!found.has(key)) found.set(key, { url: key, title: null, count: 0 });
    const section = found.get(key);

    // The section's own index page names it; everything else is counted.
    if (url === key) section.title = (page.data || {}).title || null;
    else section.count += 1;
  }

  for (const [key, section] of found) {
    if (!section.title) section.title = titleCaseSlug(key.split("/").filter(Boolean).at(-1));
  }

  // Known sections first, in a considered order; anything new appears at the
  // end rather than not at all.
  return [...found.values()]
    .filter((section) => section.count > 0)
    .sort((a, b) => {
      const ia = SECTION_ORDER.indexOf(a.url);
      const ib = SECTION_ORDER.indexOf(b.url);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.title.localeCompare(b.title);
    });
}

/* ── Findability past the tree ──────────────────────────────────────── */

/* A hierarchy is one way in. These are the others: what changed lately, what
 * shares a subject with what you are reading, and what a tag actually collects.
 * The tags already existed in frontmatter on nearly every page, doing nothing
 * but sitting there. */

const WIKI_PREFIX = "/en/";
const NOT_BROWSABLE = [/^\/en\/Venturia\/DM\//, /^\/en\/Tools\//];

function isBrowsable(page) {
  const url = page && page.url;
  if (!url || typeof url !== "string" || !url.startsWith(WIKI_PREFIX)) return false;
  if ((page.data || {}).published === false) return false;
  if (NOT_BROWSABLE.some((pattern) => pattern.test(url))) return false;
  return !url.endsWith("/index/") && url !== WIKI_PREFIX;
}

function pageTags(page) {
  const raw = (page.data || {}).tags;
  const list = Array.isArray(raw) ? raw : String(raw || "").split(",");
  return list
    .map((tag) => String(tag).trim().toLowerCase())
    .filter((tag) => tag && !["index", "navigation", "stat-block"].includes(tag));
}

function tagSlug(tag) {
  return String(tag).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* Newest first. `date` is Eleventy's, which falls back to file mtime, so a page
 * that never set one still sorts sensibly instead of vanishing. */
function wikiRecent(allPages, limit) {
  return (allPages || [])
    .filter(isBrowsable)
    .filter((page) => !String(page.filePathStem || "").endsWith("/index"))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, Number(limit) || 12)
    .map((page) => ({
      url: page.url,
      title: (page.data || {}).title || page.fileSlug,
      description: (page.data || {}).description || "",
      date: page.date,
      section: (page.url.split("/").filter(Boolean)[1] || "").replace(/-/g, " "),
    }));
}

/* Every tag, with the pages under it. Tags used once are dropped: a tag that
 * collects one page is a label, not a route. */
function wikiTags(allPages, minimum) {
  const floor = Number(minimum) || 2;
  const map = new Map();

  for (const page of (allPages || []).filter(isBrowsable)) {
    for (const tag of pageTags(page)) {
      if (!map.has(tag)) map.set(tag, { tag, slug: tagSlug(tag), pages: [] });
      map.get(tag).pages.push({
        url: page.url,
        title: (page.data || {}).title || page.fileSlug,
        description: (page.data || {}).description || "",
      });
    }
  }

  return [...map.values()]
    .filter((entry) => entry.pages.length >= floor)
    .map((entry) => ({
      ...entry,
      count: entry.pages.length,
      pages: entry.pages.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* Pages sharing the most tags with this one. Ranked by overlap so the top
 * result is the closest relation rather than the first one found. */
function relatedPages(allPages, currentUrl, limit) {
  const pages = (allPages || []).filter(isBrowsable);
  const current = pages.find((page) => page.url === currentUrl);
  if (!current) return [];

  const mine = new Set(pageTags(current));
  if (!mine.size) return [];

  return pages
    .filter((page) => page.url !== currentUrl)
    .map((page) => {
      const shared = pageTags(page).filter((tag) => mine.has(tag));
      return { page, shared: shared.length };
    })
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared
      || String((a.page.data || {}).title || "").localeCompare(String((b.page.data || {}).title || "")))
    .slice(0, Number(limit) || 6)
    .map((entry) => ({
      url: entry.page.url,
      title: (entry.page.data || {}).title || entry.page.fileSlug,
      description: (entry.page.data || {}).description || "",
      shared: entry.shared,
    }));
}

module.exports = {
  descendantTree, wikiBreadcrumbs, wikiParentCrumb, wikiSections,
  wikiRecent, wikiTags, relatedPages, tagSlug,
};
