from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("rsvp", __name__)

def _rsvp_counts_and_responses(conn, event_id):
    rows = list(conn.execute("""
        SELECT player_name, status, updated_at
        FROM rsvps
        WHERE event_id = ?
        ORDER BY player_name COLLATE NOCASE
    """, (event_id,)))
    counts = {"going": 0, "maybe": 0, "out": 0}
    responses = []
    for row in rows:
        status = row["status"]
        if status in counts:
            counts[status] += 1
        responses.append({
            "player_name": row["player_name"],
            "status": status,
            "updated_at": row["updated_at"],
        })
    return counts, responses


def _event_id_from_request(body=None):
    body = body or {}
    value = (
        body.get("eventId")
        or body.get("event_id")
        or request.args.get("eventId")
        or request.args.get("event_id")
    )
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()[:100]


@bp.route("/api/rsvp", methods=["GET", "POST"])
def rsvp():
    if request.method == "GET":
        event_id = _event_id_from_request()
        if not event_id:
            return jsonify({"error": "Missing eventId"}), 400

        player_name = _player_name_from_request()
        if player_name:
            player_name, auth_error = _authenticated_player_name()
            if auth_error:
                return auth_error
        with _app_db() as conn:
            if player_name:
                row = conn.execute("""
                    SELECT status, updated_at
                    FROM rsvps
                    WHERE event_id = ? AND player_name = ?
                """, (event_id, player_name)).fetchone()
                return jsonify({
                    "eventId": event_id,
                    "playerName": player_name,
                    "status": row["status"] if row else None,
                    "updated_at": row["updated_at"] if row else None,
                })

            admin_error = _admin_error_response()
            if admin_error:
                return admin_error
            counts, responses = _rsvp_counts_and_responses(conn, event_id)

        return jsonify({
            "eventId": event_id,
            "counts": counts,
            "responses": responses,
        })

    body = request.get_json(silent=True) or {}
    event_id = _event_id_from_request(body)
    player_name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    status = body.get("status", "")

    if not event_id:
        return jsonify({"error": "Missing eventId"}), 400
    if not player_name:
        return jsonify({"error": "Missing player name"}), 400
    if not isinstance(status, str) or status not in RSVP_STATUSES:
        return jsonify({"error": "Invalid RSVP status"}), 400

    updated_at = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO rsvps (event_id, player_name, status, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(event_id, player_name) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at
        """, (event_id, player_name, status, updated_at))
        counts, _responses = _rsvp_counts_and_responses(conn, event_id)

    return jsonify({
        "ok": True,
        "eventId": event_id,
        "playerName": player_name,
        "status": status,
        "updated_at": updated_at,
        "counts": counts,
    })

__all__ = ['_rsvp_counts_and_responses', '_event_id_from_request', 'rsvp']
