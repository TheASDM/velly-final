// Single source of truth for the bottom-nav tabs and the app-bar
// title/eyebrow per route. Used by:
//   - _includes/partials/app-bottom-nav.njk (renders the tab bar)
//   - _includes/layouts/page.njk (resolves the app-bar title via the
//     `appBarMeta` filter defined in .eleventy.js)
//
// `match` semantics:
//   "exact" — active when page.url === href
//   "wiki"  — active when page.url starts with /en/ and isn't another tab's href
module.exports = {
  tabs: [
    {
      id: "home",
      label: "Home",
      title: "Home",
      eyebrow: "Campaign",
      href: "/",
      match: "exact",
      svg: '<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    },
    {
      id: "calendar",
      label: "Calendar",
      title: "Calendar",
      eyebrow: "Schedule",
      href: "/calendar/",
      match: "exact",
      svg: '<path d="M7 3v3"/><path d="M17 3v3"/><path d="M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 12h3"/><path d="M13 12h3"/><path d="M8 16h3"/>',
    },
    {
      id: "wiki",
      label: "Wiki",
      title: "Wiki",
      eyebrow: "Venturia",
      href: "/en/Venturia/",
      match: "wiki",
      svg: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/><path d="M8 7h8"/><path d="M8 11h6"/>',
    },
    {
      id: "studio",
      label: "Studio",
      title: "Studio",
      eyebrow: "Art",
      href: "/en/Tools/art/",
      match: "exact",
      svg: '<path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 1.1-3.2 1.4 1.4 0 0 1 .9-2.5H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z"/><circle cx="7.7" cy="10" r="1"/><circle cx="10.5" cy="7.3" r="1"/><circle cx="14" cy="7.4" r="1"/><circle cx="16.7" cy="10.2" r="1"/>',
    },
    {
      id: "enzo",
      label: "Enzo",
      title: "Enzo",
      eyebrow: "Chat",
      href: "/enzo/",
      match: "exact",
      svg: '<path d="M12 3c4.5 0 8 3 8 7.2 0 2.7-1.5 5-3.8 6.2L16.5 21l-4.1-3.5H12c-4.5 0-8-3-8-7.3C4 6 7.5 3 12 3z"/><path d="M8.5 10h7"/><path d="M8.5 13h4"/>',
    },
  ],
};
