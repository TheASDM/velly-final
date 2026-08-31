from ..imports import *
from ..symbols import *
from ..config import *

def _extract_campaign_entities(prompt):
    """Find named campaign entities in the prompt for art grounding.

    Two-stage match:
      1. Hand-curated descriptions.json (preferred — pure visual detail)
      2. RAG vector-store name index (fallback for entities not yet
         covered by descriptions.json)
    The two pools are merged, deduped, and capped at ENHANCE_MAX_ENTITIES.
    """
    matched = []

    # Stage 1: hand-curated descriptions
    desc_index = _load_descriptions_index()
    matched.extend(_match_descriptions(prompt, desc_index))
    matched.extend(_relationship_description_matches(prompt, desc_index, matched))

    # Stage 2: RAG keyword match (filtered to wiki entries only — 5e rules
    # noise is useless for image prompts)
    if engine and getattr(engine, "_name_index", None):
        # Skip RAG hits for any canonical name that's already in our
        # descriptions.json match list — they'd just duplicate context.
        seen_canon = {m["name"].lower() for m in matched}
        rag_seen_pages = set()
        for m in engine._keyword_match(prompt):
            if m.get("source_file", "").startswith("5e-filtered/"):
                continue
            page_id = m.get("page_id", m["id"])
            if page_id in rag_seen_pages:
                continue
            rag_seen_pages.add(page_id)
            if (m.get("name") or "").lower() in seen_canon:
                continue
            matched.append(m)

    return matched[:ENHANCE_MAX_ENTITIES]


def _clean_image_title(text):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    text = text.strip("\"'“”‘’")
    text = re.sub(r"^(title|description)\s*:\s*", "", text, flags=re.I).strip()
    if not text:
        return ""

    # Keep it to one sentence even if the model gets chatty.
    match = re.match(r"^(.+?[.!?])(?:\s|$)", text)
    if match:
        text = match.group(1).strip()
    if len(text) > 160:
        text = text[:157].rstrip(" ,;:-") + "..."
    return text


def _fallback_image_title(raw_prompt):
    title = _clean_image_title(raw_prompt)
    if title:
        return title
    return "Generated Vallombrosa image."


def _generate_image_title(raw_prompt, enhanced_prompt=None, grounded_in=None):
    """Generate a short gallery title from prompt text. Falls back locally."""
    fallback = _fallback_image_title(raw_prompt)
    if not ANTHROPIC_API_KEY:
        return fallback

    entity_text = ", ".join(grounded_in or []) or "none"
    system = (
        "You write concise gallery titles for fantasy campaign art. "
        "Return exactly one sentence, 8 to 18 words, no markdown, no quotes, "
        "no labels, and no invented proper nouns beyond names provided."
    )
    user_msg = (
        f"Player prompt:\n{raw_prompt}\n\n"
        f"Enzo image prompt:\n{enhanced_prompt or raw_prompt}\n\n"
        f"Named campaign entities: {entity_text}\n\n"
        "Write the title sentence."
    )
    # 80 tokens was the whole budget including thinking, which on an Opus
    # model is not enough to reach the sentence it is asked for.
    payload = {
        "model": IMAGE_TITLE_MODEL,
        "max_tokens": 2000,
        "output_config": {"effort": IMAGE_TITLE_EFFORT},
        "system": system,
        "messages": [{"role": "user", "content": user_msg}],
    }

    try:
        r = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
            timeout=IMAGE_TITLE_TIMEOUT_S,
        )
        if r.status_code != 200:
            logging.warning("Image title generation %d: %s", r.status_code, r.text[:200])
            return fallback
        data = r.json()
        for block in data.get("content") or []:
            if block.get("type") == "text":
                title = _clean_image_title(block.get("text") or "")
                if title:
                    return title
    except Exception:
        logging.exception("Image title generation crashed")
    return fallback


def _gallery_entry_title(entry):
    return _clean_image_title((entry or {}).get("title")) or _fallback_image_title((entry or {}).get("prompt"))

__all__ = ['_extract_campaign_entities', '_clean_image_title', '_fallback_image_title', '_generate_image_title', '_gallery_entry_title']
