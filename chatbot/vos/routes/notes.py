from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("notes", __name__)

def _note_scope(body=None):
    body = body or {}
    raw = body.get("scope") or request.args.get("scope") or "private"
    raw = str(raw or "").strip().lower()
    return "dm" if raw in {"dm", "dm_notes", "dm-notes"} else "private"


def _note_owner_for_scope(player_name, scope):
    if scope == "dm":
        if not _is_dm_player(player_name):
            return None, (jsonify({"error": "DM access required"}), 403)
        return "DM", None
    return player_name, None


def _note_payload(row):
    return {
        "id": row["id"],
        "scope": row["scope"],
        "title": row["title"],
        "body": row["body"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _sanitize_note_body(value):
    if not isinstance(value, str):
        return ""
    return value.strip()[:50000]


def _sanitize_note_title(value, body=""):
    if isinstance(value, str) and value.strip():
        return value.strip()[:140]
    first = next((line.strip() for line in str(body or "").splitlines() if line.strip()), "")
    return (first[:140] if first else "Untitled Note")


@bp.route("/api/notes", methods=["GET", "POST"])
def notes_endpoint():
    player_name, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error

    if request.method == "GET":
        scope = _note_scope()
        owner, scope_error = _note_owner_for_scope(player_name, scope)
        if scope_error:
            return scope_error
        with _app_db() as conn:
            rows = list(conn.execute("""
                SELECT id, owner, scope, title, body, created_at, updated_at
                FROM notes
                WHERE owner = ? AND scope = ? AND deleted_at IS NULL
                ORDER BY updated_at DESC, created_at DESC
                LIMIT 200
            """, (owner, scope)))
        return jsonify({
            "notes": [_note_payload(row) for row in rows],
            "scope": scope,
        })

    body = request.get_json(silent=True) or {}
    scope = _note_scope(body)
    owner, scope_error = _note_owner_for_scope(player_name, scope)
    if scope_error:
        return scope_error

    note_body = _sanitize_note_body(body.get("body"))
    title = _sanitize_note_title(body.get("title"), note_body)
    now = _utc_now_iso()
    note_id = secrets.token_urlsafe(12)
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO notes (id, owner, scope, title, body, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (note_id, owner, scope, title, note_body, now, now))
        row = conn.execute("""
            SELECT id, owner, scope, title, body, created_at, updated_at
            FROM notes
            WHERE id = ?
        """, (note_id,)).fetchone()
    return jsonify({"ok": True, "note": _note_payload(row)}), 201


@bp.route("/api/notes/<note_id>", methods=["PUT", "PATCH", "DELETE"])
def note_endpoint(note_id):
    player_name, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error

    with _app_db() as conn:
        row = conn.execute("""
            SELECT id, owner, scope, title, body, created_at, updated_at
            FROM notes
            WHERE id = ? AND deleted_at IS NULL
        """, (note_id,)).fetchone()
        if not row:
            return jsonify({"error": "Note not found"}), 404
        if row["scope"] == "dm":
            if not _is_dm_player(player_name):
                return jsonify({"error": "DM access required"}), 403
        elif row["owner"] != player_name:
            return jsonify({"error": "Not your note"}), 403

        if request.method == "DELETE":
            conn.execute("""
                UPDATE notes
                SET deleted_at = ?, updated_at = ?
                WHERE id = ?
            """, (_utc_now_iso(), _utc_now_iso(), note_id))
            return jsonify({"ok": True, "id": note_id})

        body = request.get_json(silent=True) or {}
        note_body = _sanitize_note_body(body.get("body"))
        title = _sanitize_note_title(body.get("title"), note_body)
        updated_at = _utc_now_iso()
        conn.execute("""
            UPDATE notes
            SET title = ?, body = ?, updated_at = ?
            WHERE id = ?
        """, (title, note_body, updated_at, note_id))
        row = conn.execute("""
            SELECT id, owner, scope, title, body, created_at, updated_at
            FROM notes
            WHERE id = ?
        """, (note_id,)).fetchone()
    return jsonify({"ok": True, "note": _note_payload(row)})

__all__ = ['_note_scope', '_note_owner_for_scope', '_note_payload', '_sanitize_note_body', '_sanitize_note_title', 'notes_endpoint', 'note_endpoint']
