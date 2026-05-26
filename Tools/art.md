---
title: Art Studio
description: Generate campaign art with Enzo and contribute to the shared player gallery. Choose a style, write a prompt, and the result is auto-saved for everyone to see.
published: true
date: 2026-05-24T00:00:00.000Z
tags: tools, art, gallery, enzo
editor: markdown
dateCreated: 2026-05-24T00:00:00.000Z
---

<style>
/* ── Art Studio — page-scoped styles ─────────────────────────────────── */
.vos-art {
  --art-gold: #ddb77f;
  --art-gold-soft: #b99062;
  --art-gold-dim: #8d765b;
  --art-ink: #08070b;
  --art-panel: rgba(13, 11, 17, 0.9);
  --art-panel-strong: rgba(18, 15, 22, 0.96);
  --art-border: rgba(176, 143, 100, 0.26);
  --art-border-strong: rgba(221, 183, 127, 0.58);
  --art-teal: #7bb7ad;
  --art-ruby: #9f4f5d;
  max-width: 1180px;
  margin: clamp(0.35rem, 2vw, 1.25rem) auto 2rem;
  padding: 0 clamp(0.15rem, 1.5vw, 1rem);
}

.vos-art-app-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 1rem;
  margin: 0 0 1.1rem;
  padding: 0.4rem 0 1rem;
  border-bottom: 1px solid rgba(176, 143, 100, 0.18);
}
.vos-art-app-kicker {
  color: var(--art-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vos-art-app-head h1 {
  margin: 0.1rem 0 0;
  padding: 0;
  border: 0;
  color: #f0d4a5;
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(2rem, 4vw, 3.35rem);
  letter-spacing: 0.04em;
  line-height: 0.98;
  text-shadow: 0 10px 34px rgba(0, 0, 0, 0.75);
}
.vos-art-app-head h1::after { content: none; }
.vos-art-app-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
}
.vos-art-anchor {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0.58rem 0.95rem;
  border: 1px solid rgba(221, 183, 127, 0.38);
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(221, 183, 127, 0.13), rgba(221, 183, 127, 0.04));
  color: var(--art-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 22px rgba(0, 0, 0, 0.28);
}
.vos-art-anchor:hover {
  border-color: var(--art-border-strong);
  background: rgba(221, 183, 127, 0.12);
  color: var(--vos-cream);
}

.vos-art-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(290px, 0.72fr);
  gap: clamp(0.85rem, 2vw, 1.15rem);
  align-items: start;
}

.vos-art-studio {
  position: relative;
  overflow: hidden;
  margin: 0;
  padding: clamp(1.05rem, 2.4vw, 1.55rem);
  border-radius: 8px;
  background:
    radial-gradient(ellipse 90% 45% at 15% 0%, rgba(221, 183, 127, 0.11), transparent 62%),
    radial-gradient(ellipse 70% 50% at 100% 0%, rgba(123, 183, 173, 0.08), transparent 62%),
    linear-gradient(180deg, rgba(20, 18, 24, 0.88), rgba(7, 6, 10, 0.97));
  border: 1px solid var(--art-border);
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
.vos-art-studio::before {
  content: '';
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(221, 183, 127, 0.75), transparent);
  opacity: 0.7;
  pointer-events: none;
}
.vos-art-studio-title {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.85rem;
  font-family: 'Cinzel', Georgia, serif;
  color: var(--art-gold);
  font-size: 0.76rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  margin-bottom: 1rem;
}
.vos-art-studio-title::before {
  content: '✦';
  color: var(--art-gold);
  font-size: 0.85rem;
  margin-right: -0.2rem;
}

.vos-art-row {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(260px, 1.18fr);
  gap: 0.85rem;
  margin-bottom: 0.95rem;
  align-items: stretch;
}
.vos-art-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  margin-bottom: 0.9rem;
}
.vos-art-field-label {
  font-family: 'Cinzel', Georgia, serif;
  color: var(--art-gold);
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.vos-art-prompt {
  width: 100%;
  background: rgba(4, 4, 8, 0.74);
  border: 1px solid var(--art-border);
  border-radius: 8px;
  padding: 0.82rem 0.9rem;
  color: var(--vos-cream);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.04rem;
  line-height: 1.4;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.55);
  resize: vertical;
}
.vos-art-prompt { min-height: 8.3rem; }
.vos-art-prompt:focus {
  outline: none;
  border-color: var(--art-border-strong);
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.4), 0 0 0 3px rgba(221, 183, 127, 0.14);
}

/* Style selector ───────────────────────────────────────────────────── */
.vos-art-style-shell {
  display: grid;
  gap: 0.55rem;
}
.vos-art-select-wrap {
  position: relative;
}
.vos-art-select-wrap::after {
  content: '⌄';
  position: absolute;
  right: 0.95rem;
  top: 50%;
  transform: translateY(-55%);
  color: var(--art-gold);
  font-size: 1.15rem;
  pointer-events: none;
}
.vos-art-style-select {
  appearance: none;
  width: 100%;
  min-height: 54px;
  padding: 0.78rem 2.5rem 0.78rem 0.92rem;
  border: 1px solid var(--art-border-strong);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(40, 32, 27, 0.86), rgba(17, 13, 18, 0.94));
  color: #f2ddbd;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.vos-art-style-select:focus {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(221, 183, 127, 0.16),
    0 10px 24px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.vos-art-style-select option {
  background: #100d14;
  color: #f2ddbd;
}
.vos-art-style-summary {
  min-height: 2.75rem;
  padding: 0.68rem 0.78rem;
  border-left: 2px solid rgba(123, 183, 173, 0.58);
  border-radius: 0 8px 8px 0;
  background: rgba(7, 6, 10, 0.42);
  color: rgba(232, 220, 200, 0.76);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  line-height: 1.35;
}

.vos-art-recent {
  min-width: 0;
}
.vos-art-recent .vos-art-gallery-head {
  margin-top: 0;
}
.vos-art-recent .vos-gallery-carousel {
  min-height: 100%;
}
.vos-art-gallery-section {
  margin-top: 1.65rem;
}

/* Generate button + status row ─────────────────────────────────────── */
.vos-art-actions {
  display: grid;
  grid-template-columns: minmax(180px, 0.38fr) minmax(0, 1fr);
  align-items: stretch;
  gap: 0.8rem;
  margin-top: 0.25rem;
}
.vos-art-btn {
  appearance: none;
  min-height: 52px;
  background:
    linear-gradient(180deg, #f0ca91 0%, #d4a96e 58%, #a87e52 100%);
  color: #0d0b11;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 8px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  padding: 0.9rem 1.3rem;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(221, 183, 127, 0.24),
              inset 0 1px 0 rgba(255,255,255,0.35),
              inset 0 -1px 0 rgba(0,0,0,0.25);
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
}
.vos-art-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(221, 183, 127, 0.42), inset 0 1px 0 rgba(255,255,255,0.4); }
.vos-art-btn:disabled { opacity: 0.55; cursor: progress; transform: none; }
.vos-art-status {
  min-height: 52px;
  display: flex;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(176, 143, 100, 0.18);
  border-radius: 8px;
  background: rgba(7, 6, 10, 0.4);
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  font-size: 0.92rem;
  color: rgba(221, 183, 127, 0.78);
  line-height: 1.35;
}
.vos-art-status:empty { display: none; }
.vos-art-status.is-error { color: #d8645c; }

/* Latest preview slot ─────────────────────────────────────────────── */
.vos-art-latest {
  display: none;
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(7, 6, 10, 0.6);
  border: 1px solid var(--art-border-strong);
  border-radius: 6px;
  text-align: center;
}
.vos-art-latest.is-shown { display: block; }

/* The frame holds either the finished image OR the pending placeholder.
   Aspect-ratio is locked to 1:1 because we always request 1024×1024 —
   reserves the layout space the moment the user submits so nothing
   jumps when the image arrives. */
.vos-art-latest-frame {
  position: relative;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--art-border);
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.75);
  background: #060509;
}
.vos-art-latest-frame img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  display: block;
  opacity: 0;
  transition: opacity 0.35s ease;
  background: #060509;
}
.vos-art-latest.has-image .vos-art-latest-frame img { opacity: 1; }

/* Pending placeholder — shown the moment the user submits. The shimmer
   sweep moves under a darkening gradient, the prompt text floats centered,
   a slow gold pulse confirms work is happening. Replaced by the image
   once it arrives. */
.vos-art-latest-pending {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.85rem;
  padding: 1.5rem 1.8rem;
  background:
    radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20, 18, 24, 0.35), rgba(7, 6, 10, 0.85));
  opacity: 1;
  transition: opacity 0.35s ease;
}
.vos-art-latest.has-image .vos-art-latest-pending { opacity: 0; pointer-events: none; }
.vos-art-latest.has-error .vos-art-latest-frame {
  display: none;
}
.vos-art-latest-pending::before {
  /* Slow gold shimmer sweep — the visual heartbeat of "still working". */
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(115deg,
    transparent 30%,
    rgba(212, 165, 116, 0.10) 50%,
    transparent 70%);
  background-size: 250% 100%;
  animation: vos-art-shimmer 3.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes vos-art-shimmer {
  0%   { background-position: 200% 50%; }
  100% { background-position: -100% 50%; }
}
.vos-art-latest-spinner {
  font-size: 2.4rem;
  color: var(--art-gold);
  text-shadow: 0 0 14px rgba(212, 165, 116, 0.55);
  animation: vos-art-spin 2.8s linear infinite, vos-art-pulse 1.6s ease-in-out infinite;
}
@keyframes vos-art-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes vos-art-pulse {
  0%, 100% { opacity: 0.65; text-shadow: 0 0 10px rgba(212, 165, 116, 0.35); }
  50%      { opacity: 1.0;  text-shadow: 0 0 22px rgba(212, 165, 116, 0.85); }
}
.vos-art-latest-pending-prompt {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 1rem;
  line-height: 1.45;
  color: rgba(232, 220, 200, 0.9);
  max-width: 36rem;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
  /* Truncate long prompts so the placeholder stays tidy. */
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.vos-art-latest-pending-status {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(212, 165, 116, 0.65);
}
.vos-art-latest-pending-status::after {
  /* Trailing dots animate to underline that it's actively working. */
  content: '';
  display: inline-block;
  width: 1.5em;
  text-align: left;
  animation: vos-art-dots 1.5s steps(4, end) infinite;
}
@keyframes vos-art-dots {
  0%       { content: ''; }
  25%      { content: '.'; }
  50%      { content: '..'; }
  75%, 100%{ content: '...'; }
}

.vos-art-latest-caption {
  margin-top: 0.7rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(232, 220, 200, 0.78);
  font-size: 0.92rem;
}
.vos-art-latest-error {
  display: grid;
  gap: 0.65rem;
  justify-items: center;
  padding: 0.35rem 0 0.2rem;
}
.vos-art-latest-error strong {
  color: #d8645c;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vos-art-latest-error p {
  max-width: 42rem;
  margin: 0;
  color: rgba(232, 220, 200, 0.78);
}
.vos-art-retry {
  appearance: none;
  min-height: 2.35rem;
  padding: 0.48rem 0.95rem;
  border: 1px solid var(--art-border-strong);
  border-radius: 999px;
  background: rgba(221, 183, 127, 0.08);
  color: var(--art-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
}

/* "Let Enzo refine my prompt" checkbox row ─────────────────────────── */
.vos-art-enhance-toggle {
  display: flex; gap: 0.8rem; align-items: center;
  height: 100%;
  cursor: pointer;
  padding: 0.78rem 0.9rem;
  background:
    linear-gradient(180deg, rgba(123, 183, 173, 0.08), rgba(7, 6, 10, 0.48));
  border: 1px solid var(--art-border);
  border-radius: 8px;
  transition: border-color 0.15s, background 0.15s;
}
.vos-art-enhance-toggle:hover { border-color: var(--art-border-strong); }
.vos-art-enhance-toggle input[type="checkbox"] {
  flex: 0 0 auto;
  width: 1.08rem; height: 1.08rem; margin: 0;
  accent-color: var(--art-gold);
}
.vos-art-enhance-text {
  display: flex; flex-direction: column; gap: 0.2rem;
}
.vos-art-enhance-text strong {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.68rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--art-gold);
  font-weight: 700;
}
.vos-art-enhance-text em {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.85rem;
  color: rgba(232, 220, 200, 0.72);
  line-height: 1.35;
}

/* "How Enzo saw it" disclosure ─────────────────────────────────────── */
.vos-art-details {
  margin-top: 0.9rem;
  text-align: left;
  border-top: 1px dashed rgba(139, 115, 85, 0.25);
  padding-top: 0.7rem;
}
.vos-art-details > summary {
  cursor: pointer;
  list-style: none;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--art-gold-dim);
  padding: 0.2rem 0;
}
.vos-art-details > summary::-webkit-details-marker { display: none; }
.vos-art-details > summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 0.45rem;
  transition: transform 0.18s;
  color: var(--art-gold);
  font-size: 0.72rem;
}
.vos-art-details[open] > summary::before { transform: rotate(90deg); }
.vos-art-details > summary:hover { color: var(--art-gold); }
.vos-art-enhanced {
  margin: 0.55rem 0 0;
  padding: 0.7rem 0.9rem;
  background: rgba(13, 11, 17, 0.6);
  border-left: 2px solid rgba(212, 165, 116, 0.45);
  border-radius: 0 3px 3px 0;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(232, 220, 200, 0.85);
  font-size: 0.92rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Grounded-entity chips (gallery cards + lightbox) ─────────────────── */
.vos-art-grounded {
  display: flex; flex-wrap: wrap; gap: 0.3rem;
  margin-top: 0.45rem;
}
.vos-art-grounded-chip {
  display: inline-flex; align-items: center;
  padding: 0.18rem 0.55rem;
  background: rgba(212, 165, 116, 0.12);
  color: var(--art-gold);
  border: 1px solid rgba(212, 165, 116, 0.35);
  border-radius: 999px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 600;
  white-space: nowrap;
}
.vos-art-grounded-chip::before {
  content: '✦';
  margin-right: 0.3rem;
  font-size: 0.6rem;
  color: var(--art-gold);
  opacity: 0.85;
}

/* Gallery grid ─────────────────────────────────────────────────────── */
.vos-art-gallery-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
  flex-wrap: wrap;
  margin: 2rem 0 0.85rem;
}
.vos-art-gallery-head h2 {
  font-family: 'Cinzel', Georgia, serif;
  color: #f0d4a5;
  font-size: 1rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin: 0;
  border: none;
}
.vos-art-gallery-head h2::after { content: none; }
.vos-art-gallery-count {
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  color: rgba(221, 183, 127, 0.58);
  font-size: 0.9rem;
}
.vos-art-gallery-tools {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}
.vos-art-refresh {
  appearance: none;
  width: 2.15rem;
  height: 2.15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(221, 183, 127, 0.34);
  border-radius: 50%;
  background: rgba(7, 6, 10, 0.55);
  color: var(--art-gold);
  cursor: pointer;
  font-size: 1.05rem;
  line-height: 1;
}
.vos-art-refresh.is-refreshing {
  animation: vos-art-spin 1.1s linear infinite;
  cursor: progress;
}

.vos-art-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
  gap: clamp(0.85rem, 2vw, 1.1rem);
  margin: 0 0 1.5rem;
}
@media (min-width: 960px) {
  .vos-art-gallery .vos-art-card:first-child {
    grid-column: span 2;
  }
  .vos-art-gallery .vos-art-card:first-child img {
    aspect-ratio: 2 / 1;
  }
}

.vos-art-card {
  position: relative;
  display: block;
  border-radius: 8px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(17, 14, 20, 0.95), rgba(6, 5, 9, 0.98));
  border: 1px solid var(--art-border);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.52);
  cursor: zoom-in;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.vos-art-card:hover {
  transform: translateY(-3px);
  border-color: var(--art-border-strong);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.72), 0 0 24px rgba(221, 183, 127, 0.16);
}
.vos-art-card img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: #0a0a0d;
}
.vos-art-card-meta {
  padding: 0.68rem 0.82rem 0.82rem;
  border-top: 1px solid rgba(139, 115, 85, 0.16);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.88rem;
  line-height: 1.35;
  color: rgba(232, 220, 200, 0.78);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.vos-art-card-byline {
  font-style: normal;
  font-family: 'Cinzel', Georgia, serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.55rem;
  color: var(--art-gold-dim);
  margin-top: 0.4rem;
  display: block;
}

/* Lightbox modal ───────────────────────────────────────────────────── */
.vos-art-lightbox {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(5, 4, 8, 0.94);
  display: none;
  /* The modal itself scrolls — anchoring to flex-start ensures long
     content (image + caption + expanded "How Enzo saw it" details) is
     reachable instead of being clipped to 90vh. */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 2rem;
  backdrop-filter: blur(6px);
}
.vos-art-lightbox.is-open {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.vos-art-lightbox-inner {
  position: relative;
  margin: auto;            /* centers vertically while content < viewport */
  max-width: min(94vw, 1400px);
  display: flex; flex-direction: column;
  align-items: center;
  gap: 0.85rem;
}
.vos-art-lightbox img {
  max-width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 14px 60px rgba(0, 0, 0, 0.85);
  border: 1px solid var(--art-border-strong);
}
.vos-art-lightbox-caption {
  max-width: 90ch;
  text-align: center;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(232, 220, 200, 0.85);
  font-size: 0.96rem;
  line-height: 1.45;
}
.vos-art-lightbox-byline {
  font-family: 'Cinzel', Georgia, serif;
  font-style: normal;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 0.65rem;
  color: var(--art-gold);
  margin-top: 0.5rem;
}
.vos-art-lightbox-close {
  position: absolute; top: -2.4rem; right: 0;
  background: transparent;
  color: var(--art-gold);
  border: 1px solid var(--art-border-strong);
  border-radius: 50%;
  width: 2.1rem; height: 2.1rem;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.vos-art-lightbox-close:hover { background: rgba(212, 165, 116, 0.12); color: var(--vos-cream); }

.vos-art-empty {
  padding: 2rem 1.4rem;
  text-align: center;
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  color: rgba(212, 165, 116, 0.55);
  font-size: 1rem;
  border: 1px dashed var(--art-border);
  border-radius: 6px;
  background: rgba(7, 6, 10, 0.4);
}

/* DM mode — discrete row at the bottom of the page. Idle = a single
   small link; active = a pill showing "DM mode" with an exit affordance.
   The passphrase prompt expands inline only on click; nothing about the
   surface should hint that delete is possible until DM toggles it. */
.vos-art-dm-row {
  margin: 1.5rem 0 0.5rem;
  text-align: right;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}
.vos-art-dm-link {
  background: none; border: none;
  color: rgba(139, 115, 85, 0.55);
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  border-radius: 3px;
  transition: color 0.15s, background 0.15s;
}
.vos-art-dm-link:hover { color: var(--art-gold); background: rgba(212, 165, 116, 0.06); }

.vos-art-dm-prompt {
  display: none;
  margin-top: 0.65rem;
  padding: 0.65rem 0.8rem;
  background: rgba(7, 6, 10, 0.65);
  border: 1px solid var(--art-border);
  border-radius: 4px;
  text-align: left;
  font-family: 'Crimson Text', Georgia, serif;
  text-transform: none;
  letter-spacing: 0;
}
.vos-art-dm-prompt.is-open { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.vos-art-dm-prompt input {
  flex: 1; min-width: 180px;
  background: rgba(7, 6, 10, 0.85);
  border: 1px solid var(--art-border);
  border-radius: 3px;
  color: var(--vos-cream);
  font-family: inherit;
  font-size: 0.92rem;
  padding: 0.4rem 0.55rem;
}
.vos-art-dm-prompt input:focus {
  outline: none;
  border-color: var(--art-border-strong);
  box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.12);
}
.vos-art-dm-prompt button {
  background: linear-gradient(180deg, #e6c08a 0%, #c9a371 100%);
  color: #0d0b11;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 3px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.65rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}
.vos-art-dm-prompt-msg {
  flex: 1 1 100%;
  font-size: 0.8rem;
  font-style: italic;
  color: rgba(212, 165, 116, 0.6);
  margin-top: 0.2rem;
}
.vos-art-dm-prompt-msg.is-error { color: #d8645c; }

/* Active-DM pill replaces the link once a valid passphrase is held. */
.vos-art-dm-pill {
  display: none;
  align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.7rem;
  background: rgba(212, 165, 116, 0.12);
  color: var(--art-gold);
  border: 1px solid var(--art-border-strong);
  border-radius: 999px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}
.vos-art-dm-pill.is-active { display: inline-flex; }
.vos-art-dm-pill::before { content: '✦'; }
.vos-art-dm-exit {
  background: none; border: none; padding: 0;
  color: rgba(212, 165, 116, 0.7);
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  text-transform: uppercase;
  border-left: 1px solid rgba(212, 165, 116, 0.3);
  padding-left: 0.5rem;
  margin-left: 0.2rem;
}
.vos-art-dm-exit:hover { color: var(--vos-cream); }

/* Delete buttons — visible only when body.is-dm-mode. The card variant
   sits in the top-right of each tile; the lightbox variant lives next
   to the close button. Both are red-tinged so they read as destructive
   without overpowering the gold theme. */
.vos-art-delete {
  position: absolute;
  top: 0.5rem; right: 0.5rem;
  z-index: 5;
  display: none;
  width: 1.9rem; height: 1.9rem;
  border-radius: 50%;
  background: rgba(10, 8, 12, 0.85);
  border: 1px solid rgba(180, 50, 50, 0.55);
  color: #ff8780;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}
body.is-dm-mode .vos-art-delete { display: inline-flex; }
.vos-art-delete:hover {
  background: rgba(120, 30, 30, 0.7);
  color: #fff;
  transform: scale(1.06);
}
.vos-art-delete[disabled] { opacity: 0.5; cursor: progress; }

.vos-art-lightbox-delete {
  position: absolute; top: -2.4rem; right: 3rem;
  display: none;
  background: transparent;
  color: #ff8780;
  border: 1px solid rgba(180, 50, 50, 0.55);
  border-radius: 50%;
  width: 2.1rem; height: 2.1rem;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
body.is-dm-mode .vos-art-lightbox-delete { display: inline-flex; }
.vos-art-lightbox-delete:hover { background: rgba(180, 50, 50, 0.2); color: #fff; }

@media (max-width: 860px) {
  .vos-art {
    margin-top: 0;
    padding: 0;
  }
  .vos-art-app-head {
    align-items: center;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.65rem;
    padding: 0.1rem 0 0.85rem;
  }
  .vos-art-app-head h1 {
    font-size: 2rem;
  }
  .vos-art-app-actions {
    width: auto;
  }
  .vos-art-anchor {
    width: auto;
    min-width: 0;
    min-height: 38px;
    padding: 0.5rem 0.76rem;
  }
  .vos-art-workbench {
    grid-template-columns: 1fr;
  }
  .vos-art-studio {
    padding: 1rem;
  }
  .vos-art-studio-title,
  .vos-art-gallery-head h2 {
    font-size: 0.82rem;
    letter-spacing: 0.14em;
  }
  .vos-art-studio-title {
    margin-bottom: 0.75rem;
  }
  .vos-art-gallery-head {
    margin: 1.35rem 0 0.75rem;
  }
  .vos-art-row {
    grid-template-columns: 1fr;
    gap: 0.55rem;
    margin-bottom: 0.55rem;
  }
  .vos-art-field {
    margin-bottom: 0.7rem;
  }
  .vos-art-field-label {
    font-size: 0.58rem;
    letter-spacing: 0.18em;
  }
  .vos-art-prompt {
    font-size: 0.98rem;
    padding: 0.72rem;
  }
  .vos-art-prompt {
    min-height: 6.25rem;
  }
  .vos-art-style-select {
    min-height: 50px;
    font-size: 0.68rem;
    letter-spacing: 0.13em;
  }
  .vos-art-style-summary {
    display: none;
  }
  .vos-art-enhance-toggle { padding: 0.68rem 0.8rem; }
  .vos-art-enhance-text strong {
    font-size: 0.68rem;
    letter-spacing: 0.13em;
  }
  .vos-art-actions {
    grid-template-columns: 1fr;
    margin-top: 0;
  }
  .vos-art-btn {
    width: 100%;
  }
}
</style>

<div class="vos-art">

<header class="vos-art-app-head">
  <div>
    <div class="vos-art-app-kicker">Tools</div>
    <h1>Studio</h1>
  </div>
  <div class="vos-art-app-actions">
    <a class="vos-art-anchor" href="#vos-art-gallery-section">Gallery</a>
  </div>
</header>

<div class="vos-art-workbench">

<section class="vos-art-studio" aria-label="Generate new art">
  <div class="vos-art-studio-title">Compose a New Piece</div>

  <div class="vos-art-field">
    <label class="vos-art-field-label" for="vos-art-prompt">Description</label>
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
        <strong>Let Enzo refine my prompt</strong>
        <em>Improves campaign references and image phrasing.</em>
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
</section>

<section class="vos-art-recent" aria-labelledby="vos-art-recent-title">
  <div class="vos-art-gallery-head">
    <h2 id="vos-art-recent-title">Recent</h2>
    <div class="vos-art-gallery-count">Latest shared pieces</div>
  </div>
  {% set carouselLimit = 5 %}
  {% set carouselLabel = "Featured recent shared gallery images" %}
  {% include "partials/gallery-carousel.njk" %}
</section>

</div>

<section class="vos-art-gallery-section" id="vos-art-gallery-section" aria-labelledby="vos-art-gallery-title">
  <div class="vos-art-gallery-head">
    <h2 id="vos-art-gallery-title">Shared Gallery</h2>
    <div class="vos-art-gallery-tools">
      <button id="vos-art-gallery-refresh" class="vos-art-refresh" type="button" aria-label="Refresh gallery" title="Refresh gallery">↻</button>
      <div class="vos-art-gallery-count" id="vos-art-gallery-count">Loading…</div>
    </div>
  </div>

  <div id="vos-art-gallery" class="vos-art-gallery"></div>
</section>

<div class="vos-art-dm-row">
  <span id="vos-art-dm-pill" class="vos-art-dm-pill">
    <span>DM mode</span>
    <button id="vos-art-dm-exit" class="vos-art-dm-exit" type="button">exit</button>
  </span>
  <button id="vos-art-dm-link" class="vos-art-dm-link" type="button" aria-expanded="false">DM access</button>
  <div id="vos-art-dm-prompt" class="vos-art-dm-prompt">
    <input id="vos-art-dm-input" type="password" autocomplete="current-password" placeholder="DM passphrase" aria-label="DM passphrase">
    <button id="vos-art-dm-submit" type="button">unlock</button>
    <div id="vos-art-dm-msg" class="vos-art-dm-prompt-msg" role="status" aria-live="polite"></div>
  </div>
</div>

<div id="vos-art-lightbox" class="vos-art-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vos-art-lightbox-caption">
  <div class="vos-art-lightbox-inner">
    <button class="vos-art-lightbox-delete" id="vos-art-lightbox-delete" type="button" aria-label="Delete this image (DM)" title="Delete this image">×</button>
    <button class="vos-art-lightbox-close" type="button" aria-label="Close lightbox">×</button>
    <img id="vos-art-lightbox-img" alt="">
    <div id="vos-art-lightbox-caption" class="vos-art-lightbox-caption"></div>
  </div>
</div>

</div>

<script>
(function () {
  const API_BASE = '';
  const STYLE_KEY = 'velly.artStudio.lastStyle';
  const ACTIVE_JOB_KEY = 'velly.artStudio.activeJobId';
  const POLL_MS = 2500;

  const $ = (id) => document.getElementById(id);
  const promptEl         = $('vos-art-prompt');
  const styleSelectEl    = $('vos-art-style-select');
  const styleSummaryEl   = $('vos-art-style-summary');
  const enhanceEl        = $('vos-art-enhance');
  const generateEl       = $('vos-art-generate');
  const statusEl         = $('vos-art-status');
  const latestEl         = $('vos-art-latest');
  const latestImg        = $('vos-art-latest-img');
  const latestCap        = $('vos-art-latest-caption');
  const latestDetails    = $('vos-art-latest-details');
  const latestEnhanced   = $('vos-art-latest-enhanced');
  const pendingPromptEl  = $('vos-art-latest-pending-prompt');
  const pendingStatusEl  = $('vos-art-latest-pending-status');
  const galleryEl        = $('vos-art-gallery');
  const countEl          = $('vos-art-gallery-count');
  const gallerySection   = $('vos-art-gallery-section');
  const refreshGalleryEl = $('vos-art-gallery-refresh');
  const lightbox         = $('vos-art-lightbox');
  const lightImg         = $('vos-art-lightbox-img');
  const lightCap         = $('vos-art-lightbox-caption');
  const lightDelete      = $('vos-art-lightbox-delete');
  const dmPill           = $('vos-art-dm-pill');
  const dmLink           = $('vos-art-dm-link');
  const dmPromptEl       = $('vos-art-dm-prompt');
  const dmInput          = $('vos-art-dm-input');
  const dmSubmit         = $('vos-art-dm-submit');
  const dmMsg            = $('vos-art-dm-msg');
  const dmExit           = $('vos-art-dm-exit');

  const ENHANCE_KEY = 'velly.artStudio.enhance';

  // The top nav has `backdrop-filter`, which creates a stacking context.
  // Our lightbox sits inside <article> inside <main>, where its z-index
  // only competes within the article's context — so it ends up rendered
  // below the nav even with z-index 2000. Hoisting it directly under
  // <body> puts it in the same stacking context as the nav, where its
  // z-index actually wins.
  if (lightbox && lightbox.parentNode !== document.body) {
    document.body.appendChild(lightbox);
  }

  let selectedStyle = null;
  let defaultStyle = 'valley';
  let availableStyles = [];
  let activeJobId = null;
  let pollTimer = null;
  let isSubmitting = false;
  let galleryHasLoaded = false;

  try {
    const lastEnhance = localStorage.getItem(ENHANCE_KEY);
    if (lastEnhance === '0') enhanceEl.checked = false;
  } catch (e) {}

  enhanceEl.addEventListener('change', () => {
    try { localStorage.setItem(ENHANCE_KEY, enhanceEl.checked ? '1' : '0'); } catch (e) {}
  });

  // ── Styles ───────────────────────────────────────────────────────────
  function getCurrentCreatorName() {
    if (window.VOS_PWA && window.VOS_PWA.getPlayerName) {
      const name = window.VOS_PWA.getPlayerName();
      return name && typeof name === 'string' ? name.trim() : '';
    }
    try {
      return (localStorage.getItem('vos.playerName') || '').trim();
    } catch (e) {
      return '';
    }
  }

  async function getCreatorName() {
    if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
      const name = await window.VOS_PWA.ensureIdentity();
      return name && typeof name === 'string' ? name.trim() : '';
    }
    return getCurrentCreatorName();
  }

  function requestHeaders(headers) {
    const token = window.VOS_PWA && window.VOS_PWA.getAuthToken
      ? window.VOS_PWA.getAuthToken()
      : '';
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  function renderStyles(styles) {
    availableStyles = Array.isArray(styles) ? styles : [];
    styleSelectEl.innerHTML = '';
    let savedKey = null;
    try { savedKey = localStorage.getItem(STYLE_KEY); } catch (e) {}
    selectedStyle = savedKey && availableStyles.some(s => s.key === savedKey)
      ? savedKey
      : defaultStyle;

    if (!availableStyles.length) {
      selectedStyle = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Styles unavailable';
      styleSelectEl.appendChild(opt);
      styleSummaryEl.textContent = 'Could not load style choices.';
      return;
    }

    if (!availableStyles.some(s => s.key === selectedStyle)) {
      selectedStyle = availableStyles[0].key;
    }

    availableStyles.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = s.label;
      styleSelectEl.appendChild(opt);
    });
    styleSelectEl.value = selectedStyle;
    updateStyleSummary();
  }

  function updateStyleSummary() {
    const active = availableStyles.find(s => s.key === selectedStyle);
    styleSummaryEl.textContent = active ? active.description : '';
  }

  styleSelectEl.addEventListener('change', () => {
    selectedStyle = styleSelectEl.value;
    try { localStorage.setItem(STYLE_KEY, selectedStyle); } catch (e) {}
    updateStyleSummary();
  });

  fetch(API_BASE + '/api/art-styles')
    .then(r => r.json())
    .then(data => {
      defaultStyle = data.default || defaultStyle;
      renderStyles(data.styles || []);
    })
    .catch(() => {
      renderStyles([]);
    });

  // ── Gallery ──────────────────────────────────────────────────────────
  function fmtRel(iso) {
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400)return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function assetUrl(url) {
    if (!url) return '';
    return /^https?:\/\//i.test(url) || url.startsWith('data:')
      ? url
      : API_BASE + url;
  }

  function renderGallery(entries, total) {
    galleryEl.innerHTML = '';
    countEl.textContent = total === 0 ? 'No art yet — be the first.' : `${total} piece${total === 1 ? '' : 's'} in the gallery`;
    if (!entries.length) {
      galleryEl.innerHTML = `<div class="vos-art-empty">The gallery is empty. Generate something above and it will land here.</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    entries.forEach(e => {
      const card = document.createElement('a');
      card.className = 'vos-art-card';
      card.href = assetUrl(e.image_url);
      card.dataset.entryId = e.id;
      card.dataset.entry = JSON.stringify(e);
      card.addEventListener('click', (evt) => {
        evt.preventDefault();
        openLightbox(e);
      });
      // Delete button (CSS-hidden unless body.is-dm-mode). Stop propagation
      // so clicking it doesn't also trigger the lightbox open.
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'vos-art-delete';
      del.title = 'Delete (DM)';
      del.setAttribute('aria-label', 'Delete this image');
      del.textContent = '✕';
      del.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        deleteEntry(e, del);
      });
      card.appendChild(del);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = e.prompt || 'Gallery piece';
      img.src = assetUrl(e.image_url);
      card.appendChild(img);
      const meta = document.createElement('div');
      meta.className = 'vos-art-card-meta';
      meta.textContent = e.prompt || '(no prompt recorded)';
      if (e.grounded_in && e.grounded_in.length) {
        const chips = document.createElement('div');
        chips.className = 'vos-art-grounded';
        e.grounded_in.slice(0, 3).forEach(name => {
          const chip = document.createElement('span');
          chip.className = 'vos-art-grounded-chip';
          chip.textContent = name;
          chips.appendChild(chip);
        });
        meta.appendChild(chips);
      }
      const byline = document.createElement('span');
      byline.className = 'vos-art-card-byline';
      const who = e.created_by ? `By ${e.created_by}` : 'Anonymous';
      byline.textContent = `${who} · ${fmtRel(e.created_at)}`;
      meta.appendChild(byline);
      card.appendChild(meta);
      frag.appendChild(card);
    });
    galleryEl.appendChild(frag);
  }

  function setGalleryRefreshing(refreshing) {
    if (refreshGalleryEl) {
      refreshGalleryEl.disabled = refreshing;
      refreshGalleryEl.classList.toggle('is-refreshing', refreshing);
    }
  }

  function loadGallery(options = {}) {
    const quiet = !!options.quiet;
    if (!quiet || !galleryHasLoaded) countEl.textContent = 'Loading…';
    setGalleryRefreshing(true);
    return fetch(API_BASE + '/api/gallery?limit=80')
      .then(r => r.json())
      .then(data => {
        galleryHasLoaded = true;
        renderGallery(data.entries || [], data.total || 0);
      })
      .catch(() => {
        countEl.textContent = 'Gallery unavailable.';
        if (!galleryHasLoaded) {
          galleryEl.innerHTML = `<div class="vos-art-empty">Couldn't reach the gallery. Try again in a moment.</div>`;
        }
      })
      .finally(() => setGalleryRefreshing(false));
  }
  loadGallery();
  refreshGalleryEl.addEventListener('click', () => loadGallery({ quiet: true }));

  let pullStartY = null;
  gallerySection.addEventListener('touchstart', (event) => {
    if (window.scrollY > gallerySection.offsetTop - 20) return;
    pullStartY = event.touches[0].clientY;
  }, { passive: true });
  gallerySection.addEventListener('touchend', (event) => {
    if (pullStartY === null) return;
    const endY = event.changedTouches[0].clientY;
    if (endY - pullStartY > 72) loadGallery({ quiet: true });
    pullStartY = null;
  }, { passive: true });

  // ── Lightbox ────────────────────────────────────────────────────────
  let currentLightboxEntry = null;
  function openLightbox(e) {
    currentLightboxEntry = e;
    lightImg.src = assetUrl(e.image_url);
    lightImg.alt = e.prompt || '';
    const who = e.created_by ? `By ${escapeHtml(e.created_by)}` : 'Anonymous';
    let html = escapeHtml(e.prompt || '(no prompt recorded)');
    if (e.grounded_in && e.grounded_in.length) {
      const chips = e.grounded_in.map(n =>
        `<span class="vos-art-grounded-chip">${escapeHtml(n)}</span>`
      ).join('');
      html += `<div class="vos-art-grounded" style="justify-content:center;margin-top:0.55rem;">${chips}</div>`;
    }
    if (e.enhanced_prompt && e.enhanced_prompt !== e.prompt) {
      html += `<details class="vos-art-details" style="margin-top:0.8rem;">
        <summary>How Enzo saw it</summary>
        <div class="vos-art-enhanced">${escapeHtml(e.enhanced_prompt)}</div>
      </details>`;
    }
    html += `<div class="vos-art-lightbox-byline">${who} · ${fmtRel(e.created_at)}</div>`;
    lightCap.innerHTML = html;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    // Scroll the lightbox back to top so the image is visible whenever a
    // new entry is opened, even after the previous one scrolled down.
    lightbox.scrollTop = 0;
  }
  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightImg.src = '';
    currentLightboxEntry = null;
  }
  document.addEventListener('vos:open-gallery-piece', (evt) => {
    if (!evt.detail) return;
    evt.preventDefault();
    openLightbox(evt.detail);
  });
  lightDelete.addEventListener('click', () => {
    if (currentLightboxEntry) deleteEntry(currentLightboxEntry, lightDelete);
  });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  lightbox.querySelector('.vos-art-lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  // ── Generate ─────────────────────────────────────────────────────────
  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  // ── DM mode ─────────────────────────────────────────────────────────
  // The DM passphrase is held in sessionStorage so it survives reloads
  // within a tab but evaporates when the tab closes. Every delete request
  // re-sends the passphrase via the X-DM-Passphrase header; a stale or
  // server-changed value returns 403 and we drop back to player mode.
  const DM_KEY = 'velly.artStudio.dm';

  function getDM() {
    try { return sessionStorage.getItem(DM_KEY) || ''; } catch (e) { return ''; }
  }
  function setDM(value) {
    try {
      if (value) sessionStorage.setItem(DM_KEY, value);
      else sessionStorage.removeItem(DM_KEY);
    } catch (e) {}
    document.body.classList.toggle('is-dm-mode', !!value);
    dmPill.classList.toggle('is-active', !!value);
    dmLink.style.display = value ? 'none' : '';
  }
  // Restore mode on page load.
  if (getDM()) setDM(getDM());

  function setDmMsg(text, isError) {
    dmMsg.textContent = text || '';
    dmMsg.classList.toggle('is-error', !!isError);
  }

  dmLink.addEventListener('click', () => {
    const open = dmPromptEl.classList.toggle('is-open');
    dmLink.setAttribute('aria-expanded', String(open));
    if (open) {
      dmInput.value = '';
      setDmMsg('');
      setTimeout(() => dmInput.focus(), 50);
    }
  });

  async function tryUnlock() {
    const candidate = dmInput.value.trim();
    if (!candidate) { setDmMsg('Enter a passphrase.', true); return; }
    dmSubmit.disabled = true;
    try {
      const res = await fetch(API_BASE + '/api/dm-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: candidate }),
      });
      if (res.status === 503) {
        setDmMsg('DM mode is not configured on this server.', true);
        return;
      }
      if (!res.ok) {
        setDmMsg('That passphrase did not match.', true);
        return;
      }
      setDM(candidate);
      dmPromptEl.classList.remove('is-open');
      dmLink.setAttribute('aria-expanded', 'false');
      setDmMsg('');
      // Re-render the gallery to expose delete buttons on existing cards.
      loadGallery();
    } catch (e) {
      setDmMsg('Could not verify — try again.', true);
    } finally {
      dmSubmit.disabled = false;
    }
  }
  dmSubmit.addEventListener('click', tryUnlock);
  dmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
    if (e.key === 'Escape') { dmPromptEl.classList.remove('is-open'); }
  });
  dmExit.addEventListener('click', () => {
    setDM('');
    setDmMsg('');
    closeLightbox();
    loadGallery();
  });

  async function deleteEntry(entry, sourceButton) {
    const passphrase = getDM();
    if (!passphrase) return;
    const ok = confirm(
      `Delete this image?\n\n"${entry.prompt || '(no prompt)'}"\n\n` +
      `This is permanent — the PNG and its manifest entry are removed from the server.`
    );
    if (!ok) return;
    if (sourceButton) sourceButton.disabled = true;
    try {
      const res = await fetch(API_BASE + '/api/gallery/' + encodeURIComponent(entry.id), {
        method: 'DELETE',
        headers: { 'X-DM-Passphrase': passphrase },
      });
      if (res.status === 403) {
        // Stale passphrase — drop back to player mode.
        setDM('');
        alert('Server rejected the passphrase. DM mode disabled.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // Optimistic UI removal of the lightbox + card before the reload.
      closeLightbox();
      const card = galleryEl.querySelector(`[data-entry-id="${entry.id}"]`);
      if (card) card.remove();
      // Then re-sync from the server so counts and pagination stay honest.
      setTimeout(loadGallery, 150);
    } catch (e) {
      alert('Delete failed: ' + e.message);
      if (sourceButton) sourceButton.disabled = false;
    }
  }

  // ── Server-owned generation jobs ─────────────────────────────────────
  function storeActiveJob(jobId) {
    activeJobId = jobId || null;
    try {
      if (activeJobId) localStorage.setItem(ACTIVE_JOB_KEY, activeJobId);
      else localStorage.removeItem(ACTIVE_JOB_KEY);
    } catch (e) {}
  }

  function getStoredActiveJob() {
    try { return localStorage.getItem(ACTIVE_JOB_KEY) || ''; } catch (e) { return ''; }
  }

  function clearPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function setGenerateButton(disabled, text) {
    generateEl.disabled = !!disabled;
    generateEl.textContent = text || 'Generate';
  }

  function showSubmitting() {
    latestEl.classList.remove('is-shown', 'has-image', 'has-error');
    setGenerateButton(true, 'Submitting…');
    setStatus('Submitting job to the Studio.');
  }

  function showGenerating(job) {
    latestImg.removeAttribute('src');
    latestImg.alt = '';
    latestCap.innerHTML = '';
    latestDetails.style.display = 'none';
    latestEnhanced.innerHTML = '';
    pendingPromptEl.textContent = job.prompt || promptEl.value.trim();
    pendingStatusEl.textContent = 'Enzo is composing';
    latestEl.classList.remove('has-image', 'has-error');
    latestEl.classList.add('is-shown');
    setGenerateButton(true, 'Generating…');
    setStatus('Generating. You can leave Studio and come back; this job is tracked on the server.');
    latestEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showJobDone(job) {
    latestImg.src = assetUrl(job.result_url);
    latestImg.alt = job.prompt || 'Generated art';
    latestDetails.style.display = 'none';
    latestEnhanced.innerHTML = '';
    latestCap.innerHTML = `Done. Saved to the shared gallery. <a href="#vos-art-gallery-section">View in gallery &rarr;</a>`;
    latestEl.classList.remove('has-error');
    latestEl.classList.add('is-shown', 'has-image');
    setGenerateButton(false);
    setStatus('Done. The shared gallery refreshed below.');
  }

  function showJobError(job) {
    latestImg.removeAttribute('src');
    latestImg.alt = '';
    pendingPromptEl.textContent = '';
    latestDetails.style.display = 'none';
    latestEnhanced.innerHTML = '';
    latestCap.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'vos-art-latest-error';
    const title = document.createElement('strong');
    title.textContent = 'Generation failed';
    const message = document.createElement('p');
    message.textContent = job.error_message || 'The server marked this job as failed.';
    const retry = document.createElement('button');
    retry.className = 'vos-art-retry';
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      promptEl.value = job.prompt || promptEl.value;
      generate();
    });
    wrap.append(title, message, retry);
    latestCap.appendChild(wrap);
    latestEl.classList.remove('has-image');
    latestEl.classList.add('is-shown', 'has-error');
    setGenerateButton(false);
    setStatus('Generation failed. Retry when ready.', true);
  }

  function showIdle() {
    latestEl.classList.remove('is-shown', 'has-image');
    latestEl.classList.remove('has-error');
    latestImg.removeAttribute('src');
    latestCap.innerHTML = '';
    pendingPromptEl.textContent = '';
    setGenerateButton(false);
  }

  function renderJob(job) {
    if (!job) {
      showIdle();
      return;
    }
    storeActiveJob(job.jobId || job.id);
    if (job.status === 'pending') {
      showGenerating(job);
      return;
    }
    clearPoll();
    if (job.status === 'done') {
      showJobDone(job);
      loadGallery({ quiet: true });
      return;
    }
    if (job.status === 'error') {
      showJobError(job);
      return;
    }
    showIdle();
  }

  async function fetchJob(jobId) {
    const response = await fetch(API_BASE + '/api/studio/jobs/' + encodeURIComponent(jobId), {
      cache: 'no-store',
      headers: requestHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function startPolling(jobId) {
    clearPoll();
    const poll = async () => {
      try {
        const job = await fetchJob(jobId);
        renderJob(job);
      } catch (error) {
        setStatus('Still checking the server for this job.', true);
      }
    };
    poll();
    pollTimer = setInterval(poll, POLL_MS);
  }

  async function restoreStudioJobs() {
    const creator = getCurrentCreatorName();
    if (!creator) return;
    try {
      const url = API_BASE + '/api/studio/jobs?mine=1&name=' + encodeURIComponent(creator);
      const response = await fetch(url, { cache: 'no-store', headers: requestHeaders() });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const stored = getStoredActiveJob();
      const job = jobs.find((candidate) => candidate.id === stored || candidate.jobId === stored)
        || jobs.find((candidate) => candidate.status === 'pending');
      if (!job) return;
      renderJob(job);
      if (job.status === 'pending') startPolling(job.jobId || job.id);
    } catch (e) {}
  }

  async function generate() {
    if (isSubmitting || generateEl.disabled) return;
    const prompt = promptEl.value.trim();
    if (!prompt) {
      setStatus('Add a description first.', true);
      promptEl.focus();
      return;
    }
    if (prompt.length > 3000) {
      setStatus('That prompt is over the 3000-character limit.', true);
      return;
    }
    const creatorName = await getCreatorName();
    if (!creatorName) {
      setStatus('Log in before generating so the piece is attributed correctly.', true);
      return;
    }
    isSubmitting = true;
    const enhance = !!enhanceEl.checked;
    showSubmitting();

    try {
      const res = await fetch(API_BASE + '/api/studio/generate', {
        method: 'POST',
        headers: requestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          creator: creatorName,
          enhance,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const jobId = data.jobId;
      if (!jobId) throw new Error('Server did not return a job id.');
      storeActiveJob(jobId);
      promptEl.value = '';
      showGenerating({ jobId, prompt, status: 'pending' });
      startPolling(jobId);
    } catch (e) {
      console.error(e);
      showIdle();
      setStatus('Could not start generation: ' + e.message, true);
    } finally {
      isSubmitting = false;
    }
  }

  generateEl.addEventListener('click', generate);
  window.addEventListener('DOMContentLoaded', restoreStudioJobs);
  window.addEventListener('vos:identity', restoreStudioJobs);
  window.addEventListener('focus', () => loadGallery({ quiet: true }));

  // Enter submits, Shift+Enter inserts a newline — same pattern as the
  // chatbot widget so it feels consistent across the site.
  promptEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!generateEl.disabled) generate();
    }
  });

  // ── Utility ──────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
</script>
