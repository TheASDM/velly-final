---
title: CLAUDE
description:
published: false
date: 2026-05-26T00:00:00.000Z
tags:
editor: markdown
dateCreated: 2026-05-01T22:26:10.048Z
---

# CLAUDE.md - Velly-Final Project Guide

## What This Is

Vallombrosa is a Docker-deployed PWA for the Valley of Shadows campaign:

1. **Markdown wiki** - Eleventy builds the campaign pages from this repo.
2. **Home and calendar** - player-facing session status, DM messages, RSVP, and reminders.
3. **Studio** - image generation and shared gallery.
4. **Enzo** - RAG chatbot backed by the campaign corpus and 5e reference data.

The repo is the source of truth. Markdown pages, templates, app shell code, API code, and deployment config all live here.

## Services

| Service | Container | Port | Purpose |
|---|---:|---:|---|
| nginx | `dnd_nginx` | `8080:80` | Serves `_site` and proxies `/api/*` |
| Flask API | `dnd_chatbot` | `3001` internal | Enzo, image generation, push, RSVP, DM messages |

There is no separate database service. Runtime state lives in `app-data/vallombrosa.sqlite3`; generated images live in `generated-art/`.

## Data Pipeline

Enzo reads generated artifacts from `campaign-data/`:

- `build_tiers.py` builds `campaign-data/tier1.md` from published markdown and selected 5e data.
- `build_vectors.py` builds `campaign-data/vector_store.json` using the configured Ollama embedding endpoint.
- `Venturia/DM/` and pages with `published: false` are excluded from player-facing builds.

Rebuild after content changes that Enzo should know about:

```bash
python3 build_tiers.py
python3 build_vectors.py
docker compose restart chatbot
```

## Critical Files

| Path | Purpose |
|---|---|
| `_includes/layouts/page.njk` | App shell, sticky app bar, bottom tabs, shared PWA styles |
| `_includes/partials/` | Shared UI components |
| `home.md`, `calendar.md`, `enzo.md` | Root tab surfaces |
| `Tools/art.md` | Studio page |
| `pwa-client.js` | App identity, push, install helpers, RSVP wiring |
| `sw.js` | Service worker |
| `chatbot/server.py` | Flask API and RAG orchestration |
| `public/js/chatbot.js` | Enzo client UI |
| `public/css/chatbot.css` | Enzo-specific CSS |
| `docker-compose.yml` | Production compose stack |
| `nginx/conf.d/dnd-site.conf` | Static serving and `/api/*` proxy |

## Environment

Copy `.env.example` to `.env` on the VPS. Required production values:

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `OLLAMA_API_KEY` | Yes, for the current hosted endpoint | Bearer token for embeddings |
| `OPENAI_KEY` | Yes, for Studio | Image generation |
| `ADMIN_TOKEN` | Yes | DM/admin page actions |
| `VAPID_PRIVATE_KEY` | Yes, for push | Keep private on server |
| `VAPID_PUBLIC_KEY` | Yes, for push | Safe to ship to clients |

## Deployment

```bash
git pull --ff-only
docker compose up -d --build --remove-orphans
docker compose logs -f chatbot nginx
```

Local VPS checks:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/manifest.webmanifest
curl -I http://127.0.0.1:8080/sw.js
curl http://127.0.0.1:8080/health
```

## Conventions

- Keep shared PWA UI in the layout or partials, not page-local one-offs.
- Use row chips for navigable entities.
- Keep root-tab navigation in the bottom tab bar.
- Keep per-section navigation inside each tab.
- Do not expose `Venturia/DM/` content to player-facing builds or Enzo.
- Rebuild vectors after meaningful campaign content changes.
- Use `docker compose up -d --build --remove-orphans` for VPS updates so removed services are cleaned up.

## Runtime Data To Back Up

```bash
cp app-data/vallombrosa.sqlite3 "app-data/vallombrosa-$(date +%F).sqlite3"
tar -czf "generated-art-$(date +%F).tgz" generated-art/
```
