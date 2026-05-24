---
title: Venturia — Quadrants (Deep Detail)
description: Four ultra-high-resolution tiles of Venturia — NW, NE, SW, SE — stitched into a single zoomable viewer. Pan between them as one map.
published: true
date: 2026-05-24T00:00:00.000Z
tags: maps, venturia, deep-zoom, reference
editor: markdown
dateCreated: 2026-05-24T00:00:00.000Z
---

# Venturia — Quadrants (Deep Detail)

Four ultra-high-resolution tiles arranged as a single continuous map. Pan freely between the quadrants — the viewer stitches them together — and zoom in to see signage, individual buildings, and the small details the compressed maps don't preserve.

<div style="background: rgba(212,165,116,0.06); border-left: 3px solid rgba(212,165,116,0.5); padding: 0.85rem 1.1rem; margin: 1rem 0 1.5rem; font-style: italic; color: rgba(232,220,200,0.85); font-family: 'Crimson Text', Georgia, serif;">
Heads up — each quadrant is ~90 MB. The viewer loads tiles on demand, but a full pan across all four will eventually pull all 360 MB. On a slow connection, prefer the <a href="/en/Venturia/Maps/venturia-official/">compressed official map</a> for casual browsing.
</div>

{% set map = {
  slug: "venturia-quadrants",
  caption: "Pan freely — NW, NE, SW, SE arranged 2×2. Zoom for sign-readable detail.",
  tall: true,
  mosaic: [
    "/images/maps/nw.png",
    "/images/maps/ne.png",
    "/images/maps/sw.png",
    "/images/maps/se.png"
  ],
  mosaicRows: 2
} %}
{% include "partials/map-viewer.njk" %}

---

## Quadrant reference

| Quadrant | Original | Coverage |
|----------|----------|----------|
| **Northwest** | [nw.png](/images/maps/nw.png) | Upper-left tile |
| **Northeast** | [ne.png](/images/maps/ne.png) | Upper-right tile |
| **Southwest** | [sw.png](/images/maps/sw.png) | Lower-left tile |
| **Southeast** | [se.png](/images/maps/se.png) | Lower-right tile |
