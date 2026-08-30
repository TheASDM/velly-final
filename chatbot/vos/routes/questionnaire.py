from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("questionnaire", __name__)

QUESTIONNAIRE_MAX_FIELDS = 200
QUESTIONNAIRE_MAX_VALUE = 8000
QUESTIONNAIRE_MAX_TOTAL = 400_000

def _clean_questionnaire_answers(raw):
    """Validate an answers object. Returns (dict, error_message)."""
    if not isinstance(raw, dict):
        return None, "answers must be an object"
    if len(raw) > QUESTIONNAIRE_MAX_FIELDS:
        return None, "Too many answer fields"
    cleaned, total = {}, 0
    for key, value in raw.items():
        if not isinstance(key, str) or not key.strip():
            return None, "Invalid answer key"
        if not isinstance(value, str):
            return None, f"Answer for {key[:60]!r} must be text"
        value = value[:QUESTIONNAIRE_MAX_VALUE]
        total += len(value)
        if total > QUESTIONNAIRE_MAX_TOTAL:
            return None, "Answers too large"
        if value.strip():
            cleaned[key.strip()[:120]] = value
    return cleaned, None


def _questionnaire_row_json(row):
    try:
        answers = json.loads(row["answers"] or "{}")
    except (TypeError, ValueError):
        answers = {}
    return {
        "playerName": row["player_name"],
        "answers": answers if isinstance(answers, dict) else {},
        "status": row["status"],
        "submitted_at": row["submitted_at"],
        "updated_at": row["updated_at"],
    }


def _save_questionnaire(submit=False):
    body = request.get_json(silent=True) or {}
    player_name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    if not player_name:
        return jsonify({"error": "Missing player name"}), 400
    answers, clean_error = _clean_questionnaire_answers(body.get("answers"))
    if clean_error:
        return jsonify({"error": clean_error}), 400

    now = _utc_now_iso()
    with _app_db() as conn:
        if submit:
            conn.execute("""
                INSERT INTO questionnaires (player_name, answers, status, submitted_at, updated_at)
                VALUES (?, ?, 'submitted', ?, ?)
                ON CONFLICT(player_name) DO UPDATE SET
                    answers = excluded.answers,
                    status = 'submitted',
                    submitted_at = excluded.submitted_at,
                    updated_at = excluded.updated_at
            """, (player_name, json.dumps(answers), now, now))
        else:
            # Autosave keeps a submitted record submitted — sealing is a
            # milestone, not a lock.
            conn.execute("""
                INSERT INTO questionnaires (player_name, answers, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(player_name) DO UPDATE SET
                    answers = excluded.answers,
                    updated_at = excluded.updated_at
            """, (player_name, json.dumps(answers), now))
        row = conn.execute(
            "SELECT * FROM questionnaires WHERE player_name = ?", (player_name,)
        ).fetchone()
    return jsonify({"ok": True, **_questionnaire_row_json(row)})


@bp.route("/api/questionnaire", methods=["GET", "PUT"])
def questionnaire():
    if request.method == "PUT":
        return _save_questionnaire(submit=False)
    player_name, auth_error = _authenticated_player_name()
    if auth_error:
        return auth_error
    if not player_name:
        return jsonify({"error": "Missing player name"}), 400
    with _app_db() as conn:
        row = conn.execute(
            "SELECT * FROM questionnaires WHERE player_name = ?", (player_name,)
        ).fetchone()
    if not row:
        return jsonify({
            "playerName": player_name,
            "answers": {},
            "status": "draft",
            "submitted_at": None,
            "updated_at": None,
        })
    return jsonify(_questionnaire_row_json(row))


@bp.route("/api/questionnaire/submit", methods=["POST"])
def questionnaire_submit():
    return _save_questionnaire(submit=True)


@bp.route("/api/questionnaire/all", methods=["GET"])
def questionnaire_all():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        rows = conn.execute(
            "SELECT * FROM questionnaires ORDER BY player_name"
        ).fetchall()
    return jsonify({"records": [_questionnaire_row_json(row) for row in rows]})


def _load_questionnaire_definitions():
    path = SITE_SOURCE_DIR / "_data" / "questionnaire.json"
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("questionnaire.json is not an object")
    return data


@bp.route("/api/questionnaire/definitions", methods=["GET"])
def questionnaire_definitions():
    """Question definitions, scoped to the caller. Per-character Part II
    prompts and on-file vitals are DM-written spoiler material, so a player
    receives only their own character; the DM receives all of them."""
    if _admin_error_response() is None:
        is_dm, player_name = True, None
    else:
        player_name, auth_error = _authenticated_player_name()
        if auth_error:
            return auth_error
        if not player_name:
            return jsonify({"error": "Missing player name"}), 400
        is_dm = _is_dm_player(player_name)
    try:
        data = _load_questionnaire_definitions()
    except (OSError, ValueError):
        return jsonify({"error": "Question definitions are unavailable"}), 503
    if not is_dm:
        characters = data.get("characters") or {}
        data = {
            **data,
            "characters": {
                key: value
                for key, value in characters.items()
                if isinstance(value, dict) and value.get("player") == player_name
            },
        }
    return jsonify(data)

__all__ = ['QUESTIONNAIRE_MAX_FIELDS', 'QUESTIONNAIRE_MAX_VALUE', 'QUESTIONNAIRE_MAX_TOTAL', '_clean_questionnaire_answers', '_questionnaire_row_json', '_save_questionnaire', 'questionnaire', 'questionnaire_submit', 'questionnaire_all', '_load_questionnaire_definitions', 'questionnaire_definitions']
