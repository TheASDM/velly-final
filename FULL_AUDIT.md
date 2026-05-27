---
title: Vallombrosa Full Audit
description: End-to-end audit of code, UX, and layout across Home, Calendar, Wiki, Studio, and Enzo. With a punch-list to "perfect."
published: false
date: 2026-05-27
---

# Vallombrosa — Full Audit (2026-05-27)

A complete pass across **code**, **layout**, and **ease of use** for the five features:

1. **Home** — news, DM push messages, next session
2. **Calendar** — RSVP for scheduled games
3. **Wiki** — search, "current in play" quick-access, browse, Submit Lore
4. **Studio** — AI art generator with named-entity grounding + gallery
5. **Enzo** — RAG chatbot over the campaign + 2024 5e

Severities: **S1** = critical (fix before showing players), **S2** = major (real UX or correctness pain), **S3** = polish.

---

## TL;DR — The path to "perfect"

If you only do ten things, do these. They are the highest leverage:

1. **Split [page.njk](_includes/layouts/page.njk) into a real shell.** 2,195 lines with ~1,500 of inline CSS and 5+ inline `<script>` blocks. Extract to `/css/app-shell.css` and per-concern JS files. Single biggest source of slow iteration. (S1)
2. **Server-side enforce DM mode.** Right now DM gating in [public/js/chatbot.js](public/js/chatbot.js#L58) is client-only. Anyone editing localStorage becomes a "DM." Require a DM token in headers, validate in [chatbot/server.py](chatbot/server.py). (S1)
3. **Quota the Studio image endpoint.** No per-user cap on DALL-E/`gpt-image-*` calls. One bored player or one leaked token can burn the OpenAI budget. (S1)
4. **Rate-limit `/api/chat`.** Conversation history can be ~320k chars per request and there's no per-IP cap. (S1)
5. **Turn on Anthropic prompt caching** for the tier1 + system prompt. ~40–50% input-token reduction for free. ([chatbot/server.py:956](chatbot/server.py#L956)) (S1)
6. **Make Submit Lore discoverable.** It's a flagship feature buried at `/submit-lore/` with no link from Home or the wiki hub. Surface it on the Venturia index and inside the Browse view. (S2)
7. **Add RSVP straight from Home.** The `.vos-next-card` says "RSVP" but has no control — players bounce to /calendar. Include the `rsvp-control.njk` partial in place. ([home.md:303](home.md#L303)) (S2)
8. **Rejection reasons + batch ops for lore approval.** A "Reject" right now silently deletes; players can't iterate. Add a feedback textarea + checkbox bulk actions in [dm.md](dm.md). (S2)
9. **Citations in Enzo answers.** RAG already has scores + filenames — surface them as collapsible footer links per message so players learn the wiki structure as they chat. (S2)
10. **Delete the duplicate `*.bak` / "2.json"/"2.png" files.** `git status` shows ~50 dup-from-Finder files. They're not breaking anything but they're noise on every status check. (S3)

---

## Cross-cutting findings (apply everywhere)

### S1 — `page.njk` is the bottleneck
[_includes/layouts/page.njk](_includes/layouts/page.njk) is **2,195 lines**: base resets, app-bar (lines ~278–530), bottom-nav styles (~1342–1419), RSVP/list/map components (~750–1000), PWA install/update UI (~1850–2032), and the chatbot widget (~1851–1939) all live inline. There are **5+ separate `<script>` IIFEs** between [page.njk:1851](_includes/layouts/page.njk#L1851) and line 2193 (chatbot injection, textarea auto-grow, visual viewport sync, install/update, pagefind init).

**Fix order:**
1. `public/css/app-shell.css` ← everything in `<style>` in page.njk
2. `public/js/pwa-manager.js` ← merge with [pwa-client.js](pwa-client.js) (today both register the SW separately at [page.njk:2137](_includes/layouts/page.njk#L2137) and [pwa-client.js:412](pwa-client.js#L412))
3. `public/js/enzo-widget.js` ← chatbot injection + textarea grow
4. `public/js/viewport-handler.js` ← visual viewport sync
5. `public/js/search-init.js` ← pagefind

You'll also want [_data/navigation.js](_data/navigation.js) with `{ tabs: [{ id, label, href, eyebrow }] }` so the app-bar title logic at [page.njk:1704–1723](_includes/layouts/page.njk#L1704) and the tab detection in [app-bottom-nav.njk:3–6](_includes/partials/app-bottom-nav.njk#L3) stop duplicating route strings.

### S2 — Auth / identity has no error recovery
[pwa-client.js:66](pwa-client.js#L66) `getAuthConfig()` falls back to a **hardcoded player list** ([pwa-client.js:8–37](pwa-client.js#L8)) when the API fails. So if `/api/auth/config` is down, every player sees the same picker with no warning. Add: exponential backoff, 5-min successful-response cache, and a visible "Connection lost" banner. Also move that hardcoded `PLAYERS` array out to `_data/players.json`.

### S2 — Modal focus management
The dynamically appended identity card at [page.njk:1500–1520](_includes/layouts/page.njk#L1500) has `role="dialog" aria-modal="true"` but **no focus trap, no initial focus on legacy picker, and no focus restoration**. Trivial to fix with a small focus-trap utility.

### S2 — `pwa-client.js` ↔ `page.njk` SW registration duplicated
Two different blocks register the service worker and listen for updates. Pick one. The page.njk one (lines 2137–2173) duplicates what pwa-client.js does implicitly via `navigator.serviceWorker.ready`.

### S3 — Repo cruft
- `_includes/layouts/page.njk.bak`, `public/css/chatbot.css.bak`
- ~40 `*2.json` / `*2.png` / `*2.css` Finder duplicates (visible in `git status`)
- `Tools/image/`, `publish 2.js`, `index 2.html`, `sw 2.js`, `manifest 2.webmanifest`
- `cloudpw.txt` (12 bytes) and `.txt` (empty) in repo root
- `files.zip` checked in

Add `*.bak`, `* 2.*`, `*.zip` to `.gitignore`, then `git rm` them. Most are duplicates from Finder copy-paste — not lost work.

### S3 — Inactive nav tab contrast
[page.njk:1382](_includes/layouts/page.njk#L1382): `color: rgba(212, 199, 173, 0.72)` over `#07060a` ≈ 5.2:1, right at the AA edge for the 0.68rem label. Bump to 0.85 → ~6.4:1 (comfortable AA).

---

## 1) HOME

### What's working
- DM push messages support **group ("all") and individual targeting** ([chatbot/server.py:2043](chatbot/server.py#L2043))
- `.vos-next-card` is the right anchor for next-session status
- Personalization works: authed players see targeted messages; broadcasts otherwise
- Image carousel pulls live gallery (line ~248 in [home.md](home.md#L248))

### Issues
- **S1 — No read receipts or per-recipient dismiss.** Messages stack up. Add `read_at` column to the messages table; a `DELETE /api/messages/{id}` (recipient soft-delete) endpoint; "Dismiss" control on each card. ([home.md:308–330](home.md#L308), [chatbot/server.py:2022–2115](chatbot/server.py#L2022))
- **S2 — RSVP label without a control on Home.** [home.md:303–306](home.md#L303) shows "RSVP" but no widget — players have to navigate to /calendar to act. Include `_includes/partials/rsvp-control.njk` inside `.vos-next-card`.
- **S2 — No news feed, only a gallery carousel.** "Latest shared pieces" is images only. Add `/api/news` returning the 5 most recent `published: true` wiki pages (by `date`) and show 1-line summaries with "Read".
- **S3 — Long message bodies overflow on mobile.** [home.md:316–322](home.md#L316) uses `white-space: pre-wrap`. Add `overflow-wrap: break-word; word-break: break-word;` or switch to `pre-line`.
- **S3 — No pagination on messages.** Single `/api/messages?limit=5` fetch in [pwa-client.js:185](pwa-client.js#L185). Add "Show older" → `offset=5`.

---

## 2) CALENDAR

### What's working
- RSVP states (going / maybe / out) are clean radio semantics in [_includes/partials/rsvp-control.njk](_includes/partials/rsvp-control.njk)
- Backend stores per `event_id` + `player_name`, no anonymous voting ([chatbot/server.py:2277–2285](chatbot/server.py#L2277))
- Admin-only count visibility is correctly gated by admin token ([chatbot/server.py:2252–2261](chatbot/server.py#L2252))

### Issues
- **S1 — Only one "next gathering."** `campaign.nextGathering` is a single date object. If you ever want a multi-week peek, this needs to be `nextGatherings: []` with a separate `event_id` per session so RSVPs don't collide.
- **S2 — Reminders are referenced but not wired.** [calendar.md:85–92](calendar.md#L85) uses `data-reminder-date` attributes, but no client code reads them. Add a small handler in pwa-client.js (or a SW periodic-sync where supported) that checks due dates and fires `Notification` for the player.
- **S2 — Players can't see "who's in."** Today only admins see counts. Optional but high-value: add a non-private "3 going · 2 maybe · 1 out" summary to the player payload at [chatbot/server.py:2245–2250](chatbot/server.py#L2245). Hide individual responses to preserve privacy.
- **S3 — No countdown.** "Friday, June 7" is fine, but "in 4 days" is what people actually want.
- **S3 — No iCal / Add-to-calendar.** A static `/api/icsexport/{event_id}` returning an `.ics` is ~30 lines of Python and saves players from re-typing.

---

## 3) WIKI (browse + search + Submit Lore + "currently in play")

### What's working
- Frontmatter is consistent across entries (`title`, `description`, `tags`, `published`)
- `descendantTree` filter auto-builds nested index pages with subcategory grouping ([.eleventy.js:160+](.eleventy.js#L160))
- `wikiBreadcrumbs` filter elegantly collapses the redundant "Wiki > Venturia" prefix ([.eleventy.js:124–158](.eleventy.js#L124))
- DM directory pages have `published: false` and won't build into `_site/`
- Pagefind is wired and themed
- Submit Lore → DM approval pipeline is real and end-to-end: identity check → poll → preview → publish ([submit-lore.md](submit-lore.md), [dm.md:342–382](dm.md#L342))

### Issues
- **S1 — Missing `Venturia/DM/index.md`.** Easy to forget and the only category without an index. Add one (with `published: false`) listing internal DM tools.
- **S2 — Submit Lore is undiscoverable.** It lives at `/submit-lore/` with no link from Home or the Venturia index. If the "hidden" placement is intentional, fine — but right now even motivated players won't find it. Add a clearly-styled "Contribute Lore" tile on the Venturia hub and a smaller link on Home.
- **S2 — Rejection has no feedback channel.** In [dm.md:915](dm.md#L915), Reject is a `confirm('Reject this submission?')` and the entry is deleted. Add a rejection-reason textarea. The player's "My Submissions" view should surface that reason and offer a "Resubmit with edits."
- **S2 — No batch ops on submissions.** Each submission is approved one at a time, capped at 40. For a busy week, add checkbox-select + "Publish selected" / "Reject selected" in [dm.md:342–382](dm.md#L342).
- **S2 — Items / Lore index pages are hand-curated stubs.** [Venturia/Items/index.md](Venturia/Items/index.md) and `Venturia/Lore/index.md` are static lists. When players submit new items, the DM has to manually add them to the index or they're invisible in browse. Either (a) let `descendantTree` render them like Locations/Characters do, or (b) add a "See full catalog" search-link banner.
- **S2 — "Currently in play" is manually edited code.** `_data/campaign.js` `inPlay: [...]` requires a code edit after each session. Convert to a small admin form in [dm.md](dm.md) writing to sqlite, then `_data/campaign.js` fetches it (or expose `/api/in-play`).
- **S3 — No build-time guard against accidentally publishing a DM page.** Add a check in [.eleventy.js](.eleventy.js): if `filePathStem` contains `/Venturia/DM/` and `published === true`, throw. Cheap insurance.
- **S3 — Pagefind is unstyled on small viewports.** [page.njk:2181–2192](_includes/layouts/page.njk#L2181) uses `resetStyles: false`; results can overflow below 380px.
- **S3 — Some categories feel skeletal** (Government: 3, Items: 3, Culture: 5, Lore: 5). Either hide them from Browse until they hit critical mass, or add a "Coming soon — submit lore to help fill this in" CTA per category.

---

## 4) STUDIO (Tools/art.md)

### What's working
- Named-entity grounding is the killer feature; gallery cards already display "grounded in: Caravel, Echoing Court" chips ([Tools/art.md:1330–1340](Tools/art.md#L1330))
- `descriptions.json` is comprehensive (~607 entries)
- Style presets are documented inline ([Tools/art.md:1252–1255](Tools/art.md#L1252))
- Loading state is excellent (shimmer + spinner + status dots, [Tools/art.md:360–421](Tools/art.md#L360))
- DM delete is correctly passphrase-gated and ephemeral by design

### Issues
- **S1 — No quota / spend cap on image generation.** With a leaked auth token (or one player having fun) you can run up the OpenAI bill. Add a `quotas` table (`player`, `month`, `count`), check at the top of `/api/studio/generate`, return **429 with a reset date**. Default ~30/month/player is plenty for normal use.
- **S2 — `IMAGE_MODEL` is unvalidated.** [chatbot/server.py:2394–2450](chatbot/server.py#L2394) accepts whatever env says; misconfig only fails when OpenAI rejects. Whitelist on startup; refuse to boot if unknown.
- **S2 — Reference names aren't discoverable before typing.** Players don't know they can write "Caravel" or "the Echoing Court" without scrolling the gallery for hints. Add a collapsible "Available references" panel above the prompt, populated from a new `/api/descriptions` endpoint (return the `grounded_in` keys, grouped by category).
- **S2 — Gallery has no pagination.** 80-item cap, no "load more." Add `offset` param + a button at the bottom. ([Tools/art.md:1069–1079](Tools/art.md#L1069))
- **S3 — Errors don't distinguish causes.** [Tools/art.md:430–447](Tools/art.md#L430) shows a generic "Retry." Return `error_code` from the server (`quota`, `auth`, `invalid_prompt`, `api_error`) and conditionally render copy ("You've hit your monthly limit — resets June 1" vs. "OpenAI is unavailable").
- **S3 — No "favorite/pin" on images.** Optional but high-yield for a small dedicated user base; one new `gallery.favorites` table.

---

## 5) ENZO (RAG chatbot)

### What's working
- HMAC-SHA256 auth tokens with TTL ([chatbot/server.py](chatbot/server.py))
- DM passphrase uses `hmac.compare_digest` (constant-time)
- Parameterized SQL throughout — no injection
- File-locking on gallery manifest prevents concurrent corruption
- Client markdown escaping before processing
- RAG pipeline (keyword → vector → dedupe by `page_id`) is sound

### Issues
- **S1 — Prompt caching disabled.** Every chat ships the entire tier1.md + system prompt as fresh tokens ([chatbot/server.py:956–1030](chatbot/server.py#L956)). Add `cache_control: {"type": "ephemeral"}` to the system block. Log `cache_creation_input_tokens` and `cache_read_input_tokens` to confirm hits.
- **S1 — No rate limiting.** `/api/chat` ([chatbot/server.py:2298–2345](chatbot/server.py#L2298)) caps message length but not request frequency; conversation history can be up to ~320k chars per request (40 × 8k). Flask-Limiter, keyed by IP+token, 429 over budget.
- **S1 — Vector store loaded fully in memory + O(n) linear scan.** [chatbot/server.py:700–822](chatbot/server.py#L700) iterates the full in-memory list per chat. Today fine; will hurt as the wiki grows. Move to **sqlite-vss / sqlite-vec** (zero new infra, same SQLite file as the rest of the app).
- **S2 — DM mode is client-controlled.** [public/js/chatbot.js:58,434](public/js/chatbot.js#L58) — the client sets `mode = 'dm'` from localStorage; server responds with hardcoded `"mode": "player"` ([chatbot/server.py:2336](chatbot/server.py#L2336)) but doesn't gate anything off it. **Server-side enforce.** Either remove DM mode entirely (the comments suggest a half-done migration) or require a DM token and gate the system-prompt swap on it.
- **S2 — No Ollama embedding retries.** [chatbot/server.py:755–774](chatbot/server.py#L755). One hiccup → silent fallback to zero-context. Add 3 retries with exponential backoff (100ms, 300ms, 1s).
- **S2 — CORS is wide open.** `Access-Control-Allow-Origin: *` at [chatbot/server.py:1676–1693](chatbot/server.py#L1676). Restrict via an `ALLOWED_ORIGINS` env var.
- **S3 — No citations in chat answers.** Server already has matched entries + scores in `build_rag_context`; surface them in the response and render as collapsible footer chips per message ("Caravel (92%) · Echoing Court (81%)") that link to the wiki page.
- **S3 — Keyword matching is fragile.** [chatbot/server.py:733–745](chatbot/server.py#L733) doesn't normalize apostrophes/accents. "Caravel's backstory" misses "Caravel." Add a `_normalize(s)` (lowercase, strip punctuation, accent-fold) on both sides.
- **S3 — No query expansion.** Cheap win: run the user query through Haiku with a "list aliases / synonyms" prompt, embed the expanded form, cache results.
- **S3 — No streaming responses.** [public/js/chatbot.js:400–411](public/js/chatbot.js#L400) waits for the full response. Switch to SSE/chunked transfer and render tokens as they arrive — even with no other changes, the perceived latency drops massively.
- **S3 — `build_vectors.py` / `build_tiers.py` always rebuild from scratch.** Add `{filename: hash}` state in the manifest and skip unchanged entries. Reduces rebuild time and Ollama load.
- **S3 — History truncation is silent.** Return `historyTruncated: true` and show a small "Older messages condensed" banner.
- **S3 — Vector store has no metadata header.** Add `{ meta: { built_at, embedding_model, tier1_hash }, entries: [...] }` so a stale deploy is detectable.

---

## Suggested execution order

The grouping below is rough. Each tier should fit in a sitting.

### Sitting 1 — Safety & cost
- DM mode server-side enforcement (Enzo S1)
- Studio quota table (Studio S1)
- Rate limit `/api/chat` (Enzo S1)
- CORS whitelist (Enzo S2)
- DM-published page guard in `.eleventy.js` (Wiki S3)

### Sitting 2 — Cheap wins
- Anthropic prompt caching (Enzo S1)
- Delete `.bak` / "* 2.*" / `files.zip` / `cloudpw.txt` / empty `.txt`
- Add `*.bak`, `* 2.*`, `*.zip` to `.gitignore`
- Add `Venturia/DM/index.md`
- Contrast bump on inactive nav tabs

### Sitting 3 — UX polish that pays back daily
- RSVP control inside `.vos-next-card` on Home
- Surface Submit Lore from Home + Venturia hub
- Citations in Enzo responses
- Rejection reasons + batch approval in dm.md
- Reference names panel in Studio

### Sitting 4 — Structural
- Split `page.njk` into `app-shell.css` + concern-specific JS modules
- Merge `pwa-client.js` and the inline SW block into `pwa-manager.js`
- `_data/navigation.js` for tab + title logic
- Move hardcoded `PLAYERS` to `_data/players.json`
- Auth retry + connection-lost banner

### Sitting 5 — Growth-oriented
- Multi-session calendar (`nextGatherings: []`)
- Reminder firing on `data-reminder-date`
- Read receipts / dismiss on Home messages
- News feed from `published: true` wiki pages
- Streaming Enzo responses
- sqlite-vec / sqlite-vss migration for the vector store
- Incremental `build_vectors.py` / `build_tiers.py`

### Sitting 6 — Nice-to-have
- iCal export, countdown timers
- "Favorite" / "Pin" on Studio gallery
- Auto-generate Items / Lore indexes
- Admin form for `inPlay`

---

## Counts

| Feature | S1 | S2 | S3 |
|---|---:|---:|---:|
| Cross-cutting (shell, auth, cruft) | 1 | 3 | 3 |
| Home | 1 | 2 | 2 |
| Calendar | 1 | 2 | 2 |
| Wiki | 1 | 5 | 3 |
| Studio | 1 | 3 | 2 |
| Enzo | 3 | 3 | 7 |
| **Total** | **8** | **18** | **19** |

8 things to fix before you'd want a new player on the app. The rest can land any time, but the order above maximizes "feels nicer to use" per hour spent.
