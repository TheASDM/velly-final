"""Fail the build when the wiki stops being navigable.

Three things went wrong quietly enough to survive for months: a section grew to
sixty-two pages without ever being linked from the hub, section indexes drifted
until they named half their contents, and internal links rotted whenever a page
was renamed. None of them broke a build, so nothing said anything.

This is the thing that says something.

    python3 scripts/check_wiki.py           # exits 1 on any failure
    python3 scripts/check_wiki.py --warn    # report, always exit 0
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Everything a reader can browse. DM/ is deliberately absent — it is
# unpublished, and a check that demanded it be reachable would be wrong.
# Tools/ is deliberately absent: Tools/art.md is the Studio, a root tab of the
# app, not a wiki article. Holding it to wiki navigation rules would demand an
# index page for a section that is not a section.
WIKI_ROOTS = ["Venturia", "Articles", "House-Rules", "Class-Changes",
              "Session-Chronicles", "Updates", "Archive"]
EXCLUDE = ("Venturia/DM",)

LINK = re.compile(r"\]\(/en/([^)#?]+?)/?\)")
FRONT = re.compile(r"^---\n(.*?)\n---", re.S)


def pages():
    for root in WIKI_ROOTS:
        base = ROOT / root
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            rel = path.relative_to(ROOT).as_posix()
            if any(rel.startswith(x) for x in EXCLUDE):
                continue
            yield path, rel


def frontmatter(text):
    match = FRONT.match(text)
    if not match:
        return {}
    out = {}
    for line in match.group(1).split("\n"):
        if ":" in line and not line.startswith((" ", "-")):
            key, _, value = line.partition(":")
            out[key.strip()] = value.strip().strip("'\"")
    return out


def section_of(rel):
    """Mirrors sectionKeyFor in lib/eleventy/wiki.js: two segments deep, or
    three when the first is Venturia."""
    parts = rel.split("/")
    depth = 3 if parts[0] == "Venturia" else 2
    return "/".join(parts[:depth - 1]) if len(parts) >= depth else parts[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warn", action="store_true", help="report without failing")
    args = parser.parse_args()

    failures, notes = [], []
    known, sections, unpublished = set(), {}, set()

    # Landing pages written as templates rather than markdown still make their
    # section reachable, so record them before anything is judged missing.
    for njk in ROOT.glob("*/index.njk"):
        sections.setdefault(njk.parent.name, {"index": True, "pages": 0})
        known.add(f"{njk.parent.name}/index")

    for path, rel in pages():
        stem = rel[:-3]
        known.add(stem)
        meta = frontmatter(path.read_text(encoding="utf-8", errors="replace"))
        if str(meta.get("published", "true")).lower() == "false":
            unpublished.add(stem)
            continue
        if path.stem == "index":
            sections.setdefault(section_of(rel), {"index": True, "pages": 0})
            sections[section_of(rel)]["index"] = True
        else:
            key = section_of(rel)
            sections.setdefault(key, {"index": False, "pages": 0})
            sections[key]["pages"] += 1
        if not meta.get("title"):
            failures.append(f"{rel}: no title in frontmatter")
        if not meta.get("description"):
            notes.append(f"{rel}: no description (it is the subtitle in every listing)")

    # 1. Every section that holds pages must have a landing page.
    for key, data in sorted(sections.items()):
        if data["pages"] and not data["index"]:
            failures.append(f"{key}/: {data['pages']} page(s) and no index.md — unreachable by browsing")

    # 2. Internal links must resolve.
    for path, rel in pages():
        text = path.read_text(encoding="utf-8", errors="replace")
        for target in sorted(set(LINK.findall(text))):
            if target in known or f"{target}/index" in known:
                continue
            # Landing pages are not always markdown — the wiki hub is a .njk.
            if (ROOT / f"{target}/index.njk").exists() or (ROOT / f"{target}.njk").exists():
                continue
            if any(target.startswith(x) for x in EXCLUDE):
                continue
            failures.append(f"{rel}: broken link -> /en/{target}")

    for note in notes[:10]:
        print(f"  note  {note}")
    if len(notes) > 10:
        print(f"  note  ... and {len(notes) - 10} more missing descriptions")
    for failure in failures:
        print(f"  FAIL  {failure}")

    total = sum(d["pages"] for d in sections.values())
    print(f"\n{total} published pages across {len(sections)} sections, "
          f"{len(unpublished)} unpublished, {len(failures)} failure(s).")

    if failures and not args.warn:
        sys.exit(1)


if __name__ == "__main__":
    main()
