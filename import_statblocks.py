"""Load Foundry character exports into the runtime database.

Takes the files produced by scripts/foundry-export.js and stores each one whole
against a roster name. Like the narrative sheets these never enter the repo —
they are character data, and this repo is public.

The Foundry actor name rarely matches the canonical roster name ("Car" vs
'Caravel "Car" Asteri'), so the mapping is explicit and verified against
_data/players.json rather than guessed.

    docker compose exec -T chatbot python3 /site/import_statblocks.py \\
        --dir /site/files/statblocks --db /app/app-data/vallombrosa.sqlite3
"""
import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "app-data" / "vallombrosa.sqlite3"
ROSTER = ROOT / "_data" / "players.json"

# Foundry actor name (lowercased) -> canonical roster name. Mirrors SHEET_KEYS
# in import_sheets.py; keep the two in step when the roster changes.
ACTOR_NAMES = {
    "car": 'Caravel "Car" Asteri',
    "caravel": 'Caravel "Car" Asteri',
    "lotan": "Lotan",
    "noname": "Noname",
    "roxy": 'Roxanya "Roxy"',
    "roxanya": 'Roxanya "Roxy"',
    "valentro": "Valentro",
    "valen": "Valentro",
    "dm test wizard": "DM",
}

SUPPORTED_EXPORT = 1


def roster_names():
    try:
        return {entry["name"] for entry in json.loads(ROSTER.read_text(encoding="utf-8"))}
    except (OSError, ValueError, KeyError) as exc:
        raise SystemExit(f"Could not read {ROSTER}: {exc}")


def resolve(doc, path, override):
    """Work out which roster player a export belongs to."""
    if override:
        return override
    name = str(doc.get("name") or "").strip().lower()
    return ACTOR_NAMES.get(name)


def discover(directory, override):
    known = roster_names()
    found, problems = [], []

    for path in sorted(directory.glob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            problems.append(f"{path.name}: not valid JSON ({exc})")
            continue

        version = (doc.get("vosExport") or {}).get("version")
        if version != SUPPORTED_EXPORT:
            problems.append(
                f"{path.name}: export version {version!r}, expected {SUPPORTED_EXPORT}. "
                "Re-export with the current scripts/foundry-export.js."
            )
            continue
        if not doc.get("derived"):
            problems.append(
                f"{path.name}: no derived block — AC, HP and modifiers would be missing. "
                "Re-export with the current macro."
            )
            continue

        player = resolve(doc, path, override)
        if not player:
            problems.append(
                f"{path.name}: actor {doc.get('name')!r} is not in ACTOR_NAMES; "
                "add it or pass --player."
            )
            continue
        if player not in known:
            problems.append(f"{path.name}: {player!r} is not in _data/players.json")
            continue

        found.append((player, doc, path))

    return found, problems


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, help="directory of Foundry export JSON")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--player", help="force every file in --dir onto this roster name")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    directory = Path(args.dir).expanduser()
    if not directory.is_dir():
        raise SystemExit(f"Not a directory: {directory}")

    found, problems = discover(directory, args.player)
    for problem in problems:
        print(f"  skip  {problem}", file=sys.stderr)
    if not found:
        raise SystemExit("No usable exports found.")

    for player, doc, path in found:
        derived = doc.get("derived") or {}
        print(
            f"  {'would import' if args.dry_run else 'imported'}  {player:24}"
            f" level {derived.get('level') or '?':>2}"
            f"  AC {derived.get('ac') or '?':>2}"
            f"  {len(doc.get('items') or [])} items  ({path.name})"
        )
    if args.dry_run:
        print(f"\n{len(found)} export(s) ready, nothing written (--dry-run).")
        return

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    conn = sqlite3.connect(args.db, timeout=10)
    try:
        with conn:
            for player, doc, _path in found:
                conn.execute(
                    """
                    INSERT INTO character_statblocks (player_name, data, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(player_name)
                    DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
                    """,
                    (player, json.dumps(doc, separators=(",", ":")), now),
                )
        total = conn.execute("SELECT COUNT(*) FROM character_statblocks").fetchone()[0]
    except sqlite3.OperationalError as exc:
        raise SystemExit(
            f"Could not write {args.db}: {exc}\n"
            "If the DB is owned by the container, run this inside it."
        )
    finally:
        conn.close()

    print(f"\n{total} statblock(s) in the database.")


if __name__ == "__main__":
    main()
