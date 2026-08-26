"""Cut the College of the Masquerade back to the shape change.

The subclass gave every mask three things at 3rd level: a permanent benefit
that applied whether or not the mask was worn, an ability while worn, and the
ability to take a form of the mask's type. Between them that is fire
resistance, immunity to the charmed condition, a free off-list cantrip and a
free daily proficiency, all before a mask has been put on — plus a bonus-action
misty step, a frightening aura, an extra damage die and blanket Expertise once
one has.

What survives is the shape change. That is the part the mask resource pays for
and the part the character is built around; the rest was a pile of benefits
nobody had to weigh.

Removing the while-worn abilities strands the Mask Upgrades at 6th and 14th
level, which exist only to buff them, so those go too. The Two-Faced is
reworded rather than dropped: wearing both masks still means a choice of two
forms and doubled temporary hit points.

Idempotent — running it twice changes nothing the second time.

    python3 scripts/strip_masquerade_passives.py --check
    python3 scripts/strip_masquerade_passives.py
"""
import argparse
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOMEBREW = ROOT / "campaign-data" / "curated" / "homebrew.json"

SHORT_NAME = "EoRMasquerade"

# Blocks removed wherever they appear on a mask. "While Worn" is matched by
# prefix because each mask names its own ability after the dash.
DROP_EXACT = {"Permanent Passive", "Mask Upgrades"}
DROP_PREFIX = ("While Worn",)

# Prose that describes something that will no longer exist.
DROP_SENTENCES = (
    "Each mask also grants a permanent passive benefit that applies even when "
    "the mask is not worn, as listed in the mask's description.",
)
REWORDS = (
    (
        "As a Bonus Action, you can don one of your masks. While wearing a mask, "
        "you gain its passive benefit and access to its active abilities.",
        "As a Bonus Action, you can don one of your masks. While wearing a mask, "
        "you can take the form of a creature of its type.",
    ),
    (
        "For 1 minute, you gain the passive and active benefits of both masks at once.",
        "For 1 minute, you can take the form of a creature of either mask's type.",
    ),
)


def features(data):
    return [
        f for f in data.get("subclassFeature", [])
        if f.get("subclassShortName") == SHORT_NAME
    ]


def should_drop(entry):
    name = entry.get("name") if isinstance(entry, dict) else None
    if not name:
        return False
    return name in DROP_EXACT or name.startswith(DROP_PREFIX)


def strip_blocks(feature):
    """Drop the named blocks. Returns a note for each one removed."""
    entries = feature.get("entries")
    if not isinstance(entries, list):
        return []

    kept, removed = [], []
    for entry in entries:
        if should_drop(entry):
            body = " ".join(str(e) for e in entry.get("entries", []) if isinstance(e, str))
            removed.append(f"removed {entry['name']!r} — {body[:70]}…" if body
                           else f"removed {entry['name']!r}")
            continue
        kept.append(entry)

    feature["entries"] = kept
    return removed


def fix_prose(feature):
    """Reword and drop sentences left describing something that is now gone."""
    notes = []

    def walk(node):
        if isinstance(node, list):
            return [walk(x) for x in node
                    if not (isinstance(x, str) and x.strip() in DROP_SENTENCES)]
        if isinstance(node, dict):
            return {k: (walk(v) if k in ("entries", "items") else v) for k, v in node.items()}
        if isinstance(node, str):
            for old, new in REWORDS:
                if old in node:
                    notes.append("reworded a paragraph that promised removed benefits")
                    return node.replace(old, new)
        return node

    before = json.dumps(feature.get("entries"), ensure_ascii=False)
    dropped = [s for s in DROP_SENTENCES if s in before]
    feature["entries"] = walk(feature.get("entries", []))
    notes += ["dropped the sentence granting passives when unworn" for _ in dropped]
    return notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report without writing")
    args = parser.parse_args()

    data = json.loads(HOMEBREW.read_text(encoding="utf-8"))
    found = features(data)
    if not found:
        raise SystemExit(f"No {SHORT_NAME} features in {HOMEBREW.name} — nothing to do.")

    report = []
    for feature in found:
        for note in strip_blocks(feature) + fix_prose(feature):
            report.append((feature["name"], note))

    if not report:
        print("Nothing to change — already stripped.")
        return

    for name, note in report:
        print(f"  {name:28} {note}")

    if args.check:
        print(f"\n{len(report)} change(s) would be made, nothing written (--check).")
        return

    data.setdefault("_meta", {})["dateLastModified"] = int(time.time())
    # Matches the file's existing formatting, so this edit is the only
    # difference a diff will show.
    HOMEBREW.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(report)} change(s) written to {HOMEBREW.relative_to(ROOT)}")
    print("Re-import the homebrew in Foundry, then rebuild Car with the new subclass.")


if __name__ == "__main__":
    main()
