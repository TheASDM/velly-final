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

    if not row:
        return jsonify({
            "ok": True,
            "playerName": player_name,
            "sheet": None,
        })
    return jsonify({"ok": True, "playerName": player_name, "sheet": _sheet_row_json(row)})


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

    return jsonify({"ok": True, "sheets": list(sheets.values())})


__all__ = ['_sheet_row_json', 'api_my_sheet', 'api_all_sheets']
