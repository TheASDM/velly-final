"""DM-only routes for the session chronicler.

Drafting a chronicle costs one Opus call and several image generations, so
creation and regeneration are rate limited the same way the lore drafts are.
Everything here is behind _admin_error_response(), which a preview token
refuses as well as an anonymous one.
"""

from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("chronicle", __name__)

CHRONICLE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{12,80}$")


def _chronicle_creator():
    """Who the row is attributed to. The console is the DM's seat and a
    Google session has no player name, so this is 'DM' unless a player token
    with a name signed the request."""
    payload = _verify_player_token_payload(_extract_player_token())
    if payload and payload.get("name"):
        return str(payload["name"])[:64]
    return "DM"


@bp.route("/api/admin/chronicles", methods=["GET", "POST"])
@limiter.limit("20/hour", methods=["POST"])
def admin_chronicles():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    if request.method == "GET":
        try:
            limit = int(request.args.get("limit", "25"))
        except ValueError:
            limit = 25
        limit = max(1, min(limit, 100))
        status = (request.args.get("status") or "").strip()
        where, args = "", []
        if status:
            where, args = "WHERE status = ?", [status]
        args.append(limit)
        with _app_db() as conn:
            rows = list(conn.execute(
                f"SELECT {CHRONICLE_COLUMNS} FROM session_chronicles "
                f"{where} ORDER BY updated_at DESC LIMIT ?",
                args,
            ))
        return jsonify({
            "chronicles": [_chronicle_payload(row, include_draft=False) for row in rows],
            "max_art": CHRONICLE_MAX_ART,
            "default_art": CHRONICLE_DEFAULT_ART,
        })

    body = request.get_json(silent=True) or {}
    notes = str(body.get("notes") or "").strip()
    if len(notes) < 40:
        return jsonify({
            "error": "Paste the session notes first — a few sentences at minimum.",
            "error_code": "invalid",
        }), 400
    if len(notes.encode("utf-8")) > 2_000_000:
        return jsonify({"error": "Those notes are too long to send", "error_code": "invalid"}), 413

    session_date = str(body.get("session_date") or "").strip()[:10]
    if session_date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", session_date):
        return jsonify({"error": "session_date must be YYYY-MM-DD", "error_code": "invalid"}), 400
    if not session_date:
        session_date = datetime.now(CAMPAIGN_TZ).strftime("%Y-%m-%d")

    try:
        art_count = int(body.get("art_count", CHRONICLE_DEFAULT_ART))
    except (TypeError, ValueError):
        art_count = CHRONICLE_DEFAULT_ART
    art_count = max(0, min(art_count, CHRONICLE_MAX_ART))

    chronicle_id = secrets.token_urlsafe(18)
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO session_chronicles (
                id, created_by, session_number, session_date, title, slug,
                raw_notes, extra_sources, art_count, status, stage,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'Queued', ?, ?)
        """, (
            chronicle_id,
            _chronicle_creator(),
            str(body.get("session_number") or "").strip()[:60],
            session_date,
            str(body.get("title") or "").strip()[:160],
            "",
            notes,
            str(body.get("extra_sources") or "").strip(),
            art_count,
            now,
            now,
        ))
    _start_chronicle_job(chronicle_id)
    return jsonify({"ok": True, "id": chronicle_id, "status": "queued"}), 202


@bp.route("/api/admin/chronicles/<chronicle_id>", methods=["GET", "DELETE"])
def admin_chronicle_detail(chronicle_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
        if not row:
            return jsonify({"error": "Chronicle not found"}), 404
        if request.method == "DELETE":
            conn.execute("DELETE FROM session_chronicles WHERE id = ?", (chronicle_id,))
    if request.method == "DELETE":
        # The published page stays; deleting a draft is housekeeping, not a
        # retraction. Only the draft images go with it.
        for path in CHRONICLE_IMAGES_DIR.glob(f"{chronicle_id}-*.png"):
            try:
                path.unlink()
            except OSError:
                pass
        return jsonify({"ok": True, "id": chronicle_id, "deleted": True})
    return jsonify({
        "chronicle": _chronicle_payload(row, include_draft=True, include_context=True)
    })


@bp.route("/api/admin/chronicles/<chronicle_id>/save", methods=["POST"])
def admin_chronicle_save(chronicle_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
        if not row:
            return jsonify({"error": "Chronicle not found"}), 404

        fields = {"title": str(body.get("title") or row["title"] or "").strip()[:160]}
        fields["draft_summary"] = str(
            body.get("summary") if body.get("summary") is not None else (row["draft_summary"] or "")
        ).strip()[:300]
        fields["recap"] = str(
            body.get("recap") if body.get("recap") is not None else (row["recap"] or "")
        ).strip()[:600]
        fields["draft_markdown"] = str(
            body.get("markdown") if body.get("markdown") is not None else (row["draft_markdown"] or "")
        ).strip()
        fields["slug"] = _slugify(body.get("slug") or row["slug"] or fields["title"])
        if body.get("session_number") is not None:
            fields["session_number"] = str(body.get("session_number")).strip()[:60]

        if isinstance(body.get("art"), list):
            fields["art_json"] = json.dumps(
                _merge_chronicle_art(_json_loads(row["art_json"], []), body["art"]),
                separators=(",", ":"),
            )
        if isinstance(body.get("updates"), list):
            fields["updates_json"] = json.dumps(
                _merge_chronicle_updates(_json_loads(row["updates_json"], []), body["updates"]),
                separators=(",", ":"),
            )
        if isinstance(body.get("open_threads"), list):
            fields["threads_json"] = json.dumps(
                _sanitize_chronicle_threads(body["open_threads"]), separators=(",", ":")
            )
        if isinstance(body.get("in_play"), list):
            fields["in_play_json"] = json.dumps(
                _sanitize_chronicle_in_play(body["in_play"]), separators=(",", ":")
            )

        _chronicle_touch(conn, chronicle_id, **fields)
        updated = _chronicle_row(conn, chronicle_id)
    return jsonify({"ok": True, "chronicle": _chronicle_payload(updated)})


def _merge_chronicle_art(existing, incoming):
    """The console may edit a caption, a prompt, a style, or drop an image.
    It may not invent a slot or claim a generated file — those come from the
    pipeline, and a client-supplied filename would serve arbitrary bytes."""
    by_slot = {int(item.get("slot") or 0): item for item in existing}
    for item in incoming:
        if not isinstance(item, dict):
            continue
        try:
            slot = int(item.get("slot"))
        except (TypeError, ValueError):
            continue
        target = by_slot.get(slot)
        if not target:
            continue
        if item.get("caption") is not None:
            target["caption"] = str(item["caption"]).strip()[:220]
        if item.get("prompt") is not None:
            target["prompt"] = str(item["prompt"]).strip()[:1800]
        style = str(item.get("style") or "").strip().lower()
        if style in ART_STYLE_PRESETS:
            target["style"] = style
        if item.get("dropped") is not None:
            target["dropped"] = bool(item["dropped"])
    return [by_slot[slot] for slot in sorted(by_slot)]


def _merge_chronicle_updates(existing, incoming):
    """Approvals and edits to proposed wiki changes. The action, the target,
    and the kind are fixed at draft time: they were validated against the real
    page list then, and re-accepting them here would reopen that gate."""
    by_id = {item.get("id"): item for item in existing}
    for item in incoming:
        if not isinstance(item, dict):
            continue
        target = by_id.get(item.get("id"))
        if not target:
            continue
        if item.get("approved") is not None:
            target["approved"] = bool(item["approved"])
        if item.get("markdown") is not None:
            target["markdown"] = str(item["markdown"]).strip()[:20000]
        if item.get("section") is not None and target.get("action") == "append":
            target["section"] = str(item["section"]).strip()[:120] or "Aftermath"
        if item.get("title") is not None:
            target["title"] = str(item["title"]).strip()[:160]
        if item.get("summary") is not None and target.get("action") == "create":
            target["summary"] = str(item["summary"]).strip()[:300]
    return [by_id[key] for key in by_id]


@bp.route("/api/admin/chronicles/<chronicle_id>/draft", methods=["POST"])
@limiter.limit("20/hour")
def admin_chronicle_redraft(chronicle_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
        if not row:
            return jsonify({"error": "Chronicle not found"}), 404
        if row["status"] in {"researching", "drafting", "illustrating"}:
            return jsonify({"error": "This chronicle is already being drafted"}), 409
        fields = {}
        if body.get("notes") is not None:
            notes = str(body["notes"]).strip()
            if len(notes) < 40:
                return jsonify({"error": "The notes are too short to draft from"}), 400
            fields["raw_notes"] = notes
        if body.get("art_count") is not None:
            try:
                fields["art_count"] = max(0, min(int(body["art_count"]), CHRONICLE_MAX_ART))
            except (TypeError, ValueError):
                pass
        if fields:
            _chronicle_touch(conn, chronicle_id, **fields)
    _start_chronicle_job(chronicle_id, redraw_art=body.get("redraw_art", True) is not False)
    return jsonify({"ok": True, "id": chronicle_id, "status": "queued"}), 202


@bp.route("/api/admin/chronicles/<chronicle_id>/art/<int:slot>", methods=["GET"])
def admin_chronicle_art_image(chronicle_id, slot):
    """Draft art is DM material and lives outside the site tree, so it is
    served through the same gate as everything else here rather than from a
    public directory."""
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    if not CHRONICLE_ID_RE.match(chronicle_id or ""):
        abort(404)
    if not CHRONICLE_IMAGES_DIR.exists():
        abort(404)
    return send_from_directory(
        CHRONICLE_IMAGES_DIR, f"{chronicle_id}-{int(slot)}.png", max_age=60
    )


@bp.route("/api/admin/chronicles/<chronicle_id>/art/<int:slot>", methods=["POST"])
# Metered separately from drafting: regenerating one image should not spend
# the budget for a whole redraft.
@limiter.limit("60/hour")
def admin_chronicle_art_redraw(chronicle_id, slot):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
        if not row:
            return jsonify({"error": "Chronicle not found"}), 404
        art_items = _json_loads(row["art_json"], [])
    if not any(int(item.get("slot") or 0) == slot for item in art_items):
        return jsonify({"error": f"No art moment {slot} on this chronicle"}), 404
    _start_chronicle_art_job(
        chronicle_id, slot,
        prompt=body.get("prompt"),
        style=(body.get("style") or "").strip().lower() or None,
    )
    return jsonify({"ok": True, "id": chronicle_id, "slot": slot, "status": "pending"}), 202


@bp.route("/api/admin/chronicles/<chronicle_id>/publish", methods=["POST"])
def admin_chronicle_publish(chronicle_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    payload, status = _publish_chronicle(chronicle_id, request.get_json(silent=True) or {})
    return jsonify(payload), status


__all__ = [
    'CHRONICLE_ID_RE', '_chronicle_creator', 'admin_chronicles',
    'admin_chronicle_detail', 'admin_chronicle_save', '_merge_chronicle_art',
    '_merge_chronicle_updates', 'admin_chronicle_redraft', 'admin_chronicle_art_image',
    'admin_chronicle_art_redraw',
    'admin_chronicle_publish',
]
