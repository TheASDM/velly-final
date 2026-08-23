from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("gallery", __name__)

@bp.route("/api/gallery", methods=["GET"])
def list_gallery():
    """List gallery entries, most-recent first.

    Query params:
        limit   — max entries to return (default 60, capped at 200)
        offset  — pagination offset (default 0)
        scope   — shared (default), mine, private, or all (DM only)
    """
    try:
        limit = int(request.args.get("limit", GALLERY_PAGE_LIMIT))
    except (TypeError, ValueError):
        limit = GALLERY_PAGE_LIMIT
    try:
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    favorites_only = request.args.get("favorites") == "1"
    raw_scope = (request.args.get("scope") or "").strip().lower()
    scope = raw_scope if raw_scope in {"shared", "mine", "private", "all"} else "shared"
    if favorites_only and not raw_scope:
        scope = "visible"

    viewer_name, viewer_is_dm = _gallery_viewer_context()

    favorite_ids = None
    if favorites_only:
        if _auth_login_required():
            player, auth_error = _logged_in_player_name()
            if auth_error:
                return auth_error
        else:
            player = _player_name_from_request()
        if not player:
            return jsonify({
                "total": 0,
                "offset": offset,
                "limit": limit,
                "scope": scope,
                "entries": [],
            })
        viewer_name = player
        viewer_is_dm = viewer_is_dm or _is_dm_player(player)
        with _app_db() as conn:
            rows = conn.execute(
                "SELECT gallery_id FROM gallery_favorites WHERE player = ?",
                (player,),
            ).fetchall()
        favorite_ids = {row["gallery_id"] for row in rows}

    entries = list(reversed(_load_manifest()))  # newest first

    if favorite_ids is not None:
        entries = [e for e in entries if e.get("id") in favorite_ids]

    if scope == "mine":
        if not viewer_name:
            return jsonify({"error": "Login required", "error_code": "auth"}), 401
        entries = [e for e in entries if _gallery_entry_creator(e) == viewer_name]
    elif scope == "private":
        if not viewer_name:
            return jsonify({"error": "Login required", "error_code": "auth"}), 401
        entries = [
            e for e in entries
            if _gallery_entry_creator(e) == viewer_name and not _gallery_entry_is_shared(e)
        ]
    elif scope == "all":
        if not viewer_is_dm:
            return jsonify({"error": "DM access required", "error_code": "auth"}), 403
    elif scope == "visible":
        entries = [
            e for e in entries
            if _gallery_can_view(e, viewer_name, viewer_is_dm)
        ]
    else:
        scope = "shared"
        entries = [e for e in entries if _gallery_entry_is_shared(e)]

    page = entries[offset:offset + limit]

    # Don't leak `full_prompt` (it includes the style prefix; not useful to
    # the UI and longer than necessary). Return public-safe fields only.
    public = [
        _gallery_public_payload(e, viewer_name, viewer_is_dm)
        for e in page
        if _gallery_can_view(e, viewer_name, viewer_is_dm)
    ]
    return jsonify({
        "total": len(entries),
        "offset": offset,
        "limit": limit,
        "scope": scope,
        "entries": public,
    })


@bp.route("/api/descriptions", methods=["GET"])
def list_descriptions():
    """Return the names known to the prompt enhancer (descriptions.json),
    grouped by category. Used by the Studio's 'Available references'
    panel so players can see what entities they can mention without
    describing them visually."""
    data, _index = _load_descriptions_data()
    if not data:
        return jsonify({"categories": []})

    category_labels = {
        "player_characters": "Player Characters",
        "npcs": "NPCs",
        "locations": "Locations",
        "items": "Items",
        "groups": "Groups",
    }
    categories = []
    for key, raw in data.items():
        if key.startswith("_") or not isinstance(raw, dict):
            continue
        names = sorted(raw.keys(), key=str.lower)
        categories.append({
            "key": key,
            "label": category_labels.get(key, key.replace("_", " ").title()),
            "entries": names,
        })
    return jsonify({"categories": categories})


@bp.route("/api/gallery/<gallery_id>/favorite", methods=["POST", "DELETE"])
def gallery_favorite(gallery_id):
    """Toggle a per-player favorite on a gallery entry. POST stars,
    DELETE unstars. The favorite row is keyed by (player, gallery_id);
    a row whose gallery_id no longer exists in the manifest is left
    dangling and ignored client-side at render time."""
    if _auth_login_required():
        player, auth_error = _logged_in_player_name()
        if auth_error:
            return auth_error
    else:
        player = _player_name_from_request()
    if not player:
        return jsonify({"error": "Player name required", "error_code": "auth"}), 400

    entries = _load_manifest()
    entry = _find_gallery_entry(entries, gallery_id)
    viewer_name, viewer_is_dm = _gallery_viewer_context()
    if entry and player:
        viewer_name = player
        viewer_is_dm = viewer_is_dm or _is_dm_player(player)

    if request.method == "POST":
        if not entry or not _gallery_can_view(entry, viewer_name, viewer_is_dm):
            return jsonify({"error": "Gallery image not found", "error_code": "not_found"}), 404
        with _app_db() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO gallery_favorites
                    (player, gallery_id, favorited_at)
                VALUES (?, ?, ?)
            """, (player, gallery_id, _utc_now_iso()))
        return jsonify({"ok": True, "favorited": True})

    with _app_db() as conn:
        conn.execute("""
            DELETE FROM gallery_favorites
            WHERE player = ? AND gallery_id = ?
        """, (player, gallery_id))
    return jsonify({"ok": True, "favorited": False})


@bp.route("/api/gallery/favorites", methods=["GET"])
def gallery_favorites_list():
    """Return the set of gallery_ids the named player has favorited.
    Cheap O(rows) — gallery is small. The client merges this with the
    gallery list to render the heart state on each card."""
    if _auth_login_required():
        player, auth_error = _logged_in_player_name()
        if auth_error:
            return auth_error
    else:
        player = _player_name_from_request()
    if not player:
        return jsonify({"ids": []})
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT gallery_id FROM gallery_favorites
            WHERE player = ?
            ORDER BY favorited_at DESC
        """, (player,)))
    favorite_ids = [r["gallery_id"] for r in rows]
    if not favorite_ids:
        return jsonify({"ids": []})

    entries = _load_manifest()
    by_id = {e.get("id"): e for e in entries}
    viewer_name, viewer_is_dm = _gallery_viewer_context()
    viewer_name = player
    viewer_is_dm = viewer_is_dm or _is_dm_player(player)
    visible_ids = [
        gallery_id for gallery_id in favorite_ids
        if by_id.get(gallery_id) and _gallery_can_view(by_id[gallery_id], viewer_name, viewer_is_dm)
    ]
    return jsonify({"ids": visible_ids})


@bp.route("/api/gallery/<gallery_id>/share", methods=["POST", "DELETE"])
def gallery_share(gallery_id):
    """Publish or unpublish one gallery image.

    POST makes the image visible in the shared group gallery. DELETE returns
    it to creator+DM visibility. The image creator or a signed-in DM can act.
    """
    entries = _load_manifest()
    entry = _find_gallery_entry(entries, gallery_id)
    if not entry:
        return jsonify({"error": "Gallery image not found", "error_code": "not_found"}), 404

    viewer_name, viewer_is_dm = _gallery_viewer_context()
    if not _gallery_can_share(entry, viewer_name, viewer_is_dm):
        return jsonify({
            "error": "Only the image creator or DM can change sharing.",
            "error_code": "auth",
        }), 403

    visibility = "shared" if request.method == "POST" else "private"
    actor = viewer_name or getattr(request, "dm_email", "") or "DM"
    updated = _set_gallery_visibility(gallery_id, visibility, actor)
    if not updated:
        return jsonify({"error": "Gallery image not found", "error_code": "not_found"}), 404
    return jsonify({
        "ok": True,
        "entry": _gallery_public_payload(updated, viewer_name, viewer_is_dm),
    })


@bp.route("/api/gallery/<gallery_id>/pin", methods=["POST"])
def gallery_pin(gallery_id):
    """Append a gallery image to a wiki page's ## Gallery section.

    Body: { "wiki_url": "/en/Venturia/Items/the-listener-s-coin/" }

    Auth: the image's creator (matched against the logged-in player) or
    a signed-in DM. Either authenticates by the usual flows — the player
    auth token in Authorization for the creator path, the DM session
    JWT in Authorization for the DM path. The wiki_url must resolve to
    an existing source markdown file under SITE_SOURCE_DIR. Pinning the
    same image twice is a no-op (idempotent on image URL)."""
    body = request.get_json(silent=True) or {}
    wiki_url = (body.get("wiki_url") or "").strip()
    if not wiki_url:
        return jsonify({"error": "wiki_url is required", "error_code": "invalid"}), 400

    # Look up the gallery entry by id from the manifest.
    entries = _load_manifest()
    entry = next((e for e in entries if e.get("id") == gallery_id), None)
    if not entry:
        return jsonify({"error": "Gallery image not found", "error_code": "not_found"}), 404

    # Auth: image creator OR signed-in DM.
    actor, actor_is_dm = _gallery_viewer_context()
    if not _gallery_can_share(entry, actor, actor_is_dm):
        return jsonify({
            "error": "Only the image creator or a signed-in DM can pin this image.",
            "error_code": "auth",
        }), 403
    actor = actor or "DM"

    source_path = _wiki_url_to_source_path(wiki_url)
    if not source_path:
        return jsonify({
            "error": f"No wiki page found at {wiki_url}",
            "error_code": "not_found",
        }), 404

    # Resolve the absolute image URL the wiki page should embed. The
    # gallery filename lives under /api/gallery/image/<filename>.
    filename = entry.get("filename")
    if not filename:
        return jsonify({"error": "Gallery entry has no filename", "error_code": "invalid"}), 500

    # A wiki page is visible to the table, so the pinned image must be shared
    # too. The user's pin action is the explicit publication step.
    if not _gallery_entry_is_shared(entry):
        entry = _set_gallery_visibility(gallery_id, "shared", actor) or entry

    image_url = f"/api/gallery/image/{filename}"
    alt_text = _gallery_entry_title(entry) or "Pinned from the Studio"

    try:
        modified = _append_image_to_wiki_gallery(
            source_path, image_url, alt_text, gallery_id, actor
        )
    except Exception as exc:
        logging.exception("Failed to pin gallery image to wiki")
        return jsonify({"error": str(exc), "error_code": "api_error"}), 500

    return jsonify({
        "ok": True,
        "wiki_url": wiki_url,
        "source_file": str(source_path.relative_to(SITE_SOURCE_DIR)),
        "modified": modified,
        "already_pinned": not modified,
    })


@bp.route("/api/gallery/image/<path:filename>", methods=["GET"])
def gallery_image(filename):
    """Serve a single persisted gallery image."""
    # send_from_directory does its own safe-path validation against ..
    # and absolute-path tricks. We still check the manifest first because
    # private images must not be reachable by filename alone.
    if not GALLERY_IMAGES_DIR.exists():
        abort(404)
    entries = _load_manifest()
    entry = next((e for e in entries if e.get("filename") == filename), None)
    if not entry:
        abort(404)
    viewer_name, viewer_is_dm = _gallery_viewer_context()
    if not _gallery_can_view(entry, viewer_name, viewer_is_dm):
        abort(404)
    return send_from_directory(
        GALLERY_IMAGES_DIR,
        filename,
        max_age=3600,
    )


@bp.route("/api/gallery/<gallery_id>", methods=["DELETE"])
def gallery_delete(gallery_id):
    """Delete one gallery entry — DM-only.

    Removes both the PNG on disk and the manifest entry, under the same
    file lock that guards manifest writes so a concurrent /api/generate-image
    can't corrupt the JSON. Uses the real player/admin DM auth path.
    """
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    # Sanity-check the id shape — the manifest uses
    # YYYYMMDD-HHMMSS-<8 hex chars> so reject anything else without
    # touching the filesystem.
    if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[0-9a-f]{6,16}", gallery_id):
        return jsonify({"error": "Bad id"}), 400

    try:
        _ensure_gallery_dirs()
        with open(_gallery_lock_path(), "a+") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
                entries = _load_manifest()
                target = next((e for e in entries if e.get("id") == gallery_id), None)
                if not target:
                    return jsonify({"error": "Not found"}), 404
                kept = [e for e in entries if e.get("id") != gallery_id]
                _write_manifest_atomic(kept)
                # Best-effort image cleanup. If the file is already gone
                # the manifest has still been pruned, which is what matters.
                try:
                    (GALLERY_IMAGES_DIR / target["filename"]).unlink()
                except (OSError, KeyError):
                    pass
                return jsonify({
                    "ok": True,
                    "deleted_id": gallery_id,
                    "remaining": len(kept),
                }), 200
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    except Exception:
        logging.exception("Gallery delete failed for %s", gallery_id)
        return jsonify({"error": "Delete failed"}), 500

__all__ = ['list_gallery', 'list_descriptions', 'gallery_favorite', 'gallery_favorites_list', 'gallery_share', 'gallery_pin', 'gallery_image', 'gallery_delete']
