(function () {
  const root = document.currentScript.previousElementSibling;
  if (!root) return;

  const apiBase = root.dataset.apiBase || '';
  const limit = Math.max(1, Math.min(parseInt(root.dataset.limit || '5', 10) || 5, 20));
  const source = (root.dataset.source || 'recent').toLowerCase();
  const emptyMessage = root.dataset.emptyMessage || 'The shared gallery is empty. New studio pieces will appear here automatically.';
  const emptySignedOutMessage = root.dataset.emptySignedOut || emptyMessage;
  const viewport = root.querySelector('.vos-gallery-carousel-viewport');
  const track = root.querySelector('.vos-gallery-carousel-track');
  const prevBtn = root.querySelector('.vos-gallery-carousel-prev');
  const nextBtn = root.querySelector('.vos-gallery-carousel-next');
  const dotsEl = root.querySelector('.vos-gallery-carousel-dots');
  const emptyEl = root.querySelector('.vos-gallery-carousel-empty');
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let entries = [];
  let index = 0;
  let timer = null;
  let paused = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let titleAliases = new Map();

  function escapeText(value) {
    return String(value == null ? '' : value);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function addTitleAlias(map, alias, canonical) {
    const cleanAlias = String(alias || '').replace(/\s+/g, ' ').trim();
    const cleanCanonical = String(canonical || '').replace(/\s+/g, ' ').trim();
    if (!cleanAlias || !cleanCanonical) return;
    if (cleanAlias.length < 3) return;
    const key = cleanAlias.toLowerCase();
    const existing = map.get(key);
    if (!existing || cleanCanonical.length > existing.length) {
      map.set(key, cleanCanonical);
    }
  }

  function addTitleAliasesFromTitle(map, title, options) {
    const opts = options || {};
    const skipTitles = new Set(['Index', 'Characters', 'NPCs', 'Locations', 'Culture', 'Factions', 'Government', 'Lore', 'Maps']);
    const base = String(title || '')
      .split(/\s+[—-]\s+/)[0]
      .replace(/\s+/g, ' ')
      .trim();
    if (!base || skipTitles.has(base)) return;

    addTitleAlias(map, base, base);

    const roleStripped = base.replace(/^(Master Artisan|Archmagister|Father|Mother-Abbot|Lord-Admiral|Guildmaster|Guild-Master|Lady|Lord)\s+/i, '');
    addTitleAlias(map, roleStripped, roleStripped);

    const words = base.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || [];
    const stop = new Set(['the', 'and', 'of', 'for', 'with', 'from', 'into', 'index']);
    if (opts.wordAliases || words.length === 1) {
      words.forEach((word) => {
        const lower = word.toLowerCase();
        if (word.length > 3 && !stop.has(lower)) addTitleAlias(map, word, word);
      });
    }
    for (let size = 2; size <= Math.min(4, words.length); size += 1) {
      for (let i = 0; i <= words.length - size; i += 1) {
        const chunk = words.slice(i, i + size);
        if (chunk.every((word) => stop.has(word.toLowerCase()))) continue;
        const alias = chunk.join(' ');
        addTitleAlias(map, alias, alias);
      }
    }
  }

  function loadTitleAliases() {
    if (window.__vosCarouselTitleAliases) {
      titleAliases = window.__vosCarouselTitleAliases;
      return Promise.resolve();
    }
    return fetch('/images/sitemap.json')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((pages) => {
        const map = new Map();
        (Array.isArray(pages) ? pages : []).forEach((page) => {
          const url = String(page.url || '');
          if (!/^\/en\/Venturia\//.test(url)) return;
          addTitleAliasesFromTitle(map, page.title, {
            wordAliases: /\/Characters\//.test(url),
          });
        });
        window.__vosCarouselTitleAliases = map;
        titleAliases = map;
      })
      .catch(() => {
        titleAliases = new Map();
      });
  }

  function applyTitleCasing(text, extraNames) {
    const aliases = new Map(titleAliases);
    (extraNames || []).forEach((name) => addTitleAliasesFromTitle(aliases, name));
    Array.from(aliases.entries())
      .sort((a, b) => b[0].length - a[0].length)
      .forEach(([alias, canonical]) => {
        const pattern = new RegExp('(^|[^A-Za-z0-9])(' + escapeRegExp(alias) + ')(?=$|[^A-Za-z0-9])', 'gi');
        text = text.replace(pattern, (match, prefix) => prefix + canonical);
      });
    return text;
  }

  function normalizePrompt(entry) {
    let text = String(entry.prompt || '').replace(/\s+/g, ' ').trim();
    if (!text) return '(no prompt recorded)';
    text = applyTitleCasing(text, entry.grounded_in || []);
    text = text.replace(/^([^A-Za-z0-9]*)([a-z])/, (match, prefix, first) => prefix + first.toUpperCase());
    if (!/[.!?…]["')\]]?$/.test(text)) text += '.';
    return text;
  }

  function displayPrompt(entry) {
    return normalizePrompt(entry);
  }

  function fmtRel(iso) {
    const d = new Date(iso);
    const ms = d.getTime();
    if (Number.isNaN(ms)) return 'recently';
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function imageSrc(entry) {
    try {
      return new URL(entry.image_url || '', apiBase).href;
    } catch (e) {
      return apiBase + (entry.image_url || '');
    }
  }

  function showEmpty(message) {
    track.innerHTML = '';
    dotsEl.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.textContent = message || emptyEl.textContent;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }

  function makeSlide(entry, i) {
    const slide = document.createElement('button');
    slide.type = 'button';
    slide.className = 'vos-gallery-slide';
    slide.setAttribute('aria-label', 'Open gallery image ' + (i + 1));
    slide.dataset.index = String(i);

    const media = document.createElement('span');
    media.className = 'vos-gallery-slide-media';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = displayPrompt(entry);
    img.src = imageSrc(entry);
    media.appendChild(img);

    const body = document.createElement('span');
    body.className = 'vos-gallery-slide-body';

    const caption = document.createElement('span');
    caption.className = 'vos-gallery-slide-caption';
    caption.textContent = displayPrompt(entry);
    body.appendChild(caption);

    const tags = document.createElement('span');
    tags.className = 'vos-gallery-slide-tags';
    (entry.grounded_in || []).slice(0, 4).forEach((name) => {
      const chip = document.createElement('span');
      chip.className = 'vos-gallery-tag';
      chip.textContent = name;
      tags.appendChild(chip);
    });
    if (tags.children.length) body.appendChild(tags);

    const meta = document.createElement('span');
    meta.className = 'vos-gallery-slide-meta';
    meta.textContent = 'by ' + (entry.created_by || 'Anonymous') + ' \u00b7 ' + fmtRel(entry.created_at);
    body.appendChild(meta);

    slide.appendChild(media);
    slide.appendChild(body);
    slide.addEventListener('click', () => openEntry(entry));
    return slide;
  }

  function makeDot(i) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'vos-gallery-dot';
    dot.setAttribute('aria-label', 'Show gallery image ' + (i + 1));
    dot.addEventListener('click', () => goTo(i, true));
    return dot;
  }

  function render() {
    track.innerHTML = '';
    dotsEl.innerHTML = '';
    emptyEl.hidden = true;

    entries.forEach((entry, i) => {
      track.appendChild(makeSlide(entry, i));
      dotsEl.appendChild(makeDot(i));
    });
    index = 0;
    update();
    maybeStart();
  }

  function update() {
    track.style.transform = 'translateX(' + (-index * 100) + '%)';
    const slides = track.querySelectorAll('.vos-gallery-slide');
    const dots = dotsEl.querySelectorAll('.vos-gallery-dot');
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.tabIndex = active ? 0 : -1;
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dots.forEach((dot, i) => {
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    prevBtn.disabled = entries.length <= 1;
    nextBtn.disabled = entries.length <= 1;
  }

  function goTo(nextIndex, userInitiated) {
    if (!entries.length) return;
    index = (nextIndex + entries.length) % entries.length;
    update();
    if (userInitiated) restart();
  }

  function next(userInitiated) {
    goTo(index + 1, userInitiated);
  }

  function prev(userInitiated) {
    goTo(index - 1, userInitiated);
  }

  function maybeStart() {
    if (reducedMotion || entries.length <= 1 || paused) return;
    stop();
    timer = window.setInterval(() => {
      if (!paused) next(false);
    }, 6000);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function restart() {
    stop();
    maybeStart();
  }

  function pause() {
    paused = true;
    stop();
  }

  function resume() {
    paused = false;
    maybeStart();
  }

  function openEntry(entry) {
    const displayEntry = Object.assign({}, entry, {
      prompt: displayPrompt(entry),
    });
    const event = new CustomEvent('vos:open-gallery-piece', {
      detail: displayEntry,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    if (event.defaultPrevented) return;
    openFallbackLightbox(displayEntry);
  }

  function ensureLightbox() {
    let modal = document.getElementById('vos-carousel-lightbox');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'vos-carousel-lightbox';
    modal.className = 'vos-carousel-lightbox';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="vos-carousel-lightbox-inner">' +
      '<button class="vos-carousel-lightbox-close" type="button" aria-label="Close lightbox">&times;</button>' +
      '<img class="vos-carousel-lightbox-img" alt="">' +
      '<div class="vos-carousel-lightbox-caption"></div>' +
      '</div>';
    document.body.appendChild(modal);

    const close = () => closeLightbox(modal);
    modal.addEventListener('click', (evt) => {
      if (evt.target === modal) close();
    });
    modal.querySelector('.vos-carousel-lightbox-close').addEventListener('click', close);
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
    return modal;
  }

  function openFallbackLightbox(entry) {
    const modal = ensureLightbox();
    const img = modal.querySelector('.vos-carousel-lightbox-img');
    const caption = modal.querySelector('.vos-carousel-lightbox-caption');
    img.src = imageSrc(entry);
    img.alt = displayPrompt(entry);
    caption.innerHTML = '';
    caption.appendChild(document.createTextNode(escapeText(displayPrompt(entry))));

    if (entry.grounded_in && entry.grounded_in.length) {
      const tags = document.createElement('div');
      tags.className = 'vos-gallery-slide-tags';
      tags.style.justifyContent = 'center';
      tags.style.marginTop = '0.65rem';
      entry.grounded_in.forEach((name) => {
        const chip = document.createElement('span');
        chip.className = 'vos-gallery-tag';
        chip.textContent = name;
        tags.appendChild(chip);
      });
      caption.appendChild(tags);
    }

    if (entry.enhanced_prompt && entry.enhanced_prompt !== entry.prompt) {
      const details = document.createElement('details');
      details.className = 'vos-carousel-details';
      const summary = document.createElement('summary');
      summary.textContent = 'How Enzo saw it';
      const enhanced = document.createElement('div');
      enhanced.className = 'vos-carousel-enhanced';
      enhanced.textContent = entry.enhanced_prompt;
      details.appendChild(summary);
      details.appendChild(enhanced);
      caption.appendChild(details);
    }

    const byline = document.createElement('div');
    byline.className = 'vos-carousel-lightbox-byline';
    byline.textContent = (entry.created_by ? 'By ' + entry.created_by : 'Anonymous') + ' \u00b7 ' + fmtRel(entry.created_at);
    caption.appendChild(byline);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modal.scrollTop = 0;
  }

  function closeLightbox(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    const img = modal.querySelector('.vos-carousel-lightbox-img');
    if (img) img.removeAttribute('src');
  }

  prevBtn.addEventListener('click', () => prev(true));
  nextBtn.addEventListener('click', () => next(true));
  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);
  viewport.addEventListener('keydown', (evt) => {
    if (evt.key === 'ArrowLeft') {
      evt.preventDefault();
      prev(true);
    } else if (evt.key === 'ArrowRight') {
      evt.preventDefault();
      next(true);
    }
  });
  viewport.addEventListener('touchstart', (evt) => {
    const t = evt.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });
  viewport.addEventListener('touchend', (evt) => {
    const t = evt.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next(true) : prev(true);
    }
  }, { passive: true });

  function buildFetchUrl() {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (source === 'favorites') {
      const player = (window.VOS_PWA && window.VOS_PWA.getPlayerName && window.VOS_PWA.getPlayerName()) || '';
      if (!player) return null; // signed-out fast-path; empty state will render
      params.set('favorites', '1');
      params.set('name', player);
    }
    return apiBase + '/api/gallery?' + params.toString();
  }

  function loadCarousel() {
    const url = buildFetchUrl();
    if (!url) {
      if (source === 'favorites') showEmpty(emptySignedOutMessage);
      else showEmpty(emptyMessage);
      return;
    }
    Promise.all([
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        }),
      loadTitleAliases(),
    ])
      .then(([data]) => {
        entries = (data.entries || [])
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit);
        if (!entries.length) {
          showEmpty(emptyMessage);
          return;
        }
        render();
      })
      .catch(() => {
        showEmpty('The shared gallery is unavailable right now.');
      });
  }

  loadCarousel();

  // Re-fetch when the signed-in player changes — switching accounts on
  // a long-lived tab should refresh "My Favorites" without a hard reload.
  if (source === 'favorites') {
    window.addEventListener('vos:identity', loadCarousel);
  }
})();
