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
