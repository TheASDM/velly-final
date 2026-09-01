"""Instant messages: player↔DM, player↔player, and the party channel.

Design rules, all enforced here rather than trusted from the client:

  Sender identity comes from the verified token only — no endpoint accepts
  a name. Membership is derived from the thread key against the live roster:
  "party" includes everyone at the table plus the DM; a direct thread's key
  is the sorted pair "Alice|Bob" and only those two are members. The DM is
  refused (403, and told why) on a player-pair thread — the direct channels
  between players are theirs.

  Enzo is a direct-only pseudo-member: everyone at the table has a thread
  with him and nobody else can read it, the same rule that protects a
  player pair. He is deliberately absent from the party channel — every
  message there would be an LLM call.

  Bodies are plain text up to 4KB, rendered client-side through the same
  safe-markdown pipeline as everything else. Soft delete only, of your own
  messages; no editing. Conversations live in the runtime SQLite database
  (backed up with it) and never in the public repo.
"""
from ..imports import *
from ..symbols import *
from ..config import *
from ..config import CHAT_SEAT_IDS, CHAT_SYSTEM_SEAT_IDS
from ..web import limiter

bp = Blueprint("im", __name__)

CHAT_BODY_MAX_BYTES = 4096
PARTY_THREAD_KEY = "party"
THREAD_PAGE_LIMIT = 200
# Not a roster seat — adding him to _data/players.json would break the auth
# maps and the records that key off it. He exists only as a thread partner.
ENZO_NAME = "Enzo"
# A one-way synthetic correspondent for exercising the real DM notification
# path. It is deliberately not a roster seat and has no credential: messages
# can enter its thread only through the container-local endpoint below.
TEST_MESSENGER_NAME = "Vesper"
TEST_MESSENGER_THREAD_KEY = "DM|Vesper"
# Kept for presence labels and backward-compatible tests. Presence is never
# used to suppress push: it is a player-wide timestamp, not proof that every
# subscribed device can currently see this conversation.
PRESENT_WITHIN_SECONDS = 45
# An edit window, not an edit history: long enough to fix a typo or a name,
# short enough that nobody rewrites what the table read an hour ago. The
# row keeps edited_at, so an edited message says so forever.
MESSAGE_EDIT_WINDOW_SECONDS = 3600
# The client heartbeats every ~3s while composing; a row outlives two
# missed beats and no more.
TYPING_TTL_SECONDS = 8
# Six faces, allow-listed here rather than trusted from the client — the
# column would otherwise take any string a request cared to send.
REACTION_EMOJI = ("\U0001F44D", "\u2764\uFE0F", "\U0001F602",
                  "\U0001F62E", "\U0001F622", "\U0001F525")
# How much of the thread Enzo is handed as memory. The engine trims again
# against MAX_CONVERSATION_BYTES; this only bounds the read.
ENZO_HISTORY_LIMIT = 40
CLIENT_MESSAGE_ID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# Web-push network calls are outside the request critical path. This is still
# best-effort delivery; the durable outbox is a later compatibility phase.
_im_push_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="im-push")


def _utc_now_iso_in(seconds):
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)) \
        .isoformat().replace("+00:00", "Z")


def _iso_age_seconds(value):
    """How long ago an ISO timestamp was, in seconds. An unparseable stamp
    reads as ancient, which fails closed on the edit window."""
    try:
        stamp = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return float("inf")
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - stamp).total_seconds()


def _im_roster():
    """Everyone who can hold a thread: the roster's players plus the DM."""
    return set(_roster_player_names()) | {"DM"}


def _direct_thread_key(a, b):
    return "|".join(sorted([a, b]))


def _enzo_thread_key(name):
    return _direct_thread_key(name, ENZO_NAME)


def _enzo_partner(thread_key, roster):
    """The person whose Enzo thread this is, or None if it is not one."""
    parts = thread_key.split("|")
    if len(parts) != 2 or ENZO_NAME not in parts:
        return None
    if parts != sorted(parts):
        return None
    other = parts[0] if parts[1] == ENZO_NAME else parts[1]
    return other if other in roster else None


def _seat_id(name):
    return CHAT_SEAT_IDS.get(name) or CHAT_SYSTEM_SEAT_IDS.get(name)


def _thread_record(conn, reference):
    return conn.execute("""
        SELECT id, legacy_key, kind FROM chat_threads
        WHERE id = ? OR legacy_key = ?
        LIMIT 1
    """, (reference, reference)).fetchone()


def _resolve_thread_reference(reference):
    """Return (legacy key, opaque ID), accepting either at the API edge."""
    with _app_db() as conn:
        row = _thread_record(conn, str(reference or ""))
    return (row["legacy_key"], row["id"]) if row else (None, None)


def _thread_members(thread_key, roster, conn=None):
    """Human members from the authoritative stable membership table."""
    def load(active_conn):
        thread = _thread_record(active_conn, thread_key)
        if not thread:
            return None
        rows = active_conn.execute("""
            SELECT s.canonical_name
            FROM chat_thread_members m
            JOIN chat_seats s ON s.id = m.seat_id
            WHERE m.thread_id = ? AND s.kind = 'human' AND s.active = 1
        """, (thread["id"],)).fetchall()
        return {
            row["canonical_name"] for row in rows
            if row["canonical_name"] in roster
        }

    if conn is not None:
        return load(conn)
    with _app_db() as active_conn:
        return load(active_conn)


def _im_caller():
    """The verified sender, from the token only. Returns (name, error)."""
    caller, error = _logged_in_player_name()
    if error:
        return caller, error
    if _preview_actor():
        return None, (jsonify({
            "error": "Messaging is unavailable while previewing a player.",
            "error_code": "preview_forbidden",
        }), 403)
    return caller, None


def _thread_access_error(thread_key, caller):
    members = _thread_members(thread_key, _im_roster())
    if members is None:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    if caller not in members:
        if _enzo_partner(thread_key, _im_roster()):
            return jsonify({
                "error": "That is someone else's conversation with Enzo.",
                "error_code": "forbidden",
            }), 403
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


def _chat_message_json(row, attachments=None, reply_to_message=None):
    deleted = bool(row["deleted_at"])
    columns = set(row.keys())
    return {
        "id": row["id"],
        "threadKey": row["thread_key"],
        "threadId": row["thread_id"] if "thread_id" in columns else None,
        "sender": row["sender"],
        "senderSeatId": row["sender_seat_id"] if "sender_seat_id" in columns else None,
        # A deleted message keeps its slot (clients replace the bubble) but
        # its words are gone.
        "body": "" if deleted else row["body"],
        "created_at": row["created_at"],
        "deleted": deleted,
        "replyToId": row["reply_to_id"],
        "replyToMessage": reply_to_message,
        # Stated, not hidden: an edited message is marked for everyone.
        "editedAt": None if deleted else row["edited_at"],
        "updatedAt": row["updated_at"] if "updated_at" in columns else row["created_at"],
        "clientMessageId": row["client_message_id"],
        # A deleted message takes its files with it as far as the client is
        # concerned; the rows stay for the orphan sweep to find.
        "attachments": [] if deleted else (attachments or []),
    }


def _reply_snapshots(conn, rows):
    """Compact quoted entities, including quotes outside the loaded page."""
    ids = {
        int(row["reply_to_id"])
        for row in rows
        if row["reply_to_id"] is not None
    }
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    snapshots = {}
    for quoted in conn.execute(f"""
        SELECT * FROM chat_messages WHERE id IN ({placeholders})
    """, sorted(ids)):
        deleted = bool(quoted["deleted_at"])
        snapshots[quoted["id"]] = {
            "id": quoted["id"],
            "threadId": quoted["thread_id"],
            "sender": quoted["sender"],
            "senderSeatId": quoted["sender_seat_id"],
            "body": "" if deleted else quoted["body"],
            "created_at": quoted["created_at"],
            "deleted": deleted,
        }
    return snapshots


def _complete_chat_message_json(conn, row, attachments=None):
    if attachments is None:
        attachments = _attachments_for_messages(conn, [row["id"]]).get(row["id"], [])
    quote = _reply_snapshots(conn, [row]).get(row["reply_to_id"])
    return _chat_message_json(row, attachments, quote)


def _touch_presence(conn, player_name):
    """Last seen, per player rather than per thread. Touched by the polls
    the client already makes, so presence costs no extra request."""
    conn.execute("""
        INSERT INTO player_presence (player_name, seat_id, last_seen_at)
        VALUES (?, ?, ?)
        ON CONFLICT(player_name) DO UPDATE SET
            seat_id = excluded.seat_id,
            last_seen_at = excluded.last_seen_at
    """, (player_name, _seat_id(player_name), _utc_now_iso()))


def _thread_reactions(conn, thread_key, caller):
    """Reactions for the whole thread, keyed by message id as a string so
    the payload survives JSON. Counts render under the bubble; `mine` is
    what lets a second tap take it back."""
    rows = conn.execute("""
        SELECT r.message_id, r.emoji, r.player_name
        FROM chat_reactions r
        JOIN chat_messages m ON m.id = r.message_id
        WHERE m.thread_key = ? AND m.deleted_at IS NULL
        ORDER BY r.created_at ASC
    """, (thread_key,)).fetchall()
    grouped = {}
    for row in rows:
        faces = grouped.setdefault(str(row["message_id"]), {})
        face = faces.setdefault(row["emoji"], {"emoji": row["emoji"], "players": [], "mine": False})
        face["players"].append(row["player_name"])
        if row["player_name"] == caller:
            face["mine"] = True
    return {key: list(faces.values()) for key, faces in grouped.items()}


def _thread_typing(conn, thread_key, caller):
    """Whoever is composing right now, minus you. Expired rows are swept on
    the way past — they are disposable and nothing ever reads them again."""
    now = _utc_now_iso()
    conn.execute("DELETE FROM chat_typing WHERE expires_at <= ?", (now,))
    return sorted(
        row["player_name"]
        for row in conn.execute(
            "SELECT player_name FROM chat_typing WHERE thread_key = ? AND expires_at > ?",
            (thread_key, now),
        )
        if row["player_name"] != caller
    )


def _thread_receipts(conn, thread_key, caller, members):
    """The other members' read pointers. Nearly free: chat_reads already
    holds one per (thread, reader), so "seen by" is only a matter of
    exposing what the unread count was already computed from."""
    others = [name for name in sorted(members) if name != caller]
    if not others:
        return {}
    placeholders = ",".join("?" for _ in others)
    return {
        row["player_name"]: row["last_read_id"]
        for row in conn.execute(f"""
            SELECT player_name, last_read_id FROM chat_reads
            WHERE thread_key = ? AND player_name IN ({placeholders})
        """, [thread_key, *others])
    }


def _present_since(conn, cutoff):
    """Everyone whose client has checked in since `cutoff`. Presence is
    touched by the polls the app already makes, so this costs nothing."""
    return {
        row["player_name"]
        for row in conn.execute(
            "SELECT player_name FROM player_presence WHERE last_seen_at > ?",
            (cutoff,),
        )
    }


def _presence_map(conn, names):
    names = [name for name in names if name != ENZO_NAME]
    if not names:
        return {}
    placeholders = ",".join("?" for _ in names)
    return {
        row["player_name"]: row["last_seen_at"]
        for row in conn.execute(f"""
            SELECT player_name, last_seen_at FROM player_presence
            WHERE player_name IN ({placeholders})
        """, names)
    }


def _message_for_caller(conn, message_id, caller):
    """Load a message the caller is entitled to touch. Returns
    (row, error_response)."""
    row = conn.execute(
        "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
    ).fetchone()
    if not row:
        return None, (jsonify({"error": "Message not found", "error_code": "not_found"}), 404)
    members = _thread_members(row["thread_key"], _im_roster(), conn=conn)
    if not members or caller not in members:
        # Same shape as a missing message: whether a message exists in a
        # thread you cannot read is not yours to learn.
        return None, (jsonify({"error": "Message not found", "error_code": "not_found"}), 404)
    return row, None


def _caller_thread_keys(caller, roster, conn=None):
    """The threads this caller belongs to, in display order: DM pinned
    first for players, then the other players, then the party channel."""
    keys = []
    if caller != "DM":
        keys.append(_direct_thread_key(caller, "DM"))
    else:
        # Vesper is an inbox fixture, not a player. Only the DM seat gets the
        # thread and the API membership rule above makes direct guessing fail.
        keys.append(TEST_MESSENGER_THREAD_KEY)
    keys.append(_enzo_thread_key(caller))
    others = sorted(name for name in roster if name not in (caller, "DM"))
    keys.extend(_direct_thread_key(caller, other) for other in others)
    keys.append(PARTY_THREAD_KEY)
    def allowed(active_conn):
        seat_id = _seat_id(caller)
        return {
            row["legacy_key"]
            for row in active_conn.execute("""
                SELECT t.legacy_key
                FROM chat_thread_members m
                JOIN chat_threads t ON t.id = m.thread_id
                WHERE m.seat_id = ?
            """, (seat_id,))
        }

    if conn is not None:
        memberships = allowed(conn)
    else:
        with _app_db() as active_conn:
            memberships = allowed(active_conn)
    return [key for key in keys if key in memberships]


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
        thread_ids = {
            row["legacy_key"]: row["id"]
            for row in conn.execute("SELECT id, legacy_key FROM chat_threads")
        }
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
        _touch_presence(conn, caller)
        presence = _presence_map(conn, roster)

    threads = []
    for key in keys:
        stat = stats.get(key)
        preview = previews.get(key)
        if preview and preview["body"]:
            preview = {**preview, "body": preview["body"][:140]}
        if key == PARTY_THREAD_KEY:
            kind = "party"
        elif key == TEST_MESSENGER_THREAD_KEY:
            kind = "tester"
        elif _enzo_partner(key, roster):
            # The client sends to a different endpoint for this one.
            kind = "enzo"
        else:
            kind = "direct"
        threads.append({
            "key": key,
            "id": thread_ids[key],
            "threadId": thread_ids[key],
            "kind": kind,
            "label": _thread_label(key, caller),
            "unread": int(stat["unread"] or 0) if stat else 0,
            "muted": key in muted,
            "last": preview,
        })
    return jsonify({
        "ok": True,
        "playerName": caller,
        "playerSeatId": _seat_id(caller),
        "threads": threads,
        "presence": presence,
    })


@bp.route("/api/im/thread/<path:thread_key>", methods=["GET", "POST"])
@limiter.limit("60/hour", methods=["POST"])
def im_thread(thread_key):
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    thread_key, thread_id = _resolve_thread_reference(thread_key)
    if not thread_key:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error

    if request.method == "GET":
        try:
            after = int(request.args.get("after", "0"))
        except ValueError:
            after = 0
        try:
            before = int(request.args.get("before", "0"))
        except ValueError:
            before = 0
        after = max(0, after)
        before = max(0, before)
        # Everything an open thread needs in one request. `since` carries
        # the previous poll's clock back, so an edit or a delete on a
        # message the client already has still reaches it — `after` alone
        # only ever finds new ids.
        since = request.args.get("since") or ""
        now = _utc_now_iso()
        members = _thread_members(thread_key, _im_roster()) or set()
        with _app_db() as conn:
            _touch_presence(conn, caller)
            if before:
                rows = conn.execute("""
                    SELECT * FROM chat_messages
                    WHERE thread_key = ? AND id < ?
                    ORDER BY id DESC
                    LIMIT ?
                """, (thread_key, before, THREAD_PAGE_LIMIT + 1)).fetchall()
                has_older = len(rows) > THREAD_PAGE_LIMIT
                has_newer = False
                rows = list(reversed(rows[:THREAD_PAGE_LIMIT]))
            elif after:
                # Catch up from the first unseen row. DESC used to return the
                # newest 200 and silently strand a gap after a long sleep.
                rows = conn.execute("""
                    SELECT * FROM chat_messages
                    WHERE thread_key = ? AND id > ?
                    ORDER BY id ASC
                    LIMIT ?
                """, (thread_key, after, THREAD_PAGE_LIMIT + 1)).fetchall()
                has_newer = len(rows) > THREAD_PAGE_LIMIT
                rows = rows[:THREAD_PAGE_LIMIT]
                oldest_visible = min(
                    [after, *[row["id"] for row in rows]], default=after
                )
                has_older = bool(conn.execute("""
                    SELECT 1 FROM chat_messages
                    WHERE thread_key = ? AND id < ? LIMIT 1
                """, (thread_key, oldest_visible)).fetchone())
            else:
                rows = conn.execute("""
                    SELECT * FROM chat_messages
                    WHERE thread_key = ?
                    ORDER BY id DESC
                    LIMIT ?
                """, (thread_key, THREAD_PAGE_LIMIT + 1)).fetchall()
                has_older = len(rows) > THREAD_PAGE_LIMIT
                has_newer = False
                rows = list(reversed(rows[:THREAD_PAGE_LIMIT]))
            revised = []
            if since and not before:
                revised = conn.execute("""
                    SELECT * FROM chat_messages
                    WHERE thread_key = ? AND id <= ?
                      AND (edited_at > ? OR deleted_at > ?)
                    ORDER BY id ASC
                    LIMIT ?
                """, (thread_key, after, since, since, THREAD_PAGE_LIMIT)).fetchall()
            reactions = _thread_reactions(conn, thread_key, caller)
            typing = _thread_typing(conn, thread_key, caller)
            receipts = _thread_receipts(conn, thread_key, caller, members)
            presence = _presence_map(conn, members)
            files = _attachments_for_messages(
                conn, [row["id"] for row in rows] + [row["id"] for row in revised]
            )
            quotes = _reply_snapshots(conn, [*rows, *revised])
        return jsonify({
            "ok": True,
            "threadKey": thread_key,
            "threadId": thread_id,
            "messages": [_chat_message_json(
                row, files.get(row["id"]), quotes.get(row["reply_to_id"]),
            )
                         for row in rows],
            "revised": [_chat_message_json(
                row, files.get(row["id"]), quotes.get(row["reply_to_id"]),
            )
                        for row in revised],
            "reactions": reactions,
            "typing": typing,
            "receipts": receipts,
            "presence": presence,
            "hasOlder": has_older,
            "hasNewer": has_newer,
            "oldestId": rows[0]["id"] if rows else None,
            "now": now,
        })

    body = request.get_json(silent=True) or {}
    attachment_ids = _attachment_ids_from(body)
    if attachment_ids is None:
        return jsonify({"error": "attachments must be a list",
                        "error_code": "invalid"}), 400
    text = body.get("body")
    if not isinstance(text, str):
        text = ""
    text = text.strip()
    # A photo with no caption is still a message; nothing at all is not.
    if not text and not attachment_ids:
        return jsonify({"error": "Write the message first", "error_code": "invalid"}), 400
    if len(text.encode("utf-8")) > CHAT_BODY_MAX_BYTES:
        return jsonify({"error": "Message is too long (4KB max)", "error_code": "invalid"}), 400

    reply_to_id = body.get("replyToId") or body.get("reply_to_id")
    try:
        reply_to_id = int(reply_to_id) if reply_to_id is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "replyToId must be a number", "error_code": "invalid"}), 400

    client_message_id = body.get("clientMessageId") or body.get("client_message_id")
    if client_message_id is not None:
        if not isinstance(client_message_id, str) or not CLIENT_MESSAGE_ID.fullmatch(client_message_id):
            return jsonify({
                "error": "clientMessageId must be a UUID",
                "error_code": "invalid",
            }), 400
        client_message_id = client_message_id.lower()

    with _app_db() as conn:
        if client_message_id:
            existing = conn.execute("""
                SELECT * FROM chat_messages
                WHERE thread_key = ? AND sender = ? AND client_message_id = ?
            """, (thread_key, caller, client_message_id)).fetchone()
            if existing:
                return jsonify({
                    "ok": True,
                    "idempotent": True,
                    "message": _complete_chat_message_json(conn, existing),
                }), 200
        if reply_to_id is not None:
            # You can only answer something in this thread — a reply is not
            # a way to quote a conversation you were never in.
            quoted = conn.execute(
                "SELECT thread_key FROM chat_messages WHERE id = ?", (reply_to_id,)
            ).fetchone()
            if not quoted or quoted["thread_key"] != thread_key:
                return jsonify({
                    "error": "That message is not in this thread.",
                    "error_code": "invalid",
                }), 400
        _touch_presence(conn, caller)
        # Sending is the end of composing.
        conn.execute(
            "DELETE FROM chat_typing WHERE thread_key = ? AND player_name = ?",
            (thread_key, caller),
        )
        # Your own message never counts against you as unread.
        try:
            row = _store_chat_message(
                conn, thread_key, caller, text,
                reader=caller,
                reply_to_id=reply_to_id,
                client_message_id=client_message_id,
            )
        except sqlite3.IntegrityError:
            # Two workers can both miss the optimistic lookup, then meet at
            # the unique index. The loser returns the winner's canonical row.
            if not client_message_id:
                raise
            existing = conn.execute("""
                SELECT * FROM chat_messages
                WHERE thread_key = ? AND sender = ? AND client_message_id = ?
            """, (thread_key, caller, client_message_id)).fetchone()
            if not existing:
                raise
            return jsonify({
                "ok": True,
                "idempotent": True,
                "message": _complete_chat_message_json(conn, existing),
            }), 200
        attachments, claim_error = _claim_attachments(
            conn, attachment_ids, caller, thread_key, row["id"]
        )
        if claim_error:
            # Nothing has been handed to anyone yet: drop the message
            # rather than leave a stub whose files never arrived.
            conn.execute("DELETE FROM chat_messages WHERE id = ?", (row["id"],))
            return claim_error
        canonical = _complete_chat_message_json(conn, row, attachments)

    _notify_thread(thread_key, caller, text or _attachment_summary(attachments))
    return jsonify({
        "ok": True, "message": canonical,
    }), 201


def _attachment_summary(attachments):
    """What a push says when the message is only files."""
    if not attachments:
        return ""
    if len(attachments) == 1:
        return "Sent an image" if attachments[0]["kind"] == "image" else "Sent a PDF"
    return f"Sent {len(attachments)} files"


def _unread_total(conn, reader, roster):
    """That reader's unread count across every thread they belong to — the
    number the app-icon badge and the app-bar bubble both show."""
    keys = _caller_thread_keys(reader, roster, conn=conn)
    placeholders = ",".join("?" for _ in keys)
    row = conn.execute(f"""
        SELECT COUNT(*) AS unread
        FROM chat_messages m
        LEFT JOIN chat_reads r
          ON r.thread_key = m.thread_key AND r.player_name = ?
        WHERE m.thread_key IN ({placeholders})
          AND m.sender != ?
          AND m.deleted_at IS NULL
          AND m.id > COALESCE(r.last_read_id, 0)
    """, [reader, *keys, reader]).fetchone()
    return int(row["unread"] or 0)


def _notify_thread(thread_key, sender, text):
    """Queue best-effort push to every eligible subscribed device.

    The payload carries the thread key so the service worker can collapse a
    conversation into one banner, hand an open tab a live badge update, and
    open the overlay in place instead of navigating. Each device's service
    worker decides whether its own visible client makes a system banner noisy;
    a player-wide presence timestamp cannot safely make that decision."""
    if _push_config_error():
        return
    try:
        roster = _im_roster()
        members = _thread_members(thread_key, roster) or set()
        with _app_db() as conn:
            thread = _thread_record(conn, thread_key)
            # The fixture exists specifically to test delivery. It cannot be
            # muted accidentally, and the client hides that control for it.
            muted = set()
            if thread_key != TEST_MESSENGER_THREAD_KEY:
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
            per_recipient = {
                reader: {"unread": _unread_total(conn, reader, roster)}
                for reader in recipients
            }
        title = f"{sender} — The Party" if thread_key == PARTY_THREAD_KEY else sender
        _im_push_executor.submit(
            _fanout_push,
            title,
            text[:200],
            f"/messages/#{thread_key}",
            recipients=recipients,
            payload_extra={
                "threadKey": thread_key,
                "threadId": thread["id"] if thread else None,
                "tag": f"im:{thread_key}",
            },
            per_recipient=per_recipient,
        )
    except Exception:
        logging.exception("IM push for %s failed", thread_key)


def _enzo_history(conn, thread_key, caller, before_id):
    """The stored thread, as the engine's conversation history. This is what
    "Enzo's memory moved server-side" means: the widget used to replay the
    browser's localStorage, so the same question asked on a phone and a
    laptop met two different Enzos."""
    rows = conn.execute("""
        SELECT sender, body FROM chat_messages
        WHERE thread_key = ? AND deleted_at IS NULL AND id < ?
        ORDER BY id DESC
        LIMIT ?
    """, (thread_key, before_id, ENZO_HISTORY_LIMIT)).fetchall()
    history = []
    for row in reversed(rows):
        role = "assistant" if row["sender"] == ENZO_NAME else "user"
        history.append({"role": role, "content": row["body"][:8000]})
    return history


def _enzo_claim(caller):
    """Acquire one cross-worker reply lease for this player."""
    now = _utc_now_iso()
    expires = _utc_now_iso_in(180)
    token = secrets.token_hex(16)
    with _app_db() as conn:
        cursor = conn.execute("""
            INSERT INTO chat_enzo_leases (player_name, lease_token, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT(player_name) DO UPDATE SET
                lease_token = excluded.lease_token,
                expires_at = excluded.expires_at
            WHERE chat_enzo_leases.expires_at <= ?
        """, (caller, token, expires, now))
    return token if cursor.rowcount else None


def _enzo_release(caller, lease_token=None):
    with _app_db() as conn:
        if lease_token:
            conn.execute(
                "DELETE FROM chat_enzo_leases WHERE player_name = ? AND lease_token = ?",
                (caller, lease_token),
            )
        else:
            conn.execute(
                "DELETE FROM chat_enzo_leases WHERE player_name = ?", (caller,)
            )


def _store_chat_message(conn, thread_key, sender, text, reader=None,
                        reply_to_id=None, client_message_id=None):
    """Insert a message and carry the reader's unread pointer past it."""
    now = _utc_now_iso()
    thread = _thread_record(conn, thread_key)
    sender_seat_id = _seat_id(sender)
    if not thread or not sender_seat_id:
        raise RuntimeError("Cannot store a message without stable chat identity")
    cursor = conn.execute("""
        INSERT INTO chat_messages
            (thread_key, thread_id, sender, sender_seat_id, body, created_at,
             updated_at, reply_to_id, client_message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        thread_key, thread["id"], sender, sender_seat_id, text, now, now,
        reply_to_id, client_message_id,
    ))
    message_id = cursor.lastrowid
    if reader:
        conn.execute("""
            INSERT INTO chat_reads
                (thread_key, thread_id, player_name, seat_id, last_read_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                thread_id = excluded.thread_id,
                seat_id = excluded.seat_id,
                last_read_id = MAX(last_read_id, excluded.last_read_id),
                updated_at = excluded.updated_at
        """, (
            thread_key, thread["id"], reader, _seat_id(reader), message_id, now,
        ))
    return conn.execute(
        "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
    ).fetchone()


@bp.route("/api/internal/im-test-message", methods=["POST"])
def im_internal_test_message():
    """Inject one Vesper message from inside the chatbot container.

    nginx refuses this path before proxying it. The source-address check is a
    second boundary so even another container cannot use the route. There is
    intentionally no app credential: the local console reaches it with
    ``ssh vapp -> docker exec -> 127.0.0.1``.
    """
    if request.remote_addr not in {"127.0.0.1", "::1"} \
            or request.headers.get("X-Forwarded-For"):
        return jsonify({"error": "Not found", "error_code": "not_found"}), 404

    body = request.get_json(silent=True) or {}
    text = body.get("body")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Write the message first", "error_code": "invalid"}), 400
    text = text.strip()
    if len(text.encode("utf-8")) > CHAT_BODY_MAX_BYTES:
        return jsonify({"error": "Message is too long (4KB max)", "error_code": "invalid"}), 400

    client_message_id = body.get("clientMessageId")
    if not isinstance(client_message_id, str) or not CLIENT_MESSAGE_ID.fullmatch(client_message_id):
        return jsonify({
            "error": "clientMessageId must be a UUID",
            "error_code": "invalid",
        }), 400
    client_message_id = client_message_id.lower()

    with _app_db() as conn:
        existing = conn.execute("""
            SELECT * FROM chat_messages
            WHERE thread_key = ? AND sender = ? AND client_message_id = ?
        """, (
            TEST_MESSENGER_THREAD_KEY, TEST_MESSENGER_NAME, client_message_id,
        )).fetchone()
        if existing:
            return jsonify({
                "ok": True,
                "idempotent": True,
                "message": _chat_message_json(existing),
            }), 200
        row = _store_chat_message(
            conn,
            TEST_MESSENGER_THREAD_KEY,
            TEST_MESSENGER_NAME,
            text,
            client_message_id=client_message_id,
        )

    _notify_thread(TEST_MESSENGER_THREAD_KEY, TEST_MESSENGER_NAME, text)
    return jsonify({"ok": True, "message": _chat_message_json(row)}), 201


def _sse(name, payload):
    return f"event: {name}\ndata: " + json.dumps(payload) + "\n\n"


@bp.route("/api/im/thread/<path:thread_key>/enzo", methods=["POST"])
@limiter.limit(lambda: CHAT_RATE_LIMIT)
def im_thread_enzo(thread_key):
    """Send to Enzo and stream his answer back over SSE.

    Both entry points — the floating pill and the thread in the chat panel —
    come through here, so there is one conversation and one store rather
    than two that drift apart."""
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    thread_key, thread_id = _resolve_thread_reference(thread_key)
    if not thread_key:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    if not _enzo_partner(thread_key, _im_roster()):
        return jsonify({
            "error": "Enzo is not in this thread.",
            "error_code": "not_found",
        }), 404

    body = request.get_json(silent=True) or {}
    text = body.get("body")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Write the message first", "error_code": "invalid"}), 400
    text = text.strip()
    if len(text.encode("utf-8")) > CHAT_BODY_MAX_BYTES:
        return jsonify({"error": "Message is too long (4KB max)", "error_code": "invalid"}), 400

    rules = bool(body.get("rules"))
    vibe = body.get("vibe") if isinstance(body.get("vibe"), str) else None
    # Enzo in a thread answers the person in the thread, with the same role
    # the rest of the app gives them. Same shape as _chat_viewer().
    viewer = {"name": caller, "is_dm": _request_is_dm(), "preview": bool(_preview_actor())}
    attachment_ids = _attachment_ids_from(body)
    if attachment_ids is None:
        return jsonify({"error": "attachments must be a list",
                        "error_code": "invalid"}), 400

    client_message_id = body.get("clientMessageId") or body.get("client_message_id")
    if client_message_id is not None:
        if (not isinstance(client_message_id, str)
                or not CLIENT_MESSAGE_ID.fullmatch(client_message_id)):
            return jsonify({
                "error": "clientMessageId must be a UUID",
                "error_code": "invalid",
            }), 400
        client_message_id = client_message_id.lower()

    # A completed replay needs neither a lease nor another model call.
    if client_message_id:
        with _app_db() as conn:
            existing = conn.execute("""
                SELECT * FROM chat_messages
                WHERE thread_key = ? AND sender = ? AND client_message_id = ?
            """, (thread_key, caller, client_message_id)).fetchone()
            completed = None
            existing_files = {}
            if existing:
                existing_files = _attachments_for_messages(conn, [existing["id"]])
                completed = conn.execute("""
                    SELECT * FROM chat_messages
                    WHERE thread_key = ? AND sender = ? AND reply_to_id = ?
                      AND deleted_at IS NULL
                    ORDER BY id ASC LIMIT 1
                """, (thread_key, ENZO_NAME, existing["id"])).fetchone()
        if existing and completed:
            def replay_stream():
                yield _sse("sent", {"message": _chat_message_json(
                    existing, existing_files.get(existing["id"])
                )})
                yield _sse("message", {"message": _chat_message_json(completed)})
                yield _sse("done", {"idempotent": True})

            return Response(
                stream_with_context(replay_stream()),
                mimetype="text/event-stream",
                headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
            )

    lease_token = _enzo_claim(caller)
    if not lease_token:
        return jsonify({
            "error": "Enzo is still answering your last message.",
            "error_code": "busy",
        }), 429

    claim_failure = None
    history = None
    try:
        with _app_db() as conn:
            sent = None
            if client_message_id:
                sent = conn.execute("""
                    SELECT * FROM chat_messages
                    WHERE thread_key = ? AND sender = ? AND client_message_id = ?
                """, (thread_key, caller, client_message_id)).fetchone()
            if sent:
                files = _attachments_for_messages(conn, [sent["id"]])
                attachments = files.get(sent["id"], [])
            else:
                sent = _store_chat_message(
                    conn, thread_key, caller, text, reader=caller,
                    client_message_id=client_message_id,
                )
                # Kept on the message so the thread reads back whole; not
                # forwarded to the model, which is text-only here.
                attachments, claim_error = _claim_attachments(
                    conn, attachment_ids, caller, thread_key, sent["id"]
                )
                if claim_error:
                    conn.execute("DELETE FROM chat_messages WHERE id = ?", (sent["id"],))
                    claim_failure = claim_error
                else:
                    history = _enzo_history(conn, thread_key, caller, sent["id"])
            if sent and not claim_failure and history is None:
                history = _enzo_history(conn, thread_key, caller, sent["id"])
    except Exception:
        _enzo_release(caller, lease_token)
        raise
    if claim_failure:
        _enzo_release(caller, lease_token)
        return claim_failure

    sent_json = _chat_message_json(sent, attachments)
    write_log("user", text)

    def event_stream():
        chunks = []
        citations = []
        new_rules, new_vibe = rules, vibe
        try:
            yield _sse("sent", {"message": sent_json})
            for event in engine.chat_stream(text, history, rules, vibe, viewer=viewer):
                etype = event.get("type")
                if etype == "token":
                    chunks.append(event.get("text", ""))
                    yield _sse("token", {"text": event.get("text", "")})
                elif etype == "meta":
                    citations = event.get("citations") or []
                    new_rules = event.get("rules")
                    new_vibe = event.get("vibe")
                    yield _sse("meta", {
                        "citations": citations,
                        "rules": new_rules,
                        "vibe": new_vibe,
                    })
                elif etype == "error":
                    yield _sse("error", {"message": event.get("text", "")})
            reply = "".join(chunks).strip()
            if reply:
                write_log("assistant", reply)
                with _app_db() as conn:
                    stored = _store_chat_message(
                        conn, thread_key, ENZO_NAME, reply, reply_to_id=sent["id"]
                    )
                yield _sse("message", {"message": _chat_message_json(stored)})
                # He answered while you were reading something else.
                _notify_thread(thread_key, ENZO_NAME, reply)
            yield _sse("done", {})
        except Exception as exc:
            logging.exception("Enzo thread stream failed for %s", thread_key)
            yield _sse("error", {"message": str(exc)})
        finally:
            _enzo_release(caller, lease_token)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            # nginx buffers SSE into uselessness without this.
            "X-Accel-Buffering": "no",
        },
    )


@bp.route("/api/im/read", methods=["POST"])
def im_read():
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    reference = body.get("threadId") or body.get("thread_id") \
        or body.get("threadKey") or body.get("thread_key") or ""
    thread_key, thread_id = _resolve_thread_reference(reference)
    if not thread_key:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    try:
        requested_id = int(body.get("lastReadId") or body.get("last_read_id") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "lastReadId must be a number", "error_code": "invalid"}), 400
    with _app_db() as conn:
        # IDs are global to chat_messages. A caller may only advance to an ID
        # that exists in this thread, never to a different thread or the
        # future. The nearest preceding message is the truthful pointer.
        row = conn.execute("""
            SELECT COALESCE(MAX(id), 0) AS last_read_id
            FROM chat_messages
            WHERE thread_key = ? AND id <= ?
        """, (thread_key, max(0, requested_id))).fetchone()
        last_read_id = int(row["last_read_id"] or 0)
        conn.execute("""
            INSERT INTO chat_reads
                (thread_key, thread_id, player_name, seat_id, last_read_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                thread_id = excluded.thread_id,
                seat_id = excluded.seat_id,
                last_read_id = MAX(last_read_id, excluded.last_read_id),
                updated_at = excluded.updated_at
        """, (
            thread_key, thread_id, caller, _seat_id(caller), last_read_id,
            _utc_now_iso(),
        ))
    return jsonify({
        "ok": True, "threadId": thread_id, "lastReadId": last_read_id,
    })


@bp.route("/api/im/mute", methods=["POST"])
def im_mute():
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    reference = body.get("threadId") or body.get("thread_id") \
        or body.get("threadKey") or body.get("thread_key") or ""
    thread_key, thread_id = _resolve_thread_reference(reference)
    if not thread_key:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    muted = 1 if body.get("muted") else 0
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO chat_reads
                (thread_key, thread_id, player_name, seat_id, muted, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                thread_id = excluded.thread_id,
                seat_id = excluded.seat_id,
                muted = excluded.muted,
                updated_at = excluded.updated_at
        """, (
            thread_key, thread_id, caller, _seat_id(caller), muted, _utc_now_iso(),
        ))
    return jsonify({"ok": True, "threadId": thread_id, "muted": bool(muted)})


@bp.route("/api/im/typing", methods=["POST"])
def im_typing():
    """A heartbeat while composing. Rows are disposable and expire on their
    own; there is no "stopped typing" call to miss."""
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    reference = body.get("threadId") or body.get("thread_id") \
        or body.get("threadKey") or body.get("thread_key") or ""
    thread_key, thread_id = _resolve_thread_reference(reference)
    if not thread_key:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    typing = body.get("typing", True)
    with _app_db() as conn:
        _touch_presence(conn, caller)
        if typing:
            expires = _utc_now_iso_in(TYPING_TTL_SECONDS)
            conn.execute("""
                INSERT INTO chat_typing
                    (thread_key, thread_id, player_name, seat_id, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(thread_key, player_name) DO UPDATE SET
                    thread_id = excluded.thread_id,
                    seat_id = excluded.seat_id,
                    expires_at = excluded.expires_at
            """, (thread_key, thread_id, caller, _seat_id(caller), expires))
        else:
            conn.execute(
                "DELETE FROM chat_typing WHERE thread_key = ? AND player_name = ?",
                (thread_key, caller),
            )
    return jsonify({
        "ok": True, "threadId": thread_id, "typing": bool(typing),
    })


@bp.route("/api/im/message/<int:message_id>/reaction", methods=["POST", "DELETE"])
def im_message_reaction(message_id):
    """Add or take back one face. Members of the thread only, and only from
    the six the bar offers."""
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    emoji = body.get("emoji")
    if emoji not in REACTION_EMOJI:
        return jsonify({"error": "Unknown reaction", "error_code": "invalid"}), 400

    with _app_db() as conn:
        row, error = _message_for_caller(conn, message_id, caller)
        if error:
            return error
        if row["deleted_at"]:
            return jsonify({
                "error": "That message is gone.",
                "error_code": "not_found",
            }), 404
        _touch_presence(conn, caller)
        if request.method == "POST":
            conn.execute("""
                INSERT OR IGNORE INTO chat_reactions
                    (message_id, player_name, seat_id, emoji, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                message_id, caller, _seat_id(caller), emoji, _utc_now_iso(),
            ))
        else:
            conn.execute("""
                DELETE FROM chat_reactions
                WHERE message_id = ? AND player_name = ? AND emoji = ?
            """, (message_id, caller, emoji))
        reactions = _thread_reactions(conn, row["thread_key"], caller)

    return jsonify({
        "ok": True,
        "id": message_id,
        "threadId": row["thread_id"],
        "reactions": reactions.get(str(message_id), []),
    })


@bp.route("/api/im/message/<int:message_id>", methods=["PATCH"])
def im_edit_message(message_id):
    """Rewrite your own message, for an hour. After that it stands as sent —
    and either way the row keeps edited_at, so it is never a quiet swap."""
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    text = body.get("body")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Write the message first", "error_code": "invalid"}), 400
    text = text.strip()
    if len(text.encode("utf-8")) > CHAT_BODY_MAX_BYTES:
        return jsonify({"error": "Message is too long (4KB max)", "error_code": "invalid"}), 400

    with _app_db() as conn:
        row, error = _message_for_caller(conn, message_id, caller)
        if error:
            return error
        if row["deleted_at"]:
            return jsonify({"error": "That message is gone.", "error_code": "not_found"}), 404
        if row["sender"] != caller:
            return jsonify({
                "error": "Only the sender can edit a message.",
                "error_code": "forbidden",
            }), 403
        if _iso_age_seconds(row["created_at"]) > MESSAGE_EDIT_WINDOW_SECONDS:
            return jsonify({
                "error": "That message is older than an hour — it stands as sent.",
                "error_code": "too_late",
            }), 409
        now = _utc_now_iso()
        conn.execute(
            "UPDATE chat_messages "
            "SET body = ?, edited_at = ?, updated_at = ? WHERE id = ?",
            (text, now, now, message_id),
        )
        _touch_presence(conn, caller)
        updated = conn.execute(
            "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
        ).fetchone()

        canonical = _complete_chat_message_json(conn, updated)

    return jsonify({
        "ok": True,
        "message": canonical,
    })


@bp.route("/api/im/message/<int:message_id>", methods=["DELETE"])
def im_delete_message(message_id):
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    with _app_db() as conn:
        row, error = _message_for_caller(conn, message_id, caller)
        if error:
            return error
        if row["deleted_at"]:
            return jsonify({"error": "Message not found", "error_code": "not_found"}), 404
        if row["sender"] != caller:
            return jsonify({
                "error": "Only the sender can delete a message.",
                "error_code": "forbidden",
            }), 403
        now = _utc_now_iso()
        conn.execute(
            "UPDATE chat_messages SET deleted_at = ?, updated_at = ? WHERE id = ?",
            (now, now, message_id),
        )
        deleted = conn.execute(
            "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
        ).fetchone()
        canonical = _complete_chat_message_json(conn, deleted)
    return jsonify({
        "ok": True,
        "id": message_id,
        "threadId": row["thread_id"],
        "deleted": True,
        "message": canonical,
    })


__all__ = ['CHAT_BODY_MAX_BYTES', 'PARTY_THREAD_KEY', 'THREAD_PAGE_LIMIT',
           'ENZO_NAME', 'ENZO_HISTORY_LIMIT',
           'TEST_MESSENGER_NAME', 'TEST_MESSENGER_THREAD_KEY',
           'CLIENT_MESSAGE_ID',
           'MESSAGE_EDIT_WINDOW_SECONDS', 'TYPING_TTL_SECONDS', 'REACTION_EMOJI',
           'PRESENT_WITHIN_SECONDS',
           '_utc_now_iso_in', '_iso_age_seconds',
           '_im_roster', '_direct_thread_key', '_enzo_thread_key', '_enzo_partner',
           '_seat_id', '_thread_record', '_resolve_thread_reference',
           '_thread_members', '_im_caller', '_thread_access_error', '_chat_message_json',
           '_touch_presence', '_thread_reactions', '_thread_typing', '_thread_receipts',
           '_presence_map', '_present_since', '_message_for_caller',
           '_caller_thread_keys', '_thread_label', 'im_threads', 'im_thread', '_unread_total',
           '_enzo_history', '_enzo_claim', '_enzo_release', '_store_chat_message', '_sse',
           'im_internal_test_message',
           'im_thread_enzo', '_attachment_summary', '_notify_thread', 'im_read', 'im_mute', 'im_typing',
           'im_message_reaction', 'im_edit_message', 'im_delete_message']
