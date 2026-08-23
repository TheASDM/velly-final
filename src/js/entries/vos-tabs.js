/* Segmented sub-navigation shared by the calendar hub and the DM panel.
 *
 * Markup contract:
 *   <nav data-vos-tabs> <button data-view="foo">…</button> … </nav>
 *   <section data-vos-view="foo">…</section> …
 *
 * The active view syncs to location.hash (#foo) so views are deep-linkable,
 * and the last-viewed segment is remembered per page for return visits.
 * Emits window 'vos:view-shown' {view} whenever a view becomes active —
 * pages use it to lazy-load a view's data on first open.
 */
(function () {
  const nav = document.querySelector('[data-vos-tabs]');
  if (!nav) return;
  const buttons = Array.from(nav.querySelectorAll('[data-view]'));
  const views = Array.from(document.querySelectorAll('[data-vos-view]'));
  if (!buttons.length || !views.length) return;

  const valid = new Set(buttons.map((button) => button.dataset.view));
  const storageKey = 'vos.view.' + location.pathname;

  function fromHash() {
    const hash = location.hash.replace('#', '');
    return valid.has(hash) ? hash : null;
  }

  function show(view, updateHash) {
    if (!valid.has(view)) return;
    buttons.forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    views.forEach((section) => {
      section.hidden = section.dataset.vosView !== view;
    });
    try { sessionStorage.setItem(storageKey, view); } catch (error) {}
    if (updateHash && location.hash !== '#' + view) {
      history.replaceState(null, '', '#' + view);
    }
    // Keep the active chip visible when the index scrolls horizontally.
    const active = buttons.find((button) => button.dataset.view === view);
    if (active && active.scrollIntoView) {
      try {
        active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      } catch (error) {}
    }
    window.dispatchEvent(new CustomEvent('vos:view-shown', { detail: { view } }));
  }

  buttons.forEach((button) => {
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => show(button.dataset.view, true));
  });
  window.addEventListener('hashchange', () => {
    const view = fromHash();
    if (view) show(view, false);
  });

  let initial = fromHash();
  if (!initial) {
    try { initial = sessionStorage.getItem(storageKey); } catch (error) {}
  }
  if (!initial || !valid.has(initial)) initial = buttons[0].dataset.view;
  show(initial, false);

  window.VOS_TABS = { show };
})();
