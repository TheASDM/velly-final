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

<div class="vos-home">

<!-- ── HERO ─────────────────────────────────────────────────────────── -->
<section class="vos-home-hero">
  <div class="vos-hero-banner-wrap">
    <img src="/images/logos/foglight-logo-3to1-2.jpg" alt="Foglight" class="vos-hero-banner">
  </div>
</section>

<!-- ── CONTRIBUTE LORE (top) ───────────────────────────────────────── -->
<section class="vos-home-dashboard vos-home-cta">
  <a class="vos-row-chip vos-row-chip-cta vos-row-chip-cta-compact" href="/submit-lore/">
    <span>
      <span class="vos-row-chip-title">Contribute Lore</span>
      <span class="vos-row-chip-meta">Draft an entry — AI writes it, the DM approves.</span>
    </span>
    <span class="vos-row-chip-arrow" aria-hidden="true">›</span>
  </a>
</section>

<!-- ── LIVING DASHBOARD ─────────────────────────────────────────────── -->
<section class="vos-home-dashboard" aria-label="Campaign dashboard">
  <div class="vos-dash">
    <article class="vos-dash-card vos-dash-side-card vos-message-card" id="vos-message-card" aria-labelledby="vos-message-heading" hidden>
      <h3 id="vos-message-heading">DM Messages</h3>
      <ul class="vos-messages-list" id="vos-messages-list"></ul>
      <div class="vos-messages-empty" id="vos-messages-empty" hidden>No new messages.</div>
      <button class="vos-button vos-messages-load-more" id="vos-messages-load-more" type="button" hidden>Show older</button>
    </article>
    <article class="vos-dash-card vos-dash-side-card vos-next-card" aria-labelledby="vos-next-heading" data-next-gathering>
      <h3 id="vos-next-heading">Next Gathering</h3>
      <div data-ng-empty hidden>
        <div class="vos-next-where">Nothing on the books yet — the DM will schedule the next session soon.</div>
      </div>
      <div data-ng-body>
        <div class="vos-next-date" data-ng-date>Loading…</div>
        <div class="vos-next-where" data-ng-where></div>
        <ul class="vos-task-list" data-ng-tasks hidden></ul>
        <div class="vos-next-rsvp" aria-label="RSVP for the next gathering">
          {% include "partials/rsvp-control.njk" %}
        </div>
      </div>
    </article>
    <article class="vos-dash-card vos-dash-side-card vos-rumor-card" aria-labelledby="vos-rumor-heading">
      <h3 id="vos-rumor-heading">Rumors at the Cask and Cube</h3>
      <div class="vos-rumor-text" id="vos-rumor-text" aria-live="polite">Buy the room a round and see what the tavern is saying.</div>
      <button class="vos-rumor-roll" id="vos-rumor-roll" type="button">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 2.2 20.5 7.4 V16.6 L12 21.8 L3.5 16.6 V7.4 Z"/><path d="M12 2.2 V8.2 M3.5 7.4 L12 8.2 L20.5 7.4 M12 8.2 L6.6 11.2 L5.2 16.2 M12 8.2 L17.4 11.2 L18.8 16.2 M6.6 11.2 L12 21.8 M17.4 11.2 L12 21.8 M6.6 11.2 H17.4"/></svg>
        Roll a rumor
      </button>
    </article>
    {#
    <article class="vos-dash-card vos-dash-side-card vos-threads-card" aria-labelledby="vos-threads-heading">
      <h3 id="vos-threads-heading">Open Threads</h3>
      <div class="vos-thread-list">
        {%- for thread in campaign.openThreads %}
        <div class="vos-thread">
          <span class="vos-thread-dot {{ thread.status }}" aria-hidden="true"></span>
          <div class="vos-thread-question">
            {{ thread.question }}
            <span class="vos-thread-tag">{{ thread.status }} · {{ thread.tag }}</span>
          </div>
        </div>
        {%- endfor %}
      </div>
    </article>
    #}
    <article class="vos-dash-card vos-inplay-card" aria-labelledby="vos-inplay-heading">
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
    <article class="vos-dash-card vos-story-card" aria-labelledby="vos-story-heading">
      <div>
        <div class="vos-dash-kicker">{{ campaign.latestSession.number }} · {{ campaign.latestSession.arc }}</div>
        <h2 id="vos-story-heading" class="vos-card-heading">Story So Far</h2>
      </div>
      <h3>{{ campaign.latestSession.title }}</h3>
      <p>{{ campaign.latestSession.recap }}</p>
      <a class="vos-story-read" href="{{ campaign.latestSession.link }}">Read full chronicle &rarr;</a>
    </article>
  </div>
</section>

<!-- ── LATEST FROM THE CODEX ───────────────────────────────────────── -->
{%- if collections.news and collections.news.length -%}
<section class="vos-home-dashboard vos-home-news" aria-labelledby="vos-news-heading">
  <div class="vos-home-sec-head">
    <h2 id="vos-news-heading">Latest From The Codex</h2>
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

</div>
