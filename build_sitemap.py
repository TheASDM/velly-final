#!/usr/bin/env python3
"""
build_sitemap.py — walks the wiki content tree and writes images/sitemap.json
with the real frontmatter titles, for the custom nav widget (files/wiki-nav.html)
to consume.

Run on every wiki structural change (add/move/rename pages):
  python3 build_sitemap.py
  git add images/sitemap.json && git commit -m "rebuild sitemap"

The widget fetches this from https://codex.valleyofshadows.wiki/images/sitemap.json
since Wiki.js serves the images/ tree as static assets.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "images" / "sitemap.json"

# Wiki content directories whose .md files become wiki pages.
# DM/ excluded — those are unpublished campaign secrets.
WIKI_ROOTS = [
    ("Venturia",            "/en/Venturia"),
    ("Articles",            "/en/Articles"),
    ("Class-Changes",       "/en/Class-Changes"),
    ("House-Rules",         "/en/House-Rules"),
    ("Updates",             "/en/Updates"),
    ("Session-Chronicles",  "/en/Session-Chronicles"),
    ("Tools",               "/en/Tools"),
    ("Archive",             "/en/Archive"),
]
SKIP_DIR_NAMES = {"DM", "images"}


def parse_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter to extract title/published. Minimal, no pyyaml."""
    if not content.startswith("---\n"):
        return {}
    end = content.find("\n---\n", 4)
    if end == -1:
        return {}
    meta: dict = {}
    for line in content[4:end].split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        k, _, v = line.partition(":")
        v = v.strip().strip('"').strip("'")
        if v == "true":
            v = True
        elif v == "false":
            v = False
        meta[k.strip()] = v
    return meta


def slugify_title(slug: str) -> str:
    """Fallback title when no frontmatter title is present."""
    s = slug.replace("-", " ")
    return s[:1].upper() + s[1:]


def walk(root_dir: Path, url_prefix: str) -> list[dict]:
    entries: list[dict] = []
    for path in sorted(root_dir.rglob("*.md")):
        parts = path.relative_to(root_dir).parts
        # Skip excluded subtrees
        if any(p in SKIP_DIR_NAMES for p in parts):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  WARN: couldn't read {path}: {e}", file=sys.stderr)
            continue
        meta = parse_frontmatter(content)
        if meta.get("published") is False:
            continue
        slug = path.stem
        rel_url = f"{url_prefix}/{'/'.join(parts[:-1] + (slug,))}".replace("//", "/")
        title = (
            meta.get("title")
            or _first_h1(content)
            or slugify_title(slug)
        )
        entries.append({"url": rel_url, "title": title})
    return entries


def _first_h1(content: str) -> str | None:
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return None


def main():
    all_entries: list[dict] = []
    for dirname, url_prefix in WIKI_ROOTS:
        d = ROOT / dirname
        if not d.exists():
            continue
        all_entries.extend(walk(d, url_prefix))

    # Add home if present
    home = ROOT / "home.md"
    if home.exists():
        meta = parse_frontmatter(home.read_text(encoding="utf-8"))
        if meta.get("published") is not False:
            all_entries.append({
                "url": "/",
                "title": meta.get("title") or "Home",
            })

    # Sort by URL for stable output
    all_entries.sort(key=lambda e: e["url"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(all_entries, indent=2, ensure_ascii=False))
    print(f"  → {OUT.relative_to(ROOT)}  ({len(all_entries)} pages)")


if __name__ == "__main__":
    main()
