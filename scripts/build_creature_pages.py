"""Give the homebrew bestiary wiki pages.

Thirteen creatures live only in campaign-data/curated/homebrew.json. That file
feeds Foundry, and nothing else reads it — so the Vivo a Masquerade bard is
told to turn into has no page, no search result, and nothing for Enzo to
retrieve. Asked what a Vivo is, he answered with the cleric's Life Domain.

Everything here is a transcription. Numbers, traits and actions come from the
brew; the only text this script writes is the frontmatter description, which
restates the creature's own type and challenge rating. Nothing is invented,
because the campaign's standing rule is that invention needs sign-off and a
stat block is exactly the wrong place to guess.

The markup matches the existing creature pages so a homebrew fiend and a
Monster Manual pixie read as the same kind of page.

    python3 scripts/build_creature_pages.py --check
    python3 scripts/build_creature_pages.py
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOMEBREW = ROOT / "campaign-data" / "curated" / "homebrew.json"

TYPE_HOME = {
    "fey": "Venturia/Creatures/Fey",
    "fiend": "Venturia/Creatures/Fiends",
    "celestial": "Venturia/Creatures/Celestials",
    "humanoid": "Venturia/Creatures/Humanoids",
    "beast": "Venturia/Creatures/Beasts",
    "undead": "Venturia/Creatures/Undead",
    "construct": "Venturia/Creatures/Constructs",
}

# The index pages are plural, except fey, which already is. Deriving the link
# by appending an "s" gives /celestial and /humanoid, which are 404s.
TYPE_INDEX = {
    "fey": ("Fey", "fey"),
    "fiend": ("Fiends", "fiends"),
    "celestial": ("Celestials", "celestials"),
    "humanoid": ("Humanoids", "humanoids"),
}

# The four types a Masquerade bard can take the form of, which is why most of
# these creatures exist. The existing creature pages carry the same link.
MASQUERADE_FORMS = {"fey", "fiend", "celestial", "humanoid"}
MASQUERADE_LINK = "[Car: Masquerade Forms](/en/Venturia/College-of-the-Masquerade-Bard/car-masquerade-forms)"

SIZES = {"T": "Tiny", "S": "Small", "M": "Medium",
         "L": "Large", "H": "Huge", "G": "Gargantuan"}

ALIGNMENTS = {
    "L": "Lawful", "N": "Neutral", "C": "Chaotic",
    "G": "Good", "E": "Evil", "U": "Unaligned", "A": "Any Alignment",
}
ALIGNMENT_PAIRS = {
    ("L", "G"): "Lawful Good", ("N", "G"): "Neutral Good", ("C", "G"): "Chaotic Good",
    ("L", "N"): "Lawful Neutral", ("N", "N"): "Neutral", ("C", "N"): "Chaotic Neutral",
    ("L", "E"): "Lawful Evil", ("N", "E"): "Neutral Evil", ("C", "E"): "Chaotic Evil",
}

XP_BY_CR = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700,
    "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
    "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000,
    "17": 18000, "18": 20000, "19": 22000, "20": 25000,
}

ABILITIES = ("str", "dex", "con", "int", "wis", "cha")
ACCENT = "#58180d"

DIVIDER = (
    '<svg height="9" width="100%" xmlns="http://www.w3.org/2000/svg" '
    'preserveAspectRatio="none" viewBox="0 0 450 9" style="display:block;">\n'
    f'  <polygon points="0,0 225,4.5 450,0" fill="{ACCENT}"/>\n'
    f'  <polygon points="0,9 225,4.5 450,9" fill="{ACCENT}"/>\n'
    '</svg>'
)


# ── 5etools text ──────────────────────────────────────────────────────

def detag(text):
    """{@damage 2d6} and friends down to the words a reader needs."""
    text = str(text)
    # A save DC keeps its label: "{@dc 12}" is "DC 12", not a loose 12 in the
    # middle of a sentence about saving throws.
    text = re.sub(r"\{@dc\s+([^}|]+)(?:\|[^}]*)?\}", r"DC \1", text)
    text = re.sub(r"\{@hit\s+([+-]?\d+)(?:\|[^}]*)?\}", r"+\1", text)
    text = re.sub(r"\{@(?:damage|dice|scaledamage|scaledice)\s+([^}|]+)(?:\|[^}]*)?\}", r"\1", text)
    text = re.sub(r"\{@(?:b|bold)\s+([^}]+)\}", r"<strong>\1</strong>", text)
    text = re.sub(r"\{@(?:i|italic)\s+([^}]+)\}", r"<em>\1</em>", text)
    text = re.sub(r"\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}", r"\1", text)
    return text.strip()


def flatten(entries):
    """Entry trees to one string of sentences."""
    out = []
    for entry in entries or []:
        if isinstance(entry, str):
            out.append(detag(entry))
        elif isinstance(entry, dict):
            if entry.get("name"):
                out.append(f"<strong>{detag(entry['name'])}.</strong>")
            out.append(flatten(entry.get("entries")))
            for item in entry.get("items", []) or []:
                out.append(flatten([item]))
    return " ".join(p for p in out if p)


def modifier(score):
    value = (int(score) - 10) // 2
    return f"+{value}" if value >= 0 else str(value)


def escape(text):
    return (str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ── Statblock fields ──────────────────────────────────────────────────

def type_line(monster):
    size = "/".join(SIZES.get(s, s) for s in (monster.get("size") or ["M"]))
    kind = monster.get("type")
    if isinstance(kind, dict):
        name = kind.get("type", "creature")
        tags = kind.get("tags") or []
        kind = f"{name} ({', '.join(tags)})" if tags else name
    align = monster.get("alignment") or []
    if len(align) == 2 and tuple(align) in ALIGNMENT_PAIRS:
        alignment = ALIGNMENT_PAIRS[tuple(align)]
    else:
        alignment = " ".join(ALIGNMENTS.get(a, str(a)) for a in align)
    return f"{size} {str(kind).title()}{', ' + alignment if alignment else ''}"


def armour(monster):
    first = (monster.get("ac") or [{}])[0]
    if isinstance(first, int):
        return str(first)
    value = first.get("ac", "—")
    source = ", ".join(first.get("from") or [])
    return f"{value} ({source})" if source else str(value)


def hit_points(monster):
    hp = monster.get("hp") or {}
    if hp.get("formula"):
        return f"{hp.get('average', '—')} ({hp['formula']})"
    return str(hp.get("average") or hp.get("special") or "—")


def speed(monster):
    raw = monster.get("speed") or {}
    if isinstance(raw, (int, str)):
        return f"{raw} ft."
    parts = []
    for mode in ("walk", "burrow", "climb", "fly", "swim"):
        if mode in raw:
            value = raw[mode]
            value = value.get("number") if isinstance(value, dict) else value
            parts.append(f"{value} ft." if mode == "walk" else f"{mode.title()} {value} ft.")
    return ", ".join(parts) or "—"


def challenge(monster):
    cr = monster.get("cr")
    if isinstance(cr, dict):
        cr = cr.get("cr")
    cr = str(cr or "—")
    xp = XP_BY_CR.get(cr)
    numeric = {"0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5}.get(cr)
    if numeric is None:
        try:
            numeric = float(cr)
        except ValueError:
            numeric = 0
    bonus = 2 + max(0, (int(numeric) - 1) // 4) if numeric >= 5 else 2
    return cr, (f"{cr} ({xp:,} XP)" if xp else cr), f"+{bonus}"


def properties(monster):
    rows = []
    saves = monster.get("save") or {}
    if saves:
        rows.append(("Saving Throws", ", ".join(
            f"{k.upper()} {v}" for k, v in saves.items())))
    skills = monster.get("skill") or {}
    if skills:
        rows.append(("Skills", ", ".join(
            f"{k.title()} {v}" for k, v in skills.items())))
    for key, label in (("resist", "Resistances"), ("immune", "Immunities"),
                       ("vulnerable", "Vulnerabilities"), ("conditionImmune", "Condition Immunities")):
        values = monster.get(key) or []
        flat = [v if isinstance(v, str) else str(v) for v in values]
        if flat:
            rows.append((label, ", ".join(flat).title()))
    senses = list(monster.get("senses") or [])
    senses.append(f"Passive Perception {monster.get('passive', '—')}")
    rows.append(("Senses", ", ".join(senses)))
    languages = monster.get("languages") or []
    rows.append(("Languages", ", ".join(languages) if languages else "—"))
    return rows


def block(title, entries):
    if not entries:
        return ""
    head = (f'<div style="color:{ACCENT};font-size:1rem;font-variant:small-caps;'
            'font-weight:bold;letter-spacing:0.06em;border-bottom:1px solid '
            f'{ACCENT};padding-bottom:0.15rem;margin:0 0 0.5rem;">{title}</div>') if title else ""
    lines = []
    for entry in entries:
        name = detag(entry.get("name", ""))
        text = flatten(entry.get("entries"))
        lines.append('<div style="margin:0 0 0.35rem;font-size:0.85rem;line-height:1.65;">'
                     f'<strong><em>{name}.</em></strong> {text}</div>')
    return (f'<div style="padding:0.4rem 1rem 0;">{head}' + "".join(lines) + "</div>")


def statblock(monster):
    cr, cr_label, prof = challenge(monster)
    scores = "".join(
        '<div style="flex:1;">'
        f'<div style="color:{ACCENT};font-weight:bold;font-size:0.75rem;letter-spacing:0.04em;">{a.upper()}</div>'
        f'<div>{monster.get(a, 10)} ({modifier(monster.get(a, 10))})</div></div>'
        for a in ABILITIES)

    props = "".join(f"<div><strong>{label}</strong> {escape(value)}</div>"
                    for label, value in properties(monster))

    parts = [
        '<div style="font-family:\'Noto Serif\',Georgia,\'Times New Roman\',serif;'
        'background:#fdf1dc;border-left:2px solid ' + ACCENT + ';border-right:2px solid ' + ACCENT + ';'
        'max-width:450px;box-shadow:2px 3px 12px rgba(0,0,0,0.4);margin:1.5rem 0;'
        'color:#1a0a00;line-height:1.4;">',
        f'<div style="background:{ACCENT};height:7px;"></div>',
        '<div style="padding:0.6rem 1rem 0.25rem;">'
        f'<div style="color:{ACCENT};font-size:1.5rem;font-weight:bold;margin:0;'
        f'line-height:1.15;letter-spacing:0.01em;">{escape(monster["name"])}</div>'
        f'<div style="font-style:italic;font-size:0.82rem;color:{ACCENT};margin:0.1rem 0 0;">'
        f'{escape(type_line(monster))}</div></div>',
        DIVIDER,
        '<div style="padding:0.3rem 1rem;font-size:0.85rem;line-height:2.0;">'
        f'<div><strong>Armor Class</strong> {escape(armour(monster))}</div>'
        f'<div><strong>Hit Points</strong> {escape(hit_points(monster))}</div>'
        f'<div><strong>Speed</strong> {escape(speed(monster))}</div></div>',
        DIVIDER,
        f'<div style="display:flex;text-align:center;padding:0.5rem 0.5rem;font-size:0.82rem;">{scores}</div>',
        DIVIDER,
        f'<div style="padding:0.3rem 1rem;font-size:0.85rem;line-height:2.0;">{props}'
        f'<div><strong>Challenge</strong> {cr_label} &nbsp;|&nbsp; '
        f'<strong>Proficiency Bonus</strong> {prof}</div></div>',
        DIVIDER,
    ]

    for title, key in (("", "trait"), ("Actions", "action"),
                       ("Bonus Actions", "bonus"), ("Reactions", "reaction")):
        rendered = block(title, monster.get(key))
        if rendered:
            parts.append(rendered)
            parts.append(DIVIDER)

    if monster.get("legendary"):
        header = flatten(monster.get("legendaryHeader"))
        parts.append(
            f'<div style="padding:0.4rem 1rem 0;">'
            f'<div style="color:{ACCENT};font-size:1rem;font-variant:small-caps;font-weight:bold;'
            f'letter-spacing:0.06em;border-bottom:1px solid {ACCENT};padding-bottom:0.15rem;'
            'margin:0 0 0.5rem;">Legendary Actions</div>'
            f'<div style="margin:0 0 0.5rem;font-size:0.85rem;line-height:1.65;">{header}</div></div>')
        parts.append(block("", monster["legendary"]))
        parts.append(DIVIDER)

    if parts[-1] == DIVIDER:
        parts.pop()
    parts.append(f'<div style="background:{ACCENT};height:7px;"></div>')
    parts.append("</div>")
    return "\n\n".join(parts)


def lore(monster):
    """The creature's own fluff, as prose under the block."""
    entries = ((monster.get("fluff") or {}).get("entries")) or []
    out = []
    for entry in entries:
        if isinstance(entry, dict) and entry.get("name"):
            out.append(f"## {detag(entry['name'])}")
            out.append(flatten(entry.get("entries")))
        elif isinstance(entry, str):
            out.append(detag(entry))
    return "\n\n".join(out)


def slugify(value):
    value = re.sub(r"['’]", "", value.lower())
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def render(monster):
    kind = monster.get("type")
    kind = kind.get("type") if isinstance(kind, dict) else kind
    cr, _, _ = challenge(monster)
    tags = ["stat-block", "homebrew", kind, f"cr{cr.replace('/', '_')}"]

    body = lore(monster)
    label, index = TYPE_INDEX.get(kind, ("Creatures", ""))
    crumbs = f"[{label}](/en/Venturia/Creatures/{index})"
    if kind in MASQUERADE_FORMS:
        crumbs += f" | {MASQUERADE_LINK}"
    return (
        "---\n"
        f'title: "{monster["name"]}"\n'
        f"description: Stat block for the {monster['name']} — {type_line(monster)}. CR {cr}.\n"
        "published: true\n"
        f"tags: {', '.join(t for t in tags if t)}\n"
        "editor: markdown\n"
        "---\n\n"
        f"*← {crumbs}*\n\n"
        "---\n\n"
        + statblock(monster) + "\n\n"
        + (body + "\n" if body else "")
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report without writing")
    args = parser.parse_args()

    monsters = json.loads(HOMEBREW.read_text(encoding="utf-8")).get("monster", [])
    if not monsters:
        raise SystemExit("No monsters in homebrew.json")

    written = []
    for monster in monsters:
        kind = monster.get("type")
        kind = kind.get("type") if isinstance(kind, dict) else kind
        home = TYPE_HOME.get(kind)
        if not home:
            print(f"  skip  {monster['name']}: unmapped type {kind!r}")
            continue
        path = ROOT / home / f"{slugify(monster['name'])}.md"
        if not args.check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(render(monster), encoding="utf-8")
        written.append((monster["name"], str(path.relative_to(ROOT))))

    for name, path in written:
        print(f"  {'would write' if args.check else 'wrote':11} {name:24} {path}")
    print(f"\n{len(written)} creature page(s)" + (" (--check)" if args.check else ""))


if __name__ == "__main__":
    main()
