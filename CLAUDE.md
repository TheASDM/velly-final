# CLAUDE.md — Vallombrosa working guide

Project overview lives in [README.md](README.md). This file is the working
guide: where things are, what the conventions are, and what will bite you.

## Shape

Docker-deployed PWA for the Valley of Shadows campaign. Two services, no
separate database.

| Service | Container | Port | Owns |
|---|---:|---:|---|
| nginx | `dnd_nginx` | `127.0.0.1:8080:80` | Serves `_site`, proxies `/api/*` and `/health` |
| Flask API | `dnd_chatbot` | `3001` internal | Enzo, Studio, push, auth, calendar, records |

The **chatbot container runs the Eleventy build at startup** (`npm run build`
against the mounted `/site`), then execs Gunicorn. Rebuilding that container is
what refreshes the static site — nginx only serves what it finds.

Runtime state is one SQLite file at `app-data/vallombrosa.sqlite3`. Generated
images live in `generated-art/`.

## Critical files

### App shell and pages

| Path | Purpose |
|---|---|
| `_includes/layouts/page.njk` | App shell, sticky app bar, bottom tabs, shared PWA styles |
| `_includes/partials/` | `app-bottom-nav`, `rsvp-control`, `gallery-carousel`, `map-viewer` |
| `.eleventy.js` | `/en/` permalink scheme, collections, `appBarMeta` / breadcrumb / tree filters |
| `_data/navigation.js` | Single source of truth for bottom-nav tabs and app-bar titles |
| `_data/players.json` | Canonical roster names — auth maps and records key off these |
| `_data/campaign.js` | Latest session, open threads (edit after each session, then rebuild) |
| `home.md`, `calendar.md`, `enzo.md` | Root tab surfaces |
| `Tools/art.md` | Studio |
| `dm.md`, `questionnaire.md`, `submit-lore.md`, `messages.md`, `notes.md`, `settings.md`, `profile.md` | Player/DM surfaces |

### Client

| Path | Purpose |
|---|---|
| `src/js/pwa/` | Identity, push, install, `authHeaders()`, RSVP wiring. Bundles to `/js/pwa-client.js` and exposes `window.VOS_PWA` |
| `sw.js` | Service worker — four caches keyed off `CACHE_VERSION` |
| `src/js/dm/` | DM console modules; esbuild emits `public/js/vos-dm.js` |
| `public/js/vos-calendar.js` | Calendar, RSVP, availability grid |
| `src/js/questionnaire/` | Character record + DM proofing view + export |
| `src/js/chatbot/`, `src/js/studio/` | Enzo client and Studio UI modules |
| `src/css/` | Layered source CSS; esbuild emits the files under `public/css/` |

### Server and pipelines

| Path | Purpose |
|---|---|
| `chatbot/server.py`, `chatbot/vos/` | Gunicorn compatibility shim plus Flask blueprints, services, migrations, and RAG engine |
| `chatbot/vos/services/uploads.py` | Magic bytes, a real image decode, and the pixel cap — shared by chat attachments and handout images |
| `campaign_lib/` | Shared frontmatter, wiki traversal, chunking, and 5e build helpers |
| `build_tiers.py` | Published markdown + 5e data → `campaign-data/tier1.md` |
| `build_vectors.py` | → `campaign-data/vector_store.json` via Ollama embeddings |
| `build_questionnaire.py` | `questionaire/record-*.html` → `_data/questionnaire.json` |
| `export_questionnaires.py` | Player records → gitignored `backups/questionnaires/<stamp>/` |
| `docker-compose.yml`, `nginx/conf.d/dnd-site.conf` | Deployment |

## Conventions

- Keep shared PWA UI in the layout or partials, not page-local one-offs.
- Root-tab navigation belongs in the bottom tab bar; per-section navigation
  stays inside each tab.
- Use row chips for navigable entities.
- Page-local CSS and JavaScript live under `src/css/pages/` and `src/js/pages/`;
  declare their built URLs with frontmatter `pageStyles` / `pageScripts`.
- Every new wiki page gets `title` / `description` / `tags` frontmatter.
- Rebuild vectors after meaningful campaign content changes.
- Use `docker compose up -d --build --remove-orphans` so removed services are
  cleaned up.

## Gotchas

**`published: false` means unlisted, not private by itself.** The entire
`Venturia/DM/` tree and internal runbooks/plans are additionally excluded in
`.eleventyignore`; keep sensitive additions covered there or set
`permalink: false`.

**Restarting nginx is not enough for content changes.** nginx serves a static
build; the chatbot container produces it. Rebuild `chatbot` to pick up markdown,
template, or client-JS changes.

**Bump `CACHE_VERSION` in `sw.js`** when shipping client changes, or installed
apps keep serving the old shell.

**Auth is OAuth, not tokens.** `AUTH_TOKEN_SECRET` signs player tokens; DM
status is `player_name == "DM"`. `ADMIN_TOKEN` and `PLAYER_LOGIN_CODES` are
legacy fallbacks. `DM_PASSPHRASE` (the old `Prima Volta` chat toggle) is **dead
config** — still in `.env.example`, read by nothing.

**Admin endpoints accept two credentials.** `_admin_error_response()` takes
either a DM player token or a Google session JWT, both as
`Authorization: Bearer`. Client code sends it via `pwa.authHeaders()`.

**Player names are the join key.** `_data/players.json` `name` values must match
the `PLAYERS` map in `build_questionnaire.py` and the OAuth `*_PLAYER_MAP`
entries. A rename silently orphans records.

**The repo is public.** Never commit player-written content — questionnaire
answers, lore submissions, notes. `backups/` is gitignored for this reason.

**Browser wiki edits trigger an async rebuild** inside the container
(`AUTO_REBUILD_ON_WIKI_SAVE`, `AUTO_KNOWLEDGE_ON_WIKI_SAVE`), refreshing `_site`
and hot-reloading Enzo's corpus on the next chat. Local edits do not.

## Common tasks

```bash
# Content changes Enzo should know about
python3 build_tiers.py && python3 build_vectors.py && docker compose restart chatbot

# Character-record questions changed
python3 build_questionnaire.py       # regenerates _data/questionnaire.json

# Back up player records (VPS: reads SQLite; laptop: needs --url + token)
python3 export_questionnaires.py

# Deploy
git pull --ff-only && docker compose up -d --build --remove-orphans
```

Pre-deploy checks:

```bash
npm run clean && npm run build
# node --check only reads its FIRST file argument — loop, don't list.
for f in .eleventy.js sw.js scripts/build-js.mjs public/js/*.js; do node --check "$f" || break; done
python3 -m py_compile chatbot/server.py
git diff --check
```

## Environment

`.env.example` documents the full set. Required in production:
`ANTHROPIC_API_KEY`, `OLLAMA_API_KEY`, `OPENAI_KEY`, `AUTH_TOKEN_SECRET`,
`DISCORD_OAUTH_CLIENT_ID` / `_SECRET`, `DISCORD_PLAYER_MAP`,
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

Keep `VAPID_PRIVATE_KEY` and all secrets server-side only.

## Runtime data to back up

Instant-message conversations live in the SQLite file below — player-written,
never in the repo, backed up with it: `chat_messages` (bodies, replies, edits,
soft deletes, and Enzo's half of every thread), `chat_reads` (unread pointers,
which double as read receipts), `chat_reactions`, and the two disposable
tables `chat_typing` and `player_presence`.

Chat attachments (images and PDFs) are files rather than rows, under
`app-data/chat-attachments/` — inside the volume the database already lives
in, so one archive covers both. Same for `app-data/handout-images/` and
`app-data/profile-avatars/`. Player-written bios live in `player_profiles`
in the database.

```bash
tar -czf "app-data-$(date +%F).tgz" app-data/   # database + attachments + handouts
tar -czf "generated-art-$(date +%F).tgz" generated-art/
python3 export_questionnaires.py
```
