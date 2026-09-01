"""Who everyone at the table is: name, avatar, character line, bio, presence.

Deliberately narrow. A profile answers "who am I talking to" and nothing
more — no hit points, no notes, no RSVPs, no availability. The three facts
players did not previously share with each other are all here on purpose
and were chosen: a self-written bio, an avatar they upload themselves, and
last-seen, which the chat polls were already recording.

Bios and avatars are player-written, so they live in the runtime database
and app-data/profile-avatars/ and never in the public repo.
"""
from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("profiles", __name__)

BIO_MAX = 1200
AVATAR_DIR = APP_DB_PATH.parent / "profile-avatars"
# Smaller than a chat attachment: this is a 32px circle in an app bar, not
# a handout. The decode and pixel cap in services/uploads.py still apply.
AVATAR_MAX_BYTES = 4 * 1024 * 1024
AVATAR_BOX = 512
AVATAR_FILE = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp|gif)$")


def _profile_roster():
    """Everyone who can hold a profile: the roster's players plus the DM.
    Enzo is not a person and has none."""
    return [*_roster_player_names(), "DM"]


def _roster_seat(player_name):
    """The curated seat from _data/players.json — display name, colour, and
    the portrait an upload falls back to."""
    try:
        path = SITE_SOURCE_DIR / "_data" / "players.json"
        seats = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    for seat in seats if isinstance(seats, list) else []:
        if isinstance(seat, dict) and seat.get("name") == player_name:
            return seat
    return {}


def _profile_rows(conn, names):
    if not names:
        return {}
    placeholders = ",".join("?" for _ in names)
    return {
        row["player_name"]: row
        for row in conn.execute(
            f"SELECT * FROM player_profiles WHERE player_name IN ({placeholders})",
            names,
        )
    }


def _character_line(conn, player_name):
    """The class line the app bar already shows its owner, derived from the
    same pushed statblock so the two never disagree."""
    row = conn.execute(
        "SELECT data FROM character_statblocks WHERE player_name = ?",
        (player_name,),
    ).fetchone()
    if not row:
        return None
    try:
        return _identity_from_statblock(json.loads(row["data"]))
    except (TypeError, ValueError):
        logging.warning("character_statblocks row for %r is not valid JSON", player_name)
        return None


def _avatar_url(player_name, row, seat):
    if row and row["avatar_file"]:
        # The filename is random, so a new upload is its own cache-bust.
        return (f"/api/profiles/{quote(player_name, safe='')}/avatar"
                f"?v={row['avatar_file'][:8]}")
    return seat.get("avatar") or "/images/app-profiles/unmapped.png"


def _profile_json(player_name, row, seat, presence=None, character=None, full=False):
    payload = {
        "name": player_name,
        "display": seat.get("display") or player_name,
        "color": seat.get("color") or None,
        "avatarUrl": _avatar_url(player_name, row, seat),
        "isDm": player_name == "DM",
        "lastSeenAt": presence,
    }
    if full:
        payload["bio"] = (row["bio"] if row else "") or ""
        payload["character"] = character
        payload["updatedAt"] = row["updated_at"] if row else None
    return payload


@bp.route("/api/profiles", methods=["GET"])
def profiles_directory():
    """Everyone at the table, for the links that reach a profile. Names and
    faces only — a bio is one request away and does not belong in a list."""
    caller, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    names = _profile_roster()
    with _app_db() as conn:
        _touch_presence(conn, caller)
        rows = _profile_rows(conn, names)
        presence = _presence_map(conn, names)
    return jsonify({
        "ok": True,
        "playerName": caller,
        "profiles": [
            _profile_json(name, rows.get(name), _roster_seat(name), presence.get(name))
            for name in names
        ],
    })


@bp.route("/api/profiles/<path:player_name>", methods=["GET"])
def profile_detail(player_name):
    caller, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    if player_name not in _profile_roster():
        return jsonify({"error": "No such player", "error_code": "not_found"}), 404
    with _app_db() as conn:
        _touch_presence(conn, caller)
        row = _profile_rows(conn, [player_name]).get(player_name)
        presence = _presence_map(conn, [player_name]).get(player_name)
        character = _character_line(conn, player_name)
        thread_key = (None if player_name == caller
                      else _direct_thread_key(caller, player_name))
        thread = _thread_record(conn, thread_key) if thread_key else None
    profile = _profile_json(player_name, row, _roster_seat(player_name),
                            presence, character, full=True)
    profile["isYou"] = player_name == caller
    # The thread key the Message button opens, worked out here so the
    # client never has to know how a thread key is spelled.
    profile["threadKey"] = thread_key
    profile["threadId"] = thread["id"] if thread else None
    return jsonify({"ok": True, "profile": profile})


@bp.route("/api/profile", methods=["PUT"])
def profile_update():
    """Your own bio. There is no endpoint for editing anyone else's."""
    caller, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    body = request.get_json(silent=True) or {}
    bio = body.get("bio")
    if bio is None:
        bio = ""
    if not isinstance(bio, str):
        return jsonify({"error": "bio must be text", "error_code": "invalid"}), 400
    bio = bio.strip()
    if len(bio) > BIO_MAX:
        return jsonify({
            "error": f"Keep it under {BIO_MAX} characters.",
            "error_code": "invalid",
        }), 400
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO player_profiles (player_name, bio, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(player_name) DO UPDATE SET
                bio = excluded.bio, updated_at = excluded.updated_at
        """, (caller, bio, now))
        _touch_presence(conn, caller)
        row = _profile_rows(conn, [caller]).get(caller)
    return jsonify({"ok": True, "bio": row["bio"],
                    "avatarUrl": _avatar_url(caller, row, _roster_seat(caller))})


@bp.route("/api/profile/avatar", methods=["POST", "DELETE"])
def profile_avatar_update():
    """Upload your own face, or go back to the curated portrait."""
    caller, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    now = _utc_now_iso()

    if request.method == "DELETE":
        with _app_db() as conn:
            row = _profile_rows(conn, [caller]).get(caller)
            if row and row["avatar_file"]:
                _remove_avatar_file(row["avatar_file"])
            conn.execute("""
                INSERT INTO player_profiles (player_name, avatar_file, updated_at)
                VALUES (?, NULL, ?)
                ON CONFLICT(player_name) DO UPDATE SET
                    avatar_file = NULL, updated_at = excluded.updated_at
            """, (caller, now))
            row = _profile_rows(conn, [caller]).get(caller)
        return jsonify({"ok": True,
                        "avatarUrl": _avatar_url(caller, row, _roster_seat(caller))})

    upload = request.files.get("file")
    if upload is None:
        return jsonify({"error": "Send the file as multipart field 'file'.",
                        "error_code": "invalid"}), 400
    data = upload.read(AVATAR_MAX_BYTES + 1)
    if len(data) > AVATAR_MAX_BYTES:
        return jsonify({
            "error": f"Avatars are capped at {AVATAR_MAX_BYTES // (1024 * 1024)} MB.",
            "error_code": "too_large",
        }), 413
    try:
        validate_image(data, upload.mimetype)
    except UploadRejected as rejected:
        return jsonify({"error": rejected.message,
                        "error_code": "unsupported"}), rejected.status

    # Stored at avatar size rather than as uploaded: this is a 32px circle
    # in an app bar, and nobody needs the original 12-megapixel selfie.
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_hex(16)}.jpg"
    if not write_thumbnail(data, AVATAR_DIR / filename, box=AVATAR_BOX):
        return jsonify({"error": "That image could not be resized.",
                        "error_code": "unsupported"}), 415

    with _app_db() as conn:
        previous = _profile_rows(conn, [caller]).get(caller)
        conn.execute("""
            INSERT INTO player_profiles (player_name, avatar_file, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(player_name) DO UPDATE SET
                avatar_file = excluded.avatar_file, updated_at = excluded.updated_at
        """, (caller, filename, now))
        row = _profile_rows(conn, [caller]).get(caller)
    if previous and previous["avatar_file"]:
        _remove_avatar_file(previous["avatar_file"])

    return jsonify({"ok": True,
                    "avatarUrl": _avatar_url(caller, row, _roster_seat(caller))}), 201


def _remove_avatar_file(filename):
    if not AVATAR_FILE.fullmatch(filename or ""):
        return
    try:
        (AVATAR_DIR / filename).unlink(missing_ok=True)
    except OSError:
        logging.warning("Could not remove avatar %s", filename)


@bp.route("/api/profiles/<path:player_name>/avatar", methods=["GET"])
def profile_avatar_file(player_name):
    """An uploaded face, to anyone signed in — the same audience that can
    already see the curated portrait in the public roster file."""
    caller = _verify_player_token(_extract_player_token())
    if not caller:
        abort(404)
    with _app_db() as conn:
        row = _profile_rows(conn, [player_name]).get(player_name)
    filename = row["avatar_file"] if row else None
    if not filename or not AVATAR_FILE.fullmatch(filename):
        abort(404)
    if not (AVATAR_DIR / filename).exists():
        abort(404)
    response = send_from_directory(AVATAR_DIR, filename, mimetype="image/jpeg",
                                   max_age=86400)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, max-age=86400"
    return response


__all__ = ['BIO_MAX', 'AVATAR_DIR', 'AVATAR_MAX_BYTES', 'AVATAR_BOX', 'AVATAR_FILE',
           '_profile_roster', '_roster_seat', '_profile_rows', '_character_line',
           '_avatar_url', '_profile_json', '_remove_avatar_file',
           'profiles_directory', 'profile_detail', 'profile_update',
           'profile_avatar_update', 'profile_avatar_file']
