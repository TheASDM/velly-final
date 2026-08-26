"""Turn a Foundry export back into an actor Foundry can import.

Rebuilding a character by hand after a subclass changes means re-picking every
choice and hoping nothing is missed. This takes the export the bridge already
made — real Foundry source data from a working actor — and returns a document
that can be dropped straight into the Actors tab.

It only ever *removes* and *rewrites text*. Nothing here invents structure, so
what imports is the character that was exported, minus what the correction took
away.

Three corrections, each reported:

  Duplicates. Re-applying a subclass leaves a second copy of every feature it
  grants. Car carried two of each mask. Foundry does not mind; a player reading
  their own sheet does.

  Traits the removed passives granted. Plutonium writes a subclass feature's
  `resist` and `conditionImmune` onto the actor, so stripping the prose from
  the brew leaves the mechanical half sitting in the actor's traits.

  Feature text and charges. Descriptions are regenerated from the current
  homebrew, so a mask says what the brew now says rather than what it said when
  the character was built.

    python3 scripts/build_foundry_actor.py --in files/statblocks/car.json
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOMEBREW = ROOT / "campaign-data" / "curated" / "homebrew.json"
DEFAULT_OUT = ROOT / "files" / "foundry-import"

# What the Masquerade's permanent passives used to put on the actor. Named
# rather than inferred: the brew no longer records them, so there is nothing
# left to diff against, and a silent trait removal would be worse than a
# listed one.
PASSIVE_TRAITS = {
    "dr": ["fire"],          # Maschera Diabolica
    "ci": ["charmed"],       # Maschera Fiabesco
}

TRAIT_LABELS = {"dr": "resistance", "di": "immunity", "dv": "vulnerability",
                "ci": "condition immunity"}


def homebrew_features():
    """Current text for every Masquerade feature, keyed by name."""
    if not HOMEBREW.exists():
        return {}
    data = json.loads(HOMEBREW.read_text(encoding="utf-8"))
    return {
        f["name"]: f for f in data.get("subclassFeature", [])
        if str(f.get("subclassShortName") or "").startswith("EoRMasquerade")
    }


def strip_tags(text):
    """5etools markup down to the words inside it."""
    text = re.sub(r"\{@(?:bold|i|italic|b)\s+([^}]+)\}", r"<strong>\1</strong>", text)
    return re.sub(r"\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}", r"\1", text)


def entries_html(entries, depth=0):
    """Feature entries as plain, readable HTML.

    Deliberately not plutonium's markup — this only has to read correctly in
    the Foundry sheet, and simple tags survive editing better than nested
    layout divs do.
    """
    out = []
    for entry in entries or []:
        if isinstance(entry, str):
            out.append(f"<p>{strip_tags(entry)}</p>")
        elif isinstance(entry, dict):
            kind = entry.get("type")
            if kind == "list":
                items = "".join(f"<li>{strip_tags(str(i))}</li>"
                                for i in entry.get("items", []) if isinstance(i, str))
                nested = [i for i in entry.get("items", []) if not isinstance(i, str)]
                out.append(f"<ul>{items}</ul>")
                if nested:
                    out.append(entries_html(nested, depth))
            else:
                if entry.get("name"):
                    level = min(depth + 3, 6)
                    out.append(f"<h{level}>{strip_tags(entry['name'])}</h{level}>")
                out.append(entries_html(entry.get("entries"), depth + 1))
    return "".join(out)


def dedupe_items(items):
    """One of each. The first copy wins; the rest are named in the report."""
    seen, kept, dropped = set(), [], []
    for item in items:
        key = (item.get("name"), item.get("type"))
        if key in seen:
            dropped.append(item.get("name"))
            continue
        seen.add(key)
        kept.append(item)
    return kept, dropped


def clear_passive_traits(system):
    notes = []
    for key, values in PASSIVE_TRAITS.items():
        trait = system.get("traits", {}).get(key)
        if not isinstance(trait, dict):
            continue
        present = [v for v in values if v in (trait.get("value") or [])]
        if not present:
            continue
        trait["value"] = [v for v in trait["value"] if v not in values]
        notes.append(f"cleared {TRAIT_LABELS[key]}: {', '.join(present)}")
    return notes


def refresh_masquerade(items, features):
    """Bring the mask items in line with the current brew."""
    notes = []
    for item in items:
        feature = features.get(item.get("name"))
        if not feature or item.get("type") != "feat":
            continue
        system = item.setdefault("system", {})

        html = entries_html(feature.get("entries"))
        if html and (system.get("description") or {}).get("value") != html:
            system.setdefault("description", {})["value"] = html
            notes.append(f"{item['name']}: description rewritten from the brew")

        # A mask grants nothing now, so it carries no charges and no activity.
        if item["name"].startswith("Maschera "):
            uses = system.get("uses") or {}
            if uses.get("max") not in (None, "", 0):
                notes.append(f"{item['name']}: removed {uses['max']!r} charges")
            system["uses"] = {"max": "", "spent": 0, "recovery": []}
            if system.get("activities"):
                notes.append(f"{item['name']}: removed {len(system['activities'])} activity")
                system["activities"] = {}
    return notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="source", required=True, help="a bridge export JSON")
    parser.add_argument("--out", help="where to write (default files/foundry-import/)")
    parser.add_argument("--name", help="override the actor name")
    args = parser.parse_args()

    doc = json.loads(Path(args.source).expanduser().read_text(encoding="utf-8"))
    if not doc.get("items"):
        raise SystemExit(f"{args.source} has no items — is it a bridge export?")

    report = []
    items, dropped = dedupe_items(doc["items"])
    for name in sorted(set(dropped)):
        report.append(f"removed a duplicate {name}")

    system = doc.get("system") or {}
    report += clear_passive_traits(system)
    report += refresh_masquerade(items, homebrew_features())

    actor = {
        "name": args.name or doc.get("name") or "Imported Character",
        "type": "character",
        "img": doc.get("img") or "icons/svg/mystery-man.svg",
        "system": system,
        "items": items,
        "effects": doc.get("effects") or [],
        "flags": doc.get("flags") or {},
    }

    out_dir = Path(args.out).expanduser() if args.out else DEFAULT_OUT
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", actor["name"].lower()).strip("-")
    out_path = out_dir / f"{slug}.json"
    out_path.write_text(json.dumps(actor, indent=2, ensure_ascii=False), encoding="utf-8")

    for note in report:
        print(f"  {note}")
    print(f"\n{actor['name']}: {len(items)} items ({len(dropped)} duplicate(s) dropped)")
    print(f"Wrote {out_path}")
    print("\nIn Foundry: Actors tab → Import Data → choose this file.")


if __name__ == "__main__":
    main()
