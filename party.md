---
title: The Table
description: The DM's workspace — running the session, preparing the next one, and everyone at it.
permalink: /party/
published: false
autoIndex: false
pageStyles:
  - /css/sheet.css
pageScripts:
  - /js/vos-party.js
templateEngineOverride: njk
---

{# The Table is the DM's centre of gravity and the middle of their tab bar.
   Before this it was one HP grid with a row of links pasted above it, and
   the actual tools — the console, the bench, the sheets, the dossiers —
   were rows in a profile menu. Five areas, all of them addressable. #}

<div class="vos-party-page" id="vos-table">

  <nav class="vos-table-areas" id="vos-table-areas" role="tablist" aria-label="The Table">
    <button class="vos-table-area" type="button" role="tab" data-table-area="run"
            id="vos-table-tab-run" aria-controls="vos-table-panel-run" aria-selected="true">Run</button>
    <button class="vos-table-area" type="button" role="tab" data-table-area="prepare"
            id="vos-table-tab-prepare" aria-controls="vos-table-panel-prepare" aria-selected="false">Prepare</button>
    <button class="vos-table-area" type="button" role="tab" data-table-area="players"
            id="vos-table-tab-players" aria-controls="vos-table-panel-players" aria-selected="false">Players</button>
    <button class="vos-table-area" type="button" role="tab" data-table-area="npcs"
            id="vos-table-tab-npcs" aria-controls="vos-table-panel-npcs" aria-selected="false">NPCs</button>
    <button class="vos-table-area" type="button" role="tab" data-table-area="review"
            id="vos-table-tab-review" aria-controls="vos-table-panel-review" aria-selected="false">
      Review<span class="vos-table-count" id="vos-table-review-count" hidden></span>
    </button>
  </nav>

  <!-- ── RUN ────────────────────────────────────────────────────────── -->
  <section class="vos-table-panel" id="vos-table-panel-run" role="tabpanel"
           aria-labelledby="vos-table-tab-run" data-table-panel="run">
    <div class="vos-party-bar">
      <span class="vos-party-status" id="vos-party-status">Loading…</span>
      <button type="button" id="vos-party-refresh">Refresh</button>
      <button type="button" id="vos-party-pause" aria-pressed="false">Pause updates</button>
    </div>

    <div class="vos-party-grid" id="vos-party-root">
      <div class="empty-state"><b>Loading the table…</b>One moment.</div>
    </div>

    <div class="vos-table-doors" aria-label="Live-session tools">
      <a class="vos-row-chip" href="/dm/?view=inplay">
        <span><span class="vos-row-chip-title">In Play</span><span class="vos-row-chip-meta">What the table is looking at right now</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=sounds">
        <span><span class="vos-row-chip-title">Sounds</span><span class="vos-row-chip-meta">Cues on everyone's device</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=handouts">
        <span><span class="vos-row-chip-title">Handouts</span><span class="vos-row-chip-meta">Hand something to one player or the whole table</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=npc">
        <span><span class="vos-row-chip-title">Quick NPC</span><span class="vos-row-chip-meta">A name and a face, in the middle of a scene</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
    </div>

    {# TODO(DESIGN-PROJECT): DM live-session Run controls

       Intended users: the DM, mid-session, one-handed.
       Entry point: this area — the party grid above is the live state today.
       Required data: /api/play/party (live, already here), /api/play/op for
         writes against a named character, and initiative/turn order, which
         nothing currently stores.
       Unresolved UX: whether initiative belongs here or on the sheet; how a
         DM applies damage to several characters at once; what "the table is
         paused" should mean to players' devices.
       Acceptance criteria for replacing this stub: the DM can take a turn
         through a full combat without leaving this panel, and every write is
         confirmed by the server before the display changes. #}
    <p class="vos-table-deferred">
      Initiative, group damage, and turn order are ready for their detailed
      workflow design. Live party state and the tools above are real; the
      combat surface will be completed as a separate design project.
    </p>
  </section>

  <!-- ── PREPARE ────────────────────────────────────────────────────── -->
  {# "Bench" survives as flavour on the stat-block row, where it means
     something. It was never a label anyone could decipher on its own. #}
  <section class="vos-table-panel" id="vos-table-panel-prepare" role="tabpanel"
           aria-labelledby="vos-table-tab-prepare" data-table-panel="prepare" hidden>
    <div class="vos-table-doors">
      <a class="vos-row-chip" href="/monsters/">
        <span><span class="vos-row-chip-title">Stat blocks</span><span class="vos-row-chip-meta">The bench — everything you might put in front of them</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=schedule">
        <span><span class="vos-row-chip-title">Schedule</span><span class="vos-row-chip-meta">Put the next session on the calendar</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=availability">
        <span><span class="vos-row-chip-title">Availability</span><span class="vos-row-chip-meta">Who can make which nights</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=rsvps">
        <span><span class="vos-row-chip-title">RSVPs</span><span class="vos-row-chip-meta">Who has answered for the next one</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/notes/">
        <span><span class="vos-row-chip-title">Notes</span><span class="vos-row-chip-meta">Scenes, threads, and anything you owe the table</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
    </div>
    <button class="vos-enzo-action" type="button"
            data-enzo-ask="Help me prepare the next session. What threads are open, and what did the party leave unfinished?">
      Help me prepare
    </button>
  </section>

  <!-- ── PLAYERS ────────────────────────────────────────────────────── -->
  <section class="vos-table-panel" id="vos-table-panel-players" role="tabpanel"
           aria-labelledby="vos-table-tab-players" data-table-panel="players" hidden>
    <div class="vos-table-doors">
      <a class="vos-row-chip" href="/sheets/">
        <span><span class="vos-row-chip-title">Character sheets</span><span class="vos-row-chip-meta">Read what they read, or the sheet behind it</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dossiers/">
        <span><span class="vos-row-chip-title">Character records</span><span class="vos-row-chip-meta">Every answer everyone wrote, searchable</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
    </div>

    {# Preview lives here because "open their seat" is a thing you do to a
       player, and this is where the players are. #}
    <h2 class="vos-table-heading">Preview as a player</h2>
    <p class="vos-table-lede">
      Open the app exactly as someone at the table sees it — their sheet, their
      hit points, their tab bar. Anything you change is theirs. Exit Preview,
      on the strip at the top of every page, brings you back here.
    </p>
    <div class="vos-table-roster" id="vos-table-roster" aria-label="Preview a player's app"></div>
  </section>

  <!-- ── NPCs ───────────────────────────────────────────────────────── -->
  <section class="vos-table-panel" id="vos-table-panel-npcs" role="tabpanel"
           aria-labelledby="vos-table-tab-npcs" data-table-panel="npcs" hidden>
    <div class="vos-table-doors">
      <a class="vos-row-chip" href="/en/Venturia/Characters/NPCs/">
        <span><span class="vos-row-chip-title">NPCs in the wiki</span><span class="vos-row-chip-meta">Everyone written down so far</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/en/Venturia/Factions/">
        <span><span class="vos-row-chip-title">Factions</span><span class="vos-row-chip-meta">Who wants what, and from whom</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/dm/?view=npc">
        <span><span class="vos-row-chip-title">Quick NPC</span><span class="vos-row-chip-meta">Invent one now, write them up later</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
    </div>

    {# TODO(DESIGN-PROJECT): NPC and faction dossiers

       Intended users: the DM only. Nothing in this area may become
         player-visible without an explicit publication step.
       Entry point: this area.
       Required data: an NPC dossier record — relationships, allegiances,
         what each PC knows about them, and current disposition. None of this
         exists. Today an NPC is a wiki page and /dossiers/ is the *players'*
         records, which is a different thing wearing a similar word.
       Unresolved UX: whether a dossier is authored here or generated from
         the wiki page; how "what the party knows" is recorded without the DM
         maintaining it by hand; how faction relationships are drawn.
       Acceptance criteria for replacing this stub: a DM can open one NPC and
         see their allegiances and each PC's knowledge of them; nothing here
         is reachable by a player token at any endpoint; and publishing a
         dossier to the wiki is a deliberate, separate action. #}
    <p class="vos-table-deferred">
      NPC and faction dossiers — relationships, allegiances, and what the
      party knows — are ready for their detailed workflow design. The wiki
      pages above are the real record today; the dossier surface will be
      completed as a separate design project.
    </p>
  </section>

  <!-- ── REVIEW ─────────────────────────────────────────────────────── -->
  <section class="vos-table-panel" id="vos-table-panel-review" role="tabpanel"
           aria-labelledby="vos-table-tab-review" data-table-panel="review" hidden>
    <ul class="vos-table-review-list" id="vos-table-review-list" hidden></ul>
    <div class="vos-table-empty" id="vos-table-review-empty" hidden>Nothing waiting on you.</div>

    <div class="vos-table-doors">
      <a class="vos-row-chip" href="/dm/?view=lore">
        <span><span class="vos-row-chip-title">Lore submissions</span><span class="vos-row-chip-meta">Read, edit, and publish what players wrote</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <a class="vos-row-chip" href="/studio/?tab=view&amp;gallery=all">
        <span><span class="vos-row-chip-title">Studio — all art</span><span class="vos-row-chip-meta">Everything anyone has made, shared or not</span></span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
    </div>

    {# TODO(DESIGN-PROJECT): Studio approval and request-changes workflow

       Intended users: the DM approving, rejecting, or asking for changes to
         player submissions; the player seeing what happened to theirs.
       Entry point: this area, and the Studio lightbox.
       Required data: the `status` column described in studio.md — nothing
         today distinguishes "not shared yet" from "submitted for review".
       Unresolved UX: what a rejection says to the player, whether a request
         for changes reopens their draft, and where the notification lands.
       Acceptance criteria for replacing this stub: the count on this tab is
         real submissions awaiting a decision; each has approve / request
         changes / archive; and every decision is written server-side before
         the UI reports it. #}
    <p class="vos-table-deferred">
      Approving art, requesting changes, and archiving are ready for their
      detailed workflow design. The lore queue above is live; the Studio
      review surface will be completed as a separate design project.
    </p>
  </section>
</div>
