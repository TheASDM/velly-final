---
title: DM
description: DM tools for Vallombrosa.
permalink: /dm/
---

<style>
.vos-dm {
  max-width: 860px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}
.vos-dm-panel {
  min-width: 0;
  border: 1px solid rgba(201,161,74,0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(18,16,23,0.94), rgba(8,7,11,0.98)),
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,161,74,0.06), transparent 70%);
  box-shadow: 0 16px 42px rgba(0,0,0,0.55);
  padding: clamp(1.2rem, 3vw, 1.8rem);
}
.vos-dm-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}
.vos-dm-panel-head h2 {
  margin: 0;
}
.vos-dm-form {
  display: grid;
  gap: 0.85rem;
}
.vos-dm-form label,
.vos-dm-recipient-picker legend,
.vos-dm-toggle {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-form label {
  display: grid;
  gap: 0.35rem;
}
.vos-dm-form input,
.vos-dm-form select,
.vos-dm-form textarea {
  width: 100%;
  border: 1px solid rgba(201,168,76,0.25);
  border-radius: 6px;
  background: rgba(7,6,10,0.72);
  color: var(--vos-cream);
  font: 1rem 'EB Garamond', Georgia, serif;
  line-height: 1.4;
  padding: 0.65rem 0.75rem;
}
.vos-dm-form textarea {
  min-height: 110px;
  resize: vertical;
}
.vos-dm-recipient-picker {
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 8px;
  padding: 0.85rem;
  margin: 0;
}
.vos-dm-recipient-picker legend {
  padding: 0 0.35rem;
}
.vos-dm-recipient-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.45rem;
  margin-top: 0.65rem;
}
.vos-dm-check {
  display: flex !important;
  align-items: center;
  gap: 0.55rem !important;
  min-height: 42px;
  padding: 0.52rem 0.65rem;
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 999px;
  background: rgba(7,6,10,0.42);
  color: var(--vos-text) !important;
  cursor: pointer;
  text-transform: none !important;
}
.vos-dm-check input {
  width: 1rem;
  min-width: 1rem;
  height: 1rem;
  accent-color: var(--vos-gold-bright);
}
.vos-dm-check:has(input:checked) {
  border-color: rgba(212,165,116,0.62);
  background: rgba(212,165,116,0.12);
  color: var(--vos-cream) !important;
}
.vos-dm-check.is-disabled {
  opacity: 0.45;
}
.vos-dm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.vos-dm-actions button,
.vos-dm-button {
  min-height: 44px;
  padding: 0.55rem 1rem;
  border: 1px solid rgba(212,165,116,0.44);
  border-radius: 6px;
  background: rgba(212,165,116,0.1);
  color: var(--vos-gold-bright);
  cursor: pointer;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-actions button:hover,
.vos-dm-button:hover {
  background: rgba(212,165,116,0.16);
  color: var(--vos-cream);
}
.vos-dm-button.is-danger {
  border-color: rgba(176,67,67,0.5);
  color: #f0a0a0;
}
.vos-dm-status {
  min-height: 1.4em;
  margin-top: 0.85rem;
  color: var(--vos-text);
}
.vos-dm-status.is-error {
  color: var(--vos-quest-bright);
}
.vos-dm-counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin: 0.85rem 0 1rem;
}
.vos-dm-count {
  border: 1px solid rgba(201,168,76,0.22);
  border-radius: 6px;
  background: rgba(7,6,10,0.5);
  padding: 0.75rem;
  text-align: center;
}
.vos-dm-count strong {
  display: block;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 1.35rem;
}
.vos-dm-count span {
  color: rgba(233,225,208,0.72);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-dm-rsvps,
.vos-dm-history {
  list-style: none;
  margin: 0;
  padding: 0;
}
.vos-dm-rsvps li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0;
  border-top: 1px solid rgba(139,115,85,0.24);
}
.vos-dm-rsvps span {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.vos-dm-message {
  display: grid;
  gap: 0.65rem;
  border-top: 1px solid rgba(139,115,85,0.24);
  padding: 1rem 0;
}
.vos-dm-message:first-child {
  border-top: 0;
}
.vos-dm-message.is-deleted {
  opacity: 0.55;
}
.vos-dm-message-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.vos-dm-message-title {
  margin: 0;
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.vos-dm-message-body {
  margin: 0;
  color: var(--vos-text);
  white-space: pre-wrap;
}
.vos-dm-meta,
.vos-dm-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.vos-dm-meta {
  color: rgba(233,225,208,0.62);
  font-size: 0.9rem;
}
.vos-dm-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.2rem 0.55rem;
  border: 1px solid rgba(201,168,76,0.24);
  border-radius: 999px;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-empty {
  color: rgba(233,225,208,0.64);
  font-style: italic;
}
.vos-dm-helper {
  margin: 0 0 0.6rem;
  color: rgba(212, 199, 173, 0.7);
  font-size: 0.88rem;
  line-height: 1.4;
}
.vos-dm-helper code {
  background: rgba(212, 165, 116, 0.12);
  color: var(--vos-cream);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85rem;
}
.vos-dm-inplay-list {
  display: grid;
  gap: 0.5rem;
}
.vos-dm-inplay-row {
  display: grid;
  grid-template-columns: 1.6fr 1.4fr 0.9fr 0.7fr auto;
  gap: 0.5rem;
  align-items: center;
}
.vos-dm-inplay-row.is-wiki-linked .vos-dm-inplay-name {
  border-color: rgba(168, 224, 168, 0.4);
}
.vos-dm-inplay-row input,
.vos-dm-inplay-row select {
  width: 100%;
  min-height: 36px;
  padding: 0.35rem 0.55rem;
  border: 1px solid rgba(201, 168, 76, 0.22);
  border-radius: 6px;
  background: rgba(7, 6, 10, 0.55);
  color: var(--vos-cream);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.94rem;
}
.vos-dm-inplay-row input:focus,
.vos-dm-inplay-row select:focus {
  outline: none;
  border-color: rgba(212, 165, 116, 0.6);
  background: rgba(7, 6, 10, 0.75);
}
.vos-dm-inplay-row .vos-dm-inplay-emblem-custom[hidden] {
  display: none !important;
}
.vos-dm-inplay-row button {
  width: 36px;
  padding: 0;
  font-size: 1.1rem;
}
@media (max-width: 720px) {
  .vos-dm-inplay-row {
    grid-template-columns: 1fr 1fr;
  }
  .vos-dm-inplay-row button {
    grid-column: 1 / -1;
    width: 100%;
  }
}
.vos-dm-submission-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
  gap: 1rem;
}
.vos-dm-submission-list {
  display: grid;
  align-content: start;
  gap: 0.55rem;
}
.vos-dm-submission-row {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  gap: 0.55rem;
}
.vos-dm-submission-check {
  align-self: center;
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.vos-dm-bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin: 0 0 0.65rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid rgba(201,168,76,0.22);
  border-radius: 8px;
  background: rgba(7,6,10,0.45);
}
.vos-dm-bulk-bar[hidden] { display: none; }
.vos-dm-bulk-select-all {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.vos-dm-bulk-select-all input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.vos-dm-submission-item {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 8px;
  background: rgba(7,6,10,0.44);
  color: var(--vos-text);
  cursor: pointer;
  padding: 0.7rem;
  text-align: left;
}
.vos-dm-submission-item:hover,
.vos-dm-submission-item.is-selected {
  border-color: rgba(212,165,116,0.52);
  background: rgba(212,165,116,0.1);
}
.vos-dm-submission-title {
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.vos-dm-submission-meta {
  color: rgba(233,225,208,0.62);
  font-size: 0.9rem;
}
.vos-dm-submission-preview {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border: 1px solid rgba(201,168,76,0.24);
  border-radius: 6px;
  background: rgba(7,6,10,0.5);
}
.vos-dm-submission-editor textarea#vos-dm-lore-markdown {
  min-height: 360px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.86rem;
}
.vos-dm-wiki-editor textarea#vos-dm-wiki-content {
  min-height: 520px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.86rem;
  line-height: 1.45;
}
.vos-dm-wiki-meta {
  min-height: 1.35em;
  color: rgba(233,225,208,0.62);
  font-size: 0.9rem;
}
.vos-dm-wiki-meta code {
  color: var(--vos-cream);
}
.vos-dm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.vos-dm-toggle input {
  accent-color: var(--vos-gold-bright);
}
@media (max-width: 560px) {
  .vos-dm-panel-head,
  .vos-dm-message-head {
    align-items: stretch;
    flex-direction: column;
  }
  .vos-dm-submission-grid { grid-template-columns: 1fr; }
  .vos-dm-counts { grid-template-columns: 1fr; }
  .vos-dm-actions { justify-content: stretch; }
  .vos-dm-actions button,
  .vos-dm-button { width: 100%; }
}
.vos-dm-auth-panel {
  display: grid;
  gap: 0.65rem;
}
.vos-dm-google-button {
  min-height: 44px;
}
.vos-dm-auth-meta {
  color: var(--vos-cream);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.96rem;
  line-height: 1.35;
}
.vos-dm-auth-meta strong {
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
}
.vos-dm-auth-blocked code {
  background: rgba(212, 165, 116, 0.12);
  color: var(--vos-cream);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85rem;
}
.vos-dm-cal-events {
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}
.vos-dm-cal-event {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.6rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid rgba(212,165,116,0.3);
  border-radius: 6px;
  background: rgba(212,165,116,0.06);
  color: var(--vos-cream);
  font-size: 0.92rem;
}
/* The title/detail span must be allowed to shrink and wrap, or a long
   event line forces the whole page wider than the viewport on mobile. */
.vos-dm-cal-event > span:not(.vos-dm-cal-next-badge) {
  flex: 1 1 14ch;
  min-width: 0;
  overflow-wrap: anywhere;
}
.vos-dm-cal-event strong {
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.vos-dm-cal-event button {
  min-height: 32px;
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
}
.vos-dm-cal-event button:first-of-type {
  margin-left: auto;
}
.vos-dm-cal-next-badge {
  padding: 0.16rem 0.5rem;
  border: 1px solid rgba(76,175,80,0.7);
  border-radius: 999px;
  background: rgba(38,110,52,0.5);
  color: #eaf5e6;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.vos-dm-view {
  display: grid;
  gap: 1rem;
}
.vos-dm-npc {
  display: grid;
  gap: 0.55rem;
}
.vos-dm-npc-card {
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(139,115,85,0.3);
  border-left: 3px solid var(--vos-gold-bright);
  border-radius: 6px;
  background: rgba(18,16,23,0.55);
  color: var(--vos-cream);
  font-size: 0.92rem;
  line-height: 1.5;
}
.vos-dm-npc-card strong {
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.9rem;
}
.vos-dm-avail-summary {
  display: grid;
  gap: 0.9rem;
}
.vos-dm-avail-group h3 {
  margin: 0 0 0.45rem;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.vos-dm-avail-day {
  display: grid;
  gap: 0.3rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(139,115,85,0.28);
  border-radius: 6px;
  background: rgba(18,16,23,0.55);
  margin-bottom: 0.45rem;
}
.vos-dm-avail-day-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: var(--vos-cream);
}
.vos-dm-avail-day-head strong {
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}
.vos-dm-avail-score {
  margin-left: auto;
  color: rgba(232,220,200,0.6);
  font-size: 0.78rem;
}
.vos-dm-avail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.vos-dm-avail-chip {
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(139,115,85,0.4);
  font-size: 0.76rem;
  color: var(--vos-cream);
}
.vos-dm-avail-chip.is-preferred {
  background: rgba(38,110,52,0.75);
  border-color: rgba(76,175,80,0.8);
  color: #eaf5e6;
}
.vos-dm-avail-chip.is-available {
  background: rgba(104,159,56,0.4);
  border-color: rgba(156,204,101,0.7);
  color: #eaf5e6;
}
.vos-dm-avail-chip.is-unavailable {
  background: rgba(140,44,32,0.55);
  border-color: rgba(198,83,64,0.75);
  color: #f6e2dd;
}
.vos-dm-avail-times {
  color: rgba(232,220,200,0.75);
  font-size: 0.8rem;
}
.vos-dm-avail-submitted {
  margin-bottom: 0.8rem;
  color: rgba(232,220,200,0.75);
  font-size: 0.86rem;
  line-height: 1.5;
}
.vos-dm-avail-submitted strong {
  color: var(--vos-gold-bright);
  font-weight: 600;
}
.vos-dm-avail-empty {
  color: rgba(232,220,200,0.55);
  font-style: italic;
  font-size: 0.88rem;
}
</style>

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
        <a class="vos-dm-button" href="/questionnaire/">Read Records</a>
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
