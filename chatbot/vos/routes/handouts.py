"""Handouts — documents the DM gives to specific characters.

The audience is the whole point. A player's endpoint filters strictly to
handouts naming them and never says who else received one — a letter that
three people got should read, to each of them, like a letter. Everything
that writes, and the view of the full distribution, sits behind the same
admin door as the rest of the DM console.
"""
from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("handouts", __name__)

TITLE_MAX = 200
MARKDOWN_MAX = 60_000


def _row_for_player(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "markdown": row["markdown"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _reader():
    """Whose handouts to return. Yours; the DM may name someone (view as)."""
    caller = _verify_player_token(_extract_player_token())
    if not caller:
        return None, (jsonify({"error": "Login required"}), 401)
    requested = request.args.get("playerName")
    if requested is None or str(requested) == caller:
        return caller, None
    if not _is_dm_player(caller):
        return None, (jsonify({
            "error": "You can only read your own handouts.",
            "error_code": "forbidden_target",
        }), 403)
    return str(requested), None


@bp.get("/api/handouts")
def api_my_handouts():
    player_name, auth_error = _reader()
    if auth_error:
        return auth_error

    with _app_db() as conn:
        rows = conn.execute("SELECT * FROM handouts ORDER BY id DESC").fetchall()

    handouts = []
    for row in rows:
        try:
            audience = json.loads(row["players"])
        except (TypeError, ValueError):
            continue
        if player_name in audience:
            handouts.append(_row_for_player(row))
    return jsonify({"ok": True, "playerName": player_name, "handouts": handouts})


def _validated_body():
    body = request.get_json(silent=True) or {}
    title = str(body.get("title") or "").strip()
    markdown = str(body.get("markdown") or "").strip()
    players = body.get("players")

    if not title:
        return None, (jsonify({"error": "A handout needs a title."}), 400)
    if len(title) > TITLE_MAX:
        return None, (jsonify({"error": f"Title is longer than {TITLE_MAX} characters."}), 400)
    if not markdown:
        return None, (jsonify({"error": "A handout needs some text."}), 400)
    if len(markdown) > MARKDOWN_MAX:
        return None, (jsonify({"error": f"Text is longer than {MARKDOWN_MAX} characters."}), 400)
    if not isinstance(players, list) or not players:
        return None, (jsonify({"error": "Choose at least one player."}), 400)
    players = [str(p) for p in players]
    unknown = [p for p in players if p not in PLAYER_NAMES]
    if unknown:
        return None, (jsonify({"error": f"Not on the roster: {', '.join(unknown)}"}), 422)

    return {
        "title": title,
        "markdown": markdown,
        "players": json.dumps(sorted(set(players))),
    }, None


@bp.route("/api/handouts/all", methods=["GET"])
def api_all_handouts():
    """Every handout with its full audience — the DM's list."""
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        rows = conn.execute("SELECT * FROM handouts ORDER BY id DESC").fetchall()
    handouts = []
    for row in rows:
        entry = _row_for_player(row)
        try:
            entry["players"] = json.loads(row["players"])
        except (TypeError, ValueError):
            entry["players"] = []
        handouts.append(entry)
    return jsonify({"ok": True, "handouts": handouts})


@bp.post("/api/handouts")
def api_create_handout():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    fields, body_error = _validated_body()
    if body_error:
        return body_error
    now = _utc_now_iso()
    with _app_db() as conn:
        cursor = conn.execute(
            "INSERT INTO handouts (title, markdown, players, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (fields["title"], fields["markdown"], fields["players"], now, now),
        )
    return jsonify({"ok": True, "id": cursor.lastrowid}), 201


@bp.put("/api/handouts/<int:handout_id>")
def api_update_handout(handout_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    fields, body_error = _validated_body()
    if body_error:
        return body_error
    with _app_db() as conn:
        cursor = conn.execute(
            "UPDATE handouts SET title = ?, markdown = ?, players = ?, updated_at = ?"
            " WHERE id = ?",
            (fields["title"], fields["markdown"], fields["players"],
             _utc_now_iso(), handout_id),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Handout not found"}), 404
    return jsonify({"ok": True, "id": handout_id})


@bp.delete("/api/handouts/<int:handout_id>")
def api_delete_handout(handout_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        cursor = conn.execute("DELETE FROM handouts WHERE id = ?", (handout_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Handout not found"}), 404
    return jsonify({"ok": True, "deleted": handout_id})


__all__ = ['api_my_handouts', 'api_all_handouts', 'api_create_handout',
           'api_update_handout', 'api_delete_handout']
