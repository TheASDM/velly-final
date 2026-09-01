"""The image-prompt compiler.

    user request
      → compiler model (Claude or ChatGPT)
      → structured JSON scene description
      → scene_prompt
      → selected style preset (assembled from configuration, not written by
        the model)
      → hard constraints
      → compiled_prompt
      → OpenAI image API

vos/image_prompt_compiler.json is the source of truth for all of it: the
compiler's instructions, the output contract, the reference-image policy, and
the house style. This module reads that file and does four separate jobs —
build the request, call a provider, validate the answer, assemble the prompt —
so a bad image can be traced to whichever one failed.

Two providers exist so the same request can be compiled both ways and the
results compared. Which one is live is a DM setting; a player has no say and
is never shown that the choice exists.
"""
from ..imports import *
from ..symbols import *
from ..config import *

# ── Providers ───────────────────────────────────────────────────────────────

IMAGE_COMPILER_PROVIDERS = {
    "claude": {
        "key": "claude",
        "label": "Powered by Claude",
        "vendor": "Anthropic",
    },
    "chatgpt": {
        "key": "chatgpt",
        "label": "Powered by ChatGPT",
        "vendor": "OpenAI",
    },
}
# Used when the DB holds nothing and the env names nothing valid.
IMAGE_COMPILER_FALLBACK_PROVIDER = "claude"
# Deployment default; the DM's console setting overrides it.
IMAGE_COMPILER_PROVIDER_ENV = (
    os.environ.get("IMAGE_COMPILER_PROVIDER", "").strip().lower() or None
)

IMAGE_COMPILER_CLAUDE_MODEL = os.environ.get(
    "IMAGE_COMPILER_CLAUDE_MODEL", "claude-opus-5")
IMAGE_COMPILER_OPENAI_MODEL = os.environ.get(
    "IMAGE_COMPILER_OPENAI_MODEL", "gpt-5")
# Compiling is more work than the old one-paragraph rewrite was: it returns a
# dozen fields and thinks about composition first. Both numbers are generous
# on purpose — a truncated answer fails validation and costs the whole call.
IMAGE_COMPILER_MAX_TOKENS = int(os.environ.get("IMAGE_COMPILER_MAX_TOKENS", "12000"))
IMAGE_COMPILER_TIMEOUT_S = int(os.environ.get("IMAGE_COMPILER_TIMEOUT_S", "120"))
IMAGE_COMPILER_EFFORT = os.environ.get("IMAGE_COMPILER_EFFORT", "medium")
# Logs the whole compiler exchange at INFO. Off in production: it is the
# difference between "the compiler misread the request" and "the image model
# rendered a good prompt badly", which is worth a lot while iterating and
# nothing once the pipeline is settled.
IMAGE_COMPILER_DEBUG = os.environ.get("IMAGE_COMPILER_DEBUG", "0") == "1"

# Roles a supplied reference image can play. Vocabulary comes from the
# configuration so there is one list, not one per layer.
REFERENCE_ROLES = tuple(
    role for role in (IMAGE_COMPILER_CONFIG.get("reference_image_policy") or {})
    if role != "none"
)


def _image_compiler_configured(provider):
    """Whether the server actually has credentials for this provider."""
    if provider == "claude":
        return bool(ANTHROPIC_API_KEY)
    if provider == "chatgpt":
        return bool(os.environ.get("OPENAI_KEY", ""))
    return False


def _normalize_image_compiler(value):
    key = str(value or "").strip().lower()
    # Be forgiving about what the client calls them.
    aliases = {
        "anthropic": "claude", "opus": "claude", "sonnet": "claude",
        "openai": "chatgpt", "gpt": "chatgpt", "chat-gpt": "chatgpt",
    }
    key = aliases.get(key, key)
    return key if key in IMAGE_COMPILER_PROVIDERS else None


def _active_image_compiler():
    """The provider every generation uses unless the DM overrides it per
    request: the console setting, else the env default, else Claude."""
    stored = _normalize_image_compiler(
        _get_app_setting(IMAGE_COMPILER_SETTING_KEY))
    if stored:
        return stored
    return (_normalize_image_compiler(IMAGE_COMPILER_PROVIDER_ENV)
            or IMAGE_COMPILER_FALLBACK_PROVIDER)


def _set_active_image_compiler(value):
    provider = _normalize_image_compiler(value)
    if not provider:
        raise ValueError(f"Unknown prompt compiler '{value}'")
    _set_app_setting(IMAGE_COMPILER_SETTING_KEY, provider)
    logging.info("Prompt compiler set to %s", provider)
    return provider


def _resolve_image_compiler(requested=None):
    """Pick the provider for one generation.

    A requested provider wins (the DM's comparison buttons); otherwise the
    active setting. Either way, a provider with no credentials on this server
    hands over to one that has them rather than failing the image.
    """
    provider = _normalize_image_compiler(requested) or _active_image_compiler()
    if _image_compiler_configured(provider):
        return provider
    for candidate in IMAGE_COMPILER_PROVIDERS:
        if _image_compiler_configured(candidate):
            logging.warning(
                "Prompt compiler %s is not configured — using %s",
                provider, candidate,
            )
            return candidate
    return provider


def _image_compiler_options():
    """The DM console's picker payload."""
    return [
        {
            "key": key,
            "label": meta["label"],
            "vendor": meta["vendor"],
            "model": (IMAGE_COMPILER_CLAUDE_MODEL if key == "claude"
                      else IMAGE_COMPILER_OPENAI_MODEL),
            "configured": _image_compiler_configured(key),
        }
        for key, meta in IMAGE_COMPILER_PROVIDERS.items()
    ]


# ── Resolving which campaign entities a request is about ─────────────────────
#
# The literal matcher in descriptions.py only fires on phrases someone
# actually typed. "the party" hits; "each party member" does not, and the
# compiler is then told the app knows nobody in this request — so it invents
# five strangers, which is exactly what continuity grounding exists to
# prevent. This pass reads the request against the catalog of canonical names
# and says which entities the finished image has to show, including the ones
# referred to indirectly: a group, a role, a relationship.
#
# The model is shown names and aliases only. It never sees a description and
# is never asked to write one — the app looks the picked names up in
# descriptions.json itself. Same rule as the house style: a model may choose,
# it may not author.
IMAGE_ENTITY_RESOLVER_ENABLED = os.environ.get("IMAGE_ENTITY_RESOLVER", "1") != "0"
# Haiku by default. This is a lookup, not a composition problem, and it sits
# in front of every generation — the compiler model's economics are wrong for
# a job whose whole output is a list of names.
IMAGE_ENTITY_RESOLVER_CLAUDE_MODEL = os.environ.get(
    "IMAGE_ENTITY_RESOLVER_CLAUDE_MODEL", "claude-haiku-4-5-20251001")
IMAGE_ENTITY_RESOLVER_OPENAI_MODEL = os.environ.get(
    "IMAGE_ENTITY_RESOLVER_OPENAI_MODEL", "gpt-5-mini")
IMAGE_ENTITY_RESOLVER_TIMEOUT_S = int(
    os.environ.get("IMAGE_ENTITY_RESOLVER_TIMEOUT_S", "30"))
IMAGE_ENTITY_RESOLVER_MAX_TOKENS = int(
    os.environ.get("IMAGE_ENTITY_RESOLVER_MAX_TOKENS", "1000"))
# A prompt naming more than a handful of entities is already past what the
# image model will keep straight, and the grounding block has its own cap.
IMAGE_ENTITY_RESOLVER_MAX_NAMES = int(
    os.environ.get("IMAGE_ENTITY_RESOLVER_MAX_NAMES", "8"))

ENTITY_RESOLVER_SYSTEM = """You resolve an image request against a catalog of \
canonical campaign entities. You do not write image prompts and you do not \
describe anyone.

Return every entity from the catalog that the finished image must actually \
depict, including entities the request refers to indirectly:
- a group by name, by role, or by any of its aliases ("each party member", \
"the whole group", "all five of them") resolves to the GROUP entry, not to \
its members individually
- a person named by role, species, class, or relationship ("the gnome \
trickster", "her fiance", "the fog warden") resolves to that person
- a place, item, or creature named the same indirect way resolves the same way

Rules:
- Use the exact canonical name as written in the catalog, never an alias and \
never a name that is not in the catalog.
- Include an entity only when it should be visible in the image. A place \
mentioned as backstory is not in the picture.
- If the request is about no catalog entity at all, return an empty list. \
Guessing is worse than nothing here: a wrong name puts the wrong face in the \
picture.

Return one JSON object and nothing else: {"entities": ["Exact Canonical Name"]}"""


def _entity_resolver_provider():
    """Whichever vendor this server has credentials for, Anthropic first.

    Deliberately not the DM's compiler setting: that knob exists so the two
    prompt compilers can be compared, and resolution is not part of the
    comparison.
    """
    if ANTHROPIC_API_KEY:
        return "claude"
    if os.environ.get("OPENAI_KEY", ""):
        return "chatgpt"
    return None


def _resolver_call_claude(system, user_message):
    response = http_requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": IMAGE_ENTITY_RESOLVER_CLAUDE_MODEL,
            "max_tokens": IMAGE_ENTITY_RESOLVER_MAX_TOKENS,
            "system": system,
            "messages": [{"role": "user", "content": user_message}],
        },
        timeout=IMAGE_ENTITY_RESOLVER_TIMEOUT_S,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Anthropic {response.status_code}: {response.text[:300]}")
    for block in response.json().get("content") or []:
        if block.get("type") == "text" and (block.get("text") or "").strip():
            return block["text"]
    raise RuntimeError("Anthropic returned no text block")


def _resolver_call_chatgpt(system, user_message):
    response = http_requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {os.environ.get('OPENAI_KEY', '')}",
            "Content-Type": "application/json",
        },
        json={
            "model": IMAGE_ENTITY_RESOLVER_OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_message},
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": IMAGE_ENTITY_RESOLVER_MAX_TOKENS,
        },
        timeout=IMAGE_ENTITY_RESOLVER_TIMEOUT_S,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"OpenAI {response.status_code}: {response.text[:300]}")
    choices = response.json().get("choices") or []
    text = ((choices[0].get("message") or {}).get("content") or "") if choices else ""
    if not text.strip():
        raise RuntimeError("OpenAI returned no message content")
    return text


ENTITY_RESOLVER_CALLERS = {
    "claude": _resolver_call_claude,
    "chatgpt": _resolver_call_chatgpt,
}


def _parse_resolved_entities(text):
    """The answer's entity list, however the model wrapped it."""
    data = _parse_compiler_json(text)
    names = data.get("entities")
    if isinstance(names, str):
        names = [names]
    if not isinstance(names, list):
        return []
    cleaned = []
    for name in names:
        value = re.sub(r"\s+", " ", str(name or "")).strip()
        if value and value not in cleaned:
            cleaned.append(value)
    return cleaned[:IMAGE_ENTITY_RESOLVER_MAX_NAMES]


def _resolve_prompt_entities(raw_prompt, already_matched=()):
    """Curated grounding for entities the request only implies. Never raises.

    Returns entries in the same shape as the literal matcher, minus anything
    already matched. Every failure — disabled, no credentials, no catalog, a
    provider error, an unparseable answer, a hallucinated name — degrades to
    an empty list, which is exactly the behavior that existed before this
    pass. Resolution improves grounding; it can never cost an image.
    """
    prompt = str(raw_prompt or "").strip()
    if not IMAGE_ENTITY_RESOLVER_ENABLED or not prompt:
        return []
    catalog = _descriptions_catalog()
    if not catalog:
        return []
    provider = _entity_resolver_provider()
    if not provider:
        return []

    known = ", ".join(
        (m.get("name") or "").strip()
        for m in (already_matched or ())
        if (m.get("name") or "").strip()
    )
    user_message = "\n\n".join(part for part in (
        f"CATALOG:\n{catalog}",
        f"IMAGE REQUEST:\n{prompt}",
        f"Already resolved by exact name match: {known}" if known else "",
        "Return the JSON object now.",
    ) if part)

    started = time.time()
    try:
        answer = ENTITY_RESOLVER_CALLERS[provider](
            ENTITY_RESOLVER_SYSTEM, user_message)
        names = _parse_resolved_entities(answer)
    except Exception as exc:
        logging.warning("Entity resolver (%s) failed: %s", provider, exc)
        if IMAGE_COMPILER_DEBUG:
            logging.exception("Entity resolver (%s) traceback", provider)
        return []

    # A name the catalog does not hold is dropped here rather than trusted:
    # the lookup is the app's, so an invented name simply finds nothing.
    resolved = _lookup_descriptions_by_name(names, already_matched)
    logging.info(
        "  Entity resolver (%s) in %.1fs: asked for %s, grounded %s",
        provider, time.time() - started,
        ", ".join(names) or "nothing",
        ", ".join(m["name"] for m in resolved) or "nothing new",
    )
    return resolved


# ── Building the compiler request ────────────────────────────────────────────

def _preset_style_text(style_key):
    """The assembled style block for a preset, or '' for an unknown one.

    Callers can pass their own text instead — the legacy IMAGE_STYLE_PROMPT
    path has a style with no preset behind it.
    """
    return (ART_STYLE_PRESETS.get(style_key or "") or {}).get("style") or ""


def _compiler_scene_kind(style_key):
    preset = ART_STYLE_PRESETS.get(style_key or "") or {}
    return preset.get("kind") or "other"


def _normalize_reference_roles(references):
    """Accept [{'role': ..., 'note': ...}] or ['identity_reference', ...].

    Returns [{'role', 'note'}] with only roles the configuration knows about.

    Roles only, not bytes. The compiler is told what each supplied reference
    controls, but nothing yet uploads images or sends them to the image API —
    that needs storage, a role-assignment UI, and a move to
    /v1/images/edits. See the TODO(DESIGN-PROJECT) in studio.md.
    """
    normalized = []
    for item in references or []:
        if isinstance(item, str):
            role, note = item, ""
        elif isinstance(item, dict):
            role = item.get("role") or ""
            note = item.get("note") or item.get("description") or ""
        else:
            continue
        role = str(role).strip().lower().replace("-", "_")
        if role and not role.endswith("_reference"):
            role = f"{role}_reference"
        if role not in REFERENCE_ROLES:
            continue
        normalized.append({"role": role, "note": str(note).strip()[:400]})
    return normalized[:6]


def _compiler_system_prompt(scene_kind, reference_roles=()):
    """Assemble the compiler's instructions out of the configuration.

    Everything here is read from image_prompt_compiler.json — none of the
    behavior rules or the house style is restated in Python.
    """
    cfg = IMAGE_COMPILER_CONFIG
    behavior = cfg.get("compiler_behavior") or {}
    budget = cfg.get("prompt_budget") or {}
    compilation = cfg.get("scene_compilation") or {}
    contract = cfg.get("output_contract") or {}
    fallbacks = cfg.get("fallbacks") or {}
    anti_drift = cfg.get("anti_drift") or {}
    ref_policy = cfg.get("reference_image_policy") or {}
    style_system = cfg.get("style_system") or {}

    def bullets(values):
        return "\n".join(f"- {v}" for v in values or [])

    sections = [behavior.get("role", ""), behavior.get("primary_goal", "")]

    if behavior.get("priority_order"):
        sections.append(
            "PRIORITY ORDER (highest first):\n"
            + bullets(behavior["priority_order"])
        )
    if behavior.get("rules"):
        sections.append("RULES:\n" + bullets(behavior["rules"]))

    words = (budget.get("target_scene_prompt_words") or {}).get(scene_kind)
    length = [f"Target scene_prompt length: {words} words." if words else ""]
    if budget.get("compression_rule"):
        length.append(budget["compression_rule"])
    sections.append("LENGTH:\n" + "\n".join(p for p in length if p))

    if style_system.get("injection_policy"):
        sections.append("STYLE:\n" + style_system["injection_policy"])

    if compilation.get("order"):
        guidance = compilation.get("field_guidance") or {}
        lines = [
            f"- {field}: {guidance.get(field, '')}".rstrip(": ")
            for field in compilation["order"]
        ]
        sections.append("FIELDS, in this order:\n" + "\n".join(lines))

    # Only the avoid-list that applies to what is being drawn.
    avoid_key = ("valley_place_avoid" if scene_kind == "place"
                 else "valley_character_avoid")
    if anti_drift.get(avoid_key):
        sections.append(
            "NEVER ADD UNLESS THE USER ASKED FOR IT:\n"
            + bullets(anti_drift[avoid_key])
        )

    if reference_roles:
        lines = [
            f"- {role}: {ref_policy.get(role, '')}"
            for role in dict.fromkeys(reference_roles)
        ]
        sections.append(
            "REFERENCE IMAGES supplied with this request:\n"
            + "\n".join(lines)
        )
    elif ref_policy.get("none"):
        sections.append("REFERENCE IMAGES: none. " + ref_policy["none"])

    if fallbacks:
        sections.append(
            "WHEN THE REQUEST IS THIN OR CONTRADICTORY:\n"
            + bullets(fallbacks.values())
        )

    sections.append(
        "OUTPUT:\n"
        + (contract.get("instruction") or "Return one valid JSON object and nothing else.")
        + "\nSchema:\n"
        + json.dumps(contract.get("schema") or {}, indent=2)
        + "\n"
        + (contract.get("assembly") or "")
    )

    for example in (cfg.get("examples") or [])[:6]:
        request = (example.get("input") or {})
        if _compiler_scene_kind(request.get("preset_key")) != scene_kind:
            continue
        sections.append(
            "EXAMPLE REQUEST:\n" + str(request.get("user_request", ""))
            + "\n\nEXAMPLE scene_prompt:\n" + str(example.get("scene_prompt_example", ""))
        )
        break

    return "\n\n".join(section.strip() for section in sections if section and section.strip())


def _compiler_user_message(raw_prompt, style_key, matched_entries, references=()):
    """The request itself, plus the continuity context the app already holds.

    Canonical character descriptions are handed over verbatim to be reused,
    not rewritten: a face that gets re-invented every generation is the thing
    continuity context exists to prevent.
    """
    preset = ART_STYLE_PRESETS.get(style_key or "") or {}
    blocks = [
        f"preset_key: {style_key or 'photoreal'}",
        f"scene_kind: {_compiler_scene_kind(style_key)}",
        f"selected style (already handled by the application — do not restate "
        f"it): {preset.get('label') or 'none'}",
        f"USER REQUEST:\n{raw_prompt}",
    ]

    continuity = []
    for match in matched_entries or []:
        name = (match.get("name") or "Unknown").strip()
        text = re.sub(r"\s+", " ", str(match.get("text") or "")).strip()
        if not text:
            continue
        continuity.append(f"### {name}\n{text[:ENHANCE_ENTITY_CHARS]}")
    if continuity:
        blocks.append(
            "CHARACTER / LOCATION CONTINUITY — canonical descriptions the app "
            "already stores for names in this request. Reuse these visual "
            "facts as written; do not redesign them, and do not add lore that "
            "is not visible in the finished image.\n\n"
            + "\n\n".join(continuity)
        )
    else:
        blocks.append(
            "CHARACTER / LOCATION CONTINUITY: none of the names in this "
            "request are known to the app. Invent nothing about the setting "
            "beyond what the user wrote."
        )

    if references:
        lines = []
        for ref in references:
            note = f" — {ref['note']}" if ref.get("note") else ""
            lines.append(f"- {ref['role']}{note}")
        blocks.append("REFERENCE IMAGES ATTACHED:\n" + "\n".join(lines))

    # Always name-aware. Without the catalog the compiler cannot tell a
    # campaign name it half-recognizes from a word it should render
    # literally, and "Noname" is a person here, not an instruction.
    catalog = _descriptions_catalog()
    if catalog:
        blocks.append(
            "ENTITY CATALOG — the only real names in this campaign. Treat a "
            "name from this list as that specific entity. Do not add anyone "
            "the request did not ask for, and do not invent visual facts for "
            "a catalog name whose description was not supplied above.\n\n"
            + catalog
        )

    blocks.append("Return the JSON object now.")
    return "\n\n".join(blocks)


# ── Calling a provider ───────────────────────────────────────────────────────

def _compiler_call_claude(system, user_message):
    """Anthropic Messages. No temperature: the current Opus models reject
    sampling parameters outright and depth is set with effort instead."""
    response = http_requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": IMAGE_COMPILER_CLAUDE_MODEL,
            "max_tokens": IMAGE_COMPILER_MAX_TOKENS,
            "output_config": {"effort": IMAGE_COMPILER_EFFORT},
            "system": system,
            "messages": [{"role": "user", "content": user_message}],
        },
        timeout=IMAGE_COMPILER_TIMEOUT_S,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Anthropic {response.status_code}: {response.text[:300]}")
    for block in response.json().get("content") or []:
        if block.get("type") == "text" and (block.get("text") or "").strip():
            return block["text"]
    raise RuntimeError("Anthropic returned no text block")


def _compiler_call_chatgpt(system, user_message):
    """OpenAI Chat Completions in JSON mode.

    max_completion_tokens rather than max_tokens, and no temperature: the
    reasoning models reject both of the older parameters, and this call
    failing means the image goes out with an uncompiled prompt.
    """
    response = http_requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {os.environ.get('OPENAI_KEY', '')}",
            "Content-Type": "application/json",
        },
        json={
            "model": IMAGE_COMPILER_OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_message},
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": IMAGE_COMPILER_MAX_TOKENS,
        },
        timeout=IMAGE_COMPILER_TIMEOUT_S,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"OpenAI {response.status_code}: {response.text[:300]}")
    choices = response.json().get("choices") or []
    text = ((choices[0].get("message") or {}).get("content") or "") if choices else ""
    if not text.strip():
        raise RuntimeError("OpenAI returned no message content")
    return text


IMAGE_COMPILER_CALLERS = {
    "claude": _compiler_call_claude,
    "chatgpt": _compiler_call_chatgpt,
}


# ── Validating the answer ────────────────────────────────────────────────────

COMPILER_TEXT_FIELDS = (
    "subject_and_identity",
    "appearance",
    "wardrobe_and_props",
    "pose_action_expression",
    "environment",
    "spatial_relationships",
    "composition_and_camera",
    "scene_specific_lighting",
    "exact_text",
)


def _parse_compiler_json(text):
    """Parse the model's answer as JSON, tolerating a fenced block.

    The contract forbids fences and prose, but a refusal to parse costs the
    whole compilation, so a stray ```json wrapper is unwrapped rather than
    treated as a failure.
    """
    body = str(text or "").strip()
    if body.startswith("```"):
        body = re.sub(r"^```[a-zA-Z]*\s*", "", body)
        body = re.sub(r"\s*```$", "", body).strip()
    try:
        return json.loads(body)
    except (ValueError, TypeError):
        pass
    start, end = body.find("{"), body.rfind("}")
    if start >= 0 and end > start:
        return json.loads(body[start:end + 1])
    raise ValueError("compiler response was not JSON")


def _validate_compiler_record(data, style_key):
    """Coerce a parsed response to the output contract.

    Returns the record. Raises ValueError when there is no usable scene
    prompt, which is the only field the pipeline genuinely cannot do without.
    """
    if not isinstance(data, dict):
        raise ValueError("compiler response was not a JSON object")

    def text_or_none(value):
        if value is None:
            return None
        text = re.sub(r"[ \t]+", " ", str(value)).strip()
        return text or None

    record = {
        "preset_key": style_key or "photoreal",
        "scene_kind": _compiler_scene_kind(style_key),
    }
    for field in COMPILER_TEXT_FIELDS:
        record[field] = text_or_none(data.get(field))

    constraints = data.get("hard_constraints")
    if isinstance(constraints, str):
        constraints = [constraints]
    record["hard_constraints"] = [
        str(item).strip() for item in (constraints or []) if str(item).strip()
    ][:12]

    scene_prompt = text_or_none(data.get("scene_prompt"))
    if not scene_prompt:
        # Rebuild it from the ordered fields rather than throwing the whole
        # compilation away over one missing key.
        order = ((IMAGE_COMPILER_CONFIG.get("scene_compilation") or {}).get("order")
                 or COMPILER_TEXT_FIELDS)
        parts = [record.get(field) for field in order if record.get(field)]
        scene_prompt = " ".join(parts).strip() or None
    if not scene_prompt:
        raise ValueError("compiler response had no scene_prompt")
    record["scene_prompt"] = scene_prompt

    # The model's own assembled prompt is kept for debugging only. The
    # application assembles the one that is actually sent, so the house style
    # is configuration rather than something rewritten per image.
    record["model_compiled_prompt"] = text_or_none(data.get("compiled_prompt"))

    if record.get("exact_text") and not any(
        "text" in c.lower() for c in record["hard_constraints"]
    ):
        record["hard_constraints"].append(
            "no visible text other than the exact wording given")
    return record


# ── The pipeline ─────────────────────────────────────────────────────────────

def _uncompiled_image_prompt(
    raw_prompt, style_key, matched_entries, error=None, style_text=None,
):
    """The unrefined path: the user's words, the style, the canonical lock.

    Used when the player turns refinement off and whenever a compiler call
    fails — an image never depends on the compilation succeeding.
    """
    style = style_text if style_text is not None else _preset_style_text(style_key)
    return {
        "ok": False,
        "compiled": False,
        "error": error,
        "provider": None,
        "model": None,
        "scene_prompt": None,
        "compiled_prompt": _compose_image_prompt(raw_prompt, style, matched_entries),
        "record": None,
        "hard_constraints": [],
        "references": [],
    }


def _compile_image_prompt(
    raw_prompt, style_key, matched_entries,
    references=None, provider=None, style_text=None,
):
    """Compile a request into the text sent to the image model. Never raises.

    On any failure — no credentials, a provider error, an answer that will not
    validate — falls back to the uncompiled prompt with the reason attached,
    so a broken compiler degrades the art instead of breaking the Studio.
    """
    style = style_text if style_text is not None else _preset_style_text(style_key)
    refs = _normalize_reference_roles(references)
    chosen = _resolve_image_compiler(provider)

    if not IMAGE_COMPILER_CONFIG:
        return _uncompiled_image_prompt(
            raw_prompt, style_key, matched_entries,
            error="compiler configuration missing", style_text=style)
    if not _image_compiler_configured(chosen):
        return _uncompiled_image_prompt(
            raw_prompt, style_key, matched_entries,
            error=f"{chosen} compiler is not configured on this server",
            style_text=style)

    system = _compiler_system_prompt(
        _compiler_scene_kind(style_key), [r["role"] for r in refs])
    user_message = _compiler_user_message(
        raw_prompt, style_key, matched_entries, refs)

    started = time.time()
    try:
        raw_answer = IMAGE_COMPILER_CALLERS[chosen](system, user_message)
        record = _validate_compiler_record(
            _parse_compiler_json(raw_answer), style_key)
    except Exception as exc:
        logging.warning("Prompt compiler (%s) failed: %s", chosen, exc)
        if IMAGE_COMPILER_DEBUG:
            logging.exception("Prompt compiler (%s) traceback", chosen)
        return _uncompiled_image_prompt(
            raw_prompt, style_key, matched_entries,
            error=str(exc)[:300], style_text=style)

    compiled_prompt = _compose_image_prompt(
        record["scene_prompt"], style, matched_entries,
        record["hard_constraints"],
    )
    result = {
        "ok": True,
        "compiled": True,
        "error": None,
        "provider": chosen,
        "model": (IMAGE_COMPILER_CLAUDE_MODEL if chosen == "claude"
                  else IMAGE_COMPILER_OPENAI_MODEL),
        "scene_prompt": record["scene_prompt"],
        "compiled_prompt": compiled_prompt,
        "record": record,
        "hard_constraints": record["hard_constraints"],
        "references": refs,
    }
    _log_compilation(raw_prompt, style_key, result, time.time() - started)
    return result


def _log_compilation(raw_prompt, style_key, result, elapsed_s):
    """One line always; the whole exchange when IMAGE_COMPILER_DEBUG is on.

    The point of the debug dump is telling apart "the compiler misread the
    request" from "the image model rendered a good prompt badly" — which is
    not a distinction you can make from the finished picture alone.
    """
    record = result.get("record") or {}
    logging.info(
        "  Prompt compiled by %s (%s) in %.1fs: %d → %d chars, style %s, "
        "%d constraint(s), refs %s",
        result.get("provider"), result.get("model"), elapsed_s,
        len(raw_prompt or ""), len(result.get("compiled_prompt") or ""),
        style_key or "none", len(result.get("hard_constraints") or []),
        ", ".join(r["role"] for r in result.get("references") or []) or "none",
    )
    if not IMAGE_COMPILER_DEBUG:
        return
    logging.info(
        "IMAGE COMPILER DEBUG\n"
        "  request: %s\n  preset: %s\n  provider: %s (%s)\n"
        "  reference roles: %s\n  structured: %s\n"
        "  scene_prompt: %s\n  compiled_prompt: %s",
        raw_prompt, style_key, result.get("provider"), result.get("model"),
        [r["role"] for r in result.get("references") or []] or None,
        json.dumps(record, indent=2, ensure_ascii=False),
        result.get("scene_prompt"), result.get("compiled_prompt"),
    )

__all__ = [
    'IMAGE_COMPILER_PROVIDERS',
    'IMAGE_COMPILER_FALLBACK_PROVIDER',
    'IMAGE_COMPILER_PROVIDER_ENV',
    'IMAGE_COMPILER_CLAUDE_MODEL',
    'IMAGE_COMPILER_OPENAI_MODEL',
    'IMAGE_COMPILER_MAX_TOKENS',
    'IMAGE_COMPILER_TIMEOUT_S',
    'IMAGE_COMPILER_EFFORT',
    'IMAGE_COMPILER_DEBUG',
    'REFERENCE_ROLES',
    'COMPILER_TEXT_FIELDS',
    'IMAGE_COMPILER_CALLERS',
    '_image_compiler_configured',
    '_normalize_image_compiler',
    '_active_image_compiler',
    '_set_active_image_compiler',
    '_resolve_image_compiler',
    '_image_compiler_options',
    '_preset_style_text',
    '_compiler_scene_kind',
    '_normalize_reference_roles',
    '_compiler_system_prompt',
    '_compiler_user_message',
    '_compiler_call_claude',
    '_compiler_call_chatgpt',
    '_parse_compiler_json',
    '_validate_compiler_record',
    'IMAGE_ENTITY_RESOLVER_ENABLED',
    'IMAGE_ENTITY_RESOLVER_CLAUDE_MODEL',
    'IMAGE_ENTITY_RESOLVER_OPENAI_MODEL',
    'IMAGE_ENTITY_RESOLVER_TIMEOUT_S',
    'IMAGE_ENTITY_RESOLVER_MAX_TOKENS',
    'IMAGE_ENTITY_RESOLVER_MAX_NAMES',
    'ENTITY_RESOLVER_SYSTEM',
    'ENTITY_RESOLVER_CALLERS',
    '_entity_resolver_provider',
    '_resolver_call_claude',
    '_resolver_call_chatgpt',
    '_parse_resolved_entities',
    '_resolve_prompt_entities',
    '_uncompiled_image_prompt',
    '_compile_image_prompt',
    '_log_compilation',
]
