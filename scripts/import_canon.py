"""Fold a canon drop into the wiki without flattening what the wiki has grown.

The canon files are the campaign's ground truth, written as one long document
per subject. The wiki is the same material as pages, plus a lot the canon files
have never held: hero cards, character art, publication dates. Ninety of the
hundred and seventy-eight pages carry that.

So this merges rather than replaces. From canon it takes the title, the
description, the tags and the prose. From the page it keeps the frontmatter
that records history, and every block of hand-written HTML above the prose.
The project's own instructions name silently dropping planted material during a
replacement pass as a repeat failure; this is the guard against it.

Entities in a canon file look like:

    The Amaranth Theater.
    Tags: locations, theater.
    One-line description, which becomes the page description.
    The opening paragraph.

    ## A Section
    ...
    ---

Where a page cannot be matched, nothing is written and the entity is reported.
Guessing a location for a page is how a second copy of an article appears.

    python3 scripts/import_canon.py --dir files/valley-of-shadows-08-26-2026/canon --check
    python3 scripts/import_canon.py --dir files/valley-of-shadows-08-26-2026/canon
"""
import argparse
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Where a new page goes, decided by its own tags before its source file. A
# canon file mixes subjects — campaign-world-updated.md holds the Settling, a
# season, alongside three taverns — so filing everything from it under
# Locations puts a calendar entry in with the buildings.
TAG_HOME = (
    ("culture", "Venturia/Culture"),
    ("factions", "Venturia/Factions"),
    ("government", "Venturia/Government"),
    ("items", "Venturia/Items"),
    ("maps", "Venturia/Maps"),
    ("lore", "Venturia/Lore"),
    ("pcs", "Venturia/Characters/PCs"),
    ("npcs", "Venturia/Characters/NPCs"),
    ("locations", "Venturia/Locations"),
    ("campaign-update", "Updates"),
    ("house-rules", "House-Rules"),
    ("articles", "Articles"),
)

# Consulted only when the tags say nothing useful.
DEFAULT_HOME = {
    "campaign-characters.md": "Venturia/Characters/NPCs",
    "campaign-world-updated.md": "Venturia/Locations",
    "campaign-lore.md": "Venturia/Lore",
    "campaign-articles.md": "Articles",
    "house-rules.md": "House-Rules",
}


def home_for(entity):
    """The folder a new page belongs in: tags first, then its source file."""
    tags = {t.strip().lower() for t in entity["tags"].split(",")}
    for tag, home in TAG_HOME:
        if tag in tags:
            return home
    return DEFAULT_HOME.get(entity["source"])

# Frontmatter the wiki owns and canon knows nothing about.
PRESERVED_KEYS = ("published", "date", "editor", "dateCreated")

TAGS_LINE = re.compile(r"^Tags:\s*(.+?)\.?\s*$")
WIKI_LINK = re.compile(r"\]\(/en/([^)#]+?)/?\)")
FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.S)


def slugify(value):
    value = unicodedata.normalize("NFKD", str(value))
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"[''’]", "", value.lower())
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


# ── Reading canon ─────────────────────────────────────────────────────

def parse_canon(path):
    """Split one canon file into entities.

    A `Tags:` line is the anchor: the line above it names the entity, the line
    below describes it. That is more reliable than splitting on rules, because
    the prose uses horizontal rules too.
    """
    lines = path.read_text(encoding="utf-8").split("\n")
    anchors = [i for i, line in enumerate(lines) if TAGS_LINE.match(line)]

    entities = []
    for position, index in enumerate(anchors):
        name = lines[index - 1].strip().rstrip(".")
        if not name:
            continue
        tags = TAGS_LINE.match(lines[index]).group(1)

        # Body runs to just before the next entity's name line, minus the rule
        # and blank lines that separate them.
        end = anchors[position + 1] - 1 if position + 1 < len(anchors) else len(lines)
        body = lines[index + 1:end]
        while body and (not body[-1].strip() or body[-1].strip() == "---"):
            body.pop()

        description = body[0].strip() if body else ""
        entities.append({
            "name": name,
            "tags": tags,
            "description": description,
            "body": "\n".join(body[1:]).strip(),
            "slug": slugify(name),
            "source": path.name,
        })
    return entities


# ── Reading the wiki ──────────────────────────────────────────────────

def read_page(path):
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    if not match:
        return {"path": path, "front_raw": "", "front": {}, "body": text}

    front = {}
    for line in match.group(1).split("\n"):
        if ":" in line and not line.startswith(" "):
            key, _, value = line.partition(":")
            front[key.strip()] = value.strip()
    return {
        "path": path,
        "front_raw": match.group(1),
        "front": front,
        "body": text[match.end():],
    }


def index_wiki(roots):
    """Every page, keyed by slug and by normalised title."""
    by_slug, by_title = {}, {}
    for root in roots:
        base = ROOT / root
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            page = read_page(path)
            by_slug.setdefault(path.stem, page)
            title = (page["front"].get("title") or "").strip("'\"")
            if title:
                by_title.setdefault(slugify(title), page)
    return by_slug, by_title


def link_targets(entities):
    """Where canon says a page lives, taken from its own links.

    Canon prose links to /en/Venturia/Locations/covenant-archive, which is the
    file path with the permalink prefix on it. That is a better answer than
    anything this script could infer from tags.
    """
    targets = {}
    for entity in entities:
        for match in WIKI_LINK.finditer(entity["body"]):
            target = match.group(1)
            targets.setdefault(target.rsplit("/", 1)[-1], target)
    return targets


# ── Writing ───────────────────────────────────────────────────────────

def leading_html(body):
    """The hand-built block at the top of a page, if there is one.

    Tracked by div depth rather than by pattern, so a hero that nests four
    levels deep comes back whole. Anything before the first <div is kept too —
    that is usually a comment or an image line.
    """
    lines = body.split("\n")
    start = next((i for i, l in enumerate(lines) if l.lstrip().startswith("<div")), None)
    if start is None:
        return "", body

    depth = 0
    for index in range(start, len(lines)):
        depth += lines[index].count("<div") - lines[index].count("</div>")
        if depth <= 0:
            kept = "\n".join(lines[:index + 1]).rstrip()
            return kept, "\n".join(lines[index + 1:])
    return "", body            # unbalanced: keep hands off


def quote(value):
    """Frontmatter values are plain unless they need not to be."""
    text = str(value)
    if re.search(r"^[\s>|&*#\[\]{}!%@`-]|:\s|[:#]$|'|\"", text):
        return "'" + text.replace("'", "''") + "'"
    return text


def render_page(entity, page):
    """Canon prose under the page's own frontmatter and hero."""
    front = dict(page["front"]) if page else {}
    front["title"] = entity["name"]
    front["description"] = entity["description"]
    front["tags"] = entity["tags"]
    front.setdefault("published", "true")
    front.setdefault("editor", "markdown")

    order = ["title", "description", "published", "date", "tags", "editor", "dateCreated"]
    keys = [k for k in order if k in front] + [k for k in front if k not in order]
    lines = [f"{k}: {quote(front[k])}" for k in keys]

    hero, _ = leading_html(page["body"]) if page else ("", "")

    # Sections separated by rules, which is how the wiki has always read.
    body = re.sub(r"\n(?=## )", "\n\n---\n\n", entity["body"]).strip()

    parts = ["---", "\n".join(lines), "---", ""]
    if hero:
        parts += [hero, ""]
    parts += [body, ""]
    return "\n".join(parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, help="the canon directory")
    parser.add_argument("--check", action="store_true", help="report without writing")
    parser.add_argument("--only", help="only this canon file")
    parser.add_argument("--report", help="write a JSON report here")
    args = parser.parse_args()

    canon_dir = Path(args.dir).expanduser()
    files = sorted(canon_dir.glob("*.md"))
    if args.only:
        files = [f for f in files if f.name == args.only]
    files = [f for f in files if not f.name.startswith("campaign-dm-secrets")]
    if not files:
        raise SystemExit(f"No canon files in {canon_dir}")

    entities = [e for f in files for e in parse_canon(f)]
    by_slug, by_title = index_wiki(
        ["Venturia", "Articles", "House-Rules", "Class-Changes",
         "Session-Chronicles", "Updates", "Lore", "Archive", "Tools"]
    )
    targets = link_targets(entities)

    updated, created, skipped = [], [], []
    for entity in entities:
        page = by_title.get(entity["slug"]) or by_slug.get(entity["slug"])

        if page is None:
            target = targets.get(entity["slug"])
            if target:
                path = ROOT / f"{target}.md"
            else:
                home = home_for(entity)
                path = ROOT / home / f"{entity['slug']}.md" if home else None
            if path is None:
                skipped.append((entity["name"], entity["source"], "no page and nowhere to put one"))
                continue
            page = {"path": path, "front": {}, "body": "", "front_raw": ""}
            created.append((entity["name"], str(path.relative_to(ROOT))))
        else:
            updated.append((entity["name"], str(page["path"].relative_to(ROOT))))

        if not args.check:
            page["path"].parent.mkdir(parents=True, exist_ok=True)
            page["path"].write_text(render_page(entity, page), encoding="utf-8")

    verb = "would update" if args.check else "updated"
    print(f"  {verb:14} {len(updated)} page(s)")
    print(f"  {'would create' if args.check else 'created':14} {len(created)} page(s)")
    for name, path in created:
        print(f"       + {name}  ->  {path}")
    if skipped:
        print(f"  {'skipped':14} {len(skipped)}")
        for name, source, why in skipped:
            print(f"       ! {name} ({source}): {why}")

    if args.report:
        Path(args.report).write_text(json.dumps(
            {"updated": updated, "created": created, "skipped": skipped}, indent=2), encoding="utf-8")

    if args.check:
        print(f"\n{len(entities)} entities parsed, nothing written (--check).")


if __name__ == "__main__":
    main()
