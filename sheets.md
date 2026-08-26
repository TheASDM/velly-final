---
title: Character Sheets
description: DM reading view of every character sheet.
permalink: /sheets/
published: false
autoIndex: false
pageStyles:
  - /css/sheet.css
pageScripts:
  - /js/vos-sheets.js
---

<div class="vos-sheet-page">
  <p class="vos-sheet-lede">
    Every character sheet in one place — read what the player reads, or flip to
    the sheet behind it.
  </p>

  <nav class="vos-sheets-nav" id="vos-sheets-roster" aria-label="Players"></nav>

  <div class="vos-sheets-toolbar" id="vos-sheets-toolbar" role="group" aria-label="Which sheet" hidden>
    <button type="button" data-variant="dm" aria-pressed="true">DM sheet</button>
    <button type="button" data-variant="player" aria-pressed="false">Player sheet</button>
    <button type="button" data-variant="statblock" aria-pressed="false">Stats</button>
  </div>

  <nav class="vos-sheet-index" id="vos-sheets-index" aria-label="Jump to a section" hidden></nav>

  <div class="vos-sheet-root" id="vos-sheets-root">
    <div class="empty-state"><b>Loading sheets…</b>One moment.</div>
  </div>
</div>
