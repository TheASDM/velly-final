"""Character sheets — the player-facing sheet and the DM's copy of all of them.

Two variants per player live in `character_sheets`: the `player` sheet they are
meant to read, and the `dm` sheet, which carries the arc spoilers behind it.

The split matters more than usual here. A player must never be able to reach
another player's sheet, and must never reach any `dm` sheet — so /api/sheet
takes the name from the verified token and hard-codes the variant, and never
looks at anything the client sent. The DM route is gated by
_admin_error_response(), the same door /api/questionnaire/all uses.
"""
from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("sheets", __name__)


def _sheet_row_json(row, include_variant=False):
    payload = {
        "playerName": row["player_name"],
        "markdown": row["markdown"],
        "updated_at": row["updated_at"],
    }
    if include_variant:
        payload["variant"] = row["variant"]
    return payload


def _statblock_row_json(row):
    """The Foundry export, parsed. A row that will not parse is treated as
    absent rather than 500ing the whole sheet."""
    if not row:
        return None
    try:
        data = json.loads(row["data"])
    except (TypeError, ValueError):
        logging.warning("character_statblocks row for %r is not valid JSON", row["player_name"])
        return None
    return {"data": data, "updated_at": row["updated_at"]}


@bp.get("/api/sheet")
def api_my_sheet():
    """The signed-in player's own sheet. Never accepts a name or variant."""
    player_name, auth_error = _authenticated_player_name()
    if auth_error:
        return auth_error

    with _app_db() as conn:
        row = conn.execute(
            "SELECT * FROM character_sheets WHERE player_name = ? AND variant = 'player'",
            (player_name,),
        ).fetchone()

    with _app_db() as conn:
        block = conn.execute(
            "SELECT * FROM character_statblocks WHERE player_name = ?",
            (player_name,),
        ).fetchone()

    return jsonify({
        "ok": True,
        "playerName": player_name,
        "sheet": _sheet_row_json(row) if row else None,
        "statblock": _statblock_row_json(block),
    })


@bp.get("/api/sheets")
def api_all_sheets():
    """Every sheet, both variants — DM only."""
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    with _app_db() as conn:
        rows = conn.execute(
            "SELECT * FROM character_sheets ORDER BY player_name, variant"
        ).fetchall()

    sheets = {}
    for row in rows:
        entry = sheets.setdefault(row["player_name"], {"playerName": row["player_name"]})
        entry[row["variant"]] = {
            "markdown": row["markdown"],
            "updated_at": row["updated_at"],
        }

    with _app_db() as conn:
        blocks = conn.execute("SELECT * FROM character_statblocks").fetchall()
    for block in blocks:
        entry = sheets.setdefault(block["player_name"], {"playerName": block["player_name"]})
        entry["statblock"] = _statblock_row_json(block)

    return jsonify({"ok": True, "sheets": list(sheets.values())})


SUPPORTED_STATBLOCK_EXPORT = 1


def _ingest_authorised():
    """Constant-time check of the bridge's bearer token.

    An unset token disables the endpoint rather than allowing everything — the
    failure mode of a half-configured deploy should be 'shut', not 'open'.
    """
    if not STATBLOCK_INGEST_TOKEN:
        return False, (jsonify({
            "error": "Statblock ingest is not configured on this server.",
            "error_code": "ingest_not_configured",
        }), 503)

    header = request.headers.get("Authorization", "")
    presented = header[7:].strip() if header.lower().startswith("bearer ") else ""
    if not presented or not hmac.compare_digest(presented, STATBLOCK_INGEST_TOKEN):
        return False, (jsonify({"error": "Forbidden", "error_code": "auth"}), 401)
    return True, None


def _statblock_player_for(actor_name):
    """Map a Foundry actor name onto a roster player.

    Reuses the login aliases, so "Car" resolves the same way it does at sign-in.
    A name that is not on the roster — or one whose access has been revoked — is
    refused rather than creating a row nobody can read.
    """
    canonical = _canonical_login_name(actor_name)
    if not canonical or canonical == "DM":
        return None
    if canonical in REVOKED_PLAYERS:
        return None
    return canonical if canonical in PLAYER_NAMES else None


@bp.post("/api/statblocks/ingest")
def api_statblock_ingest():
    """Accept one character statblock pushed from the Foundry bridge."""
    ok, auth_error = _ingest_authorised()
    if not ok:
        return auth_error

    raw = request.get_data(cache=False) or b""
    if len(raw) > STATBLOCK_MAX_BYTES:
        return jsonify({
            "error": f"Statblock is larger than {STATBLOCK_MAX_BYTES} bytes.",
            "error_code": "too_large",
        }), 413

    try:
        body = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return jsonify({"error": "Body must be JSON", "error_code": "bad_json"}), 400
    if not isinstance(body, dict):
        return jsonify({"error": "Body must be a JSON object", "error_code": "bad_json"}), 400

    version = (body.get("vosExport") or {}).get("version")
    if version != SUPPORTED_STATBLOCK_EXPORT:
        return jsonify({
            "error": f"Unsupported export version {version!r}; expected {SUPPORTED_STATBLOCK_EXPORT}.",
            "error_code": "bad_version",
        }), 400

    # Without the derived block the sheet has no AC, no max HP and no
    # modifiers, so store nothing rather than a statblock full of blanks.
    if not isinstance(body.get("derived"), dict) or not body["derived"]:
        return jsonify({
            "error": "Export has no derived block.",
            "error_code": "no_derived",
        }), 400

    actor_name = body.get("name")
    player_name = _statblock_player_for(actor_name if isinstance(actor_name, str) else "")
    if not player_name:
        return jsonify({
            "error": f"Actor {actor_name!r} does not map to an active roster player.",
            "error_code": "unknown_player",
        }), 422

    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute(
            """
            INSERT INTO character_statblocks (player_name, data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(player_name)
            DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            """,
            (player_name, json.dumps(body, separators=(",", ":")), now),
        )

    # A push replaces the build layer and must not touch the play layer — HP,
    # slots and charges belong to Foglight once play has started. The one thing
    # a push may do is pull play state back inside the new ceilings, so a level
    # change cannot leave someone above their own maximum.
    with _app_db() as conn:
        row = conn.execute(
            "SELECT state, version FROM character_play_state WHERE player_name = ?",
            (player_name,),
        ).fetchone()
        if row:
            try:
                reconciled = reconcile(json.loads(row["state"]), limits_from_statblock(body))
            except (TypeError, ValueError):
                logging.warning("play state for %r is not valid JSON; left alone", player_name)
            else:
                conn.execute(
                    "UPDATE character_play_state SET state = ?, updated_at = ? WHERE player_name = ?",
                    (json.dumps(reconciled, separators=(",", ":")), now, player_name),
                )

    logging.info(
        "statblock ingest: actor=%r -> player=%r (%d bytes)", actor_name, player_name, len(raw)
    )
    return jsonify({"ok": True, "playerName": player_name, "updated_at": now})


__all__ = ['_sheet_row_json', '_statblock_row_json', '_ingest_authorised',
           '_statblock_player_for', 'api_my_sheet', 'api_all_sheets',
           'api_statblock_ingest']
