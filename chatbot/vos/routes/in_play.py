from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("in_play", __name__)

@bp.route("/api/in-play", methods=["GET", "PUT"])
def in_play_endpoint():
    """Live overlay for the "Currently In Play" cards. GET is public and
    returns the ordered list (empty list when nothing's been set, in which
    case the client falls back to the static campaign.inPlay snapshot).
    PUT is admin-only and replaces the whole list — simpler than CRUD for
    a hand-curated cap of ~10 items."""
    if request.method == "GET":
        with _app_db() as conn:
            rows = list(conn.execute("""
                SELECT id, name, role, kind, emblem, link, sort_order
                FROM in_play
                ORDER BY sort_order, id
            """))
        items = [{
            "id": row["id"],
            "name": row["name"],
            "role": row["role"],
            "kind": row["kind"],
            "emblem": row["emblem"],
            "link": row["link"],
        } for row in rows]
        return jsonify({"items": items})

    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    body = request.get_json(silent=True) or {}
    incoming = body.get("items")
    if not isinstance(incoming, list):
        return jsonify({"error": "items must be an array"}), 400
    if len(incoming) > 50:
        return jsonify({"error": "Too many items (max 50)"}), 400

    cleaned = []
    for item in incoming:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()[:120]
        if not name:
            continue
        cleaned.append({
            "name": name,
            "role": str(item.get("role") or "").strip()[:120],
            "kind": str(item.get("kind") or "").strip()[:40],
            "emblem": str(item.get("emblem") or "").strip()[:8],
            "link": str(item.get("link") or "").strip()[:300],
        })

    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("DELETE FROM in_play")
        for i, item in enumerate(cleaned):
            conn.execute("""
                INSERT INTO in_play (name, role, kind, emblem, link, sort_order, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (item["name"], item["role"], item["kind"], item["emblem"], item["link"], i, now))

    return jsonify({"ok": True, "count": len(cleaned)})

__all__ = ['in_play_endpoint']
