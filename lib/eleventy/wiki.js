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

module.exports = { descendantTree, wikiBreadcrumbs, wikiParentCrumb };
