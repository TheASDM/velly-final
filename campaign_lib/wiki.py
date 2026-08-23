"""Shared traversal and metadata helpers for the campaign markdown tree."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path

from .frontmatter import parse_frontmatter


def iter_published_markdown(
    root: Path,
    relative_dir: str,
    *,
    on_error: Callable[[Path, Exception], None] | None = None,
) -> Iterator[tuple[Path, dict, str]]:
    """Yield non-index, published markdown pages in stable filename order."""
    directory = root / relative_dir
    if not directory.exists():
        return
    for path in sorted(directory.glob("*.md")):
        if path.stem == "index":
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except Exception as error:
            if on_error:
                on_error(path, error)
            continue
        metadata, body = parse_frontmatter(raw)
        if metadata.get("published") is False:
            continue
        yield path, metadata, body


def normalize_aliases(value) -> list[str]:
    if isinstance(value, str):
        return [alias.strip() for alias in value.split(",") if alias.strip()]
    return list(value or [])


def first_heading(body: str) -> str | None:
    """Return the first level-one Markdown heading, if present."""
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return None
