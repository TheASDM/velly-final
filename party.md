---
title: The Table
description: DM view of everyone's hit points, conditions and resources.
permalink: /party/
published: false
autoIndex: false
pageStyles:
  - /css/sheet.css
pageScripts:
  - /js/vos-party.js
---

<div class="vos-party-page">
  <nav class="vos-dm-satellites" aria-label="DM surfaces">
    <a href="/dm/">Console</a>
    <a href="/monsters/">Bench</a>
    <a href="/sheets/">Sheets</a>
    <a href="/dossiers/">Dossiers</a>
  </nav>
  <div class="vos-party-bar">
    <span class="vos-party-status" id="vos-party-status">Loading…</span>
    <button type="button" id="vos-party-refresh">Refresh</button>
    <button type="button" id="vos-party-pause" aria-pressed="false">Pause updates</button>
  </div>

  <div class="vos-party-grid" id="vos-party-root">
    <div class="empty-state"><b>Loading the table…</b>One moment.</div>
  </div>
</div>
