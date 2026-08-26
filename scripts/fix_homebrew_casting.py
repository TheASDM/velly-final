"""Stop homebrew subclasses declaring a second spellcasting progression.

A 5etools subclass only declares `casterProgression` when it *grants* casting to
a class that has none — an Eldritch Knight on a Fighter. Declaring it on a
subclass whose class already casts adds a second, independent source, and
Foundry adds them together.

That is why Lotan reads four first-level and two second-level slots. His Warlock
class is `pact`, correct; The Bound Mimic then declares `full`, so he is handed a
full caster's table while his pact pool sits at zero. A level 3 warlock should
have two slots at level 2.

Three others declare a progression they should not. Cleric and Ranger subclasses
duplicating their class's progression are less visibly wrong than the Warlock
pair, but they are wrong in the same way, and the Ranger one does not even match
(`half` against the class's `artificer`).

`additionalSpells` is left alone throughout — expanded and always-prepared spell
lists are exactly what a subclass should carry.

    python3 scripts/fix_homebrew_casting.py --check
    python3 scripts/fix_homebrew_casting.py
"""
import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOMEBREW = ROOT / "campaign-data" / "curated" / "homebrew.json"
FILTERED = ROOT / "campaign-data" / "5e-filtered"

# Fields a subclass should not carry when its class already casts.
DROP = ("casterProgression", "spellcastingAbility")


def class_casting(class_name):
    """What the parent class declares, read rather than assumed."""
    path = FILTERED / f"class-{class_name.lower()}.json"
    if not path.exists():
        return None
    for entry in json.loads(path.read_text(encoding="utf-8")).get("class", []):
        if entry.get("source") == "XPHB":
            return {
                "progression": entry.get("casterProgression"),
                "ability": entry.get("spellcastingAbility"),
            }
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report without writing")
    args = parser.parse_args()

    original = HOMEBREW.read_text(encoding="utf-8")
    data = json.loads(original)

    changes = []
    for subclass in data.get("subclass", []):
        parent = class_casting(subclass.get("className", ""))
        if not parent or not parent["progression"]:
            continue                      # class does not cast: a grant is legitimate
        present = [key for key in DROP if key in subclass]
        if not present:
            continue

        changes.append({
            "name": subclass["name"],
            "className": subclass["className"],
            "classProgression": parent["progression"],
            "classAbility": parent["ability"],
            "removed": {key: subclass[key] for key in present},
        })
        for key in present:
            subclass.pop(key)

    if not changes:
        print("Nothing to change.")
        return

    for change in changes:
        removed = ", ".join(f"{k}={v!r}" for k, v in change["removed"].items())
        print(f"  {change['name']} ({change['className']})")
        print(f"     class is {change['classProgression']!r} / {change['classAbility']!r}")
        print(f"     removed  {removed}")

    if args.check:
        print(f"\n{len(changes)} subclass(es) would change, nothing written (--check).")
        return

    data.setdefault("_meta", {})["dateLastModified"] = int(time.time())
    # Matches the file's existing formatting exactly, so this edit is the only
    # difference a diff will show.
    HOMEBREW.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(changes)} subclass(es) fixed in {HOMEBREW.relative_to(ROOT)}")
    print("Re-import the homebrew in Foundry, then re-apply the subclass to the character.")


if __name__ == "__main__":
    main()
