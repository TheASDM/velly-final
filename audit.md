# Codebase Audit — Velly-Final

## 1. Architecture Map

### What Exists

Four Docker services behind a single `docker-compose.yml`:

```
Internet
  │
  ├─ codex.valleyofshadows.wiki ──→ Wiki.js (port 3000, container: dnd_wiki)
  │                                    └─ PostgreSQL 15 (container: dnd_postgres)
  │
  └─ loremaster.valleyofshadows.wiki ──→ nginx (port 8080, container: dnd_nginx)
                                           ├─ /           → static files (public/)
                                           ├─ /api/chat   → proxy → chatbot:3001
                                           └─ /health     → proxy → chatbot:3001
                                                               │
                                                   Flask/Gunicorn (container: dnd_chatbot)
                                                   ├─ RAG pipeline (Ollama embeddings + vector store)
                                                   ├─ Tool calling (lookup_entry)
                                                   ├─ Anthropic API (Claude)
                                                   └─ DM mode passphrase toggle
```

### Data Pipeline (Three Tiers)

```
Tier 0: Raw source data
  campaign-data/curated/*.json    — 7 files, 88 hand-authored entries
  campaign-data/5e-filtered/*.json — 34 files, ~2,876 entries (filtered from 5etools)
  campaign-data/rules/*.json       — raw 5etools dump (input to filter_5etools.py)
         │
         ├──→ build_tiers.py ──→ Tier 1: Compressed markdown system prompts
         │                        tier1_player.md  (76KB, no spoilers)
         │                        tier1_dm.md      (316KB, everything)
         │
         └──→ build_vectors.py ──→ Tier 2: Vector stores
                                   vector_store_player.json (~63MB, spoilers excluded)
                                   vector_store.json        (~62MB, everything)
```

### Per-Message Flow

1. Frontend sends `{message, conversationHistory, mode, rules, vibe}` to `/api/chat`
2. Backend checks for passphrase toggle → DM mode switch
3. Backend checks for command toggles (`/rules on`, `/yasqueen on`, `/fabio on`)
4. If regular message: embed query via Ollama → cosine similarity against vector store
5. Top 3 matches (score > 0.3) auto-injected as `[DETAILED REFERENCE]` blocks
6. Additional matches (score > 0.4) listed as `[ADDITIONAL MATCHES AVAILABLE]`
7. System prompt = mode header + personality override (if vibe) + tier1 markdown
8. Call Anthropic API with messages + RAG context + `lookup_entry` tool
9. Tool loop (max 5 iterations) if Claude calls `lookup_entry`
10. Return `{response, conversationHistory, mode, rules, vibe}`

### State

- **Conversation history**: client-side only, in `localStorage`. Sent with every request. No server-side session state.
- **Mode/rules/vibe**: client-side `localStorage`, also sent per request. Server can toggle mode/rules/vibe and return new values.
- **Vector stores + tier1 files**: loaded into memory at startup. No hot-reload.
- **Chat logs**: append-only flat file at `/app/logs/chat.log`

---

## 2. Wiki.js State

- **Version**: Wiki.js 2 (image `ghcr.io/requarks/wiki:2`)
- **Database**: PostgreSQL 15 (Alpine), credentials hardcoded in `docker-compose.yml` (`changeme_secure_password`)
- **Customizations**:
  - `files/css.css` — comprehensive dark Venetian theme override (injected via Wiki.js admin panel)
  - Custom fonts: Cinzel, IM Fell English, Crimson Text (loaded from Google Fonts)
  - CSS gotcha: `.contents p { color: var(--cr) !important }` — this is why custom HTML must use `<div>` not `<p>`
  - Page header hidden: `.page-header, .page-header-subtitle, .page-header-title { display: none !important }`
  - Chatbot widget embedded in wiki via admin panel HTML injection (loads JS/CSS from loremaster subdomain)
- **Content structure**: 5 top-level folders (Articles, Class-Changes, House-Rules, Updates, Venturia), plus Archive. Venturia has deep nesting (Creatures, Locations, Culture, College-of-the-Masquerade-Bard).
- **Permissions/authentication**: Not visible from the codebase. Wiki.js handles this internally via its admin panel. No config files in the repo.
- **DM-only page separation**: Not handled at the Wiki.js level at all. The chatbot's spoiler filtering is entirely based on `"spoiler": true/false` flags in the curated JSON files. Wiki.js pages themselves have no visible access control in this repo.
- **Publishing**: `publish.js` — scans markdown files for `date:` frontmatter, updates `home.md` with latest 3 posts, regenerates `Archive/index.md` and folder indexes, then commits and pushes.

---

## 3. Chatbot State

- **Language/Framework**: Python 3.11 / Flask + Gunicorn (2 workers, 120s timeout)
- **How it gets wiki content**: It does NOT query Wiki.js at all. It reads from static JSON files mounted at `/app/data` (the `campaign-data/` directory). These are hand-authored curated entries and pre-filtered 5etools data. The wiki and chatbot share no data pipeline.
- **AI Model**: Anthropic Claude (default: `claude-haiku-4-5-20251001`, configurable via `ANTHROPIC_MODEL` env var). Uses raw HTTP requests to the Anthropic API, not the SDK.
- **System prompt**: Mode-specific header + optional personality override (yasqueen/fabio) + full tier1 markdown (76KB player, 316KB DM). This is sent as the `system` parameter on every request.
- **RAG pipeline**:
  - Embeds query via Ollama (`nomic-embed-text:latest`, 1024 dims) at `ai.raptornet.dev/ollama`
  - Two-phase retrieval: keyword exact-match on name/alias index, then cosine similarity against full vector store
  - Skip RAG for short/casual messages (greetings, thanks, etc.)
  - When `rules=false`, vector search skips 5etools entries (keyword match still finds them)
- **Tool calling**: `lookup_entry` tool — searches curated JSON then 5etools JSON by exact name match
- **Conversation memory**: None server-side. Client sends full history with each request.
- **Hosting**: Docker container on the same server as wiki. Proxied through nginx.

---

## 4. What Works

- **Core chat flow**: Frontend → nginx → Flask → RAG → Anthropic → response. This is solid and well-structured.
- **RAG pipeline**: Two-phase retrieval (keyword + vector) is a smart design. The keyword match catches exact name references that vector search might miss or rank lower.
- **Spoiler filtering**: Properly implemented at multiple levels:
  - Tier 1 player prompt strips spoiler-flagged details, connections, and DM notes
  - Player vector store excludes spoiler entries entirely
  - `format_campaign_entry()` respects `dm_mode` flag for detail/connection filtering
- **DM mode toggle**: Passphrase-based, persisted in localStorage, switches tier1 + vector store
- **Data pipeline**: Clean separation between Tier 0 → Tier 1 → Tier 2. Build scripts are well-structured.
- **Frontend**: Clean UI, responsive, mobile-friendly, PWA support, markdown rendering, thinking indicator
- **Personality modes**: yasqueen and fabio are fun and well-implemented
- **Service worker**: Proper cache-first for static assets, network-only for API calls
- **RAG skip logic**: Smart optimization — don't waste an embedding call on "hello" or "thanks"
- **Logging**: Structured logging with timing info for debugging performance
- **CORS**: Properly handled in both nginx (OPTIONS preflight) and Flask (response headers)

---

## 5. What's Broken

### 5.1 — Embedding model mismatch between build and runtime

**`build_vectors.py`** uses `nomic-embed-text:latest` (line 410).
**`server.py`** also uses `nomic-embed-text:latest` (line 31).
**`openwebui_pipe.py`** uses `mxbai-embed-large:latest` (line 179).
**`ARCHITECTURE.md`** says `mxbai-embed-large:latest` (line 97–98).

The vector stores were built with one model but ARCHITECTURE.md documents a different one. If someone builds vectors with one model and the server queries with another, similarity scores will be garbage. The `.env.example` doesn't mention the embedding model at all.

**Verdict**: The actual running code (`build_vectors.py` + `server.py`) is consistent — both use `nomic-embed-text:latest`. But ARCHITECTURE.md is wrong, and `openwebui_pipe.py` would break if used.

### 5.2 — Docker-compose hardcodes database password

`docker-compose.yml` line 11: `POSTGRES_PASSWORD: changeme_secure_password`. This is repeated at line 33. Should reference `.env`.

### 5.3 — No input validation on conversation history

`server.py` line 825: `conversation_history = body.get("conversationHistory", [])` — this is passed directly into the Anthropic API call. A malicious client could inject arbitrary message content, including system-like instructions. The history is not validated for structure, length, or content.

### 5.4 — No rate limiting

No rate limiting anywhere — not on nginx, not in Flask. A single client could burn through the Anthropic API key by spamming requests.

### 5.5 — Gunicorn preload not used — vector stores loaded per worker

`engine.load()` is called at module level (line 870), which means each Gunicorn worker independently loads the full vector stores into memory. With 2 workers, that's ~125MB × 2 = 250MB of duplicated vector data. Should use `--preload` to share memory across workers.

### 5.6 — chatbot/index.js is dead code being shadowed

The `chatbot/` directory contains both `server.py` (active) and `index.js` (dead). The Dockerfile copies `server.py` and runs it via gunicorn. `index.js` is never used in production. But `package.json` still exists, referencing express, cors, openai, and anthropic SDKs. This is confusing and misleading.

### 5.7 — review-tool references deleted/renamed data files

`review-tool/server.js` lines 13–17 reference files that don't exist in `campaign-data/`:
- `characters.json` → exists as `curated/characters.json`
- `history.json` → doesn't exist
- `fey.json` → doesn't exist
- `vallombrosa_knowledge_base.json` → doesn't exist
- `npcs.json` → doesn't exist
- `locations.json` → exists as `curated/locations.json`
- `factions.json` → exists as `curated/factions.json`
- `sessions.json` → doesn't exist
- `items.json` → exists as `curated/` doesn't have items.json

This tool is broken. It will crash on startup trying to load files that don't exist.

### 5.8 — `chatbot.py` references wrong file paths

`chatbot.py` line 24–26: looks for `tier1_player.md` and `tier1_dm.md` in the repo root, but they're in `campaign-data/`. Would crash immediately.

### 5.9 — `chatbot.py` uses hardcoded old model

`chatbot.py` line 94: hardcodes `claude-sonnet-4-5-20250929` instead of using the configured model from `.env`.

---

## 6. What's Missing

### 6.1 — No sync between wiki content and chatbot knowledge

The chatbot reads from static JSON files. When wiki pages are updated, the chatbot doesn't know. There's no pipeline to extract wiki content into the curated JSON. Content authoring happens in two places:
1. Curated JSON files (for the chatbot)
2. Wiki.js pages (for the wiki)

These are not connected. The wiki has ~100+ markdown content pages. The curated JSON has 88 entries. They overlap but are maintained separately. Updating a character's backstory in the wiki doesn't update the chatbot's knowledge. Updating the JSON doesn't update the wiki.

### 6.2 — No error handling for Ollama embedding failures at startup

If the Ollama endpoint is down when the chatbot starts, vector stores still load but every query will fail at the embedding step. There's error handling per-request (returns `[]` matches) but no health check or startup validation.

### 6.3 — No way to reload data without restarting

If you update campaign JSON or rebuild vector stores, you must restart the chatbot container to pick up changes. No hot-reload endpoint.

### 6.4 — No favicon for chatbot images in nginx

The nginx volume only mounts `./public:/usr/share/nginx/html:ro`. The chatbot icons referenced in `chatbot.js` (e.g., `/images/loremaster192x192.png`) need to be in `public/images/`. But the icons listed in git status are in `chatbot/images/`. They won't be served.

### 6.5 — DM mode passphrase is security through obscurity

Anyone who discovers the passphrase (hardcoded default: "Prima Volta", visible in `.env.example` and `ARCHITECTURE.md`) gets full DM access including spoilers. There's no authentication. Any player who reads the docs or guesses the phrase sees everything.

### 6.6 — Conversation history grows unbounded

The full conversation history is sent with every request. There's no truncation. A long conversation will eventually exceed the Claude context window, at which point the API call will fail with a 400. The system prompt alone is 76KB (player) or 316KB (DM). With a 200K context window on Haiku, a DM-mode conversation has ~100K tokens of headroom, which is plenty — but player mode could theoretically accumulate a very long history.

### 6.7 — No content-security-policy or security headers

Nginx serves pages with no security headers. No CSP, no X-Frame-Options, no X-Content-Type-Options.

---

## 7. Dead Code

### Definitively dead — should be deleted:

| File | Reason |
|---|---|
| `chatbot/index.js` | Replaced by `server.py`. Never used by Dockerfile. |
| `chatbot/package.json` | Dependencies for dead `index.js`. |
| `chatbot.py` | Standalone terminal chatbot with wrong file paths. Superseded by the web chatbot. |
| `openwebui_pipe.py` | Alternative deployment for OpenWebUI. Uses wrong embedding model (`mxbai-embed-large` vs `nomic-embed-text`). Duplicate of all RAG logic in `server.py`. If needed, should be a thin wrapper, not a full copy. |
| `filter_5etools.py` | One-time migration script. The filtered files already exist in `5e-filtered/`. Only needed if re-filtering from raw 5etools dumps, which are in `rules/` and also committed. |
| `review-tool/` (entire directory) | Campaign data review tool that references file structures that no longer exist. Completely broken. |
| `campaign-data/curated/vallombrosa_auditor.html` | Orphaned HTML file in the curated data directory. |
| `campaign-data/rules/` (entire directory) | Raw 5etools dumps. The filtered versions in `5e-filtered/` are what's actually used. These add ~70 files of dead weight. However, they're the input to `filter_5etools.py`, so if that script is kept, these are needed. Since `filter_5etools.py` is also dead (one-time run), both can go. |
| `.githubkey` (root + Venturia/Locations/) | Two `.githubkey` files. If these contain actual keys, they're a security risk and should never be in git. |
| `files/Masquerade_Creatures.xlsx`, `files/masquerade_creatures_abilities.xlsx`, `files/masquerade_creatures_info.xlsx`, `files/masquerade_creatures_stats.txt` | Spreadsheet data files. Not referenced by any code. Likely working documents for the College of the Masquerade homebrew. |
| `public/files/ValleyofShadowsFramework.pdf` + `files/ValleyofShadowsFramework.pdf` | Same PDF in two locations. Only one is needed (the one in `public/` is served by nginx). |

### Duplicated logic across files:

The following functions are copy-pasted identically across 3 files (`server.py`, `openwebui_pipe.py`, `build_vectors.py`):
- `strip_5e_tags()` / `_5E_TAG_RE`
- `flatten_entries()`
- `cosine_similarity()`
- `format_campaign_entry()`
- `format_5etools_entry()`

If `openwebui_pipe.py` is kept, this duplication is a maintenance liability. Any fix to one copy must be replicated to the others.

---

## Summary

The core architecture is sound: a three-tier data pipeline feeding a RAG-augmented chatbot is the right approach. The frontend is clean. The system prompt design is thoughtful. The spoiler filtering works correctly.

The main problems are:
1. **Dead code everywhere** — old Node.js backend, broken review tool, standalone chatbot with wrong paths, duplicate OpenWebUI pipe
2. **Wiki and chatbot are disconnected** — no pipeline to sync wiki content into chatbot knowledge
3. **No rate limiting or input validation** — API key exposure risk
4. **ARCHITECTURE.md documents the wrong embedding model**
5. **Hardcoded database passwords in docker-compose.yml**
6. **Chatbot icons not served** — they're in `chatbot/images/` but nginx serves from `public/`
