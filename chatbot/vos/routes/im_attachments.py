"""Files in a conversation: images and PDFs, 10MB, members only.

Two rules shape everything here.

  An unguessable URL is not access control. Every read checks that the
  caller is a member of the thread the file belongs to — which is why
  thread_key is bound at upload time, before any message exists to carry
  it. The browser sends the auth cookie with an <img> request, so this is
  a real check rather than a hope.

  A file is what it decodes as, not what it says it is. Images go through
  a magic-byte check and then an actual decode with a pixel cap; a PDF is
  checked for its header and served as a download, never rendered inline.

Files live under app-data/chat-attachments/, inside the volume the
database is already backed up from, and never in the repo.
"""
from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("im_attachments", __name__)

ATTACHMENT_DIR = APP_DB_PATH.parent / "chat-attachments"
# nginx allows a small multipart envelope above this application-level cap,
# so a file that is exactly 10 MiB reaches this explicit validation.
ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
ATTACHMENTS_PER_MESSAGE = 6
# An upload nobody ever sent is rubbish after a day.
ATTACHMENT_ORPHAN_SECONDS = 24 * 3600
ATTACHMENT_ID = re.compile(r"^[0-9a-f]{32}$")


def _attachment_json(row):
    columns = set(row.keys())
    return {
        "id": row["id"],
        "kind": row["kind"],
        "filename": row["filename"],
        "mime": row["mime"],
        "bytes": row["bytes"],
        "width": row["width"],
        "height": row["height"],
        "threadId": row["thread_id"] if "thread_id" in columns else None,
        "url": f"/api/im/attachment/{row['id']}",
        "thumbUrl": (f"/api/im/attachment/{row['id']}?thumb=1"
                     if row["kind"] == "image" else None),
    }


def _safe_filename(name):
    """A display name, not a path. The stored file is named by its id."""
    name = (name or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1].strip()
    name = re.sub(r"[\x00-\x1f]", "", name)
    return name[:120] or "attachment"


def _attachment_paths(row):
    ext = IMAGE_EXTENSIONS.get(row["mime"], ".pdf" if row["kind"] == "pdf" else "")
    return (ATTACHMENT_DIR / f"{row['id']}{ext}",
            ATTACHMENT_DIR / f"{row['id']}.thumb.jpg")


def _sweep_orphans(conn):
    """Uploads that were never sent. Rows and files go together."""
    cutoff = _utc_now_iso_in(-ATTACHMENT_ORPHAN_SECONDS)
    rows = conn.execute("""
        SELECT * FROM chat_attachments
        WHERE message_id IS NULL AND created_at < ?
        LIMIT 200
    """, (cutoff,)).fetchall()
    for row in rows:
        for path in _attachment_paths(row):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logging.warning("Could not remove orphan %s", path)
        conn.execute("DELETE FROM chat_attachments WHERE id = ?", (row["id"],))
    return len(rows)


def _attachments_for_messages(conn, message_ids):
    """Attachments keyed by message id, for a page of messages."""
    ids = [int(value) for value in message_ids]
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    grouped = {}
    for row in conn.execute(f"""
        SELECT * FROM chat_attachments
        WHERE message_id IN ({placeholders})
        ORDER BY position ASC, created_at ASC
    """, ids):
        grouped.setdefault(row["message_id"], []).append(_attachment_json(row))
    return grouped


def _claim_attachments(conn, ids, caller, thread_key, message_id):
    """Bind uploads to the message that is sending them.

    Every one has to be this caller's, in this thread, and not already
    attached to something else. Returns (attachments, error_response)."""
    if not ids:
        return [], None
    if len(ids) > ATTACHMENTS_PER_MESSAGE:
        return None, (jsonify({
            "error": f"Up to {ATTACHMENTS_PER_MESSAGE} files on one message.",
            "error_code": "invalid",
        }), 400)
    claimed = []
    seen = set()
    for value in ids:
        if not isinstance(value, str) or not ATTACHMENT_ID.fullmatch(value):
            return None, (jsonify({"error": "Unknown attachment",
                                   "error_code": "invalid"}), 400)
        if value in seen:
            return None, (jsonify({
                "error": "The same attachment cannot be added twice.",
                "error_code": "invalid",
            }), 400)
        seen.add(value)
        row = conn.execute(
            "SELECT * FROM chat_attachments WHERE id = ?", (value,)
        ).fetchone()
        if (not row or row["uploader"] != caller
                or row["thread_key"] != thread_key
                or row["message_id"] is not None):
            return None, (jsonify({"error": "Unknown attachment",
                                   "error_code": "invalid"}), 400)
        claimed.append(row)
    for position, row in enumerate(claimed):
        conn.execute(
            "UPDATE chat_attachments SET message_id = ?, position = ? WHERE id = ?",
            (message_id, position, row["id"]),
        )
    return [_attachment_json(row) for row in claimed], None


def _attachment_ids_from(body):
    value = body.get("attachments")
    if value is None:
        return []
    if not isinstance(value, list):
        return None
    return value


@bp.route("/api/im/attachment", methods=["POST"])
def im_attachment_upload():
    caller, auth_error = _im_caller()
    if auth_error:
        return auth_error
    reference = request.form.get("threadId") or request.form.get("thread_id") \
        or request.form.get("threadKey") or request.form.get("thread_key") or ""
    thread_key, thread_id = _resolve_thread_reference(reference)
    if not thread_key:
        return jsonify({"error": "No such thread", "error_code": "not_found"}), 404
    access_error = _thread_access_error(thread_key, caller)
    if access_error:
        return access_error

    upload = request.files.get("file")
    if upload is None:
        return jsonify({"error": "Send the file as multipart field 'file'.",
                        "error_code": "invalid"}), 400

    data = upload.read(ATTACHMENT_MAX_BYTES + 1)
    if len(data) > ATTACHMENT_MAX_BYTES:
        return jsonify({
            "error": f"Files are capped at {ATTACHMENT_MAX_BYTES // (1024 * 1024)} MB.",
            "error_code": "too_large",
        }), 413
    if not data:
        return jsonify({"error": "That file is empty.", "error_code": "invalid"}), 400

    mimetype = (upload.mimetype or "").lower()
    width = height = None
    if mimetype == PDF_MIME:
        if not looks_like_pdf(data):
            return jsonify({"error": "That file does not look like a PDF.",
                            "error_code": "unsupported"}), 415
        kind, ext = "pdf", ".pdf"
    else:
        try:
            ext, width, height = validate_image(data, mimetype)
        except UploadRejected as rejected:
            return jsonify({"error": rejected.message,
                            "error_code": "unsupported"}), rejected.status
        kind = "image"

    attachment_id = secrets.token_hex(16)
    ATTACHMENT_DIR.mkdir(parents=True, exist_ok=True)
    original = ATTACHMENT_DIR / f"{attachment_id}{ext}"
    thumb = ATTACHMENT_DIR / f"{attachment_id}.thumb.jpg"
    original_staged = ATTACHMENT_DIR / f".{attachment_id}{ext}.upload"
    thumb_staged = ATTACHMENT_DIR / f".{attachment_id}.thumb.upload"
    created_paths = [original_staged, thumb_staged, original, thumb]
    try:
        original_staged.write_bytes(data)
        has_thumb = kind == "image" and write_thumbnail(data, thumb_staged)
        if not has_thumb:
            thumb_staged.unlink(missing_ok=True)
        with _app_db() as conn:
            conn.execute("""
                INSERT INTO chat_attachments
                    (id, thread_key, thread_id, uploader, uploader_seat_id,
                     message_id, kind, filename, mime, bytes, width, height,
                     created_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
            """, (attachment_id, thread_key, thread_id, caller, _seat_id(caller), kind,
                  _safe_filename(upload.filename), mimetype, len(data),
                  width, height, _utc_now_iso()))
            # Rename on the same volume is atomic. It happens before commit,
            # so readers can never observe a committed row with half a file.
            original_staged.replace(original)
            if has_thumb:
                thumb_staged.replace(thumb)
            _sweep_orphans(conn)
            row = conn.execute(
                "SELECT * FROM chat_attachments WHERE id = ?", (attachment_id,)
            ).fetchone()
    except Exception:
        for path in created_paths:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logging.warning("Could not clean failed attachment %s", path)
        raise

    return jsonify({"ok": True, "attachment": _attachment_json(row)}), 201


@bp.route("/api/im/attachment/<attachment_id>", methods=["GET"])
def im_attachment_file(attachment_id):
    """Serve a file to members of its thread. Everything a non-member could
    learn answers 404 — including whether the id exists at all."""
    if not ATTACHMENT_ID.fullmatch(attachment_id or ""):
        abort(404)
    if _preview_actor():
        return jsonify({
            "error": "Messaging is unavailable while previewing a player.",
            "error_code": "preview_forbidden",
        }), 403
    caller = _verify_player_token(_extract_player_token())
    if not caller:
        abort(404)

    with _app_db() as conn:
        row = conn.execute(
            "SELECT * FROM chat_attachments WHERE id = ?", (attachment_id,)
        ).fetchone()
    if not row:
        abort(404)
    if row["message_id"] is not None:
        with _app_db() as conn:
            parent = conn.execute(
                "SELECT deleted_at FROM chat_messages WHERE id = ?",
                (row["message_id"],),
            ).fetchone()
        if not parent or parent["deleted_at"]:
            abort(404)
    members = _thread_members(row["thread_key"], _im_roster())
    if not members or caller not in members:
        abort(404)

    original, thumb = _attachment_paths(row)
    wants_thumb = request.args.get("thumb") in ("1", "true", "yes")
    path = thumb if (wants_thumb and thumb.exists()) else original
    if not path.exists():
        abort(404)

    response = send_from_directory(
        path.parent, path.name,
        mimetype="image/jpeg" if path is thumb else row["mime"],
        max_age=3600,
        # A PDF is handed over, never rendered in the page.
        as_attachment=(row["kind"] == "pdf"),
        download_name=row["filename"] if row["kind"] == "pdf" else None,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Authorization and deletion are checked on every use. A private browser
    # cache would otherwise keep a deleted image visible for up to an hour.
    response.headers["Cache-Control"] = "private, no-store"
    return response


__all__ = ['ATTACHMENT_DIR', 'ATTACHMENT_MAX_BYTES', 'ATTACHMENTS_PER_MESSAGE',
           'ATTACHMENT_ORPHAN_SECONDS', 'ATTACHMENT_ID', '_attachment_json',
           '_safe_filename', '_attachment_paths', '_sweep_orphans',
           '_attachments_for_messages', '_claim_attachments',
           '_attachment_ids_from', 'im_attachment_upload', 'im_attachment_file']
