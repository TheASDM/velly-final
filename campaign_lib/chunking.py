"""Text chunking helpers for campaign search data."""

from __future__ import annotations

import re

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

def emit_chunks(page_id: str, name: str, aliases: list, source_file: str,
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
