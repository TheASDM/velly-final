# Codebase Audit - Current Runtime

## Architecture

The production app is a two-service Docker stack:

```text
Caddy HTTPS
  -> nginx (dnd_nginx, host port 8080)
       -> static Eleventy PWA from _site
       -> /api/* proxy to chatbot:3001
  -> chatbot (dnd_chatbot, internal port 3001)
       -> Flask API, RAG, Studio image generation, push, RSVP, DM messages
```

Persistent runtime data:

- `app-data/vallombrosa.sqlite3`
- `generated-art/`
- `logs/`

## What Works

- Static PWA build with app shell, bottom tabs, search, Studio, Calendar, Home, and Enzo.
- Flask API proxies cleanly through nginx on the same origin.
- Enzo uses tier summaries plus vector search.
- Push subscriptions, DM messages, RSVP, and gallery persistence share one SQLite runtime database.
- Studio gallery persists outside the container.

## Remaining Risks

- Real-device push delivery still needs periodic verification after service-worker changes.
- Vector data is generated and loaded at API startup; there is no hot-reload endpoint.
- Rate limiting is still minimal; public API routes can spend model/image tokens.
- The repo still has old duplicate/untracked local files in some worktrees; do not stage them accidentally.
- Some historical helper scripts may be stale and should be reviewed before use.

## Recommended Checks Before Deploy

```bash
npm run clean && npm run build
node --check .eleventy.js
node --check pwa-client.js
node --check sw.js
node --check public/js/chatbot.js
python3 -m py_compile chatbot/server.py
git diff --check
```

## Deploy Command

```bash
docker compose up -d --build --remove-orphans
```
