/* Segmented sub-navigation shared by the calendar hub and the DM console.
 *
 * Markup contract:
 *   <nav data-vos-tabs> …optional group wrappers… <button data-view="foo">…</button> … </nav>
 *   <section data-vos-view="foo">…</section> …
 *
 * Full tab semantics: the buttons are a roving-tabindex tablist (arrow keys,
 * Home/End), each button controls its named panel, and panels carry
 * role=tabpanel. The active view syncs to location.hash (#foo) so views are
 * deep-linkable, and the last-viewed segment is remembered per page in
 * localStorage — sessionStorage died on iOS PWA relaunch, which is exactly
 * when the DM wants to land back on the tab they were running the table
 * from. Emits window 'vos:view-shown' {view} whenever a view becomes active.
 */
(function () {
  const nav = document.querySelector('[data-vos-tabs]');
  if (!nav) return;
  const buttons = Array.from(nav.querySelectorAll('[data-view]'));
  const views = Array.from(document.querySelectorAll('[data-vos-view]'));
  if (!buttons.length || !views.length) return;

  const valid = new Set(buttons.map((button) => button.dataset.view));
  const storageKey = 'vos.view.' + location.pathname;

  buttons.forEach((button) => {
    button.setAttribute('role', 'tab');
    button.id = button.id || 'vos-tab-' + button.dataset.view;
    button.setAttribute('aria-controls', 'vos-view-' + button.dataset.view);
  });
  views.forEach((section) => {
    section.setAttribute('role', 'tabpanel');
    section.id = section.id || 'vos-view-' + section.dataset.vosView;
    section.setAttribute('aria-labelledby', 'vos-tab-' + section.dataset.vosView);
    section.setAttribute('tabindex', '-1');
  });

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
      button.setAttribute('tabindex', active ? '0' : '-1');
    });
    views.forEach((section) => {
      section.hidden = section.dataset.vosView !== view;
    });
    try { localStorage.setItem(storageKey, view); } catch (error) {}
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

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => show(button.dataset.view, true));
    button.addEventListener('keydown', (event) => {
      let target = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        target = buttons[(index + 1) % buttons.length];
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        target = buttons[(index - 1 + buttons.length) % buttons.length];
      } else if (event.key === 'Home') {
        target = buttons[0];
      } else if (event.key === 'End') {
        target = buttons[buttons.length - 1];
      }
      if (!target) return;
      event.preventDefault();
      show(target.dataset.view, true);
      target.focus();
    });
  });
  window.addEventListener('hashchange', () => {
    const view = fromHash();
    if (view) show(view, false);
  });

  let initial = fromHash();
  if (!initial) {
    try { initial = localStorage.getItem(storageKey); } catch (error) {}
  }
  if (!initial || !valid.has(initial)) initial = buttons[0].dataset.view;
  show(initial, false);

  window.VOS_TABS = { show };
})();
