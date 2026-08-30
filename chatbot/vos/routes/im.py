"""Instant messages: player↔DM, player↔player, and the party channel.

Design rules, all enforced here rather than trusted from the client:

  Sender identity comes from the verified token only — no endpoint accepts
  a name. Membership is derived from the thread key against the live roster:
  "party" includes everyone at the table plus the DM; a direct thread's key
  is the sorted pair "Alice|Bob" and only those two are members. The DM is
  refused (403, and told why) on a player-pair thread — the direct channels
  between players are theirs.

  Bodies are plain text up to 4KB, rendered client-side through the same
  safe-markdown pipeline as everything else. Soft delete only, of your own
  messages; no editing. Conversations live in the runtime SQLite database
  (backed up with it) and never in the public repo.
"""
from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("im", __name__)

CHAT_BODY_MAX_BYTES = 4096
PARTY_THREAD_KEY = "party"
THREAD_PAGE_LIMIT = 200


def _im_roster():
    """Everyone who can hold a thread: the roster's players plus the DM."""
    return set(_roster_player_names()) | {"DM"}


def _direct_thread_key(a, b):
    return "|".join(sorted([a, b]))


def _thread_members(thread_key, roster):
    """The members of a thread key, or None when the key names no valid
    thread (unknown player, unsorted pair, self-pair)."""
    if thread_key == PARTY_THREAD_KEY:
        return set(roster)
    parts = thread_key.split("|")
    if len(parts) != 2 or parts[0] == parts[1]:
        return None
    if parts != sorted(parts):
        return None
    if not all(part in roster for part in parts):
        return None
    return set(parts)


def _im_caller():
    """The verified sender, from the token only. Returns (name, error)."""
    return _logged_in_player_name()


def _thread_access_error(thread_key, caller):
    members = _thread_members(thread_key, _im_roster())
    if members is None:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    if caller not in members:
        if caller == "DM":
            # Enforced AND stated: the direct channels between players are
            # theirs, and the DM should know that is a rule, not a bug.
            return jsonify({
                "error": "This thread is between players — the DM seat is not a member.",
                "error_code": "forbidden",
            }), 403
        return jsonify({
            "error": "You are not a member of this thread.",
            "error_code": "forbidden",
        }), 403
    return None


def _chat_message_json(row):
    deleted = bool(row["deleted_at"])
    return {
        "id": row["id"],
        "threadKey": row["thread_key"],
        "sender": row["sender"],
        # A deleted message keeps its slot (clients replace the bubble) but
        # its words are gone.
        "body": "" if deleted else row["body"],
        "created_at": row["created_at"],
        "deleted": deleted,
    }


def _caller_thread_keys(caller, roster):
    """The threads this caller belongs to, in display order: DM pinned
    first for players, then the other players, then the party channel."""
    keys = []
    if caller != "DM":
        keys.append(_direct_thread_key(caller, "DM"))
    others = sorted(name for name in roster if name not in (caller, "DM"))
    keys.extend(_direct_thread_key(caller, other) for other in others)
    keys.append(PARTY_THREAD_KEY)
    return keys


def _thread_label(thread_key, caller):
    if thread_key == PARTY_THREAD_KEY:
        return "The Party"
    parts = thread_key.split("|")
    other = parts[1] if parts[0] == caller else parts[0]
    return other


@bp.route("/api/im/threads", methods=["GET"])
def im_threads():
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    roster = _im_roster()
    keys = _caller_thread_keys(caller, roster)
    placeholders = ",".join("?" for _ in keys)

    with _app_db() as conn:
        # Unread counts and the newest message id, one grouped pass.
        stats = {
            row["thread_key"]: row
            for row in conn.execute(f"""
                SELECT m.thread_key,
                       SUM(CASE
                           WHEN m.id > COALESCE(r.last_read_id, 0)
                            AND m.sender != ?
                            AND m.deleted_at IS NULL
                           THEN 1 ELSE 0 END) AS unread,
                       MAX(m.id) AS last_id
                FROM chat_messages m
                LEFT JOIN chat_reads r
                  ON r.thread_key = m.thread_key AND r.player_name = ?
                WHERE m.thread_key IN ({placeholders})
                GROUP BY m.thread_key
            """, [caller, caller, *keys])
        }
        last_ids = [row["last_id"] for row in stats.values() if row["last_id"]]
        previews = {}
        if last_ids:
            id_placeholders = ",".join("?" for _ in last_ids)
            for row in conn.execute(f"""
                SELECT * FROM chat_messages WHERE id IN ({id_placeholders})
            """, last_ids):
                previews[row["thread_key"]] = _chat_message_json(row)
        muted = {
            row["thread_key"]
            for row in conn.execute(f"""
                SELECT thread_key FROM chat_reads
                WHERE player_name = ? AND muted = 1
                  AND thread_key IN ({placeholders})
            """, [caller, *keys])
        }

    threads = []
    for key in keys:
        stat = stats.get(key)
        preview = previews.get(key)
        if preview and preview["body"]:
            preview = {**preview, "body": preview["body"][:140]}
        threads.append({
            "key": key,
            "kind": "party" if key == PARTY_THREAD_KEY else "direct",
            "label": _thread_label(key, caller),
            "unread": int(stat["unread"] or 0) if stat else 0,
            "muted": key in muted,
            "last": preview,
        })
    return jsonify({"ok": True, "playerName": caller, "threads": threads})


@bp.route("/api/im/thread/<path:thread_key>", methods=["GET", "POST"])
@limiter.limit("60/hour", methods=["POST"])
def im_thread(thread_key):
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error

    if request.method == "GET":
        try:
            after = int(request.args.get("after", "0"))
        except ValueError:
            after = 0
        with _app_db() as conn:
            rows = conn.execute("""
                SELECT * FROM chat_messages
                WHERE thread_key = ? AND id > ?
                ORDER BY id DESC
                LIMIT ?
            """, (thread_key, after, THREAD_PAGE_LIMIT)).fetchall()
        messages = [_chat_message_json(row) for row in reversed(rows)]
        return jsonify({"ok": True, "threadKey": thread_key, "messages": messages})

    body = request.get_json(silent=True) or {}
    text = body.get("body")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Write the message first", "error_code": "invalid"}), 400
    text = text.strip()
    if len(text.encode("utf-8")) > CHAT_BODY_MAX_BYTES:
        return jsonify({"error": "Message is too long (4KB max)", "error_code": "invalid"}), 400

    now = _utc_now_iso()
    with _app_db() as conn:
        cursor = conn.execute("""
            INSERT INTO chat_messages (thread_key, sender, body, created_at)
            VALUES (?, ?, ?, ?)
        """, (thread_key, caller, text, now))
        message_id = cursor.lastrowid
        # Your own message never counts against you as unread.
        conn.execute("""
            INSERT INTO chat_reads (thread_key, player_name, last_read_id, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                last_read_id = MAX(last_read_id, excluded.last_read_id),
                updated_at = excluded.updated_at
        """, (thread_key, caller, message_id, now))
        row = conn.execute(
            "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
        ).fetchone()

    _notify_thread(thread_key, caller, text)
    return jsonify({"ok": True, "message": _chat_message_json(row)}), 201


def _notify_thread(thread_key, sender, text):
    """Best-effort push to the other members' backgrounded devices,
    skipping anyone who muted the thread. Never blocks the send."""
    if _push_config_error():
        return
    try:
        members = _thread_members(thread_key, _im_roster()) or set()
        with _app_db() as conn:
            muted = {
                row["player_name"]
                for row in conn.execute(
                    "SELECT player_name FROM chat_reads WHERE thread_key = ? AND muted = 1",
                    (thread_key,),
                )
            }
        recipients = sorted(members - muted - {sender})
        if not recipients:
            return
        title = f"{sender} — The Party" if thread_key == PARTY_THREAD_KEY else sender
        _fanout_push(
            title,
            text[:200],
            f"/messages/#{thread_key}",
            recipients=recipients,
        )
    except Exception:
        logging.exception("IM push for %s failed", thread_key)


@bp.route("/api/im/read", methods=["POST"])
def im_read():
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    thread_key = str(body.get("threadKey") or body.get("thread_key") or "")
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    try:
        last_read_id = int(body.get("lastReadId") or body.get("last_read_id") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "lastReadId must be a number", "error_code": "invalid"}), 400
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO chat_reads (thread_key, player_name, last_read_id, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                last_read_id = MAX(last_read_id, excluded.last_read_id),
                updated_at = excluded.updated_at
        """, (thread_key, caller, max(0, last_read_id), _utc_now_iso()))
    return jsonify({"ok": True})


@bp.route("/api/im/mute", methods=["POST"])
def im_mute():
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    thread_key = str(body.get("threadKey") or body.get("thread_key") or "")
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    muted = 1 if body.get("muted") else 0
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO chat_reads (thread_key, player_name, muted, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                muted = excluded.muted,
                updated_at = excluded.updated_at
        """, (thread_key, caller, muted, _utc_now_iso()))
    return jsonify({"ok": True, "muted": bool(muted)})


@bp.route("/api/im/message/<int:message_id>", methods=["DELETE"])
def im_delete_message(message_id):
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    with _app_db() as conn:
        row = conn.execute(
            "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
        ).fetchone()
        if not row or row["deleted_at"]:
            return jsonify({"error": "Message not found", "error_code": "not_found"}), 404
        if row["sender"] != caller:
            return jsonify({
                "error": "Only the sender can delete a message.",
                "error_code": "forbidden",
            }), 403
        conn.execute(
            "UPDATE chat_messages SET deleted_at = ? WHERE id = ?",
            (_utc_now_iso(), message_id),
        )
    return jsonify({"ok": True, "id": message_id, "deleted": True})


__all__ = ['CHAT_BODY_MAX_BYTES', 'PARTY_THREAD_KEY', '_im_roster', '_direct_thread_key',
           '_thread_members', '_im_caller', '_thread_access_error', '_chat_message_json',
           '_caller_thread_keys', '_thread_label', 'im_threads', 'im_thread',
           '_notify_thread', 'im_read', 'im_mute', 'im_delete_message']
