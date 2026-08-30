from ..imports import *
from ..symbols import *
from ..config import *

def _studio_prompt_from_body(body):
    prompt = body.get("prompt", "")
    if not prompt or not isinstance(prompt, str):
        return None, ({"error": "Invalid prompt"}, 400)
    prompt = prompt.strip()
    if len(prompt) > 3500:
        return None, ({"error": "Prompt too long (max 3500 chars)"}, 400)
    return prompt, None


def _studio_style_from_body(body):
    style_key = (body.get("style") or "").strip().lower() or None
    if style_key and style_key not in ART_STYLE_PRESETS:
        return None, ({
            "error": f"Unknown style '{style_key}'. See /api/art-styles."
        }, 400)
    return style_key, None


def _studio_enhance_from_body(body):
    enhance = body.get("enhance", True)
    return enhance if isinstance(enhance, bool) else bool(enhance)


def _studio_creator_from_body(body, required=True, require_login=False):
    requested_creator = body.get("creator", body.get("created_by", ""))
    if not isinstance(requested_creator, str):
        requested_creator = ""
    requested_creator = requested_creator.strip()[:64]
    auth_body = dict(body)
    if not any(auth_body.get(k) for k in ("name", "playerName", "player_name")):
        auth_body["name"] = requested_creator
    auth_fn = _logged_in_player_name if require_login else _authenticated_player_name
    created_by, auth_error = auth_fn(auth_body)
    if auth_error:
        return None, auth_error
    created_by = (created_by or requested_creator or "").strip()[:64]
    if not created_by and required:
        return None, ({"error": "Missing creator"}, 400)
    return created_by, None


def _generate_image_payload(
    prompt, style_key, created_by, enhance=True,
    save_gallery=True, image_output_path=None,
):
    openai_key = os.environ.get("OPENAI_KEY", "")
    image_model = IMAGE_MODEL
    legacy_style_prefix = os.environ.get("IMAGE_STYLE_PROMPT", "").strip()
    image_quality = os.environ.get("IMAGE_QUALITY", "high")
    image_size = os.environ.get("IMAGE_SIZE", "1024x1024")

    if not openai_key:
        return {
            "error": "Image generation not configured — OPENAI_KEY missing in server env"
        }, 503

    # Resolve the style prefix. Explicit `style` from the body wins; if none
    # provided, fall back to the legacy env var so existing /art chatbot
    # callers keep working unchanged.
    if style_key:
        style_prefix = ART_STYLE_PRESETS[style_key]["prefix"]
        style_label = style_key
    elif legacy_style_prefix:
        style_prefix = legacy_style_prefix
        style_label = "legacy"
    else:
        style_prefix = ""
        style_label = None

    # Resolve campaign references regardless of whether the player wants the
    # LLM rewrite. The rewrite is optional; canonical visual locking is cheap
    # and should still protect named characters from model drift.
    enhanced_prompt = None
    matched = _extract_campaign_entities(prompt)
    grounded_in = _grounded_entity_names(matched)
    if enhance:
        result = _enhance_image_prompt(prompt, style_key, matched)
        if isinstance(result, dict):
            enhanced_prompt = result.get("prompt")
            grounded_in = result.get("grounded_in") or []
    if matched and not grounded_in:
        grounded_in = _grounded_entity_names(matched)

    # The text we actually send to OpenAI is: style prefix + enhanced (or
    # raw) prompt, with matched curated visual references pinned between the
    # style and scene text. Keep the original raw prompt around for the gallery
    # so human readers see what the player typed, not the rewrite.
    image_prompt_body = enhanced_prompt or prompt
    full_prompt = _compose_final_image_prompt(style_prefix, image_prompt_body, matched)

    payload = {
        "model": image_model,
        "prompt": full_prompt,
        "size": image_size,
        "n": 1,
    }
    # gpt-image-1 supports a `quality` knob (low/medium/high/auto) and
    # always returns b64_json (it rejects response_format entirely). Older
    # dall-e-* models don't take `quality` but DO return URLs by default —
    # we fetch those URLs further down so persistence still works.
    if image_model.startswith("gpt-image"):
        payload["quality"] = image_quality

    try:
        r = http_requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=540,
        )
        if r.status_code >= 400:
            logging.warning("OpenAI image gen %s: %s", r.status_code, r.text[:300])
            return {
                "error": "Image generation failed",
                "details": r.text[:300],
            }, r.status_code

        data = r.json()
        item = (data.get("data") or [{}])[0]
        b64 = item.get("b64_json")
        url = item.get("url")

        # If we got a URL but no b64 (older DALL·E models), fetch the bytes so
        # we can persist them. Best effort — if this fails we still return the
        # URL to the client.
        image_bytes = None
        if b64:
            try:
                image_bytes = base64.b64decode(b64)
            except (ValueError, TypeError):
                logging.warning("Could not decode b64 image data")
        elif url:
            try:
                img_resp = http_requests.get(url, timeout=60)
                if img_resp.status_code == 200:
                    image_bytes = img_resp.content
            except Exception:
                logging.warning("Could not fetch image URL for persistence")

        image_saved_path = None
        if image_bytes and image_output_path:
            try:
                image_output_path = Path(image_output_path)
                image_output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(image_output_path, "wb") as f:
                    f.write(image_bytes)
                image_saved_path = str(image_output_path)
            except Exception:
                logging.exception("Failed to persist generated image to %s", image_output_path)

        image_title = _generate_image_title(prompt, enhanced_prompt, grounded_in)
        gallery_entry = None
        if image_bytes and save_gallery:
            gallery_entry = _save_gallery_entry(
                image_bytes=image_bytes,
                prompt=prompt,
                full_prompt=full_prompt,
                style_key=style_label,
                created_by=created_by,
                model=image_model,
                enhanced_prompt=enhanced_prompt,
                grounded_in=grounded_in,
                title=image_title,
            )

        response = {
            "url": url,
            "b64": b64,
            "prompt": full_prompt,
            "raw_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
            "grounded_in": grounded_in,
            "title": image_title,
            "model": image_model,
            "style": style_label,
            "image_saved": bool(image_saved_path),
        }
        if gallery_entry:
            response["gallery"] = {
                "id": gallery_entry["id"],
                "title": _gallery_entry_title(gallery_entry),
                "image_url": f"/api/gallery/image/{gallery_entry['filename']}",
                "created_at": gallery_entry["created_at"],
                "visibility": _gallery_entry_visibility(gallery_entry),
                "is_shared": _gallery_entry_is_shared(gallery_entry),
            }
        return response, 200
    except Exception as e:
        logging.exception("Image generation error")
        return {"error": "Image generation failed", "details": str(e)}, 500


def _infer_studio_error_code(error_message):
    """Map a free-text job error to one of the client-side error_code
    buckets (quota / api_error / invalid_prompt / unknown). Lets the UI
    pick the right human copy without a separate column."""
    if not error_message:
        return None
    text = str(error_message).lower()
    if "quota" in text or "monthly limit" in text or "rate limit" in text:
        return "quota"
    if "openai_key" in text or "not configured" in text:
        return "api_error"
    if "content policy" in text or "moderation" in text or "rejected" in text:
        return "invalid_prompt"
    if "openai" in text or "image generation failed" in text or "timeout" in text:
        return "api_error"
    return "unknown"


def _studio_job_payload(row):
    return {
        "id": row["id"],
        "jobId": row["id"],
        "creator": row["creator"],
        "title": row["title"],
        "prompt": row["prompt"],
        "enhanced_prompt": row["enhanced_prompt"],
        "style": row["style"],
        "status": row["status"],
        "result_url": row["result_url"],
        "gallery_id": row["gallery_id"],
        "error_message": row["error_message"],
        "error_code": _infer_studio_error_code(row["error_message"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _update_studio_job(
    job_id, status, result_url=None, error_message=None,
    enhanced_prompt=None, gallery_id=None, title=None,
):
    with _app_db() as conn:
        conn.execute("""
            UPDATE studio_jobs
            SET status = ?,
                result_url = ?,
                error_message = ?,
                enhanced_prompt = COALESCE(?, enhanced_prompt),
                gallery_id = COALESCE(?, gallery_id),
                title = COALESCE(?, title),
                updated_at = ?
            WHERE id = ?
        """, (
            status,
            result_url,
            error_message,
            enhanced_prompt,
            gallery_id,
            title,
            _utc_now_iso(),
            job_id,
        ))


def _studio_period():
    """Current quota period key ('YYYY-MM' in UTC). Quotas roll over on
    the 1st of each month."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _studio_period_reset_iso():
    """First day of the next period as an ISO date the client can render
    ("June 1, 2026"). Used in the 429 quota response."""
    now = datetime.now(timezone.utc)
    year = now.year + (1 if now.month == 12 else 0)
    month = 1 if now.month == 12 else now.month + 1
    return f"{year:04d}-{month:02d}-01"


def _studio_quota_count(player, period=None):
    period = period or _studio_period()
    with _app_db() as conn:
        row = conn.execute("""
            SELECT count FROM studio_quotas
            WHERE player = ? AND period = ?
        """, (player, period)).fetchone()
    return int(row["count"]) if row else 0


def _studio_quota_consume(player):
    """Increment this player's count for the current period. Returns the
    new total."""
    period = _studio_period()
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO studio_quotas (player, period, count, updated_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(player, period) DO UPDATE SET
                count = count + 1,
                updated_at = excluded.updated_at
        """, (player, period, now))
        row = conn.execute(
            "SELECT count FROM studio_quotas WHERE player = ? AND period = ?",
            (player, period),
        ).fetchone()
    return int(row["count"]) if row else 0


def _notify_art_ready(creator, result_url, gallery_id=None):
    if _push_config_error():
        return
    # Deep-link straight to the same lightbox a gallery click opens.
    # Studio reads ?image=<id> on load and opens the matching entry; if
    # nothing matches (image already deleted, etc.), it falls back to
    # the private library grid.
    if gallery_id:
        target_url = f"/en/Tools/art/?gallery=mine&image={gallery_id}"
    else:
        target_url = result_url or "/en/Tools/art/"
    try:
        _fanout_push(
            "Your Vallombrosa art is ready",
            "Your Studio piece has finished in your private library.",
            target_url,
            recipients=[creator],
        )
    except Exception:
        logging.exception("Art-ready push failed")


def _run_studio_job(job_id, prompt, style_key, creator, enhance):
    try:
        data, status = _generate_image_payload(prompt, style_key, creator, enhance)
        if status >= 400:
            error = data.get("error") or "Image generation failed"
            details = data.get("details")
            if details:
                error = f"{error}: {details}"
            _update_studio_job(job_id, "error", error_message=error[:500])
            return

        result_url = None
        gallery = data.get("gallery") or {}
        if gallery.get("image_url"):
            result_url = gallery["image_url"]
        elif data.get("url"):
            result_url = data["url"]

        if not result_url:
            _update_studio_job(job_id, "error", error_message="Image generation finished without an image URL.")
            return

        _update_studio_job(
            job_id,
            "done",
            result_url=result_url,
            enhanced_prompt=data.get("enhanced_prompt"),
            gallery_id=gallery.get("id"),
            title=data.get("title") or gallery.get("title"),
        )
        _notify_art_ready(creator, result_url, gallery_id=gallery.get("id"))
    except Exception as exc:
        logging.exception("Studio job failed")
        _update_studio_job(job_id, "error", error_message=str(exc)[:500])

__all__ = ['_studio_prompt_from_body', '_studio_style_from_body', '_studio_enhance_from_body', '_studio_creator_from_body', '_generate_image_payload', '_infer_studio_error_code', '_studio_job_payload', '_update_studio_job', '_studio_period', '_studio_period_reset_iso', '_studio_quota_count', '_studio_quota_consume', '_notify_art_ready', '_run_studio_job']
