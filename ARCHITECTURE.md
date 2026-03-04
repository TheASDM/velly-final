# Vallombrosa Loremaster — Architecture & System Overview

## What This Is

A D&D 5e campaign assistant with two faces:

1. **Campaign Wiki** — Wiki.js at `codex.valleyofshadows.wiki` (port 3000)
2. **Loremaster Chatbot** — RAG-powered AI chatbot at `loremaster.valleyofshadows.wiki` (port 8080), also embeddable in the wiki

The chatbot uses a three-tier data pipeline to give Claude deep knowledge of both the homebrew Vallombrosa campaign and D&D 5e rules, with vector search for relevant context retrieval on every message.

---

## Services (Docker Compose)

```
┌─────────────────────────────────────────────────────────────┐
│  nginx (port 8080)                                          │
│  ├─ /            → static files (chatbot UI)                │
│  ├─ /api/chat    → proxy to chatbot:3001                    │
│  └─ /health      → proxy to chatbot:3001                    │
├─────────────────────────────────────────────────────────────┤
│  chatbot (port 3001) — Python/Flask + Gunicorn              │
│  ├─ RAG pipeline (embed → search → inject)                  │
│  ├─ Tool calling (lookup_entry)                             │
│  ├─ Anthropic API (Claude claude-haiku-4-5-20251001)        │
│  └─ DM mode toggle via passphrase                           │
├─────────────────────────────────────────────────────────────┤
│  wikijs (port 3000) — Wiki.js 2                             │
├─────────────────────────────────────────────────────────────┤
│  postgres — PostgreSQL 15 (Wiki.js data store)              │
└─────────────────────────────────────────────────────────────┘
```

---

## The Three-Tier Data Pipeline

Campaign knowledge is organized into three tiers that balance context depth against token cost:

### Tier 0 — Raw Source Data
The hand-authored campaign files and 5etools reference data. Not consumed directly by the chatbot.

- `campaign-data/curated/*.json` — 7 files, 88 entries (characters, locations, factions, government, lore, campaign events, house rules)
- `campaign-data/5e-filtered/*.json` — 34 usable files, ~2,876 entries (spells, monsters, items, feats, classes, races, conditions, etc.)
- `campaign-data/rules/*.json` — raw 5etools dump before filtering

**Campaign curated schema:**
```json
{
  "schema_version": "1.0",
  "category": "characters",
  "entries": [
    {
      "id": "lotan",
      "type": "player_character",
      "name": "Lotan",
      "aliases": ["Kenny", "Ken"],
      "tags": ["pc", "fighter", "warlock"],
      "spoiler": false,
      "summary": "A pirate-descended Fighter/Warlock...",
      "details": [
        { "label": "Background", "content": "...", "spoiler": false }
      ],
      "connections": [
        { "target_id": "venturia", "target_name": "Venturia", "relationship": "...", "spoiler": false }
      ],
      "dm_notes": "Secret DM-only information..."
    }
  ]
}
```

### Tier 1 — Compressed System Prompts
Markdown summaries of ALL campaign knowledge, loaded as the system prompt on every request. Built by an earlier pipeline step (not in this repo's scripts).

| File | Size | Contents |
|---|---|---|
| `campaign-data/tier1_player.md` | ~80 KB | All campaign knowledge with spoilers stripped |
| `campaign-data/tier1_dm.md` | ~308 KB | Everything including spoilers, DM notes, plot secrets |

### Tier 2 — Vector Store (RAG)
Embedded representations of every Tier 0 entry, used for semantic search. Built by `build_vectors.py`.

| File | Size | Entries | Spoilers |
|---|---|---|---|
| `campaign-data/vector_store_player.json` | ~63 MB | 2,932 | Excluded |
| `campaign-data/vector_store.json` (DM) | ~62 MB | 2,914 | Included |

Each entry in the vector store:
```json
{
  "id": "characters_lotan",
  "name": "Lotan",
  "source_file": "curated/characters.json",
  "text_hash": "a1b2c3...",
  "embedding": [0.123, -0.456, ...]  // 1024-dimensional (mxbai-embed-large)
}
```

---

## How a Chat Message Flows

```
User types "What are the resting rules?"
           │
           ▼
┌─ Frontend (chatbot.js) ────────────────────────────┐
│  POST /api/chat                                     │
│  { message, conversationHistory, mode: "player" }   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─ Backend (server.py) ──────────────────────────────┐
│                                                     │
│  1. Check for passphrase → toggle DM mode if match  │
│                                                     │
│  2. Embed query via Ollama                          │
│     POST ai.raptornet.dev/ollama/api/embeddings     │
│     → 1024-dim vector                               │
│                                                     │
│  3. Cosine similarity against vector store          │
│     → Top 3 (sim > 0.3) = auto-inject              │
│     → Next matches (sim > 0.4) = listed             │
│                                                     │
│  4. Build Anthropic API request:                    │
│     system: HEADER + tier1_player.md (80KB)         │
│     messages: [...history, user_msg + RAG context]  │
│     tools: [lookup_entry]                           │
│                                                     │
│  5. Anthropic tool loop (max 5 iterations):         │
│     If model calls lookup_entry("Fireball")         │
│       → search curated/ then 5e-filtered/           │
│       → return formatted entry                      │
│     If model calls lookup_entry again → repeat      │
│     If model returns text → done                    │
│                                                     │
│  6. Return { response, conversationHistory, mode }  │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─ Frontend ─────────────────────────────────────────┐
│  Display response, update history in localStorage   │
│  If mode changed → show/hide DM badge               │
└─────────────────────────────────────────────────────┘
```

---

## DM Mode

The chatbot defaults to **player mode** (no spoilers, filtered content). To enter DM mode:

1. Type the passphrase into the chat (default: `Prima Volta`, configurable via `DM_PASSPHRASE` env var)
2. The Loremaster responds: *"Ah... you speak the old words. The veil lifts. You now see as the Maestro sees."*
3. A gold **DM** badge appears in the header
4. All subsequent messages use DM tier1 (308KB), DM vector store (includes spoilers/DM notes)
5. Type the passphrase again to return to player mode

DM mode persists in `localStorage` across page reloads. Clearing the chat resets to player mode.

---

## Key Files

### Chatbot Backend
| File | Purpose |
|---|---|
| `chatbot/server.py` | Flask API server with RAG pipeline, Anthropic tool calling, DM mode |
| `chatbot/Dockerfile` | Python 3.11-slim + gunicorn |
| `chatbot/requirements.txt` | flask, requests, gunicorn |

### Chatbot Frontend
| File | Purpose |
|---|---|
| `public/js/chatbot.js` | Widget class, sends `{message, conversationHistory, mode}`, renders markdown, DM badge |
| `public/css/chatbot.css` | Dark Venetian theme, responsive layout |
| `public/index.html` | Standalone chatbot page |

### Data Pipeline
| File | Purpose |
|---|---|
| `build_vectors.py` | Reads Tier 0 data, embeds via Ollama, outputs vector stores. Supports caching, `--force` rebuild |
| `openwebui_pipe.py` | Alternative deployment as an OpenWebUI Pipe function (manifold: player/DM models) |

### Infrastructure
| File | Purpose |
|---|---|
| `docker-compose.yml` | 4 services: postgres, wikijs, chatbot, nginx |
| `nginx/conf.d/dnd-site.conf` | Routes `/api/chat` to chatbot, serves static files |
| `.env` | `ANTHROPIC_API_KEY`, `OLLAMA_API_KEY`, `DM_PASSPHRASE` |

### Wiki
| File | Purpose |
|---|---|
| `files/css.css` | Wiki.js theme override (injected via admin) |
| `publish.js` | Auto-updates homepage and archive index from dated article files |

---

## build_vectors.py

Rebuilds the vector stores from Tier 0 data. Run whenever campaign data or 5etools files change.

```bash
# Default: uses cache, skips unchanged entries
python3 build_vectors.py

# Force full rebuild (re-embeds everything)
python3 build_vectors.py --force

# Custom Ollama URL
python3 build_vectors.py --ollama-url https://ai.raptornet.dev/ollama --api-key $OPENWEBUI_API_KEY
```

**What it does:**
1. Reads all `campaign-data/curated/*.json` (88 entries) and `campaign-data/5e-filtered/*.json` (~2,876 entries)
2. Constructs text representations (campaign entries get name/aliases/summary/details; 5etools entries get type-specific formatting for spells, monsters, items, etc.)
3. Embeds each via Ollama (`mxbai-embed-large:latest`, 1024 dimensions)
4. Saves to `campaign-data/vector_store.json` (DM, all entries) and `campaign-data/vector_store_player.json` (spoiler entries excluded)
5. Caches by text hash — re-runs only embed entries whose text changed

**Skipped 5etools files** (not useful for chat): `makebrew-creature.json`, `monsterfeatures.json`, `magicvariants.json`, `recipes.json`, `book-xphb.json`, `charcreationoptions.json`, `cultsboons.json`, `tables.json`

---

## OpenWebUI Pipe (Alternative)

`openwebui_pipe.py` is a standalone OpenWebUI function that provides the same RAG + tool calling pipeline as a selectable model inside OpenWebUI. It exposes two models:

- **Loremaster (Player)** — player-safe, spoiler-filtered
- **Loremaster (DM)** — full access including spoilers and DM notes

To deploy: paste into OpenWebUI Admin > Functions > Add Function, configure Valves (API keys, data directory).

---

## Deployment

```bash
# Pull latest code
git pull

# Rebuild chatbot (after server.py or requirements.txt changes)
docker compose up -d --build chatbot

# Restart nginx (after CSS/JS/HTML changes)
docker compose restart nginx

# Rebuild vector stores (after campaign data changes)
python3 build_vectors.py
docker compose restart chatbot  # to reload new vector stores
```

### Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | Claude model ID |
| `OLLAMA_URL` | No | `https://ai.raptornet.dev/ollama` | Ollama embedding endpoint |
| `OLLAMA_API_KEY` | No | — | Bearer token for Ollama/OpenWebUI |
| `DM_PASSPHRASE` | No | `Prima Volta` | Passphrase to toggle DM mode |

---

## Embedding in the Wiki

The chatbot widget can be embedded in any page by loading the CSS and JS:

```html
<link rel="stylesheet" href="https://loremaster.valleyofshadows.wiki/css/chatbot.css">
<div id="chatbot-container"></div>
<script>window.LOREMASTER_API_URL = 'https://loremaster.valleyofshadows.wiki/api/chat';</script>
<script src="https://loremaster.valleyofshadows.wiki/js/chatbot.js"></script>
```

In Wiki.js, this is injected via the admin panel's custom HTML injection.
