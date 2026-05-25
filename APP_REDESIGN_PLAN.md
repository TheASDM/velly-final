# Vallombrosa App Redesign Plan

## Goals

Make the PWA feel like one app rather than a mobile website with extra tabs.
The app should be easy to use in four common modes:

- Read and search the wiki during play.
- Generate art and browse the shared gallery.
- Check the next session and RSVP quickly.
- Ask Enzo from a dedicated chat surface.

The visual direction stays dark Venetian / gold / theatrical, but the interface
needs calmer hierarchy, fewer nested framed panels, and controls designed for
thumb use.

## Current Problems

- Bottom-fixed UI is fragile on mobile visual viewport changes.
- The Enzo floating pill competes with the bottom nav and overlaps content,
  especially in Studio/gallery views.
- Some page text is too large for compact app surfaces, making pages feel like
  articles instead of tools.
- Studio mixes introduction, featured gallery, generator controls, gallery, DM
  tools, and lightbox behavior on one long surface.
- Wiki navigation is still mostly document-site navigation. It needs a stronger
  mobile search/browse workflow.
- Calendar is visually acceptable but too passive; RSVP should be the obvious
  primary action.
- Repeated UI patterns are implemented page-by-page instead of through a small
  app component set.

## Design Principles

- Keep the bottom tab bar stable, visible, and predictable.
- Prefer one primary task per screen section.
- Reduce decorative card nesting; use full-width bands and compact panels.
- Use smaller, denser type inside tools and dashboards.
- Keep Enzo as a tab on mobile instead of a floating competing control.
- Make all forms one-handed friendly: large tap targets, clear state, no hidden
  required actions.
- Treat offline/read mode as part of the app shell, not a separate feature.

## Phase 1: App Shell And Navigation

Deliverables:

- Fix bottom nav anchoring across iOS Safari, installed PWA, and Android Chrome.
- Hide or suppress the floating Enzo pill on mobile except on pages where it is
  explicitly wanted.
- Add a consistent app header treatment for tab pages: compact title, one
  action slot, optional status chip.
- Normalize safe-area padding and bottom content padding so the nav never
  covers controls.
- Add viewport screenshots for Home, Studio, Calendar, Wiki, and Enzo at mobile
  and desktop widths.

Acceptance:

- Bottom nav remains at the visible bottom after scroll, orientation change, and
  keyboard open/close.
- No primary control is hidden behind the nav or Enzo pill.
- Current tab state is clear without taking over the screen.

## Phase 2: Component System

Deliverables:

- Create shared CSS classes for:
  - app page header
  - section header
  - compact panel
  - segmented control
  - icon button
  - form field
  - status/empty/error states
  - list rows
  - media grid/gallery cards
- Consolidate duplicate panel/button/form styling from Home, Calendar, DM, and
  Studio.
- Tighten the typography scale for app surfaces.

Acceptance:

- New app UI can be built without page-local one-off button/card CSS.
- Mobile text no longer looks like desktop article type placed in a phone app.

## Phase 3: Home

Deliverables:

- Turn Home into a compact campaign dashboard:
  - latest DM message
  - next session + RSVP summary
  - latest chronicle/update
  - fresh gallery strip
  - quick links to Wiki, Studio, Enzo
- Keep the hero image, but reduce its vertical dominance on mobile.
- Make “what do I do now?” obvious.

Acceptance:

- A player can understand the next session, newest DM note, and latest content
  in one scroll or less on mobile.

## Phase 4: Wiki

Deliverables:

- Add a wiki landing page optimized for mobile:
  - search first
  - recently useful sections
  - Characters, Locations, Factions, Lore, Articles
  - recently visited pages if available locally
- Improve article pages:
  - compact breadcrumb
  - optional page contents jump list
  - previous/next within section where useful
  - better mobile tables and maps
- Keep runtime caching for visited reading content.

Acceptance:

- During play, a user can find a known NPC/location in under 10 seconds from
  the Wiki tab.

## Phase 5: Studio And Gallery

Deliverables:

- Split Studio into clear task zones:
  - Create
  - Latest Result
  - Gallery
- Move explanatory copy into compact helper text; do not let it dominate the
  first viewport.
- Make style selection visual and scannable.
- Put prompt, creator name, enhance toggle, and generate button in one coherent
  create panel.
- Redesign gallery:
  - responsive masonry/grid
  - fast filters for creator/style/entity
  - image detail view with prompt, creator, created time, grounded entities
  - clear loading/progress states
- Make generated-art source same-origin and obvious in deployment docs.

Acceptance:

- A player can open Studio, generate an image, and understand where it went
  without reading a paragraph.
- Gallery browsing feels like a first-class app view, not a carousel bolted onto
  an article.

## Phase 6: Calendar And DM

Deliverables:

- Calendar page:
  - next session as the main object
  - RSVP segmented control near the top
  - Timeful link as a secondary action
  - notes/homework as checklist rows
- DM page:
  - split into Messages, Push Test, RSVP Summary
  - keep admin token entry persistent but visually quiet
  - make success/failure states explicit

Acceptance:

- RSVP takes one tap after identity is set.
- DM can post a note and verify table response without scrolling through
  unrelated controls.

## Phase 7: Enzo

Deliverables:

- Make `/enzo/` a full chat page on mobile and desktop.
- Keep optional mini widget only on desktop/tablet if it does not overlap app
  navigation.
- Add suggested prompt chips for common use:
  - “Who is…”
  - “Where is…”
  - “Summarize this faction”
  - “Rules question”
- Preserve conversation history controls and multi-line input.
- Ensure art slash command behavior still works with same-origin endpoints.

Acceptance:

- Enzo feels like a dedicated app tab, not a floating web widget fighting the
  rest of the app.

## Phase 8: QA And Release

Deliverables:

- Mobile screenshots for every tab at 390px and 430px widths.
- Desktop screenshots for 1280px and 1440px widths.
- Lighthouse PWA pass.
- Offline test for visited wiki pages.
- Push test on installed iOS and Android.
- Accessibility pass for tap target size, focus states, labels, contrast, and
  reduced motion.

Acceptance:

- No overlapping fixed UI.
- No horizontal scroll.
- No unreadable text inside controls.
- No console errors in normal flows.

## Suggested Order

1. Shell/navigation fix.
2. Suppress mobile Enzo floating pill and promote `/enzo/`.
3. Studio Create/Gallery redesign.
4. Wiki mobile landing/search improvements.
5. Home dashboard compression.
6. Calendar/DM cleanup.
7. Visual polish and screenshot QA.
