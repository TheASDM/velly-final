from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("messages", __name__)

def _message_payload(row, recipients=None, push_summary=None, include_deleted=False):
    payload = {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "url": row["url"],
        "target_type": row["target_type"],
        "created_at": row["created_at"],
    }
    if recipients is not None:
        payload["recipients"] = recipients
    if push_summary is not None:
        payload["push"] = push_summary
    if include_deleted:
        payload["deleted_at"] = row["deleted_at"]
    return payload


@bp.route("/api/messages", methods=["GET", "POST"])
def dm_messages():
    if request.method == "GET":
        try:
            limit = int(request.args.get("limit", "5"))
        except ValueError:
            limit = 5
        limit = max(1, min(limit, 20))
        try:
            offset = int(request.args.get("offset", "0"))
        except ValueError:
            offset = 0
        offset = max(0, offset)

        if _auth_login_required():
            name, auth_error = _logged_in_player_name()
            if auth_error:
                return auth_error
        else:
            name = _player_name_from_request()

        with _app_db() as conn:
            if name:
                rows = list(conn.execute("""
                    SELECT id, title, body, url, target_type, created_at, deleted_at
                    FROM messages
                    WHERE deleted_at IS NULL
                      AND (
                        target_type = 'all'
                        OR EXISTS (
                            SELECT 1
                            FROM message_recipients
                            WHERE message_recipients.message_id = messages.id
                              AND message_recipients.player_name = ?
                        )
                      )
                      AND NOT EXISTS (
                        SELECT 1
                        FROM message_dismissals
                        WHERE message_dismissals.message_id = messages.id
                          AND message_dismissals.player_name = ?
                      )
                    ORDER BY created_at DESC, id DESC
                    LIMIT ? OFFSET ?
                """, (name, name, limit, offset)))
            else:
                rows = list(conn.execute("""
                    SELECT id, title, body, url, target_type, created_at, deleted_at
                    FROM messages
                    WHERE deleted_at IS NULL
                      AND target_type = 'all'
                    ORDER BY created_at DESC, id DESC
                    LIMIT ? OFFSET ?
                """, (limit, offset)))

        return jsonify({"messages": [_message_payload(row) for row in rows]})

    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    push_error = _push_config_error()
    if push_error:
        return jsonify({"error": push_error}), 503

    body = request.get_json(silent=True) or {}
    title = body.get("title", "")
    message = body.get("body", "")
    url = _app_url(body.get("url", "/"))
    recipients, recipient_error = _parse_recipients(body)
    if recipient_error:
        return recipient_error

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "Missing message title"}), 400
    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Missing message body"}), 400

    title = title.strip()[:120]
    message = message.strip()[:2000]
    target_type = "selected" if recipients else "all"
    created_at = _utc_now_iso()

    with _app_db() as conn:
        cursor = conn.execute("""
            INSERT INTO messages (title, body, url, target_type, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (title, message, url, target_type, created_at))
        message_id = cursor.lastrowid
        if recipients:
            conn.executemany("""
                INSERT INTO message_recipients (message_id, player_name)
                VALUES (?, ?)
            """, [(message_id, name) for name in recipients])
        row = conn.execute("""
            SELECT id, title, body, url, target_type, created_at, deleted_at
            FROM messages
            WHERE id = ?
        """, (message_id,)).fetchone()

    # The message row is committed above; the fan-out's slow webpush calls
    # run outside any transaction.
    push_result = _fanout_push(
        title,
        _markdown_to_push_text(message),
        url,
        recipients=recipients,
        message_id=message_id,
    )

    return jsonify({
        "ok": True,
        "message": _message_payload(row, recipients=recipients or []),
        "push": push_result,
    }), 201


@bp.route("/api/messages/<int:message_id>", methods=["DELETE"])
def dismiss_message(message_id):
    """Recipient-side dismissal. Inserts a row into message_dismissals so
    this player's future /api/messages calls hide the message. The
    underlying message row is left intact (admins still see it via
    /api/admin/messages, and other recipients of a broadcast are
    unaffected)."""
    if _auth_login_required():
        name, auth_error = _logged_in_player_name()
        if auth_error:
            return auth_error
    else:
        name = _player_name_from_request()

    if not name:
        return jsonify({"error": "Player name required"}), 400

    with _app_db() as conn:
        row = conn.execute("""
            SELECT id, target_type
            FROM messages
            WHERE id = ? AND deleted_at IS NULL
        """, (message_id,)).fetchone()
        if not row:
            return jsonify({"error": "Message not found"}), 404

        if row["target_type"] != "all":
            recipient = conn.execute("""
                SELECT 1
                FROM message_recipients
                WHERE message_id = ? AND player_name = ?
            """, (message_id, name)).fetchone()
            if not recipient:
                return jsonify({"error": "Not your message"}), 403

        conn.execute("""
            INSERT OR REPLACE INTO message_dismissals
                (message_id, player_name, dismissed_at)
            VALUES (?, ?, ?)
        """, (message_id, name, _utc_now_iso()))

    return jsonify({"ok": True})

__all__ = ['_message_payload', 'dm_messages', 'dismiss_message']
