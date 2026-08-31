from ..imports import *
from ..symbols import *
from ..config import *

# ── Image-prompt enhancement (Haiku as image-prompt engineer) ────────────────
# Takes the user's raw prompt + any campaign entities they named (resolved
# against the RAG name/alias index) and lets Haiku rewrite it into a vivid,
# specific image prompt that keeps named characters/locations faithful to
# their canonical descriptions. Falls back to the raw prompt if Anthropic
# is unreachable or returns an error — image generation never depends on
# the enhancement step succeeding.

# The Studio's prompt engineer. Opus rather than the chat model: this runs
# once per generated image, a handful of times a day, and it is the step that
# decides whether a piece comes out looking like the campaign. Enzo's
# conversational model (ANTHROPIC_MODEL) is deliberately left alone — that one
# runs on every chat turn and has different economics.
ENHANCE_MODEL = os.environ.get("ENHANCE_MODEL", "claude-opus-5")
# Kept for older models set via ENHANCE_MODEL; no longer sent by default.
# Opus 5 rejects temperature/top_p/top_k with a 400, and this code swallows
# request failures and quietly falls back to the un-enhanced prompt — so
# sending it would have looked exactly like the drift it was meant to fix.
ENHANCE_TEMPERATURE = float(os.environ.get("ENHANCE_TEMPERATURE", "0.2"))
# low | medium | high | xhigh | max. The enhancer is doing real work, the
# title is one sentence.
ENHANCE_EFFORT = os.environ.get("ENHANCE_EFFORT", "medium")
IMAGE_TITLE_EFFORT = os.environ.get("IMAGE_TITLE_EFFORT", "low")
# Room for adaptive thinking as well as the prompt itself: on Opus, thinking
# tokens come out of max_tokens, and 900 was tight enough to risk truncating
# the rewrite mid-sentence.
ENHANCE_MAX_TOKENS = int(os.environ.get("ENHANCE_MAX_TOKENS", "8000"))
ENHANCE_TIMEOUT_S = int(os.environ.get("ENHANCE_TIMEOUT_S", "30"))
ENHANCE_MAX_ENTITIES = int(os.environ.get("ENHANCE_MAX_ENTITIES", "6"))
ENHANCE_ENTITY_CHARS = int(os.environ.get("ENHANCE_ENTITY_CHARS", "3000"))
# Headroom, not a budget.
#
# These were 3900 and 2800, which is well under what the image API accepts and
# meant a prompt naming several campaign entities spent its whole allowance on
# grounding and started throwing pieces away — the house style first. Set high
# enough that ordinary prompts are never trimmed at all; they exist now only so
# a runaway cannot post a megabyte to OpenAI. Both stay env-overridable.
IMAGE_PROMPT_MAX_CHARS = int(os.environ.get("IMAGE_PROMPT_MAX_CHARS", "30000"))
FINAL_GROUNDING_MAX_CHARS = int(os.environ.get("FINAL_GROUNDING_MAX_CHARS", "20000"))
IMAGE_TITLE_MODEL = os.environ.get("IMAGE_TITLE_MODEL", ENHANCE_MODEL)
IMAGE_TITLE_TIMEOUT_S = int(os.environ.get("IMAGE_TITLE_TIMEOUT_S", "12"))

# Hand-curated visual-description grounding for the art enhancer. Lives in
# the repo at chatbot/descriptions.json; the container bind-mounts the repo
# at /site so we read straight from there. Falls back to (none) when the
# file is missing or malformed — RAG keyword matching still works without
# it, the result is just less specific.
DEFAULT_DESCRIPTIONS_FILE = Path("/site/chatbot/descriptions.json")
if not DEFAULT_DESCRIPTIONS_FILE.exists():
    DEFAULT_DESCRIPTIONS_FILE = Path(__file__).resolve().parent / "descriptions.json"
DESCRIPTIONS_FILE = Path(os.environ.get("ART_DESCRIPTIONS_FILE", str(DEFAULT_DESCRIPTIONS_FILE)))
_DESCRIPTIONS_CACHE_LOCK = threading.RLock()
_DESCRIPTIONS_CACHE = {
    "path": None,
    "mtime_ns": None,
    "raw": {},
    "index": {},
}

# Aliases shorter than this rarely identify a unique entity (e.g. "lo",
# "tl", "rox"); we still let them through, but the loader excludes
# obviously generic single-character or numeric strings.
ALIAS_MIN_LEN = 2


def _normalize_description_phrase(value):
    value = unicodedata.normalize("NFKD", str(value))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return (
        value
        .replace("’", "'")
        .replace("‘", "'")
        .replace("`", "'")
        .lower()
    )


def _flatten_descriptions(raw):
    """Build a {lowercase_phrase: (canonical_name, desc_string)} index from
    the descriptions.json schema. Groups are expanded so a match on
    "the party" returns the concatenated descriptions of all members.
    """
    if not isinstance(raw, dict):
        return {}
    name_to_desc = {}      # canonical_name → desc
    name_to_aliases = {}   # canonical_name → [alias, ...]

    for canon, payload in (raw.get("locations") or {}).items():
        if isinstance(payload, str):
            name_to_desc[canon] = payload
            name_to_aliases[canon] = []
        elif isinstance(payload, dict):
            name_to_desc[canon] = payload.get("desc", "")
            name_to_aliases[canon] = list(payload.get("aliases") or [])

    for section in ("player_characters", "npcs", "creatures", "items"):
        for canon, payload in (raw.get(section) or {}).items():
            if isinstance(payload, dict):
                name_to_desc[canon] = payload.get("desc", "")
                name_to_aliases[canon] = list(payload.get("aliases") or [])

    # Groups expand into the concatenated member descs at index-build time.
    # Each group entry maps its aliases (and canonical name) to a string
    # that lists every member's visual description in order.
    group_index = {}
    for canon, payload in (raw.get("groups") or {}).items():
        if not isinstance(payload, dict):
            continue
        member_names = payload.get("members") or []
        parts = []
        for m in member_names:
            d = name_to_desc.get(m)
            if d:
                parts.append(f"- {m}: {d}")
        if not parts:
            continue
        combined = (
            f"Group reference — {canon}. The named members and their "
            "individual visual descriptions are:\n" + "\n".join(parts)
        )
        group_index[_normalize_description_phrase(canon)] = (canon, combined)
        for alias in (payload.get("aliases") or []):
            if alias and len(alias) >= ALIAS_MIN_LEN:
                group_index[_normalize_description_phrase(alias)] = (canon, combined)

    # Locations + PCs + NPCs: each canonical name AND every alias maps to
    # the canonical name and its desc. Canonical name wins on collision.
    index = {}
    for canon, desc in name_to_desc.items():
        if not desc:
            continue
        for key in [canon] + name_to_aliases.get(canon, []):
            if not key or len(key) < ALIAS_MIN_LEN:
                continue
            k = _normalize_description_phrase(key)
            # First-write wins, so collisions resolve to the entry whose
            # canonical name appears earliest in the JSON file.
            index.setdefault(k, (canon, desc))

    # Group entries last so they overwrite — if someone wrote a group alias
    # that collides with a single-entity alias, the group wins (it includes
    # more context and is the more useful match).
    index.update(group_index)
    return index


def _load_descriptions_data():
    """Read descriptions.json once per mtime and return (raw, flattened_index).

    Live edits still take effect without a restart, but normal generation no
    longer reparses and reflattens the same file for every request.
    """
    try:
        stat = DESCRIPTIONS_FILE.stat()
    except FileNotFoundError:
        return {}, {}

    path_key = str(DESCRIPTIONS_FILE)
    with _DESCRIPTIONS_CACHE_LOCK:
        if (
            _DESCRIPTIONS_CACHE["path"] == path_key
            and _DESCRIPTIONS_CACHE["mtime_ns"] == stat.st_mtime_ns
        ):
            return _DESCRIPTIONS_CACHE["raw"], _DESCRIPTIONS_CACHE["index"]

        try:
            with open(DESCRIPTIONS_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
            index = _flatten_descriptions(raw)
        except Exception:
            logging.exception("Failed to load %s", DESCRIPTIONS_FILE)
            raw, index = {}, {}

        _DESCRIPTIONS_CACHE.update({
            "path": path_key,
            "mtime_ns": stat.st_mtime_ns,
            "raw": raw if isinstance(raw, dict) else {},
            "index": index if isinstance(index, dict) else {},
        })
        return _DESCRIPTIONS_CACHE["raw"], _DESCRIPTIONS_CACHE["index"]


def _load_descriptions_index():
    """Return the flattened descriptions lookup index, or {} on failure."""
    try:
        _raw, index = _load_descriptions_data()
        return index
    except FileNotFoundError:
        return {}
    except Exception:
        logging.exception("Failed to load %s", DESCRIPTIONS_FILE)
        return {}


def _grounded_entity_names(matched_entries):
    names, seen = [], set()
    for m in matched_entries or []:
        name = (m.get("name") or "").strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        names.append(name)
    return names


def _compact_grounding_text(text, max_chars=360):
    """Trim to at most `max_chars`, ellipsis included.

    The ellipsis used to be appended after the trim, so this returned
    max_chars + 3 and every caller budgeting against it was quietly three
    characters over.
    """
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(text) <= max_chars:
        return text
    if max_chars <= 3:
        return text[:max_chars]
    budget = max_chars - 3
    cut = text[:budget].rsplit(" ", 1)[0].rstrip(" ,;:")
    return (cut or text[:budget]).rstrip() + "..."


def _final_visual_grounding_block(matched_entries):
    """Build the non-LLM character/location lock added to the image prompt.

    Only curated descriptions.json entries are treated as final visual facts.
    RAG fallback entries can still guide Haiku, but wiki snippets are not always
    visual enough to inject as hard constraints into the image model.
    """
    lines, seen = [], set()
    header = (
        "Canonical visual reference, required for named campaign entities: "
        "use these facts exactly; keep ancestry, age, body scale, hair color, "
        "skin tone, distinctive features, and signature items unchanged unless "
        "the player explicitly asks for a disguise or transformation."
    )
    remaining = max(FINAL_GROUNDING_MAX_CHARS - len(header) - 2, 0)
    if remaining <= 0:
        return ""

    for m in matched_entries or []:
        if m.get("source_file") != "descriptions.json":
            continue
        name = (m.get("name") or "").strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        raw_desc = m.get("text") or ""
        # Group descriptions intentionally carry multiple characters. Give
        # them more room so prompts like "the party" still preserve each PC's
        # identity details instead of only the first few names in the list.
        # Was 2400 / 520. A curated description is hand-written and every
        # line of it is there to keep a character recognisable; clipping it at
        # 520 characters is how "her left hand is scarred" stopped arriving.
        desc_max = 8000 if str(raw_desc).startswith("Group reference") else 4000
        desc = _compact_grounding_text(raw_desc, max_chars=desc_max)
        if not desc:
            continue
        line = f"- {name}: {desc}"
        projected = sum(len(existing) + 1 for existing in lines) + len(line)
        if projected > remaining:
            available = remaining - sum(len(existing) + 1 for existing in lines)
            if available > 120:
                lines.append(_compact_grounding_text(line, available))
            break
        lines.append(line)

    if not lines:
        return ""
    return header + "\n" + "\n".join(lines)


def _compose_final_image_prompt(style_prefix, image_prompt_body, matched_entries):
    """Join style, deterministic visual grounding, and scene text.

    The visual reference block is preserved first and the scene text is trimmed
    only if the combined prompt would exceed the configured image prompt cap.
    """
    image_prompt_body = str(image_prompt_body or "").strip()
    grounding = _final_visual_grounding_block(matched_entries)
    fixed_parts = [p.strip() for p in (style_prefix, grounding) if p and p.strip()]
    fixed = "\n\n".join(fixed_parts)
    full_prompt = "\n\n".join(p for p in (fixed, image_prompt_body) if p).strip()
    if len(full_prompt) <= IMAGE_PROMPT_MAX_CHARS:
        return full_prompt

    if not image_prompt_body:
        return fixed[:IMAGE_PROMPT_MAX_CHARS].rstrip()

    # The style prefix is the last thing to go, never the first.
    #
    # This used to drop `fixed` — style AND grounding — whenever the body left
    # under 300 characters of room, so exactly the richest prompts, the ones
    # naming several campaign entities, came back with no house style on them
    # at all. That is what "the Studio has drifted" looks like from outside:
    # most images right, the elaborate ones inexplicably generic.
    style = str(style_prefix or "").strip()
    separator_len = 2 if fixed else 0
    body_budget = IMAGE_PROMPT_MAX_CHARS - len(fixed) - separator_len
    if body_budget < 300:
        # Give up the visual-grounding block first: the enhancer has already
        # woven those details into the body, so it is the redundant half.
        fixed = style
        separator_len = 2 if fixed else 0
        body_budget = IMAGE_PROMPT_MAX_CHARS - len(fixed) - separator_len
    if body_budget < 300 and style:
        # Still no room: keep the style and give the body whatever is left,
        # rather than shipping a beautifully grounded prompt in no style.
        body_budget = max(0, IMAGE_PROMPT_MAX_CHARS - len(style) - 2)

    trimmed_body = _compact_grounding_text(image_prompt_body, max_chars=body_budget)
    return "\n\n".join(p for p in (fixed, trimmed_body) if p).strip()


def _match_descriptions(prompt, index):
    """Scan the prompt for n-gram matches against the descriptions index.
    Returns a list of {name, text, source} dicts (shape compatible with
    the RAG matches), newest match first, deduped by canonical name.
    """
    if not index:
        return []
    normalized_prompt = _normalize_description_phrase(prompt)
    words = re.findall(r"[\w'\"]+", normalized_prompt)
    matched, seen = [], set()
    # Walk n-grams 1..5 like _keyword_match does.
    for n in range(min(5, len(words)), 0, -1):
        for i in range(len(words) - n + 1):
            phrase = " ".join(words[i:i + n])
            hit = index.get(phrase)
            if not hit:
                continue
            canon, desc = hit
            if canon in seen:
                continue
            seen.add(canon)
            matched.append({
                "name": canon,
                "text": desc,
                "source_file": "descriptions.json",
                "page_id": f"desc:{canon}",
            })
    return matched


def _relationship_description_matches(prompt, desc_index, already_matched):
    normalized = _normalize_description_phrase(prompt)
    matched_names = {m.get("name") for m in already_matched}
    additions = []

    def add(canon_name):
        if canon_name in matched_names:
            return
        hit = desc_index.get(_normalize_description_phrase(canon_name))
        if not hit:
            return
        name, desc = hit
        matched_names.add(name)
        additions.append({
            "name": name,
            "text": desc,
            "source_file": "descriptions.json",
            "page_id": f"desc:{name}",
        })

    has_noname = re.search(r"\b(no[- ]?name|noname)\b", normalized)
    has_fiance = re.search(r"\bfiancee?\b", normalized) or re.search(r"\bfiance\b", normalized)
    if has_noname and has_fiance:
        add("Maruk Grommarg")

    return additions

__all__ = ['ENHANCE_MODEL', 'ENHANCE_TEMPERATURE', 'ENHANCE_MAX_TOKENS', 'ENHANCE_TIMEOUT_S', 'ENHANCE_EFFORT', 'IMAGE_TITLE_EFFORT', 'ENHANCE_MAX_ENTITIES', 'ENHANCE_ENTITY_CHARS', 'IMAGE_PROMPT_MAX_CHARS', 'FINAL_GROUNDING_MAX_CHARS', 'IMAGE_TITLE_MODEL', 'IMAGE_TITLE_TIMEOUT_S', 'DEFAULT_DESCRIPTIONS_FILE', 'DESCRIPTIONS_FILE', '_DESCRIPTIONS_CACHE_LOCK', '_DESCRIPTIONS_CACHE', 'ALIAS_MIN_LEN', '_normalize_description_phrase', '_flatten_descriptions', '_load_descriptions_data', '_load_descriptions_index', '_grounded_entity_names', '_compact_grounding_text', '_final_visual_grounding_block', '_compose_final_image_prompt', '_match_descriptions', '_relationship_description_matches']
