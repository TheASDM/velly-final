from ..imports import *
from ..symbols import *
from ..config import *

def _extract_json_object(text):
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return json.loads(text)

FALLBACK_CARD_FIELDS = {
    "item":    [{"label": "Category", "value": "Object"}, {"label": "Type", "value": "Item"}],
    "person":  [{"label": "Title", "value": "Resident"}],
    "place":   [{"label": "Type", "value": "Location"}],
    "faction": [{"label": "Type", "value": "Faction"}],
    "lore":    [{"label": "Subject", "value": "Lore"}],
    "culture": [{"label": "Type", "value": "Custom"}],
}

def _sanitize_card_fields(raw):
    """Coerce the AI's card_fields array into a clean list of
    {label, value} pairs. Drops anything that isn't a dict with both
    label and value strings; caps length and field count."""
    if not isinstance(raw, list):
        return []
    cleaned = []
    for item in raw[:6]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()[:40]
        value = str(item.get("value") or "").strip()[:160]
        if not label or not value:
            continue
        cleaned.append({"label": label, "value": value})
    return cleaned


def _fallback_lore_draft(kind, title, description, connections, notes=""):
    connection_lines = []
    for item in connections or []:
        target = item.get("target") or ""
        relation = item.get("relation") or "Connection"
        note = item.get("note") or ""
        if target:
            line = f"- **{target}** — {relation}"
            if note:
                line += f"; {note}"
            connection_lines.append(line)

    summary = description.strip().split("\n", 1)[0][:220] or f"A new {kind} submitted for the wiki."
    notes_block = notes.strip()
    parts = [
        f"# {title}",
        "{{IMAGE}}",
        description.strip(),
    ]
    if notes_block:
        parts.extend(["---", "## Notes", notes_block])
    parts.extend([
        "---",
        "## Connections",
        "\n".join(connection_lines) if connection_lines else "- No connections were provided.",
    ])
    markdown = "\n\n".join(parts)
    image_prompt = (
        f"{title}. {description.strip()} Connections for visual grounding: "
        f"{_connections_to_text(connections)}"
    )
    return {
        "summary": summary,
        "markdown": markdown,
        "image_prompt": image_prompt[:1200],
        "card_fields": list(FALLBACK_CARD_FIELDS.get(kind, [])),
    }


def _generate_lore_draft_text(kind, title, description, connections, notes, context):
    fallback = _fallback_lore_draft(kind, title, description, connections, notes)
    if not ANTHROPIC_API_KEY:
        return fallback, "ANTHROPIC_API_KEY is not configured; used fallback draft."

    kind_label = LORE_SUBMISSION_KINDS[kind]["label"]
    system = (
        "You draft player-facing wiki entries for the Vallombrosa campaign. "
        "Use the player's submission as proposed content and the retrieved "
        "codex context only for grounding names, relationships, tone, and "
        "known facts. Do not invent secrets, hidden motives, unrevealed plot, "
        "or canon beyond the submission. If something is uncertain, write it "
        "plainly as a note for DM review rather than pretending it is settled. "
        "Return strict JSON only.\n"
        "\n"
        "STYLE (match the existing Vallombrosa wiki):\n"
        "- After the `# Title` and `{{IMAGE}}` placeholder, lead with one "
        "  or two paragraphs of plain prose that set up what this is. Never "
        "  start the body with a section heading like `## Overview` — let "
        "  the lede paragraphs be the overview.\n"
        "- Use 2–4 useful `## Section` headings to organize the rest "
        "  (e.g. In Play, Function, Known History, Notes). Pick whatever "
        "  sections suit this specific entry; don't force a fixed outline.\n"
        "- Insert a horizontal rule (`---`) on its own line between major "
        "  sections, including before `## Connections`.\n"
        "- End with `## Connections`. Render each entry as "
        "  `- **{Target name}** — {relation}; {note}` with NO hyperlinks. "
        "  Do not invent or guess wiki URLs — the publisher resolves links "
        "  to real wiki pages by name. Plain bold name only.\n"
        "- Tone: matter-of-fact, observational, in the campaign's voice. "
        "  No dramatic narrator framing.\n"
        "\n"
        "CARD FIELDS:\n"
        "- Pick 3–5 short label/value pairs that summarize this entry at "
        "  a glance. Labels are 1–2 words in Title Case (e.g. 'Type', "
        "  'Season', 'Owner', 'District', 'Headquarters'). Values are "
        "  plain text only — no Markdown, no HTML, no URLs.\n"
        "- Pick fields that suit the kind. Examples per kind:\n"
        "  - item: Category, Type, Rarity, Attunement, Owner, Origin\n"
        "  - person: Title, Family, Affiliation, Status\n"
        "  - place: Type, District, Notable For, Population\n"
        "  - faction: Type, Headquarters, Leader, Standing\n"
        "  - lore: Era, Subject, Source, First Recorded\n"
        "  - culture: Type, Season, Patrons, Frequency, Origin\n"
        "- Do not invent values you can't ground in the submission. If "
        "  you can't say a field with reasonable confidence, omit it.\n"
    )
    user_msg = f"""
Draft a wiki entry for this submitted {kind_label}.

Submission title:
{title}

Short description:
{description}

Connections:
{_connections_to_text(connections)}

Player notes:
{notes or "(none)"}

Retrieved codex context:
{context.get("text") or "(none)"}

Return exactly this JSON object:
{{
  "summary": "One concise public description, 180 characters max.",
  "card_fields": [
    {{"label": "Type", "value": "..."}},
    {{"label": "Owner", "value": "..."}}
  ],
  "markdown": "The wiki page body in Markdown. Follow the STYLE block in the system message exactly: '# {title}' heading, '{{{{IMAGE}}}}' placeholder, lede paragraphs (NOT a heading), '---' between sections, '## Connections' at the end with bold names only (no URLs). Do NOT include any HTML card or stat block in the markdown — the publisher renders the card from card_fields.",
  "image_prompt": "A visual prompt for generating one clean wiki image for this entry. Use concrete details and any relevant known character/place descriptions."
}}
"""
    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": max(MAX_TOKENS, 3200),
        "temperature": 0.35,
        "system": system,
        "messages": [{"role": "user", "content": user_msg}],
    }

    try:
        response = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        if response.status_code != 200:
            return fallback, f"Draft generation failed: {response.text[:250]}"
        data = response.json()
        text = "\n".join(
            block.get("text", "")
            for block in data.get("content") or []
            if block.get("type") == "text"
        )
        parsed = _extract_json_object(text)
        draft = {
            "summary": str(parsed.get("summary") or fallback["summary"]).strip()[:300],
            "markdown": str(parsed.get("markdown") or fallback["markdown"]).strip(),
            "image_prompt": str(parsed.get("image_prompt") or fallback["image_prompt"]).strip()[:1800],
            "card_fields": _sanitize_card_fields(parsed.get("card_fields") or fallback.get("card_fields") or []),
        }
        if not IMAGE_PLACEHOLDER_RE.search(draft["markdown"]):
            draft["markdown"] = re.sub(
                r"^(# .+?\n)",
                r"\1\n{{IMAGE}}\n",
                draft["markdown"],
                count=1,
                flags=re.DOTALL,
            )
        return draft, None
    except Exception as exc:
        logging.exception("Lore draft text generation failed")
        return fallback, f"Draft generation failed: {str(exc)[:250]}"


def _submission_payload(row, include_markdown=True, include_context=False):
    payload = {
        "id": row["id"],
        "submitter": row["submitter"],
        "kind": row["kind"],
        "kindLabel": LORE_SUBMISSION_KINDS.get(row["kind"], {}).get("label", row["kind"]),
        "title": row["title"],
        "slug": row["slug"],
        "short_description": row["short_description"],
        "connections": _json_loads(row["connections_json"], []),
        "notes": row["notes"] or "",
        "status": row["status"],
        "generated_summary": row["generated_summary"],
        "generated_image_prompt": row["generated_image_prompt"],
        "generated_card_fields": _json_loads(row["generated_card_fields_json"], []),
        "image_url": row["image_url"],
        "image_filename": row["image_filename"],
        "error_message": row["error_message"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_at": row["published_at"],
    }
    if include_markdown:
        payload["generated_markdown"] = row["generated_markdown"] or ""
    if include_context:
        payload["context"] = _json_loads(row["context_json"], {})
    return payload


def _lore_submission_row(conn, submission_id):
    return conn.execute("""
        SELECT id, submitter, kind, title, slug, short_description,
               connections_json, notes, status, context_json,
               generated_markdown, generated_summary, generated_image_prompt,
               generated_card_fields_json,
               image_url, image_filename, error_message, created_at,
               updated_at, published_at
        FROM lore_submissions
        WHERE id = ?
    """, (submission_id,)).fetchone()


def _run_lore_submission_draft(submission_id):
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return
        conn.execute("""
            UPDATE lore_submissions
            SET status = 'drafting', error_message = NULL, updated_at = ?
            WHERE id = ?
        """, (_utc_now_iso(), submission_id))

    connections = _json_loads(row["connections_json"], [])
    context = _submission_context(
        row["kind"], row["title"], row["short_description"], connections, row["notes"] or ""
    )
    draft, draft_warning = _generate_lore_draft_text(
        row["kind"], row["title"], row["short_description"], connections, row["notes"] or "", context
    )

    image_url = None
    image_filename = None
    image_error = None
    draft_image_path = LORE_DRAFT_IMAGES_DIR / f"{submission_id}.png"
    image_prompt = draft.get("image_prompt") or row["short_description"]
    try:
        image_data, image_status = _generate_image_payload(
            image_prompt,
            LORE_SUBMISSION_KINDS[row["kind"]]["style"],
            row["submitter"],
            enhance=True,
            save_gallery=False,
            image_output_path=draft_image_path,
        )
        if image_status >= 400:
            image_error = image_data.get("error") or "Image generation failed"
            if image_data.get("details"):
                image_error = f"{image_error}: {image_data['details']}"
        elif draft_image_path.exists():
            image_filename = draft_image_path.name
            image_url = f"/api/lore-submissions/{submission_id}/image"
    except Exception as exc:
        logging.exception("Lore draft image generation failed")
        image_error = str(exc)[:300]

    warnings = "; ".join([msg for msg in (draft_warning, image_error) if msg])
    status = "needs_review"
    card_fields_json = json.dumps(
        _sanitize_card_fields(draft.get("card_fields") or []),
        separators=(",", ":"),
    )
    with _app_db() as conn:
        conn.execute("""
            UPDATE lore_submissions
            SET status = ?, context_json = ?, generated_markdown = ?,
                generated_summary = ?, generated_image_prompt = ?,
                generated_card_fields_json = ?,
                image_url = ?, image_filename = ?, error_message = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            status,
            json.dumps(context, separators=(",", ":")),
            draft.get("markdown") or "",
            draft.get("summary") or "",
            image_prompt,
            card_fields_json,
            image_url,
            image_filename,
            warnings[:500] if warnings else None,
            _utc_now_iso(),
            submission_id,
        ))


def _start_lore_draft_thread(submission_id):
    thread = threading.Thread(
        target=_run_lore_submission_draft,
        args=(submission_id,),
        daemon=True,
    )
    thread.start()

__all__ = ['_extract_json_object', 'FALLBACK_CARD_FIELDS', '_sanitize_card_fields', '_fallback_lore_draft', '_generate_lore_draft_text', '_submission_payload', '_lore_submission_row', '_run_lore_submission_draft', '_start_lore_draft_thread']
