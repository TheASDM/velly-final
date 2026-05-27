// Live overlay for "Currently In Play" cards.
//
// Eleventy ships a static snapshot from _data/campaign.js so the page
// renders something immediately and works offline. This script fetches
// /api/in-play and, if it returns any rows, replaces the static markup
// with the live list. Failures silently leave the static snapshot in
// place — that's the intended fallback.
//
// Containers opt in via `data-in-play-container="home"|"venturia"` and
// optionally `data-in-play-limit="N"` to cap the row count.
(function () {
  const containers = document.querySelectorAll('[data-in-play-container]');
  if (!containers.length) return;

  fetch('/api/in-play', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data || !Array.isArray(data.items) || !data.items.length) return;
      containers.forEach((container) => {
        const template = container.getAttribute('data-in-play-container');
        const limitAttr = container.getAttribute('data-in-play-limit');
        const limit = limitAttr ? parseInt(limitAttr, 10) : 0;
        const items = limit > 0 ? data.items.slice(0, limit) : data.items;
        container.innerHTML = items.map((item) => renderChip(item, template)).join('');
      });
    })
    .catch(() => {});

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderChip(item, template) {
    const name = esc(item.name);
    const role = esc(item.role);
    const kind = esc(item.kind);
    const emblem = esc(item.emblem);
    const link = esc(item.link || '#');

    if (template === 'home') {
      return (
        `<a class="vos-play-chip" href="${link}">` +
        `<span class="vos-play-emblem" aria-hidden="true">${emblem}</span>` +
        `<span class="vos-play-name">${name}<small>${role} · ${kind}</small></span>` +
        `</a>`
      );
    }
    if (template === 'venturia') {
      return (
        `<a class="vos-row-chip" href="${link}">` +
        `<span>` +
        `<span class="vos-row-chip-title">${name}</span>` +
        `<span class="vos-row-chip-meta">${role} · ${kind}</span>` +
        `</span>` +
        `<span class="vos-row-chip-badge" aria-hidden="true">${emblem}</span>` +
        `</a>`
      );
    }
    return '';
  }
})();
