"""Publishing a chronicle: the only place the chronicler writes to the wiki.

Everything the pipeline produced is a proposal until this runs, and this runs
only from a DM's explicit publish. Four things can happen here, and each of
them is separately refusable from the console:

  the chronicle page   Session-Chronicles/<slug>.md, with the art placed
                       where the drafter put its placeholders
  the index entry      a line in Session-Chronicles/index.md
  the wiki updates     appends to existing pages, and new pages created
                       through the lore pipeline's directory map
  the campaign state   _data/campaign-state.json, which the front page reads

Then one rebuild with knowledge on, because a chronicle Enzo has not indexed
is a chronicle Enzo will contradict.

Every write is confined the same way the wiki editor is confined: through
_wiki_url_to_source_path and _wiki_source_in_content_roots, never by string
concatenation onto a path the model supplied.
"""

from ..imports import *
from ..symbols import *
from ..config import *

CHRONICLE_INDEX_EMPTY_RE = re.compile(
    r"(?m)^No chronicles have been recorded yet\..*$\n?"
)


def _chronicle_image_rel(slug, slot):
    return f"{CHRONICLE_IMAGE_DIR}/{_slugify(slug)}-{int(slot)}.png"


def _copy_chronicle_images(chronicle_id, slug, art_items):
    """Move the finished draft images into the site's image tree. Returns the
    art list with a published `site_url` on everything that made it."""
    published = []
    for item in art_items or []:
        if item.get("status") != "done" or item.get("dropped"):
            continue
        source = _chronicle_art_path(chronicle_id, item.get("slot") or 0)
        if not source.exists():
            continue
        rel = _chronicle_image_rel(slug, item.get("slot") or 0)
        target = SITE_SOURCE_DIR / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        _chown_like_site(target)
        entry = dict(item)
        entry["site_url"] = f"/{rel}"
        published.append(entry)
    return published


def _chronicle_figure_markdown(item, title):
    alt = re.sub(r"[\[\]\n]", " ", str(item.get("caption") or title or "")).strip() or title
    figure = f"![{alt}]({item['site_url']})"
    caption = str(item.get("caption") or "").strip()
    if caption:
        figure += f"\n\n*{caption}*"
    return figure


def _place_chronicle_art(markdown, art_items, title):
    """Substitute {{ART:n}} with the image it names; anything left over goes
    to a Gallery at the end rather than being silently dropped."""
    body = str(markdown or "")
    by_slot = {int(item.get("slot") or 0): item for item in art_items}
    used = set()

    def _replace(match):
        try:
            slot = int(match.group(1))
        except ValueError:
            return ""
        item = by_slot.get(slot)
        if not item:
            return ""
        used.add(slot)
        return _chronicle_figure_markdown(item, title)

    body = CHRONICLE_ART_PLACEHOLDER_RE.sub(_replace, body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    leftovers = [item for slot, item in sorted(by_slot.items()) if slot not in used]
    if leftovers:
        gallery = "\n\n".join(
            _chronicle_figure_markdown(item, title) for item in leftovers
        )
        body += f"\n\n---\n\n## Gallery\n\n{gallery}"
    return body + "\n"


def _chronicle_tags(session_number):
    tags = ["session-chronicles", "chronicles", "venturia"]
    number = re.sub(r"[^a-z0-9]+", "-", str(session_number or "").lower()).strip("-")
    if number:
        tags.append(number)
    return ", ".join(tags)


def _update_chronicle_index(title, slug, summary, session_date, session_number):
    """Add the chronicle to the bound index, newest last, and clear the
    "nothing yet" line the first time something lands."""
    index_path = SITE_SOURCE_DIR / CHRONICLE_INDEX
    if not index_path.exists():
        return False
    try:
        text = index_path.read_text(encoding="utf-8")
    except OSError:
        logging.exception("Could not read the chronicle index")
        return False

    page_url = f"{CHRONICLE_URL_PREFIX}/{slug}/"
    label_bits = [bit for bit in (session_number, session_date) if bit]
    label = f" ({' · '.join(label_bits)})" if label_bits else ""
    bullet = f"- **[{title}]({page_url})**{label} — {(summary or '').strip()[:220]}"

    text = CHRONICLE_INDEX_EMPTY_RE.sub("", text)
    text = _remove_index_link(text, page_url)
    text = _append_to_markdown_list(text, bullet)
    try:
        index_path.write_text(text, encoding="utf-8")
        _chown_like_site(index_path)
        return True
    except OSError:
        logging.exception("Could not write the chronicle index")
        return False


# ── Applying the proposed wiki updates ───────────────────────────────────────

def _apply_chronicle_append(update, chronicle_title, chronicle_url):
    """Append a section to an existing wiki page.

    The append is attributed inline. Six months from now the question about
    any paragraph on an NPC's page is "when did we learn this", and a line
    naming the session that added it answers it without a git blame.
    """
    source_path = _wiki_url_to_source_path(update.get("target_url") or "")
    if not source_path or not _wiki_source_in_content_roots(source_path):
        return {"ok": False, "error": f"No editable wiki page at {update.get('target_url')}"}

    section = str(update.get("section") or "Aftermath").strip()[:120]
    attribution = f"*From [{chronicle_title}]({chronicle_url}).*"
    block = f"{attribution}\n\n{update['markdown'].strip()}"

    try:
        text = source_path.read_text(encoding="utf-8")
    except OSError:
        logging.exception("Could not read %s", source_path)
        return {"ok": False, "error": "Could not read the target page"}

    # Idempotency: republishing the same chronicle must not stack the same
    # paragraph onto a page over and over.
    if update["markdown"].strip()[:200] in text:
        return {"ok": True, "skipped": "already present", "url": update.get("target_url")}

    updated = _append_to_named_markdown_section(text, section, block)
    frontmatter_error = _validate_wiki_frontmatter(updated)
    if frontmatter_error:
        return {"ok": False, "error": f"Refused: {frontmatter_error}"}

    try:
        source_path.write_text(updated, encoding="utf-8")
        _chown_like_site(source_path)
    except OSError:
        logging.exception("Could not write %s", source_path)
        return {"ok": False, "error": "Could not write the target page"}
    return {"ok": True, "url": update.get("target_url"), "section": section}


def _apply_chronicle_create(update, chronicle_title, chronicle_url):
    """Create a new wiki page through the lore pipeline's map — same
    directories, same index updater, same descriptions.json entry, so a page
    born from a chronicle is indistinguishable from one a player submitted."""
    kind = update.get("kind")
    config = LORE_SUBMISSION_KINDS.get(kind)
    if not config:
        return {"ok": False, "error": f"Unknown page kind '{kind}'"}

    title = str(update.get("title") or "").strip()[:120]
    slug = _slugify(update.get("slug") or title)
    if not title:
        return {"ok": False, "error": "A new page needs a title"}

    source_dir = SITE_SOURCE_DIR / config["source_dir"]
    source_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = source_dir / f"{slug}.md"
    page_url = f"{config['url_prefix']}/{slug}/"
    if markdown_path.exists():
        # A page that already exists is not an error worth failing a publish
        # over — it usually means this chronicle was published twice.
        return {"ok": True, "skipped": "page already exists", "url": page_url}

    summary = str(update.get("summary") or "").strip()[:300] or f"First recorded in {chronicle_title}."
    body = update["markdown"].strip()
    page = (
        _page_frontmatter(title, summary, config["tags"])
        + f"# {title}\n\n{body}\n\n---\n\n"
        f"*First recorded in [{chronicle_title}]({chronicle_url}).*\n"
    )
    frontmatter_error = _validate_wiki_frontmatter(page)
    if frontmatter_error:
        return {"ok": False, "error": f"Refused: {frontmatter_error}"}
    try:
        markdown_path.write_text(page, encoding="utf-8")
        _chown_like_site(markdown_path)
    except OSError:
        logging.exception("Could not write %s", markdown_path)
        return {"ok": False, "error": "Could not write the new page"}

    _append_index_link(kind, title, slug, summary)
    _update_descriptions_json(kind, title, slug, summary, "")
    return {"ok": True, "url": page_url, "created": True}


def _apply_chronicle_updates(updates, approved_ids, chronicle_title, chronicle_url):
    applied = []
    for update in updates or []:
        if update.get("id") not in approved_ids:
            update["approved"] = False
            continue
        update["approved"] = True
        if update.get("action") == "append":
            result = _apply_chronicle_append(update, chronicle_title, chronicle_url)
        else:
            result = _apply_chronicle_create(update, chronicle_title, chronicle_url)
        update["result"] = result
        applied.append({"id": update["id"], "title": update.get("title"), **result})
    return applied


# ── The front page's campaign state ──────────────────────────────────────────

def _write_campaign_state(row, title, slug, summary, threads, in_play, arc):
    """_data/campaign.js merges this file when it exists.

    The state used to be edited by hand in a JavaScript module after every
    session, which meant it was usually a session or two stale. It is data,
    so the API owns it as data — rewriting a JS module from Python is the
    kind of clever that breaks a build at the worst possible moment.
    """
    played = str(row["session_date"] or "").strip()
    try:
        played_label = datetime.strptime(played, "%Y-%m-%d").strftime("%B %-d, %Y")
    except (ValueError, TypeError):
        played_label = played
    state = {
        "latestSession": {
            "number": row["session_number"] or "",
            "arc": arc or "",
            "title": title,
            "lastPlayed": played_label,
            "updated": datetime.now(CAMPAIGN_TZ).strftime("%B %-d, %Y"),
            "recap": (row["recap"] or summary or "").strip(),
            "link": f"{CHRONICLE_URL_PREFIX}/{slug}/",
        },
        "generatedBy": "session chronicler",
        "generatedAt": _utc_now_iso(),
    }
    if threads:
        state["openThreads"] = threads
    if in_play:
        state["inPlay"] = [
            {
                "name": entry["name"],
                "role": entry.get("role") or "",
                "kind": entry.get("kind") or "NPC",
                "emblem": entry.get("emblem") or "",
                "link": entry.get("link") or "",
            }
            for entry in in_play
            if entry.get("link")
        ]
    try:
        CAMPAIGN_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CAMPAIGN_STATE_PATH.write_text(
            json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        _chown_like_site(CAMPAIGN_STATE_PATH)
        return True
    except OSError:
        logging.exception("Could not write the campaign state")
        return False


# ── Publish ──────────────────────────────────────────────────────────────────

def _publish_chronicle(chronicle_id, body):
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
    if not row:
        return {"error": "Chronicle not found"}, 404
    overwrite = bool(body.get("overwrite"))
    if row["status"] == "published" and not overwrite:
        return {"error": "This chronicle is already published"}, 409

    title = str(body.get("title") or row["title"] or "").strip()[:160]
    slug = _slugify(body.get("slug") or row["slug"] or title)
    summary = str(body.get("summary") or row["draft_summary"] or "").strip()[:300]
    markdown = str(body.get("markdown") or row["draft_markdown"] or "").strip()
    arc = str(body.get("arc") or "").strip()[:120]
    if not title:
        return {"error": "The chronicle needs a title"}, 400
    if not markdown:
        return {"error": "The chronicle body is empty"}, 400

    source_dir = SITE_SOURCE_DIR / CHRONICLE_SOURCE_DIR
    source_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = source_dir / f"{slug}.md"
    if markdown_path.exists() and not overwrite:
        return {
            "error": f"A chronicle page already exists at {CHRONICLE_URL_PREFIX}/{slug}/",
            "error_code": "exists",
        }, 409

    art_items = _json_loads(row["art_json"], [])
    published_art = _copy_chronicle_images(chronicle_id, slug, art_items)
    page_body = _place_chronicle_art(markdown, published_art, title)
    page = _page_frontmatter(title, summary, _chronicle_tags(row["session_number"])) + page_body

    frontmatter_error = _validate_wiki_frontmatter(page)
    if frontmatter_error:
        return {"error": frontmatter_error, "error_code": "invalid_frontmatter"}, 400

    try:
        markdown_path.write_text(page, encoding="utf-8")
        _chown_like_site(markdown_path)
    except OSError:
        logging.exception("Could not write the chronicle page")
        return {"error": "Could not write the chronicle page"}, 500

    chronicle_url = f"{CHRONICLE_URL_PREFIX}/{slug}/"
    index_updated = _update_chronicle_index(
        title, slug, summary, row["session_date"], row["session_number"]
    )

    updates = _json_loads(row["updates_json"], [])
    raw_ids = body.get("approved_updates")
    if raw_ids is None:
        approved_ids = {u["id"] for u in updates if u.get("approved")}
    else:
        approved_ids = {str(value) for value in raw_ids if isinstance(value, (str, int))}
    applied = _apply_chronicle_updates(updates, approved_ids, title, chronicle_url)

    threads = _json_loads(row["threads_json"], [])
    in_play = _json_loads(row["in_play_json"], [])
    campaign_state = False
    if body.get("update_campaign_state", True) is not False:
        campaign_state = _write_campaign_state(
            row, title, slug, summary, threads, in_play, arc
        )

    now = _utc_now_iso()
    with _app_db() as conn:
        _chronicle_touch(
            conn, chronicle_id,
            status="published", stage="Published",
            title=title, slug=slug, draft_summary=summary, draft_markdown=markdown,
            updates_json=json.dumps(updates, separators=(",", ":")),
            error_message=None,
            published_at=now, published_url=chronicle_url,
        )

    rebuild = None
    if body.get("auto_rebuild", True) is not False:
        # Knowledge on, always. A chronicle the corpus has not seen is one
        # Enzo will confidently contradict the next time a player asks.
        rebuild = _start_rebuild_job(
            f"chronicle publish: {chronicle_url}", include_knowledge=True
        )

    return {
        "ok": True,
        "id": chronicle_id,
        "title": title,
        "slug": slug,
        "url": chronicle_url,
        "path": str(markdown_path),
        "images": [item.get("site_url") for item in published_art],
        "index_updated": index_updated,
        "updates_applied": applied,
        "campaign_state_updated": campaign_state,
        "rebuild": rebuild,
    }, 200


__all__ = [
    'CHRONICLE_INDEX_EMPTY_RE', '_chronicle_image_rel', '_copy_chronicle_images',
    '_chronicle_figure_markdown', '_place_chronicle_art', '_chronicle_tags',
    '_update_chronicle_index', '_apply_chronicle_append', '_apply_chronicle_create',
    '_apply_chronicle_updates', '_write_campaign_state', '_publish_chronicle',
]
