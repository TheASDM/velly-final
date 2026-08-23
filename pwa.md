# Vallombrosa PWA — Build Brief for Claude Code

You are extending an existing, self-hosted campaign site (valleyofshadows.wiki) into an installable PWA. This is a small project for ~7 players plus one DM. Favor simplicity and durability over scale. **Work in phases. Stop at each checkpoint, commit, and wait for review.** Do not run ahead to later phases.

---

## What already exists (verify in Phase 0, don't assume)

- An **Eleventy** static site: homepage (campaign update + next gathering), wiki/chronicle pages, an **Art Studio** page (style picker, description box, "let Enzo refine my prompt" toggle, generate → shared gallery), and an **Enzo** assistant.
- An **Enzo backend** (a Node service) that already handles: AI image generation, an LLM "refine prompt" call, and storing/serving the shared gallery.
- Self-hosted infrastructure. A reverse proxy will front everything.

**Do not rewrite the image generation, the LLM refine logic, or the gallery.** You are adding around them.

---

## Goal

A five-tab installable app — **Home / Calendar / Wiki / Studio / Enzo** — that:
1. Installs to the home screen on iOS and Android and launches standalone.
2. Works offline for already-visited reading content.
3. Sends push notifications (DM messages, session reminders, "your art is ready").
4. Lets players RSVP to the next session and read DM messages.

Reading content (wiki, chronicle, art display) stays static and Eleventy-built. The read-write parts (push, DM messages, RSVPs) are a thin layer of endpoints on the **existing** Enzo backend, backed by **SQLite** (one file — no Postgres, no separate DB daemon; back up by copying the file).

---

## Hard requirements (non-negotiable — these are the things that silently break)

1. **Real HTTPS, even self-hosted.** Service workers, push, and install all fail on plain HTTP. Assume **Caddy** in front for automatic TLS unless Phase 0 finds otherwise. The proxy must serve `/manifest.webmanifest` and `/sw.js` from the **web root**.
2. **Service worker scope must be `/`** — the file must be served from root, not a subdirectory.
3. **Versioned caches.** Use a `CACHE_VERSION` constant; the `activate` handler purges old caches. On a new SW, postMessage clients and show a "New version — tap to refresh" prompt. **Never silently serve stale content.**
4. **Never cache `/api/*`.** Dynamic state (RSVPs, messages) must always hit the network.
5. **Do not precache wiki/chronicle content.** Precache only the app shell (nav layout, core CSS, fonts, logo/icons, an `/offline` fallback page). Content is runtime-cached as visited.
6. **iOS reality:** install is manual (Share → Add to Home Screen) with no install prompt; push works **only after install** (iOS 16.4+) and the permission request **must** be triggered by a user tap. Build for this explicitly.
7. **Reuse the existing design tokens** (the dark/gold theme). Read the current CSS custom properties / computed colors — do not introduce a new color system. `theme-color` must match the near-black background so the status bar blends in.
8. **Calendar does not rebuild scheduling.** Timeful owns "when is everyone free." The app owns only per-event RSVP (going / maybe / out for the *known* next session) plus a deep link to Timeful. Keep these separate.
9. No safety/panic tool in this pass — out of scope.

---

## Identity & auth (proportionate — confirm in Phase 0)

No accounts. Defaults:
- First launch asks **"Who are you?"** (the 7 player names + DM), stored in `localStorage`. That label is used for RSVP and as the push-subscription owner.
- DM-only actions (post a message, send a push, view RSVP summary) are gated by a single `ADMIN_TOKEN` (env var on the server), entered once on a hidden `/dm` page and kept in `localStorage`.
- Site privacy: simplest option is **Caddy basic-auth** on the whole site, or an obscure/unlisted URL. Flag this for the DM to decide; don't build a login system.

---

## Phases

### Phase 0 — Audit & confirm (NO code yet)
- Map both projects: the Eleventy repo structure and the Enzo backend (framework, language, how it starts, where the gallery is stored, what's already in front of it for TLS).
- Report the stack back in a short summary.
- Confirm these decisions before proceeding: (a) Caddy vs. existing proxy for TLS + root file serving; (b) where the "next gathering" event data lives now and whether Calendar reads a static Eleventy data file or a new `/api/events`; (c) identity/auth defaults above; (d) site-privacy choice.
- **Stop and report.**

### Phase 1 — PWA shell (static)
- `manifest.webmanifest`: name, short_name, start_url `/`, `display: standalone`, background + theme color from existing tokens, icons (192, 512, and a maskable variant) built from the Vallombrosa mask logo.
- iOS standalone meta: `apple-mobile-web-app-capable`, status-bar style, `apple-touch-icon`.
- `sw.js` at root:
  - `install`: precache app shell only (+ `/offline`).
  - `activate`: purge non-current caches.
  - Fetch strategy: HTML navigations → stale-while-revalidate, fallback to `/offline`; CSS/JS/fonts/images → cache-first (versioned); `/api/*` → network-only; gallery images → cache-first (treat as immutable).
  - Update prompt via postMessage + `skipWaiting` on user confirm.
- Five-tab bottom nav as a shared Eleventy layout include: Home / Calendar / Wiki / Studio / Enzo. Thumb-reachable; reads as app nav, not browser chrome.
- Install onboarding: detect standalone (`display-mode: standalone` / `navigator.standalone`); if running in a browser tab, show a one-time dismissible card — Android uses the captured `beforeinstallprompt` + a custom button; iOS shows the manual "Add to Home Screen" instructions (no prompt available).
- **Acceptance:** installs on iOS + Android, launches standalone, passes a Lighthouse PWA audit, and visited pages load offline. Commit. **Stop.**

### Phase 2 — Push backbone (server + client)
- Generate VAPID keys once; private key in server env, public key shipped to client.
- Use the `web-push` library on the existing backend.
- SQLite schema (create migration):
  - `subscriptions(id, player_name, endpoint UNIQUE, p256dh, auth, created_at)`
- Endpoints:
  - `POST /api/push/subscribe` { name, subscription } → upsert.
  - `POST /api/push/send` { title, body, url } → admin-only; fan out to all subscriptions; prune dead ones (410/404).
- Client permission flow: only offered **after** install, behind a user tap ("Enable session reminders"). Register subscription on grant.
- **Acceptance:** DM can fire a test push from `/dm`; it arrives on an installed iOS device and an Android device. Commit. **Stop.**

### Phase 3 — DM Messages (Home tab)
- Distinct from the static chronicle. Short, dynamic posts.
- Schema: `messages(id, title, body, created_at)`.
- `POST /api/messages` (admin) → store **and** trigger `/api/push/send` in the same action. `GET /api/messages` → latest few.
- Home tab renders the latest DM message above/with "Next Gathering." Posting a note and notifying the table is one button.
- **Acceptance:** posting a message stores it, shows on Home, and pushes to subscribers. Commit. **Stop.**

### Phase 4 — Calendar (read-only + RSVP)
- Shows the next session (title, date, location, the bring/homework notes already on the homepage).
- RSVP control (going / maybe / out) → `POST /api/rsvp`; DM sees a summary via `GET /api/rsvp?eventId=`.
  - Schema: `rsvps(id, event_id, player_name, status, updated_at, UNIQUE(event_id, player_name))`.
- A clear **"Set your availability in Timeful →"** deep link. Do not build availability polling.
- **Acceptance:** RSVP persists per player per event; DM sees the tally. Commit. **Stop.**

### Phase 5 — Optional polish (only if approved)
- **Art-ready push:** when an existing Studio generation finishes (30–90s), fire a push to the requesting player ("Your piece is ready") and ensure gallery images cache cleanly. Hook the existing completion path — do not alter generation itself.
- **Reminders:** a `node-cron` job reading event dates to push "session in 2 days" and the homework deadline reminder. Reuses the Phase 2 send path.

---

## Tab summary

| Tab | Type | Notes |
|---|---|---|
| Home | static + dynamic | Campaign update + next gathering (static) with latest DM message (dynamic) |
| Calendar | dynamic (light) | Next event read-only + RSVP; Timeful deep link |
| Wiki | static | Eleventy-built; runtime-cached for offline |
| Studio | existing + push hook | Don't touch generation/gallery logic; optional art-ready push |
| Enzo | existing | Route the existing assistant into the app shell |

## Out of scope
Safety/panic tool, real user accounts, availability polling (Timeful's job), any change to Enzo's image-gen or LLM-refine internals.