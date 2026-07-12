"""Parse the seven questionaire/record-*.html files into one JSON data
source: shared Part I questions + roll tables factored out once, and the
per-character Part II questions, vitals dossier, and header meta."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "questionaire"

# char key -> roster player_name (must match _data/players.json "name")
PLAYERS = {
    "car": 'Caravel "Car" Asteri',
    "kryton": "Kryton Novelli",
    "lotan": "Lotan",
    "noname": "Noname",
    "orabella": "Orabella",
    "roxy": 'Roxanya "Roxy"',
    "valentro": "Valentro",
}


def text_of(fragment):
    """Strip tags and collapse whitespace, unescaping entities."""
    no_tags = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(re.sub(r"\s+", " ", no_tags)).strip()


def parse_record(path):
    src = path.read_text()
    key = path.stem.replace("record-", "")

    name = text_of(re.search(r"<h1>(.*?)</h1>", src, re.S).group(1))
    role = text_of(re.search(r'<p class="role">(.*?)</p>', src, re.S).group(1))
    intro = text_of(re.search(r'<p class="intro">(.*?)</p>', src, re.S).group(1))
    aside = text_of(re.search(r'<p class="aside">(.*?)</p>', src, re.S).group(1))

    # ── Part I + Part II: <div class="field"> blocks ──────────────────
    part1, part2 = [], []
    for label_html, field_name, rows in re.findall(
        r'<div class="field">\s*<label for="[^"]*">(.*?)</label>\s*'
        r'<textarea id="[^"]*" name="([^"]+)" rows="(\d+)">',
        src, re.S,
    ):
        field_name = html.unescape(field_name)
        prompt_html = re.sub(r'<span class="num">\d+</span>', "", label_html)
        strong = re.search(r"<strong>(.*?)</strong>", prompt_html, re.S)
        entry = {"key": field_name, "prompt": text_of(prompt_html)}
        if field_name.startswith("P1 - "):
            part1.append(entry)
        elif field_name.startswith("P2 - "):
            if strong:
                entry["title"] = text_of(strong.group(1)).rstrip(".")
                entry["prompt"] = text_of(
                    prompt_html.replace(strong.group(0), "")
                )
            part2.append(entry)

    # ── Part III vitals: groups of vfields ─────────────────────────────
    part3_src = src.split('<span class="roman">III</span>')[1].split(
        '<section class="part coda">'
    )[0]
    vitals = []
    group = None
    token_re = re.compile(
        r'<h3 class="vgroup">(?P<group>.*?)</h3>'
        r'|<div class="vfield(?P<wide> wide)?">\s*<label>(?P<label>.*?)</label>\s*'
        r"(?P<body>.*?)</div>",
        re.S,
    )
    for m in token_re.finditer(part3_src):
        if m.group("group"):
            group = {"group": text_of(m.group("group")), "fields": []}
            vitals.append(group)
            continue
        label_html = m.group("label")
        body = m.group("body")
        input_m = re.search(
            r'<input id="[^"]*" type="text" name="([^"]+)"([^>]*)>', body
        )
        if not input_m or group is None:
            continue
        field_name = html.unescape(input_m.group(1))
        attrs = input_m.group(2)
        value_m = re.search(r'value="([^"]*)"', attrs)
        placeholder_m = re.search(r'placeholder="([^"]*)"', attrs)
        roll_m = re.search(r'data-table="([^"]+)"', body)
        field = {
            "key": field_name,
            "label": text_of(re.sub(r"<button.*?</button>", "", re.sub(
                r'<span class="onfile">.*?</span>', "", label_html, flags=re.S
            ), flags=re.S)),
            "wide": bool(m.group("wide")),
        }
        if 'readonly' in attrs:
            field["onFile"] = True
        if value_m:
            field["value"] = html.unescape(value_m.group(1))
        if placeholder_m and placeholder_m.group(1) not in ("…", ""):
            field["placeholder"] = html.unescape(placeholder_m.group(1))
        if roll_m:
            field["roll"] = roll_m.group(1)
        group["fields"].append(field)

    tables = json.loads(re.search(r"var TABLES = (\{.*?\});", src, re.S).group(1))

    return key, {
        "player": PLAYERS[key],
        "name": name,
        "role": role,
        "intro": intro,
        "aside": aside,
        "part2": part2,
        "vitals": vitals,
    }, part1, tables


characters = {}
shared_part1 = None
shared_tables = None
for path in sorted(SRC.glob("record-*.html")):
    key, char, part1, tables = parse_record(path)
    characters[key] = char
    if shared_part1 is None:
        shared_part1, shared_tables = part1, tables
    else:
        assert part1 == shared_part1, f"Part I differs in {path.name}"
        assert tables == shared_tables, f"Tables differ in {path.name}"

out = {
    "part1": shared_part1,
    "tables": shared_tables,
    "codaKey": "Anything else",
    "codaPrompt": (
        "Loose ideas, questions for me, lines you want your character to say, "
        "things you're unsure about. Whatever you like."
    ),
    "characters": characters,
}
dest = ROOT / "_data" / "questionnaire.json"
dest.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
counts = {k: (len(v["part2"]), sum(len(g["fields"]) for g in v["vitals"])) for k, v in characters.items()}
print("part1:", len(shared_part1), "| per-char (part2, vitals):", counts)
print("wrote", dest, dest.stat().st_size, "bytes")
