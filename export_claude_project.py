#!/usr/bin/env python3
"""
Export Enzo's knowledge corpus as markdown files for a claude.ai Project.

Reuses the exact text extraction from build_vectors.py (wiki pages +
filtered 5etools JSON) so the Project knowledge matches what Enzo
retrieves, but skips embedding entirely — Claude Projects do their own
retrieval over uploaded documents.

Usage:
    python3 export_claude_project.py         # player-safe corpus
    python3 export_claude_project.py --dm    # also export campaign-dm-secrets.md

Writes upload-ready files to claude-project-export/.
"""

from __future__ import annotations

import argparse
from collections import OrderedDict
from pathlib import Path

from build_vectors import (load_wiki_entries, load_5etools_entries,
                           parse_frontmatter, wiki_page_text)

BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "claude-project-export"
DM_DIR = BASE_DIR / "Venturia" / "DM"

# source_file prefix → output bundle. First match wins.
WIKI_BUNDLES = [
    ("Venturia/Characters/", "campaign-characters.md", "Campaign Characters (PCs & NPCs)"),
    ("Venturia/Locations/",  "campaign-world.md",      "Campaign World (Locations, Factions, Government, Items)"),
    ("Venturia/Factions/",   "campaign-world.md",      None),
    ("Venturia/Government/", "campaign-world.md",      None),
    ("Venturia/Items/",      "campaign-world.md",      None),
    ("Venturia/Lore/",       "campaign-lore.md",       "Campaign Lore & History"),
    ("Articles/",            "campaign-articles.md",   "Campaign Articles & Session Updates"),
    ("Updates/",             "campaign-articles.md",   None),
    ("House-Rules/",         "house-rules.md",         "House Rules & Class Changes"),
    ("Class-Changes/",       "house-rules.md",         None),
]

FIVETOOLS_BUNDLES = [
    ("5e-filtered/spells-",       "5e-spells.md",            "5e Spells"),
    ("5e-filtered/bestiary-",     "5e-monsters.md",          "5e Monsters"),
    ("5e-filtered/items",         "5e-items.md",             "5e Items & Equipment"),
    ("5e-filtered/decks",         "5e-items.md",             None),
    ("5e-filtered/loot",          "5e-items.md",             None),
    ("5e-filtered/class-",        "5e-classes.md",           "5e Classes & Subclasses"),
    ("5e-filtered/feats",         "5e-character-options.md", "5e Character Options (Feats, Races, Backgrounds)"),
    ("5e-filtered/races",         "5e-character-options.md", None),
    ("5e-filtered/backgrounds",   "5e-character-options.md", None),
    ("5e-filtered/optionalfeatures", "5e-character-options.md", None),
    ("5e-filtered/languages",     "5e-character-options.md", None),
    # everything else (actions, conditions, senses, skills, variantrules,
    # trapshazards, objects, deities, bastions) falls through to the catch-all
]
FIVETOOLS_CATCHALL = ("5e-rules-reference.md", "5e Rules Reference (Actions, Conditions, Variant Rules, etc.)")


def rejoin_pages(entries: list[dict]) -> "OrderedDict[str, dict]":
    """Merge chunked entries back into whole pages, preserving order."""
    pages: OrderedDict[str, dict] = OrderedDict()
    for e in entries:
        pid = e["page_id"]
        if pid not in pages:
            pages[pid] = {"name": e["name"], "source_file": e["source_file"],
                          "parts": {}}
        pages[pid]["parts"][e["chunk_index"]] = e["text"]
    for p in pages.values():
        p["text"] = "\n".join(p["parts"][i] for i in sorted(p["parts"]))
    return pages


def bundle_for(source_file: str, bundles, catchall=None):
    for prefix, fname, title in bundles:
        if source_file.startswith(prefix):
            return fname
    if catchall:
        return catchall[0]
    return None


def load_dm_pages() -> list[str]:
    """Read Venturia/DM/ pages (including published: false) as plain text.
    Not part of Enzo's corpus — only exported with --dm."""
    sections = []
    for fpath in sorted(DM_DIR.glob("*.md")):
        if fpath.stem == "index":
            continue
        meta, body = parse_frontmatter(fpath.read_text(encoding="utf-8"))
        text = wiki_page_text(meta, body)
        if text and len(text) >= 20:
            sections.append(text)
    return sections


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dm", action="store_true",
                        help="also export DM-only content (campaign-dm-secrets.md)")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)

    titles = {fname: title for _, fname, title in WIKI_BUNDLES + FIVETOOLS_BUNDLES if title}
    titles[FIVETOOLS_CATCHALL[0]] = FIVETOOLS_CATCHALL[1]
    files: OrderedDict[str, list[str]] = OrderedDict()

    wiki_pages = rejoin_pages(load_wiki_entries())
    for page in wiki_pages.values():
        fname = bundle_for(page["source_file"], WIKI_BUNDLES)
        if fname is None:
            fname = "campaign-articles.md"  # any unmapped wiki dir
        files.setdefault(fname, []).append(page["text"])

    rules_pages = rejoin_pages(load_5etools_entries())
    for page in rules_pages.values():
        fname = bundle_for(page["source_file"], FIVETOOLS_BUNDLES, FIVETOOLS_CATCHALL)
        files.setdefault(fname, []).append(page["text"])

    if args.dm:
        titles["campaign-dm-secrets.md"] = "DM Secrets (SPOILERS — never share with players)"
        files["campaign-dm-secrets.md"] = load_dm_pages()

    for fname, sections in files.items():
        title = titles.get(fname, fname)
        body = f"# {title}\n\n" + "\n\n---\n\n".join(sections) + "\n"
        out = OUT_DIR / fname
        out.write_text(body, encoding="utf-8")
        print(f"  {fname:32s} {len(sections):5d} entries  {out.stat().st_size/1024:8.1f} KB")

    print(f"\nWrote {len(files)} files to {OUT_DIR}/")


if __name__ == "__main__":
    main()
