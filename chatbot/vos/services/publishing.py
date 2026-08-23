from ..imports import *
from ..symbols import *
from ..config import *

def _publish_lore_submission(submission_id, body):
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
    if not row:
        return {"error": "Submission not found"}, 404
    if row["status"] == "published" and not body.get("overwrite"):
        return {"error": "Submission is already published"}, 409

    kind = row["kind"]
    config = LORE_SUBMISSION_KINDS[kind]
    title = str(body.get("title") or row["title"]).strip()[:120]
    slug = _slugify(body.get("slug") or row["slug"] or title)
    summary = str(body.get("summary") or row["generated_summary"] or row["short_description"]).strip()[:300]
    markdown = str(body.get("markdown") or row["generated_markdown"] or "").strip()
    image_prompt = str(body.get("image_prompt") or row["generated_image_prompt"] or "").strip()

    if not title:
        return {"error": "Title is required"}, 400
    if not markdown:
        return {"error": "Draft markdown is empty"}, 400

    source_dir = SITE_SOURCE_DIR / config["source_dir"]
    source_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = source_dir / f"{slug}.md"
    if markdown_path.exists() and not body.get("overwrite"):
        return {
            "error": f"{config['label']} page already exists for slug '{slug}'",
            "path": str(markdown_path),
        }, 409

    image_url = _copy_draft_image(submission_id, kind, slug)
    connections = _json_loads(row["connections_json"], [])
    # DM can override card_fields via the publish body; otherwise we use
    # whatever the AI produced and stored at draft time.
    card_fields = _sanitize_card_fields(
        body.get("card_fields")
        if body.get("card_fields") is not None
        else _json_loads(row["generated_card_fields_json"], [])
    )
    body_markdown = _render_published_markdown(
        kind, title, summary, markdown, image_url, connections, image_prompt,
        card_fields=card_fields,
    )
    markdown_path.write_text(
        _page_frontmatter(title, summary, config["tags"]) + body_markdown,
        encoding="utf-8",
    )
    _chown_like_site(markdown_path)
    index_updated = _append_index_link(kind, title, slug, summary)
    descriptions_updated = _update_descriptions_json(kind, title, slug, summary, image_prompt)

    now = _utc_now_iso()
    card_fields_json = json.dumps(card_fields, separators=(",", ":"))
    with _app_db() as conn:
        conn.execute("""
            UPDATE lore_submissions
            SET title = ?, slug = ?, status = 'published',
                generated_markdown = ?, generated_summary = ?,
                generated_image_prompt = ?,
                generated_card_fields_json = ?,
                error_message = NULL,
                updated_at = ?, published_at = ?
            WHERE id = ?
        """, (title, slug, markdown, summary, image_prompt,
              card_fields_json, now, now, submission_id))

    auto_rebuild = body.get("auto_rebuild", True) is not False
    rebuild = None
    if auto_rebuild:
        rebuild = _start_rebuild_job(
            f"lore publish: {config['url_prefix']}/{slug}/",
            include_knowledge=AUTO_KNOWLEDGE_ON_WIKI_SAVE,
        )

    return {
        "ok": True,
        "id": submission_id,
        "title": title,
        "slug": slug,
        "path": str(markdown_path),
        "url": f"{config['url_prefix']}/{slug}/",
        "image_url": image_url,
        "index_updated": index_updated,
        "descriptions_updated": descriptions_updated,
        "rebuild": rebuild,
        "next_steps": [],
    }, 200

__all__ = ['_publish_lore_submission']
