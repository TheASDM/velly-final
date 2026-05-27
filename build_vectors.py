#!/usr/bin/env python3
"""
build_vectors.py — Step 2: Vector Store Builder

Reads wiki markdown (the source of truth for campaign content) plus the
filtered 5etools JSON, embeds entries via Ollama (nomic-embed-text:latest), and
writes a single campaign-data/vector_store.json.

Usage:
    python build_vectors.py
    python build_vectors.py --force
    python build_vectors.py --ollama-url http://localhost:11434

Player-only — there's no DM mode anymore. DM content (Venturia/DM/, any
`published: false` page) is excluded.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

# ── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).resolve().parent
WIKI_ROOT    = BASE_DIR
RULES_DIR    = BASE_DIR / "campaign-data" / "5e-filtered"
OUTPUT_PATH  = BASE_DIR / "campaign-data" / "vector_store.json"

# Wiki content directories included for embedding (DM/ excluded by omission).
WIKI_DIRS = [
    "Venturia/Characters/PCs",
    "Venturia/Characters/NPCs",
    "Venturia/Locations",
    "Venturia/Items",
    "Venturia/Factions",
    "Venturia/Government",
    "Venturia/Lore",
    "Articles",
    "Class-Changes",
    "House-Rules",
    "Updates",
]

# ── Frontmatter parser (shared format with build_tiers.py) ───────────────────


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse minimal YAML frontmatter. Returns (metadata, body)."""
    if not content.startswith("---\n"):
        return {}, content
    end = content.find("\n---\n", 4)
    if end == -1:
        end = content.find("\n---", 4)
        if end == -1:
            return {}, content
        body_start = end + 4
    else:
        body_start = end + 5
    yaml_block = content[4:end]
    body = content[body_start:].lstrip("\n")
    metadata: dict = {}
    current_list_key: str | None = None
    for raw in yaml_block.split("\n"):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        stripped = raw.lstrip()
        if stripped.startswith("- "):
            value = stripped[2:].strip()
            value = _unquote(value)
            if current_list_key:
                metadata.setdefault(current_list_key, []).append(value)
            continue
        if ":" in raw:
            key, _, val = raw.partition(":")
            key = key.strip()
            val = val.strip()
            if val:
                current_list_key = None
                metadata[key] = _coerce(_unquote(val))
            else:
                current_list_key = key
                metadata.setdefault(key, [])
    return metadata, body


def _unquote(val: str) -> str:
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
        return val[1:-1]
    return val


def _coerce(val):
    if val in ("true", "True"):
        return True
    if val in ("false", "False"):
        return False
    return val


# ── Wiki page → embeddable text ──────────────────────────────────────────────


def wiki_page_text(meta: dict, body: str) -> str:
    """Build the text that gets embedded for a wiki page."""
    parts = []
    title = meta.get("title", "")
    desc = meta.get("description", "")
    tags = meta.get("tags", "")
    aliases = meta.get("aliases") or []
    if isinstance(aliases, str):
        aliases = [a.strip() for a in aliases.split(",") if a.strip()]

    if title:
        parts.append(f"{title}.")
    if aliases:
        parts.append(f"Also known as: {', '.join(aliases)}.")
    if tags:
        parts.append(f"Tags: {tags}.")
    if desc:
        parts.append(desc)

    # Clean body: drop HTML comments, style/script blocks, div blocks, images
    cleaned = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    cleaned = re.sub(r"<style\b[^>]*>.*?</style>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<script\b[^>]*>.*?</script>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<div[^>]*>.*?</div>", "", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"<img[^>]*>", "", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = "\n".join(l for l in cleaned.splitlines() if not l.strip().startswith(">"))
    cleaned = re.sub(r"^#\s+[^\n]+\n", "", cleaned, count=1)
    cleaned = re.sub(r"\n---+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if cleaned:
        parts.append(cleaned)
    return "\n".join(parts)


# ── 5etools tag stripping & flattening (preserved) ───────────────────────────

_5E_TAG_RE = re.compile(r"\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}")


def strip_5e_tags(text: str) -> str:
    if not isinstance(text, str):
        return str(text)
    return _5E_TAG_RE.sub(r"\1", text)


def flatten_entries(entries, depth: int = 0) -> str:
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
    parts = []
    entry_type = obj.get("type", "")
    name = obj.get("name", "")
    if name:
        parts.append(f"{strip_5e_tags(name)}.")
    if "entries" in obj:
        parts.append(flatten_entries(obj["entries"], depth + 1))
    if "headerEntries" in obj:
        parts.append(flatten_entries(obj["headerEntries"], depth + 1))
    if "items" in obj and isinstance(obj["items"], list):
        for item in obj["items"]:
            parts.append(flatten_entries(item, depth + 1))
    if entry_type == "table":
        cols = obj.get("colLabels", [])
        if cols:
            parts.append("Columns: " + ", ".join(strip_5e_tags(c) for c in cols) + ".")
        for row in obj.get("rows", []):
            if isinstance(row, list):
                parts.append(" | ".join(strip_5e_tags(str(cell)) for cell in row))
    if "entry" in obj:
        parts.append(flatten_entries(obj["entry"], depth + 1))
    return " ".join(p for p in parts if p)


# ── 5etools per-type text builders (preserved) ───────────────────────────────


def _monster_text(entry: dict) -> str:
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
    parts = [f"{entry['name']}."]
    level = entry.get("level", 0)
    school_map = {"A": "Abjuration", "C": "Conjuration", "D": "Divination",
                  "E": "Enchantment", "V": "Evocation", "I": "Illusion",
                  "N": "Necromancy", "T": "Transmutation"}
    school = school_map.get(entry.get("school", ""), entry.get("school", ""))
    parts.append(f"{school} cantrip." if level == 0 else f"Level {level} {school}.")
    time_list = entry.get("time", [])
    if time_list and isinstance(time_list[0], dict):
        t = time_list[0]
        parts.append(f"Casting time: {t.get('number', '')} {t.get('unit', '')}.")
    rng = entry.get("range", {})
    if isinstance(rng, dict):
        dist = rng.get("distance", {})
        if isinstance(dist, dict):
            parts.append(f"Range: {dist.get('amount', '')} {dist.get('type', '')}.".strip())
    comps = entry.get("components", {})
    if isinstance(comps, dict):
        comp_parts = []
        if comps.get("v"): comp_parts.append("V")
        if comps.get("s"): comp_parts.append("S")
        if comps.get("m"):
            m = comps["m"]
            mat_text = m if isinstance(m, str) else m.get("text", str(m))
            comp_parts.append(f"M ({strip_5e_tags(mat_text)})")
        parts.append(f"Components: {', '.join(comp_parts)}.")
    dur = entry.get("duration", [])
    if dur and isinstance(dur[0], dict):
        d = dur[0]
        dtype = d.get("type", "")
        if dtype == "instant":
            parts.append("Duration: Instantaneous.")
        elif dtype == "timed":
            amt = d.get("duration", {}).get("amount", "")
            unit = d.get("duration", {}).get("type", "")
            conc = "Concentration, " if d.get("concentration") else ""
            parts.append(f"Duration: {conc}{amt} {unit}.")
    entries = flatten_entries(entry.get("entries", []))
    if entries: parts.append(entries)
    higher = flatten_entries(entry.get("entriesHigherLevel", []))
    if higher: parts.append(f"At higher levels: {higher}")
    return " ".join(parts)


def _class_text(entry: dict, category_key: str) -> str:
    parts = [f"{entry['name']}."]
    cls = entry.get("className", "")
    if cls: parts.append(f"Class: {cls}.")
    subcls = entry.get("subclassShortName", "")
    if subcls: parts.append(f"Subclass: {subcls}.")
    level = entry.get("level")
    if level: parts.append(f"Level: {level}.")
    if category_key == "class":
        hd = entry.get("hd", {})
        if isinstance(hd, dict):
            parts.append(f"Hit Die: d{hd.get('faces', '?')}.")
        profs = entry.get("startingProficiencies", {})
        armor = profs.get("armor", [])
        if armor: parts.append(f"Armor proficiencies: {', '.join(str(a) for a in armor)}.")
        weapons = profs.get("weapons", [])
        if weapons: parts.append(f"Weapon proficiencies: {', '.join(str(w) for w in weapons)}.")
    entries = flatten_entries(entry.get("entries", []))
    if entries: parts.append(entries)
    return " ".join(parts)


def _item_text(entry: dict) -> str:
    parts = [f"{entry['name']}."]
    rarity = entry.get("rarity", "")
    if rarity and rarity != "none": parts.append(f"Rarity: {rarity}.")
    item_type = entry.get("type", "")
    if item_type: parts.append(f"Type: {item_type}.")
    weight = entry.get("weight")
    if weight: parts.append(f"Weight: {weight} lb.")
    if entry.get("reqAttune"): parts.append("Requires attunement.")
    entries = flatten_entries(entry.get("entries", []))
    if entries: parts.append(entries)
    return " ".join(parts)


def _generic_text(entry: dict) -> str:
    parts = [f"{entry['name']}."]
    entries = flatten_entries(entry.get("entries", []))
    if entries: parts.append(entries)
    return " ".join(parts)


def fivetools_entry_text(entry: dict, category_key: str, filename: str) -> str:
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


def make_entry_id(entry: dict, category_key: str, filename: str, index: int) -> str:
    name = entry.get("name", f"entry_{index}")
    source = entry.get("source", "")
    cls = entry.get("className", "")
    subcls = entry.get("subclassShortName", "")
    level = entry.get("level", "")
    parts = [filename.replace(".json", ""), category_key, name]
    if cls: parts.append(cls)
    if subcls: parts.append(subcls)
    if level: parts.append(str(level))
    if source: parts.append(source)
    parts.append(str(index))
    raw = "_".join(parts)
    return re.sub(r"[^a-zA-Z0-9_-]", "_", raw).lower()


# ── Embedding ────────────────────────────────────────────────────────────────

EMBED_MODEL = "nomic-embed-text:latest"


def embed_text(text: str, ollama_url: str, api_key: str = "",
               max_retries: int = 4) -> Optional[list]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    for attempt in range(max_retries):
        try:
            resp = requests.post(
                f"{ollama_url}/api/embeddings",
                json={"model": EMBED_MODEL, "prompt": text},
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json().get("embedding")
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5 * (2 ** attempt))
            else:
                print(f"  [ERROR] Embedding failed after {max_retries} attempts: {e}",
                      file=sys.stderr)
                return None


# ── Chunking ─────────────────────────────────────────────────────────────────

# Target chunk size — well under nomic-embed-text's 8192-token context (~24K
# chars), with headroom for embedding-time tokenization overhead.
CHUNK_MAX_CHARS = 6000


def chunk_text(text: str, max_chars: int = CHUNK_MAX_CHARS) -> list[str]:
    """Split text into chunks of at most max_chars, breaking on paragraph
    boundaries when possible. Returns [text] unchanged if short enough.
    """
    if len(text) <= max_chars:
        return [text]
    paras = re.split(r"\n\n+", text)
    chunks: list[str] = []
    current = ""
    for p in paras:
        if current and len(current) + 2 + len(p) > max_chars:
            chunks.append(current.strip())
            current = p
        else:
            current = current + "\n\n" + p if current else p
    if current.strip():
        chunks.append(current.strip())
    # Hard-split any remaining oversized chunk (a single paragraph > max_chars)
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final.append(chunk)
            continue
        for i in range(0, len(chunk), max_chars):
            final.append(chunk[i:i + max_chars])
    return final


# ── Loading ──────────────────────────────────────────────────────────────────


def _emit_chunks(page_id: str, name: str, aliases: list, source_file: str,
                 text: str, is_campaign: bool) -> list[dict]:
    """Split text into chunks, return one vector store entry per chunk."""
    chunks = chunk_text(text)
    total = len(chunks)
    out: list[dict] = []
    for i, chunk in enumerate(chunks):
        eid = page_id if total == 1 else f"{page_id}_chunk_{i}"
        out.append({
            "id": eid,
            "page_id": page_id,
            "chunk_index": i,
            "chunk_total": total,
            "name": name,
            "aliases": aliases,
            "source_file": source_file,
            "text": chunk,
            "is_campaign": is_campaign,
        })
    return out


def load_wiki_entries() -> list[dict]:
    """Walk wiki content dirs, return one or more entries per published page
    (long pages chunked into multiple vector store entries)."""
    entries: list[dict] = []
    for rel_dir in WIKI_DIRS:
        full_dir = WIKI_ROOT / rel_dir
        if not full_dir.exists():
            continue
        for fpath in sorted(full_dir.glob("*.md")):
            if fpath.stem == "index":
                continue
            try:
                raw = fpath.read_text(encoding="utf-8")
            except Exception as e:
                print(f"  WARN: {fpath}: {e}", file=sys.stderr)
                continue
            meta, body = parse_frontmatter(raw)
            if meta.get("published") is False:
                continue
            text = wiki_page_text(meta, body)
            if not text or len(text) < 20:
                continue
            page_id = f"wiki_{rel_dir.replace('/', '_')}_{fpath.stem}".lower()
            page_id = re.sub(r"[^a-z0-9_-]", "_", page_id)
            aliases = meta.get("aliases") or []
            if isinstance(aliases, str):
                aliases = [a.strip() for a in aliases.split(",") if a.strip()]
            name = meta.get("title") or fpath.stem
            source_file = str(fpath.relative_to(WIKI_ROOT))
            entries.extend(_emit_chunks(page_id, name, aliases, source_file,
                                          text, is_campaign=True))
    # home.md is intentionally excluded — it's a presentational landing page
    # (inline CSS/markup, no lore content) so embedding it just pollutes the
    # vector store with style noise the chatbot would never need to surface.
    return entries


def load_5etools_entries() -> list[dict]:
    """Load all 5etools entries with text representations. Long entries
    (rare — e.g. lengthy class descriptions) get chunked."""
    entries: list[dict] = []
    skip_files = {"makebrew-creature.json", "monsterfeatures.json",
                  "magicvariants.json", "recipes.json", "book-xphb.json",
                  "charcreationoptions.json", "cultsboons.json", "tables.json"}
    if not RULES_DIR.exists():
        return entries
    for fpath in sorted(RULES_DIR.glob("*.json")):
        if fpath.name in skip_files:
            continue
        try:
            with open(fpath) as f:
                data = json.load(f)
        except Exception as e:
            print(f"  WARN: {fpath}: {e}", file=sys.stderr)
            continue
        for key, value in data.items():
            if key.startswith("_") or not isinstance(value, list):
                continue
            for i, entry in enumerate(value):
                if not isinstance(entry, dict) or "name" not in entry:
                    continue
                text = fivetools_entry_text(entry, key, fpath.name)
                if not text or len(text) < 20:
                    continue
                page_id = make_entry_id(entry, key, fpath.name, i)
                entries.extend(_emit_chunks(
                    page_id,
                    entry.get("name", ""),
                    [],
                    f"5e-filtered/{fpath.name}",
                    text,
                    is_campaign=False,
                ))
    return entries


# ── Vector store I/O ─────────────────────────────────────────────────────────


VECTOR_STORE_SCHEMA_VERSION = 1


def _unwrap_vector_store(data):
    """Accept both old `[entry, ...]` and new `{meta, entries: [...]}`
    shapes. Returns the entries list (or an empty list on garbage)."""
    if isinstance(data, dict) and isinstance(data.get("entries"), list):
        return data["entries"]
    if isinstance(data, list):
        return data
    return []


def load_existing_store(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return {}
    return {e["id"]: e for e in _unwrap_vector_store(data) if isinstance(e, dict) and e.get("id")}


def text_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


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


def build_store(entries: list[dict], output_path: Path, ollama_url: str,
                api_key: str = "", force: bool = False) -> None:
    start = time.time()
    existing = {} if force else load_existing_store(output_path)
    existing_ids = set(existing.keys())
    new_ids = {e["id"] for e in entries}

    cached = 0
    to_embed = []
    results = []
    for entry in entries:
        eid = entry["id"]
        h = text_hash(entry["text"])
        old = existing.get(eid)
        if old and old.get("text_hash") == h and old.get("embedding"):
            results.append({
                "id": eid,
                "page_id": entry.get("page_id", eid),
                "chunk_index": entry.get("chunk_index", 0),
                "chunk_total": entry.get("chunk_total", 1),
                "name": entry["name"],
                "aliases": entry.get("aliases", []),
                "source_file": entry["source_file"],
                "text": entry["text"],
                "embedding": old["embedding"],
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

    failed = 0
    interrupted = False
    try:
        for entry, h in progress_iter(to_embed, len(to_embed), desc="Embedding"):
            embedding = embed_text(entry["text"], ollama_url, api_key)
            if embedding is None:
                failed += 1
                preview = entry["text"][:160].replace("\n", " ")
                print(
                    f"  [FAILED] id={entry['id']} name={entry.get('name', '?')!r} "
                    f"source={entry.get('source_file', '?')} chars={len(entry['text'])}\n"
                    f"           preview: {preview!r}",
                    file=sys.stderr,
                )
                continue
            results.append({
                "id": entry["id"],
                "page_id": entry.get("page_id", entry["id"]),
                "chunk_index": entry.get("chunk_index", 0),
                "chunk_total": entry.get("chunk_total", 1),
                "name": entry["name"],
                "aliases": entry.get("aliases", []),
                "source_file": entry["source_file"],
                "text": entry["text"],
                "embedding": embedding,
                "text_hash": h,
            })
    except KeyboardInterrupt:
        interrupted = True
        print("\n  Interrupted — saving partial progress…", file=sys.stderr)

    results.sort(key=lambda x: x["id"])

    # Wrap entries in a metadata header so stale deploys are detectable.
    # tier1_hash is the sha256 of the campaign-data/tier1.md that was
    # current when this store was built — if Enzo's tier1.md doesn't
    # match, the loader can log a warning.
    tier1_path = BASE_DIR / "campaign-data" / "tier1.md"
    tier1_hash = ""
    if tier1_path.exists():
        h = hashlib.sha256()
        with open(tier1_path, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        tier1_hash = h.hexdigest()
    payload = {
        "meta": {
            "schema_version": VECTOR_STORE_SCHEMA_VERSION,
            "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "embedding_model": EMBED_MODEL,
            "tier1_hash": tier1_hash,
            "entry_count": len(results),
        },
        "entries": results,
    }

    # Atomic write: tmp file in same dir, then rename. On PermissionError
    # falling back to /tmp so the work isn't lost.
    actual_path = output_path
    tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    try:
        with open(tmp_path, "w") as f:
            json.dump(payload, f, separators=(",", ":"))
        os.replace(tmp_path, output_path)
    except PermissionError as e:
        # Couldn't write next to the original — dump to /tmp so the user
        # can chown and mv it.
        import tempfile
        fallback = Path(tempfile.gettempdir()) / output_path.name
        with open(fallback, "w") as f:
            json.dump(results, f, separators=(",", ":"))
        actual_path = fallback
        print(f"\n  [WARN] Could not write to {output_path}: {e}", file=sys.stderr)
        print(f"  [WARN] Saved {len(results)} entries to {fallback} instead.", file=sys.stderr)
        print(f"  [WARN] Fix the original file's permissions and `mv {fallback} {output_path}`.", file=sys.stderr)

    if interrupted:
        print(f"  Saved {len(results)} entries to {actual_path} before exit.")
        sys.exit(130)  # standard exit code for Ctrl-C

    elapsed = time.time() - start
    print(f"\n  {len(results)} entries: {cached} cached, {new_count} new, "
          f"{updated_count} re-embedded, {len(deleted)} removed "
          f"({failed} failed) ({elapsed:.1f}s)")
    print(f"  Saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Build vector store for the chatbot")
    parser.add_argument("--ollama-url", default="https://ai.raptornet.dev/ollama",
                        help="Ollama server URL (include /ollama for OpenWebUI proxy)")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("OLLAMA_API_KEY") or os.environ.get("OPENWEBUI_API_KEY") or "",
        help="Bearer token for Ollama (default: $OLLAMA_API_KEY or $OPENWEBUI_API_KEY)",
    )
    parser.add_argument("--force", action="store_true",
                        help="Ignore cache and re-embed everything")
    args = parser.parse_args()

    # Load API key from .env if not in environment
    if not args.api_key:
        env_file = BASE_DIR / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                for key in ("OLLAMA_API_KEY=", "OPENWEBUI_API_KEY="):
                    if line.startswith(key):
                        args.api_key = line.split("=", 1)[1].strip().strip("'\"")
                        break
                if args.api_key:
                    break

    print("Loading entries...")
    wiki = load_wiki_entries()
    rules = load_5etools_entries()
    all_entries = wiki + rules
    wiki_pages = len({e["page_id"] for e in wiki})
    rules_pages = len({e["page_id"] for e in rules})
    print(f"  Wiki:    {wiki_pages} pages → {len(wiki)} chunks")
    print(f"  5etools: {rules_pages} entries → {len(rules)} chunks")
    print(f"  Total:   {len(all_entries)} chunks to embed")

    # Quick connectivity check
    print(f"\nChecking Ollama at {args.ollama_url}...")
    headers = {"Content-Type": "application/json"}
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"
        print("  Using Bearer token authentication")
    try:
        test = requests.post(
            f"{args.ollama_url}/api/embeddings",
            json={"model": EMBED_MODEL, "prompt": "test"},
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

    build_store(all_entries, OUTPUT_PATH, args.ollama_url,
                api_key=args.api_key, force=args.force)

    print("\nDone!")


if __name__ == "__main__":
    main()
