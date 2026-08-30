"""Syrinscape from the DM console.

The app never carries audio — it tells the DM's Syrinscape player what to do
through their remote-control API, and the sound comes out of whatever device
runs that player. This module is a thin, DM-gated proxy whose one real job is
keeping the auth token server-side.

The library listing is cached: seventeen hundred soundsets change rarely, and
browsing should not cost a round trip to Syrinscape per keystroke.
"""
from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("sounds", __name__)

SYRINSCAPE_BASE = "https://syrinscape.com/online/frontend-api"
LIBRARY_TTL_SECONDS = 6 * 3600
SOUNDSET_TTL_SECONDS = 3600

_cache = {}


def _cached(key, ttl, fetch):
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]
    value = fetch()
    _cache[key] = (now, value)
    return value


def _configured_error():
    if not SYRINSCAPE_AUTH_TOKEN:
        return jsonify({
            "error": "Syrinscape is not configured — set SYRINSCAPE_AUTH_TOKEN.",
            "error_code": "not_configured",
        }), 503
    return None


def _syrinscape_get(path):
    response = http_requests.get(
        f"{SYRINSCAPE_BASE}{path}",
        params={"auth_token": SYRINSCAPE_AUTH_TOKEN},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


@bp.get("/api/sounds/soundsets")
def api_soundsets():
    """The whole library, trimmed to what a browser needs."""
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    conf_error = _configured_error()
    if conf_error:
        return conf_error

    def fetch():
        rows = _syrinscape_get("/soundsets/")
        return sorted(
            ({
                "uuid": row.get("uuid"),
                "name": row.get("name") or "",
                "full_name": row.get("full_name") or row.get("name") or "",
                "category": row.get("category") or "",
            } for row in rows),
            key=lambda row: row["full_name"].lower(),
        )

    try:
        if request.args.get("refresh"):
            _cache.pop("soundsets", None)
        return jsonify({"ok": True, "soundsets": _cached("soundsets", LIBRARY_TTL_SECONDS, fetch)})
    except http_requests.RequestException as exc:
        return jsonify({"error": f"Syrinscape did not answer: {exc}"}), 502


@bp.get("/api/sounds/soundsets/<uuid>")
def api_soundset(uuid):
    """One soundset's moods and one-shots — everything tappable in it."""
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    conf_error = _configured_error()
    if conf_error:
        return conf_error
    if not re.fullmatch(r"[0-9a-f-]{36}", uuid):
        return jsonify({"error": "Bad soundset id"}), 400

    def fetch():
        moods = _syrinscape_get(f"/moods/?soundset__uuid={uuid}")
        elements = _syrinscape_get(f"/elements/?soundset__uuid={uuid}")
        return {
            "moods": [{"pk": m.get("pk"), "name": m.get("name") or ""} for m in moods],
            "oneshots": [
                {"pk": e.get("pk"), "name": e.get("name") or ""}
                for e in elements if e.get("element_type") == "oneshot"
            ],
        }

    try:
        return jsonify({"ok": True, **_cached(f"set:{uuid}", SOUNDSET_TTL_SECONDS, fetch)})
    except http_requests.RequestException as exc:
        return jsonify({"error": f"Syrinscape did not answer: {exc}"}), 502


# Moods switch the whole soundscape; one-shots are stingers layered on top.
PLAY_KINDS = {"mood": "moods", "oneshot": "elements"}


@bp.post("/api/sounds/play")
def api_play():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    conf_error = _configured_error()
    if conf_error:
        return conf_error

    body = request.get_json(silent=True) or {}
    kind = PLAY_KINDS.get(str(body.get("kind") or ""))
    pk = body.get("pk")
    if not kind or not isinstance(pk, int):
        return jsonify({"error": "kind (mood|oneshot) and a numeric pk are required"}), 400

    try:
        response = http_requests.post(
            f"{SYRINSCAPE_BASE}/{kind}/{pk}/play/",
            params={"auth_token": SYRINSCAPE_AUTH_TOKEN},
            timeout=20,
        )
        response.raise_for_status()
    except http_requests.RequestException as exc:
        return jsonify({"error": f"Syrinscape refused: {exc}"}), 502
    return jsonify({"ok": True})


@bp.post("/api/sounds/stop-all")
def api_stop_all():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    conf_error = _configured_error()
    if conf_error:
        return conf_error
    try:
        response = http_requests.post(
            f"{SYRINSCAPE_BASE}/stop-all/",
            params={"auth_token": SYRINSCAPE_AUTH_TOKEN},
            timeout=20,
        )
        response.raise_for_status()
    except http_requests.RequestException as exc:
        return jsonify({"error": f"Syrinscape refused: {exc}"}), 502
    return jsonify({"ok": True})


__all__ = ['api_soundsets', 'api_soundset', 'api_play', 'api_stop_all']
