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
| `home.md`, `calendar.md`, `sheet.md`, `studio.md` | Root tab surfaces (the wiki is the fifth) |
| `party.md` | The Table — the DM's Run/Prepare/Players/NPCs/Review workspace |
| `enzo.md` | The general Enzo conversation; no longer a tab |
| `dm.md`, `questionnaire.md`, `submit-lore.md`, `messages.md`, `notes.md`, `settings.md`, `profile.md` | Player/DM surfaces |

### Client

| Path | Purpose |
|---|---|
| `src/js/pwa/` | Identity, push, install, `authHeaders()`, RSVP wiring. Bundles to `/js/pwa-client.js` and exposes `window.VOS_PWA` |
| `sw.js` | Service worker — four caches keyed off `CACHE_VERSION` |
| `src/js/dm/` | DM console modules; esbuild emits `public/js/vos-dm.js` |
| `src/js/play/table.js` | The Table's five areas, the preview roster, the review count |
| `src/js/pwa/preview.js` | Preview-as-player: token swap, sticky strip, Exit Preview |
| `src/js/pwa/enzo-actions.js` | `data-enzo-ask="…"` — seeds the widget from anywhere |
| `public/js/vos-calendar.js` | Calendar, RSVP, availability grid |
| `src/js/questionnaire/` | Character record + DM proofing view + export |
| `src/js/chatbot/`, `src/js/studio/` | Enzo client and Studio UI modules |
| `src/css/` | Layered source CSS; esbuild emits the files under `public/css/` |

### Server and pipelines

| Path | Purpose |
|---|---|
| `chatbot/server.py`, `chatbot/vos/` | Gunicorn compatibility shim plus Flask blueprints, services, migrations, and RAG engine |
| `chatbot/vos/services/uploads.py` | Magic bytes, a real image decode, and the pixel cap — shared by chat attachments and handout images |
| `chatbot/vos/image_prompt_compiler.json` | **The only** source of the Valley house style, the per-preset composition rules, and the prompt compiler's instructions |
| `chatbot/vos/services/prompt_compiler.py` | User request → compiler model → structured JSON → scene + style + constraints → the image API |
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

**Art style lives in one JSON file, and both compilers read it.**
`chatbot/vos/image_prompt_compiler.json` is the source of truth for the house
look, the ten preset keys, and the compiler's own instructions.
`ART_STYLE_PRESETS` is *derived* from it at import — no Python restates the
style text, because two editable copies is how the look drifted before. The
compiler model is never asked to write or reword the style; it returns a
structured scene and the server appends the configured style block, the
canonical visual lock, then the hard constraints, in that order. The file is
read from beside the code (`COPY chatbot/vos ./vos`), not the `/site` bind
mount, so a container always has the config it was built with. If it fails to
load, art generation returns 503 rather than quietly shipping unstyled prompts.

**Two prompt compilers exist so they can be compared; players see neither.**
Claude and ChatGPT both compile prompts. Which one is live is a DM setting
(Campaign Settings → Art), stored in `app_settings`, defaulting to
`IMAGE_COMPILER_PROVIDER`. The Studio shows a two-button "powered by" row
**only to the DM seat**, and `compiler` in a generate request is honored only
for a DM token — a player is served a compiler and is never told there is a
choice. `IMAGE_COMPILER_DEBUG=1` logs the whole exchange, which is the only
way to tell "the compiler misread the request" from "the image model rendered
a good prompt badly".

**Restarting nginx is not enough for content changes.** nginx serves a static
build; the chatbot container produces it. Rebuild `chatbot` to pick up markdown,
template, or client-JS changes.

**Vector rebuilds do not travel with git — always rebuild them live.**
`campaign-data/` is gitignored, so `tier1.md` and `vector_store.json` never
reach the VPS through a deploy. Rebuilding them on your laptop changes nothing
Enzo can see. Any change to published wiki content, `_data/campaign.js`, or the
curated corpus is not actually live until you have run `build_tiers.py` and
`build_vectors.py` **on the server** and restarted `chatbot`:

```bash
ssh vapp 'cd ~/vallombrosa && set -a && . ./.env && set +a \
  && python3 build_tiers.py && python3 build_vectors.py \
  && docker compose restart chatbot'
```

The `.env` sourcing is what supplies `OLLAMA_API_KEY`; without it the embedding
step fails. `app-data/vector_store.sqlite3` is the sqlite-vec index built from
`vector_store.json` — it re-derives itself on the next knowledge load whenever
the JSON's hash changes, so it needs no separate step. Verify with
`grep -c '<the changed thing>' campaign-data/vector_store.json`.

**Deleting a page does not remove it from `_site`.** Eleventy writes output but
never prunes it, so a deleted or renamed page keeps being served from the stale
build. Clear the directory inside the container (it is root-owned) and rebuild:

```bash
ssh vapp 'cd ~/vallombrosa && docker exec dnd_chatbot sh -c "rm -rf /site/_site" \
  && docker exec -w /site dnd_chatbot npm run build'
```

**Deleted SQLite rows stay in the file until `VACUUM`.** `DELETE` frees the page
but leaves the bytes, so the runtime DB still greps positive for content you
removed. Run `VACUUM` when the deletion was the point.

**Bump `CACHE_VERSION` in `sw.js`** when shipping client changes, or installed
apps keep serving the old shell.

**Previewing a player is a credential, not a client flag.** `POST
/api/auth/preview` (DM only) mints a short-lived token that *is* that player,
carrying `preview: true`. Every route scopes to them without knowing preview
exists, and `_request_is_dm()` / `_admin_error_response()` both refuse a
preview token — so DM doors close for real, not just visually. The client
stashes the DM's own token under `vos.preview.dmSeat` and restores it on Exit
Preview, so leaving never depends on the network. See
`chatbot/tests/test_preview.py`.

**Enzo inherits the caller's role, but has only one corpus.** `/api/chat` now
reads the caller's token and passes a viewer into the engine. The corpus is
still published-wiki-only (`build_tiers.py` excludes `Venturia/DM/` and
anything `published: false`), so a player cannot be told a DM secret — and
neither can the DM. A DM-visible tier needs a second `tier1-dm.md` and vector
namespace; see the `TODO(DESIGN-PROJECT)` in
`chatbot/vos/engine/loremaster.py`.

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
# Content changes Enzo should know about — run these ON THE VPS, not locally.
# campaign-data/ is gitignored; a deploy does not carry vectors with it.
set -a && . ./.env && set +a          # OLLAMA_API_KEY for the embedding step
python3 build_tiers.py && python3 build_vectors.py && docker compose restart chatbot

# Character-record questions changed
python3 build_questionnaire.py       # regenerates _data/questionnaire.json

# Back up player records (VPS: reads SQLite; laptop: needs --url + token)
python3 export_questionnaires.py

# Deploying is its own section below — follow all of it, not this summary.
```

## Shipping: finish the job, do not ask

**A change is not done until it is live on the VPS.** Commit, push, deploy,
and verify — every time, without being asked and without offering it as an
option. "Do you want me to deploy?" is not a question this project has; the
answer has always been yes. The work is served from the VPS, so an unshipped
change is a change nobody has.

The whole sequence, in order. Skipping a step here has cost real time before,
and each one is in the list because it went wrong once.

```bash
# 1. Bump the caches, or installed apps keep serving the old shell.
#    CACHE_VERSION in sw.js every time; `build` in _data/app.js when players
#    should see a new number in Settings → About.

# 2. Prove it locally first.
npm run clean && npm run build
# node --check only reads its FIRST file argument — loop, don't list.
for f in .eleventy.js sw.js scripts/build-js.mjs public/js/*.js; do node --check "$f" || break; done
npm run lint:js
python3 -m py_compile chatbot/server.py
(cd chatbot && python3 -m pytest tests/ -q)
git diff --check

# 3. Commit by named path — never `git add -A`. The repo is public and must
#    never take player-written content. See the plumbing recipe below.
# 4. git push origin <branch>

# 5. Deploy. The VPS tracks the same branch you are on; check, do not assume.
ssh vapp 'cd ~/vallombrosa && git pull --ff-only \
  && docker compose up -d --build --remove-orphans'

# 6. Clear _site inside the container and rebuild. Eleventy never prunes, so a
#    deleted or renamed page keeps being served from the stale build.
ssh vapp 'cd ~/vallombrosa && docker exec dnd_chatbot sh -c "rm -rf /site/_site" \
  && docker exec -w /site dnd_chatbot npm run build'

# 7. Only if published wiki content, _data/campaign.js, or the corpus changed:
ssh vapp 'cd ~/vallombrosa && set -a && . ./.env && set +a \
  && python3 build_tiers.py && python3 build_vectors.py \
  && docker compose restart chatbot'

# 8. Verify against the live URL, not the local build.
```

**Committing.** `git status` and `git diff` hang in this working copy (they
time out after two minutes); the plumbing commands are instant. Stage named
paths, print what is staged as the check that replaces `git status`, then
commit with plumbing:

```bash
git add -- path/one path/two               # never `git add -A`
git --no-pager diff --cached --name-status # this is the review step
TREE=$(git write-tree)
COMMIT=$(git commit-tree "$TREE" -p HEAD -F /path/to/message.txt)
git update-ref refs/heads/<branch> "$COMMIT"
```

Write the message to a file and use `-F`: a heredoc breaks on an apostrophe.
`timeout` is not installed on this machine (BSD userland).

**Verify on the public origin** (`PUBLIC_BASE_URL` in `.env` on the VPS — not
written down here, the repo is public). A local build passing proves nothing
about what players get; the last several defects were all invisible locally. At
minimum: the routes you touched return 200, the changed markup or copy is in
the served HTML, `sw.js` reports the new `CACHE_VERSION`, and the service
worker still reaches `activated`.

**Always confirm the worker installs.** Register `/sw.js` in a real browser
and watch the state. `installing → redundant` means the install threw and
**no client will ever take the update** — every deploy will report success
while every device keeps the build it already had. This happened for four
releases straight because `Cache.addAll()` rejects on a duplicate URL and two
entries had been added to `APP_SHELL` that were already in it. Settings →
About now prints the version actually serving that device; ask for it before
believing a screenshot.

**A fresh browser context has no service worker**, which is why headless checks
pass while a phone shows something days old. That difference is a real
condition of this app, not a testing artifact — reason about it before
concluding a fix did not work.

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
