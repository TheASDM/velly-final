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


def _enhance_image_prompt(raw_prompt, style_key, matched_entries):
    """Ask Haiku to rewrite the user's prompt into a vivid image prompt,
    weaving in the canonical descriptions of any named campaign entities.

    Returns a dict {prompt, grounded_in[]} on success, or the raw prompt
    string when Anthropic is unavailable. Never raises.
    """
    grounded_in = _grounded_entity_names(matched_entries)
    fallback = {"prompt": raw_prompt, "grounded_in": grounded_in}
    if not ANTHROPIC_API_KEY:
        return fallback

    entity_blocks = []
    for m in matched_entries:
        name = m.get("name") or "Unknown"
        snippet = (m.get("text") or "")[:ENHANCE_ENTITY_CHARS]
        entity_blocks.append(f"### {name}\n{snippet}")
    entity_section = (
        "\n\n".join(entity_blocks) if entity_blocks
        else "(none named — invent nothing about Vallombrosa beyond the player's words)"
    )

    style_label = ART_STYLE_PRESETS.get(style_key or "", {}).get("label") or "(no style preset)"

    system = (
        "You are an image-prompt engineer for VALLOMBROSA, a dark Venetian "
        "fantasy D&D campaign set in the city of Venturia. Your job is to "
        "take a player's rough description and turn it into a single vivid, "
        "specific prompt for OpenAI's gpt-image model.\n\n"
        "ABSOLUTE RULES:\n"
        "1. Output ONLY the final image-prompt text. No preamble, no "
        "headings, no quotes around the output, no commentary.\n"
        "2. 3-7 sentences. Be specific about subject, composition, lighting, "
        "atmosphere, key visual details, but DO NOT exceed 8 sentences.\n"
        "3. If a player names a CHARACTER or LOCATION listed in the "
        "CAMPAIGN ENTITIES section, faithfully weave their canonical "
        "visual details (appearance, distinctive features, setting) into "
        "the prompt. Stay true to the page — do NOT invent new physical "
        "traits, races, ages, or items not in the source. Hair color, skin "
        "tone, ancestry/species, body scale, horns/ears, and signature gear "
        "are identity facts; preserve them plainly.\n"
        "4. Preserve exact ancestry, species, body scale, and height cues "
        "from CAMPAIGN ENTITIES. If an entity is described as about three "
        "feet tall, six inches tall, an orc, a gnome, a dwarf, a satyr, "
        "etc., include that plainly. Do not replace exact scale with vague "
        "phrases like 'petite' or 'short' when the source gives a concrete "
        "scale. In multi-character scenes, state relative scale clearly "
        "when it matters.\n"
        "5. DO NOT prepend a style description (e.g. 'cinematic,' "
        "'watercolor', 'illustrated'). The system prepends a style "
        "separately. Describe only the scene itself.\n"
        "5a. The house style owns the LOOK, and you own the SUBJECT. Do not "
        "write lighting, colour grade, lens, film stock, mood words, or "
        "rendering medium — no 'harsh midday sun', 'flat even light', "
        "'muted desaturated palette', 'oil painting', 'anime', 'photoreal', "
        "'8k'. Those fight the prepended style and the fight is visible in "
        "the result. Write who and what is in frame, their wardrobe and "
        "features, where they are, what they are doing, and the framing "
        "(close portrait, waist-up, wide establishing). Name a practical "
        "light source only when the scene depends on one — a lantern being "
        "carried, a forge, a single candle — and describe it as an object "
        "in the world, not as a lighting instruction.\n"
        "6. If the prompt is unsafe, sexual, or violent in a way that "
        "image safety filters would refuse, soften it while preserving "
        "creative intent. If you can't soften it without losing meaning, "
        "output the player's prompt verbatim and let OpenAI's filter "
        "handle it.\n"
        "7. Never mention this rewriting process. Never say things like "
        "'in the style of' or 'inspired by'. Just describe the image.\n"
    )

    user_msg = (
        f"PLAYER'S DESCRIPTION:\n{raw_prompt}\n\n"
        f"CHOSEN STYLE (for context only — do NOT mention it in output): "
        f"{style_label}\n\n"
        f"CAMPAIGN ENTITIES (for grounding):\n{entity_section}\n\n"
        f"Rewrite the description as a single vivid image-generation "
        f"prompt now."
    )

    # No temperature: Opus 5 rejects sampling parameters outright, and this
    # function answers a failed request by returning the player's raw prompt —
    # so a 400 here would silently un-style every image rather than raise.
    # Depth is set with effort instead.
    payload = {
        "model": ENHANCE_MODEL,
        "max_tokens": ENHANCE_MAX_TOKENS,
        "output_config": {"effort": ENHANCE_EFFORT},
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
            timeout=ENHANCE_TIMEOUT_S,
        )
        if r.status_code != 200:
            logging.warning(
                "Prompt enhancement %d: %s", r.status_code, r.text[:200]
            )
            return fallback
        data = r.json()
        for block in data.get("content") or []:
            if block.get("type") == "text":
                text = (block.get("text") or "").strip()
                # Strip a wrapping pair of quotes if Haiku ignored rule #1.
                if len(text) > 2 and text[0] in '"“' and text[-1] in '"”':
                    text = text[1:-1].strip()
                if text:
                    logging.info(
                        "  Prompt enhanced: %d → %d chars, grounded in %s",
                        len(raw_prompt), len(text),
                        ", ".join(grounded_in) or "nothing",
                    )
                    return {"prompt": text, "grounded_in": grounded_in}
        return fallback
    except Exception:
        logging.exception("Prompt enhancement crashed")
        return fallback


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

__all__ = ['_extract_campaign_entities', '_enhance_image_prompt', '_clean_image_title', '_fallback_image_title', '_generate_image_title', '_gallery_entry_title']
