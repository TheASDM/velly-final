// Initialize Pagefind search UI inside the wiki hub. Pagefind itself is
// loaded by the layout via /pagefind/pagefind-ui.js; this script just
// wires it up when the search container is present.
window.addEventListener('DOMContentLoaded', () => {
  if (typeof PagefindUI === 'undefined') return;
  if (!document.querySelector('#vos-wiki-search')) return;
  new PagefindUI({
    element: '#vos-wiki-search',
    showImages: false,
    showSubResults: true,
    resetStyles: false,
    placeholder: 'Search NPCs, locations, lore...',
  });
});
