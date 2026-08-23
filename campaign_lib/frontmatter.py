"""Minimal frontmatter parsing shared by campaign builders."""

from __future__ import annotations

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
