---
title: Art Studio
description: Generate campaign art with Enzo. New art saves privately to its creator and the DM, then can be shared to the group gallery when ready.
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
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: normal;
}
.vos-art-app-head h1::after { content: none; }
.vos-art-app-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  max-width: 820px;
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
/* Available references panel — collapsed by default; click to expand a
   list of names the prompt enhancer recognises. */
.vos-art-references {
  margin: 0 0 0.85rem;
  padding: 0;
  border: 1px solid rgba(201, 161, 74, 0.22);
  border-radius: 8px;
  background: rgba(7, 6, 10, 0.4);
}
.vos-art-references > summary {
  list-style: none;
  cursor: pointer;
  padding: 0.55rem 0.85rem;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.vos-art-references > summary::-webkit-details-marker { display: none; }
.vos-art-references > summary::before {
  content: '▸ ';
  display: inline-block;
  margin-right: 0.35rem;
  transition: transform 0.18s ease;
}
.vos-art-references[open] > summary::before {
  transform: rotate(90deg);
}
.vos-art-references-body {
  padding: 0.65rem 0.85rem 0.9rem;
  border-top: 1px solid rgba(201, 161, 74, 0.18);
  display: grid;
  gap: 0.7rem;
}
.vos-art-references-cat {
  display: grid;
  gap: 0.35rem;
}
.vos-art-references-cat h4 {
  margin: 0;
  color: rgba(212, 199, 173, 0.7);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.vos-art-references-names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.vos-art-references-name {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border: 1px solid rgba(201, 161, 74, 0.28);
  border-radius: 999px;
  background: rgba(212, 165, 116, 0.06);
  color: var(--vos-cream);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.86rem;
  cursor: pointer;
  line-height: 1.2;
}
.vos-art-references-name:hover {
  border-color: rgba(212, 165, 116, 0.6);
  background: rgba(212, 165, 116, 0.14);
}

/* Per-card icon overlay (favorite + share). Sits in the top-right of
   each tile alongside the existing DM delete button. */
.vos-art-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 0.3rem;
  z-index: 2;
}
.vos-art-card-actions .vos-art-icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(212, 165, 116, 0.28);
  border-radius: 50%;
  background: rgba(7, 6, 10, 0.7);
  color: rgba(212, 199, 173, 0.85);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(4px);
}
.vos-art-card-actions .vos-art-icon-btn:hover {
  color: var(--vos-cream);
  border-color: rgba(212, 165, 116, 0.6);
}
.vos-art-card-actions .vos-art-icon-btn.is-favorited {
  color: #ff7a8b;
  border-color: rgba(255, 122, 139, 0.55);
}

/* Lightbox toolbar — favorite + share, mirrors the card actions. */
.vos-art-lightbox-actions {
  position: absolute;
  top: 0.85rem;
  right: 3rem;
  display: flex;
  gap: 0.4rem;
  z-index: 12;
}
.vos-art-lightbox-actions .vos-art-icon-btn {
  width: 36px;
  height: 36px;
  font-size: 1.05rem;
}

/* "Pin to wiki" menu — small popover anchored under the lightbox
   action bar. Lists the grounded entities the image was tied to. */
.vos-art-pin-menu {
  position: absolute;
  top: 3.5rem;
  right: 1rem;
  z-index: 14;
  min-width: 240px;
  max-width: min(360px, 80vw);
  padding: 0.55rem;
  border: 1px solid rgba(212, 165, 116, 0.45);
  border-radius: 8px;
  background: rgba(8, 6, 12, 0.96);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.7);
  display: grid;
  gap: 0.3rem;
}
.vos-art-pin-menu[hidden] { display: none; }
.vos-art-pin-menu-title {
  margin: 0 0 0.2rem;
  padding: 0 0.35rem;
  color: rgba(212, 199, 173, 0.7);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.vos-art-pin-option {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(201, 161, 74, 0.18);
  border-radius: 6px;
  background: rgba(7, 6, 10, 0.5);
  color: var(--vos-cream);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
}
.vos-art-pin-option:hover {
  border-color: rgba(212, 165, 116, 0.55);
  background: rgba(212, 165, 116, 0.1);
}
.vos-art-pin-option-kind {
  color: rgba(212, 165, 116, 0.7);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.vos-art-pin-empty {
  padding: 0.55rem;
  color: rgba(212, 199, 173, 0.6);
  font-style: italic;
  font-size: 0.88rem;
}

/* "Load more" button at gallery bottom. */
.vos-art-load-more {
  display: block;
  margin: 1rem auto 0;
  padding: 0.6rem 1.4rem;
  border: 1px solid rgba(212, 165, 116, 0.36);
  border-radius: 999px;
  background: rgba(212, 165, 116, 0.08);
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.vos-art-load-more:hover {
  color: var(--vos-cream);
  border-color: var(--vos-gold-bright);
  background: rgba(212, 165, 116, 0.16);
}
.vos-art-load-more:disabled {
  cursor: wait;
  opacity: 0.6;
}
.vos-art-load-more[hidden] { display: none; }

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
.vos-art-gallery-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0 0 0.9rem;
}
.vos-art-gallery-tab {
  appearance: none;
  min-height: 38px;
  padding: 0.5rem 0.78rem;
  border: 1px solid rgba(221, 183, 127, 0.28);
  border-radius: 6px;
  background: rgba(7, 6, 10, 0.52);
  color: rgba(221, 183, 127, 0.74);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  cursor: pointer;
}
.vos-art-gallery-tab:hover {
  border-color: rgba(221, 183, 127, 0.5);
  color: var(--vos-cream);
}
.vos-art-gallery-tab.is-active {
  border-color: var(--art-border-strong);
  background: rgba(221, 183, 127, 0.14);
  color: #f0d4a5;
}
.vos-art-gallery-tab[hidden] { display: none; }
.vos-art-gallery-note {
  margin: -0.35rem 0 0.95rem;
  color: rgba(232, 220, 200, 0.62);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.94rem;
  line-height: 1.35;
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
.vos-art-card-meta-title {
  display: block;
  overflow-wrap: anywhere;
}
.vos-art-visibility-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.42rem;
  margin-top: 0.55rem;
}
.vos-art-visibility {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.14rem 0.48rem;
  border: 1px solid rgba(123, 183, 173, 0.35);
  border-radius: 999px;
  color: rgba(168, 220, 211, 0.88);
  background: rgba(123, 183, 173, 0.08);
  font-family: 'Cinzel', Georgia, serif;
  font-style: normal;
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vos-art-visibility.is-private {
  border-color: rgba(159, 79, 93, 0.48);
  color: #e7a2ae;
  background: rgba(159, 79, 93, 0.12);
}
.vos-art-share-toggle {
  appearance: none;
  min-height: 28px;
  padding: 0.24rem 0.6rem;
  border: 1px solid rgba(221, 183, 127, 0.34);
  border-radius: 999px;
  background: rgba(221, 183, 127, 0.08);
  color: var(--art-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.vos-art-share-toggle:hover {
  border-color: var(--art-border-strong);
  color: var(--vos-cream);
  background: rgba(221, 183, 127, 0.14);
}
.vos-art-share-toggle[disabled] {
  cursor: wait;
  opacity: 0.6;
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
.vos-art-lightbox-caption strong {
  display: block;
  color: #f0d4a5;
  font-family: 'Cinzel', Georgia, serif;
  font-style: normal;
  font-size: 0.86rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.vos-art-lightbox-prompt {
  margin-top: 0.5rem;
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

/* Delete buttons — visible only for a signed-in DM. The card variant
   sits opposite the normal card actions; the lightbox variant lives next
   to the close button. Both are red-tinged so they read as destructive
   without overpowering the gold theme. */
.vos-art-delete {
  position: absolute;
  top: 0.5rem; left: 0.5rem;
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
    align-items: start;
    grid-template-columns: 1fr;
    gap: 0.65rem;
    padding: 0.1rem 0 0.85rem;
  }
  .vos-art-app-head h1 {
    font-size: 2rem;
  }
  .vos-art-app-actions {
    width: auto;
    justify-content: flex-start;
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
    <a class="vos-art-anchor" href="/art-submissions/">Art Submissions</a>
    <a class="vos-art-anchor" href="#vos-art-gallery-section">Gallery</a>
  </div>
</header>

<div class="vos-art-workbench">

<section class="vos-art-studio" aria-label="Generate new art">
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

</div>

<section class="vos-art-gallery-section" id="vos-art-gallery-section" aria-labelledby="vos-art-gallery-title">
  <div class="vos-art-gallery-head">
    <h2 id="vos-art-gallery-title">Studio Library</h2>
    <div class="vos-art-gallery-tools">
      <button id="vos-art-gallery-refresh" class="vos-art-refresh" type="button" aria-label="Refresh gallery" title="Refresh gallery">↻</button>
      <div class="vos-art-gallery-count" id="vos-art-gallery-count">Loading…</div>
    </div>
  </div>
  <div class="vos-art-gallery-tabs" id="vos-art-gallery-tabs" role="tablist" aria-label="Gallery views">
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="mine">My Studio</button>
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="shared">Group Gallery</button>
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="favorites">Favorites</button>
    <button class="vos-art-gallery-tab" type="button" data-gallery-scope="all" hidden>DM All</button>
  </div>
  <div class="vos-art-gallery-note" id="vos-art-gallery-note"></div>

  <div id="vos-art-gallery" class="vos-art-gallery"></div>
  <button id="vos-art-load-more" class="vos-art-load-more" type="button" hidden>Load more</button>
</section>

<div id="vos-art-lightbox" class="vos-art-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vos-art-lightbox-caption">
  <div class="vos-art-lightbox-inner">
    <div class="vos-art-lightbox-actions">
      <button class="vos-art-icon-btn" id="vos-art-lightbox-favorite" type="button" aria-label="Favorite this image" title="Favorite">♡</button>
      <button class="vos-art-icon-btn" id="vos-art-lightbox-share" type="button" aria-label="Share this image" title="Share">↗</button>
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

<script>
(function () {
  const API_BASE = '';
  const STYLE_KEY = 'velly.artStudio.lastStyle';
  const ACTIVE_JOB_KEY = 'velly.artStudio.activeJobId';
  const SEEN_DONE_JOB_KEY = 'vos.studio.seenDoneJobId';
  const POLL_MS = 2500;
  const urlParams = new URLSearchParams(window.location.search);
  const galleryFavoritesOnly = urlParams.get('favorites') === '1';
  const requestedGalleryScope = (urlParams.get('gallery') || urlParams.get('scope') || '').toLowerCase();
  const initialGalleryScope = galleryFavoritesOnly
    ? 'favorites'
    : (['mine', 'shared', 'all'].includes(requestedGalleryScope) ? requestedGalleryScope : 'mine');

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
  const galleryTitleEl   = $('vos-art-gallery-title');
  const galleryTabsEl    = $('vos-art-gallery-tabs');
  const galleryNoteEl    = $('vos-art-gallery-note');
  const lightbox         = $('vos-art-lightbox');
  const lightImg         = $('vos-art-lightbox-img');
  const lightCap         = $('vos-art-lightbox-caption');
  const lightDelete      = $('vos-art-lightbox-delete');

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
  let defaultStyle = 'valley-scene';
  let availableStyles = [];
  let activeJobId = null;
  let pollTimer = null;
  let isSubmitting = false;
  let galleryHasLoaded = false;
  let statusTimer = null;
  let currentGalleryScope = initialGalleryScope;

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

  function getCurrentAuthToken() {
    if (window.VOS_PWA && window.VOS_PWA.getAuthToken) {
      const token = window.VOS_PWA.getAuthToken();
      return token && typeof token === 'string' ? token.trim() : '';
    }
    try {
      return (localStorage.getItem('vos.authToken') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function hasAuthenticatedCreator() {
    const pwa = window.VOS_PWA;
    if (pwa && typeof pwa.isAuthenticated === 'function') {
      return !!(getCurrentCreatorName() && pwa.isAuthenticated());
    }
    return !!(getCurrentCreatorName() && getCurrentAuthToken());
  }

  function isCurrentDm() {
    if (window.VOS_PWA && typeof window.VOS_PWA.isDm === 'function') {
      return !!window.VOS_PWA.isDm();
    }
    return getCurrentCreatorName() === 'DM';
  }

  async function openStudioLogin() {
    if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
      await window.VOS_PWA.ensureIdentity({ force: true });
    }
    updateGenerateAccess();
  }

  async function getCreatorName() {
    return getCurrentCreatorName();
  }

  function requestHeaders(headers = {}) {
    if (window.VOS_PWA && typeof window.VOS_PWA.authHeaders === 'function') {
      return window.VOS_PWA.authHeaders(headers);
    }
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

  function clearObjectUrl(img) {
    if (!img || !img.dataset || !img.dataset.objectUrl) return;
    try { URL.revokeObjectURL(img.dataset.objectUrl); } catch (e) {}
    delete img.dataset.objectUrl;
  }

  async function setImageSrc(img, url, entry, forceAuth = false) {
    if (!img) return;
    clearObjectUrl(img);
    const resolved = assetUrl(url);
    if (!resolved) {
      img.removeAttribute('src');
      return;
    }
    const privateEntry = entry && !(entry.is_shared || entry.visibility === 'shared');
    if ((privateEntry || forceAuth) && getCurrentAuthToken()) {
      try {
        const response = await fetch(resolved, {
          cache: privateEntry ? 'no-store' : 'force-cache',
          headers: requestHeaders(),
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        img.dataset.objectUrl = objectUrl;
        img.src = objectUrl;
        return;
      } catch (e) {
        if (privateEntry) {
          img.removeAttribute('src');
          return;
        }
      }
    }
    img.src = resolved;
  }

  function entryTitle(e) {
    return (e && (e.title || e.prompt)) || 'Gallery piece';
  }

  const GALLERY_SCOPES = {
    mine: {
      title: 'My Studio',
      noun: 'piece',
      note: 'New pieces start private here. Share table-safe art to the group gallery when ready.',
      empty: 'Your private Studio library is empty. Generate a piece above and it will appear here.',
    },
    shared: {
      title: 'Group Gallery',
      noun: 'piece',
      note: 'Shared art is visible to the table.',
      empty: 'No shared art yet.',
    },
    favorites: {
      title: 'Favorites',
      noun: 'favorite',
      note: 'Saved pieces you can still view.',
      empty: 'No favorites yet.',
    },
    all: {
      title: 'DM All Art',
      noun: 'piece',
      note: 'DM view includes private and shared art from every creator.',
      empty: 'No Studio art has been generated yet.',
    },
  };

  function normalizeGalleryScope(scope) {
    const candidate = GALLERY_SCOPES[scope] ? scope : 'mine';
    if (candidate === 'all' && !isCurrentDm()) return 'mine';
    return candidate;
  }

  function syncDmMode() {
    const dm = isCurrentDm();
    document.body.classList.toggle('is-dm-mode', dm);
    const dmTab = galleryTabsEl && galleryTabsEl.querySelector('[data-gallery-scope="all"]');
    if (dmTab) dmTab.hidden = !dm;
    if (!dm && currentGalleryScope === 'all') currentGalleryScope = 'mine';
  }

  function syncGalleryChrome() {
    currentGalleryScope = normalizeGalleryScope(currentGalleryScope);
    const config = GALLERY_SCOPES[currentGalleryScope] || GALLERY_SCOPES.mine;
    if (galleryTitleEl) galleryTitleEl.textContent = config.title;
    if (galleryNoteEl) galleryNoteEl.textContent = config.note;
    syncDmMode();
    if (galleryTabsEl) {
      galleryTabsEl.querySelectorAll('[data-gallery-scope]').forEach((button) => {
        const active = button.dataset.galleryScope === currentGalleryScope;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }
  }

  function updateGalleryUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('favorites');
      url.searchParams.set('gallery', currentGalleryScope);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }

  function setGalleryScope(scope, options = {}) {
    currentGalleryScope = normalizeGalleryScope(scope);
    galleryHasLoaded = false;
    galleryOffset = 0;
    syncGalleryChrome();
    if (!options.keepUrl) updateGalleryUrl();
    return loadGallery({ quiet: !!options.quiet });
  }

  function visibilityBadge(entry) {
    const badge = document.createElement('span');
    const shared = !!entry.is_shared || entry.visibility === 'shared';
    badge.className = 'vos-art-visibility' + (shared ? '' : ' is-private');
    badge.textContent = shared ? 'Shared' : 'Private';
    return badge;
  }

  function shareToggleLabel(entry) {
    return entry && (entry.is_shared || entry.visibility === 'shared')
      ? 'Make Private'
      : 'Share to Group Gallery';
  }

  function buildGalleryCard(e) {
    const card = document.createElement('a');
    card.className = 'vos-art-card';
    card.href = assetUrl(e.image_url);
    card.dataset.entryId = e.id;
    card.dataset.entry = JSON.stringify(e);
    card.addEventListener('click', (evt) => {
      evt.preventDefault();
      openLightbox(e);
    });

    const actions = document.createElement('div');
    actions.className = 'vos-art-card-actions';

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'vos-art-icon-btn';
    favBtn.setAttribute('aria-label', 'Favorite this image');
    favBtn.title = 'Favorite';
    favBtn.dataset.favoriteId = e.id;
    const isFav = favoriteIds.has(e.id);
    favBtn.classList.toggle('is-favorited', isFav);
    favBtn.textContent = isFav ? '♥' : '♡';
    favBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      toggleFavorite(e, favBtn);
    });

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'vos-art-icon-btn';
    shareBtn.setAttribute('aria-label', 'Export this image');
    shareBtn.title = 'Export image';
    shareBtn.textContent = '↗';
    shareBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      shareEntry(e);
    });

    actions.append(favBtn, shareBtn);
    card.appendChild(actions);

    if (e.can_delete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'vos-art-delete';
      del.title = 'Delete';
      del.setAttribute('aria-label', 'Delete this image');
      del.textContent = '✕';
      del.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        deleteEntry(e, del);
      });
      card.appendChild(del);
    }

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = entryTitle(e);
    setImageSrc(img, e.image_url, e);
    card.appendChild(img);
    const meta = document.createElement('div');
    meta.className = 'vos-art-card-meta';
    const title = document.createElement('span');
    title.className = 'vos-art-card-meta-title';
    title.textContent = entryTitle(e);
    meta.appendChild(title);
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
    const visibilityRow = document.createElement('div');
    visibilityRow.className = 'vos-art-visibility-row';
    visibilityRow.appendChild(visibilityBadge(e));
    if (e.can_share) {
      const shareToggle = document.createElement('button');
      shareToggle.type = 'button';
      shareToggle.className = 'vos-art-share-toggle';
      shareToggle.textContent = shareToggleLabel(e);
      shareToggle.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        toggleGalleryShare(e, shareToggle);
      });
      visibilityRow.appendChild(shareToggle);
    }
    meta.appendChild(visibilityRow);
    const byline = document.createElement('span');
    byline.className = 'vos-art-card-byline';
    const who = e.created_by ? `By ${e.created_by}` : 'Anonymous';
    byline.textContent = `${who} · ${fmtRel(e.created_at)}`;
    meta.appendChild(byline);
    card.appendChild(meta);
    return card;
  }

  function renderGallery(entries, total) {
    syncGalleryChrome();
    galleryEl.innerHTML = '';
    const config = GALLERY_SCOPES[currentGalleryScope] || GALLERY_SCOPES.mine;
    const noun = config.noun;
    countEl.textContent = total === 0
      ? config.empty
      : `${total} ${noun}${total === 1 ? '' : 's'}`;
    if (!entries.length) {
      galleryEl.innerHTML = `<div class="vos-art-empty">${escapeHtml(config.empty)}</div>`;
      if (loadMoreEl) loadMoreEl.hidden = true;
      return;
    }
    const frag = document.createDocumentFragment();
    entries.forEach((e) => frag.appendChild(buildGalleryCard(e)));
    galleryEl.appendChild(frag);
    if (pendingOpenImageId) tryOpenPending();
  }

  function setGalleryRefreshing(refreshing) {
    if (refreshGalleryEl) {
      refreshGalleryEl.disabled = refreshing;
      refreshGalleryEl.classList.toggle('is-refreshing', refreshing);
    }
  }

  // ── Gallery pagination + favorites state ────────────────────────────
  const GALLERY_PAGE = 40;
  const loadMoreEl = document.getElementById('vos-art-load-more');
  let galleryOffset = 0;
  let galleryTotal = 0;
  const favoriteIds = new Set();

  async function fetchFavorites() {
    const creator = getCurrentCreatorName();
    if (!creator) return;
    try {
      const r = await fetch(
        API_BASE + '/api/gallery/favorites?name=' + encodeURIComponent(creator),
        { cache: 'no-store', headers: requestHeaders() }
      );
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      favoriteIds.clear();
      (data.ids || []).forEach((id) => favoriteIds.add(id));
      // Re-apply heart state to any already-rendered cards.
      document.querySelectorAll('[data-favorite-id]').forEach((btn) => {
        const id = btn.getAttribute('data-favorite-id');
        const isFav = favoriteIds.has(id);
        btn.classList.toggle('is-favorited', isFav);
        btn.textContent = isFav ? '♥' : '♡';
      });
    } catch (e) {}
  }

  async function loadGallery(options = {}) {
    currentGalleryScope = normalizeGalleryScope(currentGalleryScope);
    syncGalleryChrome();
    const quiet = !!options.quiet;
    const append = !!options.append;
    if (!quiet || !galleryHasLoaded) countEl.textContent = 'Loading…';
    setGalleryRefreshing(true);
    if (!append) {
      galleryOffset = 0;
    }
    if (loadMoreEl) {
      loadMoreEl.disabled = true;
      loadMoreEl.textContent = append ? 'Loading…' : 'Load more';
    }

    if (['mine', 'favorites'].includes(currentGalleryScope) && !hasAuthenticatedCreator()) {
      galleryEl.innerHTML = `<div class="vos-art-empty">Log in to view your private Studio library.</div>`;
      countEl.textContent = currentGalleryScope === 'favorites' ? 'Favorites' : 'My Studio';
      setGalleryRefreshing(false);
      if (loadMoreEl) loadMoreEl.hidden = true;
      return;
    }

    const params = new URLSearchParams({ limit: String(GALLERY_PAGE), offset: String(galleryOffset) });
    if (currentGalleryScope === 'favorites') {
      const creator = getCurrentCreatorName();
      params.set('favorites', '1');
      if (creator) params.set('name', creator);
    } else {
      params.set('scope', currentGalleryScope);
    }
    const url = API_BASE + '/api/gallery?' + params.toString();
    try {
      const r = await fetch(url, { cache: 'no-store', headers: requestHeaders() });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      galleryHasLoaded = true;
      const entries = data.entries || [];
      galleryTotal = data.total || 0;
      if (append) {
        appendGallery(entries);
      } else {
        renderGallery(entries, galleryTotal);
      }
      galleryOffset += entries.length;
      if (loadMoreEl) {
        loadMoreEl.hidden = galleryOffset >= galleryTotal;
        loadMoreEl.disabled = false;
        loadMoreEl.textContent = 'Load more';
      }
      fetchFavorites();
    } catch (error) {
      countEl.textContent = 'Gallery unavailable.';
      if (!galleryHasLoaded) {
        galleryEl.innerHTML = `<div class="vos-art-empty">${escapeHtml(error.message || 'Could not reach the gallery.')}</div>`;
      }
      if (loadMoreEl) {
        loadMoreEl.disabled = false;
      }
    } finally {
      setGalleryRefreshing(false);
    }
  }

  function appendGallery(entries) {
    if (!entries || !entries.length) return;
    const frag = document.createDocumentFragment();
    entries.forEach((e) => frag.appendChild(buildGalleryCard(e)));
    galleryEl.appendChild(frag);
    const config = GALLERY_SCOPES[currentGalleryScope] || GALLERY_SCOPES.mine;
    const noun = config.noun;
    countEl.textContent = `${galleryTotal} ${noun}${galleryTotal === 1 ? '' : 's'}`;
    // Honor a pending deep-link if the requested image has now arrived.
    if (pendingOpenImageId) tryOpenPending();
  }

  if (galleryTabsEl) {
    galleryTabsEl.addEventListener('click', (evt) => {
      const button = evt.target.closest('[data-gallery-scope]');
      if (!button) return;
      setGalleryScope(button.dataset.galleryScope);
    });
  }
  loadGallery();
  refreshGalleryEl.addEventListener('click', () => loadGallery({ quiet: true }));
  if (loadMoreEl) {
    loadMoreEl.addEventListener('click', () => loadGallery({ quiet: true, append: true }));
  }

  // ── Favorites toggle ────────────────────────────────────────────────
  async function toggleFavorite(entry, button) {
    const creator = getCurrentCreatorName();
    if (!creator || !getCurrentAuthToken()) {
      setStatus('Log in to favorite gallery images.', true);
      await openStudioLogin();
      return;
    }
    const wasFav = favoriteIds.has(entry.id);
    const method = wasFav ? 'DELETE' : 'POST';
    button.disabled = true;
    try {
      const r = await fetch(
        API_BASE + '/api/gallery/' + encodeURIComponent(entry.id)
          + '/favorite?name=' + encodeURIComponent(creator),
        { method, headers: requestHeaders() }
      );
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (wasFav) favoriteIds.delete(entry.id);
      else favoriteIds.add(entry.id);
      const isFav = favoriteIds.has(entry.id);
      // Update every button for this entry (card + lightbox can both exist).
      document.querySelectorAll('[data-favorite-id="' + entry.id + '"]').forEach((b) => {
        b.classList.toggle('is-favorited', isFav);
        b.textContent = isFav ? '♥' : '♡';
      });
    } catch (e) {
      // Quiet failure — toggle back if needed and just leave the heart.
    } finally {
      button.disabled = false;
    }
  }

  async function toggleGalleryShare(entry, button) {
    if (!entry || !entry.can_share) return;
    if (!hasAuthenticatedCreator()) {
      setStatus('Log in before changing gallery sharing.', true);
      await openStudioLogin();
      return;
    }
    const makeShared = !(entry.is_shared || entry.visibility === 'shared');
    const method = makeShared ? 'POST' : 'DELETE';
    const originalText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = makeShared ? 'Sharing…' : 'Updating…';
    }
    try {
      const r = await fetch(
        API_BASE + '/api/gallery/' + encodeURIComponent(entry.id) + '/share',
        { method, headers: requestHeaders() }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const updated = data.entry || {};
      setStatus(makeShared ? 'Shared to the group gallery.' : 'Returned to private.', false, { clearAfter: 4000 });
      if (currentLightboxEntry && currentLightboxEntry.id === entry.id) {
        currentLightboxEntry = { ...currentLightboxEntry, ...updated };
        openLightbox(currentLightboxEntry);
      }
      await loadGallery({ quiet: true });
    } catch (error) {
      setStatus('Sharing update failed: ' + error.message, true);
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  // ── Share helpers ───────────────────────────────────────────────────
  // Tries the native share sheet first (best UX on mobile — gives Insta
  // / Messages / etc. options); falls back to clipboard. The image is
  // shared as a File when fetched successfully, so receiving apps treat
  // it as an image attachment rather than just a link.
  async function shareEntry(entry) {
    const url = absoluteUrl(entry.image_url);
    const title = `Vallombrosa: ${entryTitle(entry).slice(0, 80)}`;
    const text = entryTitle(entry);

    let file = null;
    try {
      const r = await fetch(url, { cache: 'force-cache', headers: requestHeaders() });
      if (r.ok) {
        const blob = await r.blob();
        file = new File([blob], 'vallombrosa.png', { type: blob.type || 'image/png' });
      }
    } catch (e) {}

    if (navigator.share) {
      try {
        const payload = { title, text, url };
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          payload.files = [file];
        }
        await navigator.share(payload);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user cancelled
      }
    }

    // Fallback: copy the URL to clipboard. Always offer a download too.
    try {
      await navigator.clipboard.writeText(url);
      const shared = entry && (entry.is_shared || entry.visibility === 'shared');
      setStatus(shared
        ? 'Image link copied to clipboard.'
        : 'Private image link copied. Only you and the DM can open it.');
    } catch (e) {
      setStatus('Couldn’t share automatically — long-press the image to save.', true);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vallombrosa-' + entry.id + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function absoluteUrl(url) {
    const resolved = assetUrl(url);
    if (/^https?:/i.test(resolved)) return resolved;
    return window.location.origin + resolved;
  }

  // ── Available references panel ──────────────────────────────────────
  let referencesLoaded = false;
  async function loadReferences() {
    if (referencesLoaded) return;
    referencesLoaded = true;
    const body = document.getElementById('vos-art-references-body');
    if (!body) return;
    try {
      const r = await fetch(API_BASE + '/api/descriptions');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const cats = data.categories || [];
      if (!cats.length) {
        body.innerHTML = '<div class="vos-art-references-cat">No references registered.</div>';
        return;
      }
      body.innerHTML = '';
      cats.forEach((cat) => {
        if (!cat.entries || !cat.entries.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'vos-art-references-cat';
        const h = document.createElement('h4');
        h.textContent = cat.label;
        wrap.appendChild(h);
        const names = document.createElement('div');
        names.className = 'vos-art-references-names';
        cat.entries.forEach((name) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'vos-art-references-name';
          chip.textContent = name;
          chip.title = 'Insert into prompt';
          chip.addEventListener('click', () => insertReferenceName(name));
          names.appendChild(chip);
        });
        wrap.appendChild(names);
        body.appendChild(wrap);
      });
    } catch (e) {
      body.innerHTML = '<div class="vos-art-references-cat">Couldn’t load references.</div>';
    }
  }

  function insertReferenceName(name) {
    const start = promptEl.selectionStart || promptEl.value.length;
    const end = promptEl.selectionEnd || promptEl.value.length;
    const before = promptEl.value.slice(0, start);
    const after = promptEl.value.slice(end);
    const sep = before && !/\s$/.test(before) ? ' ' : '';
    const trailing = after && !/^\s/.test(after) ? ' ' : '';
    promptEl.value = before + sep + name + trailing + after;
    const caret = (before + sep + name).length;
    promptEl.setSelectionRange(caret, caret);
    promptEl.focus();
  }

  // Load lazily on first expand so first paint isn't held up.
  const referencesEl = document.getElementById('vos-art-references');
  if (referencesEl) {
    referencesEl.addEventListener('toggle', () => {
      if (referencesEl.open) loadReferences();
    });
  }

  // ── Deep-link: open the lightbox to ?image=<gallery_id> ─────────────
  let pendingOpenImageId = null;
  try {
    const params = new URLSearchParams(window.location.search);
    pendingOpenImageId = params.get('image') || null;
  } catch (e) {}

  function tryOpenPending() {
    if (!pendingOpenImageId) return;
    const card = galleryEl.querySelector('[data-entry-id="' + pendingOpenImageId + '"]');
    if (!card) return;
    try {
      const data = JSON.parse(card.dataset.entry);
      openLightbox(data);
    } catch (e) {}
    pendingOpenImageId = null;
    // Clean the param so a refresh doesn't keep re-opening.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('image');
      window.history.replaceState({}, '', u.toString());
    } catch (e) {}
  }

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
  const lightFavorite = document.getElementById('vos-art-lightbox-favorite');
  const lightShare    = document.getElementById('vos-art-lightbox-share');
  const lightPin      = document.getElementById('vos-art-lightbox-pin');
  const pinMenuEl     = document.getElementById('vos-art-pin-menu');
  let wikiPagesByTitle = null;
  function openLightbox(e) {
    currentLightboxEntry = e;
    if (pinMenuEl) pinMenuEl.hidden = true;
    setImageSrc(lightImg, e.image_url, e);
    lightImg.alt = entryTitle(e);
    if (lightFavorite) {
      lightFavorite.dataset.favoriteId = e.id;
      const isFav = favoriteIds.has(e.id);
      lightFavorite.classList.toggle('is-favorited', isFav);
      lightFavorite.textContent = isFav ? '♥' : '♡';
    }
    const who = e.created_by ? `By ${escapeHtml(e.created_by)}` : 'Anonymous';
    let html = `<strong>${escapeHtml(entryTitle(e))}</strong>`;
    if (e.prompt && e.prompt !== e.title) {
      html += `<div class="vos-art-lightbox-prompt">${escapeHtml(e.prompt)}</div>`;
    }
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
    const row = document.createElement('div');
    row.className = 'vos-art-visibility-row';
    row.style.justifyContent = 'center';
    row.appendChild(visibilityBadge(e));
    if (e.can_share) {
      const shareToggle = document.createElement('button');
      shareToggle.type = 'button';
      shareToggle.className = 'vos-art-share-toggle';
      shareToggle.textContent = shareToggleLabel(e);
      shareToggle.addEventListener('click', () => toggleGalleryShare(e, shareToggle));
      row.appendChild(shareToggle);
    }
    lightCap.appendChild(row);
    if (lightDelete) lightDelete.hidden = !e.can_delete;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    // Scroll the lightbox back to top so the image is visible whenever a
    // new entry is opened, even after the previous one scrolled down.
    lightbox.scrollTop = 0;
  }
  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    clearObjectUrl(lightImg);
    lightImg.src = '';
    currentLightboxEntry = null;
    if (pinMenuEl) pinMenuEl.hidden = true;
    if (lightDelete) lightDelete.hidden = true;
  }
  document.addEventListener('vos:open-gallery-piece', (evt) => {
    if (!evt.detail) return;
    evt.preventDefault();
    openLightbox(evt.detail);
  });
  lightDelete.addEventListener('click', () => {
    if (currentLightboxEntry) deleteEntry(currentLightboxEntry, lightDelete);
  });
  if (lightFavorite) {
    lightFavorite.addEventListener('click', () => {
      if (currentLightboxEntry) toggleFavorite(currentLightboxEntry, lightFavorite);
    });
  }
  if (lightShare) {
    lightShare.addEventListener('click', () => {
      if (currentLightboxEntry) shareEntry(currentLightboxEntry);
    });
  }
  if (lightPin) {
    lightPin.addEventListener('click', () => {
      if (currentLightboxEntry) togglePinMenu(currentLightboxEntry);
    });
  }
  // Click outside the pin menu (but inside the lightbox) closes it.
  if (pinMenuEl) {
    document.addEventListener('click', (evt) => {
      if (pinMenuEl.hidden) return;
      if (pinMenuEl.contains(evt.target) || evt.target === lightPin) return;
      pinMenuEl.hidden = true;
    });
  }

  // ── Pin-to-wiki menu ────────────────────────────────────────────────
  async function loadWikiPagesIndex() {
    if (wikiPagesByTitle) return wikiPagesByTitle;
    try {
      const r = await fetch('/data/wiki-pages.json', { cache: 'default' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const map = new Map();
      (Array.isArray(data) ? data : []).forEach((entry) => {
        if (!entry || !entry.title) return;
        map.set(entry.title.toLowerCase(), entry);
      });
      wikiPagesByTitle = map;
    } catch (e) {
      wikiPagesByTitle = new Map();
    }
    return wikiPagesByTitle;
  }

  // Given a grounded_in name (e.g. 'Caravel "Car" Asteri'), find a
  // matching wiki page by case-insensitive title — exact first, then a
  // best-effort substring fallback so 'Caravel' will still match
  // 'Caravel "Car" Asteri' if the gallery only recorded the short name.
  function resolveWikiPageForName(map, name) {
    if (!name) return null;
    const key = name.toLowerCase();
    if (map.has(key)) return map.get(key);
    for (const [title, entry] of map.entries()) {
      if (title.includes(key) || key.includes(title)) return entry;
    }
    return null;
  }

  async function togglePinMenu(entry) {
    if (!pinMenuEl) return;
    if (!pinMenuEl.hidden) {
      pinMenuEl.hidden = true;
      return;
    }
    pinMenuEl.innerHTML = '<div class="vos-art-pin-empty">Loading wiki entries…</div>';
    pinMenuEl.hidden = false;

    const map = await loadWikiPagesIndex();
    const grounded = Array.isArray(entry.grounded_in) ? entry.grounded_in : [];
    const candidates = [];
    const seen = new Set();
    grounded.forEach((name) => {
      const match = resolveWikiPageForName(map, name);
      if (!match || seen.has(match.url)) return;
      seen.add(match.url);
      candidates.push({ name, page: match });
    });

    pinMenuEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'vos-art-pin-menu-title';
    title.textContent = 'Pin to wiki';
    pinMenuEl.appendChild(title);

    if (!candidates.length) {
      const empty = document.createElement('div');
      empty.className = 'vos-art-pin-empty';
      empty.textContent = grounded.length
        ? 'None of the grounded entities match a published wiki page.'
        : 'This image has no grounded entities to pin to.';
      pinMenuEl.appendChild(empty);
      return;
    }

    candidates.forEach((cand) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vos-art-pin-option';
      const labelWrap = document.createElement('span');
      const nameEl = document.createElement('div');
      nameEl.textContent = cand.page.title;
      labelWrap.appendChild(nameEl);
      btn.appendChild(labelWrap);
      const kind = document.createElement('span');
      kind.className = 'vos-art-pin-option-kind';
      kind.textContent = cand.page.kind || 'Wiki';
      btn.appendChild(kind);
      btn.addEventListener('click', () => pinImageToWiki(entry, cand.page, btn));
      pinMenuEl.appendChild(btn);
    });
  }

  async function pinImageToWiki(entry, page, button) {
    const creator = getCurrentCreatorName();
    if (!creator || !getCurrentAuthToken()) {
      setStatus('Log in to pin images.', true);
      pinMenuEl.hidden = true;
      await openStudioLogin();
      return;
    }
    button.disabled = true;
    const originalText = button.firstChild ? button.firstChild.textContent : '';
    button.firstChild && (button.firstChild.textContent = 'Pinning…');
    try {
      const r = await fetch(
        API_BASE + '/api/gallery/' + encodeURIComponent(entry.id)
          + '/pin?name=' + encodeURIComponent(creator),
        {
          method: 'POST',
          headers: requestHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ wiki_url: page.url }),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      if (data.already_pinned) {
        setStatus('Already pinned to ' + page.title + '.');
      } else {
        setStatus('Pinned to ' + page.title + '. It will appear after the next site build.');
      }
    } catch (e) {
      setStatus('Pin failed: ' + e.message, true);
    } finally {
      button.disabled = false;
      button.firstChild && (button.firstChild.textContent = originalText);
      pinMenuEl.hidden = true;
    }
  }
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  lightbox.querySelector('.vos-art-lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  // ── Generate ─────────────────────────────────────────────────────────
  function setStatus(text, isError, options = {}) {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
    if (text && !isError && options.clearAfter) {
      statusTimer = setTimeout(() => {
        statusEl.textContent = '';
        statusEl.classList.remove('is-error');
        statusTimer = null;
      }, options.clearAfter);
    }
  }

  async function deleteEntry(entry, sourceButton) {
    if (!entry || !entry.can_delete || !isCurrentDm()) {
      setStatus('DM login required to delete gallery art.', true);
      return;
    }
    const ok = confirm(
      `Delete this image?\n\n"${entryTitle(entry)}"\n\n` +
      `This is permanent — the PNG and its manifest entry are removed from the server.`
    );
    if (!ok) return;
    if (sourceButton) sourceButton.disabled = true;
    try {
      const res = await fetch(API_BASE + '/api/gallery/' + encodeURIComponent(entry.id), {
        method: 'DELETE',
        headers: requestHeaders(),
      });
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

  function getSeenDoneJob() {
    try { return localStorage.getItem(SEEN_DONE_JOB_KEY) || ''; } catch (e) { return ''; }
  }

  function clearPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function setGenerateButton(disabled, text) {
    generateEl.disabled = !!disabled;
    generateEl.textContent = text || (hasAuthenticatedCreator() ? 'Generate' : 'Log in to Generate');
  }

  function updateGenerateAccess() {
    if (isSubmitting || pollTimer) return;
    setGenerateButton(false);
    if (!hasAuthenticatedCreator()) {
      setStatus('Log in before generating so the piece is tied to your account.', true);
      return;
    }
    if (statusEl.textContent === 'Log in before generating so the piece is tied to your account.') {
      setStatus('');
    }
  }

  function showSubmitting() {
    latestEl.classList.remove('is-shown', 'has-image', 'has-error');
    setGenerateButton(true, 'Submitting…');
    setStatus('Submitting job to the Studio.');
  }

  function showGenerating(job) {
    clearObjectUrl(latestImg);
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
  }

  function showJobDone(job) {
    try {
      localStorage.setItem(SEEN_DONE_JOB_KEY, String(job.id || job.jobId));
      window.dispatchEvent(new CustomEvent('vos:avatar-badge-refresh'));
    } catch (e) {}
    storeActiveJob(null);
    setImageSrc(latestImg, job.result_url, { visibility: 'private' }, true);
    latestImg.alt = job.title || job.prompt || 'Generated art';
    latestDetails.style.display = 'none';
    latestEnhanced.innerHTML = '';
    const title = escapeHtml(job.title || job.prompt || 'Generated art');
    const privateHref = job.gallery_id
      ? `/Tools/art/?gallery=mine&image=${encodeURIComponent(job.gallery_id)}`
      : '#vos-art-gallery-section';
    latestCap.innerHTML = `${title}<br><a href="${privateHref}">Open private piece &rarr;</a> · <a href="/art-submissions/">Art submissions &rarr;</a>`;
    latestEl.classList.remove('has-error');
    latestEl.classList.add('is-shown', 'has-image');
    setGenerateButton(false);
    setStatus('Done. Saved privately. Share it to the group gallery when it is table-safe.', false, { clearAfter: 6500 });
  }

  function copyForErrorCode(code, fallback, extras) {
    extras = extras || {};
    switch (code) {
      case 'quota': {
        const reset = extras.resets_at
          ? new Date(extras.resets_at + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
          : 'next month';
        return {
          title: 'Monthly limit reached',
          message: `You've used all your image generations for this month. Resets ${reset}.`,
          allowRetry: false,
        };
      }
      case 'auth':
        return {
          title: 'Log in to generate',
          message: 'Generation is tied to your player account. Log in and try again.',
          allowRetry: true,
        };
      case 'invalid_prompt':
        return {
          title: 'Prompt not accepted',
          message: fallback || 'The prompt was rejected — try rephrasing.',
          allowRetry: true,
        };
      case 'api_error':
        return {
          title: 'OpenAI is unavailable',
          message: 'The image API didn’t respond. Wait a minute and try again.',
          allowRetry: true,
        };
      default:
        return {
          title: 'Generation failed',
          message: fallback || 'The server marked this job as failed.',
          allowRetry: true,
        };
    }
  }

  function showJobError(job) {
    storeActiveJob(null);
    clearObjectUrl(latestImg);
    latestImg.removeAttribute('src');
    latestImg.alt = '';
    pendingPromptEl.textContent = '';
    latestDetails.style.display = 'none';
    latestEnhanced.innerHTML = '';
    latestCap.innerHTML = '';
    const copy = copyForErrorCode(job.error_code, job.error_message, job.quota || {});
    const wrap = document.createElement('div');
    wrap.className = 'vos-art-latest-error';
    const title = document.createElement('strong');
    title.textContent = copy.title;
    const message = document.createElement('p');
    message.textContent = copy.message;
    wrap.append(title, message);
    if (copy.allowRetry) {
      const retry = document.createElement('button');
      retry.className = 'vos-art-retry';
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => {
        promptEl.value = job.prompt || promptEl.value;
        generate();
      });
      wrap.appendChild(retry);
    }
    latestCap.appendChild(wrap);
    latestEl.classList.remove('has-image');
    latestEl.classList.add('is-shown', 'has-error');
    setGenerateButton(false);
    setStatus(copy.title + '.', true);
  }

  function showIdle() {
    latestEl.classList.remove('is-shown', 'has-image');
    latestEl.classList.remove('has-error');
    clearObjectUrl(latestImg);
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
      currentGalleryScope = 'mine';
      syncGalleryChrome();
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
    if (!creator || !hasAuthenticatedCreator()) return;
    try {
      const url = API_BASE + '/api/studio/jobs?mine=1&name=' + encodeURIComponent(creator);
      const response = await fetch(url, { cache: 'no-store', headers: requestHeaders() });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const stored = getStoredActiveJob();
      const job = jobs.find((candidate) => candidate.id === stored || candidate.jobId === stored)
        || jobs.find((candidate) => candidate.status === 'pending');
      if (!job) {
        if (stored) storeActiveJob(null);
        return;
      }
      const jobId = String(job.id || job.jobId || '');
      if (job.status === 'done' && stored) {
        const updatedAt = Date.parse(job.updated_at || job.created_at || '');
        const staleDone = Number.isFinite(updatedAt) && Date.now() - updatedAt > 15 * 60 * 1000;
        if (getSeenDoneJob() === jobId || staleDone) {
          storeActiveJob(null);
          return;
        }
      }
      renderJob(job);
      if (job.status === 'pending') startPolling(job.jobId || job.id);
    } catch (e) {}
  }

  async function generate() {
    if (isSubmitting || generateEl.disabled) return;
    if (!hasAuthenticatedCreator()) {
      setStatus('Log in before generating so the piece is tied to your account.', true);
      await openStudioLogin();
      return;
    }
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
    if (!creatorName || !hasAuthenticatedCreator()) {
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
        // Render the same error card the polling path uses so quota /
        // auth / invalid_prompt get the right copy.
        showJobError({
          prompt,
          error_message: err.error || `HTTP ${res.status}`,
          error_code: err.error_code,
          quota: err.quota,
        });
        return;
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
  window.addEventListener('DOMContentLoaded', () => {
    syncGalleryChrome();
    updateGenerateAccess();
    restoreStudioJobs();
  });
  window.addEventListener('vos:identity', () => {
    syncGalleryChrome();
    updateGenerateAccess();
    restoreStudioJobs();
    loadGallery({ quiet: true });
  });
  window.addEventListener('focus', () => {
    syncGalleryChrome();
    loadGallery({ quiet: true });
  });
  syncGalleryChrome();
  updateGenerateAccess();

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
