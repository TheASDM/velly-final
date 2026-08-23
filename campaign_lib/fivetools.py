"""5etools text normalization shared by campaign builders."""

from __future__ import annotations

import re

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
