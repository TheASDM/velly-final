# Calendar + Availability Plan

Replaces Timeful. Two surfaces on `/calendar/`:

1. **Multi-month calendar (top)** — read-only for players. Shows only events the DM schedules (sessions, deadlines, downtime windows). Players never write to it.
2. **Availability form (bottom)** — players rate their availability per day and submit. Submissions feed a DM-only aggregation view; they do not appear on the calendar itself.

## Availability rules (the contract)

| Day type | Player input | Meaning |
|---|---|---|
| Saturday / Sunday | Tap cycles: **dark green → light green → red → unset** | Dark green = most preferred · Light green = can make it, prefer another day · Red = can't make it |
| Weekday (Mon–Fri) | Tap toggles **red** only | Red = can't make it that evening. Unmarked = assumed free |
| Saturdays marked green (either shade) | Time-of-day picker: **morning / afternoon / evening**, multi-select | Which parts of that Saturday work |

Form covers the same months the calendar displays: current month + next 2 (constant in one place so it's easy to widen).

## Data model — two new SQLite migrations in `chatbot/server.py`

Follows the existing `schema_migrations` pattern (see `003_rsvps`).

```sql
-- 0XX_calendar_events (DM-scheduled, replaces hand-editing _data/campaign.js for scheduling)
CREATE TABLE calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,              -- YYYY-MM-DD
    title TEXT NOT NULL,
    time_label TEXT,                 -- freeform: "6pm", "afternoon"
    location TEXT,
    notes TEXT,
    kind TEXT NOT NULL DEFAULT 'session' CHECK(kind IN ('session','deadline','other')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 0XX_availability (one row per player per day; upsert like rsvps)
CREATE TABLE availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    date TEXT NOT NULL,              -- YYYY-MM-DD
    rating TEXT NOT NULL CHECK(rating IN ('preferred','available','unavailable')),
    times TEXT NOT NULL DEFAULT '[]',-- JSON array, e.g. ["morning","evening"]; only meaningful for green Saturdays
    updated_at TEXT NOT NULL,
    UNIQUE(player_name, date)
);
```

Weekday "can't make evening" is stored as `rating='unavailable'` — the day-of-week tells us it means evenings. Unset days have no row (deleting a mark deletes the row).

`_data/campaign.js` `nextGatherings` stays as-is for the home-page hero/ICS for now; the calendar grid reads from the new table. (Optional later: point the hero at the API too.)

## API — new endpoints in `chatbot/server.py`

| Endpoint | Auth | Behavior |
|---|---|---|
| `GET /api/calendar/events?from=&to=` | none (players read) | Events in range, sorted by date |
| `POST /api/calendar/events` | DM session JWT (`_verify_session_jwt`, same as admin messages) | Create event |
| `PUT/DELETE /api/calendar/events/<id>` | DM session | Edit / remove |
| `GET /api/availability?from=&to=` | player token (`_authenticated_player_name`) | The caller's own marks in range (pre-fills the form) |
| `POST /api/availability` | player token | Batch upsert: `{from, to, entries: [{date, rating, times}]}` — replaces all of that player's rows in the range so cleared marks disappear. Validate: weekend dates accept all three ratings; weekdays accept only `unavailable`; `times` only on green Saturdays |
| `GET /api/availability/summary?from=&to=` | DM session | Everyone's marks grouped per date + a per-weekend-day score for "best Saturday" ranking |

## Frontend — `calendar.md` rebuild

Keep the existing "Next Gathering" panel (with RSVP partial) at the top. Below it:

### 1. Calendar grid
- Client-rendered JS (no build step needed for new events): 3 stacked month grids, Sun–Sat columns, styled like the existing panels (Cinzel headers, gold-on-dark).
- Days with events get a small gold chip with the title; tapping a day opens a detail line (title, time, location, notes) under the month.
- Today gets a subtle ring; past days dimmed.

### 2. Availability form (one shared grid, second mode)
Rather than a separate second calendar, the same three month grids get an "Availability" toggle — or simpler and my recommendation: a second, compact set of month grids in their own panel titled "Your Availability", so the top calendar stays purely informational as specified.

- **Interaction:** tap a weekend day to cycle dark-green → light-green → red → clear. Tap a weekday to toggle red. Colors also get symbols (★ / ✓ / ✕) so it's not color-only (accessibility).
- **Saturday times:** when a Saturday is green, a row appears beneath that month — "Sat Jul 18: ☐ Morning ☐ Afternoon ☐ Evening" — implemented as tap-chips acting as a multi-select (native `<select multiple>` is unusable on iOS PWAs; the chips are the dropdown's mobile-friendly equivalent).
- **Identity:** resolved exactly like RSVP — `vos.playerName` + auth token from `pwa-client.js`; prompt for login if missing.
- **Prefill:** on load, `GET /api/availability` fills in existing marks so players edit rather than restart.
- **Submit:** one "Submit Availability" button posts the batch; confirmation toast + "last submitted &lt;date&gt;" line.
- Legend panel explaining the three colors and the weekday rule.

### 3. DM aggregation view
On `/dm/` (new panel) or shown inline on `/calendar/` when identity is DM:

- Weekend heatmap: each Sat/Sun shows dark-green/light-green/red counts and avatars of who chose what, plus chosen Saturday time chips.
- "Best candidates" list: weekends ranked by score (e.g. dark green = 2, light green = 1, red = −99), with who hasn't submitted yet flagged.
- Weekday strip: only days someone marked can't-make-evening, with names.
- Event scheduling form: date, title, time, location, notes, kind → posts to the events API. Deleting/editing from the same panel.

## Supporting changes

- `sw.js`: bump cache version (established convention for page/JS changes).
- `nginx`: nothing — `/api/*` is already proxied.
- Remove the `timefulUrl` button from `calendar.md` once this ships.
- Optional phase 2: push notification via existing `/api/push/send` when the DM requests availability for a new month, and a nudge to players who haven't submitted.

## Build order

1. Migrations + all five endpoints, with validation (small, self-contained; test with curl).
2. Calendar grid rendering events (DM can seed events via curl before the admin UI exists).
3. Availability form: grid interaction → Saturday time chips → prefill → submit.
4. DM panel: event CRUD form + aggregation heatmap.
5. Polish: legend, accessibility symbols, sw.js bump, drop Timeful link, patch notes.

Steps 1–3 are the minimum shippable slice; 4 can trail by a day since summary data is queryable by hand.
