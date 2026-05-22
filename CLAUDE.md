---
title: CLAUDE
description: 
published: false
date: 2026-05-22T14:18:24.613Z
tags: 
editor: markdown
dateCreated: 2026-05-01T22:26:10.048Z
---

# CLAUDE.md — Velly-Final Project Guide

## What This Is

A D&D 5e campaign system with two parts:

1. **Campaign Wiki** (Wiki.js) — `codex.valleyofshadows.wiki` on port 3000
2. **RAG Chatbot** ("Enzo") — `loremaster.valleyofshadows.wiki` on port 8080, also embeddable in the wiki

The chatbot uses a three-tier data pipeline (raw JSON → compressed markdown → vector embeddings) to give Claude context about the homebrew Vallombrosa campaign and D&D 5e rules.

---

## Quick Reference

| Service | Container | Port | Tech |
|---------|-----------|------|------|
| Chatbot frontend | `dnd_nginx` | 8080 | nginx → static HTML/JS/CSS |
| Chatbot backend | `dnd_chatbot` | 3001 | Python/Flask + Gunicorn |
| Wiki | `dnd_wiki` | 3000 | Wiki.js 2 |
| Database | `dnd_postgres` | — | PostgreSQL 15 |

**Repo:** `github.com/TheASDM/velly-final` (branch `main`)

---

## Architecture

The chatbot is **player-only**. DM material lives at `Venturia/DM/` (and any `published: false` page) and is excluded from everything the chatbot sees. A separate DM-facing chatbot is planned.

### Data Pipeline — Wiki as Source of Truth

The wiki markdown files **are** the source of truth for campaign content. Two build scripts read the wiki and the 5etools reference data, producing the artifacts the chatbot loads:

- **Source**: wiki markdown under `Characters/`, `Venturia/Locations/`, `Venturia/Factions/`, `Venturia/Government/`, `Venturia/Lore/`, `Articles/`, `Class-Changes/`, `House-Rules/`, `Updates/`, plus `home.md`. `Venturia/DM/` and any `published: false` page are excluded. The 5etools JSON in `campaign-data/5e-filtered/` is still the source for D&D rules data.
- **Tier 1** (system prompt): `campaign-data/tier1.md` — compressed summaries of every published wiki page, built by `build_tiers.py`.
- **Tier 2** (vector store): `campaign-data/vector_store.json` — embeddings (one entry per wiki page + one per 5etools entry), built by `build_vectors.py` via Ollama.

`campaign-data/curated/*.json` is **legacy**; it's no longer read by anything and can be deleted once the new pipeline is verified.

### Per-Message Flow

1. Frontend POSTs `{message, conversationHistory, rules, vibe}` to `/api/chat`
2. Backend embeds query via Ollama → cosine similarity against `vector_store.json` → top 3 auto-injected as context, plus any keyword (name/alias) exact matches.
3. Anthropic API call with `tier1.md` as system prompt + RAG context + `lookup_entry` tool (temperature 0.2).
4. Tool loop (max 5 iterations) if Claude wants to look up specific entries by name/alias.
5. Response returned to frontend, history stored in localStorage.

### Rebuilding After Wiki Changes

Anytime you change wiki content and want Enzo to reflect it:

```bash
python3 build_tiers.py          # rebuild tier1.md (fast, no network)
python3 build_vectors.py         # rebuild vector_store.json (slower, hits Ollama)
docker compose restart chatbot   # gunicorn reloads with the new data
```

`build_vectors.py` caches by text hash, so subsequent runs only re-embed pages that actually changed.

---

## Critical Files

### Backend — `chatbot/`
| File | What It Does |
|------|-------------|
| `server.py` | Flask API. `Loremaster` class handles RAG pipeline, Anthropic tool calling. Single mode (player). Loads `tier1.md` and `vector_store.json` at startup. `lookup_entry` matches against in-memory name/alias index. Routes: `POST /api/chat`, `GET /health`. |
| `Dockerfile` | Python 3.11-slim, gunicorn with 2 workers, 120s timeout, `--preload` (shared memory) |
| `requirements.txt` | flask 3.1.0, requests 2.32.3, gunicorn 23.0.0 |

### Frontend — `public/`
| File | What It Does |
|------|-------------|
| `js/chatbot.js` | `LoreMasterChatbot` widget class. Markdown rendering, localStorage persistence, mode/rules/vibe toggles, dynamic icons |
| `css/chatbot.css` | Dark Venetian theme. Gold accents, serif fonts, responsive |
| `index.html` | Standalone chatbot page. PWA-enabled |
| `sw.js` | Service worker — cache-first for static, network-only for API |
| `manifest.webmanifest` | PWA manifest for "Enzo — Valley of Shadows" |
| `images/` | Icon variants for all 8 mode combos (192px + 512px each) |

### Data Pipeline
| File | What It Does |
|------|-------------|
| `build_tiers.py` | Walks wiki content + 5etools JSON, compresses into `tier1.md` (single output, ~80 KB). Excludes `Venturia/DM/` and `published: false`. Fast, no network. |
| `build_vectors.py` | Walks wiki content + 5etools JSON, embeds each entry via Ollama into `vector_store.json`. Caches by text hash; `--force` re-embeds all. Same exclusions as `build_tiers.py`. |

### Infrastructure
| File | What It Does |
|------|-------------|
| `docker-compose.yml` | 4 services on `dnd-network` bridge. Postgres password from `.env` |
| `nginx/conf.d/dnd-site.conf` | Routes `/api/chat` → chatbot:3001, handles CORS OPTIONS → 204 |
| `nginx/nginx.conf` | Base nginx config with gzip |
| `.env.example` | Template for all env vars — copy to `.env` before deploy |

### Wiki
| File | What It Does |
|------|-------------|
| `files/css.css` | Wiki.js theme override injected via admin panel |
| `publish.js` | Auto-updates homepage + archive index from dated article markdown files. Commits and pushes |

### Campaign Data — `campaign-data/`
| Path | What It Contains |
|------|-----------------|
| `5e-filtered/` | 34 5etools JSON files: spells, monsters, items, feats, classes, races, conditions, etc. — still source data for D&D rules. |
| `tier1.md` | Generated system prompt (~80 KB). Built by `build_tiers.py` from wiki + 5etools. |
| `vector_store.json` | Generated embeddings (gitignored). Built by `build_vectors.py`. One entry per wiki page + one per 5etools entry. |
| `curated/` | **Legacy** — no longer read. Safe to delete once new pipeline is verified working in prod. |

---

## Environment Variables

Defined in `.env` (never committed). See `.env.example` for the template.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | Model ID for chat responses |
| `OLLAMA_URL` | No | `https://ai.raptornet.dev/ollama` | Embedding endpoint |
| `OLLAMA_API_KEY` | No | — | Bearer token for Ollama/OpenWebUI |
| `EMBEDDING_MODEL` | No | `nomic-embed-text:latest` | Must match `build_vectors.py` |
| `TEMPERATURE` | No | `0.2` | Anthropic API temperature for chat responses. Lower = more factual. |
| `POSTGRES_DB` | No | `wiki` | Wiki.js database name |
| `POSTGRES_USER` | No | `wikijs` | Wiki.js database user |
| `POSTGRES_PASSWORD` | Yes | — | **Change before first deploy** |

---

## Deployment

```bash
# Pull latest
git pull

# Backend changes (server.py, requirements.txt)
docker compose up -d --build chatbot

# Frontend/static changes (CSS, JS, HTML, images)
docker compose restart nginx

# Wiki content changes (after editing pages on main or pulling from origin)
python3 build_tiers.py          # rebuild tier1.md (fast)
python3 build_vectors.py        # rebuild vector_store.json (uses cache; only re-embeds changed pages)
docker compose restart chatbot  # gunicorn reloads with the new data

# Force full vector rebuild (rare — when embedding model or chunking changes)
python3 build_vectors.py --force
```

---

## Conventions and Gotchas

### Code Style
- Python backend is a single `server.py` — no framework beyond Flask
- Frontend is vanilla JS, no build step, no framework
- Commit messages follow `type: description` (feat, fix, chore, etc.)

### Known Constraints
1. **Wiki frontmatter is the structured-data interface** — `title`, `description`, `tags`, `published`, and optional `aliases` (as a YAML list) drive the chatbot's understanding of each page. Pages with `published: false` are hidden from both Wiki.js and the chatbot.
2. **`Venturia/DM/` is invisible to the player chatbot** — the build scripts skip the entire directory. Put any DM-only content there.
3. **Never use `<p>` tags in Wiki.js custom HTML** — `files/css.css` overrides `<p>` color. Use `<div>` instead.
4. **CORS is split** — nginx handles OPTIONS → 204, Flask handles response headers on actual requests. Do NOT add `add_header` directives to the proxy block.
5. **Vector store is gitignored** — ~60 MB. Rebuild with `build_vectors.py` after cloning.
6. **Rebuild tier1 + vectors after wiki changes**, then `docker compose restart chatbot`.
7. **Ollama endpoint** requires Bearer token (`OLLAMA_API_KEY`). Uses `nomic-embed-text:latest`.
8. **Gunicorn uses `--preload`** — tier1 and vector store loaded once, shared across 2 workers.
9. **Input validation** — messages capped at 4,000 chars, history capped at 40 messages (8,000 chars each), roles restricted to user/assistant.
10. **No automated tests** — no test framework, no CI/CD. Test manually.
11. **Conversation history is client-side only** (localStorage). Server is stateless.

### Wiki page frontmatter the chatbot reads
```yaml
---
title: Maruk Grommarg
description: A Fog Warden who volunteered for the Overlook posting and Noname's missing fiancé...
published: true              # set to false to hide from chatbot + Wiki.js
date: 2026-05-22T00:00:00.000Z
tags: characters, npcs, fog-warden, missing, orc, overlook
aliases:                     # optional — lets the chatbot match the old name
  - Marcus
editor: markdown
dateCreated: 2026-05-22T00:00:00.000Z
---
```

### Frontend Chat Commands

- `/rules on` / `/rules off` → toggle 5e rules emphasis
- `/yasqueen on` / `/yasqueen off` → personality vibe mode
- `/fabio on` / `/fabio off` → romance novel narrator vibe mode
- `/rocky on` / `/rocky off` → Rocky-from-Project-Hail-Mary voice (broken English Eridian engineer)

### Wiki Embedding
The chatbot widget can be embedded in Wiki.js pages:
```html
<link rel="stylesheet" href="https://loremaster.valleyofshadows.wiki/css/chatbot.css">
<div id="chatbot-container"></div>
<script>window.LOREMASTER_API_URL = 'https://loremaster.valleyofshadows.wiki/api/chat';</script>
<script src="https://loremaster.valleyofshadows.wiki/js/chatbot.js"></script>
```

---

## What's Not in This Repo

- **SSL certificates** — mounted at deploy time in `ssl/`, gitignored
- **Chat logs** — written at runtime to `logs/chat.log`, gitignored
- **Vector store** — generated artifact `campaign-data/vector_store.json`, gitignored (rebuild with `build_vectors.py`)
- **Wiki.js content** — lives in PostgreSQL, not in this repo (except article markdown files used by `publish.js`)
- **Node modules** — `publish.js` has no dependencies beyond Node stdlib
