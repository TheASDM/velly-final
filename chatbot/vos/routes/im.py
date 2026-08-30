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
from ..web import limiter

bp = Blueprint("im", __name__)

CHAT_BODY_MAX_BYTES = 4096
PARTY_THREAD_KEY = "party"
THREAD_PAGE_LIMIT = 200
# Not a roster seat — adding him to _data/players.json would break the auth
# maps and the records that key off it. He exists only as a thread partner.
ENZO_NAME = "Enzo"
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

# One reply in flight per player. Per-process, like the rate limiter's
# memory:// storage — with more than one worker a determined double-tap can
# still slip through, and CHAT_RATE_LIMIT is what actually bounds the spend.
_enzo_in_flight = set()
_enzo_lock = threading.Lock()


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


def _thread_members(thread_key, roster):
    """The members of a thread key, or None when the key names no valid
    thread (unknown player, unsorted pair, self-pair).

    An Enzo thread has exactly one human member: the person he is talking
    to. Enzo himself is not a caller and never reads anything."""
    if thread_key == PARTY_THREAD_KEY:
        return set(roster)
    partner = _enzo_partner(thread_key, roster)
    if partner:
        return {partner}
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
        "replyToId": row["reply_to_id"],
        # Stated, not hidden: an edited message is marked for everyone.
        "editedAt": None if deleted else row["edited_at"],
    }


def _touch_presence(conn, player_name):
    """Last seen, per player rather than per thread. Touched by the polls
    the client already makes, so presence costs no extra request."""
    conn.execute("""
        INSERT INTO player_presence (player_name, last_seen_at)
        VALUES (?, ?)
        ON CONFLICT(player_name) DO UPDATE SET last_seen_at = excluded.last_seen_at
    """, (player_name, _utc_now_iso()))


def _thread_reactions(conn, thread_key, caller):
    """Reactions for the whole thread, keyed by message id as a string so
    the payload survives JSON. Counts render under the bubble; `mine` is
    what lets a second tap take it back."""
    rows = conn.execute("""
        SELECT r.message_id, r.emoji, r.player_name
        FROM chat_reactions r
        JOIN chat_messages m ON m.id = r.message_id
        WHERE m.thread_key = ?
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
    members = _thread_members(row["thread_key"], _im_roster())
    if not members or caller not in members:
        # Same shape as a missing message: whether a message exists in a
        # thread you cannot read is not yours to learn.
        return None, (jsonify({"error": "Message not found", "error_code": "not_found"}), 404)
    return row, None


def _caller_thread_keys(caller, roster):
    """The threads this caller belongs to, in display order: DM pinned
    first for players, then the other players, then the party channel."""
    keys = []
    if caller != "DM":
        keys.append(_direct_thread_key(caller, "DM"))
    keys.append(_enzo_thread_key(caller))
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
        elif _enzo_partner(key, roster):
            # The client sends to a different endpoint for this one.
            kind = "enzo"
        else:
            kind = "direct"
        threads.append({
            "key": key,
            "kind": kind,
            "label": _thread_label(key, caller),
            "unread": int(stat["unread"] or 0) if stat else 0,
            "muted": key in muted,
            "last": preview,
        })
    return jsonify({
        "ok": True, "playerName": caller, "threads": threads, "presence": presence,
    })


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
        # Everything an open thread needs in one request. `since` carries
        # the previous poll's clock back, so an edit or a delete on a
        # message the client already has still reaches it — `after` alone
        # only ever finds new ids.
        since = request.args.get("since") or ""
        now = _utc_now_iso()
        members = _thread_members(thread_key, _im_roster()) or set()
        with _app_db() as conn:
            _touch_presence(conn, caller)
            rows = conn.execute("""
                SELECT * FROM chat_messages
                WHERE thread_key = ? AND id > ?
                ORDER BY id DESC
                LIMIT ?
            """, (thread_key, after, THREAD_PAGE_LIMIT)).fetchall()
            revised = []
            if since:
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
        return jsonify({
            "ok": True,
            "threadKey": thread_key,
            "messages": [_chat_message_json(row) for row in reversed(rows)],
            "revised": [_chat_message_json(row) for row in revised],
            "reactions": reactions,
            "typing": typing,
            "receipts": receipts,
            "presence": presence,
            "now": now,
        })

    body = request.get_json(silent=True) or {}
    text = body.get("body")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Write the message first", "error_code": "invalid"}), 400
    text = text.strip()
    if len(text.encode("utf-8")) > CHAT_BODY_MAX_BYTES:
        return jsonify({"error": "Message is too long (4KB max)", "error_code": "invalid"}), 400

    reply_to_id = body.get("replyToId") or body.get("reply_to_id")
    try:
        reply_to_id = int(reply_to_id) if reply_to_id is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "replyToId must be a number", "error_code": "invalid"}), 400

    with _app_db() as conn:
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
        row = _store_chat_message(conn, thread_key, caller, text,
                                  reader=caller, reply_to_id=reply_to_id)

    _notify_thread(thread_key, caller, text)
    return jsonify({"ok": True, "message": _chat_message_json(row)}), 201


def _unread_total(conn, reader, roster):
    """That reader's unread count across every thread they belong to — the
    number the app-icon badge and the app-bar bubble both show."""
    keys = _caller_thread_keys(reader, roster)
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
    """Best-effort push to the other members' backgrounded devices,
    skipping anyone who muted the thread. Never blocks the send.

    The payload carries the thread key so the service worker can collapse a
    conversation into one banner, hand an open tab a live badge update, and
    open the overlay in place instead of navigating."""
    if _push_config_error():
        return
    try:
        roster = _im_roster()
        members = _thread_members(thread_key, roster) or set()
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
            per_recipient = {
                reader: {"unread": _unread_total(conn, reader, roster)}
                for reader in recipients
            }
        title = f"{sender} — The Party" if thread_key == PARTY_THREAD_KEY else sender
        _fanout_push(
            title,
            text[:200],
            f"/messages/#{thread_key}",
            recipients=recipients,
            payload_extra={"threadKey": thread_key, "tag": f"im:{thread_key}"},
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
    """One reply in flight per player. Entries carry a deadline so a client
    that drops the stream mid-generation cannot wedge the thread shut."""
    now = time.monotonic()
    with _enzo_lock:
        _enzo_in_flight.difference_update(
            {entry for entry in _enzo_in_flight if entry[1] < now}
        )
        if any(entry[0] == caller for entry in _enzo_in_flight):
            return False
        _enzo_in_flight.add((caller, now + 180))
    return True


def _enzo_release(caller):
    with _enzo_lock:
        _enzo_in_flight.difference_update(
            {entry for entry in _enzo_in_flight if entry[0] == caller}
        )


def _store_chat_message(conn, thread_key, sender, text, reader=None, reply_to_id=None):
    """Insert a message and carry the reader's unread pointer past it."""
    now = _utc_now_iso()
    cursor = conn.execute("""
        INSERT INTO chat_messages (thread_key, sender, body, created_at, reply_to_id)
        VALUES (?, ?, ?, ?, ?)
    """, (thread_key, sender, text, now, reply_to_id))
    message_id = cursor.lastrowid
    if reader:
        conn.execute("""
            INSERT INTO chat_reads (thread_key, player_name, last_read_id, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(thread_key, player_name) DO UPDATE SET
                last_read_id = MAX(last_read_id, excluded.last_read_id),
                updated_at = excluded.updated_at
        """, (thread_key, reader, message_id, now))
    return conn.execute(
        "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
    ).fetchone()


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

    if not _enzo_claim(caller):
        return jsonify({
            "error": "Enzo is still answering your last message.",
            "error_code": "busy",
        }), 429

    try:
        with _app_db() as conn:
            sent = _store_chat_message(conn, thread_key, caller, text, reader=caller)
            history = _enzo_history(conn, thread_key, caller, sent["id"])
    except Exception:
        _enzo_release(caller)
        raise

    sent_json = _chat_message_json(sent)
    write_log("user", text)

    def event_stream():
        chunks = []
        citations = []
        new_rules, new_vibe = rules, vibe
        try:
            yield _sse("sent", {"message": sent_json})
            for event in engine.chat_stream(text, history, rules, vibe):
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
                    stored = _store_chat_message(conn, thread_key, ENZO_NAME, reply)
                yield _sse("message", {"message": _chat_message_json(stored)})
                # He answered while you were reading something else.
                _notify_thread(thread_key, ENZO_NAME, reply)
            yield _sse("done", {})
        except Exception as exc:
            logging.exception("Enzo thread stream failed for %s", thread_key)
            yield _sse("error", {"message": str(exc)})
        finally:
            _enzo_release(caller)

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


@bp.route("/api/im/typing", methods=["POST"])
def im_typing():
    """A heartbeat while composing. Rows are disposable and expire on their
    own; there is no "stopped typing" call to miss."""
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    thread_key = str(body.get("threadKey") or body.get("thread_key") or "")
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error
    typing = body.get("typing", True)
    with _app_db() as conn:
        _touch_presence(conn, caller)
        if typing:
            expires = _utc_now_iso_in(TYPING_TTL_SECONDS)
            conn.execute("""
                INSERT INTO chat_typing (thread_key, player_name, expires_at)
                VALUES (?, ?, ?)
                ON CONFLICT(thread_key, player_name) DO UPDATE SET
                    expires_at = excluded.expires_at
            """, (thread_key, caller, expires))
        else:
            conn.execute(
                "DELETE FROM chat_typing WHERE thread_key = ? AND player_name = ?",
                (thread_key, caller),
            )
    return jsonify({"ok": True, "typing": bool(typing)})


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
                    (message_id, player_name, emoji, created_at)
                VALUES (?, ?, ?, ?)
            """, (message_id, caller, emoji, _utc_now_iso()))
        else:
            conn.execute("""
                DELETE FROM chat_reactions
                WHERE message_id = ? AND player_name = ? AND emoji = ?
            """, (message_id, caller, emoji))
        reactions = _thread_reactions(conn, row["thread_key"], caller)

    return jsonify({
        "ok": True,
        "id": message_id,
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
            "UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?",
            (text, now, message_id),
        )
        _touch_presence(conn, caller)
        updated = conn.execute(
            "SELECT * FROM chat_messages WHERE id = ?", (message_id,)
        ).fetchone()

    return jsonify({"ok": True, "message": _chat_message_json(updated)})


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
        conn.execute(
            "UPDATE chat_messages SET deleted_at = ? WHERE id = ?",
            (_utc_now_iso(), message_id),
        )
    return jsonify({"ok": True, "id": message_id, "deleted": True})


__all__ = ['CHAT_BODY_MAX_BYTES', 'PARTY_THREAD_KEY', 'ENZO_NAME', 'ENZO_HISTORY_LIMIT',
           'MESSAGE_EDIT_WINDOW_SECONDS', 'TYPING_TTL_SECONDS', 'REACTION_EMOJI',
           '_utc_now_iso_in', '_iso_age_seconds',
           '_im_roster', '_direct_thread_key', '_enzo_thread_key', '_enzo_partner',
           '_thread_members', '_im_caller', '_thread_access_error', '_chat_message_json',
           '_touch_presence', '_thread_reactions', '_thread_typing', '_thread_receipts',
           '_presence_map', '_message_for_caller',
           '_caller_thread_keys', '_thread_label', 'im_threads', 'im_thread', '_unread_total',
           '_enzo_history', '_enzo_claim', '_enzo_release', '_store_chat_message', '_sse',
           'im_thread_enzo', '_notify_thread', 'im_read', 'im_mute', 'im_typing',
           'im_message_reaction', 'im_edit_message', 'im_delete_message']
