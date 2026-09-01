from .imports import *
from .symbols import *

# ── Configuration ────────────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("CAMPAIGN_DATA_DIR", "/app/data"))
LOG_PATH = Path(os.environ.get("LOG_PATH", "/app/logs/chat.log"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "2048"))

OLLAMA_URL = os.environ.get("OLLAMA_URL", "https://ai.raptornet.dev/ollama")
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest")

RAG_TOP_K = int(os.environ.get("RAG_TOP_K", "3"))
RAG_AUTO_THRESHOLD = float(os.environ.get("RAG_AUTO_THRESHOLD", "0.3"))
RAG_LIST_THRESHOLD = float(os.environ.get("RAG_LIST_THRESHOLD", "0.4"))

TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.2"))

# ── Art Studio configuration ──────────────────────────────────────────────────
# Generated images are persisted on a docker-mounted volume so they survive
# container rebuilds. New Studio pieces are private to their creator and the
# DM until explicitly shared; older manifest rows without a visibility field
# are treated as shared for backward compatibility.
GALLERY_DIR = Path(os.environ.get("GALLERY_DIR", "/app/generated-art"))
GALLERY_IMAGES_DIR = GALLERY_DIR / "images"
GALLERY_MANIFEST = GALLERY_DIR / "gallery.json"
GALLERY_MAX_ENTRIES = int(os.environ.get("GALLERY_MAX_ENTRIES", "2000"))
GALLERY_PAGE_LIMIT = int(os.environ.get("GALLERY_PAGE_LIMIT", "60"))

# OpenAI image model selection. Validated at startup — typos in IMAGE_MODEL
# would otherwise blow up at every /api/studio/generate with an opaque
# OpenAI 4xx, which is hard to diagnose from logs.
ALLOWED_IMAGE_MODELS = {
    "gpt-image-1", "gpt-image-2",
    "dall-e-3", "dall-e-2",
}
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "gpt-image-2").strip()
if IMAGE_MODEL and IMAGE_MODEL not in ALLOWED_IMAGE_MODELS:
    raise RuntimeError(
        f"IMAGE_MODEL={IMAGE_MODEL!r} is not in the allowed list "
        f"{sorted(ALLOWED_IMAGE_MODELS)!r}. Fix the env var and restart."
    )

# Per-player monthly cap on Studio image generations. Override via env;
# 0 disables the quota check entirely (useful for local dev).
STUDIO_MONTHLY_QUOTA = int(os.environ.get("STUDIO_MONTHLY_QUOTA", "30"))

# Query expansion: TTL'd in-memory cache per worker. Setting
# QUERY_EXPANSION_ENABLED=0 disables it (saves a Haiku call per chat).
QUERY_EXPANSION_ENABLED = os.environ.get("QUERY_EXPANSION_ENABLED", "1") != "0"
QUERY_EXPANSION_CACHE_TTL = int(os.environ.get("QUERY_EXPANSION_CACHE_TTL", "3600"))
QUERY_EXPANSION_CACHE_MAX = int(os.environ.get("QUERY_EXPANSION_CACHE_MAX", "256"))

# Rate limits applied to /api/chat. Keyed by player auth token when
# present, falling back to remote IP otherwise. Override either via env;
# accepts any Flask-Limiter syntax (e.g. "60/hour;10/minute").
CHAT_RATE_LIMIT = os.environ.get("CHAT_RATE_LIMIT", "30/hour;5/minute")
# Conversation history is capped both by message count (last 40) and by
# total bytes to stop pathological clients from sending megabytes of
# replayed history per request.
MAX_CONVERSATION_BYTES = int(os.environ.get("MAX_CONVERSATION_BYTES", str(60_000)))

# ── PWA runtime configuration ────────────────────────────────────────────────
# One SQLite file for small read/write app state. This keeps the PWA layer
# self-contained and backup-friendly: copy the file, keep the app.
APP_DB_PATH = Path(os.environ.get("APP_DB_PATH", "/app/app-data/vallombrosa.sqlite3"))
# Vector index lives in its own SQLite file so a rebuild can't corrupt
# the app-state DB. Kept next to APP_DB_PATH so backups capture both.
VECTOR_SQLITE_PATH = APP_DB_PATH.parent / "vector_store.sqlite3"
SITE_SOURCE_DIR = Path(os.environ.get("SITE_SOURCE_DIR", "/site"))
if not SITE_SOURCE_DIR.exists():
    SITE_SOURCE_DIR = Path(__file__).resolve().parents[2]
# The table's wall-clock timezone. "Next session" and frontmatter date stamps
# key off this — using UTC flipped the DM's RSVP panel to next week's session
# mid-afternoon US time on game day.
try:
    CAMPAIGN_TZ = ZoneInfo(os.environ.get("CAMPAIGN_TZ", "America/Chicago"))
except Exception:
    CAMPAIGN_TZ = timezone.utc
REBUILD_STATUS_PATH = APP_DB_PATH.parent / "rebuild-status.json"
REBUILD_LOCK_PATH = APP_DB_PATH.parent / "rebuild.lock"
# A save that lands while a rebuild is running queues here; the running job
# re-loops on it before releasing the lock, so no edit is ever left unbuilt.
REBUILD_PENDING_PATH = APP_DB_PATH.parent / "rebuild-pending.json"
REBUILD_PENDING_LOCK_PATH = APP_DB_PATH.parent / "rebuild-pending.lock"
AUTO_REBUILD_ON_WIKI_SAVE = os.environ.get("AUTO_REBUILD_ON_WIKI_SAVE", "1") != "0"
AUTO_KNOWLEDGE_ON_WIKI_SAVE = os.environ.get("AUTO_KNOWLEDGE_ON_WIKI_SAVE", "1") != "0"
REBUILD_COMMAND_TIMEOUT_SECONDS = int(os.environ.get("REBUILD_COMMAND_TIMEOUT_SECONDS", "900"))
# Wiki saves debounce onto a trailing timer instead of rebuilding per
# keystroke-sized edit; knowledge (Enzo corpus) rebuilds ride along at most
# once per interval. "Rebuild Now" in the console bypasses both.
REBUILD_DEBOUNCE_SECONDS = int(os.environ.get("REBUILD_DEBOUNCE_SECONDS", "90"))
REBUILD_KNOWLEDGE_MIN_INTERVAL_SECONDS = int(
    os.environ.get("REBUILD_KNOWLEDGE_MIN_INTERVAL_SECONDS", "900")
)
LORE_DRAFT_DIR = Path(os.environ.get("LORE_DRAFT_DIR", "/app/app-data/lore-drafts"))
LORE_DRAFT_IMAGES_DIR = LORE_DRAFT_DIR / "images"
# ── Session Chronicler ─────────────────────────────────────────────────────
# The DM pastes whatever they have after a session — bullets, a transcript, a
# paragraph — and the chronicler researches it against the wiki, drafts the
# chronicle, illustrates it, and proposes the wiki updates it implies. Drafts
# live beside the lore drafts: runtime data, never the repo.
CHRONICLE_DRAFT_DIR = Path(
    os.environ.get("CHRONICLE_DRAFT_DIR", str(LORE_DRAFT_DIR.parent / "chronicle-drafts"))
)
CHRONICLE_IMAGES_DIR = CHRONICLE_DRAFT_DIR / "images"
# Drafting a chronicle is the one place in this app where a model is asked to
# write several thousand words that have to stay factually pinned to someone
# else's notes. That is the Opus job; the research pass in front of it is a
# lookup, and Haiku's economics are the right ones for a list of names.
CHRONICLE_MODEL = os.environ.get("CHRONICLE_MODEL", "claude-opus-5")
CHRONICLE_EFFORT = os.environ.get("CHRONICLE_EFFORT", "high")
CHRONICLE_MAX_TOKENS = int(os.environ.get("CHRONICLE_MAX_TOKENS", "16000"))
CHRONICLE_TIMEOUT_S = int(os.environ.get("CHRONICLE_TIMEOUT_S", "600"))
CHRONICLE_RESEARCH_MODEL = os.environ.get(
    "CHRONICLE_RESEARCH_MODEL", "claude-haiku-4-5-20251001")
CHRONICLE_RESEARCH_MAX_TOKENS = int(
    os.environ.get("CHRONICLE_RESEARCH_MAX_TOKENS", "2000"))
CHRONICLE_RESEARCH_TIMEOUT_S = int(os.environ.get("CHRONICLE_RESEARCH_TIMEOUT_S", "60"))
# Notes long enough to matter are longer than one retrieval query can serve,
# so the research pass fans out: one retrieval per resolved subject, merged.
CHRONICLE_MAX_QUERIES = int(os.environ.get("CHRONICLE_MAX_QUERIES", "14"))
CHRONICLE_MAX_CONTEXT_BLOCKS = int(os.environ.get("CHRONICLE_MAX_CONTEXT_BLOCKS", "24"))
CHRONICLE_CONTEXT_CHARS = int(os.environ.get("CHRONICLE_CONTEXT_CHARS", "60000"))
CHRONICLE_MAX_NOTES_CHARS = int(os.environ.get("CHRONICLE_MAX_NOTES_CHARS", "120000"))
# Each art moment is a real image generation: slow, metered, and the reason a
# draft takes minutes rather than seconds.
CHRONICLE_MAX_ART = int(os.environ.get("CHRONICLE_MAX_ART", "6"))
CHRONICLE_DEFAULT_ART = int(os.environ.get("CHRONICLE_DEFAULT_ART", "3"))
CHRONICLE_SOURCE_DIR = "Session-Chronicles"
CHRONICLE_URL_PREFIX = "/en/Session-Chronicles"
CHRONICLE_IMAGE_DIR = "images/chronicles"
CHRONICLE_INDEX = "Session-Chronicles/index.md"
# Publishing can refresh the app's front-page campaign state. campaign.js
# merges this file when it exists, so the state is data the API owns rather
# than a JavaScript module it would have to rewrite.
CAMPAIGN_STATE_PATH = SITE_SOURCE_DIR / "_data" / "campaign-state.json"
# Standalone documents served at /files/ — run-sheets and session prep that
# belong on a URL but not in the app or the public repo. DM-gated: nginx
# proxies /files/ here instead of aliasing the directory openly.
PUBLIC_FILES_DIR = Path(os.environ.get("PUBLIC_FILES_DIR", "/srv/public-files"))
# ── DM authentication (Google OAuth + signed session JWT) ───────────────
# Standalone /dm fallback auth. App-level OAuth can also grant DM access via
# ALLOWED_DM_EMAILS or ALLOWED_DM_DISCORD_IDS and the player auth cookie.
GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
ALLOWED_DM_EMAILS = {
    email.strip().lower()
    for email in os.environ.get("ALLOWED_DM_EMAILS", "").split(",")
    if email.strip()
}
SESSION_JWT_SECRET = os.environ.get("SESSION_JWT_SECRET", "").strip()
SESSION_JWT_TTL_SECONDS = int(os.environ.get("SESSION_JWT_TTL_SECONDS", str(7 * 24 * 3600)))
DISCORD_OAUTH_CLIENT_ID = os.environ.get("DISCORD_OAUTH_CLIENT_ID", "").strip()
DISCORD_OAUTH_CLIENT_SECRET = os.environ.get("DISCORD_OAUTH_CLIENT_SECRET", "").strip()
GOOGLE_OAUTH_REDIRECT_URI = os.environ.get("GOOGLE_OAUTH_REDIRECT_URI", "").strip()
DISCORD_OAUTH_REDIRECT_URI = os.environ.get("DISCORD_OAUTH_REDIRECT_URI", "").strip()
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")
AUTH_COOKIE_NAME = "vos_player_token"
AUTH_COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "1") != "0"
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:dm@valleyofshadows.wiki").strip()
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()
RSVP_STATUSES = {"going", "maybe", "out"}

DEFAULT_PLAYERS = [
    'Caravel "Car" Asteri',
    "Lotan",
    "Noname",
    'Roxanya "Roxy"',
    "Valentro",
    "DM",
]
PLAYER_CODE_ENV_VARS = [
    ('Caravel "Car" Asteri', ("PLAYER_CODE_CAR", "PLAYER_CODE_CARAVEL")),
    ("Lotan", ("PLAYER_CODE_LOTAN",)),
    ("Noname", ("PLAYER_CODE_NONAME",)),
    ('Roxanya "Roxy"', ("PLAYER_CODE_ROXY", "PLAYER_CODE_ROXANYA")),
    ("Valentro", ("PLAYER_CODE_VALEN", "PLAYER_CODE_VALENTRO")),
    ("DM", ("PLAYER_CODE_DUSTIN", "PLAYER_CODE_DM")),
]
LOGIN_NAME_ALIASES = {
    "car": 'Caravel "Car" Asteri',
    "caravel": 'Caravel "Car" Asteri',
    'caravel "car" asteri': 'Caravel "Car" Asteri',
    "lotan": "Lotan",
    "noname": "Noname",
    "no name": "Noname",
    "no-name": "Noname",
    "noanme": "Noname",
    "roxy": 'Roxanya "Roxy"',
    "roxanya": 'Roxanya "Roxy"',
    'roxanya "roxy"': 'Roxanya "Roxy"',
    "valen": "Valentro",
    "val": "Valentro",
    "valentro": "Valentro",
    "dustin": "DM",
    # "dm test wizard" used to live here so the DM's own character imported
    # like anyone else's. The character is gone, and the alias with it — an
    # actor by that name in a Foundry export is now refused rather than
    # quietly rebuilding a character nobody plays. A real DM PC would arrive
    # as "DM" or "Dustin", which still resolve.
    "me": "DM",
    "me (dustin, dm)": "DM",
    "dm": "DM",
}
AUTH_TOKEN_TTL_SECONDS = int(os.environ.get("AUTH_TOKEN_TTL_SECONDS", str(180 * 24 * 60 * 60)))
AUTH_TOKEN_SECRET = (
    os.environ.get("AUTH_TOKEN_SECRET", "").strip()
    or ADMIN_TOKEN
    or VAPID_PRIVATE_KEY
    or ANTHROPIC_API_KEY
)


def _canonical_login_name(name):
    cleaned = re.sub(r"\s+", " ", str(name or "").strip())
    return LOGIN_NAME_ALIASES.get(cleaned.lower(), cleaned)


def _parse_revoked_players(raw):
    """Roster names whose already-issued tokens must stop working.

    Accepts either display or canonical names — `Roxy,Valen` and
    `Roxanya "Roxy", Valentro` both resolve the same way.
    """
    return {
        _canonical_login_name(part)
        for part in re.split(r"[,;\n]+", str(raw or ""))
        if _canonical_login_name(part)
    }


REVOKED_PLAYERS = _parse_revoked_players(os.environ.get("REVOKED_PLAYERS", ""))

# Shared secret the Foundry bridge module presents when pushing a statblock.
# Blank disables the ingest endpoint entirely rather than leaving it open.
STATBLOCK_INGEST_TOKEN = os.environ.get("STATBLOCK_INGEST_TOKEN", "").strip()

# Remote control for the DM's Syrinscape account. Generated at
# syrinscape.com/account/auth-token/ — server-side only, like every secret.
SYRINSCAPE_AUTH_TOKEN = os.environ.get("SYRINSCAPE_AUTH_TOKEN", "").strip()
STATBLOCK_MAX_BYTES = int(os.environ.get("STATBLOCK_MAX_BYTES", str(2_000_000)))


def _parse_individual_login_codes():
    codes = {}
    for canonical_name, env_names in PLAYER_CODE_ENV_VARS:
        for env_name in env_names:
            code = os.environ.get(env_name, "").strip()
            if code:
                codes[canonical_name] = code
                break
    return codes


def _parse_login_codes(raw):
    raw = (raw or "").strip()
    if not raw:
        return {}
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
            return {
                _canonical_login_name(name): str(code).strip()
                for name, code in data.items()
                if _canonical_login_name(name) and str(code).strip()
            }
        except Exception:
            logging.exception("PLAYER_LOGIN_CODES JSON is malformed")
            return {}

    codes = {}
    for part in re.split(r"[,;\n]+", raw):
        if "=" not in part:
            continue
        name, code = part.split("=", 1)
        name = _canonical_login_name(name)
        code = code.strip()
        if name and code:
            codes[name] = code
    return codes


PLAYER_LOGIN_CODES = (
    _parse_individual_login_codes()
    or _parse_login_codes(os.environ.get("PLAYER_LOGIN_CODES", ""))
)
PLAYER_NAMES = list(PLAYER_LOGIN_CODES.keys()) or DEFAULT_PLAYERS

# Immutable chat identities. Display names remain the authentication and UI
# labels during the compatibility window, but every conversation row also
# carries one of these IDs so a later rename cannot orphan its history.
_DEFAULT_CHAT_SEAT_IDS = {
    'Caravel "Car" Asteri': "1b735713-0203-54b5-86dd-69dea9eeba71",
    "Lotan": "abbc4459-5a97-5c5d-b950-a978cc277df0",
    "Noname": "abb4cd9e-8426-5dc1-9859-415d66968b8d",
    'Roxanya "Roxy"': "39f334af-8a2c-5cf6-87a6-3c1e175604d2",
    "Valentro": "fce79031-c710-505d-afdd-87883f9d78fa",
    "DM": "4bc8efd3-87bc-531e-8ca5-6d966ed806e4",
}
CHAT_SYSTEM_SEAT_IDS = {
    "Enzo": "23a8c32a-6e85-55ca-89df-98e2c3ddeb6b",
    "Vesper": "6e5f83fd-65ce-5895-92ff-4c9b7bc7feca",
}
CHAT_THREAD_NAMESPACE = uuid.UUID("e9bccaf8-9611-5e85-9965-57425722cff1")


def _load_chat_seat_ids():
    path = SITE_SOURCE_DIR / "_data" / "players.json"
    loaded = {}
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
        for row in rows:
            name = row.get("name") if isinstance(row, dict) else None
            seat_id = row.get("id") if isinstance(row, dict) else None
            if name and seat_id:
                # Canonicalize the textual form and fail on malformed IDs.
                loaded[name] = str(uuid.UUID(str(seat_id)))
    except OSError:
        logging.exception("Could not load immutable chat seat IDs from %s", path)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Invalid immutable chat seat catalog: {path}") from exc
    merged = {**_DEFAULT_CHAT_SEAT_IDS, **loaded}
    missing = [name for name in PLAYER_NAMES if name not in merged]
    if missing:
        raise RuntimeError(f"Missing immutable chat seat IDs: {', '.join(missing)}")
    selected = {name: merged[name] for name in PLAYER_NAMES}
    if len(set(selected.values())) != len(selected):
        raise RuntimeError("Immutable chat seat IDs must be unique")
    return selected


CHAT_SEAT_IDS = _load_chat_seat_ids()
CHAT_SEAT_NAMES = {seat_id: name for name, seat_id in CHAT_SEAT_IDS.items()}


def chat_thread_id(kind, *seat_ids):
    """Return a stable conversation ID derived only from immutable seats."""
    normalized = [str(uuid.UUID(str(seat_id))) for seat_id in seat_ids]
    identity = kind if kind == "party" else f"{kind}:{'|'.join(sorted(normalized))}"
    return str(uuid.uuid5(CHAT_THREAD_NAMESPACE, identity))


CHAT_PARTY_THREAD_ID = chat_thread_id("party")


def _parse_principal_map(raw):
    """Parse env maps like `email@example.com=Lotan,123456=DM`.

    Values must resolve to one of PLAYER_NAMES. Unknown player labels are
    ignored so a typo cannot mint tokens for a non-roster identity.
    """
    parsed = {}
    for part in re.split(r"[,;\n]+", raw or ""):
        if "=" not in part:
            continue
        principal, player = part.split("=", 1)
        principal = principal.strip().lower()
        player = _canonical_login_name(player)
        if principal and player in PLAYER_NAMES:
            parsed[principal] = player
    return parsed


def _normalize_discord_principal(value):
    text = str(value or "").strip()
    match = re.search(r"\b\d{15,25}\b", text)
    if match:
        return match.group(0)
    return text.lower()


GOOGLE_PLAYER_MAP = _parse_principal_map(os.environ.get("GOOGLE_PLAYER_MAP", ""))
DISCORD_PLAYER_MAP = {
    _normalize_discord_principal(principal): player
    for principal, player in _parse_principal_map(os.environ.get("DISCORD_PLAYER_MAP", "")).items()
}
ALLOWED_DM_DISCORD_IDS = {
    _normalize_discord_principal(value)
    for value in os.environ.get("ALLOWED_DM_DISCORD_IDS", "").split(",")
    if _normalize_discord_principal(value)
}

# ── Image-prompt compiler configuration ─────────────────────────────────────
#
# vos/image_prompt_compiler.json is the single source of truth for the house
# look, the per-preset composition rules, and the compiler model's own
# instructions. Nothing in Python restates the style text: two editable copies
# of the Valley look is exactly how it drifted before.
#
# The file sits next to the code (the Dockerfile does `COPY chatbot/vos ./vos`)
# rather than in the /site bind mount, so a running container always has the
# configuration it was built with.
IMAGE_COMPILER_CONFIG_PATH = Path(os.environ.get(
    "IMAGE_COMPILER_CONFIG",
    str(Path(__file__).resolve().parent / "image_prompt_compiler.json"),
))


def _load_image_compiler_config(path=None):
    """Read the compiler configuration. Raises on a missing or broken file —
    the caller decides whether that is fatal."""
    with open(Path(path or IMAGE_COMPILER_CONFIG_PATH), encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("image_prompt_compiler.json is not a JSON object")
    return data


try:
    IMAGE_COMPILER_CONFIG = _load_image_compiler_config()
except Exception:
    # Not fatal: Enzo, the calendar, and everything else still work. Art
    # generation refuses with a 503 rather than quietly shipping unstyled
    # prompts, and test_image_style covers the file actually loading.
    logging.exception("Could not load %s — art styles unavailable", IMAGE_COMPILER_CONFIG_PATH)
    IMAGE_COMPILER_CONFIG = {}

_STYLE_SYSTEM = IMAGE_COMPILER_CONFIG.get("style_system") or {}
VALLEY_HOUSE_STYLE = (_STYLE_SYSTEM.get("valley_house") or "").strip()
VALLEY_CHARACTER_STYLE = (_STYLE_SYSTEM.get("valley_character") or "").strip()

# What the picker says about each preset. The *look* is in the JSON; only the
# UI copy lives here, keyed by the stable style keys the client sends.
ART_STYLE_LABELS = {
    "valley-portrait": (
        "Valley of Shadows — Portrait",
        "House style for character portraits — period-drama photography, candlelit and close.",
    ),
    "valley-scene": (
        "Valley of Shadows — Scene",
        "House style for narrative moments — figures caught mid-action in a place.",
    ),
    "valley-place": (
        "Valley of Shadows — Place",
        "House style for locations and architecture — atmospheric establishing shots.",
    ),
    "cinematic": (
        "Cinematic",
        "Widescreen film still — dramatic lighting, shallow depth of field, color-graded.",
    ),
    "illustrated": (
        "Illustrated",
        "Hand-painted, like a high-end fantasy book plate.",
    ),
    "watercolor": (
        "Watercolor & Parchment",
        "Soft watercolor wash on antique parchment, delicate ink linework.",
    ),
    "ink": (
        "Ink & Woodcut",
        "High-contrast woodcut/etching, monochromatic with gold accents.",
    ),
    "photoreal": (
        "Photorealistic",
        "Like a still from a prestige historical-fantasy production.",
    ),
    "sketch": (
        "Concept Sketch",
        "Exploratory pencil-on-parchment with atmospheric value.",
    ),
    "stained-glass": (
        "Stained Glass",
        "Lead cames and jewel tones — like the chapel windows of St. Viro's.",
    ),
}


def _style_text_for_preset(key, preset):
    """Assemble one preset's style block from the configuration.

    Valley presets are the same photograph taken three ways: house look, then
    the character-realism block where figures are the subject, then the
    preset's own composition rules. Everything else carries a standalone
    style. Assembled here, deterministically — the compiler model is never
    asked to restate the house style, which is what let it drift.
    """
    standalone = (preset.get("standalone_style") or "").strip()
    if standalone:
        return standalone
    parts = [VALLEY_HOUSE_STYLE]
    if preset.get("include_character_block"):
        parts.append(VALLEY_CHARACTER_STYLE)
    parts.append((preset.get("append") or "").strip())
    return " ".join(part for part in parts if part)


def _build_art_style_presets():
    """key → {label, description, kind, style}. The JSON decides which presets
    exist and what they look like; ART_STYLE_LABELS supplies the UI copy."""
    presets = {}
    for key, preset in (_STYLE_SYSTEM.get("presets") or {}).items():
        if not isinstance(preset, dict):
            continue
        label, description = ART_STYLE_LABELS.get(
            key, (key.replace("-", " ").title(), ""),
        )
        presets[key] = {
            "label": label,
            "description": description,
            "kind": preset.get("kind") or "other",
            "style": _style_text_for_preset(key, preset),
        }
    return presets


ART_STYLE_PRESETS = _build_art_style_presets()
DEFAULT_STYLE_KEY = "valley-scene"

RAG_SKIP_MAX_LEN = 15
RAG_SKIP_PATTERNS = re.compile(
    r"^(h(ello|ey|i|owdy|ola)|yo+|sup|wh?at'?s? ?up|greetings|"
    r"thanks?( you)?|ty|thx|ok(ay)?|sure|yep|yeah?|nah|no(pe)?|"
    r"bye|cya|later|gn|good (morning|evening|night)|lol|lmao|haha|"
    r"wow|cool|nice|great|awesome|hmm+|huh|bruh|dude|bro|gg|"
    r"help|test|ping)$",
    re.IGNORECASE,
)

__all__ = ['DATA_DIR', 'LOG_PATH', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'MAX_TOKENS', 'OLLAMA_URL', 'OLLAMA_API_KEY', 'EMBEDDING_MODEL', 'RAG_TOP_K', 'RAG_AUTO_THRESHOLD', 'RAG_LIST_THRESHOLD', 'TEMPERATURE', 'GALLERY_DIR', 'GALLERY_IMAGES_DIR', 'GALLERY_MANIFEST', 'GALLERY_MAX_ENTRIES', 'GALLERY_PAGE_LIMIT', 'ALLOWED_IMAGE_MODELS', 'IMAGE_MODEL', 'STUDIO_MONTHLY_QUOTA', 'QUERY_EXPANSION_ENABLED', 'QUERY_EXPANSION_CACHE_TTL', 'QUERY_EXPANSION_CACHE_MAX', 'CHAT_RATE_LIMIT', 'MAX_CONVERSATION_BYTES', 'APP_DB_PATH', 'VECTOR_SQLITE_PATH', 'SITE_SOURCE_DIR', 'CAMPAIGN_TZ', 'REBUILD_STATUS_PATH', 'REBUILD_LOCK_PATH', 'REBUILD_PENDING_PATH', 'REBUILD_PENDING_LOCK_PATH', 'AUTO_REBUILD_ON_WIKI_SAVE', 'AUTO_KNOWLEDGE_ON_WIKI_SAVE', 'REBUILD_COMMAND_TIMEOUT_SECONDS', 'REBUILD_DEBOUNCE_SECONDS', 'REBUILD_KNOWLEDGE_MIN_INTERVAL_SECONDS', 'LORE_DRAFT_DIR', 'LORE_DRAFT_IMAGES_DIR', 'CHRONICLE_DRAFT_DIR', 'CHRONICLE_IMAGES_DIR', 'CHRONICLE_MODEL', 'CHRONICLE_EFFORT', 'CHRONICLE_MAX_TOKENS', 'CHRONICLE_TIMEOUT_S', 'CHRONICLE_RESEARCH_MODEL', 'CHRONICLE_RESEARCH_MAX_TOKENS', 'CHRONICLE_RESEARCH_TIMEOUT_S', 'CHRONICLE_MAX_QUERIES', 'CHRONICLE_MAX_CONTEXT_BLOCKS', 'CHRONICLE_CONTEXT_CHARS', 'CHRONICLE_MAX_NOTES_CHARS', 'CHRONICLE_MAX_ART', 'CHRONICLE_DEFAULT_ART', 'CHRONICLE_SOURCE_DIR', 'CHRONICLE_URL_PREFIX', 'CHRONICLE_IMAGE_DIR', 'CHRONICLE_INDEX', 'CAMPAIGN_STATE_PATH', 'PUBLIC_FILES_DIR', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'ALLOWED_DM_EMAILS', 'SESSION_JWT_SECRET', 'SESSION_JWT_TTL_SECONDS', 'DISCORD_OAUTH_CLIENT_ID', 'DISCORD_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'DISCORD_OAUTH_REDIRECT_URI', 'PUBLIC_BASE_URL', 'AUTH_COOKIE_NAME', 'AUTH_COOKIE_SECURE', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'ADMIN_TOKEN', 'RSVP_STATUSES', 'DEFAULT_PLAYERS', 'PLAYER_CODE_ENV_VARS', 'LOGIN_NAME_ALIASES', 'AUTH_TOKEN_TTL_SECONDS', 'AUTH_TOKEN_SECRET', '_canonical_login_name', '_parse_revoked_players', 'REVOKED_PLAYERS', 'STATBLOCK_INGEST_TOKEN', 'STATBLOCK_MAX_BYTES', 'SYRINSCAPE_AUTH_TOKEN', '_parse_individual_login_codes', '_parse_login_codes', 'PLAYER_LOGIN_CODES', 'PLAYER_NAMES', '_parse_principal_map', '_normalize_discord_principal', 'GOOGLE_PLAYER_MAP', 'DISCORD_PLAYER_MAP', 'ALLOWED_DM_DISCORD_IDS', 'IMAGE_COMPILER_CONFIG_PATH', '_load_image_compiler_config', 'IMAGE_COMPILER_CONFIG', 'VALLEY_HOUSE_STYLE', 'VALLEY_CHARACTER_STYLE', 'ART_STYLE_LABELS', '_style_text_for_preset', '_build_art_style_presets', 'ART_STYLE_PRESETS', 'DEFAULT_STYLE_KEY', 'RAG_SKIP_MAX_LEN', 'RAG_SKIP_PATTERNS']
