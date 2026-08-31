---
title: Dossiers
description: DM reading view of every player character record.
permalink: /dossiers/
published: false
autoIndex: false
pageStyles:
  - /css/dossiers.css
pageScripts:
  - /js/vos-dossiers.js
---

<div class="vos-dossiers">
  <a class="vos-row-chip vos-back-to-table" href="/party/">
    <span><span class="vos-row-chip-title">The Table</span><span class="vos-row-chip-meta">Back to the workspace</span></span>
    <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
  </a>
  <h1>Dossiers</h1>
  <p class="vos-dossiers-lede">
    Every character record in one place — read a full dossier, put one question to
    the whole table, or search every answer at once.
  </p>

  <div class="vos-dossiers-toolbar" id="vos-dossiers-toolbar" hidden>
    <div class="vos-dossiers-search">
      <span class="glyph" aria-hidden="true">⌕</span>
      <input id="vos-dossiers-q" type="search" autocomplete="off"
             placeholder="Search every answer — a name, a place, a fragment"
             aria-label="Search every answer">
    </div>
    <label class="vos-dossiers-blanks">
      <input type="checkbox" id="vos-dossiers-blanks" checked> Show gaps
    </label>
  </div>

  <nav class="vos-dossiers-nav" id="vos-dossiers-nav" aria-label="Dossier views">
    <button class="nav-item" type="button" data-view="overview">
      <span class="nav-row"><span class="nav-name">All players</span></span>
      <span class="nav-role">overview</span>
    </button>
    <button class="nav-item" type="button" data-view="chorus">
      <span class="nav-row"><span class="nav-name">Cross-reference</span></span>
      <span class="nav-role">one question, every voice</span>
    </button>
    <span id="vos-dossiers-roster" style="display:contents"></span>
  </nav>

  <div class="vos-dossiers-root" id="vos-dossiers-root">
    <div class="empty-state"><b>Loading dossiers…</b>One moment.</div>
  </div>
</div>
