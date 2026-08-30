/**
 * Eleventy config for the Valley of Shadows codex.
 *
 * Reads markdown from the existing content folders (Venturia/, Articles/, etc.)
 * and produces a static site at _site/. Preserves the existing /en/... URL
 * convention so internal links keep working.
 */
const fs = require("fs");
const path = require("path");
const navigationData = require("./_data/navigation.js");
const { appBarMeta, resolveActiveTabId, wikiPagesJson } = require("./lib/eleventy/navigation.js");
const { formatNextSession } = require("./lib/eleventy/session.js");
const {
  descendantTree, wikiBreadcrumbs, wikiParentCrumb, wikiSections,
  wikiRecent, wikiTags, relatedPages, tagSlug,
} = require("./lib/eleventy/wiki.js");

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

module.exports = function (eleventyConfig) {
  // Expose next session date to all templates as `nextSession` (object
  // with { iso, display }) or `null` when unset/past.
  eleventyConfig.addGlobalData("nextSession", () =>
    formatNextSession(process.env.NEXT_SESSION_DATE)
  );


  // ── Static asset passthroughs ────────────────────────────────────────
  eleventyConfig.addPassthroughCopy("images");
  // Only the assets actually linked from published pages. `files/` doubles as a
  // working scratch tree (DM notes, exports), and passthrough copy is NOT
  // subject to .eleventyignore — copying the whole directory publishes whatever
  // happens to be sitting in it.
  eleventyConfig.addPassthroughCopy("files/ValleyofShadowsFramework.pdf");
  eleventyConfig.addPassthroughCopy("manifest.webmanifest");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sw.js");
  // Enzo widget assets — also live in public/ for the standalone /enzo PWA.
  // Mounted at /css and /js so the codex can load them locally for previews
  // without depending on a separate Enzo host.
  eleventyConfig.addPassthroughCopy({ "public/css": "css" });
  eleventyConfig.addPassthroughCopy({ "public/js": "js" });
  // Reference data the playable sheet fetches at runtime (conditions, spell
  // lists). Built by scripts/build_play_data.py.
  eleventyConfig.addPassthroughCopy({ "public/data": "data" });
  // _data/questionnaire.json is deliberately NOT passed through: it carries
  // every character's secret Part II prompts and on-file vitals. Clients get
  // it from the authenticated /api/questionnaire/definitions endpoint, scoped
  // to the caller. Templates can still read it as `questionnaire` via _data.
  // Player roster — also lives in _data/players.json so templates can read
  // it as `players`. Passed through so the PWA client can fetch it at
  // /data/players.json (used as a fallback when /api/auth/config is down).
  eleventyConfig.addPassthroughCopy({ "_data/players.json": "data/players.json" });
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
      // Safety: any page under Venturia/DM/ that's been marked published
      // is almost certainly a typo — fail the build loudly so the typo
      // doesn't ship a DM-only page to players.
      if (stem.includes("/Venturia/DM/") && data.published === true) {
        throw new Error(
          `DM page ${stem} has 'published: true' — set it to false ` +
          `(or delete the field) before building.`
        );
      }
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

  eleventyConfig.addFilter("activeNavTab", (url) => resolveActiveTabId(navigationData, url));

  // ── Filter: emit the wiki-pages index as JSON for the dm.md In Play
  // editor's autocomplete. Includes title, url, and a derived "kind"
  // string from the page's directory (PC/NPC/Location/Item/etc.).
  eleventyConfig.addFilter("wikiPagesJson", wikiPagesJson);

  // ── Collection: the 5 most recent player-facing published pages.
  // Used by home.md to surface a news feed. Requires explicit
  // `published: true` so authors opt in (most wiki entries already do).
  eleventyConfig.addCollection("news", (collectionApi) => {
    return collectionApi.getAll()
      .filter((p) => p.data && p.data.published === true)
      .filter((p) => p.url && p.url.startsWith("/en/"))
      .filter((p) => !(p.url || "").startsWith("/en/Venturia/DM/"))
      .filter((p) => p.data && p.data.date && p.data.title)
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date))
      .slice(0, 5);
  });

  eleventyConfig.addFilter("appBarMeta", (url, title) => appBarMeta(navigationData, url, title));

  eleventyConfig.addFilter("wikiBreadcrumbs", wikiBreadcrumbs);
  eleventyConfig.addFilter("wikiParentCrumb", wikiParentCrumb);
  eleventyConfig.addFilter("descendantTree", descendantTree);

  /* Strip HTML comments from every page before it ships.
   *
   * Several wiki pages carry authorial notes that say "not rendered" — true of
   * the screen, false of the source. Lorenzo's page shipped a comment naming
   * the bargain, the crime, the Keeper and Tartuzi; Isabella's named her tie to
   * Celina Cross. View Source is not a privileged tool, and a note that
   * describes the secret it is protecting is worse in the markup than the
   * secret would have been in the prose.
   *
   * Done at the transform rather than by editing the notes away: the notes are
   * useful to whoever edits the page, and the next one written should be safe
   * without anyone having to remember this. Conditional comments are left
   * alone — they are markup, not prose.
   */
  eleventyConfig.addTransform("stripHtmlComments", function (content) {
    if (!String(this.page?.outputPath || "").endsWith(".html")) return content;
    return content.replace(/<!--(?!\[if|<!)([\s\S]*?)-->/g, "");
  });
  eleventyConfig.addFilter("wikiSections", wikiSections);
  eleventyConfig.addFilter("wikiRecent", wikiRecent);
  eleventyConfig.addFilter("wikiTags", wikiTags);
  eleventyConfig.addFilter("relatedPages", relatedPages);
  eleventyConfig.addFilter("tagSlug", tagSlug);
  /* Dates in listings, in the campaign's own register: "26 Aug 2026". */
  eleventyConfig.addFilter("date", (value) => {
    const when = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(when.getTime())) return "";
    return when.toLocaleDateString("en-GB",
      { day: "numeric", month: "short", year: "numeric" });
  });
  eleventyConfig.addCollection("wikiTagList", (api) => wikiTags(api.getAll()));

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
