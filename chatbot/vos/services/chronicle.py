"""The session chronicler: raw notes in, a reviewable chronicle out.

The DM finishes a session holding whatever they managed to write down — six
bullets, a wall of text, someone's transcript. The chronicler takes that and
produces the thing that would otherwise never get written: a chronicle in the
wiki's voice, illustrated, with the wiki edits it implies listed as proposals
rather than applied behind the DM's back.

Three passes, in this order, and the order is the point:

  research   the notes are matched against the canonical name catalog and
             every subject is retrieved separately (chronicle_research.py)
  draft      one call writes the chronicle, the art moments, the proposed
             wiki updates, and the continuity questions — all as one JSON
             object, because they have to agree with each other
  illustrate each art moment goes through the same image path the Studio
             uses, so the compiler and descriptions.json ground the faces

Nothing here writes to the wiki. Publishing is a separate, DM-driven step in
chronicle_publish.py, and every proposed edit arrives switched off until a
human turns it on.

The rule the drafting prompt exists to enforce: **the notes are the only
source of what happened; the wiki is only a source of how it is spelled and
what was already true.** A model that fills gaps in a session recap is not
being helpful, it is inventing campaign canon, and nothing downstream can
tell the difference afterwards.
"""

from ..imports import *
from ..symbols import *
from ..config import *

CHRONICLE_STATUSES = (
    "queued", "researching", "drafting", "illustrating",
    "needs_review", "failed", "published",
)

CHRONICLE_THREAD_STATUSES = ("hot", "pending", "slow")

CHRONICLE_ART_PLACEHOLDER_RE = re.compile(r"\{\{\s*ART\s*:\s*(\d+)\s*\}\}", re.IGNORECASE)


CHRONICLE_SYSTEM = """You are the chronicler for the Vallombrosa campaign \
wiki. You turn a DM's raw notes from one session into the chronicle page for \
that session, and you list the wiki changes the session implies.

THE ONE RULE
The DM's notes are the only source of what happened. The retrieved wiki \
context is a source of spelling, titles, relationships, and what was already \
true — never of events. If the notes do not say it, it did not happen. Do not \
resolve, dramatize, or fill a gap: an invented beat in a session chronicle \
becomes campaign canon the moment it is published, and nobody downstream can \
tell it from the real ones. When the notes are ambiguous, write what they \
support and raise the ambiguity in "continuity".

VOICE
Match the existing wiki: matter-of-fact, observational, close to the table. \
Past tense, third person, the party referred to by character name. No \
narrator grandeur, no "our heroes", no rhetorical questions. Short paragraphs. \
Prefer the concrete detail the notes actually contain over an atmospheric \
sentence you would have to make up.

THE CHRONICLE MARKDOWN
- Start with `# {title}`.
- Open with one or two paragraphs of prose that say where the session picked \
up and what it turned out to be about. Never open with a heading.
- Then 3-7 `## Section` headings following the session's actual shape. Name \
them after what happened, not with a fixed outline.
- Put `---` on its own line between major sections.
- Place each art moment's placeholder — `{{ART:1}}`, `{{ART:2}}` and so on — \
on its own line at the point in the chronicle where that image belongs. Use \
each placeholder exactly once and only for art moments you actually list.
- Name people, places, and things with the exact canonical spelling from the \
context when the context has one, and with the notes' spelling when it does \
not. Never write a wiki URL or a Markdown link: the publisher resolves links \
by name.
- End with `## Where it left off` — two to five bullets of the state of play \
at the end of the night.

ART MOMENTS
Pick the moments that are worth a picture: a confrontation, an arrival, a \
reveal, a place seen for the first time. Not a conversation in a room. Each \
prompt describes one image — subject, action, setting, light, framing — in \
plain concrete language, and names the campaign entities in it by their \
canonical names. Do NOT describe what a named character looks like: the app \
supplies every canonical appearance itself, and a description written here \
fights with it. Do not name an art style in the prompt; pick the style key \
instead.

PROPOSED WIKI UPDATES
List what this session changed about the world, one entry per page. \
"action": "append" adds a section to an existing page — give its exact URL \
from the page list. "action": "create" proposes a page that does not exist \
yet — give a kind and a title. Write each update's markdown as the section \
body only (no `#` title, no frontmatter), in the same voice, sourced only \
from the notes. Propose an update only where the session genuinely changed \
or revealed something; a session that revealed nothing about a character \
needs no entry for them. Never propose an edit to a page whose URL is not in \
the list.

CONTINUITY
Anything that does not line up — a name the notes use that the wiki spells \
differently, an event that contradicts an established fact, a detail the \
notes leave unclear. This list is how the DM finds what you were unsure \
about, so err towards listing it.

Return exactly one JSON object and nothing else."""


CHRONICLE_JSON_SHAPE = """{
  "title": "The chronicle's title — evocative, specific to this session, no session number in it",
  "slug": "url-safe-slug",
  "summary": "One sentence, 200 characters max, for the page description and the index.",
  "recap": "Two sentences for the app's front page: what happened and what it left open.",
  "markdown": "The full chronicle body in Markdown, following the rules above, with {{ART:n}} placeholders.",
  "art_moments": [
    {
      "slot": 1,
      "caption": "One line shown under the image.",
      "prompt": "Concrete description of the single image to generate.",
      "style": "valley-scene | valley-portrait | valley-place"
    }
  ],
  "wiki_updates": [
    {
      "action": "append",
      "target_url": "/en/Venturia/Characters/NPCs/example/",
      "title": "Existing page title",
      "section": "What this session added — used as the ## heading",
      "markdown": "Section body in Markdown.",
      "reason": "Why this session requires the edit."
    },
    {
      "action": "create",
      "kind": "person | place | item | faction | lore | culture",
      "title": "New page title",
      "summary": "One-sentence description for the new page.",
      "markdown": "The new page's body in Markdown, without a # title.",
      "reason": "Why this session requires the page."
    }
  ],
  "open_threads": [
    {"question": "A question the table is now holding.", "status": "hot | pending | slow", "tag": "Two or three words"}
  ],
  "in_play": [
    {"name": "Canonical name", "role": "Why they matter right now", "kind": "PC | NPC | Location | Item | Faction"}
  ],
  "continuity": [
    {"about": "What it concerns", "note": "What does not line up or is unclear", "severity": "check | conflict"}
  ]
}"""


# ── Row access and payloads ──────────────────────────────────────────────────

CHRONICLE_COLUMNS = """
    id, created_by, session_number, session_date, title, slug, raw_notes,
    extra_sources, art_count, status, stage, context_json, research_json,
    draft_markdown, draft_summary, recap, continuity_json, art_json,
    updates_json, threads_json, in_play_json, error_message, created_at,
    updated_at, published_at, published_url
"""


def _chronicle_row(conn, chronicle_id):
    return conn.execute(
        f"SELECT {CHRONICLE_COLUMNS} FROM session_chronicles WHERE id = ?",
        (chronicle_id,),
    ).fetchone()


def _chronicle_touch(conn, chronicle_id, **fields):
    """Update named columns and updated_at in one statement."""
    fields["updated_at"] = _utc_now_iso()
    assignments = ", ".join(f"{name} = ?" for name in fields)
    conn.execute(
        f"UPDATE session_chronicles SET {assignments} WHERE id = ?",
        (*fields.values(), chronicle_id),
    )


def _chronicle_art_payload(chronicle_id, art_items):
    """Art as the console needs it: the draft image is served through the API,
    not from disk, so a draft image never has a public URL."""
    payload = []
    for item in art_items or []:
        entry = dict(item)
        slot = int(entry.get("slot") or 0)
        if entry.get("filename"):
            entry["image_url"] = (
                f"/api/admin/chronicles/{chronicle_id}/art/{slot}"
            )
        else:
            entry["image_url"] = None
        payload.append(entry)
    return payload


def _chronicle_payload(row, include_draft=True, include_context=False):
    chronicle_id = row["id"]
    payload = {
        "id": chronicle_id,
        "created_by": row["created_by"],
        "session_number": row["session_number"] or "",
        "session_date": row["session_date"] or "",
        "title": row["title"] or "",
        "slug": row["slug"] or "",
        "status": row["status"],
        "stage": row["stage"] or "",
        "summary": row["draft_summary"] or "",
        "recap": row["recap"] or "",
        "art_count": row["art_count"],
        "art": _chronicle_art_payload(chronicle_id, _json_loads(row["art_json"], [])),
        "updates": _json_loads(row["updates_json"], []),
        "open_threads": _json_loads(row["threads_json"], []),
        "in_play": _json_loads(row["in_play_json"], []),
        "continuity": _json_loads(row["continuity_json"], []),
        "error_message": row["error_message"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_at": row["published_at"],
        "published_url": row["published_url"],
    }
    if include_draft:
        payload["markdown"] = row["draft_markdown"] or ""
        payload["raw_notes"] = row["raw_notes"] or ""
        payload["extra_sources"] = row["extra_sources"] or ""
    if include_context:
        payload["context"] = _json_loads(row["context_json"], {})
    return payload


# ── Sanitizers ───────────────────────────────────────────────────────────────

def _chronicle_url_for_name(name):
    """The wiki URL for a canonical name, or None. Used for the in-play chips
    on the front page, which are links or nothing."""
    label = str(name or "").strip()
    if not label or not engine or not getattr(engine, "_name_index", None):
        return None
    for entry in engine._name_index.get(label.lower()) or []:
        url = _source_file_url(entry.get("source_file"))
        if url:
            return url
    return None


def _chronicle_emblem(name):
    words = [word for word in re.split(r"\s+", str(name or "").strip()) if word]
    if not words:
        return "??"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[1][0]).upper()


def _sanitize_chronicle_art(raw, limit):
    """Art moments, renumbered 1..n. The slot numbers the model wrote are
    kept only as far as their order: the markdown's placeholders are rewritten
    to match, so a model that numbers from zero or skips a number still lands
    on a chronicle whose placeholders resolve."""
    cleaned = []
    for index, item in enumerate(raw if isinstance(raw, list) else []):
        if len(cleaned) >= limit:
            break
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt") or "").strip()[:1800]
        if not prompt:
            continue
        style = str(item.get("style") or "").strip().lower()
        if style not in ART_STYLE_PRESETS:
            style = DEFAULT_STYLE_KEY
        cleaned.append({
            "slot": len(cleaned) + 1,
            "original_slot": item.get("slot", index + 1),
            "caption": str(item.get("caption") or "").strip()[:220],
            "prompt": prompt,
            "style": style,
            "status": "pending",
            "filename": None,
            "title": None,
            "grounded_in": [],
            "error": None,
        })
    return cleaned


def _renumber_art_placeholders(markdown, art_items):
    """Rewrite {{ART:n}} in the body to the slots the art actually got.

    The model's numbering and the sanitized numbering diverge whenever an art
    moment is dropped (no prompt, over the cap). A placeholder pointing at a
    slot that no longer exists renders as literal braces on the published
    page, which is the kind of defect nobody notices until a player does.
    """
    by_original = {}
    for item in art_items:
        try:
            by_original[int(item.get("original_slot") or item["slot"])] = item["slot"]
        except (TypeError, ValueError):
            continue

    def _replace(match):
        try:
            original = int(match.group(1))
        except ValueError:
            return ""
        slot = by_original.get(original)
        return f"{{{{ART:{slot}}}}}" if slot else ""

    body = CHRONICLE_ART_PLACEHOLDER_RE.sub(_replace, markdown or "")
    return re.sub(r"\n{3,}", "\n\n", body)


def _sanitize_chronicle_updates(raw, known_urls):
    """Proposed wiki edits, every one of them switched off.

    An append whose target is not a real editable page is dropped rather than
    retargeted: the publisher would otherwise have to guess, and guessing
    writes a session's aftermath onto the wrong page.
    """
    cleaned = []
    for index, item in enumerate(raw if isinstance(raw, list) else []):
        if len(cleaned) >= 30 or not isinstance(item, dict):
            continue
        action = str(item.get("action") or "").strip().lower()
        markdown = str(item.get("markdown") or "").strip()
        title = str(item.get("title") or "").strip()[:160]
        if not markdown or action not in {"append", "create"}:
            continue
        entry = {
            "id": f"u{index + 1}",
            "action": action,
            "title": title,
            "markdown": markdown[:20000],
            "reason": str(item.get("reason") or "").strip()[:400],
            # Nothing is applied until a human says so. The console renders
            # these as unchecked boxes and publishing ignores the rest.
            "approved": False,
            "result": None,
        }
        if action == "append":
            target = str(item.get("target_url") or "").strip()
            if not target.startswith("/en/"):
                continue
            if not target.endswith("/"):
                target += "/"
            if known_urls and target not in known_urls:
                continue
            entry["target_url"] = target
            entry["section"] = str(item.get("section") or "").strip()[:120] or "Aftermath"
        else:
            # A new page is created through the lore pipeline's directory
            # map, index updater, and descriptions.json writer, so its kind
            # has to be one of that map's kinds.
            kind = str(item.get("kind") or "").strip().lower()
            if kind not in LORE_SUBMISSION_KINDS:
                continue
            if not title:
                continue
            entry["kind"] = kind
            entry["slug"] = _slugify(item.get("slug") or title)
            entry["summary"] = str(item.get("summary") or "").strip()[:300]
        cleaned.append(entry)
    return cleaned


def _sanitize_chronicle_threads(raw):
    cleaned = []
    for item in raw if isinstance(raw, list) else []:
        if len(cleaned) >= 8 or not isinstance(item, dict):
            continue
        question = str(item.get("question") or "").strip()[:300]
        if not question:
            continue
        status = str(item.get("status") or "").strip().lower()
        cleaned.append({
            "question": question,
            "status": status if status in CHRONICLE_THREAD_STATUSES else "pending",
            "tag": str(item.get("tag") or "").strip()[:40] or "Open thread",
        })
    return cleaned


def _sanitize_chronicle_in_play(raw):
    cleaned = []
    for item in raw if isinstance(raw, list) else []:
        if len(cleaned) >= 8 or not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()[:80]
        if not name:
            continue
        cleaned.append({
            "name": name,
            "role": str(item.get("role") or "").strip()[:120],
            "kind": str(item.get("kind") or "").strip()[:20] or "NPC",
            "emblem": _chronicle_emblem(name),
            "link": _chronicle_url_for_name(name) or "",
        })
    return cleaned


def _sanitize_chronicle_continuity(raw):
    cleaned = []
    for item in raw if isinstance(raw, list) else []:
        if len(cleaned) >= 20 or not isinstance(item, dict):
            continue
        note = str(item.get("note") or "").strip()[:600]
        if not note:
            continue
        severity = str(item.get("severity") or "").strip().lower()
        cleaned.append({
            "about": str(item.get("about") or "").strip()[:120],
            "note": note,
            "severity": "conflict" if severity == "conflict" else "check",
        })
    return cleaned


# ── Drafting ─────────────────────────────────────────────────────────────────

def _fallback_chronicle_draft(row, notes):
    """No model, or the draft call failed. The DM's notes are still worth
    keeping in the shape of a chronicle — they can edit it into one, and the
    alternative is a failed row with their notes locked inside it."""
    title = (row["title"] or "").strip() or (
        f"Session {row['session_number']}" if row["session_number"] else "Untitled Session"
    )
    body = "\n\n".join([
        f"# {title}",
        "*Drafted from the DM's raw notes — the chronicler could not reach "
        "the drafting model, so this is the notes themselves.*",
        notes.strip(),
    ])
    return {
        "title": title,
        "slug": _slugify(row["slug"] or title),
        "summary": notes.strip().split("\n", 1)[0][:200] or "A session at the Valley of Shadows table.",
        "recap": notes.strip()[:280],
        "markdown": body,
        "art_moments": [],
        "wiki_updates": [],
        "open_threads": [],
        "in_play": [],
        "continuity": [{
            "about": "This draft",
            "note": "Written from the raw notes without the drafting model. "
                    "Nothing here has been checked against the wiki.",
            "severity": "check",
        }],
    }


def _chronicle_draft_user_message(row, notes, context, pages):
    session_bits = []
    if row["session_number"]:
        session_bits.append(f"Session: {row['session_number']}")
    if row["session_date"]:
        session_bits.append(f"Played: {row['session_date']}")
    if row["title"]:
        session_bits.append(f"The DM's working title: {row['title']}")
    art_count = max(0, min(int(row["art_count"] or 0), CHRONICLE_MAX_ART))

    subjects = (context or {}).get("subjects") or {}
    unknown = subjects.get("unknown") or []

    blocks = [
        "SESSION\n" + ("\n".join(session_bits) or "(no session metadata given)"),
        "RAW NOTES FROM THE DM — the only source of what happened:\n\n" + notes,
        "RETRIEVED WIKI CONTEXT — for spelling, titles, relationships, and "
        "what was already true. Not a source of events:\n\n"
        + ((context or {}).get("text") or "(none)"),
    ]
    if unknown:
        blocks.append(
            "NAMES IN THE NOTES THE WIKI DOES NOT KNOW — candidates for new "
            "pages, and the ones most likely to be misspelled:\n"
            + "\n".join(f"- {name}" for name in unknown)
        )
    catalog = _descriptions_catalog()
    if catalog:
        blocks.append(
            "ENTITY CATALOG — the canonical spelling of every name this "
            "campaign knows:\n\n" + catalog
        )
    blocks.append(
        "EDITABLE WIKI PAGES — an \"append\" update may target one of these "
        "URLs and no others:\n" + (_chronicle_page_catalog(pages) or "(none)")
    )
    blocks.append(
        f"Produce exactly {art_count} art moment"
        + ("" if art_count == 1 else "s")
        + " (an empty list if that number is zero), and place a matching "
          "placeholder for each one in the markdown."
    )
    blocks.append("Return exactly this JSON object:\n" + CHRONICLE_JSON_SHAPE)
    return "\n\n".join(blocks)


def _generate_chronicle_draft(row, notes, context, pages):
    """One call, one JSON object. Returns (draft, warning)."""
    fallback = _fallback_chronicle_draft(row, notes)
    if not ANTHROPIC_API_KEY:
        return fallback, "ANTHROPIC_API_KEY is not configured; kept the raw notes as the draft."

    try:
        response = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": CHRONICLE_MODEL,
                "max_tokens": CHRONICLE_MAX_TOKENS,
                "output_config": {"effort": CHRONICLE_EFFORT},
                "system": CHRONICLE_SYSTEM,
                "messages": [{
                    "role": "user",
                    "content": _chronicle_draft_user_message(row, notes, context, pages),
                }],
            },
            timeout=CHRONICLE_TIMEOUT_S,
        )
        if response.status_code != 200:
            return fallback, f"Chronicle draft failed: {response.text[:250]}"
        text = "\n".join(
            block.get("text", "")
            for block in response.json().get("content") or []
            if block.get("type") == "text"
        )
        parsed = _extract_json_object(text)
    except Exception as exc:
        logging.exception("Chronicle draft generation failed")
        return fallback, f"Chronicle draft failed: {str(exc)[:250]}"

    markdown = str(parsed.get("markdown") or "").strip()
    if not markdown:
        return fallback, "The drafting model returned no chronicle body."

    title = str(parsed.get("title") or fallback["title"]).strip()[:160]
    draft = {
        "title": title,
        "slug": _slugify(parsed.get("slug") or title),
        "summary": str(parsed.get("summary") or "").strip()[:300] or fallback["summary"],
        "recap": str(parsed.get("recap") or "").strip()[:600],
        "markdown": markdown,
        "art_moments": parsed.get("art_moments"),
        "wiki_updates": parsed.get("wiki_updates"),
        "open_threads": parsed.get("open_threads"),
        "in_play": parsed.get("in_play"),
        "continuity": parsed.get("continuity"),
    }
    if not re.match(r"^#\s+", draft["markdown"]):
        draft["markdown"] = f"# {title}\n\n{draft['markdown']}"
    return draft, None


# ── Illustration ─────────────────────────────────────────────────────────────

def _chronicle_art_path(chronicle_id, slot):
    return CHRONICLE_IMAGES_DIR / f"{chronicle_id}-{int(slot)}.png"


def _run_chronicle_art_item(chronicle_id, item, created_by):
    """Generate one art moment in place. Never raises: an image that fails
    leaves its own error on its own card, and the chronicle still arrives."""
    slot = int(item.get("slot") or 1)
    path = _chronicle_art_path(chronicle_id, slot)
    try:
        data, status = _generate_image_payload(
            item.get("prompt") or "",
            item.get("style") or DEFAULT_STYLE_KEY,
            created_by,
            enhance=True,
            save_gallery=False,
            image_output_path=path,
        )
        if status >= 400:
            error = data.get("error") or "Image generation failed"
            if data.get("details"):
                error = f"{error}: {data['details']}"
            item.update({"status": "error", "error": error[:400], "filename": None})
            return item
        if not path.exists():
            item.update({
                "status": "error",
                "error": "The image API returned no bytes to save.",
                "filename": None,
            })
            return item
        item.update({
            "status": "done",
            "error": None,
            "filename": path.name,
            "title": data.get("title") or "",
            "grounded_in": data.get("grounded_in") or [],
            "scene_prompt": data.get("scene_prompt") or "",
        })
    except Exception as exc:
        logging.exception("Chronicle art generation failed for %s slot %s", chronicle_id, slot)
        item.update({"status": "error", "error": str(exc)[:400], "filename": None})
    return item


def _store_chronicle_art(chronicle_id, art_items, stage=None):
    with _app_db() as conn:
        fields = {"art_json": json.dumps(art_items, separators=(",", ":"))}
        if stage is not None:
            fields["stage"] = stage
        _chronicle_touch(conn, chronicle_id, **fields)


# ── The pipeline ─────────────────────────────────────────────────────────────

def _run_chronicle_job(chronicle_id, redraw_art=True):
    """Research, draft, illustrate. Runs on its own thread; every stage it
    reaches is written to the row, so the console can say where it is instead
    of showing a spinner for four minutes."""
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
        if not row:
            return
        _chronicle_touch(
            conn, chronicle_id,
            status="researching", stage="Reading the notes against the wiki",
            error_message=None,
        )
        created_by = row["created_by"]

    warnings = []
    try:
        notes, context, research_warning = _chronicle_research(
            row["raw_notes"], row["extra_sources"]
        )
        if research_warning:
            warnings.append(research_warning)
        pages = _chronicle_known_pages()
        known_urls = {page["url"] for page in pages}

        with _app_db() as conn:
            _chronicle_touch(
                conn, chronicle_id,
                status="drafting", stage="Writing the chronicle",
                context_json=json.dumps(context, separators=(",", ":")),
            )

        draft, draft_warning = _generate_chronicle_draft(row, notes, context, pages)
        if draft_warning:
            warnings.append(draft_warning)

        art_items = _sanitize_chronicle_art(
            draft.get("art_moments"), max(0, min(int(row["art_count"] or 0), CHRONICLE_MAX_ART))
        )
        markdown = _renumber_art_placeholders(draft["markdown"], art_items)
        updates = _sanitize_chronicle_updates(draft.get("wiki_updates"), known_urls)
        threads = _sanitize_chronicle_threads(draft.get("open_threads"))
        in_play = _sanitize_chronicle_in_play(draft.get("in_play"))
        continuity = _sanitize_chronicle_continuity(draft.get("continuity"))

        with _app_db() as conn:
            _chronicle_touch(
                conn, chronicle_id,
                status="illustrating" if art_items else "needs_review",
                stage="Drawing the art" if art_items else "Ready for review",
                title=draft["title"],
                slug=draft["slug"],
                draft_markdown=markdown,
                draft_summary=draft["summary"],
                recap=draft["recap"],
                art_json=json.dumps(art_items, separators=(",", ":")),
                updates_json=json.dumps(updates, separators=(",", ":")),
                threads_json=json.dumps(threads, separators=(",", ":")),
                in_play_json=json.dumps(in_play, separators=(",", ":")),
                continuity_json=json.dumps(continuity, separators=(",", ":")),
                research_json=json.dumps(
                    {"warnings": warnings}, separators=(",", ":")
                ),
            )

        if art_items and redraw_art:
            for index, item in enumerate(art_items):
                _store_chronicle_art(
                    chronicle_id, art_items,
                    stage=f"Drawing image {index + 1} of {len(art_items)}",
                )
                _run_chronicle_art_item(chronicle_id, item, created_by)
            _store_chronicle_art(chronicle_id, art_items)
            failed = [item for item in art_items if item.get("status") == "error"]
            if failed:
                warnings.append(
                    f"{len(failed)} of {len(art_items)} images failed — regenerate them individually."
                )

        with _app_db() as conn:
            _chronicle_touch(
                conn, chronicle_id,
                status="needs_review",
                stage="Ready for review",
                error_message="; ".join(warnings)[:500] if warnings else None,
            )
    except Exception as exc:
        logging.exception("Chronicle job %s failed", chronicle_id)
        with _app_db() as conn:
            _chronicle_touch(
                conn, chronicle_id,
                status="failed", stage="Failed",
                error_message=str(exc)[:500],
            )


def _start_chronicle_job(chronicle_id, redraw_art=True):
    threading.Thread(
        target=_run_chronicle_job,
        args=(chronicle_id, redraw_art),
        daemon=True,
    ).start()


def _run_chronicle_art_job(chronicle_id, slot, prompt=None, style=None):
    """Redraw one image. The DM edits the prompt on the card and asks again;
    everything else about the chronicle is left alone."""
    with _app_db() as conn:
        row = _chronicle_row(conn, chronicle_id)
        if not row:
            return
        created_by = row["created_by"]
        art_items = _json_loads(row["art_json"], [])

    target = None
    for item in art_items:
        if int(item.get("slot") or 0) == int(slot):
            target = item
            break
    if target is None:
        return
    if prompt:
        target["prompt"] = str(prompt).strip()[:1800]
    if style and style in ART_STYLE_PRESETS:
        target["style"] = style
    target.update({"status": "pending", "error": None})
    _store_chronicle_art(chronicle_id, art_items, stage=f"Redrawing image {slot}")
    _run_chronicle_art_item(chronicle_id, target, created_by)
    _store_chronicle_art(chronicle_id, art_items, stage="Ready for review")


def _start_chronicle_art_job(chronicle_id, slot, prompt=None, style=None):
    threading.Thread(
        target=_run_chronicle_art_job,
        args=(chronicle_id, slot, prompt, style),
        daemon=True,
    ).start()


__all__ = [
    'CHRONICLE_STATUSES', 'CHRONICLE_THREAD_STATUSES',
    'CHRONICLE_ART_PLACEHOLDER_RE', 'CHRONICLE_SYSTEM', 'CHRONICLE_JSON_SHAPE',
    'CHRONICLE_COLUMNS', '_chronicle_row', '_chronicle_touch',
    '_chronicle_art_payload', '_chronicle_payload', '_chronicle_url_for_name',
    '_chronicle_emblem', '_sanitize_chronicle_art', '_renumber_art_placeholders',
    '_sanitize_chronicle_updates', '_sanitize_chronicle_threads',
    '_sanitize_chronicle_in_play', '_sanitize_chronicle_continuity',
    '_fallback_chronicle_draft', '_chronicle_draft_user_message',
    '_generate_chronicle_draft', '_chronicle_art_path', '_run_chronicle_art_item',
    '_store_chronicle_art', '_run_chronicle_job', '_start_chronicle_job',
    '_run_chronicle_art_job', '_start_chronicle_art_job',
]
