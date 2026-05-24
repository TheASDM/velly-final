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

Four high-resolution tiles arranged as a single continuous map. Pan freely between the quadrants — the viewer stitches them together — and zoom in to see signage, individual buildings, and the small details the compressed full-city maps don't preserve.

{% set map = {
  slug: "venturia-quadrants",
  caption: "Pan freely — NW, NE, SW, SE arranged 2×2. Zoom for sign-readable detail.",
  tall: true,
  mosaic: [
    "/images/maps/nw.jpg",
    "/images/maps/ne.jpg",
    "/images/maps/sw.jpg",
    "/images/maps/se.jpg"
  ],
  mosaicRows: 2
} %}
{% include "partials/map-viewer.njk" %}

---

## Quadrant reference

| Quadrant | Source | Coverage |
|----------|--------|----------|
| **Northwest** | [nw.jpg](/images/maps/nw.jpg) | Upper-left tile |
| **Northeast** | [ne.jpg](/images/maps/ne.jpg) | Upper-right tile |
| **Southwest** | [sw.jpg](/images/maps/sw.jpg) | Lower-left tile |
| **Southeast** | [se.jpg](/images/maps/se.jpg) | Lower-right tile |
