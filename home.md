---
title: Valley of Shadows — Codex
description: Tales from Venturia & Vallombrosa. The living chronicle of the Valley of Shadows campaign.
published: true
date: 2026-05-22T01:24:39.808Z
tags: locations, character-hooks, market-tiers, religion, abbey, healing, fog-sickness
editor: markdown
dateCreated: 2026-02-20T05:30:38.113Z
templateEngineOverride: njk
pageStyles:
  - /css/home.css
pageScripts:
  - /js/vos-home.js
---

{# Home is an attention dashboard: what is happening next, and what needs
   me. It is not a second copy of Calendar, Messages, Studio or The Table.

   Both roles' cards ship in the markup and vos-home.js reveals and orders
   one set. Eleventy cannot know who is reading at build time, and a second
   page behind a redirect would cost a round trip to find out. #}

<div class="vos-home" id="vos-home" data-home-role="">

<!-- ── HERO ─────────────────────────────────────────────────────────── -->
{# Kept for identity, sized so Next Gathering is above the fold. #}
<section class="vos-home-hero">
  <div class="vos-hero-banner-wrap">
    <img src="/images/logos/foglight-logo-3to1-2.jpg" alt="Foglight" class="vos-hero-banner">
  </div>
</section>

<!-- ── LIVING DASHBOARD ─────────────────────────────────────────────── -->
<section class="vos-home-dashboard" aria-label="Campaign dashboard">
  <div class="vos-dash">

    <!-- 1 · both roles -->
    <article class="vos-dash-card vos-dash-side-card vos-next-card" aria-labelledby="vos-next-heading" data-next-gathering data-home-card="next">
      <h3 id="vos-next-heading">Next Gathering</h3>
      <div data-ng-empty hidden>
        <div class="vos-next-where">Nothing on the books yet — the DM will schedule the next session soon.</div>
      </div>
      <div data-ng-body>
        <div class="vos-next-date" data-ng-date>Loading…</div>
        <div class="vos-next-where" data-ng-where></div>
        <div class="vos-next-rsvp" aria-label="RSVP for the next gathering">
          {% include "partials/rsvp-control.njk" %}
        </div>
      </div>
    </article>

    <!-- 2 · player -->
    {# The tasks moved off the gathering card and became their own answer to
       "what needs my attention", which is the question this page exists to
       answer. #}
    <article class="vos-dash-card vos-dash-side-card vos-todo-card" aria-labelledby="vos-todo-heading" data-home-card="todo" data-home-role-only="player" hidden>
      <h3 id="vos-todo-heading">Things You Need to Do</h3>
      <ul class="vos-task-list" id="vos-todo-list" hidden></ul>
      <div class="vos-dash-empty" id="vos-todo-empty" hidden>Nothing waiting on you.</div>
    </article>

    <!-- 2 · DM -->
    <article class="vos-dash-card vos-dash-side-card vos-prep-card" aria-labelledby="vos-prep-heading" data-home-card="prep" data-home-role-only="dm" hidden>
      <h3 id="vos-prep-heading">Preparation Remaining</h3>
      <ul class="vos-task-list" id="vos-prep-list" hidden></ul>
      <div class="vos-dash-empty" id="vos-prep-empty" hidden>Nothing outstanding before the next session.</div>
      <a class="vos-dash-more" href="/party/?area=prepare">Open Prepare &rarr;</a>
    </article>

    <!-- 3 · DM -->
    <article class="vos-dash-card vos-dash-side-card vos-review-card" aria-labelledby="vos-review-heading" data-home-card="review" data-home-role-only="dm" hidden>
      <h3 id="vos-review-heading">Pending Studio and Lore Submissions</h3>
      <ul class="vos-task-list" id="vos-review-list" hidden></ul>
      <div class="vos-dash-empty" id="vos-review-empty" hidden>Nothing waiting for review.</div>
      <a class="vos-dash-more" href="/party/?area=review">Open Review &rarr;</a>
    </article>

    <!-- 3 · player / 6 · DM -->
    {# Campaign broadcasts. Not Messages — those are conversations between
       people and live behind the app bar. Two different things that both
       happen to contain text from the DM. #}
    <article class="vos-dash-card vos-dash-side-card vos-message-card" id="vos-message-card" aria-labelledby="vos-message-heading" data-home-card="announcements" hidden>
      <h3 id="vos-message-heading">News and Announcements</h3>
      <ul class="vos-messages-list" id="vos-messages-list"></ul>
      <div class="vos-messages-empty" id="vos-messages-empty" hidden>No new announcements.</div>
      <a class="vos-dash-more" id="vos-messages-view-all" href="/dm/?view=history" hidden>View all announcements &rarr;</a>
      <button class="vos-button vos-messages-load-more" id="vos-messages-load-more" type="button" hidden>Show older</button>
    </article>

    <!-- 4 · DM -->
    <article class="vos-dash-card vos-dash-side-card vos-attendance-card" aria-labelledby="vos-attendance-heading" data-home-card="attendance" data-home-role-only="dm" hidden>
      <h3 id="vos-attendance-heading">Attendance and Availability</h3>
      <div class="vos-dash-figures" id="vos-attendance-figures"></div>
      <div class="vos-dash-empty" id="vos-attendance-empty" hidden>No session scheduled to count against.</div>
      <a class="vos-dash-more" href="/calendar/#availability">Open the calendar &rarr;</a>
    </article>

    <!-- 4 · player -->
    <article class="vos-dash-card vos-inplay-card" aria-labelledby="vos-inplay-heading" data-home-card="inplay">
      <h3 id="vos-inplay-heading">Currently In Play</h3>
      <div class="vos-play-rail" data-in-play-container="home">
        {%- for item in campaign.inPlay %}
        <a class="vos-play-chip" href="{{ item.link }}">
          <span class="vos-play-emblem" aria-hidden="true">{{ item.emblem }}</span>
          <span class="vos-play-name">{{ item.name }}<small>{{ item.role }} · {{ item.kind }}</small></span>
        </a>
        {%- endfor %}
      </div>
    </article>

    <!-- 5 · DM -->
    <article class="vos-dash-card vos-dash-side-card vos-activity-card" aria-labelledby="vos-activity-heading" data-home-card="activity" data-home-role-only="dm" hidden>
      <h3 id="vos-activity-heading">Recent Player Activity</h3>
      <ul class="vos-task-list" id="vos-activity-list" hidden></ul>
      <div class="vos-dash-empty" id="vos-activity-empty" hidden>Quiet since the last session.</div>
    </article>

    <!-- 4 · player -->
    <article class="vos-dash-card vos-story-card" aria-labelledby="vos-story-heading" data-home-card="story">
      <div>
        <div class="vos-dash-kicker">{{ campaign.latestSession.number }} · {{ campaign.latestSession.arc }}</div>
        <h2 id="vos-story-heading" class="vos-card-heading">Story So Far</h2>
      </div>
      <h3>{{ campaign.latestSession.title }}</h3>
      <p>{{ campaign.latestSession.recap }}</p>
      <a class="vos-story-read" href="{{ campaign.latestSession.link }}">Read full chronicle &rarr;</a>
    </article>

    <!-- 5 · player -->
    <article class="vos-dash-card vos-dash-side-card vos-rumor-card" aria-labelledby="vos-rumor-heading" data-home-card="rumor">
      <h3 id="vos-rumor-heading">Rumors at the Cask and Cube</h3>
      <div class="vos-rumor-text" id="vos-rumor-text" aria-live="polite">Buy the room a round and see what the tavern is saying.</div>
      <button class="vos-rumor-roll" id="vos-rumor-roll" type="button">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 2.2 20.5 7.4 V16.6 L12 21.8 L3.5 16.6 V7.4 Z"/><path d="M12 2.2 V8.2 M3.5 7.4 L12 8.2 L20.5 7.4 M12 8.2 L6.6 11.2 L5.2 16.2 M12 8.2 L17.4 11.2 L18.8 16.2 M6.6 11.2 L12 21.8 M17.4 11.2 L12 21.8 M6.6 11.2 H17.4"/></svg>
        Roll a rumor
      </button>
    </article>

    <!-- 5 · player -->
    {# Was the first thing on the page. It is a good invitation and a poor
       answer to "what is happening next", so it sits below the answers. #}
    <div class="vos-dash-wide vos-home-cta" data-home-card="contribute" data-home-role-only="player" hidden>
      <a class="vos-row-chip vos-row-chip-cta vos-row-chip-cta-compact" href="/studio/?tab=create&amp;kind=lore">
        <span>
          <span class="vos-row-chip-title">Contribute Lore</span>
          <span class="vos-row-chip-meta">Draft an entry — Enzo writes it up, the DM approves.</span>
        </span>
        <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
      </a>
      <button class="vos-enzo-action" type="button"
              data-enzo-ask="Help me draft a piece of lore for the campaign. Ask me what it is about first.">
        Draft with Enzo
      </button>
    </div>

    <!-- 4 · both roles -->
    {%- if collections.news and collections.news.length -%}
    <section class="vos-dash-wide vos-home-news" aria-labelledby="vos-news-heading" data-home-card="updates">
      <div class="vos-home-sec-head">
        <h2 id="vos-news-heading">Recent Campaign Updates</h2>
        <span class="vos-home-sec-line"></span>
        <a class="vos-home-sec-more" href="/en/Venturia/">Browse the wiki &rarr;</a>
      </div>
      <ul class="vos-news-list">
        {%- for entry in collections.news -%}
        <li>
          <a class="vos-row-chip" href="{{ entry.url }}">
            <span>
              <span class="vos-row-chip-title">{{ entry.data.title }}</span>
              {%- if entry.data.description -%}
              <span class="vos-row-chip-meta">{{ entry.data.description }}</span>
              {%- endif -%}
            </span>
            <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
          </a>
        </li>
        {%- endfor -%}
      </ul>
    </section>
    {%- endif -%}

    <!-- 6 · player -->
    <section class="vos-dash-wide vos-home-studio" aria-labelledby="vos-studio-recent-heading" data-home-card="studio" data-home-role-only="player" hidden>
      <div class="vos-home-sec-head">
        <h2 id="vos-studio-recent-heading">Recent Studio Creations</h2>
        <span class="vos-home-sec-line"></span>
        <a class="vos-home-sec-more" href="/studio/">Open Studio &rarr;</a>
      </div>
      <div class="vos-home-studio-rail" id="vos-home-studio-rail"></div>
      <div class="vos-dash-empty" id="vos-home-studio-empty" hidden>Nothing in the campaign library yet.</div>
    </section>
  </div>
</section>

</div>
