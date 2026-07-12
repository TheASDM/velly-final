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


# ── App-added roll tables (not in the source HTML) ─────────────────────
# Venturia/Seravalle-flavored. 16 entries each, matching eyes/marks.
EXTRA_TABLES = {
    "warding": [
        "A copper penny left at the Penny Shrine every new moon — no exceptions, even when rent is short.",
        "Never say the fog's name after dark; you call it 'the neighbor.'",
        "Two knocks on the gunwale before boarding any ferry, one more stepping off.",
        "A knot of red thread around the left wrist, retied every Masquerade week.",
        "Salt in the windowsill grooves, swept out and replaced whenever a stranger visits.",
        "Never let a mask rest face-down; something might settle into it.",
        "A whispered apology to the canal whenever you spit, drop, or lose something in it.",
        "The bread heel goes to the house spirit. It sits on a shelf going stale and you do not eat it.",
        "Cross the street rather than walk between two lit shrine-candles.",
        "Hold your breath passing the Covenant Archive doors — spoken words have weight near old contracts.",
        "A coin under the tongue when the fog bell rings, so nothing can take your voice.",
        "Never count the Fog Wardens on watch; counting them is said to call one away.",
        "Kiss two fingers and touch the lintel on leaving — once for going, twice if you mean to come back.",
        "Turn your coat inside out if you catch yourself humming a tune you don't remember learning.",
        "No whistling on the water after midnight. The Ferriers don't, and they know why.",
        "Burn the first page of every new notebook, so nothing you regret can be the first thing written.",
    ],
    "tells": [
        "Thumbs the old scar on one knuckle, over and over.",
        "Voice goes flat and pleasant, like a shopkeeper reciting prices.",
        "Can't stop straightening things — cuffs, cutlery, anything in reach.",
        "Laughs one beat too early.",
        "Goes very still, like prey that heard a twig snap.",
        "Picks at the wax under one fingernail.",
        "Eyes flick to the nearest exit, then studiously avoid it.",
        "Starts agreeing with everything, cheerfully, word for word.",
        "The accent slips — a vowel from somewhere else entirely.",
        "Rubs the back of the neck like something's breathing there.",
        "Talks faster and swears less.",
        "Suddenly needs both hands busy — a pipe, a coin, anything.",
        "Blinks too slowly, like each blink is being approved first.",
        "A smile that arrives before the joke and leaves after it.",
        "Cracks their knuckles one hand at a time, left first.",
        "Answers questions with questions until cornered.",
    ],
    "comforts": [
        "The first sip of scalding tea before anyone else in the house is awake.",
        "Warm bread from the Winecradle's ovens, eaten too fast to taste.",
        "Sitting on the seawall until the fog bell sounds and the lamps come up.",
        "Re-reading the same dog-eared letter for the hundredth time.",
        "The smell of lamp oil and old paper.",
        "A bath hot enough to hurt.",
        "Mending something small — a hem, a strap, a buckle — until your hands stop shaking.",
        "Listening to rain hit canal water from somewhere dry.",
        "The weight of a cat, dog, or gull that has decided you are furniture.",
        "Humming the one song somebody used to sing you.",
        "Polishing your boots like it's a ritual, because it is.",
        "A heel of cheese and a stolen hour on a rooftop.",
        "Wine warmed with cloves, drunk alone, no talking.",
        "Watching the Amaranth's stage door from across the canal, just to see who comes out.",
        "Counting your coin twice even when you know the number.",
        "Falling asleep to someone else's conversation through the wall.",
    ],
    "food": [
        "Eel stew from the Salted Cup, extra pepper, mop the bowl with bread.",
        "Cuttlefish-ink risotto, the kind that stains your teeth black for a day.",
        "Fried sardines off a dock cart, eaten standing up.",
        "Candied fennel from the Masquerade stalls, hoarded for months after.",
        "Winecradle red — the cheap barrel, not the good one. The good one's wasted on you.",
        "Salt-cod fritters, burn-your-fingers hot.",
        "Chestnut cake the way the Liminal House kitchens make it.",
        "Bitter shrine-coffee, black, in a cup you don't own.",
        "Grilled octopus with lemon you stole off someone's tree.",
        "Fog-morning porridge with a spoon of honey standing straight up in it.",
        "Anything from the Burnt Quill's kitchen, because the company is the point.",
        "Pickled onions straight from the jar, and you will not apologize.",
        "Whatever the Undertow calls soup that week. You've stopped asking.",
        "Spiced wine at the Echoing Court, once a year, in memory of someone.",
        "Hard cheese, hard bread, hard cider — deck rations, and honestly you miss them.",
        "Sugared violets you pretend are for somebody else.",
    ],
    "voice": [
        "Canal-quarter drawl, vowels flat as low tide.",
        "High Quarter finishing-school consonants, every letter paid for.",
        "Sailor's rasp — salt, rope, and shouting over weather.",
        "Soft Liminal House hush, like every room might be a sickroom.",
        "Stage-trained projection that cannot do 'quiet' convincingly.",
        "An island lilt from three ports back that never washed out.",
        "Gravel in the morning, honey by candlelight.",
        "Fast market-stall patter, prices and promises in one breath.",
        "Always slightly amused, even at funerals.",
        "Barely above a murmur; people lean in, which is the point.",
        "Academy diction with the accent scrubbed out. Mostly.",
        "Sing-song ferrier's cadence, made for calling across water.",
        "A hoarse edge from an old injury nobody asks about.",
        "Bright as bells, carrying, impossible to ignore in a crowd.",
        "Words chosen slowly, like each one is being weighed for a contract.",
        "Swears in one language, prays in another.",
    ],
    "dress": [
        "One good coat, brushed nightly, older than some of your friends.",
        "Layers on layers — you could be searched twice and still have pockets left.",
        "Salt-stained boots and clothes that dry fast; everything else is negotiable.",
        "Academy blacks worn slightly wrong, on purpose.",
        "Bright Masquerade colors even in the gray season, out of spite.",
        "Patched and re-patched, every patch a story you'll tell for a drink.",
        "Gloves, always, whatever the weather.",
        "A scarf or hood that can hide your face in under a second.",
        "Immaculate collar and cuffs; nobody needs to know about the rest.",
        "Work leathers with tool-loops, half of them holding things that aren't tools.",
        "A dead person's wardrobe, tailored to fit. You don't lead with that.",
        "One piece of real jewelry, worn where it can be grabbed and swallowed.",
        "Sodality grays with a maker's mark you haven't earned yet.",
        "Whatever's clean, plus the belt you'd grab in a fire.",
        "Dressed a full season ahead of the weather — always slightly cold, or sweating.",
        "The same three outfits in rotation, and you'll fight anyone who calls it a uniform.",
    ],
    "vice": [
        "The Winecradle's barrel red — one cup that is never one cup.",
        "Cards at the Undertow. You know the games are crooked; that's the appeal.",
        "Pipe-leaf you keep 'quitting.'",
        "Buying rounds you can't afford so the table loves you for one more hour.",
        "Picking fights slightly larger than you can win.",
        "Sugared almonds by the fistful; the stall-keeper can read your bad weeks by volume.",
        "Eavesdropping. You call it staying informed.",
        "Petty theft of worthless things — buttons, chalk, single earrings.",
        "Sleeping through the morning bell and lying about it.",
        "Reading other people's letters if they're just... there.",
        "Betting on gondola races with money that was already spoken for.",
        "Strong shrine-coffee till your hands shake, and you call it focus.",
        "Old arguments, rehearsed alone, that you always win.",
        "Flirting for information and then forgetting which part was the act.",
        "One more errand into the bad part of town, because it's quieter there.",
        "Collecting masks you swear you'll never wear.",
    ],
    "npcFirst": [
        "Beniamo", "Fiorella", "Tazio", "Perla", "Ruggiero", "Bianca",
        "Corvino", "Lucrezia", "Massimo", "Serafina", "Ottavio", "Ginevra",
        "Paschal", "Vittoria", "Edmo", "Rosalba", "Niccolo", "Amaranta",
        "Silvio", "Caterina",
    ],
    "npcFamily": [
        "Marchetti", "Salvi", "Ferro", "della Nebbia", "Orsini", "Vellutini",
        "Carmarino", "Tessaro", "Boccanegra", "Grimani", "Stellato",
        "Paviano", "Rimedi", "Falconi", "Scuro", "Amadei",
    ],
    "npcRole": [
        "dockhand", "lamplighter", "mask-fitter's apprentice", "shrine-sweep",
        "ferrier", "fishmonger", "clerk of the Vellum Hall",
        "off-duty Fog Warden", "Amaranth stagehand", "wine porter",
        "seamstress", "canal-diver", "archivist's runner", "tavern cook",
        "pickpocket", "gondola-painter",
    ],
}

# Vitals fields that get a die (in addition to the source HTML's eyes/marks)
VITALS_ROLLS = {
    "vitals - Voice / accent": "voice",
    "vitals - Dress & style": "dress",
    "vitals - Favorite food or drink": "food",
    "vitals - Vice": "vice",
}

# Part I textareas that get a suggestion die (the roll appends a starting
# line rather than replacing what the player wrote)
PART1_SUGGEST = {
    "P1 - luck & warding": "warding",
    "P1 - your tell": "tells",
    "P1 - a small comfort": "comforts",
    "P1 - your vice": "vice",
}

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

for entry in shared_part1:
    if entry["key"] in PART1_SUGGEST:
        entry["suggest"] = PART1_SUGGEST[entry["key"]]
for char in characters.values():
    for group in char["vitals"]:
        for field in group["fields"]:
            if field["key"] in VITALS_ROLLS and "roll" not in field:
                field["roll"] = VITALS_ROLLS[field["key"]]

out = {
    "part1": shared_part1,
    "tables": {**shared_tables, **EXTRA_TABLES},
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
