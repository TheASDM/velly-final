---
title: Valley of Shadows — Codex
description: Tales from Venturia & Vallombrosa. The living chronicle of the Valley of Shadows campaign.
published: true
date: 2026-05-22T01:24:39.808Z
tags: locations, character-hooks, market-tiers, religion, abbey, healing, fog-sickness
editor: markdown
dateCreated: 2026-02-20T05:30:38.113Z
---

<style>
/* ─── Home-only styles. Scoped to .vos-home so they don't leak. ─── */
.vos-home { margin: -2.25rem -1.75rem 0; }

/* HERO — wide cinematic banner image (already includes the wordmark) ─ */
.vos-home-hero {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.25rem 0 3rem;
}
.vos-hero-banner {
  display: block;
  width: 100%;
  max-width: 1280px;
  height: auto;
  margin: 0 auto;
  box-shadow:
    0 20px 60px rgba(0,0,0,0.85),
    0 0 0 1px rgba(212,165,116,0.18);
  border-radius: 4px;
}
.vos-hero-banner-wrap {
  position: relative;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto 2.25rem;
}
.vos-hero-banner-wrap::after {
  content: '';
  position: absolute; left: 6%; right: 6%; bottom: -10px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,165,116,0.6), transparent);
}
.vos-hero-tag {
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  font-size: clamp(1.05rem, 1.6vw, 1.3rem);
  color: rgba(232, 220, 200, 0.8);
  letter-spacing: 0.08em;
  margin: 1rem 0 2.5rem 0;
  max-width: 38rem;
  padding: 0 1.5rem;
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

/* LATEST POSTS PANEL ─────────────────────────────────────────────────── */
.vos-latest {
  margin: 2rem auto 0;
  background:
    linear-gradient(180deg, rgba(13,11,17,0.65), rgba(7,6,10,0.85)),
    rgba(139,0,0,0.06);
  border: 1px solid rgba(212,165,116,0.22);
  border-radius: 6px;
  box-shadow: 0 12px 36px rgba(0,0,0,0.55);
  padding: 0;
}
.vos-latest-row {
  padding: 1rem 1.5rem;
  display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
}
.vos-latest-row + .vos-latest-row { border-top: 1px solid rgba(139,115,85,0.18); }
.vos-latest-kicker {
  font-size: 0.6rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--vos-gold-dim);
  flex-shrink: 0;
  min-width: 6rem;
  font-family: 'Cinzel', Georgia, serif;
}
.vos-latest-link {
  flex: 1; min-width: 200px;
  font-size: 1.05rem;
  color: var(--vos-gold-bright);
  text-decoration: none;
  font-style: italic;
  font-family: 'Crimson Text', Georgia, serif;
  border-bottom: none;
}
.vos-latest-link:hover { color: var(--vos-cream); }
.vos-latest-row + .vos-latest-row .vos-latest-link { color: rgba(212,165,116,0.65); }
.vos-latest-date {
  font-size: 0.78rem;
  color: rgba(139,115,85,0.7);
  font-family: 'Cinzel', Georgia, serif;
  letter-spacing: 0.1em;
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
  .vos-home { margin: -2.25rem -1.75rem 0; }
  .vos-home-hero { padding: 1.25rem 0 2rem; }
  .vos-hero-tag { margin-bottom: 2rem; }
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
    <img src="/images/hero1.png" alt="Valley of Shadows" class="vos-hero-banner">
  </div>
  <p class="vos-hero-tag">A living chronicle of the masked city of Venturia and the fog-bound valley beyond it — written between sessions, remembered together.</p>
</section>

<!-- ── TILES (directly under the hero) ──────────────────────────────── -->
<section class="vos-home-section">
  <div class="vos-tiles">

  <a class="vos-tile" href="/en/Venturia/index">
    <div class="vos-tile-art" style="background-image: url('/images/locations/vallombrosa.png')"></div>
    <div class="vos-tile-shade"></div>
    <div class="vos-tile-body">
      <span class="vos-tile-kicker">The World</span>
      <span class="vos-tile-title">The Valley of Shadows</span>
      <span class="vos-tile-desc">A city of tiers, masks, and fog. Locations, factions, the Autumn Council, and every name you'll meet at the table.</span>
      <span class="vos-tile-arrow">Explore →</span>
    </div>
  </a>

  <a class="vos-tile" href="/en/Archive/index">
    <div class="vos-tile-art" style="background-image: url('/images/factions/veil-court.png')"></div>
    <div class="vos-tile-shade"></div>
    <div class="vos-tile-body">
      <span class="vos-tile-kicker">The Long Thread</span>
      <span class="vos-tile-title">Session Chronicles</span>
      <span class="vos-tile-desc">The bound chronicle — every recap stitched into the ongoing tale of the Valley.</span>
      <span class="vos-tile-arrow">Read →</span>
    </div>
  </a>

  <a class="vos-tile" href="/en/Updates/index">
    <div class="vos-tile-art" style="background-image: url('/images/character-art/orabella.png')"></div>
    <div class="vos-tile-shade"></div>
    <div class="vos-tile-body">
      <span class="vos-tile-kicker">Between Sessions</span>
      <span class="vos-tile-title">Updates</span>
      <span class="vos-tile-desc">Bi-weekly notes, scheduling, and what's coming up at the next table.</span>
      <span class="vos-tile-arrow">Catch up →</span>
    </div>
  </a>

  <a class="vos-tile" href="/en/Articles/using-enzo">
    <div class="vos-tile-art" style="background-image: url('/images/locations/covenant-archive.png')"></div>
    <div class="vos-tile-shade"></div>
    <div class="vos-tile-body">
      <span class="vos-tile-kicker">The Loremaster</span>
      <span class="vos-tile-title">Enzo Readme</span>
      <span class="vos-tile-desc">How to talk to Enzo — the chatbot that knows the city and the rules.</span>
      <span class="vos-tile-arrow">Learn →</span>
    </div>
  </a>

  </div>
</section>

<img src="/images/masqueradeline.png" alt="" class="vos-home-divider" aria-hidden="true">

<!-- ── LATEST CHRONICLES (auto-updated by publish.js) ───────────────── -->
<section class="vos-home-section">
  <h2>Latest Chronicles</h2>

<!-- LATEST_POST -->
<div class="vos-latest">
<div class="vos-latest-row">
<span class="vos-latest-kicker">Latest Post</span>
<a class="vos-latest-link" href="/en/Updates/campaign-update-4">Campaign Update #4 — 5/21/2026 →</a>
<span class="vos-latest-date">May 21, 2026</span>
</div>
<div class="vos-latest-row">
<span class="vos-latest-kicker"></span>
<a class="vos-latest-link" href="/en/Updates/campaign-update-3">Campaign Update #3 — 4/5/2026 →</a>
<span class="vos-latest-date">April 5, 2026</span>
</div>
<div class="vos-latest-row">
<span class="vos-latest-kicker"></span>
<a class="vos-latest-link" href="/en/Updates/campaign-update-2">Bi-Weekly Campaign Update #2 — Feb 25 thru Mar 11 →</a>
<span class="vos-latest-date">February 28, 2026</span>
</div>
</div>
<!-- /LATEST_POST -->

</section>

<!-- ── CLOSING ──────────────────────────────────────────────────────── -->
<section class="vos-home-closing">
  <h2>The Codex</h2>
  <div>The Valley of Shadows Codex is the living record of our campaign — an ongoing dark fantasy chronicle set in the masked city of <strong>Venturia</strong> and the fog-bound valley of <strong>Vallombrosa</strong>.</div>
  <div style="margin-top: 1rem;">Browse session recaps, world lore, house rules, and character resources. Everything that happens at the table finds its way here.</div>
  <blockquote>The fog remembers everything. Whether it tells you is another matter.</blockquote>
</section>

</div>
