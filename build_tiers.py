#!/usr/bin/env python3
"""
Step 1 — Build tier1.md from wiki content + 5etools JSON.

The wiki markdown is now the source of truth for campaign content. This script
walks the wiki content directories, reads frontmatter + body, and generates a
single tier1.md the chatbot uses as its base system prompt.

DM-only content (Venturia/DM/, any file with `published: false`) is excluded.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT         = Path(__file__).parent
WIKI_ROOT    = ROOT
FILTERED_DIR = ROOT / "campaign-data" / "5e-filtered"
TIER1_OUT    = ROOT / "campaign-data" / "tier1.md"

# Wiki content directories to include, mapped to (top-section, subsection).
# Subsection is None if the directory should render as a flat list.
WIKI_SECTIONS = [
    ("Venturia/Characters/PCs",      ("Characters", "Player Characters")),
    ("Venturia/Characters/NPCs",     ("Characters", "NPCs")),
    ("Venturia/Locations",  ("Locations",  None)),
    ("Venturia/Factions",   ("Factions",   None)),
    ("Venturia/Government", ("Government", None)),
    ("Venturia/Lore",       ("Lore",       None)),
    ("Articles",            ("Articles",   None)),
    ("Class-Changes",       ("Class Changes", None)),
    ("House-Rules",         ("House Rules",   None)),
    ("Updates",             ("Updates",    None)),
]

# ── Frontmatter parser (no pyyaml dep) ────────────────────────────────────────


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse minimal YAML frontmatter. Returns (metadata, body)."""
    if not content.startswith("---\n"):
        return {}, content
    end = content.find("\n---\n", 4)
    if end == -1:
        end = content.find("\n---", 4)  # trailing close without newline
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
        # List item under current key
        stripped = raw.lstrip()
        if stripped.startswith("- "):
            value = stripped[2:].strip()
            value = _unquote(value)
            if current_list_key:
                metadata.setdefault(current_list_key, []).append(value)
            continue
        # key: value
        if ":" in raw:
            key, _, val = raw.partition(":")
            key = key.strip()
            val = val.strip()
            if val:
                current_list_key = None
                metadata[key] = _coerce(_unquote(val))
            else:
                # Empty value — likely a list or block scalar follows
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


# ── Wiki page loading ────────────────────────────────────────────────────────


def slug_from_path(path: Path) -> str:
    """Filename without .md extension."""
    return path.stem


def load_wiki_pages(rel_dir: str) -> list[dict]:
    """Load all .md pages under WIKI_ROOT/rel_dir (non-recursive)."""
    full_dir = WIKI_ROOT / rel_dir
    if not full_dir.exists():
        return []
    pages = []
    for path in sorted(full_dir.glob("*.md")):
        try:
            raw = path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  WARN: {path}: {e}", file=sys.stderr)
            continue
        meta, body = parse_frontmatter(raw)
        # Skip unpublished pages (drafts / DM-only safety net)
        if meta.get("published") is False:
            continue
        # Skip index pages — they're navigation, not content
        if path.stem == "index":
            continue
        title = meta.get("title") or _first_heading(body) or path.stem
        description = meta.get("description", "")
        tags = meta.get("tags", "")
        aliases = meta.get("aliases", [])
        if isinstance(aliases, str):
            aliases = [a.strip() for a in aliases.split(",") if a.strip()]
        pages.append({
            "slug": slug_from_path(path),
            "title": title,
            "description": description,
            "tags": tags,
            "aliases": aliases,
            "body": body,
            "path": str(path.relative_to(WIKI_ROOT)),
        })
    return pages


def _first_heading(body: str) -> str | None:
    """Pull the first `# Heading` line from body markdown."""
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return None


# ── Tier1 compression for a wiki page ────────────────────────────────────────


def compress_wiki_page(page: dict) -> str:
    """Compress a wiki page to a tier1 block: title, description, snippet, tags."""
    title = page["title"]
    desc  = page["description"] or ""
    tags  = page["tags"] or ""
    body  = page["body"]
    aliases = page.get("aliases") or []

    parts = []
    alias_s = f" ({', '.join(aliases[:4])})" if aliases else ""
    parts.append(f"**{title}**{alias_s}")
    if desc:
        parts.append(desc)

    snippet = _body_snippet(body, max_chars=600)
    if snippet:
        parts.append(snippet)

    if tags:
        parts.append(f"Tags: {tags}")
    return "\n".join(parts)


def _body_snippet(body: str, max_chars: int = 600) -> str:
    """First section of body content, stripped of HTML/markdown noise, capped."""
    # Drop HTML comments (DM NOTE blocks, TODOs)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    # Drop HTML div/img blocks (portrait banners)
    body = re.sub(r"<div[^>]*>.*?</div>", "", body, flags=re.DOTALL)
    # Drop standalone img tags
    body = re.sub(r"<img[^>]*>", "", body)
    # Process line by line — easier than chained regexes
    out_lines = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            out_lines.append("")
            continue
        if line.startswith(">"):
            continue
        if line.startswith("# "):
            continue
        # Skip subsection headings — they're navigation, not content prose
        if line.startswith("## ") or line.startswith("### "):
            continue
        # Skip meta lines: a line built from **X:** segments separated by |
        if re.match(r"^\*\*[^:*]+:\*\*", line) and "|" in line:
            continue
        if line.startswith("---"):
            continue
        out_lines.append(raw)
    body = "\n".join(out_lines)
    # Collapse runs of blank lines
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    if len(body) <= max_chars:
        return body
    cut = body[:max_chars]
    last_period = cut.rfind(". ")
    if last_period > max_chars * 0.5:
        cut = cut[:last_period + 1]
    return cut.rstrip() + "…"


# ── 5etools helpers (preserved from previous build_tiers.py) ─────────────────

SCHOOL = {
    "A": "Abj", "C": "Con", "D": "Div", "E": "Enc",
    "EV": "Evo", "V": "Evo", "I": "Ill", "N": "Nec",
    "T": "Tra", "P": "Psy",
}


def clean_tags(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = re.sub(r"\{@atk [^}]+\}", "Attack:", text)
    text = re.sub(r"\{@h\}", "Hit:", text)
    text = re.sub(r"\{@recharge (\d+)\}", r"(Recharge \1-6)", text)
    text = re.sub(r"\{@\w+\s([^|}]+)[^}]*\}", r"\1", text)
    text = re.sub(r"\{@\w+\}", "", text)
    return text.strip()


def extract_text(obj, budget=160) -> str:
    parts: list[str] = []
    def _walk(o):
        if isinstance(o, str):
            parts.append(clean_tags(o))
        elif isinstance(o, list):
            for item in o:
                _walk(item)
                if sum(len(p) for p in parts) >= budget:
                    return
        elif isinstance(o, dict):
            t = o.get("type", "")
            if t in ("entries", "section", "inset", "insetReadaloud", "quote"):
                for e in o.get("entries", []):
                    _walk(e)
            elif t == "list":
                for item in o.get("items", []):
                    _walk(item)
            elif t == "table":
                pass
            else:
                for e in o.get("entries", []):
                    _walk(e)
    _walk(obj)
    result = " ".join(p for p in parts if p)
    result = re.sub(r"\s+", " ", result).strip()
    if len(result) > budget:
        result = result[:budget - 1] + "…"
    return result


def fmt_condition(e: dict) -> str:
    return f"**{e.get('name', '?')}** — {extract_text(e.get('entries', []), 120)}"


def fmt_action(e: dict) -> str:
    return f"**{e.get('name', '?')}** — {extract_text(e.get('entries', []), 100)}"


def fmt_background(e: dict) -> str:
    name = e.get("name", "?")
    skills = []
    for s in e.get("skillProficiencies", [{}]):
        skills += [k.title() for k, v in s.items() if v is True and k != "_"]
    desc = extract_text(e.get("entries", []), 80)
    sk = ", ".join(skills[:3]) if skills else "—"
    return f"**{name}** (Skills: {sk}) — {desc}"


def fmt_feat(e: dict) -> str:
    name = e.get("name", "?")
    desc = extract_text(e.get("entries", []), 100)
    prereqs = e.get("prerequisite", [])
    req_parts = []
    for p in prereqs:
        if "level" in p:
            lvl_val = p["level"]
            lvl_num = lvl_val if isinstance(lvl_val, int) else lvl_val.get("level", "?")
            req_parts.append(f"Lv{lvl_num}")
        elif "ability" in p:
            ab = p["ability"][0]
            for k, v in ab.items():
                req_parts.append(f"{k.upper()} {v}+")
        elif "other" in p:
            req_parts.append(p["other"][:30])
    req = f" [{', '.join(req_parts[:2])}]" if req_parts else ""
    return f"**{name}**{req} — {desc}"


def load_filtered(key: str) -> list:
    entries = []
    if not FILTERED_DIR.exists():
        return entries
    for path in sorted(FILTERED_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            entries.extend(data.get(key, []))
        except Exception:
            pass
    return entries


def build_class_section() -> str:
    lines = []
    if not FILTERED_DIR.exists():
        return ""
    for path in sorted(FILTERED_DIR.glob("class-*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        classes = data.get("class", [])
        subclasses = data.get("subclass", [])
        features = data.get("classFeature", [])
        if not classes:
            continue
        cls = classes[0]
        cname = cls.get("name", path.stem)
        hd = cls.get("hd", {}).get("faces", "?")
        saves = [s.upper() for s in cls.get("proficiency", [])[:2]]
        saves_s = ", ".join(saves) if saves else "—"
        cast_ab = cls.get("spellcastingAbility", "")
        cast_s = f" | Spell: {cast_ab.upper()}" if cast_ab else ""

        lines.append(f"\n### {cname}")
        lines.append(f"d{hd} hit die | Saves: {saves_s}{cast_s}")

        sc_names = sorted({sc.get("name", "?") for sc in subclasses})
        if sc_names:
            lines.append("**Subclasses:** " + ", ".join(sc_names))

        NOTABLE = {1, 2, 3, 5, 7, 11, 17, 20}
        by_level: dict[int, list[str]] = {}
        for feat in features:
            lvl = feat.get("level", 0)
            if lvl in NOTABLE:
                by_level.setdefault(lvl, []).append(feat.get("name", "?"))
        if by_level:
            feat_parts = []
            for lvl in sorted(by_level):
                feat_parts.append(f"Lv{lvl}: {', '.join(by_level[lvl])}")
            lines.append("**Features:** " + " | ".join(feat_parts))
    return "\n".join(lines)


# ── Build tier1 ──────────────────────────────────────────────────────────────


def build_tier1() -> str:
    sections: list[str] = []
    sections.append("# Vallombrosa Campaign — Codex Reference\n")
    sections.append(
        "This is Enzo's base knowledge: a compressed view of every published "
        "wiki page. Use the lookup_entry tool to retrieve full content for any "
        "named entry.\n"
    )

    # Group wiki pages by top-section
    grouped: dict[str, dict[str | None, list[dict]]] = {}
    for rel_dir, (top, sub) in WIKI_SECTIONS:
        pages = load_wiki_pages(rel_dir)
        if not pages:
            continue
        grouped.setdefault(top, {}).setdefault(sub, []).extend(pages)

    # Also include the top-level home.md if present
    home_path = WIKI_ROOT / "home.md"
    if home_path.exists():
        try:
            raw = home_path.read_text(encoding="utf-8")
            meta, body = parse_frontmatter(raw)
            if meta.get("published") is not False:
                title = meta.get("title") or _first_heading(body) or "Home"
                desc = meta.get("description", "")
                if desc:
                    sections.append(f"## {title}\n{desc}\n")
        except Exception:
            pass

    # Emit in stable order
    for top in ["Characters", "Locations", "Factions", "Government", "Lore",
                "Articles", "Class Changes", "House Rules", "Updates"]:
        if top not in grouped:
            continue
        sections.append(f"## {top}")
        subs = grouped[top]
        # Stable subsection order: PCs first if present
        sub_order = sorted(subs.keys(), key=lambda x: (x != "Player Characters", x or ""))
        for sub in sub_order:
            if sub:
                sections.append(f"### {sub}")
            for page in subs[sub]:
                sections.append(compress_wiki_page(page))
                sections.append("")

    # ── 5e Quick Reference ───────────────────────────────────────────────────
    sections.append("---\n")
    sections.append("# D&D 5e Quick Reference (2024 — XPHB/XDMG/XMM)\n")

    conditions = load_filtered("condition") + load_filtered("status")
    if conditions:
        sections.append("## Conditions & Statuses")
        for e in sorted(conditions, key=lambda x: x.get("name", "")):
            sections.append(fmt_condition(e))
        sections.append("")

    actions = load_filtered("action")
    if actions:
        sections.append("## Actions")
        for e in sorted(actions, key=lambda x: x.get("name", "")):
            sections.append(fmt_action(e))
        sections.append("")

    backgrounds = load_filtered("background")
    if backgrounds:
        sections.append("## Backgrounds")
        for e in sorted(backgrounds, key=lambda x: x.get("name", "")):
            sections.append(fmt_background(e))
        sections.append("")

    feats = load_filtered("feat")
    if feats:
        sections.append("## Feats")
        for e in sorted(feats, key=lambda x: x.get("name", "")):
            sections.append(fmt_feat(e))
        sections.append("")

    cls_section = build_class_section()
    if cls_section.strip():
        sections.append("## Classes")
        sections.append(cls_section)
        sections.append("")

    return "\n".join(sections)


# ── Main ─────────────────────────────────────────────────────────────────────


def token_estimate(text: str) -> int:
    return len(text) // 4


def main():
    print("Building tier1.md from wiki content + 5e reference …")
    text = build_tier1()
    TIER1_OUT.write_text(text, encoding="utf-8")
    tokens = token_estimate(text)
    print(f"  → {TIER1_OUT.name}  {len(text):,} chars  ~{tokens:,} tokens")


if __name__ == "__main__":
    main()
