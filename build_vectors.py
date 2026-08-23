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

from campaign_lib.chunking import emit_chunks
from campaign_lib.fivetools import fivetools_entry_text, make_entry_id
from campaign_lib.wiki import iter_published_markdown, normalize_aliases

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

# ── Wiki page → embeddable text ──────────────────────────────────────────────
def wiki_page_text(meta: dict, body: str) -> str:
    """Build the text that gets embedded for a wiki page."""
    parts = []
    title = meta.get("title", "")
    desc = meta.get("description", "")
    tags = meta.get("tags", "")
    aliases = normalize_aliases(meta.get("aliases"))

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


# ── Loading ──────────────────────────────────────────────────────────────────


def _warn_markdown(path: Path, error: Exception) -> None:
    print(f"  WARN: {path}: {error}", file=sys.stderr)
def load_wiki_entries() -> list[dict]:
    """Walk wiki content dirs, return one or more entries per published page
    (long pages chunked into multiple vector store entries)."""
    entries: list[dict] = []
    for rel_dir in WIKI_DIRS:
        for fpath, meta, body in iter_published_markdown(
            WIKI_ROOT, rel_dir, on_error=_warn_markdown
        ):
            text = wiki_page_text(meta, body)
            if not text or len(text) < 20:
                continue
            page_id = f"wiki_{rel_dir.replace('/', '_')}_{fpath.stem}".lower()
            page_id = re.sub(r"[^a-z0-9_-]", "_", page_id)
            aliases = normalize_aliases(meta.get("aliases"))
            name = meta.get("title") or fpath.stem
            source_file = str(fpath.relative_to(WIKI_ROOT))
            entries.extend(emit_chunks(page_id, name, aliases, source_file,
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
                entries.extend(emit_chunks(
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
