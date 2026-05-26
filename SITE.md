# Static PWA Site

The Valley of Shadows codex is an Eleventy-built PWA. The repo's markdown is
the source of truth; Eleventy renders it into `_site/`, Pagefind builds search,
and nginx serves the result.

## What's In Place

- `.eleventy.js` computes `/en/<path>/` URLs so existing internal links keep working.
- `_includes/layouts/page.njk` owns the app shell, sticky app bar, bottom tabs, shared components, and global PWA styling.
- `_includes/partials/` contains reusable UI fragments such as RSVP controls.
- `pwa-client.js` manages app identity, push setup, install helpers, and shared client behavior.
- `chatbot/server.py` provides API routes for Enzo, Studio, push, RSVP, and DM messages.
- `docker-compose.yml` runs only the PWA/API container and nginx.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:8080/`.

## Build

```bash
npm run clean
npm run build
```

## Deploy

```bash
git pull --ff-only
docker compose up -d --build --remove-orphans
```

## Workflow

```bash
# Edit markdown pages or app code.
python3 build_sitemap.py      # only when adding/removing/renaming pages
npm run build                 # local verification
git add ...
git commit -m "..."
git push
```

For Enzo knowledge changes, also rebuild `campaign-data/tier1.md` and
`campaign-data/vector_store.json`, then restart the `chatbot` container.
