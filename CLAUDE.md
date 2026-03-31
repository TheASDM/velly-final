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

See `ARCHITECTURE.md` for the full diagram and data flow. Key points:

### Three-Tier Data Pipeline

- **Tier 0** (raw): `campaign-data/curated/*.json` (7 files, 88 entries) + `campaign-data/5e-filtered/*.json` (34 files, ~2,876 entries)
- **Tier 1** (system prompts): `campaign-data/tier1_player.md` (~80 KB) and `campaign-data/tier1_dm.md` (~308 KB) — built by `build_tiers.py`
- **Tier 2** (vectors): `campaign-data/vector_store*.json` (~62-63 MB each) — built by `build_vectors.py` via Ollama embeddings

### Per-Message Flow

1. Frontend POSTs `{message, conversationHistory, mode, rules, vibe}` to `/api/chat`
2. Backend embeds query via Ollama → cosine similarity against vector store → top 3 auto-injected as context
3. Anthropic API call with tier1 system prompt + RAG context + `lookup_entry` tool
4. Tool loop (max 5 iterations) if Claude wants to look up specific entries
5. Response returned to frontend, history stored in localStorage

### DM Mode

Type the passphrase (default: `Prima Volta`, env: `DM_PASSPHRASE`) in chat to toggle. DM mode uses the full tier1 system prompt (308 KB with spoilers) and unfiltered vector store. Persists in localStorage.

---

## Critical Files

### Backend — `chatbot/`
| File | What It Does |
|------|-------------|
| `server.py` | Flask API. `Loremaster` class handles RAG pipeline, Anthropic tool calling, DM mode. Routes: `POST /api/chat`, `GET /health`. ~889 lines. |
| `Dockerfile` | Python 3.11-slim, gunicorn with 2 workers, 120s timeout |
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
| `build_tiers.py` | Tier 0 → Tier 1. Compresses curated + 5etools JSON into markdown system prompts |
| `build_vectors.py` | Tier 0 → Tier 2. Embeds all entries via Ollama, outputs vector stores. Supports `--force` and `--batch-size` flags. Caches by text hash |

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
| `curated/` | 7 hand-authored JSON files: characters, locations, factions, government, lore, campaign, houserules |
| `5e-filtered/` | 34 5etools JSON files: spells, monsters, items, feats, classes, races, conditions, etc. |
| `tier1_player.md` | Player system prompt (spoilers stripped) |
| `tier1_dm.md` | DM system prompt (full access) |
| `vector_store*.json` | Generated embeddings (gitignored, ~62-63 MB each) |

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
| `DM_PASSPHRASE` | No | `Prima Volta` | Passphrase to toggle DM mode |
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

# Campaign data changes (curated JSON or 5etools JSON)
python3 build_tiers.py          # rebuild system prompts
python3 build_vectors.py        # rebuild vector stores (uses cache)
docker compose restart chatbot  # reload new data

# Force full vector rebuild
python3 build_vectors.py --force
```

---

## Conventions and Gotchas

### Code Style
- Python backend is a single `server.py` — no framework beyond Flask
- Frontend is vanilla JS, no build step, no framework
- Commit messages follow `type: description` (feat, fix, chore, etc.)

### Known Constraints
1. **Never use `<p>` tags in Wiki.js custom HTML** — `files/css.css` overrides `<p>` color. Use `<div>` instead.
2. **CORS is split** — nginx handles OPTIONS → 204, Flask handles response headers on actual requests. Do NOT add `add_header` directives to the proxy block.
3. **Vector stores are gitignored** — they're 62-63 MB each. Rebuild with `build_vectors.py` after cloning.
4. **Tier 1 prompts must be rebuilt** after editing curated JSON or 5etools files. Run `build_tiers.py`.
5. **Ollama endpoint** requires Bearer token (`OLLAMA_API_KEY`). Uses `nomic-embed-text:latest` for 1024-dim embeddings.
6. **Gunicorn runs 2 workers** — each loads the full vector store into memory (~125 MB per worker).
7. **No automated tests** — no test framework, no CI/CD. Test manually.
8. **No rate limiting** on the `/api/chat` endpoint.
9. **Conversation history is client-side only** (localStorage). Server is stateless.

### Campaign Data Schema
Curated JSON files follow this structure:
```json
{
  "schema_version": "1.1",
  "category": "characters",
  "entries": [{
    "id": "unique-id",
    "name": "Display Name",
    "aliases": ["Alt Name"],
    "tags": ["pc", "fighter"],
    "spoiler": false,
    "summary": "One-line description",
    "details": [{ "label": "Background", "content": "...", "spoiler": false }],
    "connections": [{ "target_id": "other", "target_name": "Other", "relationship": "...", "spoiler": true }],
    "dm_notes": "DM-only secrets"
  }]
}
```

### Frontend Chat Commands
- Type the DM passphrase → toggle DM mode
- `/rules on` / `/rules off` → toggle 5e rules emphasis
- `/yasqueen on` / `/yasqueen off` → personality vibe mode
- `/fabio on` / `/fabio off` → romance novel narrator vibe mode

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
- **Vector stores** — generated artifacts, gitignored (rebuild with `build_vectors.py`)
- **Wiki.js content** — lives in PostgreSQL, not in this repo (except article markdown files used by `publish.js`)
- **Node modules** — `publish.js` has no dependencies beyond Node stdlib
