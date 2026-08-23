from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("lore", __name__)

@bp.route("/api/lore-submissions", methods=["POST"])
def lore_submission_create():
    body = request.get_json(silent=True) or {}
    submitter, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    if not submitter:
        return jsonify({"error": "Login required before submitting lore"}), 401

    kind = str(body.get("kind") or "").strip().lower()
    if kind not in LORE_SUBMISSION_KINDS:
        return jsonify({"error": "Choose item, person, place, faction, or lore"}), 400

    title = str(body.get("title") or "").strip()
    description = str(body.get("description") or body.get("short_description") or "").strip()
    notes = str(body.get("notes") or "").strip()[:2000]
    connections = _parse_submission_connections(body.get("connections"))
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not description:
        return jsonify({"error": "Short description is required"}), 400
    if len(title) > 120:
        return jsonify({"error": "Title is too long"}), 400
    if len(description) > 2500:
        return jsonify({"error": "Description is too long"}), 400

    submission_id = secrets.token_urlsafe(18)
    slug = _slugify(title)
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO lore_submissions (
                id, submitter, kind, title, slug, short_description,
                connections_json, notes, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
        """, (
            submission_id,
            submitter,
            kind,
            title,
            slug,
            description,
            json.dumps(connections, separators=(",", ":")),
            notes,
            now,
            now,
        ))
    _start_lore_draft_thread(submission_id)
    return jsonify({"ok": True, "id": submission_id, "status": "submitted"}), 202


@bp.route("/api/lore-submissions/mine", methods=["GET"])
def lore_submissions_mine():
    submitter, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT id, submitter, kind, title, slug, short_description,
                   connections_json, notes, status, context_json,
                   generated_markdown, generated_summary, generated_image_prompt,
                   generated_card_fields_json,
                   image_url, image_filename, error_message, created_at,
                   updated_at, published_at
            FROM lore_submissions
            WHERE submitter = ?
            ORDER BY updated_at DESC
            LIMIT 20
        """, (submitter,)))
    return jsonify({"submissions": [_submission_payload(row, include_markdown=False) for row in rows]})


@bp.route("/api/lore-submissions/<submission_id>", methods=["GET"])
def lore_submission_detail(submission_id):
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
    if not row:
        return jsonify({"error": "Submission not found"}), 404
    submitter, auth_error = _logged_in_player_name({"name": row["submitter"]})
    if auth_error:
        return auth_error
    if submitter != row["submitter"]:
        return jsonify({"error": "Identity mismatch"}), 403
    return jsonify({"submission": _submission_payload(row, include_markdown=True)})


@bp.route("/api/lore-submissions/<submission_id>/image", methods=["GET"])
def lore_submission_image(submission_id):
    if not re.fullmatch(r"[A-Za-z0-9_-]{12,80}", submission_id or ""):
        abort(404)
    if not LORE_DRAFT_IMAGES_DIR.exists():
        abort(404)
    return send_from_directory(LORE_DRAFT_IMAGES_DIR, f"{submission_id}.png", max_age=60)

__all__ = ['lore_submission_create', 'lore_submissions_mine', 'lore_submission_detail', 'lore_submission_image']
