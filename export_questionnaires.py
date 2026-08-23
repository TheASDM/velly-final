"""Export the player character-record questionnaires to a local backup.

The answers live in one place — the `questionnaires` table in
app-data/vallombrosa.sqlite3 on the VPS — and the raw rows are near-unreadable
on their own: `answers` is a JSON blob keyed by field names like
"P1 - your tell", while the prompt text lives in _data/questionnaire.json.

This script pulls the records, merges them with the prompts, and writes a
timestamped backup directory holding both the raw JSON (for restore fidelity)
and one readable Markdown document per player.

Two source modes, auto-detected:

  VPS  — app-data/vallombrosa.sqlite3 is present, read it directly. No auth.
  API  — otherwise, GET <url>/api/questionnaire/all with a DM bearer token.

Examples:

    # On the VPS, from the repo root
    python3 export_questionnaires.py

    # From a laptop, using the DM `vos.authToken` from browser localStorage
    VOS_DM_TOKEN=... python3 export_questionnaires.py --url https://your-host
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "app-data" / "vallombrosa.sqlite3"
PROMPTS = ROOT / "_data" / "questionnaire.json"
DEFAULT_OUT = ROOT / "backups" / "questionnaires"


# ── Sources ──────────────────────────────────────────────────────────────

def records_from_db(db_path):
    """Read the questionnaires table directly. Mirrors the shape of
    _questionnaire_row_json() in chatbot/server.py so both sources produce
    identical records."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT * FROM questionnaires ORDER BY player_name"
        ).fetchall()
    except sqlite3.OperationalError as exc:
        raise SystemExit(
            f"Could not read the questionnaires table in {db_path}: {exc}"
        )
    finally:
        conn.close()

    records = []
    for row in rows:
        try:
            answers = json.loads(row["answers"] or "{}")
        except (TypeError, ValueError):
            answers = {}
        records.append({
            "playerName": row["player_name"],
            "answers": answers if isinstance(answers, dict) else {},
            "status": row["status"],
            "submitted_at": row["submitted_at"],
            "updated_at": row["updated_at"],
        })
    return records


def records_from_api(base_url, token):
    """GET /api/questionnaire/all. The endpoint is DM-gated by
    _admin_error_response(), which accepts a DM player token or a Google
    session JWT as `Authorization: Bearer <token>`."""
    if not token:
        raise SystemExit(
            "API mode needs a DM token. Pass --token or set VOS_DM_TOKEN.\n"
            "It is the `vos.authToken` value from your browser's localStorage "
            "while signed in as DM."
        )
    url = base_url.rstrip("/") + "/api/questionnaire/all"
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = (json.loads(exc.read().decode("utf-8")) or {}).get("error", "")
        except Exception:
            pass
        hint = ""
        if exc.code in (401, 403):
            hint = "\nThe token is missing, expired, or not on the DM allowlist."
        raise SystemExit(f"{url} returned HTTP {exc.code}. {detail}{hint}")
    except urllib.error.URLError as exc:
        raise SystemExit(f"Could not reach {url}: {exc.reason}")

    records = payload.get("records")
    if not isinstance(records, list):
        raise SystemExit(f"{url} returned no `records` list. Got: {payload!r:.200}")
    return records


# ── Merge ────────────────────────────────────────────────────────────────

def load_prompts():
    if not PROMPTS.exists():
        raise SystemExit(
            f"Missing {PROMPTS}. Rebuild it with: python3 build_questionnaire.py"
        )
    return json.loads(PROMPTS.read_text())


def character_for(prompts, player_name):
    """Match a DB player_name against characters[*].player."""
    for key, character in prompts["characters"].items():
        if character.get("player") == player_name:
            return key, character
    return None, None


def sections_for(prompts, character):
    """Walk the record in document order: Part I (shared), Part II
    (per-character), Part III vitals (grouped), then the coda."""
    sections = [
        ("Part One — everyone answers these", "prose", prompts["part1"]),
        ("Part Two — your character's own questions", "prose", character["part2"]),
    ]
    for group in character["vitals"]:
        sections.append(
            (f"Part Three — {group['group']}", "vitals", group["fields"])
        )
    sections.append(("One more thing", "prose", [{
        "key": prompts["codaKey"],
        "prompt": prompts["codaPrompt"],
        "title": "Anything else?",
    }]))
    return sections


def answered(value):
    return isinstance(value, str) and value.strip() != ""


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "player"


def render_markdown(record, prompts, character):
    """One readable document: prompts and answers interleaved, blanks marked."""
    answers = record.get("answers") or {}
    lines = [
        f"# {character['name']}",
        "",
        f"**Player:** {record['playerName']}  ",
        f"**Role:** {character.get('role', '')}  ",
        f"**Status:** {record.get('status') or 'draft'}  ",
        f"**Submitted:** {record.get('submitted_at') or '—'}  ",
        f"**Last updated:** {record.get('updated_at') or '—'}",
        "",
    ]

    filled = total = 0
    for heading, kind, fields in sections_for(prompts, character):
        lines += [f"## {heading}", ""]
        for field in fields:
            total += 1
            value = answers.get(field["key"])
            has = answered(value)
            if has:
                filled += 1

            if kind == "vitals":
                # Vitals carry a pre-filled `value` with onFile: true. Show the
                # on-file value when the player left it blank, and say so when
                # they overrode it.
                on_file = field.get("value") or ""
                if has and field.get("onFile") and value.strip() != on_file.strip():
                    shown = f"{value.strip()}  _(changed from on-file “{on_file}”)_"
                elif has:
                    shown = value.strip()
                elif on_file:
                    shown = f"{on_file}  _(on file, unchanged)_"
                    filled += 1
                else:
                    shown = "_(blank)_"
                lines += [f"- **{field['label']}:** {shown}"]
            else:
                title = field.get("title")
                lines += [f"### {title}" if title else "### " + field["key"], ""]
                lines += [f"> {field['prompt']}", ""]
                if has:
                    lines += [value.strip(), ""]
                else:
                    lines += ["_(blank)_", ""]
        lines.append("")

    # Anything the player saved under a key the prompts no longer define —
    # keep it rather than silently dropping their writing.
    known = {
        field["key"]
        for _, _, fields in sections_for(prompts, character)
        for field in fields
    }
    extra = {k: v for k, v in answers.items() if k not in known and answered(v)}
    if extra:
        lines += ["## Unrecognised answer keys", ""]
        for key, value in sorted(extra.items()):
            lines += [f"### {key}", "", value.strip(), ""]

    return "\n".join(lines).rstrip() + "\n", filled, total


def render_unmatched(record):
    """A player_name that matches no character — a roster rename must never
    silently drop someone's writing."""
    answers = record.get("answers") or {}
    lines = [
        f"# {record['playerName']} (no matching character)",
        "",
        "This record's `player_name` did not match any `characters[*].player` in",
        "`_data/questionnaire.json`. The raw answers are preserved below.",
        "",
        f"**Status:** {record.get('status') or 'draft'}  ",
        f"**Last updated:** {record.get('updated_at') or '—'}",
        "",
    ]
    for key, value in sorted(answers.items()):
        if not answered(value):
            continue
        lines += [f"### {key}", "", value.strip(), ""]
    return "\n".join(lines).rstrip() + "\n"


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--db", help="SQLite path (default: app-data/vallombrosa.sqlite3 if present)")
    parser.add_argument("--url", help="Site base URL for API mode, e.g. https://your-host")
    parser.add_argument("--token", help="DM bearer token (or set VOS_DM_TOKEN)")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help=f"Output root (default: {DEFAULT_OUT})")
    parser.add_argument("--json-only", action="store_true", help="Skip the Markdown documents")
    args = parser.parse_args()

    # Explicit flags win; otherwise prefer a local DB, then fall back to API.
    if args.db:
        db_path = Path(args.db)
        if not db_path.exists():
            raise SystemExit(f"No database at {db_path}")
        source = f"sqlite:{db_path}"
        records = records_from_db(db_path)
    elif args.url:
        source = f"api:{args.url.rstrip('/')}"
        records = records_from_api(args.url, args.token or os.environ.get("VOS_DM_TOKEN", ""))
    elif DEFAULT_DB.exists():
        source = f"sqlite:{DEFAULT_DB}"
        records = records_from_db(DEFAULT_DB)
    else:
        raise SystemExit(
            f"No database at {DEFAULT_DB} and no --url given.\n"
            "On the VPS, run from the repo root. From a laptop, pass\n"
            "  --url https://your-host  with --token or VOS_DM_TOKEN set."
        )

    prompts = load_prompts()
    stamp = datetime.now(timezone.utc)

    # Only create the output directory once the fetch has succeeded, so a bad
    # token never leaves a half-written backup behind.
    out_dir = Path(args.out) / stamp.strftime("%Y%m%dT%H%M%SZ")
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "questionnaires.json").write_text(
        json.dumps({
            "exported_at": stamp.isoformat().replace("+00:00", "Z"),
            "source": source,
            "records": records,
        }, indent=2, ensure_ascii=False) + "\n"
    )

    index = [
        "# Questionnaire export",
        "",
        f"Exported {stamp.isoformat().replace('+00:00', 'Z')} from `{source}`.",
        "",
        "| Player | Character | Status | Submitted | Answered |",
        "|---|---|---|---:|---:|",
    ]
    summary = []

    for record in sorted(records, key=lambda r: r.get("playerName") or ""):
        player = record.get("playerName") or "(unnamed)"
        key, character = character_for(prompts, player)
        slug = slugify(player)

        if character is None:
            if not args.json_only:
                (out_dir / f"{slug}-unmatched.md").write_text(render_unmatched(record))
            index.append(f"| {player} | — *(no match)* | {record.get('status') or 'draft'} | — | — |")
            summary.append((player, None, None))
            continue

        body, filled, total = render_markdown(record, prompts, character)
        if not args.json_only:
            (out_dir / f"{slug}.md").write_text(body)
        index.append(
            f"| {player} | {character['name']} | {record.get('status') or 'draft'} "
            f"| {record.get('submitted_at') or '—'} | {filled}/{total} |"
        )
        summary.append((player, filled, total))

    if not args.json_only:
        (out_dir / "INDEX.md").write_text("\n".join(index).rstrip() + "\n")

    print(f"Exported {len(records)} record(s) from {source}")
    for player, filled, total in summary:
        if filled is None:
            print(f"  {player}: no matching character — raw answers preserved")
        else:
            print(f"  {player}: {filled}/{total} answered")
    print(f"→ {out_dir}")


if __name__ == "__main__":
    sys.exit(main())
