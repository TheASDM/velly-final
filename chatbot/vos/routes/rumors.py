from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("rumors", __name__)

@bp.route("/api/rumors/roll", methods=["GET"])
def rumors_roll():
    """One random rumor for the tavern card. ?not=<id> avoids an
    immediate repeat when someone rolls twice."""
    exclude = request.args.get("not", "")
    with _app_db() as conn:
        query = "SELECT id, text FROM rumors"
        params = []
        if exclude.isdigit():
            count = conn.execute("SELECT COUNT(*) AS n FROM rumors").fetchone()["n"]
            if count > 1:
                query += " WHERE id != ?"
                params.append(int(exclude))
        row = conn.execute(query + " ORDER BY RANDOM() LIMIT 1", params).fetchone()
    if not row:
        return jsonify({"rumor": None})
    return jsonify({"rumor": {"id": row["id"], "text": row["text"]}})


@bp.route("/api/rumors", methods=["GET", "POST"])
def rumors():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    if request.method == "GET":
        with _app_db() as conn:
            rows = conn.execute(
                "SELECT id, text, created_at FROM rumors ORDER BY id DESC"
            ).fetchall()
        return jsonify({"rumors": [dict(row) for row in rows]})

    body = request.get_json(silent=True) or {}
    text = str(body.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Missing rumor text"}), 400
    if len(text) > 500:
        return jsonify({"error": "Rumor too long (500 chars max)"}), 400
    with _app_db() as conn:
        cursor = conn.execute(
            "INSERT INTO rumors (text, created_at) VALUES (?, ?)",
            (text, _utc_now_iso()),
        )
    return jsonify({"ok": True, "id": cursor.lastrowid}), 201


@bp.route("/api/rumors/<int:rumor_id>", methods=["DELETE"])
def rumors_delete(rumor_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        cursor = conn.execute("DELETE FROM rumors WHERE id = ?", (rumor_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Rumor not found"}), 404
    return jsonify({"ok": True, "deleted": rumor_id})

__all__ = ['rumors_roll', 'rumors', 'rumors_delete']
