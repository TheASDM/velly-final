from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("calendar", __name__)

AVAILABILITY_RATINGS = {"preferred", "available", "unavailable"}
AVAILABILITY_TIMES = ("morning", "afternoon", "evening")
CALENDAR_EVENT_KINDS = {"session", "deadline", "other"}

@bp.route("/api/calendar/<event_id>.ics", methods=["GET"])
def calendar_event_ics(event_id):
    """Serve generated calendar files with headers iOS recognizes.

    Static nginx MIME config is easy to miss during deploys because the
    generated _site files update without restarting nginx. The API route
    keeps the Add to Calendar button correct as long as the Flask app was
    restarted with the new build.
    """
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,120}", event_id or ""):
        abort(404)
    filename = f"{event_id}.ics"
    calendar_dir = SITE_SOURCE_DIR / "_site" / "calendar"
    if not (calendar_dir / filename).is_file():
        abort(404)

    response = send_from_directory(
        calendar_dir,
        filename,
        mimetype="text/calendar",
        as_attachment=True,
        download_name=f"vallombrosa-{filename}",
        max_age=0,
    )
    response.headers["Content-Type"] = "text/calendar; charset=utf-8; method=PUBLISH"
    response.headers["Content-Disposition"] = f'attachment; filename="vallombrosa-{filename}"'
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def _parse_iso_date(value):
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _date_range_from_request(body=None):
    """Read from/to as YYYY-MM-DD from the query string or body.
    Returns (from_date, to_date, error_response)."""
    body = body or {}
    raw_from = request.args.get("from") or body.get("from") or ""
    raw_to = request.args.get("to") or body.get("to") or ""
    date_from = _parse_iso_date(raw_from)
    date_to = _parse_iso_date(raw_to)
    if raw_from and not date_from:
        return None, None, (jsonify({"error": "Invalid 'from' date"}), 400)
    if raw_to and not date_to:
        return None, None, (jsonify({"error": "Invalid 'to' date"}), 400)
    if date_from and date_to and date_to < date_from:
        return None, None, (jsonify({"error": "'to' is before 'from'"}), 400)
    return date_from, date_to, None


def _calendar_event_tasks(raw):
    """Normalize tasks from a JSON string (DB) or a list (request body)."""
    if isinstance(raw, list):
        tasks = raw
    else:
        try:
            tasks = json.loads(raw or "[]")
        except (TypeError, ValueError):
            return []
    if not isinstance(tasks, list):
        return []
    cleaned = []
    for task in tasks:
        if not isinstance(task, dict):
            continue
        text = str(task.get("text") or "").strip()
        if not text:
            continue
        entry = {"text": text[:300]}
        due = task.get("due")
        if isinstance(due, str) and _parse_iso_date(due):
            entry["due"] = due.strip()
        cleaned.append(entry)
    return cleaned[:20]


def _calendar_event_json(row):
    keys = row.keys()
    return {
        "id": row["id"],
        "date": row["date"],
        "title": row["title"],
        "timeLabel": row["time_label"] or "",
        "location": row["location"] or "",
        "notes": row["notes"] or "",
        "kind": row["kind"],
        "tasks": _calendar_event_tasks(row["tasks"] if "tasks" in keys else "[]"),
        "eventKey": f"cal-{row['id']}",
        "icsUrl": f"/api/calendar/events/{row['id']}.ics",
        "updated_at": row["updated_at"],
    }


def _ics_escape(value):
    return (
        str(value or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _availability_times_json(raw):
    try:
        times = json.loads(raw or "[]")
    except (TypeError, ValueError):
        return []
    if not isinstance(times, list):
        return []
    return [t for t in AVAILABILITY_TIMES if t in times]


def _normalized_times(date_obj, rating, times):
    """Times only mean anything on a Saturday the player can make."""
    if date_obj.weekday() != 5 or rating == "unavailable":
        return []
    if not isinstance(times, list):
        return []
    return [t for t in AVAILABILITY_TIMES if t in times]


@bp.route("/api/calendar/events", methods=["GET", "POST"])
def calendar_events():
    if request.method == "GET":
        date_from, date_to, range_error = _date_range_from_request()
        if range_error:
            return range_error
        query = "SELECT * FROM calendar_events"
        clauses, params = [], []
        if date_from:
            clauses.append("date >= ?")
            params.append(date_from.isoformat())
        if date_to:
            clauses.append("date <= ?")
            params.append(date_to.isoformat())
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY date, id"
        with _app_db() as conn:
            rows = conn.execute(query, params).fetchall()
        return jsonify({"events": [_calendar_event_json(row) for row in rows]})

    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    event_date = _parse_iso_date(body.get("date"))
    title = str(body.get("title") or "").strip()
    kind = str(body.get("kind") or "session").strip()
    if not event_date:
        return jsonify({"error": "Missing or invalid date (YYYY-MM-DD)"}), 400
    if not title:
        return jsonify({"error": "Missing title"}), 400
    if len(title) > 200:
        return jsonify({"error": "Title too long"}), 400
    if kind not in CALENDAR_EVENT_KINDS:
        return jsonify({"error": "Invalid kind"}), 400

    now = _utc_now_iso()
    with _app_db() as conn:
        cursor = conn.execute("""
            INSERT INTO calendar_events
                (date, title, time_label, location, notes, kind, tasks, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event_date.isoformat(),
            title,
            str(body.get("timeLabel") or "").strip()[:120] or None,
            str(body.get("location") or "").strip()[:200] or None,
            str(body.get("notes") or "").strip()[:2000] or None,
            kind,
            json.dumps(_calendar_event_tasks(body.get("tasks"))),
            now,
            now,
        ))
        row = conn.execute(
            "SELECT * FROM calendar_events WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return jsonify({"ok": True, "event": _calendar_event_json(row)}), 201


@bp.route("/api/calendar/events/<int:event_id>", methods=["PUT", "DELETE"])
def calendar_event_detail(event_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    with _app_db() as conn:
        row = conn.execute(
            "SELECT * FROM calendar_events WHERE id = ?", (event_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "Event not found"}), 404

        if request.method == "DELETE":
            conn.execute("DELETE FROM calendar_events WHERE id = ?", (event_id,))
            return jsonify({"ok": True, "deleted": event_id})

        body = request.get_json(silent=True) or {}
        updates, params = [], []
        if "date" in body:
            event_date = _parse_iso_date(body.get("date"))
            if not event_date:
                return jsonify({"error": "Invalid date (YYYY-MM-DD)"}), 400
            updates.append("date = ?")
            params.append(event_date.isoformat())
        if "title" in body:
            title = str(body.get("title") or "").strip()
            if not title or len(title) > 200:
                return jsonify({"error": "Invalid title"}), 400
            updates.append("title = ?")
            params.append(title)
        if "kind" in body:
            kind = str(body.get("kind") or "").strip()
            if kind not in CALENDAR_EVENT_KINDS:
                return jsonify({"error": "Invalid kind"}), 400
            updates.append("kind = ?")
            params.append(kind)
        for field, column, limit in (
            ("timeLabel", "time_label", 120),
            ("location", "location", 200),
            ("notes", "notes", 2000),
        ):
            if field in body:
                updates.append(f"{column} = ?")
                params.append(str(body.get(field) or "").strip()[:limit] or None)
        if "tasks" in body:
            updates.append("tasks = ?")
            params.append(json.dumps(_calendar_event_tasks(body.get("tasks"))))
        if not updates:
            return jsonify({"error": "Nothing to update"}), 400

        updates.append("updated_at = ?")
        params.append(_utc_now_iso())
        params.append(event_id)
        conn.execute(
            f"UPDATE calendar_events SET {', '.join(updates)} WHERE id = ?", params
        )
        row = conn.execute(
            "SELECT * FROM calendar_events WHERE id = ?", (event_id,)
        ).fetchone()
    return jsonify({"ok": True, "event": _calendar_event_json(row)})


@bp.route("/api/calendar/next", methods=["GET"])
def calendar_next():
    """The next upcoming session event — the app's 'Next Gathering'."""
    today = datetime.now(timezone.utc).date().isoformat()
    with _app_db() as conn:
        row = conn.execute("""
            SELECT * FROM calendar_events
            WHERE kind = 'session' AND date >= ?
            ORDER BY date, id
            LIMIT 1
        """, (today,)).fetchone()
    return jsonify({"gathering": _calendar_event_json(row) if row else None})


@bp.route("/api/calendar/events/<int:event_id>.ics", methods=["GET"])
def calendar_event_db_ics(event_id):
    """ICS generated straight from the calendar_events row, so 'Add to
    Calendar' works without an Eleventy rebuild."""
    with _app_db() as conn:
        row = conn.execute(
            "SELECT * FROM calendar_events WHERE id = ?", (event_id,)
        ).fetchone()
    if not row:
        abort(404)
    event_date = _parse_iso_date(row["date"])
    if not event_date:
        abort(404)
    day_after = event_date + timedelta(days=1)
    description = " / ".join(
        part for part in (
            row["time_label"] or "",
            row["notes"] or "",
        ) if part
    )
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Vallombrosa//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:cal-{row['id']}@vallombrosa",
        f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART;VALUE=DATE:{event_date.strftime('%Y%m%d')}",
        f"DTEND;VALUE=DATE:{day_after.strftime('%Y%m%d')}",
        f"SUMMARY:{_ics_escape(row['title'])}",
    ]
    if row["location"]:
        lines.append(f"LOCATION:{_ics_escape(row['location'])}")
    if description:
        lines.append(f"DESCRIPTION:{_ics_escape(description)}")
    lines += ["END:VEVENT", "END:VCALENDAR"]

    response = Response("\r\n".join(lines) + "\r\n")
    response.headers["Content-Type"] = "text/calendar; charset=utf-8; method=PUBLISH"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="vallombrosa-cal-{row["id"]}.ics"'
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response

__all__ = ['AVAILABILITY_RATINGS', 'AVAILABILITY_TIMES', 'CALENDAR_EVENT_KINDS', 'calendar_event_ics', '_parse_iso_date', '_date_range_from_request', '_calendar_event_tasks', '_calendar_event_json', '_ics_escape', '_availability_times_json', '_normalized_times', 'calendar_events', 'calendar_event_detail', 'calendar_next', 'calendar_event_db_ics']
