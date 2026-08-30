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
      /* The middle of the bar, raised above it. This is the thing a player
         touches every few minutes at the table — hit points, spell slots,
         Rage — and it was three taps deep behind a menu. */
      id: "sheet",
      label: "Sheet",
      title: "Character Sheet",
      eyebrow: "Your character",
      href: "/sheet/",
      match: "exact",
      hero: true,
      /* The DM's centre of gravity is the table, not a sheet. Declared here
         (and emitted as data attributes) so the runtime swap in
         character-bar.js applies data instead of hardcoding a variant. */
      dm: { label: "The Table", href: "/party/" },
      /* A mask, because in Venturia the sheet is the face you wear. */
      svg: '<path d="M3.2 6.4c0-1 .8-1.7 1.8-1.6 2.3.3 4.6.3 7 0 1-.1 1.8.6 1.8 1.6v3.1c0 4.2-2.6 7.9-6.3 9.4a.9.9 0 0 1-.7 0C3.1 17.4.5 13.7.5 9.5" transform="translate(4.5)"/><path d="M8.4 10.2c.7-.6 1.7-.6 2.4 0"/><path d="M13.2 10.2c.7-.6 1.7-.6 2.4 0"/><path d="M10.4 15.1c1 .7 2.2.7 3.2 0"/>',
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
