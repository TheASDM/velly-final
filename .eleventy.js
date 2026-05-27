/**
 * Eleventy config for the Valley of Shadows codex.
 *
 * Reads markdown from the existing content folders (Venturia/, Articles/, etc.)
 * and produces a static site at _site/. Preserves the existing /en/... URL
 * convention so internal links keep working.
 */
const fs = require("fs");
const path = require("path");

// Tiny .env reader so templates can reference build-time vars (e.g.
// NEXT_SESSION_DATE) without pulling in dotenv as a dep. Silently no-ops
// when .env is missing — production builds set env vars directly.
(function loadDotEnv() {
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const raw of text.split("\n")) {
      const m = raw.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] !== undefined) continue; // existing env wins
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (e) { /* .env optional */ }
})();

// Format an ISO date string ("2026-06-07" or "2026-06-07T19:00") for the
// top-bar chip. Returns null when missing or already in the past.
function formatNextSession(iso) {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return null;
  // Consider sessions "past" once the session date has fully elapsed
  // (allow same-day display until midnight local time).
  const endOfDay = new Date(d); endOfDay.setHours(23, 59, 59, 999);
  if (endOfDay.getTime() < Date.now()) return null;

  const days   = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  let display = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  if (iso.length > 10) {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    display += ` · ${h}${m ? ":" + String(m).padStart(2, "0") : ""}${ampm}`;
  }
  return { iso, display };
}

module.exports = function (eleventyConfig) {
  // Expose next session date to all templates as `nextSession` (object
  // with { iso, display }) or `null` when unset/past.
  eleventyConfig.addGlobalData("nextSession", () =>
    formatNextSession(process.env.NEXT_SESSION_DATE)
  );


  // ── Static asset passthroughs ────────────────────────────────────────
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("files");
  eleventyConfig.addPassthroughCopy("manifest.webmanifest");
  eleventyConfig.addPassthroughCopy("sw.js");
  eleventyConfig.addPassthroughCopy("pwa-client.js");
  // Enzo widget assets — also live in public/ for the standalone /enzo PWA.
  // Mounted at /css and /js so the codex can load them locally for previews
  // without depending on a separate Enzo host.
  eleventyConfig.addPassthroughCopy({ "public/css/chatbot.css": "css/chatbot.css" });
  eleventyConfig.addPassthroughCopy({ "public/css/app-shell.css": "css/app-shell.css" });
  eleventyConfig.addPassthroughCopy({ "public/js/chatbot.js": "js/chatbot.js" });
  eleventyConfig.addPassthroughCopy({ "public/js/pwa-manager.js": "js/pwa-manager.js" });
  eleventyConfig.addPassthroughCopy({ "public/js/enzo-widget.js": "js/enzo-widget.js" });
  eleventyConfig.addPassthroughCopy({ "public/js/viewport-handler.js": "js/viewport-handler.js" });
  eleventyConfig.addPassthroughCopy({ "public/js/search-init.js": "js/search-init.js" });
  [
    "loremaster192x192.png",
    "loremaster5e192x192.png",
    "loremaster5eDM192x192.png",
    "loremasterDM192x192.png",
    "loremasterRocky192x192.png",
    "loremasterYasQueen192x192.png",
    "loremasterfabio192x192.png",
  ].forEach((file) => {
    eleventyConfig.addPassthroughCopy({ [`public/images/${file}`]: `images/${file}` });
  });

  // ── Layouts ──────────────────────────────────────────────────────────
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addLayoutAlias("home", "layouts/home.njk");

  // ── Frontmatter is YAML ──────────────────────────────────────────────
  // The existing frontmatter uses `title:`, `description:`, `published:`,
  // `tags:`, `date:`, etc. — Eleventy reads these natively.

  // ── Default `permalink`: prepend /en/ to every page URL so the existing
  //    internal /en/... links continue to resolve. Pages set
  //    `permalink: false` skip the build entirely.
  eleventyConfig.addGlobalData("layout", "page");

  // Compute /en/<path>/ URLs from file paths. home.md becomes /, indexes
  // become /en/<dir>/.
  eleventyConfig.addGlobalData("eleventyComputed", {
    permalink: (data) => {
      if (data.permalink === false || data.permalink === null) return false;
      if (data.permalink) return data.permalink;
      const stem = (data.page && data.page.filePathStem) || "";
      if (stem === "/home") return "/";
      if (stem.endsWith("/index")) {
        // /en/Venturia/Locations/index → /en/Venturia/Locations/
        return `/en${stem.slice(0, -"/index".length)}/`;
      }
      return `/en${stem}/`;
    },
  });

  // ── Filter: render markdown body to HTML inside templates ────────────
  const md = require("markdown-it")({ html: true, linkify: true, typographer: true });
  eleventyConfig.addFilter("md", (content) => md.render(content || ""));

  // ── Filter: resolve the active bottom-nav tab id from a URL.
  // Used by partials/app-bottom-nav.njk to highlight the current tab.
  // Reads navigation.tabs from _data/navigation.js. See the `match` field
  // there: "exact" compares hrefs literally; "wiki" matches anything under
  // /en/ that isn't another tab's exact href (covers all wiki pages).
  const navigationData = require("./_data/navigation.js");
  function resolveActiveTabId(currentUrl) {
    if (!currentUrl) return null;
    const exactHit = navigationData.tabs.find((tab) => tab.match === "exact" && tab.href === currentUrl);
    if (exactHit) return exactHit.id;
    const exactHrefs = new Set(navigationData.tabs.filter((tab) => tab.match === "exact").map((tab) => tab.href));
    if (currentUrl.startsWith("/en/") && !exactHrefs.has(currentUrl)) {
      const wikiTab = navigationData.tabs.find((tab) => tab.match === "wiki");
      if (wikiTab) return wikiTab.id;
    }
    return null;
  }
  eleventyConfig.addFilter("activeNavTab", resolveActiveTabId);

  // ── Filter: derive the app-bar { title, eyebrow } for a URL. Falls back
  // to the page's frontmatter title for non-tab pages, using "Wiki" as the
  // eyebrow for anything under /en/ so wiki pages get a consistent label.
  eleventyConfig.addFilter("appBarMeta", (currentUrl, fallbackTitle) => {
    const tab = navigationData.tabs.find((t) => t.href === currentUrl);
    if (tab) return { title: tab.title, eyebrow: tab.eyebrow };
    const eyebrow = currentUrl && currentUrl.startsWith("/en/") ? "Wiki" : "Vallombrosa";
    return { title: fallbackTitle || "Vallombrosa", eyebrow };
  });

  // ── Filter: derive the descendant tree of an index page from its URL.
  // Returns { direct: [...], subcategories: [{ key, title, url, pages }] }
  // — direct pages are the immediate children at this level, subcategories
  // are first-level subdirectories (with their own direct pages listed).
  const TITLE_FIXUPS = { dm: "DM", pcs: "PCs", npcs: "NPCs", vava: "VAVA", phb: "PHB" };
  const titleCaseSlug = (s) =>
    s
      .replace(/-/g, " ")
      .replace(/\b\w+\b/g, (w) => TITLE_FIXUPS[w.toLowerCase()] || w[0].toUpperCase() + w.slice(1));

  eleventyConfig.addFilter("wikiBreadcrumbs", (currentUrl, currentTitle) => {
    if (!currentUrl || typeof currentUrl !== "string") return [];
    if (!currentUrl.startsWith("/en/")) return [];

    const clean = currentUrl.replace(/\/$/, "");
    const parts = clean.replace(/^\/en\/?/, "").split("/").filter(Boolean);
    if (!parts.length) return [];

    const crumbs = [{ title: "Wiki", url: "/en/Venturia/" }];
    let build = "/en";
    let start = 0;

    // Venturia is the wiki home in the app, so avoid a redundant
    // Wiki > Venturia breadcrumb on every city page.
    if (parts[0] === "Venturia") {
      build = "/en/Venturia";
      start = 1;
      if (parts.length === 1) {
        crumbs[0] = { title: currentTitle || "Wiki", url: null };
        return crumbs;
      }
    }

    for (let i = start; i < parts.length; i++) {
      const part = parts[i];
      build += `/${part}`;
      const isLast = i === parts.length - 1;
      crumbs.push({
        title: isLast ? (currentTitle || titleCaseSlug(part)) : titleCaseSlug(part),
        url: isLast ? null : `${build}/`,
      });
    }

    return crumbs;
  });

  eleventyConfig.addFilter("wikiParentCrumb", (crumbs) => {
    if (!Array.isArray(crumbs) || crumbs.length < 2) return null;
    return crumbs[crumbs.length - 2];
  });

  eleventyConfig.addFilter("descendantTree", (allPages, currentUrl) => {
    if (!currentUrl) return { direct: [], subcategories: [] };
    let prefix = currentUrl;
    if (!prefix.endsWith("/")) prefix += "/";

    const direct = [];
    const subMap = {}; // key -> { key, pages, url, title }

    for (const p of allPages || []) {
      const u = p.url;
      if (!u || typeof u !== "string") continue;
      if (!u.startsWith(prefix) || u === prefix) continue;
      const rest = u.slice(prefix.length).replace(/\/$/, "");
      if (!rest) continue;
      const segments = rest.split("/");
      const title = (p.data && p.data.title) || titleCaseSlug(segments[segments.length - 1]);
      const description = (p.data && p.data.description) || "";

      if (segments.length === 1) {
        direct.push({ url: u, title, description, slug: segments[0] });
      } else {
        const key = segments[0];
        if (!subMap[key]) subMap[key] = { key, pages: [], url: null, title: null };
        if (segments.length === 2) {
          subMap[key].pages.push({ url: u, title, description });
        }
      }
    }

    // Pull any direct page whose slug matches a subcategory key (case-insensitive)
    // up into the subcategory header — e.g. Venturia/Creatures/celestials.md becomes
    // the title link for the Venturia/Creatures/Celestials/ subdirectory.
    const remainingDirect = [];
    for (const d of direct) {
      let matched = false;
      for (const key of Object.keys(subMap)) {
        if (d.slug.toLowerCase() === key.toLowerCase() && !subMap[key].url) {
          subMap[key].url = d.url;
          subMap[key].title = d.title;
          matched = true;
          break;
        }
      }
      if (!matched) remainingDirect.push(d);
    }

    const subcategories = Object.values(subMap)
      .map((s) => ({
        key: s.key,
        title: s.title || titleCaseSlug(s.key),
        url: s.url,
        pages: s.pages.sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return {
      direct: remainingDirect.sort((a, b) => a.title.localeCompare(b.title)),
      subcategories,
    };
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      layouts: "_includes",
      data: "_data",
    },
    // Whitelist directories that contain wiki content. Everything else
    // is ignored.
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
};
