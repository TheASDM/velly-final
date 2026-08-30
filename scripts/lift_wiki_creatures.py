"""Lift hand-built wiki statblocks into structured creature data.

Six of Car's Masquerade forms exist only as styled HTML on their wiki pages, so
the app has nothing to swap her sheet to. The pages are hand-written but
regular — the same section comments and the same `<strong>Label</strong> value`
shape every time — so they parse reliably.

Output is a 5etools-shaped monster file, which is what the rest of the campaign
data already looks like, so nothing downstream needs to learn a new format.

    python3 scripts/lift_wiki_creatures.py            # write the file
    python3 scripts/lift_wiki_creatures.py --check    # parse and report only
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "campaign-data" / "curated" / "creatures-lifted.json"

# Pages to lift, and the creature type the forms reference expects.
PAGES = [
    ("Venturia/Creatures/Fey/fairy.md", "fey"),
    ("Venturia/Creatures/Fey/quickling.md", "fey"),
    ("Venturia/Creatures/Fiends/abyssal-wretch.md", "fiend"),
    ("Venturia/Creatures/Fiends/nupperibo.md", "fiend"),
    ("Venturia/Creatures/Fiends/maw-demon.md", "fiend"),
    ("Venturia/Creatures/Fiends/vargouille.md", "fiend"),
]

SIZES = {
    "tiny": "T", "small": "S", "medium": "M",
    "large": "L", "huge": "H", "gargantuan": "G",
}
ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]


def section(text, name):
    """Everything between one <!-- NAME --> comment and the next comment."""
    match = re.search(rf"<!--\s*{name}\s*-->(.*?)(?=<!--|\Z)", text, re.S | re.I)
    return match.group(1) if match else ""


def strip_tags(fragment):
    fragment = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(fragment).replace("\xa0", " ").strip()


def labelled(fragment):
    """{label: value} for every `<strong>Label</strong> value` in a block.

    The Challenge line packs two labels onto one row, so values are cut at the
    next <strong> rather than at the end of the div.
    """
    out = {}
    for match in re.finditer(r"<strong>(.*?)</strong>(.*?)(?=<strong>|</div>)", fragment, re.S | re.I):
        label = strip_tags(match.group(1)).rstrip(".").strip()
        value = strip_tags(match.group(2)).strip(" |")
        if label:
            out[label] = value
    return out


def entries(fragment):
    """Trait/action rows: `<strong><em>Name.</em></strong> body`."""
    found = []
    for match in re.finditer(
        r"<strong><em>(.*?)</em></strong>(.*?)(?=<div[^>]*margin|</div>)", fragment, re.S | re.I
    ):
        name = strip_tags(match.group(1)).rstrip(".").strip()
        body = strip_tags(match.group(2)).strip()
        if name and body:
            found.append({"name": name, "entries": [body]})
    return found


def parse_cr(value):
    """'1 (200 XP)' -> '1'; keeps fractions as written."""
    match = re.match(r"\s*([\d/]+)", value or "")
    return match.group(1) if match else None


def parse_speed(value):
    """'120 ft.' or '30 ft., fly 60 ft.' -> {walk: 120} / {walk: 30, fly: 60}."""
    speed = {}
    for part in (value or "").split(","):
        part = part.strip()
        m = re.match(r"(?:(\w+)\s+)?(\d+)\s*ft", part, re.I)
        if not m:
            continue
        speed[(m.group(1) or "walk").lower()] = int(m.group(2))
    return speed or None


def parse_abilities(fragment):
    """The six scores sit in flex cells as `STR` then `4 (-3)`."""
    scores = {}
    plain = strip_tags(re.sub(r"</div>", " | ", fragment))
    for ability in ABILITIES:
        m = re.search(rf"\b{ability.upper()}\b\s*\|?\s*(\d+)", plain, re.I)
        if m:
            scores[ability] = int(m.group(1))
    return scores


def parse_page(path, expected_type):
    text = (ROOT / path).read_text(encoding="utf-8")

    head = section(text, "NAME & TYPE")
    lines = [strip_tags(d) for d in re.findall(r"<div[^>]*>(.*?)</div>", head, re.S)]
    lines = [line for line in lines if line]
    if len(lines) < 2:
        raise ValueError(f"{path}: could not read name/type")
    name, descriptor = lines[0], lines[1]

    # "Tiny Fey, Chaotic Evil"
    m = re.match(r"(\w+)\s+([\w\s]+?),\s*(.+)", descriptor)
    if not m:
        raise ValueError(f"{path}: could not parse {descriptor!r}")
    size, ctype, alignment = m.group(1), m.group(2).strip(), m.group(3).strip()

    core = labelled(section(text, "CORE STATS"))
    props = labelled(section(text, "PROPERTIES"))
    scores = parse_abilities(section(text, "ABILITY SCORES"))

    monster = {
        "name": name,
        "source": "VoSWiki",
        "size": [SIZES.get(size.lower(), "M")],
        "type": ctype.lower(),
        "alignment": [alignment],
        "ac": [int(re.search(r"\d+", core.get("Armor Class", "0")).group())],
        "hp": {"average": int(re.search(r"\d+", core.get("Hit Points", "0")).group())},
        "speed": parse_speed(core.get("Speed")),
        **scores,
        "cr": parse_cr(props.get("Challenge")),
        "_lifted": {"from": str(path), "note": "parsed from the wiki statblock"},
    }

    for key, field in (("Skills", "skill_raw"), ("Senses", "senses_raw"),
                       ("Languages", "languages_raw"), ("Resistances", "resist_raw"),
                       ("Immunities", "immune_raw")):
        if props.get(key):
            monster[field] = props[key]

    traits = entries(section(text, "TRAITS"))
    actions = entries(section(text, "ACTIONS"))
    if traits:
        monster["trait"] = traits
    if actions:
        monster["action"] = actions

    if monster["type"] != expected_type:
        print(f"  note  {name}: page says {monster['type']!r}, forms list says {expected_type!r}",
              file=sys.stderr)
    return monster


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="parse and report without writing")
    args = parser.parse_args()

    monsters, problems = [], []
    for path, ctype in PAGES:
        try:
            monsters.append(parse_page(path, ctype))
        except Exception as exc:  # noqa: BLE001 - report and continue
            problems.append(f"{path}: {exc}")

    for problem in problems:
        print(f"  FAIL  {problem}", file=sys.stderr)

    for m in monsters:
        bits = [f"CR {m['cr']}", f"AC {m['ac'][0]}", f"HP {m['hp']['average']}"]
        bits.append("/".join(str(m.get(a, "?")) for a in ABILITIES))
        bits.append(f"{len(m.get('trait', []))} traits")
        bits.append(f"{len(m.get('action', []))} actions")
        print(f"  {m['name']:18} {m['type']:8} " + "  ".join(bits))

    if problems:
        raise SystemExit(f"\n{len(problems)} page(s) failed to parse.")
    if args.check:
        print(f"\n{len(monsters)} parsed, nothing written (--check).")
        return

    OUT.write_text(json.dumps({
        "_meta": {
            "sources": [{
                "json": "VoSWiki",
                "abbreviation": "VoSWiki",
                "full": "Valley of Shadows wiki statblocks",
            }],
        },
        "monster": monsters,
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nwrote {OUT.relative_to(ROOT)} ({len(monsters)} creatures)")


if __name__ == "__main__":
    main()
