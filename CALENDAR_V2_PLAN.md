# Calendar V2 + DM Panel Overhaul Plan

Four workstreams, in build order. A ships real value alone; B–D are mostly frontend and can land as one deploy or in pieces.

## A. DM-editable "Next Gathering" (kill the campaign.js edit-and-rebuild loop)

Today `_data/campaign.js` bakes the next gathering into the home card, the calendar hero, the RSVP default event id, and the Eleventy-generated `.ics` files. Every change means editing code and rebuilding.

**New source of truth: the `calendar_events` table.** The next gathering is simply the earliest upcoming `kind='session'` event. The DM already schedules those from `/dm/` — editing the next gathering becomes editing that event.

Backend (migration `017` + endpoints):

- Add `tasks TEXT NOT NULL DEFAULT '[]'` to `calendar_events` — JSON list of `{text, due}` ("Send 4-8 sentences by May 28"). Editable in the DM event form as one textarea, one task per line, optional `| due YYYY-MM-DD` suffix.
- `GET /api/calendar/next` (public): the next upcoming session event, plus `eventKey` (`cal-<id>`) for RSVP and a `countdownIso` field. Returns `{gathering: null}` when nothing is scheduled.
- `GET /api/calendar/events/<id>.ics`: generate the ICS in Python from the DB row (all-day VEVENT, same headers as the existing route). The old static `/api/calendar/<event_id>.ics` route stays for bookmarked links.
- RSVP: no schema change — `rsvps.event_id` is TEXT; new events RSVP under `cal-<id>`. Old rows stay attached to their old ids.

Frontend:

- Home card and calendar hero hydrate from `/api/calendar/next` (date, time/location, tasks, countdown). Static markup becomes the loading/fallback state ("Nothing on the books — check back soon").
- `rsvp-control` gets its `data-event-id` set by the hydration script *before* `initRsvpControls()` wires it; expose `window.VOS_PWA.initRsvpControls` re-run hook (one-line export in pwa-client.js).
- DM panel: the Schedule Event list gains **Edit** (prefills the form, saves via PUT) so the next gathering is fully manageable in-app. The soonest upcoming session is badged "NEXT GATHERING" in the list.
- Delete `nextGatherings` from `campaign.js` and the two `calendar-*-ics.njk` templates once verified.

## B. One month at a time, with obvious paging

Both grids (group calendar + availability) switch from three stacked months to a single month with a pager header:

```
┌──────────────────────────────────────┐
│  ◀  PREV      JULY 2026      NEXT  ▶ │   ← full-width bar, Cinzel, gold,
└──────────────────────────────────────┘     44px+ tall, arrows + labels
```

- Shared `monthPager()` helper in `vos-calendar.js`; buttons disable (dim) at the range edges instead of disappearing, so the control never jumps.
- **Group calendar**: pages freely from the current month up to +6 months; events fetched once for the whole range.
- **Availability**: pages within the 3-month submission window. Marks live in memory across month flips; the Submit button always sends the whole window. Under the pager, three small dots (one per month) fill in when that month has any marks, so players notice the other months exist.
- Saturday time chips show for the visible month only (as now, they're grouped per month).

## C. Restructure /calendar/ as a hub (one page, three views)

Keep a single `/calendar/` page — separate pages would fight the bottom-tab convention and triple the PWA cache/navigation surface. Per-section navigation lives inside the tab, per the app's own rules:

```
┌────────────────────────────────────────┐
│  [ Next Session | Calendar | Availability ]  ← segmented control, sticky
├────────────────────────────────────────┤
│  (one view rendered at a time)          │
└────────────────────────────────────────┘
```

- **Next Session**: hero (date, countdown, where), tasks, RSVP, Add to Calendar. Front-and-center default view.
- **Calendar**: the one-month group grid + that month's event list.
- **Availability**: legend, one-month marking grid, time chips, Submit + last-submitted line.
- Hash routing (`/calendar/#availability`) so DM messages can deep-link "go set your availability", and back button works. Remember last-viewed segment in sessionStorage.
- Segment badges where useful: a red dot on Availability if the player hasn't submitted for the current window.

## D. DM panel overhaul (/dm/)

Ten stacked panels today; scrolling is the only navigation. Reorganize into four sub-tabs under a sticky segmented control (sign-in stays global above it):

| Tab | Panels |
|---|---|
| **Sessions** | Next Gathering editor (A), Schedule Event + upcoming list, Player Availability summary, RSVP Summary |
| **Messages** | DM Message composer, Message History, Test Push |
| **Wiki** | Wiki Editor, Lore Submissions |
| **Table** | Currently In Play |

- Same segmented-control component as the calendar hub (build once, use twice).
- **Lazy loading**: each tab fetches its data on first open instead of everything at sign-in — the page stops firing six API calls the moment you authenticate.
- Consistent panel chrome: every panel gets the same head row (title + Refresh), status line placement, and spacing. Kill one-off styles.
- Move the ~1,400 lines of inline JS to `public/js/vos-dm.js` (passthrough + sw precache) — mechanical, but it makes the page cacheable and the markdown file readable.
- Hash routing here too (`/dm/#messages`).

## Build order

1. **A backend** — migration, `/api/calendar/next`, DB-generated ICS, PUT-edit already exists. Smoke-test like v1.
2. **A frontend** — hydrate home card + calendar hero + RSVP wiring; DM edit button + NEXT badge.
3. **B** — month pager in `vos-calendar.js` for both grids.
4. **C** — calendar hub segmented control + hash routing.
5. **D** — DM panel tabs, lazy loads, JS extraction.
6. Cleanup — drop `nextGatherings` from campaign.js + ICS templates, bump sw cache, deploy.

Each step leaves the site shippable. The riskiest seam is A-frontend (RSVP control init order); it gets tested with a real event on the VPS before C/D reshuffle the page.
