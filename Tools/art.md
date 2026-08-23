---
title: Art Studio
description: Generate campaign art with Enzo. New art saves privately to its creator and the DM, then can be shared to the group gallery when ready.
published: true
date: 2026-05-24T00:00:00.000Z
tags: tools, art, gallery, enzo
editor: markdown
dateCreated: 2026-05-24T00:00:00.000Z
pageStyles:
  - /css/studio.css
pageScripts:
  - /js/vos-studio.js
---

<div class="vos-art">

<header class="vos-art-app-head">
  <div>
    <div class="vos-art-app-kicker">Tools</div>
    <h1>Studio</h1>
  </div>
  <div class="vos-art-app-actions">
    <a class="vos-art-anchor" href="/art-submissions/">Art Submissions</a>
    <a class="vos-art-anchor" href="#vos-art-gallery-section">Gallery</a>
  </div>
</header>

<div class="vos-art-workbench">

<section class="vos-art-studio" aria-label="Generate new art">
  <div class="vos-art-studio-title">Compose a New Piece</div>

  <div class="vos-art-field">
    <label class="vos-art-field-label" for="vos-art-prompt">Description</label>
    <details class="vos-art-references" id="vos-art-references">
      <summary>Available references — click to expand</summary>
      <div class="vos-art-references-body" id="vos-art-references-body">
        <div class="vos-art-references-cat" style="opacity: 0.6;">Loading references…</div>
      </div>
    </details>
    <textarea id="vos-art-prompt" class="vos-art-prompt" rows="4"
              placeholder="A masked masquerader on the bridge above the Echoing Court, autumn leaves on the canal, candlelight from the windows above…"
              maxlength="3000"></textarea>
  </div>

  <div class="vos-art-field">
    <label class="vos-art-field-label" for="vos-art-style-select">Style</label>
    <div class="vos-art-style-shell">
      <div class="vos-art-select-wrap">
        <select id="vos-art-style-select" class="vos-art-style-select" aria-describedby="vos-art-style-summary">
          <option value="">Loading styles...</option>
        </select>
      </div>
      <div id="vos-art-style-summary" class="vos-art-style-summary">Loading style notes...</div>
    </div>
  </div>

  <div class="vos-art-field">
    <label class="vos-art-enhance-toggle" for="vos-art-enhance">
      <input id="vos-art-enhance" type="checkbox" checked>
      <span class="vos-art-enhance-text">
        <strong>Let Enzo refine my prompt</strong>
        <em>Improves campaign references and image phrasing.</em>
      </span>
    </label>
  </div>

  <div class="vos-art-actions">
    <button id="vos-art-generate" class="vos-art-btn" type="button">Generate</button>
    <div id="vos-art-status" class="vos-art-status" role="status" aria-live="polite"></div>
  </div>

  <div id="vos-art-latest" class="vos-art-latest" aria-live="polite">
    <div class="vos-art-latest-frame">
      <img id="vos-art-latest-img" alt="">
      <div class="vos-art-latest-pending" id="vos-art-latest-pending">
        <div class="vos-art-latest-spinner" aria-hidden="true">✦</div>
        <div class="vos-art-latest-pending-prompt" id="vos-art-latest-pending-prompt"></div>
        <div class="vos-art-latest-pending-status" id="vos-art-latest-pending-status">Composing</div>
      </div>
    </div>
    <div id="vos-art-latest-caption" class="vos-art-latest-caption"></div>
    <details id="vos-art-latest-details" class="vos-art-details" style="display:none;">
      <summary>How Enzo saw it</summary>
      <div id="vos-art-latest-enhanced" class="vos-art-enhanced"></div>
    </details>
  </div>
</section>

</div>
<section class="vos-art-gallery-section" id="vos-art-gallery-section" aria-labelledby="vos-art-gallery-title">
  <div class="vos-art-gallery-head">
    <h2 id="vos-art-gallery-title">Studio Library</h2>
    <div class="vos-art-gallery-tools">
      <button id="vos-art-gallery-refresh" class="vos-art-refresh" type="button" aria-label="Refresh gallery" title="Refresh gallery">↻</button>
      <div class="vos-art-gallery-count" id="vos-art-gallery-count">Loading…</div>
    </div>
  </div>
  <div class="vos-art-gallery-tabs" id="vos-art-gallery-tabs" role="tablist" aria-label="Gallery views">
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="mine">My Studio</button>
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="shared">Group Gallery</button>
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="favorites">Favorites</button>
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="all" hidden>DM All</button>
  </div>
  <div class="vos-art-gallery-note" id="vos-art-gallery-note"></div>

  <div id="vos-art-gallery" class="vos-art-gallery"></div>
  <button id="vos-art-load-more" class="vos-art-load-more" type="button" hidden>Load more</button>
</section>

<div id="vos-art-lightbox" class="vos-art-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vos-art-lightbox-caption">
  <div class="vos-art-lightbox-inner">
    <div class="vos-art-lightbox-actions">
      <button class="vos-art-icon-btn" id="vos-art-lightbox-favorite" type="button" aria-label="Favorite this image" title="Favorite">♡</button>
      <button class="vos-art-icon-btn" id="vos-art-lightbox-share" type="button" aria-label="Share this image" title="Share">↗</button>
      <button class="vos-art-icon-btn" id="vos-art-lightbox-pin" type="button" aria-label="Pin this image to a wiki page" title="Pin to wiki">📌</button>
    </div>
    <div class="vos-art-pin-menu" id="vos-art-pin-menu" hidden role="menu" aria-label="Pin to wiki page"></div>
    <button class="vos-art-lightbox-delete" id="vos-art-lightbox-delete" type="button" aria-label="Delete this image (DM)" title="Delete this image">×</button>
    <button class="vos-art-lightbox-close" type="button" aria-label="Close lightbox">×</button>
    <img id="vos-art-lightbox-img" alt="">
    <div id="vos-art-lightbox-caption" class="vos-art-lightbox-caption"></div>
  </div>
</div>

</div>
