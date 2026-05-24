/**
 * Eleventy config for the Valley of Shadows codex.
 *
 * Reads markdown from the existing content folders (Venturia/, Articles/, etc.)
 * and produces a static site at _site/. Preserves the existing /en/... URL
 * convention so internal links keep working.
 */
module.exports = function (eleventyConfig) {
  // ── Static asset passthroughs ────────────────────────────────────────
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("files");
  // Enzo widget assets — also live in public/ for the standalone /enzo PWA.
  // Mounted at /css and /js so the codex can load them locally for previews
  // without depending on the remote loremaster.valleyofshadows.wiki host.
  eleventyConfig.addPassthroughCopy({ "public/css/chatbot.css": "css/chatbot.css" });
  eleventyConfig.addPassthroughCopy({ "public/js/chatbot.js": "js/chatbot.js" });

  // ── Layouts ──────────────────────────────────────────────────────────
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addLayoutAlias("home", "layouts/home.njk");

  // ── Frontmatter is YAML (Wiki.js dialect) ────────────────────────────
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

  // ── Filter: derive the descendant tree of an index page from its URL.
  // Returns { direct: [...], subcategories: [{ key, title, url, pages }] }
  // — direct pages are the immediate children at this level, subcategories
  // are first-level subdirectories (with their own direct pages listed).
  const TITLE_FIXUPS = { dm: "DM", pcs: "PCs", npcs: "NPCs", vava: "VAVA", phb: "PHB" };
  const titleCaseSlug = (s) =>
    s
      .replace(/-/g, " ")
      .replace(/\b\w+\b/g, (w) => TITLE_FIXUPS[w.toLowerCase()] || w[0].toUpperCase() + w.slice(1));

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
