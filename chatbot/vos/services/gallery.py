from ..imports import *
from ..symbols import *
from ..config import *

# ── Art Studio gallery storage ───────────────────────────────────────────────
# All persistence lives behind a manifest file + an images directory on the
# mounted volume. Concurrent writes between gunicorn workers are serialized
# with fcntl.flock — the manifest is small (one JSON list, ~200 bytes per
# entry) so reading/writing it whole is fine well past 10k entries.

def _ensure_gallery_dirs():
    GALLERY_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _load_manifest():
    """Read the manifest. Returns [] if missing or malformed."""
    try:
        with open(GALLERY_MANIFEST, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_manifest_atomic(entries):
    """Replace the manifest atomically so a crash mid-write can't corrupt it."""
    _ensure_gallery_dirs()
    tmp = GALLERY_MANIFEST.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, separators=(",", ":"))
    os.replace(tmp, GALLERY_MANIFEST)


def _gallery_lock_path():
    return GALLERY_MANIFEST.parent / ".manifest.lock"


def _gallery_entry_visibility(entry):
    visibility = str((entry or {}).get("visibility") or "").strip().lower()
    if visibility in {"private", "shared"}:
        return visibility
    # Backward compatibility: art generated before privacy existed was shown
    # in the group gallery, so missing visibility remains shared.
    return "shared"


def _gallery_entry_is_shared(entry):
    return _gallery_entry_visibility(entry) == "shared"


def _gallery_entry_creator(entry):
    return str((entry or {}).get("created_by") or "").strip()


def _gallery_viewer_context():
    """Return (player_name, is_dm) for the current request, if authenticated.

    Player auth uses the PWA bearer token or auth cookie. The Google DM session
    path is kept for older admin clients, but Studio normally uses player auth.
    """
    payload = _verify_player_token_payload(_extract_player_token())
    if payload:
        name = str(payload.get("name") or "").strip()
        return name, bool(payload.get("is_dm") or _is_dm_player(name))

    email = None
    if _admin_auth_configured():
        email, _reason = _verify_session_jwt(_extract_bearer_token())
    if email:
        return f"DM ({email})", True

    if not _auth_login_required():
        name = _player_name_from_request()
        return name, _is_dm_player(name)

    return "", False


def _gallery_can_view(entry, viewer_name=None, viewer_is_dm=False):
    if _gallery_entry_is_shared(entry):
        return True
    if viewer_is_dm:
        return True
    creator = _gallery_entry_creator(entry)
    return bool(creator and viewer_name and creator == viewer_name)


def _gallery_can_share(entry, viewer_name=None, viewer_is_dm=False):
    if viewer_is_dm:
        return True
    creator = _gallery_entry_creator(entry)
    return bool(creator and viewer_name and creator == viewer_name)


def _gallery_public_payload(entry, viewer_name=None, viewer_is_dm=False):
    visibility = _gallery_entry_visibility(entry)
    creator = _gallery_entry_creator(entry)
    can_share = _gallery_can_share(entry, viewer_name, viewer_is_dm)
    return {
        "id": entry["id"],
        "image_url": f"/api/gallery/image/{entry['filename']}",
        "title": _gallery_entry_title(entry),
        "prompt": entry.get("prompt", ""),
        "enhanced_prompt": entry.get("enhanced_prompt"),
        "grounded_in": entry.get("grounded_in") or [],
        "style": entry.get("style"),
        "created_by": creator or None,
        "created_at": entry.get("created_at"),
        "model": entry.get("model"),
        "visibility": visibility,
        "is_shared": visibility == "shared",
        "shared_at": entry.get("shared_at"),
        "can_share": can_share,
        "can_delete": bool(viewer_is_dm),
    }


def _find_gallery_entry(entries, gallery_id):
    return next((e for e in entries if e.get("id") == gallery_id), None)


def _set_gallery_visibility(gallery_id, visibility, actor):
    visibility = "shared" if visibility == "shared" else "private"
    now = _utc_now_iso()
    _ensure_gallery_dirs()
    with open(_gallery_lock_path(), "a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            entries = _load_manifest()
            entry = _find_gallery_entry(entries, gallery_id)
            if not entry:
                return None
            entry["visibility"] = visibility
            if visibility == "shared":
                entry["shared_at"] = entry.get("shared_at") or now
                entry["shared_by"] = (actor or "")[:96] or None
            else:
                entry["shared_at"] = None
                entry["shared_by"] = None
            _write_manifest_atomic(entries)
            return dict(entry)
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _save_gallery_entry(
    image_bytes, prompt, full_prompt, style_key, created_by, model,
    enhanced_prompt=None, grounded_in=None, title=None, compiler=None,
):
    """Persist a generated image + append to the manifest.

    Returns the new manifest entry on success, or None on disk failure
    (in which case the caller should still return the image to the client —
    persistence is a "nice to have," not a hard requirement).
    """
    try:
        _ensure_gallery_dirs()
        now = datetime.now(timezone.utc)
        slug = now.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(4)
        filename = f"{slug}.png"
        path = GALLERY_IMAGES_DIR / filename
        with open(path, "wb") as f:
            f.write(image_bytes)

        entry = {
            "id": slug,
            "filename": filename,
            "created_at": now.isoformat(),
            "title": (title or "")[:220] or None,
            "prompt": prompt[:1000],
            "enhanced_prompt": (enhanced_prompt or "")[:2000] or None,
            "grounded_in": list(grounded_in or [])[:8],
            "full_prompt": full_prompt[:2400],
            "style": style_key,
            "created_by": (created_by or "").strip()[:64] or None,
            "model": model,
            # Which prompt compiler wrote the scene, so two pieces made the
            # same week can be told apart when comparing the providers.
            "compiler": compiler,
            "visibility": "private",
            "shared_at": None,
            "shared_by": None,
        }

        # Append under a coarse lock so concurrent workers don't trample
        # each other's manifests. We re-read inside the lock to pick up any
        # entries another worker wrote since we last loaded.
        with open(_gallery_lock_path(), "a+") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
                entries = _load_manifest()
                entries.append(entry)
                # Trim to the cap, keeping most recent.
                if len(entries) > GALLERY_MAX_ENTRIES:
                    overflow = entries[: len(entries) - GALLERY_MAX_ENTRIES]
                    entries = entries[-GALLERY_MAX_ENTRIES:]
                    # Best-effort cleanup of expired image files.
                    for old in overflow:
                        try:
                            (GALLERY_IMAGES_DIR / old["filename"]).unlink()
                        except OSError:
                            pass
                _write_manifest_atomic(entries)
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

        return entry
    except Exception:
        logging.exception("Failed to persist gallery entry")
        return None

__all__ = ['_ensure_gallery_dirs', '_load_manifest', '_write_manifest_atomic', '_gallery_lock_path', '_gallery_entry_visibility', '_gallery_entry_is_shared', '_gallery_entry_creator', '_gallery_viewer_context', '_gallery_can_view', '_gallery_can_share', '_gallery_public_payload', '_find_gallery_entry', '_set_gallery_visibility', '_save_gallery_entry']
