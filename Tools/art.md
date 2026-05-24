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
  --art-gold: #d4a574;
  --art-gold-dim: #8b7355;
  --art-bg: rgba(13, 11, 17, 0.85);
  --art-border: rgba(139, 115, 85, 0.32);
  --art-border-strong: rgba(212, 165, 116, 0.55);
}

.vos-art-studio {
  margin: 2rem 0 2.5rem;
  padding: 1.5rem 1.6rem 1.7rem;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(20, 18, 24, 0.7), rgba(7, 6, 10, 0.95)),
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212, 165, 116, 0.08), transparent 70%);
  border: 1px solid var(--art-border);
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
}
.vos-art-studio-title {
  display: flex; align-items: baseline; gap: 0.6rem;
  font-family: 'Cinzel', Georgia, serif;
  color: var(--art-gold);
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 0.85rem;
}
.vos-art-studio-title::before {
  content: '✦';
  color: var(--art-gold);
  font-size: 0.85rem;
}

.vos-art-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.85rem; }
.vos-art-field { flex: 1 1 240px; display: flex; flex-direction: column; gap: 0.4rem; }
.vos-art-field-label {
  font-family: 'Cinzel', Georgia, serif;
  color: var(--art-gold);
  font-size: 0.62rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.vos-art-prompt, .vos-art-name {
  width: 100%;
  background: rgba(7, 6, 10, 0.85);
  border: 1px solid var(--art-border);
  border-radius: 4px;
  padding: 0.7rem 0.85rem;
  color: var(--vos-cream);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  line-height: 1.4;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.4);
  resize: vertical;
}
.vos-art-prompt { min-height: 6.5rem; }
.vos-art-name { min-height: unset; }
.vos-art-prompt:focus, .vos-art-name:focus {
  outline: none;
  border-color: var(--art-border-strong);
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.4), 0 0 0 3px rgba(212, 165, 116, 0.14);
}

/* Style chip picker ─────────────────────────────────────────────────── */
.vos-art-styles {
  display: flex; flex-wrap: wrap; gap: 0.45rem;
  margin: 0.2rem 0 1rem;
}
.vos-art-style {
  display: inline-flex; flex-direction: column; align-items: flex-start;
  padding: 0.5rem 0.85rem;
  background: rgba(7, 6, 10, 0.7);
  border: 1px solid var(--art-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--vos-text);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  max-width: 220px;
}
.vos-art-style small {
  display: block;
  margin-top: 0.25rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.78rem;
  letter-spacing: 0;
  color: rgba(212, 165, 116, 0.6);
  text-transform: none;
  line-height: 1.3;
}
.vos-art-style:hover {
  background: rgba(212, 165, 116, 0.06);
  border-color: var(--art-border-strong);
  color: var(--art-gold);
}
.vos-art-style.is-active {
  background: linear-gradient(180deg, rgba(212, 165, 116, 0.18), rgba(212, 165, 116, 0.05));
  border-color: var(--art-gold);
  color: var(--vos-cream);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px rgba(212, 165, 116, 0.18);
}
.vos-art-style.is-active small { color: rgba(232, 220, 200, 0.85); }

/* Generate button + status row ─────────────────────────────────────── */
.vos-art-actions {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  margin-top: 0.4rem;
}
.vos-art-btn {
  appearance: none;
  background: linear-gradient(180deg, #e6c08a 0%, #c9a371 60%, #a8835a 100%);
  color: #0d0b11;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 3px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  padding: 0.85rem 1.6rem;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(212, 165, 116, 0.3),
              inset 0 1px 0 rgba(255,255,255,0.35),
              inset 0 -1px 0 rgba(0,0,0,0.25);
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
}
.vos-art-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 26px rgba(212, 165, 116, 0.5), inset 0 1px 0 rgba(255,255,255,0.4); }
.vos-art-btn:disabled { opacity: 0.55; cursor: progress; transform: none; }
.vos-art-status {
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  font-size: 0.92rem;
  color: rgba(212, 165, 116, 0.78);
  line-height: 1.35;
}
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
.vos-art-latest img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.75);
  border: 1px solid var(--art-border);
}
.vos-art-latest-caption {
  margin-top: 0.7rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(232, 220, 200, 0.78);
  font-size: 0.92rem;
}

/* "Let Enzo refine my prompt" checkbox row ─────────────────────────── */
.vos-art-enhance-toggle {
  display: flex; gap: 0.8rem; align-items: flex-start;
  cursor: pointer;
  padding: 0.85rem 0.9rem;
  background: rgba(7, 6, 10, 0.55);
  border: 1px solid var(--art-border);
  border-radius: 5px;
  transition: border-color 0.15s, background 0.15s;
}
.vos-art-enhance-toggle:hover { border-color: var(--art-border-strong); }
.vos-art-enhance-toggle input[type="checkbox"] {
  flex: 0 0 auto;
  width: 1.05rem; height: 1.05rem; margin: 0.2rem 0 0;
  accent-color: var(--art-gold);
}
.vos-art-enhance-text {
  display: flex; flex-direction: column; gap: 0.2rem;
}
.vos-art-enhance-text strong {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
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
  margin: 2rem 0 1rem;
}
.vos-art-gallery-head h2 {
  font-family: 'Cinzel', Georgia, serif;
  color: var(--art-gold);
  font-size: 1.05rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin: 0;
  border: none;
}
.vos-art-gallery-head h2::after { content: none; }
.vos-art-gallery-count {
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  color: rgba(212, 165, 116, 0.55);
  font-size: 0.9rem;
}

.vos-art-gallery {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin: 0 0 1.5rem;
}
@media (min-width: 540px)  { .vos-art-gallery { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px)  { .vos-art-gallery { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1280px) { .vos-art-gallery { grid-template-columns: repeat(4, 1fr); } }

.vos-art-card {
  position: relative;
  display: block;
  border-radius: 6px;
  overflow: hidden;
  background: #0a0a0d;
  border: 1px solid var(--art-border);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  cursor: zoom-in;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.vos-art-card:hover {
  transform: translateY(-3px);
  border-color: var(--art-border-strong);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(212, 165, 116, 0.18);
}
.vos-art-card img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: #0a0a0d;
}
.vos-art-card-meta {
  padding: 0.55rem 0.75rem 0.75rem;
  border-top: 1px solid rgba(139, 115, 85, 0.16);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.85rem;
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
  letter-spacing: 0.18em;
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
  align-items: center; justify-content: center;
  padding: 2rem;
  backdrop-filter: blur(6px);
}
.vos-art-lightbox.is-open { display: flex; }
.vos-art-lightbox-inner {
  position: relative;
  max-width: min(94vw, 1400px);
  max-height: 90vh;
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
</style>

# Art Studio

Generate campaign art with Enzo's image model and contribute to the shared player gallery. Pick a style, describe what you want to see, and the result is automatically added to the gallery below for everyone at the table to find. Generation takes **30–90 seconds**.

<div class="vos-art">

<section class="vos-art-studio" aria-label="Generate new art">
  <div class="vos-art-studio-title">Compose a New Piece</div>

  <div class="vos-art-field">
    <label class="vos-art-field-label" for="vos-art-prompt">Description</label>
    <textarea id="vos-art-prompt" class="vos-art-prompt" rows="4"
              placeholder="A masked masquerader on the bridge above the Echoing Court, autumn leaves on the canal, candlelight from the windows above…"
              maxlength="3000"></textarea>
  </div>

  <div class="vos-art-field">
    <label class="vos-art-field-label">Style</label>
    <div id="vos-art-styles" class="vos-art-styles" role="radiogroup" aria-label="Visual style">
      <div class="vos-art-empty" style="padding: 0.6rem 1rem;">Loading styles…</div>
    </div>
  </div>

  <div class="vos-art-row">
    <div class="vos-art-field" style="flex: 0 1 260px;">
      <label class="vos-art-field-label" for="vos-art-name">Created by <span style="opacity:0.6">(optional)</span></label>
      <input id="vos-art-name" class="vos-art-name" type="text" maxlength="64" placeholder="Your name or handle">
    </div>
    <div class="vos-art-field" style="flex: 1 1 320px; align-self: end;">
      <label class="vos-art-enhance-toggle" for="vos-art-enhance">
        <input id="vos-art-enhance" type="checkbox" checked>
        <span class="vos-art-enhance-text">
          <strong>Let Enzo refine my prompt</strong>
          <em>Names of campaign characters / locations get expanded into their canonical descriptions, and the prompt is rewritten for image quality.</em>
        </span>
      </label>
    </div>
  </div>

  <div class="vos-art-actions">
    <button id="vos-art-generate" class="vos-art-btn" type="button">Generate</button>
    <div id="vos-art-status" class="vos-art-status" role="status" aria-live="polite"></div>
  </div>

  <div id="vos-art-latest" class="vos-art-latest">
    <img id="vos-art-latest-img" alt="Most recent generation">
    <div id="vos-art-latest-caption" class="vos-art-latest-caption"></div>
    <details id="vos-art-latest-details" class="vos-art-details" style="display:none;">
      <summary>How Enzo saw it</summary>
      <div id="vos-art-latest-enhanced" class="vos-art-enhanced"></div>
    </details>
  </div>
</section>

<div class="vos-art-gallery-head">
  <h2>Shared Gallery</h2>
  <div class="vos-art-gallery-count" id="vos-art-gallery-count">Loading…</div>
</div>

<div id="vos-art-gallery" class="vos-art-gallery"></div>

<div id="vos-art-lightbox" class="vos-art-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vos-art-lightbox-caption">
  <div class="vos-art-lightbox-inner">
    <button class="vos-art-lightbox-close" type="button" aria-label="Close lightbox">×</button>
    <img id="vos-art-lightbox-img" alt="">
    <div id="vos-art-lightbox-caption" class="vos-art-lightbox-caption"></div>
  </div>
</div>

</div>

<script>
(function () {
  const API_BASE = 'https://loremaster.valleyofshadows.wiki';
  const NAME_KEY = 'velly.artStudio.lastName';
  const STYLE_KEY = 'velly.artStudio.lastStyle';

  const $ = (id) => document.getElementById(id);
  const promptEl       = $('vos-art-prompt');
  const nameEl         = $('vos-art-name');
  const stylesEl       = $('vos-art-styles');
  const enhanceEl      = $('vos-art-enhance');
  const generateEl     = $('vos-art-generate');
  const statusEl       = $('vos-art-status');
  const latestEl       = $('vos-art-latest');
  const latestImg      = $('vos-art-latest-img');
  const latestCap      = $('vos-art-latest-caption');
  const latestDetails  = $('vos-art-latest-details');
  const latestEnhanced = $('vos-art-latest-enhanced');
  const galleryEl      = $('vos-art-gallery');
  const countEl        = $('vos-art-gallery-count');
  const lightbox       = $('vos-art-lightbox');
  const lightImg       = $('vos-art-lightbox-img');
  const lightCap       = $('vos-art-lightbox-caption');

  const ENHANCE_KEY = 'velly.artStudio.enhance';

  let selectedStyle = null;
  let defaultStyle = 'valley';

  // ── Restore form state from localStorage ────────────────────────────
  try {
    const lastName = localStorage.getItem(NAME_KEY);
    if (lastName) nameEl.value = lastName;
  } catch (e) {}

  try {
    const lastEnhance = localStorage.getItem(ENHANCE_KEY);
    if (lastEnhance === '0') enhanceEl.checked = false;
  } catch (e) {}

  enhanceEl.addEventListener('change', () => {
    try { localStorage.setItem(ENHANCE_KEY, enhanceEl.checked ? '1' : '0'); } catch (e) {}
  });

  nameEl.addEventListener('change', () => {
    try { localStorage.setItem(NAME_KEY, nameEl.value); } catch (e) {}
  });

  // ── Styles ───────────────────────────────────────────────────────────
  function renderStyles(styles) {
    stylesEl.innerHTML = '';
    let savedKey = null;
    try { savedKey = localStorage.getItem(STYLE_KEY); } catch (e) {}
    selectedStyle = savedKey && styles.some(s => s.key === savedKey)
      ? savedKey
      : defaultStyle;
    styles.forEach(s => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'vos-art-style' + (s.key === selectedStyle ? ' is-active' : '');
      el.dataset.styleKey = s.key;
      el.setAttribute('role', 'radio');
      el.setAttribute('aria-checked', String(s.key === selectedStyle));
      el.innerHTML = `${escapeHtml(s.label)}<small>${escapeHtml(s.description)}</small>`;
      el.addEventListener('click', () => {
        selectedStyle = s.key;
        try { localStorage.setItem(STYLE_KEY, s.key); } catch (e) {}
        stylesEl.querySelectorAll('.vos-art-style').forEach(b => {
          const on = b.dataset.styleKey === s.key;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-checked', String(on));
        });
      });
      stylesEl.appendChild(el);
    });
  }

  fetch(API_BASE + '/api/art-styles')
    .then(r => r.json())
    .then(data => {
      defaultStyle = data.default || defaultStyle;
      renderStyles(data.styles || []);
    })
    .catch(() => {
      stylesEl.innerHTML = `<div class="vos-art-empty" style="padding: 0.6rem 1rem;">Could not load styles. Make sure the chatbot is reachable.</div>`;
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
      card.href = API_BASE + e.image_url;
      card.dataset.entry = JSON.stringify(e);
      card.addEventListener('click', (evt) => {
        evt.preventDefault();
        openLightbox(e);
      });
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = e.prompt || 'Gallery piece';
      img.src = API_BASE + e.image_url;
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

  function loadGallery() {
    countEl.textContent = 'Loading…';
    return fetch(API_BASE + '/api/gallery?limit=80')
      .then(r => r.json())
      .then(data => renderGallery(data.entries || [], data.total || 0))
      .catch(() => {
        countEl.textContent = 'Gallery unavailable.';
        galleryEl.innerHTML = `<div class="vos-art-empty">Couldn't reach the gallery. Try again in a moment.</div>`;
      });
  }
  loadGallery();

  // ── Lightbox ────────────────────────────────────────────────────────
  function openLightbox(e) {
    lightImg.src = API_BASE + e.image_url;
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
  }
  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightImg.src = '';
  }
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  lightbox.querySelector('.vos-art-lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  // ── Generate ─────────────────────────────────────────────────────────
  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  generateEl.addEventListener('click', async () => {
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
    generateEl.disabled = true;
    generateEl.textContent = 'Generating…';
    const enhance = !!enhanceEl.checked;
    setStatus(enhance
      ? 'Composing — Enzo is refining your prompt, then drawing. 30–90 seconds.'
      : 'Composing — this takes 30–90 seconds.');
    latestEl.classList.remove('is-shown');
    latestDetails.style.display = 'none';
    latestEnhanced.innerHTML = '';

    try {
      const res = await fetch(API_BASE + '/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          created_by: nameEl.value.trim(),
          enhance,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      let src = null;
      if (data.b64)       src = 'data:image/png;base64,' + data.b64;
      else if (data.gallery) src = API_BASE + data.gallery.image_url;
      else if (data.url)  src = data.url;

      if (src) {
        latestImg.src = src;
        latestImg.alt = prompt;
        let captionHtml = data.gallery
          ? 'Saved to the shared gallery below.'
          : '(could not save to gallery — image shown locally only)';
        if (data.grounded_in && data.grounded_in.length) {
          const chips = data.grounded_in.map(n =>
            `<span class="vos-art-grounded-chip">${escapeHtml(n)}</span>`
          ).join('');
          captionHtml += `<div class="vos-art-grounded" style="justify-content:center;margin-top:0.5rem;">${chips}</div>`;
        }
        latestCap.innerHTML = captionHtml;
        if (data.enhanced_prompt && data.enhanced_prompt !== prompt) {
          latestEnhanced.textContent = data.enhanced_prompt;
          latestDetails.style.display = 'block';
        }
        latestEl.classList.add('is-shown');
      }
      let doneMsg = 'Done. The shared gallery refreshed below.';
      if (data.grounded_in && data.grounded_in.length) {
        doneMsg = `Done — grounded in ${data.grounded_in.join(', ')}.`;
      }
      setStatus(doneMsg);
      promptEl.value = '';
      // Give the server a beat to finish flushing the manifest, then refresh.
      setTimeout(loadGallery, 250);
    } catch (e) {
      console.error(e);
      setStatus('Generation failed: ' + e.message, true);
    } finally {
      generateEl.disabled = false;
      generateEl.textContent = 'Generate';
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
