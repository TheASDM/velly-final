---
title: Submit Lore
description: Submit a player-suggested item, person, place, faction, or lore entry for DM review.
permalink: /submit-lore/
published: true
date: 2026-05-26T00:00:00.000Z
tags: tools, submissions, lore
editor: markdown
dateCreated: 2026-05-26T00:00:00.000Z
autoIndex: false
pageStyles:
  - /css/submit-lore.css
pageScripts:
  - /js/vos-submit-lore.js
---

<div class="vos-submit-lore">
  <header class="vos-submit-top">
    <div>
      <p class="vos-submit-kicker">Wiki Drafts</p>
      <h1>Submit Lore</h1>
    </div>
    <div class="vos-submit-identity-card">
      <button class="vos-button" id="vos-submit-login" type="button">Log In</button>
      <p id="vos-submit-identity" class="vos-submit-identity-text">Checking login...</p>
    </div>
  </header>

  <div class="vos-submit-layout">
    <section class="vos-submit-panel" aria-labelledby="vos-submit-form-title">
      <div class="vos-submit-panel-head">
        <h2 class="vos-submit-panel-title" id="vos-submit-form-title">New Entry</h2>
        <span class="vos-submit-panel-note">DM review required</span>
      </div>

      <form class="vos-submit-form" id="vos-submit-form">
        <select id="vos-submit-kind" class="vos-submit-kind-select" required tabindex="-1" aria-hidden="true">
          <option value="item">Item</option>
          <option value="person">Person</option>
          <option value="place">Place</option>
          <option value="faction">Faction</option>
          <option value="lore">Lore</option>
          <option value="culture">Culture</option>
        </select>

        <div class="vos-submit-type-grid" id="vos-submit-kind-picker" role="group" aria-label="Entry type">
          <button class="vos-submit-type is-active" type="button" data-kind="item"><strong>Item</strong><span>Objects, gear, relics</span></button>
          <button class="vos-submit-type" type="button" data-kind="person"><strong>Person</strong><span>NPCs and notable figures</span></button>
          <button class="vos-submit-type" type="button" data-kind="place"><strong>Place</strong><span>Locations and districts</span></button>
          <button class="vos-submit-type" type="button" data-kind="faction"><strong>Faction</strong><span>Guilds, crews, powers</span></button>
          <button class="vos-submit-type" type="button" data-kind="lore"><strong>Lore</strong><span>History, rumors, records</span></button>
          <button class="vos-submit-type" type="button" data-kind="culture"><strong>Culture</strong><span>Festivals, rites, customs</span></button>
        </div>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Title</span>
            <span class="vos-submit-count" data-count-for="vos-submit-entry-title">0 / 120</span>
          </span>
          <input id="vos-submit-entry-title" type="text" maxlength="120" placeholder="Kaligor, The Cask and Cube, Master Sarto..." required>
        </label>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Player-Facing Lore</span>
            <span class="vos-submit-count" data-count-for="vos-submit-description">0 / 2500</span>
          </span>
          <textarea id="vos-submit-description" maxlength="2500" data-autogrow placeholder="What should the table know? Include visible details, tone, rules hooks, and anything that should become public wiki canon." required></textarea>
        </label>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Connections</span>
            <span class="vos-submit-count" data-count-for="vos-submit-connections">Optional</span>
          </span>
          <textarea id="vos-submit-connections" data-autogrow placeholder="Owner: Lotan&#10;Near: The Tiered Gardens&#10;Opposes: The Fog Wardens"></textarea>
        </label>

        <label class="vos-submit-field">
          <span class="vos-submit-field-row">
            <span class="vos-submit-label">Notes For DM</span>
            <span class="vos-submit-count" data-count-for="vos-submit-notes">0 / 2000</span>
          </span>
          <textarea id="vos-submit-notes" maxlength="2000" data-autogrow placeholder="Optional: uncertainty, spoiler boundaries, private context, or what you want the DM to decide before publishing."></textarea>
        </label>

        <div class="vos-submit-actions">
          <button class="vos-submit-secondary" id="vos-submit-clear" type="button">Clear Draft</button>
          <button class="vos-button" id="vos-submit-send" type="submit">Submit Draft</button>
        </div>
        <div class="vos-submit-status" id="vos-submit-status" role="status" aria-live="polite"></div>
      </form>
    </section>

    <aside class="vos-submit-side" aria-label="Submission status">
      <section class="vos-submit-panel vos-submit-ready">
        <h2 class="vos-submit-panel-title">Ready Check</h2>
        <ul class="vos-submit-ready-list" id="vos-submit-ready-list">
          <li data-ready="identity">Signed in as a player</li>
          <li data-ready="title">Title is filled in</li>
          <li data-ready="description">Lore description has substance</li>
          <li data-ready="draft">Draft is saved locally</li>
        </ul>
        <p class="vos-submit-draft-note" id="vos-submit-draft-note">Draft autosave is active.</p>
      </section>
    </aside>
  </div>

  <section class="vos-submit-panel vos-submit-list-panel" aria-labelledby="vos-submit-mine-title">
    <div class="vos-submit-panel-head">
      <h2 class="vos-submit-panel-title" id="vos-submit-mine-title">My Submissions</h2>
      <button class="vos-submit-secondary" id="vos-submit-refresh" type="button">Refresh</button>
    </div>
    <div class="vos-submit-list" id="vos-submit-list"></div>
    <div class="vos-submit-status" id="vos-submit-list-status" role="status" aria-live="polite"></div>
  </section>
</div>
