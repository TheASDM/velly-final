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
    "Kryton Novelli",
    "Lotan",
    "Noname",
    "Orabella",
    'Roxanya "Roxy"',
    "Valentro",
    "DM",
]
PLAYER_CODE_ENV_VARS = [
    ('Caravel "Car" Asteri', ("PLAYER_CODE_CAR", "PLAYER_CODE_CARAVEL")),
    ("Kryton Novelli", ("PLAYER_CODE_KRYTON",)),
    ("Lotan", ("PLAYER_CODE_LOTAN",)),
    ("Noname", ("PLAYER_CODE_NONAME",)),
    ("Orabella", ("PLAYER_CODE_ORABELLA",)),
    ('Roxanya "Roxy"', ("PLAYER_CODE_ROXY", "PLAYER_CODE_ROXANYA")),
    ("Valentro", ("PLAYER_CODE_VALEN", "PLAYER_CODE_VALENTRO")),
    ("DM", ("PLAYER_CODE_DUSTIN", "PLAYER_CODE_DM")),
]
LOGIN_NAME_ALIASES = {
    "car": 'Caravel "Car" Asteri',
    "caravel": 'Caravel "Car" Asteri',
    'caravel "car" asteri': 'Caravel "Car" Asteri',
    "kryton": "Kryton Novelli",
    "kryton novelli": "Kryton Novelli",
    "lotan": "Lotan",
    "noname": "Noname",
    "no name": "Noname",
    "no-name": "Noname",
    "noanme": "Noname",
    "orabella": "Orabella",
    "orabell": "Orabella",
    "roxy": 'Roxanya "Roxy"',
    "roxanya": 'Roxanya "Roxy"',
    'roxanya "roxy"': 'Roxanya "Roxy"',
    "valen": "Valentro",
    "val": "Valentro",
    "valentro": "Valentro",
    "dustin": "DM",
    # The DM's own character, so it imports and reads like any other.
    "dm test wizard": "DM",
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

    Accepts either display or canonical names — `Kryton,Orabella` and
    `Kryton Novelli, Orabella` both resolve the same way.
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

# Style preset keys are stable strings sent from the UI; the corresponding
# prompt prefix is prepended to the user prompt at generation time. Keep
# these tight — overly long prefixes eat into the user's prompt budget
# (OpenAI's gpt-image accepts ~4000 chars total per request).
#
# The three "valley-*" presets are the campaign's house look — a Reign-style
# (TV show) cinematic period drama: rich fantasy costumes, contemporary
# editorial gloss, soft romantic lighting, jewel-tone color grade. Each
# variant tunes the prefix for a different subject type (portrait vs. wider
# scene vs. environmental establishing shot) so the model frames the image
# appropriately. Everything below the valley group is an alternative look
# the player can opt into.
ART_STYLE_PRESETS = {
    "valley-portrait": {
        "label": "Valley of Shadows — Portrait",
        "description": "House style for character portraits — Reign-TV period drama with editorial gloss.",
        "prefix": (
            "Cinematic character portrait in the lush, romantic style of a "
            "modern period drama like the TV show Reign — rich period "
            "fantasy costume with a contemporary editorial gloss. Soft "
            "romantic lighting, shallow depth of field, soft photographic "
            "focus, dewy modern beauty styling, jewel-tone color grade. "
            "Portrait format."
        ),
    },
    "valley-scene": {
        "label": "Valley of Shadows — Scene",
        "description": "House style for narrative/action moments — wider framing, multiple subjects, atmospheric staging.",
        "prefix": (
            "Cinematic narrative scene in the lush, romantic style of a "
            "modern period drama like the TV show Reign — rich period "
            "fantasy costuming with a contemporary editorial gloss, "
            "atmospheric staging, mid-ground emphasis, soft photographic "
            "focus with selective depth of field, jewel-tone color grade, "
            "warm dramatic lighting. Widescreen composition."
        ),
    },
    "valley-place": {
        "label": "Valley of Shadows — Place",
        "description": "House style for locations, architecture, and landscapes — atmospheric establishing shots.",
        "prefix": (
            "Cinematic establishing shot in the lush, romantic style of a "
            "modern period drama like the TV show Reign — atmospheric "
            "historical-fantasy architecture or landscape, golden-hour or "
            "candlelit lighting, soft photographic focus with rich material "
            "and texture detail, jewel-tone color grade, painterly depth. "
            "Widescreen environmental composition."
        ),
    },
    "cinematic": {
        "label": "Cinematic",
        "description": "Anamorphic film still — dramatic lighting, shallow depth of field, color-graded.",
        "prefix": (
            "Cinematic still, anamorphic 2.39:1 framing, dramatic key light "
            "and deep shadows, shallow depth of field, film grain, color "
            "graded like a high-budget moody fantasy production."
        ),
    },
    "illustrated": {
        "label": "Illustrated",
        "description": "Hand-painted, like a high-end fantasy book illustration.",
        "prefix": (
            "Hand-painted fantasy book illustration, rich painterly textures, "
            "expressive linework, ink and gouache, the look of a Folio "
            "Society or vintage Dragonlance interior plate."
        ),
    },
    "watercolor": {
        "label": "Watercolor & Parchment",
        "description": "Soft watercolor wash on antique parchment, delicate ink linework.",
        "prefix": (
            "Soft watercolor wash on aged parchment, delicate sepia ink "
            "outlines, gentle pigment bleeds, the look of an illuminated "
            "manuscript or a Renaissance natural-philosophy plate."
        ),
    },
    "ink": {
        "label": "Ink & Woodcut",
        "description": "High-contrast woodcut/etching, monochromatic with gold accents.",
        "prefix": (
            "Dark fantasy ink illustration in the style of a 16th-century "
            "woodcut, heavy black linework, sharp contrast, etched cross-"
            "hatching, monochromatic with restrained gold accents."
        ),
    },
    "photoreal": {
        "label": "Photorealistic",
        "description": "Like a still from a prestige historical-fantasy production.",
        "prefix": (
            "Photorealistic, 50mm prime, naturalistic candlelight or moon-"
            "light, fine detail in skin and fabric, the texture of a still "
            "from a prestige historical-fantasy production."
        ),
    },
    "sketch": {
        "label": "Concept Sketch",
        "description": "Quick exploratory pencil-on-parchment with atmospheric value.",
        "prefix": (
            "Loose exploratory concept sketch in graphite and sepia, on "
            "aged parchment, light atmospheric value washes, expressive "
            "energetic lines, room for the imagination to fill in."
        ),
    },
    "stained-glass": {
        "label": "Stained Glass",
        "description": "Lead-cames and jewel tones — like the chapel windows of St. Viro's.",
        "prefix": (
            "Cathedral stained-glass composition, bold black lead cames, "
            "luminous jewel tones, simplified forms, the look of the "
            "chapel windows of a Venturian cathedral."
        ),
    },
}
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

__all__ = ['DATA_DIR', 'LOG_PATH', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'MAX_TOKENS', 'OLLAMA_URL', 'OLLAMA_API_KEY', 'EMBEDDING_MODEL', 'RAG_TOP_K', 'RAG_AUTO_THRESHOLD', 'RAG_LIST_THRESHOLD', 'TEMPERATURE', 'GALLERY_DIR', 'GALLERY_IMAGES_DIR', 'GALLERY_MANIFEST', 'GALLERY_MAX_ENTRIES', 'GALLERY_PAGE_LIMIT', 'ALLOWED_IMAGE_MODELS', 'IMAGE_MODEL', 'STUDIO_MONTHLY_QUOTA', 'QUERY_EXPANSION_ENABLED', 'QUERY_EXPANSION_CACHE_TTL', 'QUERY_EXPANSION_CACHE_MAX', 'CHAT_RATE_LIMIT', 'MAX_CONVERSATION_BYTES', 'APP_DB_PATH', 'VECTOR_SQLITE_PATH', 'SITE_SOURCE_DIR', 'REBUILD_STATUS_PATH', 'REBUILD_LOCK_PATH', 'REBUILD_PENDING_PATH', 'REBUILD_PENDING_LOCK_PATH', 'AUTO_REBUILD_ON_WIKI_SAVE', 'AUTO_KNOWLEDGE_ON_WIKI_SAVE', 'REBUILD_COMMAND_TIMEOUT_SECONDS', 'REBUILD_DEBOUNCE_SECONDS', 'REBUILD_KNOWLEDGE_MIN_INTERVAL_SECONDS', 'LORE_DRAFT_DIR', 'LORE_DRAFT_IMAGES_DIR', 'PUBLIC_FILES_DIR', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'ALLOWED_DM_EMAILS', 'SESSION_JWT_SECRET', 'SESSION_JWT_TTL_SECONDS', 'DISCORD_OAUTH_CLIENT_ID', 'DISCORD_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'DISCORD_OAUTH_REDIRECT_URI', 'PUBLIC_BASE_URL', 'AUTH_COOKIE_NAME', 'AUTH_COOKIE_SECURE', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'ADMIN_TOKEN', 'RSVP_STATUSES', 'DEFAULT_PLAYERS', 'PLAYER_CODE_ENV_VARS', 'LOGIN_NAME_ALIASES', 'AUTH_TOKEN_TTL_SECONDS', 'AUTH_TOKEN_SECRET', '_canonical_login_name', '_parse_revoked_players', 'REVOKED_PLAYERS', 'STATBLOCK_INGEST_TOKEN', 'STATBLOCK_MAX_BYTES', 'SYRINSCAPE_AUTH_TOKEN', '_parse_individual_login_codes', '_parse_login_codes', 'PLAYER_LOGIN_CODES', 'PLAYER_NAMES', '_parse_principal_map', '_normalize_discord_principal', 'GOOGLE_PLAYER_MAP', 'DISCORD_PLAYER_MAP', 'ALLOWED_DM_DISCORD_IDS', 'ART_STYLE_PRESETS', 'DEFAULT_STYLE_KEY', 'RAG_SKIP_MAX_LEN', 'RAG_SKIP_PATTERNS']
