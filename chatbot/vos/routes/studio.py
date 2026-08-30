from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("studio", __name__)

@bp.route("/api/studio/generate", methods=["POST"])
def studio_generate():
    body = request.get_json(silent=True) or {}
    prompt, error = _studio_prompt_from_body(body)
    if error:
        payload, status = error
        payload.setdefault("error_code", "invalid_prompt")
        return jsonify(payload), status
    style_key, error = _studio_style_from_body(body)
    if error:
        payload, status = error
        payload.setdefault("error_code", "invalid_prompt")
        return jsonify(payload), status
    creator, auth_error = _studio_creator_from_body(body, require_login=True)
    if auth_error:
        # auth_error is a Flask Response object — re-tag with error_code.
        try:
            data = auth_error.get_json(silent=True) or {}
            if isinstance(data, dict) and "error_code" not in data:
                data["error_code"] = "auth"
                return jsonify(data), auth_error.status_code
        except Exception:
            pass
        return auth_error
    enhance = _studio_enhance_from_body(body)

    # Per-player monthly cap. STUDIO_MONTHLY_QUOTA=0 disables the check
    # (useful for local dev). The DM creator slot is also exempt so the
    # admin can backfill without burning their own budget.
    if STUDIO_MONTHLY_QUOTA > 0 and creator != "DM":
        used = _studio_quota_count(creator)
        if used >= STUDIO_MONTHLY_QUOTA:
            return jsonify({
                "error": (
                    f"You've used all {STUDIO_MONTHLY_QUOTA} of your image "
                    f"generations this month."
                ),
                "error_code": "quota",
                "quota": {
                    "used": used,
                    "limit": STUDIO_MONTHLY_QUOTA,
                    "resets_at": _studio_period_reset_iso(),
                },
            }), 429

    job_id = secrets.token_urlsafe(18)
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO studio_jobs (
                id, creator, prompt, style, status, result_url,
                error_message, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
        """, (job_id, creator, prompt, style_key, now, now))

    # Count the quota here, before kicking off the background job, so a
    # mid-job server crash can't be used to bypass the cap. The job
    # itself may still fail at the OpenAI step — we deliberately don't
    # refund (failed attempts cost compute on our side too).
    if STUDIO_MONTHLY_QUOTA > 0 and creator != "DM":
        _studio_quota_consume(creator)

    thread = threading.Thread(
        target=_run_studio_job,
        args=(job_id, prompt, style_key, creator, enhance),
        daemon=True,
    )
    thread.start()
    return jsonify({"jobId": job_id}), 202


@bp.route("/api/studio/jobs", methods=["GET"])
def studio_jobs():
    mine = request.args.get("mine") == "1"
    if not mine:
        return jsonify({"error": "Only mine=1 is supported"}), 400
    try:
        limit = int(request.args.get("limit", 30))
    except (TypeError, ValueError):
        limit = 30
    limit = max(1, min(limit, 100))
    creator, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    if not creator:
        return jsonify({"jobs": []})
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT id, creator, title, prompt, enhanced_prompt, style,
                   status, result_url, gallery_id, error_message,
                   created_at, updated_at
            FROM studio_jobs
            WHERE creator = ?
            ORDER BY updated_at DESC
            LIMIT ?
        """, (creator, limit)))
    return jsonify({"jobs": [_studio_job_payload(row) for row in rows]})


@bp.route("/api/studio/jobs/<job_id>", methods=["GET"])
def studio_job(job_id):
    with _app_db() as conn:
        row = conn.execute("""
            SELECT id, creator, title, prompt, enhanced_prompt, style,
                   status, result_url, gallery_id, error_message,
                   created_at, updated_at
            FROM studio_jobs
            WHERE id = ?
        """, (job_id,)).fetchone()
    if not row:
        return jsonify({"error": "Job not found"}), 404

    creator, auth_error = _logged_in_player_name({"name": row["creator"]})
    if auth_error:
        return auth_error
    if creator != row["creator"]:
        return jsonify({"error": "Identity mismatch"}), 403

    return jsonify(_studio_job_payload(row))


@bp.route("/api/generate-image", methods=["POST"])
def generate_image():
    """Generate an image via OpenAI's images API + persist to the gallery.

    Kept for legacy callers. The Studio app uses /api/studio/generate so page
    navigation cannot lose the active generation state.
    """
    body = request.get_json(silent=True) or {}
    prompt, error = _studio_prompt_from_body(body)
    if error:
        payload, status = error
        return jsonify(payload), status
    style_key, error = _studio_style_from_body(body)
    if error:
        payload, status = error
        return jsonify(payload), status
    created_by, auth_error = _studio_creator_from_body(body, require_login=True)
    if auth_error:
        return auth_error
    enhance = _studio_enhance_from_body(body)
    payload, status = _generate_image_payload(prompt, style_key, created_by, enhance)
    return jsonify(payload), status


@bp.route("/api/art-styles", methods=["GET"])
def art_styles():
    """Return the list of style presets the Art Studio UI can show."""
    return jsonify({
        "default": DEFAULT_STYLE_KEY,
        "styles": [
            {
                "key": key,
                "label": preset["label"],
                "description": preset["description"],
            }
            for key, preset in ART_STYLE_PRESETS.items()
        ],
    })

__all__ = ['studio_generate', 'studio_jobs', 'studio_job', 'generate_image', 'art_styles']
