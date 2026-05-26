---
title: ARCHITECTURE
description:
published: false
date: 2026-05-26T00:00:00.000Z
tags:
editor: markdown
dateCreated: 2026-03-04T04:23:30.551Z
---

# Vallombrosa PWA - Architecture

## Runtime Shape

```text
Internet
  |
  v
Caddy HTTPS
  |
  v
nginx container (dnd_nginx, host port 8080)
  |-- /                 -> Eleventy static PWA in /site/_site
  |-- /manifest.webmanifest
  |-- /sw.js
  |-- /api/*            -> chatbot:3001
  `-- /health           -> chatbot:3001

chatbot container (dnd_chatbot, internal port 3001)
  |-- Enzo chat and RAG
  |-- Studio image generation
  |-- shared gallery manifest/images
  |-- push subscriptions and DM messages
  `-- RSVP storage
```

Runtime persistence:

| Host path | Purpose |
|---|---|
| `app-data/vallombrosa.sqlite3` | Push subscriptions, DM messages, RSVP state |
| `generated-art/` | Studio gallery images and manifest |
| `logs/` | API logs |

## Build Pipeline

Eleventy reads markdown pages directly from the repo and writes `_site/`.
Pagefind indexes `_site/` for client-side search.

```bash
npm run build
```

The Docker image runs the Eleventy build during container startup so nginx can serve the latest `_site`.

## Enzo Knowledge Pipeline

```text
Markdown pages + selected 5e data
  |
  |-- build_tiers.py    -> campaign-data/tier1.md
  `-- build_vectors.py  -> campaign-data/vector_store.json

chatbot/server.py loads both artifacts at startup.
```

Excluded from player-facing knowledge:

- `Venturia/DM/`
- pages with `published: false`

## Request Flow

1. Client sends a chat message to `/api/chat`.
2. Flask embeds the query with Ollama.
3. Flask retrieves relevant vector matches and exact name/alias matches.
4. Flask sends the prompt, RAG context, and tool definitions to Anthropic.
5. The model may call `lookup_entry` for precise campaign or 5e entries.
6. Flask returns the answer to the PWA.

Other API routes handle gallery generation, push subscription state, DM messages, and RSVP.

## Deployment

```bash
git pull --ff-only
docker compose up -d --build --remove-orphans
```

The compose file has two services: `chatbot` and `nginx`.

## Security Boundaries

- Public HTTPS terminates at Caddy.
- Flask is only reachable through nginx inside the Docker network.
- Admin actions require `ADMIN_TOKEN`.
- Web Push requires VAPID keys.
- DM-only markdown is excluded from player builds and Enzo indexing.

## Operational Checks

```bash
docker compose ps
curl -fsS http://127.0.0.1:8080/health
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/sw.js
curl -I http://127.0.0.1:8080/manifest.webmanifest
```
