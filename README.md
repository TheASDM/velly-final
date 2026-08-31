# Vallombrosa

A self-hosted PWA for the **Valley of Shadows** D&D campaign. One repo holds the
campaign wiki, the player-facing app shell, the Flask API, and the deployment
config — the repo is the source of truth for all four.

The five bottom-nav destinations. The middle one is role-specific: a player's
primary workspace is their own Sheet, the DM's is The Table.

| Surface | Route | What it is |
|---|---|---|
| Home | `/` | Next gathering, what needs you, News and Announcements — ordered by role |
| Calendar | `/calendar/` | Scheduling, RSVP, weekly availability grid, `.ics` export |
| Sheet / The Table | `/sheet/` · `/party/` | The player's character, or the DM's five-area workspace |
| Wiki | `/en/Venturia/` | 178 markdown pages — characters, locations, factions, lore |
| Studio | `/studio/` | View and create campaign art and lore |

Enzo is a capability rather than a destination: contextual actions live on the
wiki, the Sheet, Home, The Table, and in Studio Create. `/enzo/` is still the
general conversation, just not a tab.

Player-only surfaces: `/questionnaire/` (character record), `/notes/`,
`/messages/`, `/settings/`, `/profile/`.
DM surfaces are areas of The Table: `/dm/` (campaign settings), `/monsters/`,
`/sheets/`, `/dossiers/`.

## Stack

Eleventy 3 + Pagefind build the static site. Flask + Gunicorn serve the API.
nginx serves the build and proxies `/api/*`. SQLite holds all runtime state.
There is no separate database service.

```
Internet → Caddy (HTTPS) → nginx :8080 ─┬─ /            → _site/ (static)
                                        ├─ /api/*       → chatbot:3001
                                        └─ /health      → chatbot:3001
```

Both containers mount the repo at `/site`. The **chatbot container runs the
Eleventy build at startup**, then execs Gunicorn — so a rebuild of that
container is what refreshes the static site.

| Service | Container | Port |
|---|---|---|
| Flask API + site build | `dnd_chatbot` | `3001` (internal only) |
| Web server | `dnd_nginx` | `127.0.0.1:8080:80` |

## Quick start

```bash
npm install
npm run dev          # eleventy --serve on :8080
```

`npm run build` produces `_site/` and the Pagefind index. The API is not part of
the local Node build; run the stack with Docker to exercise `/api/*`.

## Content model

Markdown in the repo becomes wiki pages. `.eleventy.js` prepends `/en/` to every
wiki URL, so `Venturia/Locations/foo.md` → `/en/Venturia/Locations/foo/`. Root
tab pages set an explicit `permalink` and opt out of that scheme.

Frontmatter uses `title`, `description`, `published`, `tags`.

**`published: false` does *not* unpublish a page by itself.** It excludes the
page from collection listings and Enzo's knowledge build. Sensitive trees and
internal documents are separately excluded through `.eleventyignore`.

Navigation tabs come from `_data/navigation.js`; the player roster from
`_data/players.json`; the character-record questions from
`_data/questionnaire.json` (generated — see below).

## Data pipelines

Two generated artifacts feed Enzo, both gitignored and built on the host:

```bash
python3 build_tiers.py      # → campaign-data/tier1.md      (base system prompt)
python3 build_vectors.py    # → campaign-data/vector_store.json (embeddings)
docker compose restart chatbot
```

`build_tiers.py` compresses published markdown plus selected 5e reference data.
`build_vectors.py` embeds it through the configured Ollama endpoint. Both skip
`Venturia/DM/` and any page marked `published: false`.

A third pipeline builds the character record:

```bash
python3 build_questionnaire.py   # questionaire/record-*.html → _data/questionnaire.json
```

Per-chat flow: embed the query → cosine similarity → inject top matches →
Anthropic with a `lookup_entry` tool for precise entries → response.

Editing a wiki page from the browser triggers an async rebuild inside the
container (`AUTO_REBUILD_ON_WIKI_SAVE`, `AUTO_KNOWLEDGE_ON_WIKI_SAVE`), which
refreshes `_site` and hot-reloads Enzo's corpus on the next chat.

## Auth

OAuth is the real auth path. Discord is preferred, Google is the fallback.
`AUTH_TOKEN_SECRET` signs player tokens; `GOOGLE_PLAYER_MAP` /
`DISCORD_PLAYER_MAP` bind OAuth principals to canonical roster names from
`_data/players.json`. A player is the DM when their roster name is `DM`.

`ADMIN_TOKEN` and `PLAYER_LOGIN_CODES` are legacy fallbacks — leave blank when
`AUTH_TOKEN_SECRET` is set. `/dm/` additionally accepts direct Google sign-in via
`SESSION_JWT_SECRET` + `ALLOWED_DM_EMAILS`.

## Runtime state

One SQLite file, `app-data/vallombrosa.sqlite3`, carries every runtime table —
`subscriptions`, `messages`, `rsvps`, `availability`, `calendar_events`,
`questionnaires`, `lore_submissions`, `studio_jobs`, `notes`, `rumors`,
`in_play`, and the push delivery log. Schema changes are applied as numbered
migrations under `chatbot/vos/`.

Generated images live outside the DB in `generated-art/`.

## Deploy

```bash
git pull --ff-only
docker compose up -d --build --remove-orphans
docker compose logs -f chatbot nginx
```

Checks on the VPS:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/manifest.webmanifest
curl -I http://127.0.0.1:8080/sw.js
curl    http://127.0.0.1:8080/health
```

Full VPS setup, Caddy config, and firewall notes: [DEPLOY.md](DEPLOY.md).

## Backups

```bash
# Whole runtime DB
cp app-data/vallombrosa.sqlite3 "app-data/vallombrosa-$(date +%F).sqlite3"

# Art gallery
tar -czf "generated-art-$(date +%F).tgz" generated-art/

# Player character records, as JSON + readable Markdown
python3 export_questionnaires.py
```

`export_questionnaires.py` auto-detects its source: it reads the SQLite file
directly when run on the VPS, or pulls `/api/questionnaire/all` when given
`--url` plus a DM token (`--token` or `VOS_DM_TOKEN`). Output lands in
`backups/questionnaires/<timestamp>/`, which is gitignored — **this repo is
public, and those files are the players' own writing.**

The DM view at `/questionnaire/` has equivalent download buttons.

## Environment

Copy `.env.example` to `.env` on the VPS. Required in production:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enzo chat |
| `OLLAMA_API_KEY` | Bearer token for the embeddings endpoint |
| `OPENAI_KEY` | Studio image generation |
| `AUTH_TOKEN_SECRET` | Signs player auth tokens |
| `DISCORD_OAUTH_CLIENT_ID` / `_SECRET` | Player sign-in |
| `DISCORD_PLAYER_MAP` | Maps Discord IDs to roster names |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |

`.env.example` documents the full set, including retrieval tuning, rate limits,
Studio quotas, and the CORS allowlist.

## Known constraints

- `published: false` remains an unlisting flag, not an access-control boundary;
  use `.eleventyignore` or `permalink: false` for content that must not render.
- **`DM_PASSPHRASE` is dead config.** Still in `.env.example`; no longer read by
  `chatbot/server.py` or any client. DM access is decided by roster name.

## Repo docs

[CLAUDE.md](CLAUDE.md) — working guide and conventions ·
[ARCHITECTURE.md](ARCHITECTURE.md) — runtime shape ·
[DEPLOY.md](DEPLOY.md) — VPS runbook
