"""Load the DM's character-sheet markdown into the runtime database.

The sheets are written as files (`player-sheet-<key>.md`, `dm-sheet-<key>.md`)
but they cannot live in the repo: this one is public, the player sheets carry
player-written detail, and the DM sheets are explicitly "DM EYES ONLY". So the
files stay gitignored and this script pushes them into `character_sheets`,
where the API can gate them per player and the existing SQLite backup covers
them.

Re-running is safe — rows key on (player_name, variant) and are replaced.

    # On the VPS, where the DB is owned by the container:
    docker compose exec -T chatbot python3 /site/import_sheets.py --dir /site/<sheets-dir>

    # Anywhere the DB is writable directly:
    python3 import_sheets.py --dir "files/.../valley-of-shadows-sheets (1)"
"""
import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "app-data" / "vallombrosa.sqlite3"
ROSTER = ROOT / "_data" / "players.json"

# Sheet-file key -> canonical roster name. These must match _data/players.json
# exactly; a rename there silently orphans the sheet, so we verify below rather
# than trusting this map. Mirrors LOGIN_NAME_ALIASES in chatbot/vos/config.py.
SHEET_KEYS = {
    "car": 'Caravel "Car" Asteri',
    "caravel": 'Caravel "Car" Asteri',
    "lotan": "Lotan",
    "noname": "Noname",
    "roxy": 'Roxanya "Roxy"',
    "roxanya": 'Roxanya "Roxy"',
    "valentro": "Valentro",
    "valen": "Valentro",
    # The DM's own test character, which exists to be a real player's-eye view
    # of the app rather than a special case inside it.
    "dmtest": "DM",
    "dm": "DM",
}

FILENAME = re.compile(r"^(player|dm)-sheet-(.+)\.md$", re.IGNORECASE)


def roster_names():
    try:
        return {entry["name"] for entry in json.loads(ROSTER.read_text(encoding="utf-8"))}
    except (OSError, ValueError, KeyError) as exc:
        raise SystemExit(f"Could not read {ROSTER}: {exc}")


def discover(directory):
    """Return [(player_name, variant, markdown, source_path)] for the directory."""
    if not directory.is_dir():
        raise SystemExit(f"Not a directory: {directory}")

    known = roster_names()
    found, problems = [], []

    for path in sorted(directory.iterdir()):
        match = FILENAME.match(path.name)
        if not match:
            continue
        variant, key = match.group(1).lower(), match.group(2).lower()

        player = SHEET_KEYS.get(key)
        if not player:
            problems.append(f"{path.name}: unknown sheet key {key!r}")
            continue
        if player not in known:
            problems.append(f"{path.name}: {player!r} is not in _data/players.json")
            continue

        text = path.read_text(encoding="utf-8").strip()
        if not text:
            problems.append(f"{path.name}: empty")
            continue
        found.append((player, variant, text, path))

    return found, problems


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, help="directory holding the sheet markdown")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="path to vallombrosa.sqlite3")
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    args = parser.parse_args()

    found, problems = discover(Path(args.dir).expanduser())

    for problem in problems:
        print(f"  skip  {problem}", file=sys.stderr)
    if not found:
        raise SystemExit("No sheets matched player-sheet-*.md / dm-sheet-*.md.")

    if args.dry_run:
        for player, variant, text, path in found:
            print(f"  would import  {variant:6} {player:24} {len(text):>6} chars  ({path.name})")
        print(f"\n{len(found)} sheet(s) ready, nothing written (--dry-run).")
        return

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    conn = sqlite3.connect(args.db, timeout=10)
    try:
        with conn:
            for player, variant, text, _path in found:
                conn.execute(
                    """
                    INSERT INTO character_sheets (player_name, variant, markdown, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(player_name, variant)
                    DO UPDATE SET markdown = excluded.markdown, updated_at = excluded.updated_at
                    """,
                    (player, variant, text, now),
                )
        rows = conn.execute(
            "SELECT variant, COUNT(*) FROM character_sheets GROUP BY variant"
        ).fetchall()
    except sqlite3.OperationalError as exc:
        raise SystemExit(
            f"Could not write {args.db}: {exc}\n"
            "If the DB is owned by the container, run this inside it "
            "(docker compose exec -T chatbot python3 /site/import_sheets.py ...)."
        )
    finally:
        conn.close()

    for player, variant, text, _path in found:
        print(f"  imported  {variant:6} {player:24} {len(text):>6} chars")
    print("\nIn the database now: " + ", ".join(f"{count} {variant}" for variant, count in rows))


if __name__ == "__main__":
    main()
