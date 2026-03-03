#!/usr/bin/env python3
"""
Step 1 — Build tier1_player.md and tier1_dm.md from curated campaign data
         and filtered 5etools JSON.
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT         = Path(__file__).parent
CURATED_DIR  = ROOT / "campaign-data" / "curated"
FILTERED_DIR = ROOT / "campaign-data" / "5e-filtered"
PLAYER_OUT   = ROOT / "campaign-data" / "tier1_player.md"
DM_OUT       = ROOT / "campaign-data" / "tier1_dm.md"

# ── 5etools text helpers ─────────────────────────────────────────────────────

SCHOOL = {
    "A": "Abj", "C": "Con", "D": "Div", "E": "Enc",
    "EV": "Evo", "V": "Evo", "I": "Ill", "N": "Nec",
    "T": "Tra", "P": "Psy",
}

def clean_tags(text: str) -> str:
    """Strip 5etools {@tag ...} markup, keeping visible text."""
    if not isinstance(text, str):
        return ""
    # {@atk mw} → "Melee Weapon Attack:", {@h} → "Hit:"
    text = re.sub(r'\{@atk [^}]+\}', 'Attack:', text)
    text = re.sub(r'\{@h\}', 'Hit:', text)
    text = re.sub(r'\{@recharge (\d+)\}', r'(Recharge \1-6)', text)
    # {@tag content|extra} → content
    text = re.sub(r'\{@\w+\s([^|}]+)[^}]*\}', r'\1', text)
    # {@tag} with no content → remove
    text = re.sub(r'\{@\w+\}', '', text)
    return text.strip()

def extract_text(obj, budget=160) -> str:
    """Recursively extract plain text from a 5etools entries value."""
    parts = []

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
                pass  # skip tables
            else:
                for e in o.get("entries", []):
                    _walk(e)

    _walk(obj)
    result = " ".join(p for p in parts if p)
    result = re.sub(r'\s+', ' ', result).strip()
    if len(result) > budget:
        result = result[:budget - 1] + "…"
    return result


# ── 5etools entry compressors ─────────────────────────────────────────────────

def fmt_spell(e: dict) -> str:
    lvl    = e.get("level", 0)
    lvl_s  = "C" if lvl == 0 else str(lvl)
    school = SCHOOL.get(e.get("school", "?"), e.get("school", "?"))
    conc   = "[C]" if e.get("concentration") else ""
    rit    = "[R]" if e.get("ritual") else ""
    flags  = "".join(filter(None, [conc, rit]))
    flags  = " " + flags if flags else ""
    name   = e.get("name", "?")
    desc   = extract_text(e.get("entries", []), 100)
    return f"**{name}** ({lvl_s}/{school}{flags}) — {desc}"


def fmt_monster(e: dict) -> str:
    name  = e.get("name", "?")
    cr    = e.get("cr", "?")
    if isinstance(cr, dict):
        cr = cr.get("cr", "?")
    mtype = e.get("type", "?")
    if isinstance(mtype, dict):
        mtype = mtype.get("type", "?")
    ac    = e.get("ac", [0])
    ac_v  = ac[0] if isinstance(ac[0], int) else ac[0].get("ac", "?") if isinstance(ac[0], dict) else "?"
    hp    = e.get("hp", {})
    hp_v  = hp.get("average", hp.get("special", "?"))
    return f"**{name}** ({str(mtype).title()} CR {cr}) AC {ac_v}, HP {hp_v}"


def fmt_item(e: dict) -> str:
    name    = e.get("name", "?")
    rarity  = e.get("rarity", "unknown")
    attune  = " attune" if e.get("reqAttune") else ""
    desc    = extract_text(e.get("entries", []), 80)
    return f"**{name}** ({rarity}{attune}) — {desc}"


def fmt_feat(e: dict) -> str:
    name  = e.get("name", "?")
    desc  = extract_text(e.get("entries", []), 100)
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


def fmt_background(e: dict) -> str:
    name   = e.get("name", "?")
    skills = []
    for s in e.get("skillProficiencies", [{}]):
        skills += [k.title() for k, v in s.items() if v is True and k != "_"]
    desc   = extract_text(e.get("entries", []), 80)
    sk     = ", ".join(skills[:3]) if skills else "—"
    return f"**{name}** (Skills: {sk}) — {desc}"


def fmt_condition(e: dict) -> str:
    name  = e.get("name", "?")
    desc  = extract_text(e.get("entries", []), 120)
    return f"**{name}** — {desc}"


def fmt_action(e: dict) -> str:
    name  = e.get("name", "?")
    desc  = extract_text(e.get("entries", []), 100)
    return f"**{name}** — {desc}"


def fmt_optfeature(e: dict) -> str:
    name  = e.get("name", "?")
    ft    = e.get("featureType", [])
    ft    = "/".join(ft) if isinstance(ft, list) else ft
    desc  = extract_text(e.get("entries", []), 80)
    tag   = f" [{ft}]" if ft else ""
    return f"**{name}**{tag} — {desc}"


def fmt_variantrule(e: dict) -> str:
    name  = e.get("name", "?")
    ruleEntries = e.get("entries", [])
    desc  = extract_text(ruleEntries, 100)
    return f"**{name}** — {desc}"


# ── Class compressor ──────────────────────────────────────────────────────────

def build_class_section(filtered_dir: Path) -> str:
    """Build a compressed class section from all class-*.json files."""
    lines = []
    for path in sorted(filtered_dir.glob("class-*.json")):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        classes   = data.get("class", [])
        subclasses = data.get("subclass", [])
        features   = data.get("classFeature", [])
        scfeatures = data.get("subclassFeature", [])

        if not classes:
            continue

        cls = classes[0]
        cname = cls.get("name", path.stem)
        hd    = cls.get("hd", {}).get("faces", "?")
        saves = [s.upper() for s in cls.get("proficiency", [])[:2]]
        saves_s = ", ".join(saves) if saves else "—"
        cast_ab = cls.get("spellcastingAbility", "")
        cast_s  = f" | Spell: {cast_ab.upper()}" if cast_ab else ""

        lines.append(f"\n### {cname}")
        lines.append(f"d{hd} hit die | Saves: {saves_s}{cast_s}")

        # subclass names
        sc_names = sorted({sc.get("name", "?") for sc in subclasses})
        if sc_names:
            lines.append("**Subclasses:** " + ", ".join(sc_names))

        # key class features at notable levels only (1, 2, 3, 5, 7, 11, 17, 20)
        NOTABLE = {1, 2, 3, 5, 7, 11, 17, 20}
        by_level: dict[int, list[str]] = {}
        for feat in features:
            lvl  = feat.get("level", 0)
            if lvl not in NOTABLE:
                continue
            fname = feat.get("name", "?")
            by_level.setdefault(lvl, []).append(fname)

        if by_level:
            feat_parts = []
            for lvl in sorted(by_level):
                names = ", ".join(by_level[lvl])
                feat_parts.append(f"Lv{lvl}: {names}")
            lines.append("**Features:** " + " | ".join(feat_parts))

    return "\n".join(lines)


# ── Curated entry compressor ──────────────────────────────────────────────────

def compress_curated(entry: dict, mode: str) -> str:
    """Compress a curated entry to a tight multi-line block."""
    name    = entry.get("name", entry.get("id", "?"))
    aliases = entry.get("aliases", [])
    etype   = entry.get("type", "")
    player  = entry.get("player", "")
    tagline = entry.get("tagline", "")
    summary = entry.get("summary", "")

    DETAIL_LEN = 120 if mode == "player" else 180
    REL_LEN    = 50  if mode == "player" else 70
    DM_NOTE_LEN = 200

    alias_s  = f" ({', '.join(aliases[:3])})" if aliases else ""
    type_s   = f" [{etype}]" if etype else ""
    player_s = f" — Player: {player}" if player else ""

    header = f"**{name}**{alias_s}{type_s}{player_s}"
    if tagline:
        header += f" — {tagline}"

    parts = [header]
    if summary:
        parts.append(summary)

    # Details
    for d in entry.get("details", []):
        is_spoiler = d.get("spoiler", False)
        if is_spoiler and mode == "player":
            continue
        label   = d.get("label", "")
        content = d.get("content", "")
        if not content:
            continue
        snippet = content[:DETAIL_LEN] + ("…" if len(content) > DETAIL_LEN else "")
        line    = f"{label}: {snippet}" if label else snippet
        if is_spoiler and mode == "dm":
            parts.append(f"[SPOILER] {line}")
        else:
            parts.append(line)

    # Connections
    conn_lines = []
    for c in entry.get("connections", []):
        is_spoiler = c.get("spoiler", False)
        if is_spoiler and mode == "player":
            continue
        target = c.get("target_name", "")
        rel    = c.get("relationship", "")
        if not target:
            continue
        snippet = f"{target} ({rel[:REL_LEN]})" if rel else target
        if is_spoiler and mode == "dm":
            conn_lines.append(f"[SPOILER] {snippet}")
        else:
            conn_lines.append(snippet)

    if conn_lines:
        parts.append("Connections: " + " | ".join(conn_lines[:6]))

    # DM notes (DM only)
    if mode == "dm":
        dm = entry.get("dm_notes", "")
        if dm:
            parts.append(f"[DM] {dm[:DM_NOTE_LEN]}{'…' if len(dm) > DM_NOTE_LEN else ''}")

    return "\n".join(parts)


# ── Load helpers ─────────────────────────────────────────────────────────────

def load_curated() -> dict[str, list]:
    """Return {category: [entry, ...]} for all curated files."""
    result = {}
    for path in sorted(CURATED_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            cat  = data.get("category", path.stem)
            result[cat] = data.get("entries", [])
        except Exception as e:
            print(f"  WARN: {path.name}: {e}", file=sys.stderr)
    return result


def load_filtered(key: str) -> list:
    """Return merged list of all entries for a given top-level key across filtered files."""
    entries = []
    for path in sorted(FILTERED_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            entries.extend(data.get(key, []))
        except Exception:
            pass
    return entries


# ── Build one tier file ────────────────────────────────────────────────────────

def build_tier(mode: str) -> str:
    """Build the full tier markdown for 'player' or 'dm'."""
    curated  = load_curated()
    sections = []

    title = "Player Reference" if mode == "player" else "DM Reference (Full)"
    sections.append(f"# Vallombrosa Campaign — {title}\n")

    # ── Campaign lore ─────────────────────────────────────────────────────────

    # Characters
    pcs  = [e for e in curated.get("characters", []) if e.get("type") == "pc"]
    npcs = [e for e in curated.get("characters", []) if e.get("type") != "pc"]
    if mode == "player":
        # skip entries that are entirely spoiler
        pcs  = [e for e in pcs  if not e.get("spoiler")]
        npcs = [e for e in npcs if not e.get("spoiler")]

    if pcs or npcs:
        sections.append("## Characters")
        if pcs:
            sections.append("### Player Characters")
            for e in pcs:
                sections.append(compress_curated(e, mode))
                sections.append("")
        if npcs:
            sections.append("### NPCs")
            for e in npcs:
                sections.append(compress_curated(e, mode))
                sections.append("")

    # Locations
    locs = curated.get("locations", [])
    if mode == "player":
        locs = [e for e in locs if not e.get("spoiler")]
    if locs:
        sections.append("## Locations")
        for e in locs:
            sections.append(compress_curated(e, mode))
            sections.append("")

    # Factions
    factions = curated.get("factions", [])
    if mode == "player":
        factions = [e for e in factions if not e.get("spoiler")]
    if factions:
        sections.append("## Factions")
        for e in factions:
            sections.append(compress_curated(e, mode))
            sections.append("")

    # Government
    gov = curated.get("government", [])
    if mode == "player":
        gov = [e for e in gov if not e.get("spoiler")]
    if gov:
        sections.append("## Government")
        for e in gov:
            sections.append(compress_curated(e, mode))
            sections.append("")

    # Lore
    lore = curated.get("lore", [])
    if mode == "player":
        lore = [e for e in lore if not e.get("spoiler")]
    if lore:
        sections.append("## Lore")
        for e in lore:
            sections.append(compress_curated(e, mode))
            sections.append("")

    # Campaign meta (DM gets all; player gets non-spoiler)
    campaign = curated.get("campaign", [])
    if mode == "player":
        campaign = [e for e in campaign if not e.get("spoiler")]
    if campaign:
        sections.append("## Campaign Notes")
        for e in campaign:
            sections.append(compress_curated(e, mode))
            sections.append("")

    # ── 5e Quick Reference ────────────────────────────────────────────────────
    sections.append("---\n")
    sections.append("# D&D 5e Quick Reference (2024 — XPHB/XDMG/XMM)\n")

    # Conditions
    conditions = load_filtered("condition") + load_filtered("status")
    if conditions:
        sections.append("## Conditions & Statuses")
        for e in sorted(conditions, key=lambda x: x.get("name", "")):
            sections.append(fmt_condition(e))
        sections.append("")

    # Actions
    actions = load_filtered("action")
    if actions:
        sections.append("## Actions")
        for e in sorted(actions, key=lambda x: x.get("name", "")):
            sections.append(fmt_action(e))
        sections.append("")

    # Backgrounds
    backgrounds = load_filtered("background")
    if backgrounds:
        sections.append("## Backgrounds")
        for e in sorted(backgrounds, key=lambda x: x.get("name", "")):
            sections.append(fmt_background(e))
        sections.append("")

    # Feats
    feats = load_filtered("feat")
    if feats:
        sections.append("## Feats")
        for e in sorted(feats, key=lambda x: x.get("name", "")):
            sections.append(fmt_feat(e))
        sections.append("")

    # Classes (multi-line per class)
    cls_section = build_class_section(FILTERED_DIR)
    if cls_section.strip():
        sections.append("## Classes")
        sections.append(cls_section)
        sections.append("")

    # Optional features — DM tier only (too granular for player quick-ref)
    if mode == "dm":
        optfeats = load_filtered("optionalfeature")
        if optfeats:
            sections.append("## Optional Features (Invocations, Maneuvers, etc.)")
            for e in sorted(optfeats, key=lambda x: x.get("name", "")):
                sections.append(fmt_optfeature(e))
            sections.append("")

    # Spells — DM tier only; player can reference PHB directly
    if mode == "dm":
        spells = load_filtered("spell")
        if spells:
            sections.append("## Spells")
            by_level: dict[int, list] = {}
            for e in spells:
                lvl = e.get("level", 0)
                by_level.setdefault(lvl, []).append(e)
            for lvl in sorted(by_level):
                lvl_label = "Cantrips" if lvl == 0 else f"Level {lvl}"
                sections.append(f"\n### {lvl_label}")
                for e in sorted(by_level[lvl], key=lambda x: x.get("name", "")):
                    lvl_s  = "C" if e.get("level", 0) == 0 else str(e.get("level", 0))
                    school = SCHOOL.get(e.get("school", "?"), e.get("school", "?"))
                    conc   = "[C]" if e.get("concentration") else ""
                    rit    = "[R]" if e.get("ritual") else ""
                    flags  = "".join(filter(None, [conc, rit]))
                    flags  = " " + flags if flags else ""
                    desc   = extract_text(e.get("entries", []), 70)
                    sections.append(f"**{e['name']}** ({lvl_s}/{school}{flags}) — {desc}")
            sections.append("")

    # Monsters — DM tier only (too large for player reference)
    if mode == "dm":
        monsters = load_filtered("monster")
        if monsters:
            sections.append("## Monsters")
            by_type: dict[str, list] = {}
            for e in monsters:
                mtype = e.get("type", "unknown")
                if isinstance(mtype, dict):
                    mtype = mtype.get("type", "unknown")
                by_type.setdefault(str(mtype).title(), []).append(e)
            for mtype in sorted(by_type):
                sections.append(f"\n### {mtype}")
                for e in sorted(by_type[mtype], key=lambda x: x.get("name", "")):
                    sections.append(fmt_monster(e))
            sections.append("")

    # Magic items — DM tier only (player can ask the chatbot about specific items)
    if mode == "dm":
        ITEM_SKIP_RARITIES_DM = {"none"}
        skip_rarities = ITEM_SKIP_RARITIES_DM
        items = load_filtered("item")
    else:
        items = []
    if items:
        sections.append("## Magic Items")
        rarity_order = ["uncommon", "rare", "very rare", "legendary", "artifact", "unknown (magic)", "varies"]
        by_rarity: dict[str, list] = {}
        for e in items:
            r = e.get("rarity", "unknown").lower()
            if r in skip_rarities:
                continue
            by_rarity.setdefault(r, []).append(e)
        for r in rarity_order:
            if r not in by_rarity:
                continue
            sections.append(f"\n### {r.title()}")
            for e in sorted(by_rarity[r], key=lambda x: x.get("name", "")):
                sections.append(fmt_item(e))
        for r, entries in sorted(by_rarity.items()):
            if r in rarity_order:
                continue
            sections.append(f"\n### {r.title()}")
            for e in sorted(entries, key=lambda x: x.get("name", "")):
                sections.append(fmt_item(e))
        sections.append("")

    # Variant rules (DM only — they're mostly optional rules)
    if mode == "dm":
        rules = load_filtered("variantrule")
        if rules:
            sections.append("## Variant Rules")
            for e in sorted(rules, key=lambda x: x.get("name", "")):
                sections.append(fmt_variantrule(e))
            sections.append("")

    return "\n".join(sections)


# ── Main ─────────────────────────────────────────────────────────────────────

def token_estimate(text: str) -> int:
    return len(text) // 4


def main():
    print("Building tier1_player.md …")
    player_text = build_tier("player")
    PLAYER_OUT.write_text(player_text, encoding="utf-8")
    ptokens = token_estimate(player_text)
    print(f"  → {PLAYER_OUT.name}  {len(player_text):,} chars  ~{ptokens:,} tokens")

    print("Building tier1_dm.md …")
    dm_text = build_tier("dm")
    DM_OUT.write_text(dm_text, encoding="utf-8")
    dtokens = token_estimate(dm_text)
    print(f"  → {DM_OUT.name}  {len(dm_text):,} chars  ~{dtokens:,} tokens")


if __name__ == "__main__":
    main()
