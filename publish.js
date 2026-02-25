#!/usr/bin/env node
/**
 * publish.js — Run this after dropping a new article into its folder.
 *
 * What it does:
 *   1. Scans all article folders for .md files with a `date:` field
 *   2. Finds the most recently dated one
 *   3. Overwrites home.md with that article's content + a "view original" link
 *   4. Regenerates Archive/index.md with every article listed newest → oldest
 *
 * Usage:
 *   node publish.js
 */

const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Folders to scan (scanned recursively)
const ARTICLE_FOLDERS = ['Articles', 'Class-Changes', 'House-Rules', 'Updates', 'Venturia'];

// Base URL prefix — wiki lives at /en/ with no extra subfolder
const WIKI_BASE = '/en';

const ROOT        = __dirname;
const HOME_PATH   = path.join(ROOT, 'home.md');
const ARCHIVE_DIR = path.join(ROOT, 'Archive');
const ARCHIVE_PATH = path.join(ARCHIVE_DIR, 'index.md');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Extract the raw frontmatter block and the body below it
function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { fm: {}, fmRaw: '', body: raw };
  const fmRaw = match[1];
  const body  = match[2].trimStart();
  const fm    = {};
  fmRaw.split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon === -1) return;
    const key = line.slice(0, colon).trim();
    // Grab everything after the first colon, strip surrounding quotes
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  });
  return { fm, fmRaw, body };
}

// Collect all .md files under a directory, recursively
function walkMd(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walkMd(full, results);
    } else if (name.endsWith('.md')) {
      results.push(full);
    }
  });
  return results;
}

// Build the wiki URL for a given file.
// URLs mirror the file path exactly: /en/Venturia/Locations/amaranth-theater
function wikiUrl(filePath) {
  const rel    = path.relative(ROOT, filePath);          // e.g. "Venturia/Locations/foo.md"
  const noExt  = rel.replace(/\.md$/, '');
  const urlStr = noExt.replace(/\\/g, '/');              // Windows-safe
  return `${WIKI_BASE}/${urlStr}`;
}

// Format a Date as "Month D, YYYY"
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── COLLECT ARTICLES ────────────────────────────────────────────────────────

function collectArticles() {
  const articles = [];

  ARTICLE_FOLDERS.forEach(topFolder => {
    const files = walkMd(path.join(ROOT, topFolder));
    files.forEach(filePath => {
      const raw          = fs.readFileSync(filePath, 'utf-8');
      const { fm, body } = splitFrontmatter(raw);

      // Only treat files with an explicit date: field as "published" articles
      const hasDate = Boolean(fm.date);
      const date    = hasDate
        ? new Date(fm.date)
        : new Date(fs.statSync(filePath).mtime); // fallback for archive listing

      articles.push({
        title:     fm.title || path.basename(filePath, '.md'),
        date,
        hasDate,                        // used to gate home-page eligibility
        description: fm.description || '',
        tags:      fm.tags || '',
        folder:    topFolder,
        filePath,
        url:       wikiUrl(filePath),
        body,
        fm,
        raw,
      });
    });
  });

  // Dated articles first (newest → oldest), then undated at the bottom
  return articles.sort((a, b) => {
    if (a.hasDate && !b.hasDate) return -1;
    if (!a.hasDate && b.hasDate) return 1;
    return b.date - a.date;
  });
}

// ─── UPDATE HOME.MD ──────────────────────────────────────────────────────────

function updateHome(article) {
  const now    = new Date().toISOString();

  const header = `<div style="text-align: center; padding: 3.5rem 2rem 2.75rem; margin-bottom: 2.5rem; border-bottom: 1px solid rgba(139,115,85,0.25);">

<img src="https://codex.valleyofshadows.wiki/images/vallombrosa-logo.png" alt="Valley of Shadows" style="width: 320px; max-width: 80%; display: block; margin: 0 auto 1.75rem; filter: drop-shadow(0 12px 40px rgba(0,0,0,0.9));">

<p style="font-family: Georgia, serif; font-style: italic; font-size: 1.1rem; color: rgba(212,165,116,0.8); letter-spacing: 0.05em; margin: 0 0 2.25rem 0;">Tales from Venturia &amp; Vallombrosa</p>

<div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139,115,85,0.4), transparent); margin: 0 auto 2.25rem; max-width: 400px;"></div>

<div style="display: flex; justify-content: center; gap: 2.5rem; flex-wrap: wrap;">
<a href="/en/Archive" style="font-size: 0.68rem; letter-spacing: 0.35em; text-transform: uppercase; color: #d4a574; text-decoration: none;">The Chronicle</a>
<a href="/en/Articles" style="font-size: 0.68rem; letter-spacing: 0.35em; text-transform: uppercase; color: #8b7355; text-decoration: none;">Articles</a>
<a href="/en/Updates" style="font-size: 0.68rem; letter-spacing: 0.35em; text-transform: uppercase; color: #8b7355; text-decoration: none;">Updates</a>
<a href="/en/Class-Changes" style="font-size: 0.68rem; letter-spacing: 0.35em; text-transform: uppercase; color: #8b7355; text-decoration: none;">Class Changes</a>
<a href="/en/House-Rules" style="font-size: 0.68rem; letter-spacing: 0.35em; text-transform: uppercase; color: #8b7355; text-decoration: none;">House Rules</a>
<a href="/en/Venturia" style="font-size: 0.68rem; letter-spacing: 0.35em; text-transform: uppercase; color: #8b7355; text-decoration: none;">Venturia</a>
</div>

</div>

---

`;

  const newContent = `---
title: ${article.fm.title || article.title}
description: ${article.description}
published: true
date: ${now}
tags: ${article.tags}
editor: markdown
dateCreated: ${now}
---

${header}${article.body}`;

  fs.writeFileSync(HOME_PATH, newContent, 'utf-8');
  console.log(`✓ home.md → "${article.title}"`);
}

// ─── UPDATE ARCHIVE ──────────────────────────────────────────────────────────

function updateArchive(articles) {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR);
    console.log('✓ Created Archive/ folder');
  }

  const now  = new Date().toISOString();
  const rows = articles
    .map(a => {
      const dateCol = a.hasDate ? fmtDate(a.date) : '*(undated)*';
      return `| ${dateCol} | [${a.title}](${a.url}) | ${a.folder} |`;
    })
    .join('\n');

  const content = `---
title: All Posts
description: Every article published, newest first.
published: true
date: ${now}
editor: markdown
dateCreated: ${now}
---

# All Posts

Everything published, newest to oldest. Undated articles are older content added before the date system was in place.

| Published | Title | Section |
|-----------|-------|---------|
${rows}
`;

  fs.writeFileSync(ARCHIVE_PATH, content, 'utf-8');
  console.log(`✓ Archive/index.md → ${articles.length} articles`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const articles = collectArticles();

if (articles.length === 0) {
  console.error('No articles found. Check that ARTICLE_FOLDERS paths are correct.');
  process.exit(1);
}

// Only dated articles are eligible to be the home page
const datedArticles = articles.filter(a => a.hasDate);

if (datedArticles.length === 0) {
  console.error('No articles with a `date:` field found. Add one to make a home page.');
  process.exit(1);
}

const newest = datedArticles[0];
console.log(`\nNewest article: "${newest.title}" (${fmtDate(newest.date)})\n`);

updateHome(newest);
updateArchive(articles);

// ─── GIT COMMIT & PUSH ───────────────────────────────────────────────────────

const git = cmd => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

console.log('');
git(`git add "${newest.filePath}" "${HOME_PATH}" "${ARCHIVE_PATH}"`);
git(`git commit -m "publish: ${newest.title}"`);
git('git push');

console.log('\nLive.');
