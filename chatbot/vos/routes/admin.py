from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("admin", __name__)

@bp.route("/api/admin/config", methods=["GET"])
def admin_config():
    """Tells the DM page what it needs to render the Sign in with Google
    button. The client_id is public (anyone can read it from .well-known
    or our own static assets — that's how OAuth works) so returning it
    here is fine. Never returns the JWT secret or the allowlist."""
    return jsonify({
        "configured": _admin_auth_configured(),
        "google_client_id": GOOGLE_OAUTH_CLIENT_ID,
    })


@bp.route("/api/admin/login", methods=["POST"])
def admin_login():
    """Exchange a Google ID token for a server-signed session JWT.
    Client should send { credential: <id_token from GIS> }."""
    if not _admin_auth_configured():
        return jsonify({
            "error": "DM auth is not configured on this server.",
            "error_code": "auth_not_configured",
        }), 503
    body = request.get_json(silent=True) or {}
    credential = body.get("credential")
    try:
        email = _verify_google_id_token(credential)
    except ValueError as exc:
        return jsonify({"error": str(exc), "error_code": "auth"}), 401
    token = _mint_session_jwt(email)
    return jsonify({
        "ok": True,
        "session_token": token,
        "email": email,
        "expires_in": SESSION_JWT_TTL_SECONDS,
    })


@bp.route("/api/admin/session", methods=["GET"])
def admin_session():
    """Return who the caller is logged in as (or 401). Used by the DM
    page on load to decide whether to show the sign-in button or the
    signed-in chrome."""
    player_payload = _verify_player_token_payload(_extract_player_token())
    if player_payload and bool(player_payload.get("is_dm") or _is_dm_player(player_payload.get("name"))):
        return jsonify({
            "configured": True,
            "signed_in": True,
            "email": player_payload.get("principal") or player_payload.get("name") or "DM",
            "app_auth": True,
        })
    if not _admin_auth_configured():
        return jsonify({"configured": False}), 200
    email, reason = _verify_session_jwt(_extract_bearer_token())
    if not email:
        return jsonify({"configured": True, "signed_in": False, "reason": reason}), 200
    return jsonify({"configured": True, "signed_in": True, "email": email})


@bp.route("/api/admin/rebuild", methods=["GET", "POST"])
def admin_rebuild():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    if request.method == "GET":
        return jsonify({"rebuild": _read_rebuild_status()})

    body = request.get_json(silent=True) or {}
    include_knowledge = body.get("knowledge")
    if include_knowledge is None:
        include_knowledge = AUTO_KNOWLEDGE_ON_WIKI_SAVE
    rebuild = _start_rebuild_job(
        str(body.get("reason") or "manual DM rebuild").strip()[:160],
        include_knowledge=bool(include_knowledge),
    )
    return jsonify({"ok": rebuild.get("state") != "disabled", "rebuild": rebuild})


@bp.route("/api/admin/wiki-entry", methods=["GET", "PUT"])
def admin_wiki_entry():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    if request.method == "GET":
        wiki_url = (request.args.get("url") or "").strip()
        source_path = _wiki_url_to_source_path(wiki_url)
        if not source_path:
            return jsonify({"error": f"No wiki source found for {wiki_url or '(blank)'}"}), 404
        try:
            return jsonify({"entry": _read_wiki_source_payload(source_path)})
        except Exception as exc:
            logging.exception("Failed to read wiki source %s", wiki_url)
            return jsonify({"error": str(exc), "error_code": "read_failed"}), 500

    body = request.get_json(silent=True) or {}
    wiki_url = (body.get("url") or "").strip()
    content = body.get("content")
    expected_hash = (body.get("expected_hash") or body.get("hash") or "").strip()
    if not isinstance(content, str):
        return jsonify({"error": "content must be a string", "error_code": "invalid"}), 400
    if len(content.encode("utf-8")) > 750_000:
        return jsonify({"error": "Wiki entry is too large to save here", "error_code": "invalid"}), 413

    source_path = _wiki_url_to_source_path(wiki_url)
    if not source_path:
        return jsonify({"error": f"No wiki source found for {wiki_url or '(blank)'}"}), 404

    try:
        current_text = source_path.read_text(encoding="utf-8")
        current_hash = _wiki_source_hash(current_text)
        if expected_hash and expected_hash != current_hash:
            return jsonify({
                "error": "This wiki file changed since you loaded it. Reload before saving.",
                "error_code": "conflict",
                "current_hash": current_hash,
            }), 409

        if content and not content.endswith("\n"):
            content += "\n"
        tmp = source_path.with_name(source_path.name + f".{secrets.token_hex(6)}.tmp")
        try:
            tmp.write_text(content, encoding="utf-8")
            os.replace(tmp, source_path)
        finally:
            try:
                if tmp.exists():
                    tmp.unlink()
            except OSError:
                pass
        _chown_like_site(source_path)
        entry = _read_wiki_source_payload(source_path)
        rebuild = _start_rebuild_job(
            f"wiki edit: {entry.get('source_file') or wiki_url}",
            include_knowledge=AUTO_KNOWLEDGE_ON_WIKI_SAVE,
        )
        return jsonify({
            "ok": True,
            "entry": entry,
            "rebuild": rebuild,
            "next_steps": [],
        })
    except Exception as exc:
        logging.exception("Failed to save wiki source %s", wiki_url)
        return jsonify({"error": str(exc), "error_code": "save_failed"}), 500


@bp.route("/api/admin/messages", methods=["GET"])
def admin_messages():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 100))
    include_deleted = request.args.get("includeDeleted") in {"1", "true", "yes"}

    where = "" if include_deleted else "WHERE deleted_at IS NULL"
    with _app_db() as conn:
        rows = list(conn.execute(f"""
            SELECT id, title, body, url, target_type, created_at, deleted_at
            FROM messages
            {where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        """, (limit,)))
        messages = []
        for row in rows:
            payload = _message_payload(
                row,
                recipients=_message_recipients(conn, row["id"]),
                push_summary=_delivery_summary(conn, row["id"]),
                include_deleted=True,
            )
            # Read receipts: dismissed the in-app card, or tapped the push.
            payload["seenBy"] = [
                r["player_name"] for r in conn.execute("""
                    SELECT player_name FROM message_dismissals
                    WHERE message_id = ? ORDER BY player_name COLLATE NOCASE
                """, (row["id"],))
            ]
            payload["openedBy"] = [
                r["player_name"] for r in conn.execute("""
                    SELECT player_name FROM push_opens
                    WHERE message_id = ? ORDER BY player_name COLLATE NOCASE
                """, (row["id"],))
            ]
            messages.append(payload)

    return jsonify({"messages": messages})


@bp.route("/api/admin/messages/<int:message_id>", methods=["DELETE"])
def dm_message_delete(message_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    deleted_at = _utc_now_iso()
    with _app_db() as conn:
        row = conn.execute("""
            SELECT id
            FROM messages
            WHERE id = ?
        """, (message_id,)).fetchone()
        if not row:
            return jsonify({"error": "Message not found"}), 404
        conn.execute("""
            UPDATE messages
            SET deleted_at = COALESCE(deleted_at, ?)
            WHERE id = ?
        """, (deleted_at, message_id))

    return jsonify({"ok": True, "id": message_id, "deleted_at": deleted_at})


@bp.route("/api/admin/lore-submissions", methods=["GET"])
def admin_lore_submissions():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    status = request.args.get("status", "").strip()
    try:
        limit = int(request.args.get("limit", "30"))
    except ValueError:
        limit = 30
    limit = max(1, min(limit, 100))

    where = ""
    args = []
    if status:
        where = "WHERE status = ?"
        args.append(status)
    args.append(limit)
    with _app_db() as conn:
        rows = list(conn.execute(f"""
            SELECT id, submitter, kind, title, slug, short_description,
                   connections_json, notes, status, context_json,
                   generated_markdown, generated_summary, generated_image_prompt,
                   generated_card_fields_json,
                   image_url, image_filename, error_message, created_at,
                   updated_at, published_at
            FROM lore_submissions
            {where}
            ORDER BY updated_at DESC
            LIMIT ?
        """, args))
    return jsonify({"submissions": [_submission_payload(row, include_markdown=False) for row in rows]})


@bp.route("/api/admin/lore-submissions/<submission_id>", methods=["GET"])
def admin_lore_submission_detail(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
    if not row:
        return jsonify({"error": "Submission not found"}), 404
    return jsonify({"submission": _submission_payload(row, include_markdown=True, include_context=True)})


@bp.route("/api/admin/lore-submissions/<submission_id>/save", methods=["POST"])
def admin_lore_submission_save(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return jsonify({"error": "Submission not found"}), 404
        title = str(body.get("title") or row["title"]).strip()[:120]
        slug = _slugify(body.get("slug") or row["slug"] or title)
        markdown = str(body.get("markdown") or row["generated_markdown"] or "").strip()
        summary = str(body.get("summary") or row["generated_summary"] or "").strip()[:300]
        image_prompt = str(body.get("image_prompt") or row["generated_image_prompt"] or "").strip()[:1800]
        if "card_fields" in body:
            card_fields = _sanitize_card_fields(body.get("card_fields") or [])
        else:
            card_fields = _json_loads(row["generated_card_fields_json"], [])
        card_fields_json = json.dumps(card_fields, separators=(",", ":"))
        conn.execute("""
            UPDATE lore_submissions
            SET title = ?, slug = ?, generated_markdown = ?,
                generated_summary = ?, generated_image_prompt = ?,
                generated_card_fields_json = ?,
                updated_at = ?
            WHERE id = ?
        """, (title, slug, markdown, summary, image_prompt,
              card_fields_json, _utc_now_iso(), submission_id))
        updated = _lore_submission_row(conn, submission_id)
    return jsonify({"ok": True, "submission": _submission_payload(updated, include_markdown=True)})


@bp.route("/api/admin/lore-submissions/<submission_id>/draft", methods=["POST"])
def admin_lore_submission_redraft(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return jsonify({"error": "Submission not found"}), 404
        if row["status"] == "published":
            return jsonify({"error": "Published submissions cannot be regenerated"}), 409
    _start_lore_draft_thread(submission_id)
    return jsonify({"ok": True, "id": submission_id, "status": "drafting"}), 202


@bp.route("/api/admin/lore-submissions/<submission_id>/reject", methods=["POST"])
def admin_lore_submission_reject(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    reason = str(body.get("reason") or "Rejected by DM").strip()[:500]
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return jsonify({"error": "Submission not found"}), 404
        conn.execute("""
            UPDATE lore_submissions
            SET status = 'rejected', error_message = ?, updated_at = ?
            WHERE id = ?
        """, (reason, _utc_now_iso(), submission_id))
    return jsonify({"ok": True, "id": submission_id, "status": "rejected"})


@bp.route("/api/admin/lore-submissions/<submission_id>/publish", methods=["POST"])
def admin_lore_submission_publish(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    payload, status = _publish_lore_submission(submission_id, request.get_json(silent=True) or {})
    return jsonify(payload), status

__all__ = ['admin_config', 'admin_login', 'admin_session', 'admin_rebuild', 'admin_wiki_entry', 'admin_messages', 'dm_message_delete', 'admin_lore_submissions', 'admin_lore_submission_detail', 'admin_lore_submission_save', 'admin_lore_submission_redraft', 'admin_lore_submission_reject', 'admin_lore_submission_publish']
