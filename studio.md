---
title: Studio
description: View and create campaign artwork, portraits, handouts, and lore.
permalink: /studio/
published: false
autoIndex: false
pageStyles:
  - /css/studio.css
pageScripts:
  - /js/vos-studio.js
---

{# Studio holds the fifth door in the tab bar for both roles. Enzo used to
   stand here; he is offered inside the work now instead of being a place you
   leave the work to visit.

   Two modes and no more: what already exists, and what you are making. The
   old split — a Studio page, an Art Submissions page, and a gallery anchor
   halfway down a wiki route — was three addresses for one room. #}

<div class="vos-art vos-studio">

<div class="vos-studio-modes" id="vos-studio-modes" role="tablist" aria-label="Studio mode">
  <button class="vos-studio-mode" type="button" role="tab" data-studio-mode="view"
          id="vos-studio-tab-view" aria-controls="vos-studio-panel-view" aria-selected="true">View</button>
  <button class="vos-studio-mode" type="button" role="tab" data-studio-mode="create"
          id="vos-studio-tab-create" aria-controls="vos-studio-panel-create" aria-selected="false">Create</button>
</div>

<!-- ── VIEW ─────────────────────────────────────────────────────────── -->
<section class="vos-studio-panel" id="vos-studio-panel-view" role="tabpanel"
         aria-labelledby="vos-studio-tab-view" data-studio-panel="view">

  <div class="vos-art-gallery-section" id="vos-art-gallery-section">
    <div class="vos-art-gallery-head">
      <h2 id="vos-art-gallery-title">Studio Library</h2>
      <div class="vos-art-gallery-tools">
        <button id="vos-art-gallery-refresh" class="vos-art-refresh" type="button" aria-label="Refresh gallery" title="Refresh gallery">↻</button>
        <div class="vos-art-gallery-count" id="vos-art-gallery-count">Loading…</div>
      </div>
    </div>
    {# Chips wrap rather than side-scroll; a rail you have to drag hides the
       filter you were looking for. #}
    <div class="vos-art-gallery-tabs" id="vos-art-gallery-tabs" role="tablist" aria-label="Library filters">
      <button class="vos-art-gallery-tab" type="button" data-gallery-scope="shared">Campaign</button>
      <button class="vos-art-gallery-tab" type="button" data-gallery-scope="mine">My Submissions</button>
      <button class="vos-art-gallery-tab" type="button" data-gallery-scope="favorites">Favorites</button>
      <button class="vos-art-gallery-tab" type="button" data-gallery-scope="all" hidden>All — DM</button>
    </div>
    <div class="vos-art-gallery-note" id="vos-art-gallery-note"></div>

    <div id="vos-art-gallery" class="vos-art-gallery"></div>
    <button id="vos-art-load-more" class="vos-art-load-more" type="button" hidden>Load more</button>

    {# TODO(DESIGN-PROJECT): Studio asset management and approval workflow

       Intended users: players see their own work and published campaign art;
         the DM additionally sees pending, DM-only, and archived assets.
       Entry point: this filter row.
       Required data: a `status` column on gallery entries
         (draft | pending | approved | rejected | archived) and a `visibility`
         column (dm_only | specific_players | party), both enforced in
         chatbot/vos/routes/gallery.py:_gallery_can_view() rather than in the
         client. Neither exists yet — today an entry is only shared or private.
       Unresolved UX: what "Request changes" says back to the player, whether
         rejection is visible to them at all, how session and character
         groupings are assigned, and where approval notifications land.
       Acceptance criteria for replacing this stub: the filters below read real
         status values; a player can never retrieve an unapproved entry that is
         not their own through /api/gallery at any scope; the DM can move an
         entry between states from the lightbox; and every state change is
         written server-side before the UI reports success.

       Deliberately NOT stubbed as visible controls: the filters above are the
       four scopes the server actually implements today. Adding Pending Review
       or Archived chips now would be dead controls over columns that do not
       exist, and labelling an unshared piece "Pending DM approval" would claim
       a review step nothing performs. #}
    <p class="vos-studio-deferred">
      Session, character, and review filters are ready for their detailed
      workflow design. The library, permissions, and sharing below are live;
      approval and archiving will be completed as a separate design project.
    </p>
  </div>
</section>

<!-- ── CREATE ───────────────────────────────────────────────────────── -->
<section class="vos-studio-panel" id="vos-studio-panel-create" role="tabpanel"
         aria-labelledby="vos-studio-tab-create" data-studio-panel="create" hidden>

  {# Art or Lore. Lore already has a whole pipeline behind /submit-lore/ —
     drafting, DM review, publication — so this offers the door rather than
     building a second one that would drift out of step with the first. #}
  <div class="vos-studio-kinds" role="group" aria-label="What are you making?">
    <button class="vos-studio-kind is-active" type="button" data-studio-kind="art" aria-pressed="true">Art</button>
    <a class="vos-studio-kind" href="/submit-lore/">Lore</a>
  </div>

  <div class="vos-art-workbench">
    <div class="vos-art-studio" aria-label="Generate new art">
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
            <strong>Refine with Enzo</strong>
            <em>He improves campaign references and image phrasing before it is drawn.</em>
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
    </div>
  </div>

  {# TODO(DESIGN-PROJECT): Studio create — visibility assignment and job history

     Intended users: the DM choosing DM Only / Specific Players / Entire Party /
       Publish Later before a piece is saved; both roles recovering a failed or
       abandoned generation.
     Entry point: this panel, at save time.
     Required data: the `visibility` column described in the View stub, a
       per-player grant table for "Specific Players", and durable job records
       beyond the single active job id currently kept in localStorage
       (velly.artStudio.activeJobId).
     Unresolved UX: whether a visibility choice blocks the Generate button or is
       asked afterwards; how "Publish Later" surfaces again; what a failed job
       offers besides a retry.
     Acceptance criteria for replacing this stub: a DM-created piece cannot
       reach a player before its visibility is chosen and stored server-side; a
       failed job is visible and retryable after a reload; nothing here reports
       success before the server has written it. #}
  <p class="vos-studio-deferred">
    New pieces save privately to you and the DM. Choosing who a piece is for —
    and recovering a generation that failed — is ready for its detailed
    workflow design and will be completed as a separate design project.
  </p>
</section>

<div id="vos-art-lightbox" class="vos-art-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vos-art-lightbox-caption">
  <div class="vos-art-lightbox-inner">
    <div class="vos-art-lightbox-actions">
      <button class="vos-art-icon-btn" id="vos-art-lightbox-favorite" type="button" aria-label="Favorite this image" title="Favorite">♡</button>
      <button class="vos-art-icon-btn" id="vos-art-lightbox-share" type="button" aria-label="Export this image" title="Export image">↗</button>
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
