---
title: Art Submissions
description: Review your generated Studio art with the original prompt, Enzo prompt, and saved image.
published: true
date: 2026-05-28T00:00:00.000Z
tags: tools, art, submissions
permalink: /art-submissions/
pageStyles:
  - /css/art-submissions.css
pageScripts:
  - /js/vos-art-submissions.js
---

<div class="vos-art-submissions">
  <header class="vos-art-submissions-head">
    <div>
      <div class="vos-art-submissions-kicker">Studio</div>
      <h1>Art Submissions</h1>
    </div>
    <div class="vos-art-submissions-actions">
      <a class="vos-art-submissions-action" href="/studio/">Studio</a>
      <button id="vos-art-submissions-refresh" class="vos-art-submissions-refresh" type="button" aria-label="Refresh art submissions" title="Refresh">↻</button>
    </div>
  </header>

  <div id="vos-art-submissions-status" class="vos-art-submissions-status" role="status" aria-live="polite"></div>
  <div id="vos-art-submissions-list" class="vos-art-submissions-list"></div>
</div>
