---
title: Valley of Shadows — Codex
description: Tales from Venturia & Vallombrosa. The living chronicle of the Valley of Shadows campaign.
published: true
date: 2026-05-22T01:24:39.808Z
tags: locations, character-hooks, market-tiers, religion, abbey, healing, fog-sickness
editor: markdown
dateCreated: 2026-02-20T05:30:38.113Z
templateEngineOverride: njk
---

<style>
/* ─── Home-only styles. Scoped to .vos-home so they don't leak. ─── */
.vos-home {
  --vos-home-wide: min(1440px, calc(100vw - 2rem));
  position: relative;
  left: 50%;
  width: var(--vos-home-wide);
  margin: -2.25rem 0 0;
  transform: translateX(-50%);
}
@media (min-width: 1024px) {
  .vos-home {
    --vos-home-wide: min(1440px, calc(100vw - 3rem));
  }
}

/* HERO — wide cinematic banner image (already includes the wordmark) ─ */
.vos-home-hero {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.8rem 0 1.45rem;
}
.vos-hero-banner {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0 auto;
  box-shadow:
    0 20px 60px rgba(0,0,0,0.85),
    0 0 0 1px rgba(212,165,116,0.18);
  border-radius: 4px;
}
.vos-hero-banner-wrap {
  position: relative;
  width: 100%;
  max-width: 1440px;
  aspect-ratio: 2712 / 517;
  margin: 0 auto 2.25rem;
}
.vos-hero-banner-wrap::after {
  content: '';
  position: absolute; left: 6%; right: 6%; bottom: -10px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,165,116,0.6), transparent);
}
.vos-hero-divider {
  width: 320px; max-width: 80%;
  height: 1px; margin: 0 auto 2.25rem;
  background: linear-gradient(90deg, transparent, rgba(212,165,116,0.55), transparent);
}
.vos-hero-ctas {
  display: flex; flex-wrap: wrap; gap: 1rem;
  justify-content: center;
}
.vos-hero-cta {
  display: inline-flex; align-items: center; gap: 0.6rem;
  padding: 0.95rem 1.6rem;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.28em; text-transform: uppercase;
  color: #0d0b11; text-decoration: none;
  background: linear-gradient(180deg, #e6c08a 0%, #c9a371 60%, #a8835a 100%);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 3px;
  box-shadow:
    0 6px 24px rgba(212,165,116,0.35),
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -1px 0 rgba(0,0,0,0.25);
  transition: transform 0.18s ease, box-shadow 0.18s ease, color 0.18s;
}
.vos-hero-cta:hover {
  transform: translateY(-2px);
  box-shadow:
    0 10px 32px rgba(212,165,116,0.55),
    inset 0 1px 0 rgba(255,255,255,0.4),
    inset 0 -1px 0 rgba(0,0,0,0.3);
  color: #0d0b11;
  border-bottom: 1px solid rgba(255,255,255,0.18);
}
.vos-hero-cta--ghost {
  background: transparent;
  color: var(--vos-gold-bright);
  border: 1px solid rgba(212,165,116,0.5);
  box-shadow: none;
}
.vos-hero-cta--ghost:hover {
  background: rgba(212,165,116,0.08);
  color: var(--vos-cream);
  box-shadow: 0 4px 14px rgba(212,165,116,0.18);
  border-bottom: 1px solid rgba(212,165,116,0.7);
}
.vos-hero-cta .vos-cta-arrow {
  font-family: serif;
  font-weight: 400;
  font-size: 1.05rem; letter-spacing: 0;
  margin-left: 0.1rem;
}

/* Living dashboard ─────────────────────────────────────────────────── */
.vos-home-dashboard {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0;
}
.vos-home-sec-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin: 2.75rem 0 1.1rem;
}
.vos-home-sec-head h2 {
  margin: 0;
  padding: 0;
  border: none;
  color: #e8cd84;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  line-height: 1.2;
  text-transform: uppercase;
  white-space: nowrap;
}
.vos-home-sec-head h2::after { content: none; }
.vos-home-sec-head .vos-home-sec-line {
  flex: 1 1 auto;
  height: 1px;
  background: linear-gradient(90deg, rgba(201,161,74,0.5), transparent);
}
.vos-home-sec-head .vos-home-sec-more {
  flex: 0 0 auto;
  color: rgba(232,205,132,0.75);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-bottom: none;
  white-space: nowrap;
}
.vos-home-sec-head .vos-home-sec-more:hover {
  color: var(--vos-cream);
  border-bottom: none;
}
.vos-dash {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.85fr);
  grid-template-areas:
    "message next"
    "threads next"
    "inplay inplay"
    "story story";
  gap: 1rem;
  align-items: start;
}
.vos-dash-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(201,161,74,0.22);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(18,16,23,0.95), rgba(8,7,11,0.98)),
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,161,74,0.07), transparent 70%);
  box-shadow: 0 18px 46px rgba(0,0,0,0.62);
}
.vos-dash-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.vos-story-card {
  grid-area: story;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.8rem 1rem;
  padding: 1rem 1.15rem;
}
.vos-message-card { grid-area: message; }
.vos-message-card[hidden],
.vos-dash-card[hidden] { display: none !important; }
.vos-next-card { grid-area: next; }
.vos-threads-card { grid-area: threads; }
.vos-dash-side-card {
  padding: 1.1rem 1.2rem 1.2rem;
}
.vos-dash-kicker {
  color: rgba(184,144,72,0.95);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.vos-story-card .vos-card-heading {
  margin: 0.22rem 0 0;
  padding: 0;
  border: none;
  color: #e8cd84;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.9rem;
  letter-spacing: 0.18em;
  line-height: 1.25;
  text-transform: uppercase;
}
.vos-story-card .vos-card-heading::after { content: none; }
.vos-story-card h3 {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  letter-spacing: 0.02em;
  line-height: 1.15;
}
.vos-story-meta {
  display: none;
  margin-bottom: 0.95rem;
  color: rgba(147,138,120,0.95);
  font-family: 'Cormorant Garamond', 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.98rem;
}
.vos-story-card p {
  grid-column: 1;
  flex: 0 1 auto;
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: rgba(233,225,208,0.84);
  font-family: 'Cormorant Garamond', 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  line-height: 1.38;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}
.vos-story-read {
  grid-column: 2;
  grid-row: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.25rem;
  padding: 0.48rem 0.95rem;
  border: 1px solid rgba(201,161,74,0.32);
  border-radius: 999px;
  background: rgba(201,161,74,0.05);
  color: #e8cd84;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-story-read:hover {
  color: var(--vos-cream);
  border-color: rgba(232,205,132,0.8);
  background: rgba(201,161,74,0.12);
}
.vos-dash-side-card h3,
.vos-inplay-card h3 {
  margin: 0.35rem 0 0.75rem;
  color: #e8cd84;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.9rem;
  letter-spacing: 0.18em;
  line-height: 1.25;
  text-transform: uppercase;
}
.vos-next-date {
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.35rem, 2.7vw, 1.8rem);
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.1;
}
.vos-next-where {
  margin: 0.25rem 0 0.75rem;
  color: rgba(147,138,120,0.95);
  font-family: 'Cormorant Garamond', 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.98rem;
}
.vos-next-rsvp {
  margin-top: 0.85rem;
  padding-top: 0.82rem;
  border-top: 1px solid rgba(201,161,74,0.13);
}
.vos-message-title {
  margin: 0.2rem 0 0.45rem;
  color: var(--vos-cream);
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.1rem, 2vw, 1.35rem);
  letter-spacing: 0.04em;
  line-height: 1.18;
}
.vos-message-body {
  margin: 0;
  color: rgba(233,225,208,0.86);
  font-size: 1.03rem;
  line-height: 1.48;
  white-space: pre-wrap;
}
.vos-message-meta {
  margin-top: 0.75rem;
  color: rgba(147,138,120,0.95);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.56rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-thread-list {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.vos-thread {
  display: flex;
  gap: 0.75rem;
  padding: 0.72rem 0;
  border-top: 1px solid rgba(201,161,74,0.11);
}
.vos-thread:first-of-type { border-top: none; padding-top: 0; }
.vos-thread-dot {
  flex: 0 0 auto;
  width: 0.56rem;
  height: 0.56rem;
  border-radius: 50%;
  margin-top: 0.48rem;
  background: #c9a14a;
  box-shadow: 0 0 10px currentColor;
}
.vos-thread-dot.hot { background: #b07732; color: #b07732; }
.vos-thread-dot.pending { background: #c9a14a; color: #c9a14a; }
.vos-thread-dot.slow { background: #647d8d; color: #647d8d; }
.vos-thread-question {
  color: rgba(233,225,208,0.84);
  font-size: 1rem;
  line-height: 1.42;
}
.vos-thread-tag {
  display: block;
  margin-top: 0.28rem;
  color: rgba(147,138,120,0.92);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.56rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-inplay-card {
  grid-area: inplay;
  padding: 1.05rem 1.15rem 1rem;
}
.vos-play-rail {
  flex: 1 1 auto;
  align-content: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  overflow-x: visible;
  padding: 0.1rem 0 0.35rem;
}
.vos-play-chip {
  flex: 1 1 13rem;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.48rem 0.85rem 0.48rem 0.5rem;
  border: 1px solid rgba(201,161,74,0.25);
  border-radius: 999px;
  background: rgba(255,255,255,0.025);
  color: var(--vos-cream);
  text-decoration: none;
}
.vos-play-chip:hover {
  border-color: rgba(232,205,132,0.8);
  background: rgba(201,161,74,0.08);
  color: var(--vos-cream);
}
.vos-play-emblem {
  flex: 0 0 auto;
  width: 1.9rem;
  height: 1.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(201,161,74,0.25);
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, rgba(232,205,132,0.24), rgba(107,85,42,0.42));
  color: #e8cd84;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.vos-play-name {
  font-family: 'Cormorant Garamond', 'Crimson Text', Georgia, serif;
  font-size: 1.02rem;
  line-height: 1.1;
}
.vos-play-name small {
  display: block;
  margin-top: 0.18rem;
  color: rgba(147,138,120,0.92);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.54rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vos-home-studio {
  margin-bottom: 0.5rem;
}
.vos-home-studio .vos-home-sec-head {
  margin-top: 1.35rem;
}

/* Filigree divider — the comedy/tragedy mask piece. */
.vos-home-divider {
  display: block;
  margin: 3.5rem auto 3rem;
  width: 280px; max-width: 80%;
  filter: drop-shadow(0 4px 18px rgba(0,0,0,0.7));
  opacity: 0.9;
}

/* SECTIONS ───────────────────────────────────────────────────────────── */
.vos-home-section {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}
.vos-home-section h2 {
  font-family: 'Cinzel', Georgia, serif;
  color: var(--vos-gold-bright);
  font-size: 1.4rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-align: center;
  margin: 0 0 2rem;
  border: none;
  padding: 0;
}
.vos-home-section h2::after { content: none; }

/* TILES — stack on mobile, single row of 4 on desktop. At the 4-up
   breakpoint we drop the long descriptions so each tile reads as an
   icon (art + kicker + title + arrow). */
.vos-tiles {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  margin-bottom: 1rem;
}
@media (min-width: 560px) {
  .vos-tiles { grid-template-columns: repeat(2, 1fr); }
}
.vos-tile {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  overflow: hidden;
  text-decoration: none;
  border: 1px solid rgba(212,165,116,0.18);
  box-shadow: 0 10px 32px rgba(0,0,0,0.6);
  transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 0.35s, border-color 0.35s;
  isolation: isolate;
}
.vos-tile:hover {
  transform: translateY(-6px);
  border-color: rgba(212,165,116,0.6);
  box-shadow:
    0 18px 48px rgba(0,0,0,0.75),
    0 0 24px rgba(212,165,116,0.18);
}
.vos-tile-art {
  position: absolute; inset: 0; z-index: -2;
  background-size: cover; background-position: center;
  transition: transform 0.6s ease;
}
.vos-tile:hover .vos-tile-art { transform: scale(1.05); }
.vos-tile-shade {
  position: absolute; inset: 0; z-index: -1;
  background: linear-gradient(180deg,
    rgba(7,6,10,0.0) 0%,
    rgba(7,6,10,0.1) 40%,
    rgba(7,6,10,0.85) 100%);
}
.vos-tile-body {
  position: absolute; inset: auto 0 0 0;
  padding: 1.5rem 1.4rem 1.6rem;
  text-align: left;
}
.vos-tile-kicker {
  display: block;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.36em;
  text-transform: uppercase;
  color: var(--vos-gold-bright);
  margin-bottom: 0.55rem;
  text-shadow: 0 1px 4px rgba(0,0,0,0.85);
}
.vos-tile-title {
  display: block;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 1.6rem;
  letter-spacing: 0.04em;
  color: var(--vos-cream);
  margin-bottom: 0.55rem;
  line-height: 1.15;
  text-shadow: 0 2px 12px rgba(0,0,0,0.95);
}
.vos-tile-desc {
  display: block;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.95rem;
  line-height: 1.45;
  color: rgba(232,220,200,0.78);
  text-shadow: 0 1px 6px rgba(0,0,0,0.95);
}
.vos-tile-arrow {
  display: inline-block;
  margin-top: 0.85rem;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.65rem;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--vos-gold-bright);
  transition: letter-spacing 0.2s;
}
.vos-tile:hover .vos-tile-arrow { letter-spacing: 0.42em; }

/* Desktop: 4-up row, compact tiles, descriptions hidden so each tile
   reads as an icon (art + kicker + title + arrow). Placed AFTER the
   base rules above so it actually wins (same specificity, later wins). */
@media (min-width: 1024px) {
  .vos-tiles { grid-template-columns: repeat(4, 1fr); gap: 1rem; }
  .vos-tile { aspect-ratio: 4 / 5; }
  .vos-tile-body { padding: 0.85rem 0.9rem 1rem; }
  .vos-tile-kicker { font-size: 0.5rem; letter-spacing: 0.28em; margin-bottom: 0.4rem; }
  .vos-tile-title { font-size: 0.95rem; line-height: 1.2; margin-bottom: 0.4rem; }
  .vos-tile-desc { display: none; }
  .vos-tile-arrow { font-size: 0.55rem; letter-spacing: 0.28em; margin-top: 0.4rem; }
}

/* CLOSING ────────────────────────────────────────────────────────────── */
.vos-home-closing {
  max-width: 700px;
  margin: 5rem auto 4rem;
  padding: 0 1.75rem;
  text-align: center;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.1rem;
  line-height: 1.75;
  color: var(--vos-text-body);
}
.vos-home-closing h2 {
  font-family: 'Cinzel', Georgia, serif;
  color: var(--vos-gold-bright);
  font-size: 1.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin: 0 0 1.5rem;
  border: none; padding: 0;
}
.vos-home-closing h2::after { content: none; }
.vos-home-closing blockquote {
  border: none;
  margin: 2.5rem 0 0;
  padding: 0;
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  font-size: 1.15rem;
  color: rgba(212,165,116,0.85);
  letter-spacing: 0.03em;
}

@media (max-width: 768px) {
  .vos-home {
    --vos-home-wide: calc(100vw - 2rem);
    margin: -2.25rem 0 0;
  }
  .vos-home-hero { padding: 1.25rem 0 1.35rem; }
  .vos-dash {
    grid-template-columns: 1fr;
    grid-template-areas:
      "message"
      "next"
      "threads"
      "inplay"
      "story";
  }
  .vos-home-sec-head {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.55rem 0.85rem;
  }
  .vos-home-sec-head .vos-home-sec-line {
    order: 3;
    flex-basis: 100%;
  }
  .vos-story-card,
  .vos-dash-side-card,
  .vos-inplay-card {
    padding: 1.1rem 1.05rem 1.2rem;
  }
  .vos-story-card {
    grid-template-columns: 1fr;
  }
  .vos-story-card p,
  .vos-story-read {
    grid-column: 1;
    grid-row: auto;
  }
  .vos-story-card p {
    -webkit-line-clamp: 2;
  }
  .vos-home-section h2 { font-size: 1.1rem; }
  .vos-tiles { grid-template-columns: 1fr 1fr; }
  .vos-tile-title { font-size: 1.15rem; }
  .vos-tile-kicker { font-size: 0.55rem; letter-spacing: 0.28em; }
  .vos-tile-desc { font-size: 0.85rem; }
}
@media (max-width: 480px) {
  .vos-tiles { grid-template-columns: 1fr; }
  .vos-tile { aspect-ratio: 16 / 10; }
}
</style>

<div class="vos-home">

<!-- ── HERO ─────────────────────────────────────────────────────────── -->
<section class="vos-home-hero">
  <div class="vos-hero-banner-wrap">
    <img src="/images/hero3.png" alt="Valley of Shadows" class="vos-hero-banner">
  </div>
</section>

<!-- ── LIVING DASHBOARD ─────────────────────────────────────────────── -->
<section class="vos-home-dashboard" aria-label="Campaign dashboard">
  <div class="vos-dash">
    <article class="vos-dash-card vos-dash-side-card vos-message-card" id="vos-message-card" aria-labelledby="vos-message-heading" hidden>
      <h3 id="vos-message-heading">DM Message</h3>
      <div class="vos-message-title" id="vos-message-title"></div>
      <p class="vos-message-body" id="vos-message-body"></p>
      <div class="vos-message-meta" id="vos-message-meta"></div>
    </article>
    <article class="vos-dash-card vos-dash-side-card vos-next-card" aria-labelledby="vos-next-heading">
      <h3 id="vos-next-heading">Next Gathering</h3>
      <div class="vos-next-date">{{ campaign.nextGathering.date }}</div>
      <div class="vos-next-where">{{ campaign.nextGathering.timeLocation }}</div>
      <ul class="vos-task-list">
        {%- for task in campaign.nextGathering.tasks %}
        <li class="vos-task-row"{% if task.dueIso %} data-reminder-date="{{ task.dueIso }}"{% endif %}>
          <span class="vos-task-check" aria-hidden="true">✓</span>
          <span class="vos-task-main">{{ task.text }}</span>
          {%- if task.due %}<span class="vos-task-date">Due {{ task.due }}</span>{%- endif %}
        </li>
        {%- endfor %}
      </ul>
      <div class="vos-next-rsvp" aria-label="RSVP for the next gathering">
        {% include "partials/rsvp-control.njk" %}
      </div>
    </article>
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
    <article class="vos-dash-card vos-inplay-card" aria-labelledby="vos-inplay-heading">
      <h3 id="vos-inplay-heading">Currently In Play</h3>
      <div class="vos-play-rail">
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

<!-- ── FRESH FROM THE STUDIO ───────────────────────────────────────── -->
<section class="vos-home-dashboard vos-home-studio" aria-labelledby="vos-studio-heading">
  <div class="vos-home-sec-head">
    <h2 id="vos-studio-heading">Fresh From The Studio</h2>
    <span class="vos-home-sec-line"></span>
    <a class="vos-home-sec-more" href="/en/Tools/art/">Open the Art Studio &rarr;</a>
  </div>
  {% set carouselLimit = 5 %}
  {% set carouselLabel = "Fresh from the shared Art Studio gallery" %}
  {% include "partials/gallery-carousel.njk" %}
</section>

</div>

<script>
(function () {
  window.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('vos-message-card');
    const title = document.getElementById('vos-message-title');
    const body = document.getElementById('vos-message-body');
    const meta = document.getElementById('vos-message-meta');
    if (!card || !title || !body || !meta) return;

    function formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    async function loadMessage() {
      const pwa = window.VOS_PWA;
      const name = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity().catch(() => null) : null;
      const headers = pwa && pwa.authHeaders ? pwa.authHeaders() : {};
      const url = name
        ? `/api/messages?limit=1&name=${encodeURIComponent(name)}`
        : '/api/messages?limit=1';
      const response = await fetch(url, { cache: 'no-store', headers });
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      const message = data && data.messages && data.messages[0];
      if (!message) return;
      title.textContent = message.title || 'DM Message';
      body.textContent = message.body || '';
      meta.textContent = formatDate(message.created_at);
      card.hidden = false;
      try {
        localStorage.setItem('vos.dmMessage.seenId', String(message.id));
        window.dispatchEvent(new CustomEvent('vos:avatar-badge-refresh'));
      } catch (error) {}
    }

    loadMessage().catch(() => {});
  });
})();
</script>
