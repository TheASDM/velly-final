---
title: DM
description: DM tools for Vallombrosa.
permalink: /dm/
pageStyles:
  - /css/dm.css
---

<script src="https://accounts.google.com/gsi/client" async defer></script>

<div class="vos-dm">
  <h1>DM</h1>

  <section class="vos-dm-panel vos-dm-auth-panel" aria-labelledby="vos-dm-auth-title">
    <h2 id="vos-dm-auth-title">Sign in</h2>
    <div class="vos-dm-auth-signed-out" id="vos-dm-auth-signed-out" hidden>
      <p class="vos-dm-helper">Sign in with the DM Google account to manage submissions, RSVPs, and pushes.</p>
      <div id="vos-dm-google-button" class="vos-dm-google-button"></div>
      <div class="vos-dm-status" id="vos-dm-auth-status" role="status" aria-live="polite"></div>
    </div>
    <div class="vos-dm-auth-signed-in" id="vos-dm-auth-signed-in" hidden>
      <div class="vos-dm-auth-meta">
        Signed in as <strong id="vos-dm-auth-email"></strong>
      </div>
      <button type="button" class="vos-dm-button" id="vos-dm-sign-out">Sign out</button>
    </div>
    <div class="vos-dm-auth-blocked" id="vos-dm-auth-blocked" hidden>
      <p class="vos-dm-helper">Sign in through the site menu with the DM Discord account, then return here.</p>
      <div class="vos-dm-actions">
        <a class="vos-dm-button" id="vos-dm-site-login" href="/api/auth/oauth/discord/start?next=/dm/">Sign in with Discord</a>
      </div>
    </div>
  </section>


  <nav class="vos-seg vos-seg--index" data-vos-tabs role="tablist" aria-label="DM tools">
    <button class="vos-seg-btn" type="button" data-view="schedule">Schedule</button>
    <button class="vos-seg-btn" type="button" data-view="availability">Availability</button>
    <button class="vos-seg-btn" type="button" data-view="rsvps">RSVPs</button>
    <button class="vos-seg-btn" type="button" data-view="message">Message</button>
    <button class="vos-seg-btn" type="button" data-view="history">History</button>
    <button class="vos-seg-btn" type="button" data-view="push">Push</button>
    <button class="vos-seg-btn" type="button" data-view="wiki">Wiki</button>
    <button class="vos-seg-btn" type="button" data-view="lore">Lore</button>
    <button class="vos-seg-btn" type="button" data-view="records">Records</button>
    <button class="vos-seg-btn" type="button" data-view="rumors">Rumors</button>
    <button class="vos-seg-btn" type="button" data-view="npc">Quick NPC</button>
    <button class="vos-seg-btn" type="button" data-view="inplay">In Play</button>
  </nav>

  <div class="vos-dm-view" data-vos-view="schedule">

  <section class="vos-dm-panel" aria-labelledby="vos-dm-cal-title-h">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-cal-title-h">Schedule Event</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-cal-refresh" type="button">Refresh</button>
      </div>
    </div>
    <form class="vos-dm-form" id="vos-dm-cal-form">
      <label>
        Date
        <input id="vos-dm-cal-date" type="date" required>
      </label>
      <label>
        Title
        <input id="vos-dm-cal-title" type="text" placeholder="Session — The Cask and Cube" required>
      </label>
      <label>
        Time
        <input id="vos-dm-cal-time" type="text" placeholder="Evening, 6pm">
      </label>
      <label>
        Location
        <input id="vos-dm-cal-location" type="text" placeholder="">
      </label>
      <label>
        Notes
        <textarea id="vos-dm-cal-notes" placeholder="Shown under the event on the calendar."></textarea>
      </label>
      <label>
        Player tasks (one per line, optional due date after a pipe)
        <textarea id="vos-dm-cal-tasks" placeholder="Send 4-8 sentences about your character | 2026-08-28&#10;Bring something for the tavern"></textarea>
      </label>
      <label>
        Kind
        <select id="vos-dm-cal-kind">
          <option value="session">Session</option>
          <option value="deadline">Deadline</option>
          <option value="other">Other</option>
        </select>
      </label>
      <div class="vos-dm-actions">
        <button id="vos-dm-cal-save" type="submit">Add to Calendar</button>
        <button id="vos-dm-cal-cancel" type="button" hidden>Cancel Edit</button>
      </div>
    </form>
    <ul class="vos-dm-cal-events" id="vos-dm-cal-events"></ul>
    <div class="vos-dm-status" id="vos-dm-cal-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="availability" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-avail-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-avail-title">Player Availability</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-avail-refresh" type="button">Refresh</button>
      </div>
    </div>
    <div class="vos-dm-avail-submitted" id="vos-dm-avail-submitted"></div>
    <div class="vos-dm-avail-summary" id="vos-dm-avail-summary"></div>
    <div class="vos-dm-status" id="vos-dm-avail-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="rsvps" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-rsvp-title">
    <h2 id="vos-dm-rsvp-title">RSVP Summary</h2>
    <div class="vos-dm-counts" aria-label="RSVP counts">
      <div class="vos-dm-count"><strong id="vos-rsvp-going">0</strong><span>Going</span></div>
      <div class="vos-dm-count"><strong id="vos-rsvp-maybe">0</strong><span>Maybe</span></div>
      <div class="vos-dm-count"><strong id="vos-rsvp-out">0</strong><span>Out</span></div>
    </div>
    <ul class="vos-dm-rsvps" id="vos-dm-rsvps"></ul>
    <div class="vos-dm-actions">
      <button id="vos-dm-rsvp-refresh" type="button">Refresh RSVPs</button>
    </div>
    <div class="vos-dm-status" id="vos-dm-rsvp-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="message" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-message-title">
    <h2 id="vos-dm-message-title">DM Message</h2>
    <form class="vos-dm-form" id="vos-dm-message-form">
      <label>
        Title
        <input id="vos-dm-message-heading" type="text" value="Message from the DM">
      </label>
      <label>
        Message (Markdown)
        <textarea id="vos-dm-message-body" placeholder="Use **bold**, _italics_, bullets, quotes, and links like [Wiki](/en/venturia/)."></textarea>
      </label>
      <label>
        URL
        <input id="vos-dm-message-url" type="text" value="/">
      </label>
      <fieldset class="vos-dm-recipient-picker" id="vos-dm-message-recipients" data-recipient-picker>
        <legend>Recipients</legend>
        <label class="vos-dm-check">
          <input type="checkbox" data-all-recipients checked>
          <span>All players</span>
        </label>
        <div class="vos-dm-recipient-list" data-player-list></div>
      </fieldset>
      <div class="vos-dm-actions">
        <button id="vos-dm-message-send" type="submit">Post + Notify</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-message-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="history" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-history-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-history-title">Message History</h2>
      <div class="vos-dm-actions">
        <label class="vos-dm-toggle">
          <input id="vos-dm-show-deleted" type="checkbox">
          <span>Show deleted</span>
        </label>
        <button id="vos-dm-history-refresh" type="button">Refresh</button>
      </div>
    </div>
    <div class="vos-dm-history" id="vos-dm-history"></div>
    <div class="vos-dm-status" id="vos-dm-history-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="push" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-subs-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-subs-title">Who Has Alerts On</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-subs-refresh" type="button">Refresh</button>
      </div>
    </div>
    <ul class="vos-dm-rsvps" id="vos-dm-push-subs"></ul>
    <div class="vos-dm-status" id="vos-dm-subs-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-push-title">
    <h2 id="vos-dm-push-title">Test Push</h2>
    <form class="vos-dm-form" id="vos-dm-push-form">
      <label>
        Title
        <input id="vos-dm-title" type="text" value="Foglight">
      </label>
      <label>
        Message
        <textarea id="vos-dm-body">Test push from the DM page.</textarea>
      </label>
      <label>
        URL
        <input id="vos-dm-url" type="text" value="/">
      </label>
      <fieldset class="vos-dm-recipient-picker" id="vos-dm-push-recipients" data-recipient-picker>
        <legend>Recipients</legend>
        <label class="vos-dm-check">
          <input type="checkbox" data-all-recipients checked>
          <span>All players</span>
        </label>
        <div class="vos-dm-recipient-list" data-player-list></div>
      </fieldset>
      <div class="vos-dm-actions">
        <button id="vos-dm-send" type="submit">Send Test Push</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="wiki" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-wiki-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-wiki-title">Wiki Editor</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-wiki-load" type="button">Load</button>
        <button id="vos-dm-wiki-rebuild" type="button">Rebuild Now</button>
      </div>
    </div>
    <p class="vos-dm-helper">Edit an existing published wiki source file. Choose a title or paste a wiki URL such as <code>/en/Venturia/Characters/PCs/roxanya/</code>.</p>
    <datalist id="vos-dm-wiki-pages"></datalist>
    <form class="vos-dm-form vos-dm-wiki-editor" id="vos-dm-wiki-form">
      <label>
        Wiki Page
        <input id="vos-dm-wiki-query" list="vos-dm-wiki-pages" type="text" autocomplete="off" placeholder="Start typing a page title or paste /en/...">
      </label>
      <div class="vos-dm-wiki-meta" id="vos-dm-wiki-meta"></div>
      <label id="vos-dm-wiki-content-row" hidden>
        Source Markdown
        <textarea id="vos-dm-wiki-content" spellcheck="false"></textarea>
      </label>
      <div class="vos-dm-actions">
        <a class="vos-dm-button" id="vos-dm-wiki-open" href="#" hidden>Open Page</a>
        <button class="vos-dm-button" id="vos-dm-wiki-save" type="submit" disabled>Save Wiki Entry</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-wiki-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="lore" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-lore-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-lore-title">Lore Submissions</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-lore-refresh" type="button">Refresh</button>
      </div>
    </div>
    <div class="vos-dm-bulk-bar" id="vos-dm-lore-bulk-bar" hidden>
      <label class="vos-dm-bulk-select-all">
        <input type="checkbox" id="vos-dm-lore-select-all">
        <span id="vos-dm-lore-select-count">0 selected</span>
      </label>
      <div class="vos-dm-actions">
        <button class="vos-dm-button" id="vos-dm-lore-bulk-publish" type="button" disabled>Publish selected</button>
        <button class="vos-dm-button is-danger" id="vos-dm-lore-bulk-reject" type="button" disabled>Reject selected</button>
      </div>
    </div>
    <div class="vos-dm-submission-grid">
      <div class="vos-dm-submission-list" id="vos-dm-lore-list"></div>
      <form class="vos-dm-form vos-dm-submission-editor" id="vos-dm-lore-form" hidden>
        <label>
          Title
          <input id="vos-dm-lore-entry-title" type="text">
        </label>
        <label>
          Slug
          <input id="vos-dm-lore-slug" type="text">
        </label>
        <label>
          Summary
          <textarea id="vos-dm-lore-summary"></textarea>
        </label>
        <img class="vos-dm-submission-preview" id="vos-dm-lore-image" alt="" hidden>
        <label>
          Markdown
          <textarea id="vos-dm-lore-markdown" spellcheck="false"></textarea>
        </label>
        <label>
          Image Prompt
          <textarea id="vos-dm-lore-image-prompt"></textarea>
        </label>
        <label class="vos-dm-reject-row">
          Rejection reason (shown to the player)
          <textarea id="vos-dm-lore-reject-reason" rows="2" maxlength="500" placeholder="Optional — what should change before resubmit? Defaults to 'Rejected by DM'."></textarea>
        </label>
        <div class="vos-dm-actions">
          <button id="vos-dm-lore-redraft" type="button">Regenerate</button>
          <button class="vos-dm-button" id="vos-dm-lore-save" type="button">Save</button>
          <button class="vos-dm-button is-danger" id="vos-dm-lore-reject" type="button">Reject</button>
          <button id="vos-dm-lore-publish" type="submit">Publish</button>
        </div>
      </form>
    </div>
    <div class="vos-dm-status" id="vos-dm-lore-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="records" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-records-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-records-title">Character Records</h2>
      <div class="vos-dm-actions">
        <a class="vos-dm-button" href="/dossiers/">Dossiers</a>
        <a class="vos-dm-button" href="/questionnaire/">Proof Records</a>
        <button id="vos-dm-records-refresh" type="button">Refresh</button>
      </div>
    </div>
    <ul class="vos-dm-rsvps" id="vos-dm-records-list"></ul>
    <div class="vos-dm-status" id="vos-dm-records-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="rumors" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-rumors-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-rumors-title">Tavern Rumors</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-rumors-refresh" type="button">Refresh</button>
      </div>
    </div>
    <form class="vos-dm-form" id="vos-dm-rumor-form">
      <label>
        New rumor
        <textarea id="vos-dm-rumor-text" placeholder="What are they whispering at the Cask and Cube?"></textarea>
      </label>
      <div class="vos-dm-actions">
        <button id="vos-dm-rumor-add" type="submit">Add Rumor</button>
      </div>
    </form>
    <ul class="vos-dm-cal-events" id="vos-dm-rumors-list"></ul>
    <div class="vos-dm-status" id="vos-dm-rumors-status" role="status" aria-live="polite"></div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="npc" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-npc-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-npc-title">Quick NPC</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-npc-roll" type="button">Roll NPC</button>
      </div>
    </div>
    <div class="vos-dm-npc" id="vos-dm-npc-result">
      <div class="vos-dm-avail-empty">Roll when the party corners a stranger.</div>
    </div>
  </section>

  </div>

  <div class="vos-dm-view" data-vos-view="inplay" hidden>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-inplay-title">
    <div class="vos-dm-panel-head">
      <h2 id="vos-dm-inplay-title">Currently In Play</h2>
      <div class="vos-dm-actions">
        <button id="vos-dm-inplay-refresh" type="button">Refresh</button>
        <button id="vos-dm-inplay-add" type="button">Add row</button>
        <button class="vos-dm-button" id="vos-dm-inplay-save" type="button">Save</button>
      </div>
    </div>
    <p class="vos-dm-helper">Pick a wiki entry to auto-link, or type a custom name. Replaces the live "Currently In Play" rail on Home and the In Play panel on the Venturia hub. The static fallback in <code>_data/campaign.js</code> shows until this loads.</p>
    <datalist id="vos-dm-inplay-pages"></datalist>
    <div class="vos-dm-inplay-list" id="vos-dm-inplay-list"></div>
    <div class="vos-dm-status" id="vos-dm-inplay-status" role="status" aria-live="polite"></div>
  </section>

  </div>
</div>

<script src="/js/vos-tabs.js" defer></script>
<script src="/js/vos-dm.js" defer></script>
