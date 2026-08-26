"""Build the reference data the playable sheet needs on a phone.

Two problems this solves.

The spell file is 473KB of everything, and a player preparing spells at a table
needs one class's list with enough detail to choose — not every spell in the
game with its full rules text. So this emits one trimmed index per class,
resolved from the sublists in campaign-data/curated.

The condition text is the book's, and at this table it is wrong. Exhaustion is
house-ruled into the death clock and Dying replaces unconsciousness, so those
two entries come from House-Rules/simplification.md instead of XPHB. Shipping
the book's version would have the app quietly contradict the rules everyone is
playing by.

    python3 scripts/build_play_data.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from campaign_lib.fivetools import flatten_entries, strip_5e_tags  # noqa: E402

CURATED = ROOT / "campaign-data" / "curated"
FILTERED = ROOT / "campaign-data" / "5e-filtered"
OUT = ROOT / "public" / "data" / "play"

CLASS_LISTS = ["bard", "cleric", "ranger", "warlock", "wizard"]

SCHOOLS = {
    "A": "Abjuration", "C": "Conjuration", "D": "Divination", "E": "Enchantment",
    "V": "Evocation", "I": "Illusion", "N": "Necromancy", "T": "Transmutation",
}

# Exhaustion and Dying as this table plays them, not as the book writes them.
HOUSE_CONDITIONS = {
    "exhaustion": {
        "name": "Exhaustion",
        "houseRuled": True,
        "text": (
            "Subtract 2 x your Exhaustion points from all d20 tests. Movement is reduced "
            "by 5 feet per point. A character dies at 6 points. You recover 1 point per "
            "Long Rest. This is in addition to the 2024 exhaustion rules."
        ),
    },
    "dying": {
        "name": "Dying",
        "houseRuled": True,
        "text": (
            "You act normally on your turn — action, bonus action, movement — but "
            "concentration is broken, you make a DC 10 Constitution save or take 1 point "
            "of Exhaustion when you take an action or bonus action that does not heal you, "
            "and taking damage causes 2 points of Exhaustion (3 on a critical hit). "
            "There is no unconsciousness and no death saving throws."
        ),
    },
}


def spell_hash(name, source):
    """5etools sublist hash. Spaces and slashes are escaped; apostrophes are not."""
    return name.replace(" ", "%20").replace("/", "%2f").lower() + "_" + str(source).lower()


def load_spell_index():
    index = {}
    for path in [FILTERED / "spells-xphb.json", CURATED / "homebrew.json"]:
        if not path.exists():
            continue
        for spell in json.loads(path.read_text(encoding="utf-8")).get("spell", []):
            index[spell_hash(spell["name"], spell.get("source"))] = spell
    return index


def casting_time(spell):
    times = spell.get("time") or []
    if not times:
        return ""
    first = times[0]
    unit = first.get("unit", "")
    number = first.get("number", 1)
    label = {"bonus": "Bonus Action", "action": "Action", "reaction": "Reaction"}.get(unit, unit.title())
    return label if number == 1 else f"{number} {label}s"


def spell_range(spell):
    rng = spell.get("range") or {}
    kind = rng.get("type")
    distance = rng.get("distance") or {}
    if kind == "point":
        if distance.get("type") == "self":
            return "Self"
        if distance.get("type") == "touch":
            return "Touch"
        if distance.get("amount"):
            return f"{distance['amount']} {distance.get('type', 'feet')}"
        return (distance.get("type") or "").title()
    if kind in {"radius", "sphere", "cone", "line", "cube", "hemisphere"}:
        return f"Self ({distance.get('amount', '')} ft {kind})".replace("  ", " ")
    return (kind or "").title()


def duration(spell):
    entries = spell.get("duration") or []
    if not entries:
        return ""
    first = entries[0]
    kind = first.get("type")
    if kind == "instant":
        return "Instantaneous"
    if kind == "permanent":
        return "Until dispelled"
    if kind == "special":
        return "Special"
    amount = (first.get("duration") or {})
    text = f"{amount.get('amount', '')} {amount.get('type', '')}".strip()
    return ("Concentration, " + text) if first.get("concentration") else text


def components(spell):
    comp = spell.get("components") or {}
    parts = [key.upper() for key in ("v", "s") if comp.get(key)]
    if comp.get("m"):
        parts.append("M")
    return ", ".join(parts)


def concentrates(spell):
    return any((d or {}).get("concentration") for d in (spell.get("duration") or []))


def trim(spell):
    """Only what the picker and the reading pane need."""
    return {
        "name": spell["name"],
        "source": spell.get("source"),
        "level": spell.get("level", 0),
        "school": SCHOOLS.get(spell.get("school"), spell.get("school") or ""),
        "time": casting_time(spell),
        "range": spell_range(spell),
        "components": components(spell),
        "duration": duration(spell),
        "concentration": concentrates(spell),
        "ritual": bool((spell.get("meta") or {}).get("ritual")),
        "text": strip_5e_tags(flatten_entries(spell.get("entries"))),
    }


def prepared_table(class_name):
    """The Prepared Spells column, level 1 to 20."""
    path = FILTERED / f"class-{class_name}.json"
    if not path.exists():
        return None
    for entry in json.loads(path.read_text(encoding="utf-8")).get("class", []):
        if entry.get("source") != "XPHB":
            continue
        for group in entry.get("classTableGroups", []):
            labels = [str(x) for x in group.get("colLabels", [])]
            for i, label in enumerate(labels):
                if "Prepared" in label:
                    return [row[i] for row in group.get("rows", [])]
    return None


def build_conditions():
    path = FILTERED / "conditionsdiseases.json"
    out = {}
    for condition in json.loads(path.read_text(encoding="utf-8")).get("condition", []):
        if condition.get("source") != "XPHB":
            continue
        key = condition["name"].lower()
        out[key] = {
            "name": condition["name"],
            "houseRuled": False,
            "text": strip_5e_tags(flatten_entries(condition.get("entries"))),
        }
    out.update(HOUSE_CONDITIONS)          # the book loses to the house
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = load_spell_index()

    conditions = build_conditions()
    (OUT / "conditions.json").write_text(
        json.dumps(conditions, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    house = sum(1 for c in conditions.values() if c["houseRuled"])
    print(f"  conditions.json      {len(conditions)} ({house} house-ruled)")

    total_missing = []
    for class_name in CLASS_LISTS:
        path = CURATED / f"{class_name}.json"
        if not path.exists():
            print(f"  skip {class_name}: no list", file=sys.stderr)
            continue
        items = json.loads(path.read_text(encoding="utf-8")).get("items", [])
        spells, missing = [], []
        for item in items:
            spell = index.get(item.get("h"))
            (spells.append(trim(spell)) if spell else missing.append(item.get("h")))
        spells.sort(key=lambda s: (s["level"], s["name"]))

        payload = {
            "class": class_name,
            "prepared": prepared_table(class_name),
            "spells": spells,
        }
        target = OUT / f"spells-{class_name}.json"
        target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                          encoding="utf-8")
        size = target.stat().st_size // 1024
        print(f"  spells-{class_name}.json{'':<{max(0, 7 - len(class_name))}} "
              f"{len(spells):3}/{len(items):3} spells  {size:3}KB"
              + (f"  ({len(missing)} unresolved)" if missing else ""))
        total_missing += missing

    if total_missing:
        sources = sorted({h.rsplit("_", 1)[-1] for h in total_missing})
        print(f"\n  {len(total_missing)} spell(s) unresolved, from: {', '.join(sources)}",
              file=sys.stderr)
        print("  Add the source file to campaign-data/5e-filtered to include them.",
              file=sys.stderr)


if __name__ == "__main__":
    main()
