#!/usr/bin/env python3
"""
build_vectors.py — Step 2: Vector Store Builder

Reads Tier 2 JSON files (campaign-data/curated/ + campaign-data/5e-filtered/),
embeds them via Ollama (mxbai-embed-large:latest), and writes vector_store.json
and vector_store_player.json.

Usage:
    python build_vectors.py
    python build_vectors.py --mode player
    python build_vectors.py --force --batch-size 5
    python build_vectors.py --ollama-url http://localhost:11434
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import requests

# ── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "campaign-data"
CURATED_DIR = DATA_DIR / "curated"
RULES_DIR = DATA_DIR / "5e-filtered"
OUTPUT_DM = DATA_DIR / "vector_store.json"
OUTPUT_PLAYER = DATA_DIR / "vector_store_player.json"

# ── 5etools tag stripping ────────────────────────────────────────────────────

# Matches {@tag content|source|display} → extracts display or content
_5E_TAG_RE = re.compile(r"\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}")


def strip_5e_tags(text: str) -> str:
    """Strip 5etools {@tag ...} markup, keeping the human-readable part."""
    if not isinstance(text, str):
        return str(text)
    return _5E_TAG_RE.sub(r"\1", text)


# ── 5etools recursive entry flattener ────────────────────────────────────────


def flatten_entries(entries, depth: int = 0) -> str:
    """Recursively flatten 5etools 'entries' arrays into plain text."""
    if entries is None:
        return ""
    if isinstance(entries, str):
        return strip_5e_tags(entries)
    if isinstance(entries, dict):
        return _flatten_entry_object(entries, depth)
    if isinstance(entries, list):
        parts = []
        for item in entries:
            text = flatten_entries(item, depth)
            if text:
                parts.append(text)
        return " ".join(parts)
    return str(entries)


def _flatten_entry_object(obj: dict, depth: int) -> str:
    """Handle a single 5etools entry object."""
    parts = []
    entry_type = obj.get("type", "")

    # Named section header
    name = obj.get("name", "")
    if name:
        parts.append(f"{strip_5e_tags(name)}.")

    # Content fields in priority order
    if "entries" in obj:
        parts.append(flatten_entries(obj["entries"], depth + 1))
    if "headerEntries" in obj:
        parts.append(flatten_entries(obj["headerEntries"], depth + 1))
    if "items" in obj and isinstance(obj["items"], list):
        for item in obj["items"]:
            parts.append(flatten_entries(item, depth + 1))

    # Table rows
    if entry_type == "table":
        cols = obj.get("colLabels", [])
        if cols:
            parts.append("Columns: " + ", ".join(strip_5e_tags(c) for c in cols) + ".")
        for row in obj.get("rows", []):
            if isinstance(row, list):
                parts.append(
                    " | ".join(strip_5e_tags(str(cell)) for cell in row)
                )

    # Inline entries
    if "entry" in obj:
        parts.append(flatten_entries(obj["entry"], depth + 1))

    return " ".join(p for p in parts if p)


# ── Campaign lore text construction ──────────────────────────────────────────


def campaign_entry_text(entry: dict, include_spoilers: bool = True) -> str:
    """Build embeddable text for a campaign curated entry."""
    parts = []

    name = entry.get("name", "")
    parts.append(f"{name}.")

    aliases = entry.get("aliases", [])
    if aliases:
        parts.append(f"Also known as: {', '.join(aliases)}.")

    tags = entry.get("tags", [])
    if tags:
        parts.append(f"Tags: {', '.join(tags)}.")

    summary = entry.get("summary", "")
    if summary:
        parts.append(summary)

    for detail in entry.get("details", []):
        if not include_spoilers and detail.get("spoiler"):
            continue
        label = detail.get("label", "")
        content = detail.get("content", "")
        if label and content:
            parts.append(f"{label}: {content}")
        elif content:
            parts.append(content)

    for conn in entry.get("connections", []):
        if not include_spoilers and conn.get("spoiler"):
            continue
        target = conn.get("target_name", "")
        rel = conn.get("relationship", "")
        if target and rel:
            parts.append(f"Connection to {target}: {rel}")

    if include_spoilers:
        dm_notes = entry.get("dm_notes", "")
        if dm_notes:
            parts.append(f"DM Notes: {dm_notes}")

    return " ".join(parts)


# ── 5etools entry text construction ──────────────────────────────────────────


def _monster_text(entry: dict) -> str:
    """Build text for a bestiary monster entry."""
    parts = [f"{entry['name']}."]

    if "type" in entry:
        t = entry["type"]
        type_str = t if isinstance(t, str) else t.get("type", str(t))
        parts.append(f"Type: {type_str}.")

    size = entry.get("size", [])
    if size:
        size_map = {"T": "Tiny", "S": "Small", "M": "Medium", "L": "Large",
                     "H": "Huge", "G": "Gargantuan"}
        parts.append("Size: " + ", ".join(size_map.get(s, s) for s in size) + ".")

    if "cr" in entry:
        cr = entry["cr"]
        cr_str = str(cr) if not isinstance(cr, dict) else cr.get("cr", str(cr))
        parts.append(f"CR {cr_str}.")

    for stat in ("str", "dex", "con", "int", "wis", "cha"):
        val = entry.get(stat)
        if val is not None:
            parts.append(f"{stat.upper()} {val}")

    hp = entry.get("hp", {})
    if isinstance(hp, dict) and "average" in hp:
        parts.append(f"HP {hp['average']}.")

    ac = entry.get("ac", [])
    if ac:
        ac_val = ac[0] if isinstance(ac[0], int) else ac[0].get("ac", ac[0])
        parts.append(f"AC {ac_val}.")

    speed = entry.get("speed", {})
    if isinstance(speed, dict):
        speed_parts = []
        for k, v in speed.items():
            speed_parts.append(f"{k} {v}" if k != "walk" else str(v))
        if speed_parts:
            parts.append(f"Speed: {', '.join(speed_parts)}.")

    langs = entry.get("languages", [])
    if langs:
        parts.append(f"Languages: {', '.join(langs)}.")

    # Actions, spellcasting, traits
    for section_key in ("trait", "action", "reaction", "legendary", "bonus",
                         "spellcasting", "mythic"):
        section = entry.get(section_key, [])
        if isinstance(section, list):
            for item in section:
                if isinstance(item, dict):
                    n = item.get("name", "")
                    e = flatten_entries(item.get("entries", []))
                    he = flatten_entries(item.get("headerEntries", []))
                    text = f"{n}: {he} {e}".strip() if n else f"{he} {e}".strip()
                    if text:
                        parts.append(text)

    return " ".join(parts)


def _spell_text(entry: dict) -> str:
    """Build text for a spell entry."""
    parts = [f"{entry['name']}."]

    level = entry.get("level", 0)
    school_map = {"A": "Abjuration", "C": "Conjuration", "D": "Divination",
                  "E": "Enchantment", "V": "Evocation", "I": "Illusion",
                  "N": "Necromancy", "T": "Transmutation"}
    school = school_map.get(entry.get("school", ""), entry.get("school", ""))
    if level == 0:
        parts.append(f"{school} cantrip.")
    else:
        parts.append(f"Level {level} {school}.")

    time_list = entry.get("time", [])
    if time_list:
        t = time_list[0]
        if isinstance(t, dict):
            parts.append(f"Casting time: {t.get('number', '')} {t.get('unit', '')}.")

    rng = entry.get("range", {})
    if isinstance(rng, dict):
        dist = rng.get("distance", {})
        if isinstance(dist, dict):
            amt = dist.get("amount", "")
            unit = dist.get("type", "")
            parts.append(f"Range: {amt} {unit}.".strip())

    comps = entry.get("components", {})
    if isinstance(comps, dict):
        comp_parts = []
        if comps.get("v"):
            comp_parts.append("V")
        if comps.get("s"):
            comp_parts.append("S")
        if comps.get("m"):
            m = comps["m"]
            mat_text = m if isinstance(m, str) else m.get("text", str(m))
            comp_parts.append(f"M ({strip_5e_tags(mat_text)})")
        parts.append(f"Components: {', '.join(comp_parts)}.")

    dur = entry.get("duration", [])
    if dur:
        d = dur[0]
        if isinstance(d, dict):
            dtype = d.get("type", "")
            if dtype == "instant":
                parts.append("Duration: Instantaneous.")
            elif dtype == "timed":
                amt = d.get("duration", {}).get("amount", "")
                unit = d.get("duration", {}).get("type", "")
                conc = "Concentration, " if d.get("concentration") else ""
                parts.append(f"Duration: {conc}{amt} {unit}.")

    entries = flatten_entries(entry.get("entries", []))
    if entries:
        parts.append(entries)

    higher = flatten_entries(entry.get("entriesHigherLevel", []))
    if higher:
        parts.append(f"At higher levels: {higher}")

    return " ".join(parts)


def _class_text(entry: dict, category_key: str) -> str:
    """Build text for class, subclass, classFeature, subclassFeature."""
    parts = [f"{entry['name']}."]

    cls = entry.get("className", "")
    if cls:
        parts.append(f"Class: {cls}.")

    subcls = entry.get("subclassShortName", "")
    if subcls:
        parts.append(f"Subclass: {subcls}.")

    level = entry.get("level")
    if level:
        parts.append(f"Level: {level}.")

    # Class-specific fields
    if category_key == "class":
        hd = entry.get("hd", {})
        if isinstance(hd, dict):
            parts.append(f"Hit Die: d{hd.get('faces', '?')}.")
        profs = entry.get("startingProficiencies", {})
        armor = profs.get("armor", [])
        if armor:
            parts.append(f"Armor proficiencies: {', '.join(str(a) for a in armor)}.")
        weapons = profs.get("weapons", [])
        if weapons:
            parts.append(f"Weapon proficiencies: {', '.join(str(w) for w in weapons)}.")

    entries = flatten_entries(entry.get("entries", []))
    if entries:
        parts.append(entries)

    return " ".join(parts)


def _item_text(entry: dict) -> str:
    """Build text for an item entry."""
    parts = [f"{entry['name']}."]

    rarity = entry.get("rarity", "")
    if rarity and rarity != "none":
        parts.append(f"Rarity: {rarity}.")

    item_type = entry.get("type", "")
    if item_type:
        parts.append(f"Type: {item_type}.")

    weight = entry.get("weight")
    if weight:
        parts.append(f"Weight: {weight} lb.")

    if entry.get("reqAttune"):
        parts.append("Requires attunement.")

    entries = flatten_entries(entry.get("entries", []))
    if entries:
        parts.append(entries)

    return " ".join(parts)


def _generic_text(entry: dict) -> str:
    """Fallback text for any 5etools entry with a name."""
    parts = [f"{entry['name']}."]
    entries = flatten_entries(entry.get("entries", []))
    if entries:
        parts.append(entries)
    return " ".join(parts)


def fivetools_entry_text(entry: dict, category_key: str, filename: str) -> str:
    """Build embeddable text for a 5etools entry based on its type."""
    if "name" not in entry:
        return ""

    if "bestiary" in filename:
        return _monster_text(entry)
    if "spell" in filename:
        return _spell_text(entry)
    if filename.startswith("class-") or category_key in ("class", "subclass",
                                                          "classFeature",
                                                          "subclassFeature"):
        return _class_text(entry, category_key)
    if filename in ("items.json", "items-base.json") or category_key in ("item", "itemGroup"):
        return _item_text(entry)

    return _generic_text(entry)


# ── Entry ID generation ──────────────────────────────────────────────────────


def make_entry_id(entry: dict, category_key: str, filename: str, index: int) -> str:
    """Generate a stable unique ID for a 5etools entry."""
    name = entry.get("name", f"entry_{index}")
    source = entry.get("source", "")
    # For class features, include class and level to avoid collisions
    cls = entry.get("className", "")
    subcls = entry.get("subclassShortName", "")
    level = entry.get("level", "")

    parts = [filename.replace(".json", ""), category_key, name]
    if cls:
        parts.append(cls)
    if subcls:
        parts.append(subcls)
    if level:
        parts.append(str(level))
    if source:
        parts.append(source)
    # Always include index to guarantee uniqueness
    parts.append(str(index))

    raw = "_".join(parts)
    return re.sub(r"[^a-zA-Z0-9_-]", "_", raw).lower()


# ── Embedding ────────────────────────────────────────────────────────────────


def embed_text(text: str, ollama_url: str, api_key: str = "") -> Optional[list]:
    """Call Ollama /api/embeddings and return the embedding vector."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        resp = requests.post(
            f"{ollama_url}/api/embeddings",
            json={"model": "mxbai-embed-large:latest", "prompt": text},
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("embedding")
    except Exception as e:
        print(f"  [ERROR] Embedding failed: {e}", file=sys.stderr)
        return None


# ── Loading ──────────────────────────────────────────────────────────────────


def load_campaign_entries() -> list[dict]:
    """Load all campaign curated entries with text representations."""
    entries = []
    for fpath in sorted(CURATED_DIR.glob("*.json")):
        category = fpath.stem  # e.g. "characters", "locations"
        with open(fpath) as f:
            data = json.load(f)
        for entry in data.get("entries", []):
            raw_id = entry.get("id", entry.get("name", "").lower().replace(" ", "_"))
            # Prefix with category to avoid cross-file ID collisions
            entry_id = f"{category}_{raw_id}"
            text_dm = campaign_entry_text(entry, include_spoilers=True)
            text_player = campaign_entry_text(entry, include_spoilers=False)
            spoiler = entry.get("spoiler", False)

            entries.append({
                "id": entry_id,
                "name": entry.get("name", ""),
                "source_file": f"curated/{fpath.name}",
                "text": text_dm,
                "text_player": text_player,
                "spoiler": spoiler,
                "is_campaign": True,
            })
    return entries


def load_5etools_entries() -> list[dict]:
    """Load all 5etools entries with text representations."""
    entries = []

    # Files to skip — not useful for embedding
    skip_files = {"makebrew-creature.json", "monsterfeatures.json",
                  "magicvariants.json", "recipes.json", "book-xphb.json",
                  "charcreationoptions.json", "cultsboons.json", "tables.json"}

    for fpath in sorted(RULES_DIR.glob("*.json")):
        if fpath.name in skip_files:
            continue

        with open(fpath) as f:
            data = json.load(f)

        for key, value in data.items():
            if key.startswith("_"):
                continue
            if not isinstance(value, list):
                continue

            for i, entry in enumerate(value):
                if not isinstance(entry, dict):
                    continue
                if "name" not in entry:
                    continue

                text = fivetools_entry_text(entry, key, fpath.name)
                if not text or len(text) < 20:
                    continue

                entry_id = make_entry_id(entry, key, fpath.name, i)

                entries.append({
                    "id": entry_id,
                    "name": entry.get("name", ""),
                    "source_file": f"5e-filtered/{fpath.name}",
                    "text": text,
                    "text_player": text,  # 5etools entries are never spoilers
                    "spoiler": False,
                    "is_campaign": False,
                })

    return entries


# ── Vector store I/O ─────────────────────────────────────────────────────────


def load_existing_store(path: Path) -> dict[str, dict]:
    """Load existing vector store as {id: entry_dict}."""
    if not path.exists():
        return {}
    with open(path) as f:
        data = json.load(f)
    return {e["id"]: e for e in data}


def text_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


# ── Progress helper ──────────────────────────────────────────────────────────

try:
    from tqdm import tqdm

    def progress_iter(iterable, total, desc=""):
        return tqdm(iterable, total=total, desc=desc, ncols=80)

except ImportError:

    def progress_iter(iterable, total, desc=""):
        count = 0
        for item in iterable:
            count += 1
            if count % 50 == 0 or count == total:
                print(f"  {desc}: {count}/{total}", flush=True)
            yield item


# ── Main build ───────────────────────────────────────────────────────────────


def build_store(
    entries: list[dict],
    output_path: Path,
    ollama_url: str,
    api_key: str = "",
    force: bool = False,
    text_key: str = "text",
) -> None:
    """Build or update the vector store for a list of entries."""
    start = time.time()

    existing = {} if force else load_existing_store(output_path)
    existing_ids = set(existing.keys())
    new_ids = {e["id"] for e in entries}

    # Classify entries
    cached = 0
    to_embed = []
    results = []

    for entry in entries:
        eid = entry["id"]
        h = text_hash(entry[text_key])
        old = existing.get(eid)

        if old and old.get("text_hash") == h and old.get("embedding"):
            # Cached — keep existing embedding
            results.append({
                "id": eid,
                "name": entry["name"],
                "source_file": entry["source_file"],
                "text": entry[text_key],
                "embedding": old["embedding"],
                "spoiler": entry["spoiler"],
                "text_hash": h,
            })
            cached += 1
        else:
            to_embed.append((entry, h))

    deleted = existing_ids - new_ids
    new_count = sum(1 for e, _ in to_embed if e["id"] not in existing_ids)
    updated_count = len(to_embed) - new_count

    print(f"\n{'=' * 60}")
    print(f"Building: {output_path.name}")
    print(f"  Total entries: {len(entries)}")
    print(f"  Cached:        {cached}")
    print(f"  New:           {new_count}")
    print(f"  Re-embed:      {updated_count}")
    print(f"  Deleted:       {len(deleted)}")
    print(f"{'=' * 60}\n")

    # Embed new/changed entries
    failed = 0
    for entry, h in progress_iter(to_embed, len(to_embed), desc="Embedding"):
        embedding = embed_text(entry[text_key], ollama_url, api_key)
        if embedding is None:
            failed += 1
            continue
        results.append({
            "id": entry["id"],
            "name": entry["name"],
            "source_file": entry["source_file"],
            "text": entry[text_key],
            "embedding": embedding,
            "spoiler": entry["spoiler"],
            "text_hash": h,
        })

    # Sort by id for stable output
    results.sort(key=lambda x: x["id"])

    with open(output_path, "w") as f:
        json.dump(results, f, separators=(",", ":"))

    elapsed = time.time() - start
    print(f"\n  {len(results)} entries: {cached} cached, {new_count} new, "
          f"{updated_count} re-embedded, {len(deleted)} removed "
          f"({failed} failed) ({elapsed:.1f}s)")
    print(f"  Saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Build vector store for D&D chatbot")
    parser.add_argument("--ollama-url", default="https://ai.raptornet.dev/ollama",
                        help="Ollama server URL (include /ollama for OpenWebUI proxy)")
    parser.add_argument("--api-key", default=os.environ.get("OPENWEBUI_API_KEY", ""),
                        help="Bearer token for Ollama (default: $OPENWEBUI_API_KEY)")
    parser.add_argument("--mode", choices=["player", "dm", "both"], default="both",
                        help="Which store to build")
    parser.add_argument("--batch-size", type=int, default=1,
                        help="Entries per sequential batch (unused — sequential by default)")
    parser.add_argument("--force", action="store_true",
                        help="Ignore cache and re-embed everything")
    args = parser.parse_args()

    # Try loading from .env if no key found
    if not args.api_key:
        env_file = BASE_DIR / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("OPENWEBUI_API_KEY="):
                    args.api_key = line.split("=", 1)[1].strip().strip("'\"")
                    break

    print("Loading entries...")
    campaign = load_campaign_entries()
    rules = load_5etools_entries()
    all_entries = campaign + rules
    print(f"  Campaign: {len(campaign)} entries")
    print(f"  5etools:  {len(rules)} entries")
    print(f"  Total:    {len(all_entries)} entries")

    # Quick connectivity check
    print(f"\nChecking Ollama at {args.ollama_url}...")
    headers = {"Content-Type": "application/json"}
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"
        print("  Using Bearer token authentication")
    try:
        test = requests.post(
            f"{args.ollama_url}/api/embeddings",
            json={"model": "mxbai-embed-large:latest", "prompt": "test"},
            headers=headers,
            timeout=10,
        )
        test.raise_for_status()
        dim = len(test.json().get("embedding", []))
        print(f"  OK — embedding dimension: {dim}")
    except Exception as e:
        print(f"  FAILED: {e}", file=sys.stderr)
        print("  Cannot proceed without Ollama. Exiting.", file=sys.stderr)
        sys.exit(1)

    if args.mode in ("dm", "both"):
        build_store(
            all_entries,
            OUTPUT_DM,
            args.ollama_url,
            api_key=args.api_key,
            force=args.force,
            text_key="text",
        )

    if args.mode in ("player", "both"):
        # Player store: exclude entries where spoiler is True
        player_entries = [e for e in all_entries if not e["spoiler"]]
        build_store(
            player_entries,
            OUTPUT_PLAYER,
            args.ollama_url,
            api_key=args.api_key,
            force=args.force,
            text_key="text_player",
        )

    print("\nDone!")


if __name__ == "__main__":
    main()
