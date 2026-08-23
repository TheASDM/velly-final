from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("push", __name__)

@bp.route("/api/push/config", methods=["GET"])
def push_config():
    return jsonify({
        "publicKey": VAPID_PUBLIC_KEY,
        "pushConfigured": bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and send_webpush),
    })


@bp.route("/api/push/subscribe", methods=["POST"])
def push_subscribe():
    if send_webpush is None or not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        return jsonify({"error": "Push is not configured on this server"}), 503

    body = request.get_json(silent=True) or {}
    name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    subscription = body.get("subscription") or {}
    keys = subscription.get("keys") or {}

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Missing player name"}), 400
    name = name.strip()[:64]

    endpoint = subscription.get("endpoint", "")
    p256dh = keys.get("p256dh", "")
    auth = keys.get("auth", "")
    if not all(isinstance(v, str) and v for v in (endpoint, p256dh, auth)):
        return jsonify({"error": "Invalid push subscription"}), 400

    with _app_db() as conn:
        conn.execute("""
            INSERT INTO subscriptions (player_name, endpoint, p256dh, auth, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
                player_name = excluded.player_name,
                p256dh = excluded.p256dh,
                auth = excluded.auth
        """, (name, endpoint, p256dh, auth, _utc_now_iso()))

    return jsonify({"ok": True})


def _subscription_info(row):
    return {
        "endpoint": row["endpoint"],
        "keys": {
            "p256dh": row["p256dh"],
            "auth": row["auth"],
        },
    }


def _push_config_error():
    if send_webpush is None:
        return "pywebpush is not installed on this server"
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        return "VAPID keys are not configured on this server"
    return None


def _app_url(value):
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//"):
        return "/"
    return value[:300]


def _parse_recipients(body, field="recipients"):
    raw = body.get(field, None)
    if raw is None or raw == "all":
        return None, None
    if not isinstance(raw, list):
        return None, (jsonify({"error": "Recipients must be a list"}), 400)

    recipients = []
    seen = set()
    for value in raw:
        if not isinstance(value, str):
            continue
        name = value.strip()
        if not name or name in seen:
            continue
        seen.add(name)
        recipients.append(name)

    if not recipients:
        return None, (jsonify({"error": "Choose at least one recipient"}), 400)

    valid = set(PLAYER_NAMES)
    invalid = [name for name in recipients if name not in valid]
    if invalid:
        return None, (jsonify({"error": f"Unknown recipient: {', '.join(invalid[:3])}"}), 400)

    return recipients, None


def _delivery_summary(conn, message_id):
    rows = conn.execute("""
        SELECT status, COUNT(*) AS count
        FROM push_deliveries
        WHERE message_id = ?
        GROUP BY status
    """, (message_id,))
    summary = {"sent": 0, "failed": 0, "pruned": 0}
    for row in rows:
        if row["status"] in summary:
            summary[row["status"]] = row["count"]
    summary["attempted"] = summary["sent"] + summary["failed"] + summary["pruned"]
    return summary


def _message_recipients(conn, message_id):
    return [
        row["player_name"]
        for row in conn.execute("""
            SELECT player_name
            FROM message_recipients
            WHERE message_id = ?
            ORDER BY player_name COLLATE NOCASE
        """, (message_id,))
    ]


def _markdown_to_push_text(value):
    text = str(value or "")
    text = re.sub(r"```[^\n]*\n?(.*?)```", lambda match: match.group(1), text, flags=re.S)
    text = re.sub(r"\[([^\]\n]{1,180})\]\(([^)\n]{1,500})\)", r"\1", text)
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
    text = re.sub(r"(?m)^\s*>\s?", "", text)
    text = re.sub(r"(?m)^---+$", "", text)
    text = re.sub(r"(?m)^\s*[-*+]\s+", "- ", text)
    text = re.sub(r"(?m)^\s*\d+[.)]\s+", "- ", text)
    text = re.sub(r"`([^`\n]+)`", r"\1", text)
    for pattern in (
        r"\*\*([^*\n]+)\*\*",
        r"__([^_\n]+)__",
        r"\*([^*\n]+)\*",
        r"_([^_\n]+)_",
    ):
        text = re.sub(pattern, r"\1", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:500] or "DM message"


def _fanout_push(conn, title, message, url, recipients=None, message_id=None):
    base_payload = {
        "title": title.strip()[:120],
        "body": message.strip()[:500],
        "url": _app_url(url),
        "messageId": message_id,
    }

    sent = 0
    failed = 0
    pruned = 0
    errors = []

    if recipients:
        placeholders = ",".join("?" for _ in recipients)
        rows = list(conn.execute("""
            SELECT id, player_name, endpoint, p256dh, auth
            FROM subscriptions
            WHERE player_name IN ({})
            ORDER BY player_name COLLATE NOCASE, created_at ASC
        """.format(placeholders), recipients))
    else:
        rows = list(conn.execute("""
            SELECT id, player_name, endpoint, p256dh, auth
            FROM subscriptions
            ORDER BY player_name COLLATE NOCASE, created_at ASC
        """))

    for row in rows:
        try:
            # Per-recipient payload so the tap beacon can say who tapped.
            payload = json.dumps({**base_payload, "playerName": row["player_name"]})
            send_webpush(
                subscription_info=_subscription_info(row),
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=86400,
                timeout=15,
            )
            sent += 1
            conn.execute("""
                INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at)
                VALUES (?, ?, ?, 'sent', NULL, ?)
            """, (message_id, row["player_name"], row["endpoint"], _utc_now_iso()))
        except WebPushException as exc:
            failed += 1
            response = getattr(exc, "response", None)
            status_code = getattr(response, "status_code", None)
            if status_code in (404, 410):
                conn.execute("DELETE FROM subscriptions WHERE id = ?", (row["id"],))
                pruned += 1
                status = "pruned"
            else:
                status = "failed"
            error_text = str(exc)[:200]
            conn.execute("""
                INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (message_id, row["player_name"], row["endpoint"], status, error_text, _utc_now_iso()))
            errors.append({
                "player_name": row["player_name"],
                "status": status_code,
                "error": error_text,
            })
        except Exception as exc:
            failed += 1
            error_text = str(exc)[:200]
            conn.execute("""
                INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at)
                VALUES (?, ?, ?, 'failed', ?, ?)
            """, (message_id, row["player_name"], row["endpoint"], error_text, _utc_now_iso()))
            errors.append({
                "player_name": row["player_name"],
                "status": None,
                "error": error_text,
            })

    return {
        "ok": True,
        "attempted": len(rows),
        "sent": sent,
        "failed": failed,
        "pruned": pruned,
        "recipients": recipients or "all",
        "errors": errors[:10],
    }


@bp.route("/api/push/opened", methods=["POST"])
def push_opened():
    """Beacon from the service worker when a player taps a notification.
    Auth rides on the httponly cookie (same-origin SW fetch sends it);
    when login is off, the payload's name is trusted like everywhere else."""
    body = request.get_json(silent=True) or {}
    try:
        message_id = int(body.get("messageId"))
    except (TypeError, ValueError):
        return jsonify({"error": "Missing messageId"}), 400
    player_name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    if not player_name or player_name not in PLAYER_NAMES:
        return jsonify({"error": "Unknown player"}), 400
    with _app_db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO push_opens (message_id, player_name, opened_at)
            VALUES (?, ?, ?)
        """, (message_id, player_name, _utc_now_iso()))
    return jsonify({"ok": True})


@bp.route("/api/push/subscribers", methods=["GET"])
def push_subscribers():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT player_name, COUNT(*) AS devices, MAX(created_at) AS latest
            FROM subscriptions
            GROUP BY player_name
            ORDER BY player_name COLLATE NOCASE
        """))
    subscribed_names = {row["player_name"] for row in rows}
    return jsonify({
        "subscribed": [
            {
                "player": row["player_name"],
                "devices": row["devices"],
                "latest": row["latest"],
            }
            for row in rows
        ],
        "missing": [
            name for name in PLAYER_NAMES
            if name != "DM" and name not in subscribed_names
        ],
    })


@bp.route("/api/push/send", methods=["POST"])
def push_send():
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
        return jsonify({"error": "Missing notification title"}), 400
    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Missing notification body"}), 400

    with _app_db() as conn:
        result = _fanout_push(conn, title, message, url, recipients=recipients)

    return jsonify(result)

__all__ = ['push_config', 'push_subscribe', '_subscription_info', '_push_config_error', '_app_url', '_parse_recipients', '_delivery_summary', '_message_recipients', '_markdown_to_push_text', '_fanout_push', 'push_opened', 'push_subscribers', 'push_send']
