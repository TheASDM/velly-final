from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("availability", __name__)

@bp.route("/api/availability", methods=["GET", "POST"])
def availability():
    if request.method == "GET":
        player_name, auth_error = _authenticated_player_name()
        if auth_error:
            return auth_error
        if not player_name:
            return jsonify({"error": "Missing player name"}), 400
        date_from, date_to, range_error = _date_range_from_request()
        if range_error:
            return range_error
        query = "SELECT date, rating, times, updated_at FROM availability WHERE player_name = ?"
        params = [player_name]
        if date_from:
            query += " AND date >= ?"
            params.append(date_from.isoformat())
        if date_to:
            query += " AND date <= ?"
            params.append(date_to.isoformat())
        query += " ORDER BY date"
        with _app_db() as conn:
            rows = conn.execute(query, params).fetchall()
        last_updated = max((row["updated_at"] for row in rows), default=None)
        return jsonify({
            "playerName": player_name,
            "entries": [
                {
                    "date": row["date"],
                    "rating": row["rating"],
                    "times": _availability_times_json(row["times"]),
                }
                for row in rows
            ],
            "updated_at": last_updated,
        })

    body = request.get_json(silent=True) or {}
    player_name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    if not player_name:
        return jsonify({"error": "Missing player name"}), 400
    date_from, date_to, range_error = _date_range_from_request(body)
    if range_error:
        return range_error
    if not date_from or not date_to:
        return jsonify({"error": "Missing from/to range"}), 400

    raw_entries = body.get("entries")
    if not isinstance(raw_entries, list):
        return jsonify({"error": "Missing entries list"}), 400
    if len(raw_entries) > 400:
        return jsonify({"error": "Too many entries"}), 400

    cleaned = {}
    for raw in raw_entries:
        if not isinstance(raw, dict):
            return jsonify({"error": "Invalid entry"}), 400
        entry_date = _parse_iso_date(raw.get("date"))
        rating = raw.get("rating")
        if not entry_date:
            return jsonify({"error": "Entry has invalid date"}), 400
        if not (date_from <= entry_date <= date_to):
            return jsonify({"error": f"Date {entry_date.isoformat()} outside submitted range"}), 400
        if rating not in AVAILABILITY_RATINGS:
            return jsonify({"error": f"Invalid rating for {entry_date.isoformat()}"}), 400
        # Weekdays only carry "can't make that evening".
        if entry_date.weekday() < 5 and rating != "unavailable":
            return jsonify({
                "error": f"{entry_date.isoformat()} is a weekday; only 'unavailable' is allowed"
            }), 400
        times = _normalized_times(entry_date, rating, raw.get("times"))
        cleaned[entry_date.isoformat()] = (rating, times)

    updated_at = _utc_now_iso()
    with _app_db() as conn:
        # Full replace within the range so cleared marks disappear.
        conn.execute(
            "DELETE FROM availability WHERE player_name = ? AND date >= ? AND date <= ?",
            (player_name, date_from.isoformat(), date_to.isoformat()),
        )
        conn.executemany("""
            INSERT INTO availability (player_name, date, rating, times, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, [
            (player_name, entry_date, rating, json.dumps(times), updated_at)
            for entry_date, (rating, times) in sorted(cleaned.items())
        ])
    return jsonify({
        "ok": True,
        "playerName": player_name,
        "saved": len(cleaned),
        "updated_at": updated_at,
    })


@bp.route("/api/availability/summary", methods=["GET"])
def availability_summary():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    date_from, date_to, range_error = _date_range_from_request()
    if range_error:
        return range_error

    query = "SELECT player_name, date, rating, times, updated_at FROM availability"
    clauses, params = [], []
    if date_from:
        clauses.append("date >= ?")
        params.append(date_from.isoformat())
    if date_to:
        clauses.append("date <= ?")
        params.append(date_to.isoformat())
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY date, player_name"

    days = {}
    submitted = {}
    with _app_db() as conn:
        for row in conn.execute(query, params):
            days.setdefault(row["date"], []).append({
                "player": row["player_name"],
                "rating": row["rating"],
                "times": _availability_times_json(row["times"]),
            })
            prev = submitted.get(row["player_name"])
            if not prev or row["updated_at"] > prev:
                submitted[row["player_name"]] = row["updated_at"]
    return jsonify({
        "days": days,
        "submitted": [
            {"player": name, "updated_at": stamp}
            for name, stamp in sorted(submitted.items())
        ],
    })

__all__ = ['availability', 'availability_summary']
