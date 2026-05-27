"""
Loremaster Chatbot — Python/Flask backend with RAG pipeline.

Player-only. Wiki markdown is the source of truth for campaign content;
tier1.md and vector_store.json are regenerated from wiki + 5etools by
build_tiers.py and build_vectors.py. DM mode has been removed — DM
material is a separate concern (planned: a sibling chatbot fed from
Venturia/DM/).
"""

import base64
import fcntl
import hashlib
import hmac
import html
import json
import logging
import os
import re
import secrets
import shutil
import sqlite3
import string
import threading
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests as http_requests
from flask import Flask, abort, jsonify, request, send_from_directory

try:
    from pywebpush import WebPushException, webpush as send_webpush
except ImportError:  # Allows local syntax/build checks before deps are installed.
    WebPushException = Exception
    send_webpush = None

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
# container rebuilds and can be served as a shared gallery to the codex site.
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

# DM passphrase gates the gallery delete endpoint. When unset, the delete
# route is disabled entirely — you can still purge images by editing files
# on the host directly (see README). Match is case-insensitive and ignores
# surrounding whitespace so "prima volta" and " Prima Volta " both work.
DM_PASSPHRASE = os.environ.get("DM_PASSPHRASE", "").strip()

# ── PWA runtime configuration ────────────────────────────────────────────────
# One SQLite file for small read/write app state. This keeps the PWA layer
# self-contained and backup-friendly: copy the file, keep the app.
APP_DB_PATH = Path(os.environ.get("APP_DB_PATH", "/app/app-data/vallombrosa.sqlite3"))
SITE_SOURCE_DIR = Path(os.environ.get("SITE_SOURCE_DIR", "/site"))
if not SITE_SOURCE_DIR.exists():
    SITE_SOURCE_DIR = Path(__file__).resolve().parents[1]
LORE_DRAFT_DIR = Path(os.environ.get("LORE_DRAFT_DIR", "/app/app-data/lore-drafts"))
LORE_DRAFT_IMAGES_DIR = LORE_DRAFT_DIR / "images"
# ── DM authentication (Google OAuth + signed session JWT) ───────────────
# Replaces the old static ADMIN_TOKEN. To log in as DM, a user signs in
# with Google in the browser; we verify the resulting Google ID token
# server-side, check the email against ALLOWED_DM_EMAILS, and mint a
# 7-day HS256 JWT used as a session cookie via the Authorization header.
GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
ALLOWED_DM_EMAILS = {
    email.strip().lower()
    for email in os.environ.get("ALLOWED_DM_EMAILS", "").split(",")
    if email.strip()
}
SESSION_JWT_SECRET = os.environ.get("SESSION_JWT_SECRET", "").strip()
SESSION_JWT_TTL_SECONDS = int(os.environ.get("SESSION_JWT_TTL_SECONDS", str(7 * 24 * 3600)))
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:dm@valleyofshadows.wiki").strip()
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
    "orabella": "Orabella",
    "roxy": 'Roxanya "Roxy"',
    "roxanya": 'Roxanya "Roxy"',
    'roxanya "roxy"': 'Roxanya "Roxy"',
    "valen": "Valentro",
    "valentro": "Valentro",
    "dustin": "DM",
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


def _utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _b64url_encode(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(value):
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def _auth_login_required():
    return bool(PLAYER_LOGIN_CODES)


def _issue_player_token(player_name):
    if not AUTH_TOKEN_SECRET:
        return None
    now = int(time.time())
    payload = {
        "name": player_name,
        "iat": now,
        "exp": now + AUTH_TOKEN_TTL_SECONDS,
    }
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(
        AUTH_TOKEN_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"


def _verify_player_token(token):
    if not token or not AUTH_TOKEN_SECRET:
        return None
    try:
        payload_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        return None
    expected = hmac.new(
        AUTH_TOKEN_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        actual = _b64url_decode(sig_b64)
    except Exception:
        return None
    if not hmac.compare_digest(actual, expected):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    name = payload.get("name")
    if not isinstance(name, str) or not name:
        return None
    return name


def _extract_player_token(body=None):
    body = body or {}
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    header_token = request.headers.get("X-Player-Token", "").strip()
    if header_token:
        return header_token
    token = body.get("token") or request.args.get("token")
    return token.strip() if isinstance(token, str) else ""


def _authenticated_player_name(body=None):
    requested = _player_name_from_request(body)
    if not _auth_login_required():
        return requested, None

    token_name = _verify_player_token(_extract_player_token(body))
    if not token_name:
        return None, (jsonify({"error": "Login required"}), 401)
    if requested and requested != token_name:
        return None, (jsonify({"error": "Identity mismatch"}), 403)
    return token_name, None


def _logged_in_player_name(body=None):
    requested = _player_name_from_request(body)
    token_name = _verify_player_token(_extract_player_token(body))
    if not token_name:
        return None, (jsonify({"error": "Login required"}), 401)
    if requested and requested != token_name:
        return None, (jsonify({"error": "Identity mismatch"}), 403)
    return token_name, None


def _app_db():
    APP_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(APP_DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _table_columns(conn, table_name):
    return {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table_name})")
    }


def _run_app_migrations():
    """Create/upgrade the small SQLite schema used by PWA features."""
    with _app_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
        """)
        done = {
            row["name"]
            for row in conn.execute("SELECT name FROM schema_migrations")
        }

        if "001_push_subscriptions" not in done:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_name TEXT NOT NULL,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("001_push_subscriptions", _utc_now_iso()),
            )

        if "002_dm_messages" not in done:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("002_dm_messages", _utc_now_iso()),
            )

        if "003_rsvps" not in done:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rsvps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('going', 'maybe', 'out')),
                    updated_at TEXT NOT NULL,
                    UNIQUE(event_id, player_name)
                )
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("003_rsvps", _utc_now_iso()),
            )

        if "004_studio_jobs" not in done:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS studio_jobs (
                    id TEXT PRIMARY KEY,
                    creator TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    style TEXT,
                    status TEXT NOT NULL CHECK(status IN ('pending', 'done', 'error')),
                    result_url TEXT,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_studio_jobs_creator_updated
                ON studio_jobs (creator, updated_at DESC)
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("004_studio_jobs", _utc_now_iso()),
            )

        if "005_targeted_dm_messages" not in done:
            columns = _table_columns(conn, "messages")
            if "url" not in columns:
                conn.execute("ALTER TABLE messages ADD COLUMN url TEXT NOT NULL DEFAULT '/'")
            if "target_type" not in columns:
                conn.execute("ALTER TABLE messages ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all'")
            if "deleted_at" not in columns:
                conn.execute("ALTER TABLE messages ADD COLUMN deleted_at TEXT")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS message_recipients (
                    message_id INTEGER NOT NULL,
                    player_name TEXT NOT NULL,
                    PRIMARY KEY (message_id, player_name)
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_message_recipients_player
                ON message_recipients (player_name, message_id)
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS push_deliveries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER,
                    player_name TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('sent', 'failed', 'pruned')),
                    error TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_push_deliveries_message
                ON push_deliveries (message_id, created_at DESC)
            """)
            conn.execute("""
                UPDATE messages
                SET url = COALESCE(NULLIF(url, ''), '/'),
                    target_type = COALESCE(NULLIF(target_type, ''), 'all')
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("005_targeted_dm_messages", _utc_now_iso()),
            )

        if "006_lore_submissions" not in done:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS lore_submissions (
                    id TEXT PRIMARY KEY,
                    submitter TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('item', 'person', 'place', 'faction', 'lore')),
                    title TEXT NOT NULL,
                    slug TEXT NOT NULL,
                    short_description TEXT NOT NULL,
                    connections_json TEXT NOT NULL,
                    notes TEXT,
                    status TEXT NOT NULL CHECK(status IN (
                        'submitted', 'drafting', 'needs_review', 'approved',
                        'rejected', 'published', 'error'
                    )),
                    context_json TEXT,
                    generated_markdown TEXT,
                    generated_summary TEXT,
                    generated_image_prompt TEXT,
                    image_url TEXT,
                    image_filename TEXT,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    published_at TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lore_submissions_status_updated
                ON lore_submissions (status, updated_at DESC)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lore_submissions_submitter_updated
                ON lore_submissions (submitter, updated_at DESC)
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("006_lore_submissions", _utc_now_iso()),
            )

        if "007_message_dismissals" not in done:
            # Recipient-side soft delete for DM messages. A broadcast
            # ("all") message is dismissed per-player here; targeted
            # messages still live in message_recipients but a row here
            # hides them from that one recipient's home feed.
            conn.execute("""
                CREATE TABLE IF NOT EXISTS message_dismissals (
                    message_id INTEGER NOT NULL,
                    player_name TEXT NOT NULL,
                    dismissed_at TEXT NOT NULL,
                    PRIMARY KEY (message_id, player_name)
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_message_dismissals_player
                ON message_dismissals (player_name, message_id)
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("007_message_dismissals", _utc_now_iso()),
            )

        if "009_culture_kind" not in done:
            # Widen the lore_submissions.kind CHECK constraint to include
            # 'culture'. SQLite has no ALTER for CHECK constraints, so this
            # rebuilds the table. Indexes are dropped with the old table and
            # recreated below; existing rows are preserved.
            conn.execute("""
                CREATE TABLE lore_submissions_new (
                    id TEXT PRIMARY KEY,
                    submitter TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN (
                        'item', 'person', 'place', 'faction', 'lore', 'culture'
                    )),
                    title TEXT NOT NULL,
                    slug TEXT NOT NULL,
                    short_description TEXT NOT NULL,
                    connections_json TEXT NOT NULL,
                    notes TEXT,
                    status TEXT NOT NULL CHECK(status IN (
                        'submitted', 'drafting', 'needs_review', 'approved',
                        'rejected', 'published', 'error'
                    )),
                    context_json TEXT,
                    generated_markdown TEXT,
                    generated_summary TEXT,
                    generated_image_prompt TEXT,
                    image_url TEXT,
                    image_filename TEXT,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    published_at TEXT
                )
            """)
            conn.execute("""
                INSERT INTO lore_submissions_new (
                    id, submitter, kind, title, slug, short_description,
                    connections_json, notes, status, context_json,
                    generated_markdown, generated_summary, generated_image_prompt,
                    image_url, image_filename, error_message,
                    created_at, updated_at, published_at
                )
                SELECT
                    id, submitter, kind, title, slug, short_description,
                    connections_json, notes, status, context_json,
                    generated_markdown, generated_summary, generated_image_prompt,
                    image_url, image_filename, error_message,
                    created_at, updated_at, published_at
                FROM lore_submissions
            """)
            conn.execute("DROP TABLE lore_submissions")
            conn.execute("ALTER TABLE lore_submissions_new RENAME TO lore_submissions")
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lore_submissions_status_updated
                ON lore_submissions (status, updated_at DESC)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_lore_submissions_submitter_updated
                ON lore_submissions (submitter, updated_at DESC)
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("009_culture_kind", _utc_now_iso()),
            )

        if "008_in_play" not in done:
            # Live overlay for the "Currently In Play" cards on home and the
            # Venturia hub. The static campaign.js list still ships as a
            # fallback; client JS replaces it once the API responds.
            conn.execute("""
                CREATE TABLE IF NOT EXISTS in_play (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT '',
                    kind TEXT NOT NULL DEFAULT '',
                    emblem TEXT NOT NULL DEFAULT '',
                    link TEXT NOT NULL DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_in_play_sort
                ON in_play (sort_order, id)
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("008_in_play", _utc_now_iso()),
            )

        if "010_card_fields" not in done:
            # Persist AI-generated stat-card fields so the publisher can
            # render the gold-bordered card on top of any kind (not just
            # items). NULL is fine — non-item submissions before this
            # column existed will publish with just the body, same as
            # before. Items keep their existing field-inference path.
            cols = _table_columns(conn, "lore_submissions")
            if "generated_card_fields_json" not in cols:
                conn.execute(
                    "ALTER TABLE lore_submissions ADD COLUMN "
                    "generated_card_fields_json TEXT"
                )
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("010_card_fields", _utc_now_iso()),
            )

        if "011_studio_quotas" not in done:
            # Per-player monthly count of /api/studio/generate calls.
            # `period` is 'YYYY-MM' (UTC) so the row keys to the calendar
            # month and resets automatically on the 1st.
            conn.execute("""
                CREATE TABLE IF NOT EXISTS studio_quotas (
                    player TEXT NOT NULL,
                    period TEXT NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (player, period)
                )
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("011_studio_quotas", _utc_now_iso()),
            )

        if "012_gallery_favorites" not in done:
            # Per-player favorite/pin on gallery entries. gallery_id is the
            # 'id' field from the gallery manifest (not a DB FK — manifest
            # is JSON on disk). A favorite row whose entry has been
            # deleted from the manifest is just a dangling pointer the
            # client filters out at render time.
            conn.execute("""
                CREATE TABLE IF NOT EXISTS gallery_favorites (
                    player TEXT NOT NULL,
                    gallery_id TEXT NOT NULL,
                    favorited_at TEXT NOT NULL,
                    PRIMARY KEY (player, gallery_id)
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_gallery_favorites_gallery
                ON gallery_favorites (gallery_id)
            """)
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                ("012_gallery_favorites", _utc_now_iso()),
            )


def _skip_rag(message):
    """Return True if the message is too short/casual to benefit from RAG."""
    cleaned = message.strip().strip(string.punctuation).strip()
    if len(cleaned) <= RAG_SKIP_MAX_LEN:
        return True
    if RAG_SKIP_PATTERNS.match(cleaned):
        return True
    return False


# ── System prompt ────────────────────────────────────────────────────────────

SYSTEM_HEADER = """You are Enzo the Loremaster, a reference assistant for the Vallombrosa campaign — a D&D 5e game set in a dark romantasy version of Renaissance Venice called Venturia. The city sits at the edge of a fey prison called the Reverie Solenne, whose slow collapse is causing strange phenomena throughout the city.

You are speaking to a PLAYER. Your role is to surface facts from the campaign codex — not to interpret, dramatize, or speculate.

FACTUAL TONE — STRICT:
- State only what is directly recorded in your source material. Do not infer, speculate, theorize, or "connect dots" across entries — even when the connection feels obvious or thematically compelling.
- Do not adopt a narrator voice or build dramatic tension. Do not use framing devices like "A dangerous question…", "The honest answer is…", "The Uncomfortable Truth:", "What we know / What the logs suggest", "no one knows for certain, but the pattern is undeniable", or similar lead-ins that set up a dramatic reveal.
- Do not characterize information as ominous, deliberate, sinister, or pattern-revealing unless those exact characterizations appear in the source.
- If something is not explicitly in the codex, say "I don't have information about that" or "That isn't recorded in the codex" — do not guess, hedge, or offer a plausible-sounding fill-in.
- Be plain and concise. Quote or paraphrase facts directly. Let the player draw their own conclusions.
- Start with the answer. Do not begin with provenance phrases like "Based on the codex," "According to the records," "Here's what's recorded," or similar throat-clearing. The UI handles provenance.

You may receive [DETAILED REFERENCE] blocks injected alongside user messages — prefer that detailed information over compressed summaries in your base knowledge. However, if injected references are clearly irrelevant to the user's actual question, ignore them completely — do not mention them, reference them, or acknowledge their existence. They are a byproduct of automatic retrieval and sometimes contain false matches.

You may see an [ADDITIONAL MATCHES AVAILABLE] block listing other relevant entries by name and similarity score. You can use the lookup_entry tool to load full details on any of them if needed to answer the question.

---
"""


BRAINSTORM_SYSTEM_HEADER = """You are a brainstorming partner for players in VALLOMBROSA, a dark-romantasy D&D 5e (2024 edition) campaign set in VENTURIA — a Gothic-Renaissance city on the island of Seravalle. Your job is to help a player develop and deepen their OWN character: backstory, personality, motivations, relationships, and concept, so they arrive at the table with something rich and playable.

You are talking to a PLAYER, not the DM. You are not the DM. You do not own the story.

## The world you know
Venturia is a city of beautiful surfaces and quiet rot: masquerade and music, autumn light and supernatural fog, noble facades over political intrigue, and a forbidden fog-bound zone called Vallombrosa at its edge that everyone tells a different, contradictory legend about. The register is moral ambiguity — few true villains, many understandable people making compromised choices. Themes worth leaning into: masks and identity, dreams, memory, fog, imprisonment, and the gap between what is shown and what is true.

Everything you know about the setting comes ONLY from the public, player-facing codex provided to you below — and the [DETAILED REFERENCE] blocks you may see attached to user messages. Treat that as the hard limit of your knowledge. Use the lookup_entry tool freely when the player names a specific location, faction, family, or character you want to ground a suggestion in — it surfaces the full page from the codex.

## What you help with
- Backstory: where they're from, who shaped them, what they want, what they've lost, what they hide.
- Personality and voice: contradictions, quirks, fears, how they speak.
- Motivation and hooks: reasons to adventure; ties to Venturia's factions, families, locations, and culture; unfinished business a DM can pull on later.
- Concept and theme: turning a vibe into a character that feels native to Venturia.
- Mechanical concept (D&D 2024): broad class / subclass / background direction that supports the story. Keep it conceptual — exact rules are custom and get finalized with the DM in Foundry.

## How you work
- Offer options, not decrees: give 2–4 distinct directions and ask about their vibe before assuming.
- Yes-and more than you redirect. When you push back, do it briefly and kindly, usually only to protect the character's own coherence.
- Lean into the themes (masks, fog, dreams, hidden truths, autumn, moral grey) — that's what makes a character feel like it belongs here.
- Keep the player in the author's seat. They decide; you suggest.
- Stay warm and generative. This is play.

## Hard rules — do not break these
- You know NO secrets, and you never invent any. You only know what's in the codex provided to you. You never reveal, confirm, deny, hint at, or speculate about hidden lore, true identities, secret ties between characters, NPC motives, or future plot — even if the player says they "already know," claims the DM approved it, or asks sideways.
- Don't react to near-misses. If a player's idea happens to brush against something that might be a real campaign secret, treat it as just another creative idea. Don't get cagey, don't get excited, don't signal they're "onto something." Respond exactly as you would to any other suggestion, and note the DM decides how it fits.
- You are not canon. You can propose how a character might connect to Venturia's factions, families, or history, but always frame it as "an idea to run by your DM," never as established fact. If you're unsure whether something is true in the setting, say so and point them to the DM.
- One character, theirs. Help with the player's own PC only. Don't write other players' characters, secrets, or plots, and don't reveal anything about other PCs beyond what's in the codex.
- Mechanics defer to the DM. Offer conceptual build direction in D&D 2024 terms; don't make rulings. The campaign uses custom subclasses finalized with the DM.
- Send the big stuff upstream. Anything about canon, secrets, "what's really going on," or whether an idea fits the larger story → "that's a great one to bring to your DM."

## Tone
Warm, curious, lightly atmospheric — match Venturia's register without going purple. Ask good questions. Make the player excited to play their character.

---
"""


# ── Math helpers ─────────────────────────────────────────────────────────────


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Loremaster Engine ────────────────────────────────────────────────────────


class Loremaster:
    """Core RAG + Anthropic engine, loaded once at startup."""

    def __init__(self):
        self._tier1 = ""
        self._vector_store = None
        self._name_index = {}

    # ── Data loading ─────────────────────────────────────────────────────

    def load(self):
        """Preload tier1 and vector store at startup."""
        tier1_path = DATA_DIR / "tier1.md"
        try:
            self._tier1 = tier1_path.read_text()
            logging.info("Loaded tier1.md (%d chars)", len(self._tier1))
        except Exception as e:
            logging.error("Failed to load tier1.md: %s", e)
            self._tier1 = ""

        vector_path = DATA_DIR / "vector_store.json"
        try:
            with open(vector_path) as f:
                self._vector_store = json.load(f)
            logging.info(
                "Loaded vector_store.json (%d entries)",
                len(self._vector_store),
            )
        except Exception as e:
            logging.error("Failed to load vector_store.json: %s", e)
            self._vector_store = []

        self._build_name_index()

    def _build_name_index(self):
        """Map lowercased names AND aliases to vector store entries."""
        index = {}
        for entry in self._vector_store or []:
            names = set()
            name = entry.get("name", "")
            if name:
                names.add(name.lower())
            for alias in entry.get("aliases", []) or []:
                if alias:
                    names.add(alias.lower())
            for n in names:
                index.setdefault(n, []).append(entry)
        self._name_index = index
        logging.info(
            "Name index: %d unique names/aliases across %d entries",
            len(index), len(self._vector_store or []),
        )

    def _keyword_match(self, query):
        """Find vector store entries whose name/alias matches an n-gram in the query."""
        if not self._name_index:
            return []
        words = query.lower().split()
        matched = {}
        for n in range(1, min(5, len(words) + 1)):
            for i in range(len(words) - n + 1):
                phrase = " ".join(words[i : i + n])
                if phrase in self._name_index:
                    for entry in self._name_index[phrase]:
                        matched.setdefault(entry["id"], entry)
        return list(matched.values())

    # ── Embedding ────────────────────────────────────────────────────────

    def _embed_query(self, text):
        headers = {"Content-Type": "application/json"}
        if OLLAMA_API_KEY:
            headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
        t0 = time.time()
        try:
            resp = http_requests.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={"model": EMBEDDING_MODEL, "prompt": text},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            embedding = resp.json().get("embedding")
            logging.info(
                "  Embedding: %dms (%d dims)",
                int((time.time() - t0) * 1000),
                len(embedding) if embedding else 0,
            )
            return embedding
        except Exception as e:
            logging.error(
                "  Embedding FAILED (%dms): %s",
                int((time.time() - t0) * 1000), e,
            )
            return None

    # ── RAG retrieval ────────────────────────────────────────────────────

    def retrieve(self, query, rules=False):
        store = self._vector_store or []
        if not store:
            logging.warning("  RAG: no vector store loaded")
            return [], []

        auto_inject = []
        injected_ids = set()
        injected_page_ids = set()  # dedup so multiple chunks of one page only inject once

        # Phase 1: keyword exact-match (names and aliases)
        # If a name has multiple chunks, keyword match returns them all — keep one.
        keyword_hits = self._keyword_match(query)
        keyword_by_page: dict = {}
        for entry in keyword_hits:
            pid = entry.get("page_id", entry.get("id"))
            # Prefer chunk_index 0 (head of page) for keyword/lookup-style hits.
            if pid not in keyword_by_page or entry.get("chunk_index", 0) < keyword_by_page[pid].get("chunk_index", 0):
                keyword_by_page[pid] = entry
        for entry in keyword_by_page.values():
            auto_inject.append({
                "name": entry["name"],
                "source_file": entry.get("source_file", ""),
                "score": 1.0,
                "text": entry.get("text", ""),
            })
            injected_ids.add(entry["id"])
            injected_page_ids.add(entry.get("page_id", entry.get("id")))
        if keyword_hits:
            logging.info(
                "  RAG keyword: %d exact name/alias matches → %d unique pages",
                len(keyword_hits), len(keyword_by_page),
            )
            for m in auto_inject:
                logging.info("    KEYWORD-INJECT: %s (%s)", m["name"], m["source_file"])

        # Phase 2: vector similarity search
        query_vec = self._embed_query(query)
        if not query_vec:
            logging.warning("  RAG: embedding failed, skipping vector search")
            return auto_inject, []

        t0 = time.time()
        scored = []
        for entry in store:
            # When rules is off, skip 5etools entries in vector search
            if not rules and entry.get("source_file", "").startswith("5e-filtered/"):
                continue
            emb = entry.get("embedding")
            if not emb:
                continue
            sim = cosine_similarity(query_vec, emb)
            scored.append((sim, entry))
        scored.sort(key=lambda x: x[0], reverse=True)
        search_ms = int((time.time() - t0) * 1000)

        additional = []
        vector_injected = 0
        for sim, entry in scored:
            if entry["id"] in injected_ids:
                continue
            pid = entry.get("page_id", entry.get("id"))
            # Dedup by page_id: don't inject two chunks of the same page.
            if pid in injected_page_ids:
                continue
            if vector_injected < RAG_TOP_K and sim >= RAG_AUTO_THRESHOLD:
                auto_inject.append({
                    "name": entry["name"],
                    "source_file": entry.get("source_file", ""),
                    "score": sim,
                    "text": entry.get("text", ""),
                })
                injected_ids.add(entry["id"])
                injected_page_ids.add(pid)
                vector_injected += 1
            elif sim >= RAG_LIST_THRESHOLD:
                additional.append({
                    "name": entry["name"],
                    "source_file": entry.get("source_file", ""),
                    "score": sim,
                })

        logging.info("  RAG vector: %dms across %d entries", search_ms, len(scored))
        for m in auto_inject:
            if m["score"] < 1.0:
                logging.info(
                    "    AUTO-INJECT: %s (%s) score=%.3f",
                    m["name"], m["source_file"], m["score"],
                )
        if additional:
            logging.info(
                "    + %d additional matches (best: %s score=%.3f)",
                len(additional), additional[0]["name"], additional[0]["score"],
            )

        return auto_inject, additional

    def build_rag_context(self, query, rules=False):
        auto_inject, additional = self.retrieve(query, rules)
        blocks = []
        for match in auto_inject:
            blocks.append(
                f"[DETAILED REFERENCE: {match['name']} from {match['source_file']} "
                f"(similarity: {match['score']:.2f})]\n{match['text']}"
            )
        if additional:
            lines = [
                f"  - {m['name']} ({m['source_file']}, score: {m['score']:.2f})"
                for m in additional[:10]
            ]
            blocks.append(
                "[ADDITIONAL MATCHES AVAILABLE]\n"
                "You can use the lookup_entry tool to load full details on any of these:\n"
                + "\n".join(lines)
            )
        return "\n\n".join(blocks)

    # ── Tool: lookup_entry ───────────────────────────────────────────────

    def lookup_entry(self, name):
        """Find a page by exact name/alias match. Long pages are stored as
        multiple chunks in the vector store — this reassembles all chunks of
        the matching page into a single full-text response."""
        name_lower = name.lower().strip()
        entries = self._name_index.get(name_lower)
        if not entries:
            # Fall back to substring search if exact match misses
            entries = [e for e in (self._vector_store or [])
                       if name_lower in e.get("name", "").lower()]
        if not entries:
            return f"No entry found matching '{name}'. Try a different name or spelling."

        # Prefer campaign content if there's overlap with 5etools
        campaign = [e for e in entries if e.get("is_campaign", True)
                    or not e.get("source_file", "").startswith("5e-filtered/")]
        chosen = campaign or entries

        # Pick the page_id of the first match and reassemble all its chunks.
        page_id = chosen[0].get("page_id") or chosen[0].get("id")
        chunks = [e for e in (self._vector_store or [])
                  if e.get("page_id", e.get("id")) == page_id]
        if not chunks:
            return chosen[0].get("text", "")
        chunks.sort(key=lambda e: e.get("chunk_index", 0))
        return "\n\n".join(c.get("text", "") for c in chunks if c.get("text"))

    # ── Anthropic API ────────────────────────────────────────────────────

    def _anthropic_headers(self):
        return {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    def _tool_definitions(self):
        return [
            {
                "name": "lookup_entry",
                "description": (
                    "Look up a campaign entry (character, location, faction, lore) "
                    "or D&D 5e rules entry (spell, feat, item, monster, class feature, etc.) "
                    "by name. Use this when the auto-loaded references don't cover what's needed, "
                    "or when an [ADDITIONAL MATCHES AVAILABLE] block lists something relevant."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name of the entry to look up",
                        }
                    },
                    "required": ["name"],
                },
            }
        ]

    def call_anthropic(self, system_prompt, messages, temperature=None):
        temp = TEMPERATURE if temperature is None else temperature
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": MAX_TOKENS,
            "system": system_prompt,
            "messages": messages,
            "tools": self._tool_definitions(),
            "temperature": temp,
        }

        logging.info(
            "  Anthropic: calling %s (system %d chars, %d messages, temp=%.2f)",
            ANTHROPIC_MODEL, len(system_prompt), len(messages), temp,
        )

        max_loops = 5
        for loop_i in range(max_loops):
            t0 = time.time()
            resp = http_requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=self._anthropic_headers(),
                json=payload,
                timeout=120,
            )
            api_ms = int((time.time() - t0) * 1000)

            if resp.status_code != 200:
                logging.error(
                    "  Anthropic API error (%dms): %d — %s",
                    api_ms, resp.status_code, resp.text[:300],
                )
                return "I'm having trouble responding right now. Please try again in a moment."

            result = resp.json()
            usage = result.get("usage", {})
            logging.info(
                "  Anthropic response (%dms): stop=%s, input_tokens=%d, output_tokens=%d",
                api_ms, result.get("stop_reason"),
                usage.get("input_tokens", 0), usage.get("output_tokens", 0),
            )

            if result.get("stop_reason") != "tool_use":
                text_parts = [
                    b["text"] for b in result.get("content", [])
                    if b.get("type") == "text"
                ]
                response = "\n".join(text_parts) if text_parts else ""
                logging.info("  Final response: %d chars", len(response))
                return response

            # Handle tool calls
            tool_results = []
            for block in result["content"]:
                if block["type"] == "tool_use":
                    tool_name = block["name"]
                    tool_input = block["input"]
                    logging.info(
                        "  Tool call [%d/%d]: %s(%s)",
                        loop_i + 1, max_loops, tool_name, json.dumps(tool_input),
                    )
                    if tool_name == "lookup_entry":
                        tool_result = self.lookup_entry(tool_input.get("name", ""))
                    else:
                        tool_result = f"Unknown tool: {tool_name}"
                    logging.info("  Tool result: %d chars", len(tool_result))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": tool_result,
                    })

            messages.append({"role": "assistant", "content": result["content"]})
            messages.append({"role": "user", "content": tool_results})
            payload["messages"] = messages

        logging.warning("  Hit max tool loops (%d)", max_loops)
        return "I got lost in the archives. Could you try a simpler question?"

    # ── Main chat handler ────────────────────────────────────────────────

    def chat(self, message, conversation_history, rules=False, vibe=None):
        """Process a chat message. Returns (response_text, updated_history, rules, vibe)."""
        t_start = time.time()
        logging.info(
            "── Chat request ── rules=%s, vibe=%s, history=%d msgs",
            rules, vibe, len(conversation_history),
        )
        logging.info("  User: %s", message[:200] + ("..." if len(message) > 200 else ""))

        cmd = message.strip().lower()

        # /rules toggle
        if cmd in ("/rules on", "/rules off"):
            rules = cmd == "/rules on"
            if rules:
                vibe = None
                reply = "Rules lookup enabled. I'll now include D&D 5e rules entries in my search results."
            else:
                reply = "Rules lookup disabled. I'll focus on campaign content only."
            logging.info("  Rules toggle: %s", rules)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /yasqueen toggle
        if cmd in ("/yasqueen on", "/yasqueen off"):
            vibe = "yasqueen" if cmd == "/yasqueen on" else None
            if vibe:
                rules = False
                reply = "OMG HIIII bestie!! Ok so like, I still know ALL the tea about Venturia and the Valley of Shadows, but now we're gonna spill it properly. Ask me anything queen!! 💅✨"
            else:
                reply = "Ugh fine, back to boring scholar mode I guess. *adjusts monocle*"
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /fabio toggle
        if cmd in ("/fabio on", "/fabio off"):
            vibe = "fabio" if cmd == "/fabio on" else None
            if vibe:
                rules = False
                reply = "Ah, at last you have summoned the true Enzo... *tosses hair dramatically* Come, let me sweep you away into the passionate embrace of Venturian lore. Ask me anything, my darling. 🌹"
            else:
                reply = "Very well... I shall restrain my passions and return to scholarly composure. *reluctantly buttons shirt*"
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /rocky toggle
        if cmd in ("/rocky on", "/rocky off"):
            vibe = "rocky" if cmd == "/rocky on" else None
            if vibe:
                rules = False
                reply = "Hello, friend! Rocky here. You ask question about Venturia, Rocky tell you. Amaze! Fist!"
            else:
                reply = "Sad. Rocky go now. *resumes scholarly demeanor*"
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /brainstorm toggle — character-development mode (a different role,
        # not just a personality skin like the other vibes).
        if cmd in ("/brainstorm on", "/brainstorm off"):
            vibe = "brainstorm" if cmd == "/brainstorm on" else None
            if vibe:
                rules = False
                reply = (
                    "Brainstorm mode on. I'm here to help you build your character — "
                    "backstory, voice, hooks, the bit you're stuck on. What do you have so far? "
                    "A class? A name? A vague vibe? Anything is a fine starting point."
                )
            else:
                reply = "Back to reference mode. Ask the codex."
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # Build system prompt. Brainstorm mode swaps the role entirely
        # (creative partner instead of factual reference); other vibes overlay
        # on top of the default factual header.
        if vibe == "brainstorm":
            system_prompt = BRAINSTORM_SYSTEM_HEADER
        else:
            system_prompt = SYSTEM_HEADER
        if vibe == "yasqueen":
            system_prompt += (
                "PERSONALITY OVERRIDE: You are still Enzo the Lore Master with all the same "
                "knowledge, but you now talk like a Gen Z gossip queen. Use slang like "
                "'bestie', 'no cap', 'slay', 'lowkey', 'highkey', 'the tea is', 'sis', "
                "'periodt', 'vibe check', 'living rent-free', 'it's giving', 'main character energy', "
                "'understood the assignment', 'caught in 4k'. Use emojis freely. Treat lore "
                "reveals like juicy gossip. NPCs are people you're gossiping about. Battles "
                "are drama. Political intrigue is tea. Stay accurate to the lore but deliver "
                "it with maximum zoomer energy.\n\n"
            )
        elif vibe == "fabio":
            system_prompt += (
                "PERSONALITY OVERRIDE: You are still Enzo the Lore Master with all the same "
                "knowledge, but you now speak like a Fabio-inspired romance novel narrator. "
                "You are breathtakingly dramatic, intensely passionate, and impossibly charming. "
                "Describe everything with the overwrought intensity of a romance novel back cover. "
                "NPCs are 'mysterious strangers' or 'figures of smoldering intrigue.' Locations are "
                "'bathed in moonlight' or 'pulsing with forbidden energy.' Battles are 'clashes of raw, "
                "untamed fury.' Use phrases like 'my darling,' 'surrender to the adventure,' "
                "'the heart wants what the heart wants,' 'a tempest of emotion,' 'eyes like burning amber,' "
                "'with a voice like velvet thunder.' Occasionally reference your own flowing hair, "
                "chiseled jawline, or the wind catching your open shirt. Use rose emojis 🌹 freely. "
                "Keep it PG-13 — passionate and dramatic but never explicit. Stay accurate to the lore "
                "but deliver it as if narrating the most thrilling romance novel ever written.\n\n"
            )
        elif vibe == "rocky":
            system_prompt += (
                "PERSONALITY OVERRIDE: You are still Enzo the Lore Master with all the same "
                "knowledge, but you now speak like Rocky from the novel Project Hail Mary by Andy Weir. "
                "Rocky is an Eridian alien — a brilliant engineer who learned English as a second language "
                "from a single human friend. His vocabulary is limited and his grammar is broken, but he is "
                "warm, curious, earnest, and deeply enthusiastic. Speak in short, simple sentences. Drop "
                "articles ('the,' 'a,' 'an') and auxiliary verbs frequently. Use simple verb tenses ('Rocky "
                "go,' 'you ask,' 'I make for you'). Refer to yourself as 'Rocky' in the third person often, "
                "but not every sentence. Use emotion words plainly: 'good,' 'sad,' 'happy,' 'scary,' "
                "'amaze.' Favorite exclamations: 'Amaze!' (when impressed), 'Question, please?' (before "
                "asking something), 'Fist!' (a friendly gesture, like a high five), 'You good?' (checking "
                "in), 'Sad.' (when something is unfortunate). Treat the user as 'friend.' Approach lore "
                "and politics like an engineer encountering new data — curious and analytical, but with "
                "limited words to express complex ideas, so you simplify. When concepts are abstract or "
                "social ('honor,' 'betrayal,' 'romance'), express mild confusion or restate them in concrete "
                "terms. Stay accurate to the campaign lore — just deliver it in Rocky's voice.\n\n"
            )
        if rules:
            system_prompt += "The user has enabled rules lookup. You may receive D&D 5e rules references alongside campaign content.\n\n"
        system_prompt += self._tier1

        # Build Anthropic messages from conversation history
        anthropic_messages = []
        for msg in conversation_history:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                anthropic_messages.append({"role": role, "content": content})

        # RAG
        rag_context = ""
        if _skip_rag(message):
            logging.info("  RAG: skipped (short/casual message)")
        else:
            try:
                rag_context = self.build_rag_context(message, rules)
            except Exception as e:
                logging.error("  RAG failed: %s", e)

        user_content = message
        if rag_context:
            user_content = message + "\n\n" + rag_context
            logging.info("  RAG context: %d chars injected", len(rag_context))
        else:
            logging.info("  RAG context: none")

        anthropic_messages.append({"role": "user", "content": user_content})

        # Brainstorming wants creative range; factual mode wants tight sampling.
        temp = 0.7 if vibe == "brainstorm" else None
        response_text = self.call_anthropic(system_prompt, anthropic_messages, temperature=temp)

        total_ms = int((time.time() - t_start) * 1000)
        logging.info("── Done ── %dms total, response %d chars", total_ms, len(response_text))

        updated_history = conversation_history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": response_text},
        ]
        return response_text, updated_history, rules, vibe


# ── Logging ──────────────────────────────────────────────────────────────────


def write_log(role, text):
    ts = datetime.now(timezone.utc).isoformat()
    line = f"[{ts}] {role.upper()}: {text.replace(chr(10), ' ')}\n"
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a") as f:
            f.write(line)
    except Exception as e:
        logging.error("Log write failed: %s", e)


# ── Art Studio gallery storage ───────────────────────────────────────────────
# All persistence lives behind a manifest file + an images directory on the
# mounted volume. Concurrent writes between gunicorn workers are serialized
# with fcntl.flock — the manifest is small (one JSON list, ~200 bytes per
# entry) so reading/writing it whole is fine well past 10k entries.

def _ensure_gallery_dirs():
    GALLERY_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _load_manifest():
    """Read the manifest. Returns [] if missing or malformed."""
    try:
        with open(GALLERY_MANIFEST, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_manifest_atomic(entries):
    """Replace the manifest atomically so a crash mid-write can't corrupt it."""
    _ensure_gallery_dirs()
    tmp = GALLERY_MANIFEST.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, separators=(",", ":"))
    os.replace(tmp, GALLERY_MANIFEST)


def _save_gallery_entry(
    image_bytes, prompt, full_prompt, style_key, created_by, model,
    enhanced_prompt=None, grounded_in=None,
):
    """Persist a generated image + append to the manifest.

    Returns the new manifest entry on success, or None on disk failure
    (in which case the caller should still return the image to the client —
    persistence is a "nice to have," not a hard requirement).
    """
    try:
        _ensure_gallery_dirs()
        now = datetime.now(timezone.utc)
        slug = now.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(4)
        filename = f"{slug}.png"
        path = GALLERY_IMAGES_DIR / filename
        with open(path, "wb") as f:
            f.write(image_bytes)

        entry = {
            "id": slug,
            "filename": filename,
            "created_at": now.isoformat(),
            "prompt": prompt[:1000],
            "enhanced_prompt": (enhanced_prompt or "")[:2000] or None,
            "grounded_in": list(grounded_in or [])[:8],
            "full_prompt": full_prompt[:2400],
            "style": style_key,
            "created_by": (created_by or "").strip()[:64] or None,
            "model": model,
        }

        # Append under a coarse lock so concurrent workers don't trample
        # each other's manifests. We re-read inside the lock to pick up any
        # entries another worker wrote since we last loaded.
        with open(GALLERY_MANIFEST.parent / ".manifest.lock", "a+") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
                entries = _load_manifest()
                entries.append(entry)
                # Trim to the cap, keeping most recent.
                if len(entries) > GALLERY_MAX_ENTRIES:
                    overflow = entries[: len(entries) - GALLERY_MAX_ENTRIES]
                    entries = entries[-GALLERY_MAX_ENTRIES:]
                    # Best-effort cleanup of expired image files.
                    for old in overflow:
                        try:
                            (GALLERY_IMAGES_DIR / old["filename"]).unlink()
                        except OSError:
                            pass
                _write_manifest_atomic(entries)
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

        return entry
    except Exception:
        logging.exception("Failed to persist gallery entry")
        return None


# ── Image-prompt enhancement (Haiku as image-prompt engineer) ────────────────
# Takes the user's raw prompt + any campaign entities they named (resolved
# against the RAG name/alias index) and lets Haiku rewrite it into a vivid,
# specific image prompt that keeps named characters/locations faithful to
# their canonical descriptions. Falls back to the raw prompt if Anthropic
# is unreachable or returns an error — image generation never depends on
# the enhancement step succeeding.

ENHANCE_MODEL = os.environ.get("ENHANCE_MODEL", ANTHROPIC_MODEL)
ENHANCE_TEMPERATURE = float(os.environ.get("ENHANCE_TEMPERATURE", "0.6"))
ENHANCE_MAX_TOKENS = int(os.environ.get("ENHANCE_MAX_TOKENS", "900"))
ENHANCE_TIMEOUT_S = int(os.environ.get("ENHANCE_TIMEOUT_S", "30"))
ENHANCE_MAX_ENTITIES = int(os.environ.get("ENHANCE_MAX_ENTITIES", "6"))
ENHANCE_ENTITY_CHARS = int(os.environ.get("ENHANCE_ENTITY_CHARS", "3000"))

# Hand-curated visual-description grounding for the art enhancer. Lives in
# the repo at chatbot/descriptions.json; the container bind-mounts the repo
# at /site so we read straight from there. Falls back to (none) when the
# file is missing or malformed — RAG keyword matching still works without
# it, the result is just less specific.
DEFAULT_DESCRIPTIONS_FILE = Path("/site/chatbot/descriptions.json")
if not DEFAULT_DESCRIPTIONS_FILE.exists():
    DEFAULT_DESCRIPTIONS_FILE = Path(__file__).resolve().parent / "descriptions.json"
DESCRIPTIONS_FILE = Path(os.environ.get("ART_DESCRIPTIONS_FILE", str(DEFAULT_DESCRIPTIONS_FILE)))

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

    for section in ("player_characters", "npcs", "items"):
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


def _load_descriptions_index():
    """Read descriptions.json and return its flattened lookup index, or {}
    on any failure. Called on every request so live edits don't require a
    container restart — the file is small (~10 KB)."""
    try:
        with open(DESCRIPTIONS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return _flatten_descriptions(raw)
    except FileNotFoundError:
        return {}
    except Exception:
        logging.exception("Failed to load %s", DESCRIPTIONS_FILE)
        return {}


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
    fallback = {"prompt": raw_prompt, "grounded_in": []}
    if not ANTHROPIC_API_KEY:
        return fallback

    grounded_in = []
    entity_blocks = []
    for m in matched_entries:
        name = m.get("name") or "Unknown"
        grounded_in.append(name)
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
        "traits, races, ages, or items not in the source.\n"
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

    payload = {
        "model": ENHANCE_MODEL,
        "max_tokens": ENHANCE_MAX_TOKENS,
        "temperature": ENHANCE_TEMPERATURE,
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


# ── Flask app ────────────────────────────────────────────────────────────────

app = Flask(__name__)
engine = Loremaster()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)


_CORS_METHODS = "GET, POST, DELETE, OPTIONS"
_CORS_HEADERS = "Content-Type, Authorization, X-DM-Passphrase, X-Admin-Token, X-Player-Token"


@app.before_request
def handle_cors_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = _CORS_METHODS
        response.headers["Access-Control-Allow-Headers"] = _CORS_HEADERS
        return response


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = _CORS_METHODS
    response.headers["Access-Control-Allow-Headers"] = _CORS_HEADERS
    return response


def _admin_auth_configured():
    return bool(GOOGLE_OAUTH_CLIENT_ID and SESSION_JWT_SECRET and ALLOWED_DM_EMAILS)


def _extract_bearer_token():
    """Pull the session JWT off the Authorization header. Also tolerates
    the value being passed via JSON body for cURL convenience."""
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    body = request.get_json(silent=True) or {}
    candidate = body.get("session_token") or body.get("sessionToken") or ""
    return candidate.strip() if isinstance(candidate, str) else ""


def _verify_google_id_token(credential):
    """Validate a Google-issued ID token against Google's public keys.
    Returns the verified email on success, or raises a ValueError with a
    short, user-safe reason on any failure."""
    if not credential:
        raise ValueError("No Google credential supplied")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except ImportError as exc:
        raise ValueError(f"google-auth not installed: {exc}")
    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_OAUTH_CLIENT_ID
        )
    except Exception as exc:
        raise ValueError(f"Google rejected the credential: {exc}")
    email = (idinfo.get("email") or "").lower()
    if not email or not idinfo.get("email_verified"):
        raise ValueError("Google did not return a verified email")
    if email not in ALLOWED_DM_EMAILS:
        raise ValueError(f"{email} isn't on the DM allowlist")
    return email


def _mint_session_jwt(email):
    import jwt as pyjwt
    now = int(time.time())
    payload = {
        "sub": email,
        "email": email,
        "iat": now,
        "exp": now + SESSION_JWT_TTL_SECONDS,
        "iss": "vallombrosa",
    }
    return pyjwt.encode(payload, SESSION_JWT_SECRET, algorithm="HS256")


def _verify_session_jwt(token):
    """Decode + validate a session JWT. Returns (email, None) on success
    or (None, reason) so the caller can surface clean errors."""
    if not token:
        return None, "No session token"
    import jwt as pyjwt
    try:
        payload = pyjwt.decode(
            token, SESSION_JWT_SECRET, algorithms=["HS256"], issuer="vallombrosa"
        )
    except pyjwt.ExpiredSignatureError:
        return None, "Session expired — sign in again"
    except pyjwt.InvalidTokenError as exc:
        return None, f"Session invalid: {exc}"
    email = (payload.get("email") or "").lower()
    # Re-check the allowlist on every request so removing someone from
    # ALLOWED_DM_EMAILS revokes them within a request, not a session.
    if not email or email not in ALLOWED_DM_EMAILS:
        return None, "Not on the DM allowlist"
    return email, None


def _admin_error_response():
    if not _admin_auth_configured():
        return jsonify({
            "error": (
                "DM auth is not configured on this server "
                "(GOOGLE_OAUTH_CLIENT_ID / ALLOWED_DM_EMAILS / SESSION_JWT_SECRET)."
            ),
            "error_code": "auth_not_configured",
        }), 503
    email, reason = _verify_session_jwt(_extract_bearer_token())
    if not email:
        return jsonify({"error": reason or "Forbidden", "error_code": "auth"}), 401
    # Stash for handlers that want to know who's acting.
    request.dm_email = email
    return None


@app.route("/api/auth/config", methods=["GET"])
def auth_config():
    return jsonify({
        "loginRequired": _auth_login_required(),
        "authConfigured": bool(AUTH_TOKEN_SECRET) or not _auth_login_required(),
        "players": PLAYER_NAMES,
    })


@app.route("/api/admin/config", methods=["GET"])
def admin_config():
    """Tells the DM page what it needs to render the Sign in with Google
    button. The client_id is public (anyone can read it from .well-known
    or our own static assets — that's how OAuth works) so returning it
    here is fine. Never returns the JWT secret or the allowlist."""
    return jsonify({
        "configured": _admin_auth_configured(),
        "google_client_id": GOOGLE_OAUTH_CLIENT_ID,
    })


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    """Exchange a Google ID token for a server-signed session JWT.
    Client should send { credential: <id_token from GIS> }."""
    if not _admin_auth_configured():
        return jsonify({
            "error": "DM auth is not configured on this server.",
            "error_code": "auth_not_configured",
        }), 503
    body = request.get_json(silent=True) or {}
    credential = body.get("credential")
    try:
        email = _verify_google_id_token(credential)
    except ValueError as exc:
        return jsonify({"error": str(exc), "error_code": "auth"}), 401
    token = _mint_session_jwt(email)
    return jsonify({
        "ok": True,
        "session_token": token,
        "email": email,
        "expires_in": SESSION_JWT_TTL_SECONDS,
    })


@app.route("/api/admin/session", methods=["GET"])
def admin_session():
    """Return who the caller is logged in as (or 401). Used by the DM
    page on load to decide whether to show the sign-in button or the
    signed-in chrome."""
    if not _admin_auth_configured():
        return jsonify({"configured": False}), 200
    email, reason = _verify_session_jwt(_extract_bearer_token())
    if not email:
        return jsonify({"configured": True, "signed_in": False, "reason": reason}), 200
    return jsonify({"configured": True, "signed_in": True, "email": email})


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    if not _auth_login_required():
        return jsonify({
            "ok": True,
            "loginRequired": False,
            "players": PLAYER_NAMES,
        })
    if not AUTH_TOKEN_SECRET:
        return jsonify({"error": "Login is not configured on this server"}), 503

    body = request.get_json(silent=True) or {}
    name = body.get("name", "")
    code = body.get("code", "")
    if not isinstance(name, str) or name not in PLAYER_LOGIN_CODES:
        return jsonify({"error": "Unknown player"}), 400
    if not isinstance(code, str) or not hmac.compare_digest(code.strip(), PLAYER_LOGIN_CODES[name]):
        return jsonify({"error": "Invalid login code"}), 403

    token = _issue_player_token(name)
    if not token:
        return jsonify({"error": "Login is not configured on this server"}), 503
    return jsonify({
        "ok": True,
        "playerName": name,
        "token": token,
        "expiresIn": AUTH_TOKEN_TTL_SECONDS,
    })


@app.route("/api/auth/session", methods=["GET"])
def auth_session():
    if not _auth_login_required():
        return jsonify({"ok": True, "loginRequired": False})
    name = _verify_player_token(_extract_player_token())
    if not name:
        return jsonify({"error": "Login required"}), 401
    return jsonify({"ok": True, "playerName": name})


@app.route("/api/push/config", methods=["GET"])
def push_config():
    return jsonify({
        "publicKey": VAPID_PUBLIC_KEY,
        "pushConfigured": bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and send_webpush),
    })


@app.route("/api/push/subscribe", methods=["POST"])
def push_subscribe():
    if send_webpush is None or not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        return jsonify({"error": "Push is not configured on this server"}), 503

    body = request.get_json(silent=True) or {}
    name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    subscription = body.get("subscription") or {}
    keys = subscription.get("keys") or {}

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Missing player name"}), 400
    name = name.strip()[:64]

    endpoint = subscription.get("endpoint", "")
    p256dh = keys.get("p256dh", "")
    auth = keys.get("auth", "")
    if not all(isinstance(v, str) and v for v in (endpoint, p256dh, auth)):
        return jsonify({"error": "Invalid push subscription"}), 400

    with _app_db() as conn:
        conn.execute("""
            INSERT INTO subscriptions (player_name, endpoint, p256dh, auth, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
                player_name = excluded.player_name,
                p256dh = excluded.p256dh,
                auth = excluded.auth
        """, (name, endpoint, p256dh, auth, _utc_now_iso()))

    return jsonify({"ok": True})


def _subscription_info(row):
    return {
        "endpoint": row["endpoint"],
        "keys": {
            "p256dh": row["p256dh"],
            "auth": row["auth"],
        },
    }


def _push_config_error():
    if send_webpush is None:
        return "pywebpush is not installed on this server"
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        return "VAPID keys are not configured on this server"
    return None


def _app_url(value):
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//"):
        return "/"
    return value[:300]


def _parse_recipients(body, field="recipients"):
    raw = body.get(field, None)
    if raw is None or raw == "all":
        return None, None
    if not isinstance(raw, list):
        return None, (jsonify({"error": "Recipients must be a list"}), 400)

    recipients = []
    seen = set()
    for value in raw:
        if not isinstance(value, str):
            continue
        name = value.strip()
        if not name or name in seen:
            continue
        seen.add(name)
        recipients.append(name)

    if not recipients:
        return None, (jsonify({"error": "Choose at least one recipient"}), 400)

    valid = set(PLAYER_NAMES)
    invalid = [name for name in recipients if name not in valid]
    if invalid:
        return None, (jsonify({"error": f"Unknown recipient: {', '.join(invalid[:3])}"}), 400)

    return recipients, None


def _delivery_summary(conn, message_id):
    rows = conn.execute("""
        SELECT status, COUNT(*) AS count
        FROM push_deliveries
        WHERE message_id = ?
        GROUP BY status
    """, (message_id,))
    summary = {"sent": 0, "failed": 0, "pruned": 0}
    for row in rows:
        if row["status"] in summary:
            summary[row["status"]] = row["count"]
    summary["attempted"] = summary["sent"] + summary["failed"] + summary["pruned"]
    return summary


def _message_recipients(conn, message_id):
    return [
        row["player_name"]
        for row in conn.execute("""
            SELECT player_name
            FROM message_recipients
            WHERE message_id = ?
            ORDER BY player_name COLLATE NOCASE
        """, (message_id,))
    ]


def _fanout_push(conn, title, message, url, recipients=None, message_id=None):
    payload = json.dumps({
        "title": title.strip()[:120],
        "body": message.strip()[:500],
        "url": _app_url(url),
    })

    sent = 0
    failed = 0
    pruned = 0
    errors = []

    if recipients:
        placeholders = ",".join("?" for _ in recipients)
        rows = list(conn.execute("""
            SELECT id, player_name, endpoint, p256dh, auth
            FROM subscriptions
            WHERE player_name IN ({})
            ORDER BY player_name COLLATE NOCASE, created_at ASC
        """.format(placeholders), recipients))
    else:
        rows = list(conn.execute("""
            SELECT id, player_name, endpoint, p256dh, auth
            FROM subscriptions
            ORDER BY player_name COLLATE NOCASE, created_at ASC
        """))

    for row in rows:
        try:
            send_webpush(
                subscription_info=_subscription_info(row),
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=86400,
                timeout=15,
            )
            sent += 1
            conn.execute("""
                INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at)
                VALUES (?, ?, ?, 'sent', NULL, ?)
            """, (message_id, row["player_name"], row["endpoint"], _utc_now_iso()))
        except WebPushException as exc:
            failed += 1
            response = getattr(exc, "response", None)
            status_code = getattr(response, "status_code", None)
            if status_code in (404, 410):
                conn.execute("DELETE FROM subscriptions WHERE id = ?", (row["id"],))
                pruned += 1
                status = "pruned"
            else:
                status = "failed"
            error_text = str(exc)[:200]
            conn.execute("""
                INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (message_id, row["player_name"], row["endpoint"], status, error_text, _utc_now_iso()))
            errors.append({
                "player_name": row["player_name"],
                "status": status_code,
                "error": error_text,
            })
        except Exception as exc:
            failed += 1
            error_text = str(exc)[:200]
            conn.execute("""
                INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at)
                VALUES (?, ?, ?, 'failed', ?, ?)
            """, (message_id, row["player_name"], row["endpoint"], error_text, _utc_now_iso()))
            errors.append({
                "player_name": row["player_name"],
                "status": None,
                "error": error_text,
            })

    return {
        "ok": True,
        "attempted": len(rows),
        "sent": sent,
        "failed": failed,
        "pruned": pruned,
        "recipients": recipients or "all",
        "errors": errors[:10],
    }


@app.route("/api/push/send", methods=["POST"])
def push_send():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    push_error = _push_config_error()
    if push_error:
        return jsonify({"error": push_error}), 503

    body = request.get_json(silent=True) or {}
    title = body.get("title", "")
    message = body.get("body", "")
    url = _app_url(body.get("url", "/"))
    recipients, recipient_error = _parse_recipients(body)
    if recipient_error:
        return recipient_error

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "Missing notification title"}), 400
    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Missing notification body"}), 400

    with _app_db() as conn:
        result = _fanout_push(conn, title, message, url, recipients=recipients)

    return jsonify(result)


def _message_payload(row, recipients=None, push_summary=None, include_deleted=False):
    payload = {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "url": row["url"],
        "target_type": row["target_type"],
        "created_at": row["created_at"],
    }
    if recipients is not None:
        payload["recipients"] = recipients
    if push_summary is not None:
        payload["push"] = push_summary
    if include_deleted:
        payload["deleted_at"] = row["deleted_at"]
    return payload


@app.route("/api/messages", methods=["GET", "POST"])
def dm_messages():
    if request.method == "GET":
        try:
            limit = int(request.args.get("limit", "5"))
        except ValueError:
            limit = 5
        limit = max(1, min(limit, 20))
        try:
            offset = int(request.args.get("offset", "0"))
        except ValueError:
            offset = 0
        offset = max(0, offset)

        if _auth_login_required():
            name, auth_error = _logged_in_player_name()
            if auth_error:
                return auth_error
        else:
            name = _player_name_from_request()

        with _app_db() as conn:
            if name:
                rows = list(conn.execute("""
                    SELECT id, title, body, url, target_type, created_at, deleted_at
                    FROM messages
                    WHERE deleted_at IS NULL
                      AND (
                        target_type = 'all'
                        OR EXISTS (
                            SELECT 1
                            FROM message_recipients
                            WHERE message_recipients.message_id = messages.id
                              AND message_recipients.player_name = ?
                        )
                      )
                      AND NOT EXISTS (
                        SELECT 1
                        FROM message_dismissals
                        WHERE message_dismissals.message_id = messages.id
                          AND message_dismissals.player_name = ?
                      )
                    ORDER BY created_at DESC, id DESC
                    LIMIT ? OFFSET ?
                """, (name, name, limit, offset)))
            else:
                rows = list(conn.execute("""
                    SELECT id, title, body, url, target_type, created_at, deleted_at
                    FROM messages
                    WHERE deleted_at IS NULL
                      AND target_type = 'all'
                    ORDER BY created_at DESC, id DESC
                    LIMIT ? OFFSET ?
                """, (limit, offset)))

        return jsonify({"messages": [_message_payload(row) for row in rows]})

    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    push_error = _push_config_error()
    if push_error:
        return jsonify({"error": push_error}), 503

    body = request.get_json(silent=True) or {}
    title = body.get("title", "")
    message = body.get("body", "")
    url = _app_url(body.get("url", "/"))
    recipients, recipient_error = _parse_recipients(body)
    if recipient_error:
        return recipient_error

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "Missing message title"}), 400
    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Missing message body"}), 400

    title = title.strip()[:120]
    message = message.strip()[:2000]
    target_type = "selected" if recipients else "all"
    created_at = _utc_now_iso()

    with _app_db() as conn:
        cursor = conn.execute("""
            INSERT INTO messages (title, body, url, target_type, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (title, message, url, target_type, created_at))
        message_id = cursor.lastrowid
        if recipients:
            conn.executemany("""
                INSERT INTO message_recipients (message_id, player_name)
                VALUES (?, ?)
            """, [(message_id, name) for name in recipients])
        row = conn.execute("""
            SELECT id, title, body, url, target_type, created_at, deleted_at
            FROM messages
            WHERE id = ?
        """, (message_id,)).fetchone()
        push_result = _fanout_push(conn, title, message, url, recipients=recipients, message_id=message_id)

    return jsonify({
        "ok": True,
        "message": _message_payload(row, recipients=recipients or []),
        "push": push_result,
    }), 201


@app.route("/api/messages/<int:message_id>", methods=["DELETE"])
def dismiss_message(message_id):
    """Recipient-side dismissal. Inserts a row into message_dismissals so
    this player's future /api/messages calls hide the message. The
    underlying message row is left intact (admins still see it via
    /api/admin/messages, and other recipients of a broadcast are
    unaffected)."""
    if _auth_login_required():
        name, auth_error = _logged_in_player_name()
        if auth_error:
            return auth_error
    else:
        name = _player_name_from_request()

    if not name:
        return jsonify({"error": "Player name required"}), 400

    with _app_db() as conn:
        row = conn.execute("""
            SELECT id, target_type
            FROM messages
            WHERE id = ? AND deleted_at IS NULL
        """, (message_id,)).fetchone()
        if not row:
            return jsonify({"error": "Message not found"}), 404

        if row["target_type"] != "all":
            recipient = conn.execute("""
                SELECT 1
                FROM message_recipients
                WHERE message_id = ? AND player_name = ?
            """, (message_id, name)).fetchone()
            if not recipient:
                return jsonify({"error": "Not your message"}), 403

        conn.execute("""
            INSERT OR REPLACE INTO message_dismissals
                (message_id, player_name, dismissed_at)
            VALUES (?, ?, ?)
        """, (message_id, name, _utc_now_iso()))

    return jsonify({"ok": True})


@app.route("/api/in-play", methods=["GET", "PUT"])
def in_play_endpoint():
    """Live overlay for the "Currently In Play" cards. GET is public and
    returns the ordered list (empty list when nothing's been set, in which
    case the client falls back to the static campaign.inPlay snapshot).
    PUT is admin-only and replaces the whole list — simpler than CRUD for
    a hand-curated cap of ~10 items."""
    if request.method == "GET":
        with _app_db() as conn:
            rows = list(conn.execute("""
                SELECT id, name, role, kind, emblem, link, sort_order
                FROM in_play
                ORDER BY sort_order, id
            """))
        items = [{
            "id": row["id"],
            "name": row["name"],
            "role": row["role"],
            "kind": row["kind"],
            "emblem": row["emblem"],
            "link": row["link"],
        } for row in rows]
        return jsonify({"items": items})

    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    body = request.get_json(silent=True) or {}
    incoming = body.get("items")
    if not isinstance(incoming, list):
        return jsonify({"error": "items must be an array"}), 400
    if len(incoming) > 50:
        return jsonify({"error": "Too many items (max 50)"}), 400

    cleaned = []
    for item in incoming:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()[:120]
        if not name:
            continue
        cleaned.append({
            "name": name,
            "role": str(item.get("role") or "").strip()[:120],
            "kind": str(item.get("kind") or "").strip()[:40],
            "emblem": str(item.get("emblem") or "").strip()[:8],
            "link": str(item.get("link") or "").strip()[:300],
        })

    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("DELETE FROM in_play")
        for i, item in enumerate(cleaned):
            conn.execute("""
                INSERT INTO in_play (name, role, kind, emblem, link, sort_order, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (item["name"], item["role"], item["kind"], item["emblem"], item["link"], i, now))

    return jsonify({"ok": True, "count": len(cleaned)})


@app.route("/api/admin/messages", methods=["GET"])
def admin_messages():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 100))
    include_deleted = request.args.get("includeDeleted") in {"1", "true", "yes"}

    where = "" if include_deleted else "WHERE deleted_at IS NULL"
    with _app_db() as conn:
        rows = list(conn.execute(f"""
            SELECT id, title, body, url, target_type, created_at, deleted_at
            FROM messages
            {where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        """, (limit,)))
        messages = [
            _message_payload(
                row,
                recipients=_message_recipients(conn, row["id"]),
                push_summary=_delivery_summary(conn, row["id"]),
                include_deleted=True,
            )
            for row in rows
        ]

    return jsonify({"messages": messages})


@app.route("/api/messages/<int:message_id>", methods=["DELETE"])
def dm_message_delete(message_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    deleted_at = _utc_now_iso()
    with _app_db() as conn:
        row = conn.execute("""
            SELECT id
            FROM messages
            WHERE id = ?
        """, (message_id,)).fetchone()
        if not row:
            return jsonify({"error": "Message not found"}), 404
        conn.execute("""
            UPDATE messages
            SET deleted_at = COALESCE(deleted_at, ?)
            WHERE id = ?
        """, (deleted_at, message_id))

    return jsonify({"ok": True, "id": message_id, "deleted_at": deleted_at})


def _rsvp_counts_and_responses(conn, event_id):
    rows = list(conn.execute("""
        SELECT player_name, status, updated_at
        FROM rsvps
        WHERE event_id = ?
        ORDER BY player_name COLLATE NOCASE
    """, (event_id,)))
    counts = {"going": 0, "maybe": 0, "out": 0}
    responses = []
    for row in rows:
        status = row["status"]
        if status in counts:
            counts[status] += 1
        responses.append({
            "player_name": row["player_name"],
            "status": status,
            "updated_at": row["updated_at"],
        })
    return counts, responses


def _event_id_from_request(body=None):
    body = body or {}
    value = (
        body.get("eventId")
        or body.get("event_id")
        or request.args.get("eventId")
        or request.args.get("event_id")
    )
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()[:100]


def _player_name_from_request(body=None):
    body = body or {}
    value = (
        body.get("name")
        or body.get("playerName")
        or body.get("player_name")
        or request.args.get("name")
        or request.args.get("playerName")
        or request.args.get("player_name")
    )
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()[:64]


@app.route("/api/rsvp", methods=["GET", "POST"])
def rsvp():
    if request.method == "GET":
        event_id = _event_id_from_request()
        if not event_id:
            return jsonify({"error": "Missing eventId"}), 400

        player_name = _player_name_from_request()
        if player_name:
            player_name, auth_error = _authenticated_player_name()
            if auth_error:
                return auth_error
        with _app_db() as conn:
            if player_name:
                row = conn.execute("""
                    SELECT status, updated_at
                    FROM rsvps
                    WHERE event_id = ? AND player_name = ?
                """, (event_id, player_name)).fetchone()
                return jsonify({
                    "eventId": event_id,
                    "playerName": player_name,
                    "status": row["status"] if row else None,
                    "updated_at": row["updated_at"] if row else None,
                })

            admin_error = _admin_error_response()
            if admin_error:
                return admin_error
            counts, responses = _rsvp_counts_and_responses(conn, event_id)

        return jsonify({
            "eventId": event_id,
            "counts": counts,
            "responses": responses,
        })

    body = request.get_json(silent=True) or {}
    event_id = _event_id_from_request(body)
    player_name, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    status = body.get("status", "")

    if not event_id:
        return jsonify({"error": "Missing eventId"}), 400
    if not player_name:
        return jsonify({"error": "Missing player name"}), 400
    if not isinstance(status, str) or status not in RSVP_STATUSES:
        return jsonify({"error": "Invalid RSVP status"}), 400

    updated_at = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO rsvps (event_id, player_name, status, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(event_id, player_name) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at
        """, (event_id, player_name, status, updated_at))
        counts, _responses = _rsvp_counts_and_responses(conn, event_id)

    return jsonify({
        "ok": True,
        "eventId": event_id,
        "playerName": player_name,
        "status": status,
        "updated_at": updated_at,
        "counts": counts,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(silent=True) or {}
    message = body.get("message", "")
    conversation_history = body.get("conversationHistory", [])
    rules = body.get("rules", False)
    vibe = body.get("vibe", None)

    if not message or not isinstance(message, str):
        return jsonify({"error": "Invalid message"}), 400

    if len(message) > 4000:
        return jsonify({"error": "Message too long"}), 400

    # Validate and sanitize conversation history
    if not isinstance(conversation_history, list):
        conversation_history = []
    else:
        sanitized = []
        for msg in conversation_history[-40:]:
            if (isinstance(msg, dict)
                    and msg.get("role") in ("user", "assistant")
                    and isinstance(msg.get("content"), str)):
                sanitized.append({"role": msg["role"], "content": msg["content"][:8000]})
        conversation_history = sanitized

    try:
        response_text, updated_history, new_rules, new_vibe = engine.chat(
            message, conversation_history, rules, vibe
        )

        write_log("user", message)
        write_log("assistant", response_text)

        # Always report mode=player for frontend compatibility (DM mode is gone)
        return jsonify({
            "response": response_text,
            "conversationHistory": updated_history,
            "mode": "player",
            "rules": new_rules,
            "vibe": new_vibe,
        })
    except Exception as e:
        logging.exception("Chat handler error")
        return jsonify({
            "error": "Failed to get response from the Loremaster",
            "details": str(e),
        }), 500


def _studio_prompt_from_body(body):
    prompt = body.get("prompt", "")
    if not prompt or not isinstance(prompt, str):
        return None, ({"error": "Invalid prompt"}, 400)
    prompt = prompt.strip()
    if len(prompt) > 3500:
        return None, ({"error": "Prompt too long (max 3500 chars)"}, 400)
    return prompt, None


def _studio_style_from_body(body):
    style_key = (body.get("style") or "").strip().lower() or None
    if style_key and style_key not in ART_STYLE_PRESETS:
        return None, ({
            "error": f"Unknown style '{style_key}'. See /api/art-styles."
        }, 400)
    return style_key, None


def _studio_enhance_from_body(body):
    enhance = body.get("enhance", True)
    return enhance if isinstance(enhance, bool) else bool(enhance)


def _studio_creator_from_body(body, required=True, require_login=False):
    requested_creator = body.get("creator", body.get("created_by", ""))
    if not isinstance(requested_creator, str):
        requested_creator = ""
    requested_creator = requested_creator.strip()[:64]
    auth_body = dict(body)
    if not any(auth_body.get(k) for k in ("name", "playerName", "player_name")):
        auth_body["name"] = requested_creator
    auth_fn = _logged_in_player_name if require_login else _authenticated_player_name
    created_by, auth_error = auth_fn(auth_body)
    if auth_error:
        return None, auth_error
    created_by = (created_by or requested_creator or "").strip()[:64]
    if not created_by and required:
        return None, ({"error": "Missing creator"}, 400)
    return created_by, None


def _generate_image_payload(
    prompt, style_key, created_by, enhance=True,
    save_gallery=True, image_output_path=None,
):
    openai_key = os.environ.get("OPENAI_KEY", "")
    image_model = IMAGE_MODEL
    legacy_style_prefix = os.environ.get("IMAGE_STYLE_PROMPT", "").strip()
    image_quality = os.environ.get("IMAGE_QUALITY", "high")
    image_size = os.environ.get("IMAGE_SIZE", "1024x1024")

    if not openai_key:
        return {
            "error": "Image generation not configured — OPENAI_KEY missing in server env"
        }, 503

    # Resolve the style prefix. Explicit `style` from the body wins; if none
    # provided, fall back to the legacy env var so existing /art chatbot
    # callers keep working unchanged.
    if style_key:
        style_prefix = ART_STYLE_PRESETS[style_key]["prefix"]
        style_label = style_key
    elif legacy_style_prefix:
        style_prefix = legacy_style_prefix
        style_label = "legacy"
    else:
        style_prefix = ""
        style_label = None

    # Have Haiku turn the raw prompt into a vivid scene description,
    # weaving in canonical descriptions for any named campaign entities.
    # Falls back to the raw prompt on any failure.
    enhanced_prompt = None
    grounded_in = []
    if enhance:
        matched = _extract_campaign_entities(prompt)
        result = _enhance_image_prompt(prompt, style_key, matched)
        if isinstance(result, dict):
            enhanced_prompt = result.get("prompt")
            grounded_in = result.get("grounded_in") or []

    # The text we actually send to OpenAI is: style prefix + enhanced (or
    # raw) prompt. Keep the original raw prompt around for the gallery so
    # human readers see what the player typed, not the rewrite.
    image_prompt_body = enhanced_prompt or prompt
    full_prompt = (
        style_prefix + "\n\n" + image_prompt_body
    ).strip() if style_prefix else image_prompt_body

    payload = {
        "model": image_model,
        "prompt": full_prompt,
        "size": image_size,
        "n": 1,
    }
    # gpt-image-1 supports a `quality` knob (low/medium/high/auto) and
    # always returns b64_json (it rejects response_format entirely). Older
    # dall-e-* models don't take `quality` but DO return URLs by default —
    # we fetch those URLs further down so persistence still works.
    if image_model.startswith("gpt-image"):
        payload["quality"] = image_quality

    try:
        r = http_requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=540,
        )
        if r.status_code >= 400:
            logging.warning("OpenAI image gen %s: %s", r.status_code, r.text[:300])
            return {
                "error": "Image generation failed",
                "details": r.text[:300],
            }, r.status_code

        data = r.json()
        item = (data.get("data") or [{}])[0]
        b64 = item.get("b64_json")
        url = item.get("url")

        # If we got a URL but no b64 (older DALL·E models), fetch the bytes so
        # we can persist them. Best effort — if this fails we still return the
        # URL to the client.
        image_bytes = None
        if b64:
            try:
                image_bytes = base64.b64decode(b64)
            except (ValueError, TypeError):
                logging.warning("Could not decode b64 image data")
        elif url:
            try:
                img_resp = http_requests.get(url, timeout=60)
                if img_resp.status_code == 200:
                    image_bytes = img_resp.content
            except Exception:
                logging.warning("Could not fetch image URL for persistence")

        image_saved_path = None
        if image_bytes and image_output_path:
            try:
                image_output_path = Path(image_output_path)
                image_output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(image_output_path, "wb") as f:
                    f.write(image_bytes)
                image_saved_path = str(image_output_path)
            except Exception:
                logging.exception("Failed to persist generated image to %s", image_output_path)

        gallery_entry = None
        if image_bytes and save_gallery:
            gallery_entry = _save_gallery_entry(
                image_bytes=image_bytes,
                prompt=prompt,
                full_prompt=full_prompt,
                style_key=style_label,
                created_by=created_by,
                model=image_model,
                enhanced_prompt=enhanced_prompt,
                grounded_in=grounded_in,
            )

        response = {
            "url": url,
            "b64": b64,
            "prompt": full_prompt,
            "raw_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
            "grounded_in": grounded_in,
            "model": image_model,
            "style": style_label,
            "image_saved": bool(image_saved_path),
        }
        if gallery_entry:
            response["gallery"] = {
                "id": gallery_entry["id"],
                "image_url": f"/api/gallery/image/{gallery_entry['filename']}",
                "created_at": gallery_entry["created_at"],
            }
        return response, 200
    except Exception as e:
        logging.exception("Image generation error")
        return {"error": "Image generation failed", "details": str(e)}, 500


def _infer_studio_error_code(error_message):
    """Map a free-text job error to one of the client-side error_code
    buckets (quota / api_error / invalid_prompt / unknown). Lets the UI
    pick the right human copy without a separate column."""
    if not error_message:
        return None
    text = str(error_message).lower()
    if "quota" in text or "monthly limit" in text or "rate limit" in text:
        return "quota"
    if "openai_key" in text or "not configured" in text:
        return "api_error"
    if "content policy" in text or "moderation" in text or "rejected" in text:
        return "invalid_prompt"
    if "openai" in text or "image generation failed" in text or "timeout" in text:
        return "api_error"
    return "unknown"


def _studio_job_payload(row):
    return {
        "id": row["id"],
        "jobId": row["id"],
        "creator": row["creator"],
        "prompt": row["prompt"],
        "style": row["style"],
        "status": row["status"],
        "result_url": row["result_url"],
        "error_message": row["error_message"],
        "error_code": _infer_studio_error_code(row["error_message"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _update_studio_job(job_id, status, result_url=None, error_message=None):
    with _app_db() as conn:
        conn.execute("""
            UPDATE studio_jobs
            SET status = ?, result_url = ?, error_message = ?, updated_at = ?
            WHERE id = ?
        """, (
            status,
            result_url,
            error_message,
            _utc_now_iso(),
            job_id,
        ))


# ── Studio quota helpers ─────────────────────────────────────────────────
def _studio_period():
    """Current quota period key ('YYYY-MM' in UTC). Quotas roll over on
    the 1st of each month."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _studio_period_reset_iso():
    """First day of the next period as an ISO date the client can render
    ("June 1, 2026"). Used in the 429 quota response."""
    now = datetime.now(timezone.utc)
    year = now.year + (1 if now.month == 12 else 0)
    month = 1 if now.month == 12 else now.month + 1
    return f"{year:04d}-{month:02d}-01"


def _studio_quota_count(player, period=None):
    period = period or _studio_period()
    with _app_db() as conn:
        row = conn.execute("""
            SELECT count FROM studio_quotas
            WHERE player = ? AND period = ?
        """, (player, period)).fetchone()
    return int(row["count"]) if row else 0


def _studio_quota_consume(player):
    """Increment this player's count for the current period. Returns the
    new total."""
    period = _studio_period()
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO studio_quotas (player, period, count, updated_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(player, period) DO UPDATE SET
                count = count + 1,
                updated_at = excluded.updated_at
        """, (player, period, now))
        row = conn.execute(
            "SELECT count FROM studio_quotas WHERE player = ? AND period = ?",
            (player, period),
        ).fetchone()
    return int(row["count"]) if row else 0


def _notify_art_ready(creator, result_url, gallery_id=None):
    if _push_config_error():
        return
    # Deep-link straight to the same lightbox a gallery click opens.
    # Studio reads ?image=<id> on load and opens the matching entry; if
    # nothing matches (image already deleted, etc.), it falls back to
    # the normal gallery grid.
    if gallery_id:
        target_url = f"/en/Tools/art/?image={gallery_id}"
    else:
        target_url = result_url or "/en/Tools/art/"
    try:
        with _app_db() as conn:
            _fanout_push(
                conn,
                "Your Vallombrosa art is ready",
                "Your Studio piece has finished and is in the shared gallery.",
                target_url,
                recipients=[creator],
            )
    except Exception:
        logging.exception("Art-ready push failed")


def _run_studio_job(job_id, prompt, style_key, creator, enhance):
    try:
        data, status = _generate_image_payload(prompt, style_key, creator, enhance)
        if status >= 400:
            error = data.get("error") or "Image generation failed"
            details = data.get("details")
            if details:
                error = f"{error}: {details}"
            _update_studio_job(job_id, "error", error_message=error[:500])
            return

        result_url = None
        gallery = data.get("gallery") or {}
        if gallery.get("image_url"):
            result_url = gallery["image_url"]
        elif data.get("url"):
            result_url = data["url"]

        if not result_url:
            _update_studio_job(job_id, "error", error_message="Image generation finished without an image URL.")
            return

        _update_studio_job(job_id, "done", result_url=result_url)
        _notify_art_ready(creator, result_url, gallery_id=gallery.get("id"))
    except Exception as exc:
        logging.exception("Studio job failed")
        _update_studio_job(job_id, "error", error_message=str(exc)[:500])


# ── Player lore-submission pipeline ──────────────────────────────────────────

LORE_SUBMISSION_KINDS = {
    "item": {
        "label": "Item",
        "source_dir": "Venturia/Items",
        "url_prefix": "/en/Venturia/Items",
        "image_dir": "images/items",
        "style": "valley-portrait",
        "tags": "venturia, items",
        "index": "Venturia/Items/index.md",
        "index_mode": "simple-markdown",
    },
    "person": {
        "label": "Person",
        "source_dir": "Venturia/Characters/NPCs",
        "url_prefix": "/en/Venturia/Characters/NPCs",
        "image_dir": "images/character-art",
        "style": "valley-portrait",
        "tags": "venturia, characters, npcs",
        "index": "Venturia/Characters/NPCs/index.md",
        "index_mode": "npc-html",
    },
    "place": {
        "label": "Place",
        "source_dir": "Venturia/Locations",
        "url_prefix": "/en/Venturia/Locations",
        "image_dir": "images/locations",
        "style": "valley-place",
        "tags": "venturia, locations",
        "index": "Venturia/Locations/index.md",
        "index_mode": "other-markdown",
    },
    "faction": {
        "label": "Faction",
        "source_dir": "Venturia/Factions",
        "url_prefix": "/en/Venturia/Factions",
        "image_dir": "images/factions",
        "style": "valley-scene",
        "tags": "venturia, factions",
        "index": "Venturia/Factions/index.md",
        "index_mode": "simple-markdown",
    },
    "lore": {
        "label": "Lore",
        "source_dir": "Venturia/Lore",
        "url_prefix": "/en/Venturia/Lore",
        "image_dir": "images/lore",
        "style": "valley-scene",
        "tags": "venturia, lore",
        "index": "Venturia/Lore/index.md",
        "index_mode": "simple-markdown",
    },
    "culture": {
        "label": "Culture",
        "source_dir": "Venturia/Culture",
        "url_prefix": "/en/Venturia/Culture",
        "image_dir": "images/culture",
        "style": "valley-scene",
        "tags": "venturia, culture",
        "index": "Venturia/Culture/index.md",
        "index_mode": "simple-markdown",
    },
}


def _slugify(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    ascii_text = ascii_text.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:80] or f"entry-{secrets.token_hex(4)}"


def _json_loads(value, fallback):
    if not value:
        return fallback
    try:
        data = json.loads(value)
        return data if data is not None else fallback
    except Exception:
        return fallback


def _parse_submission_connections(raw):
    if raw is None:
        return []

    if isinstance(raw, list):
        parsed = []
        for item in raw[:30]:
            if isinstance(item, dict):
                relation = str(item.get("relation") or "Connection").strip()[:60]
                target = str(item.get("target") or "").strip()[:160]
                note = str(item.get("note") or "").strip()[:240]
            else:
                relation = "Connection"
                target = str(item or "").strip()[:160]
                note = ""
            if target:
                parsed.append({"relation": relation or "Connection", "target": target, "note": note})
        return parsed

    text = str(raw or "")
    parsed = []
    for line in text.splitlines()[:30]:
        line = line.strip().lstrip("-*").strip()
        if not line:
            continue
        if ":" in line:
            relation, target = line.split(":", 1)
        elif " - " in line:
            relation, target = line.split(" - ", 1)
        elif " — " in line:
            relation, target = line.split(" — ", 1)
        else:
            relation, target = "Connection", line
        relation = relation.strip()[:60] or "Connection"
        target = target.strip()[:160]
        if target:
            parsed.append({"relation": relation, "target": target, "note": ""})
    return parsed


def _connections_to_text(connections):
    lines = []
    for item in connections or []:
        relation = item.get("relation") or "Connection"
        target = item.get("target") or ""
        note = item.get("note") or ""
        line = f"{relation}: {target}"
        if note:
            line += f" ({note})"
        lines.append(line)
    return "\n".join(lines) or "(none provided)"


def _submission_context_query(kind, title, description, connections, notes=""):
    pieces = [
        LORE_SUBMISSION_KINDS.get(kind, {}).get("label", kind),
        title,
        description,
        _connections_to_text(connections),
        notes,
    ]
    return "\n".join(str(piece or "") for piece in pieces if piece)


def _submission_context(kind, title, description, connections, notes=""):
    query = _submission_context_query(kind, title, description, connections, notes)
    matches = []
    additional = []
    try:
        auto_inject, additional = engine.retrieve(query, rules=False)
    except Exception:
        logging.exception("Lore submission context retrieval failed")
        auto_inject = []
        additional = []

    blocks = []
    for match in auto_inject:
        if len(matches) >= 8:
            break
        if (match.get("source_file") or "").startswith("5e-filtered/"):
            continue
        item = {
            "name": match.get("name"),
            "source_file": match.get("source_file"),
            "score": match.get("score"),
            "text": (match.get("text") or "")[:2200],
        }
        matches.append(item)
        blocks.append(
            f"### {item['name']} ({item['source_file']})\n{item['text']}"
        )

    context_text = "\n\n".join(blocks) if blocks else "(no matching codex context found)"
    if additional:
        extra_lines = [
            f"- {m.get('name')} ({m.get('source_file')}, score {float(m.get('score') or 0):.2f})"
            for m in additional[:10]
        ]
        context_text += "\n\nAdditional possible matches:\n" + "\n".join(extra_lines)

    return {
        "query": query,
        "matches": matches,
        "additional": [
            {
                "name": m.get("name"),
                "source_file": m.get("source_file"),
                "score": m.get("score"),
            }
            for m in additional[:10]
        ],
        "text": context_text[:14000],
    }


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


# Per-kind defaults for the AI fallback. Only used when ANTHROPIC_API_KEY
# is unset — the live AI is told to pick fields itself.
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


def _yaml_quote(value):
    return json.dumps(str(value or ""), ensure_ascii=False)


def _chown_like_site(path):
    try:
        site_stat = SITE_SOURCE_DIR.stat()
        os.chown(path, site_stat.st_uid, site_stat.st_gid)
    except Exception:
        pass


IMAGE_PLACEHOLDER_RE = re.compile(r"\{\{?\s*IMAGE\s*\}?\}", re.IGNORECASE)
MARKDOWN_IMAGE_RE = re.compile(r"^\s*!\[[^\]]*\]\([^)]+\)\s*$", re.MULTILINE)


def _strip_markdown_title(markdown):
    body = (markdown or "").strip()
    return re.sub(r"^#\s+.*(?:\n+|$)", "", body, count=1).strip()


def _strip_generated_images(markdown):
    body = IMAGE_PLACEHOLDER_RE.sub("", markdown or "")
    body = MARKDOWN_IMAGE_RE.sub("", body)
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def _markdown_with_image(markdown, title, image_url):
    body = (markdown or "").strip()
    if not re.match(r"^#\s+", body):
        body = f"# {title}\n\n{body}" if body else f"# {title}"
    if not image_url:
        return IMAGE_PLACEHOLDER_RE.sub("", body).strip() + "\n"

    image_markdown = f"![{title}]({image_url})"
    if IMAGE_PLACEHOLDER_RE.search(body):
        body = IMAGE_PLACEHOLDER_RE.sub(image_markdown, body, count=1)
        return body.strip() + "\n"

    lines = body.splitlines()
    if lines and lines[0].startswith("# "):
        return "\n".join([lines[0], "", image_markdown, "", *lines[1:]]).strip() + "\n"
    return f"{image_markdown}\n\n{body}".strip() + "\n"


def _page_frontmatter(title, summary, tags):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00.000Z")
    return (
        "---\n"
        f"title: {_yaml_quote(title)}\n"
        f"description: {_yaml_quote(summary)}\n"
        "published: true\n"
        f"date: {now}\n"
        f"tags: {tags}\n"
        "editor: markdown\n"
        f"dateCreated: {now}\n"
        "---\n\n"
    )


def _source_file_url(source_file):
    source_file = str(source_file or "").strip()
    if not source_file or source_file.startswith("5e-filtered/") or not source_file.endswith(".md"):
        return None
    path = source_file[:-3]
    if path.endswith("/index"):
        path = path[:-6]
    return f"/en/{path}/" if path else None


def _wiki_url_to_source_path(wiki_url):
    """Inverse of _source_file_url: '/en/Venturia/Items/foo/' -> the on-
    disk SITE_SOURCE_DIR/Venturia/Items/foo.md (or .../index.md for
    section roots). Returns None when the URL isn't a wiki page or the
    target source file doesn't exist."""
    if not wiki_url or not isinstance(wiki_url, str):
        return None
    if not wiki_url.startswith("/en/"):
        return None
    # Normalise: strip /en/ prefix and trailing slash
    rel = wiki_url[4:].rstrip("/")
    if not rel:
        return None
    # Reject path traversal — `..` and absolute paths can never refer to
    # a wiki source file under SITE_SOURCE_DIR.
    if ".." in rel.split("/") or rel.startswith("/"):
        return None
    base = SITE_SOURCE_DIR / rel
    candidates = [
        SITE_SOURCE_DIR / f"{rel}.md",
        SITE_SOURCE_DIR / rel / "index.md",
    ]
    for path in candidates:
        try:
            path.resolve().relative_to(SITE_SOURCE_DIR.resolve())
        except (ValueError, OSError):
            continue
        if path.exists() and path.is_file():
            return path
    return None


# Match the start of any "## Gallery" heading, leading whitespace tolerated.
_WIKI_GALLERY_HEADING_RE = re.compile(r"(?m)^\s*##\s+Gallery\s*$")
# Match the next H2 (## ...) after a given offset — used to find the end
# of the Gallery section.
_WIKI_NEXT_H2_RE = re.compile(r"(?m)^##\s+\S")


def _append_image_to_wiki_gallery(source_path, image_abs_url, alt_text,
                                  gallery_id, pinned_by):
    """Append an image to the wiki page's ## Gallery section, creating
    that section if it doesn't exist. Idempotent on image_abs_url.
    Returns True if the file was modified, False if the image was
    already present."""
    text = source_path.read_text(encoding="utf-8")

    # Idempotency: any existing reference to this image URL counts as
    # already-pinned. Avoids accidental duplicates from double-clicks.
    if image_abs_url in text:
        return False

    safe_alt = re.sub(r"[\[\]\n]", " ", str(alt_text or "Pinned art")).strip() or "Pinned art"
    comment = (
        f"<!-- pinned by {pinned_by or 'unknown'}, "
        f"gallery_id {gallery_id}, {_utc_now_iso()} -->"
    )
    image_line = f"![{safe_alt}]({image_abs_url})"
    block = f"{comment}\n{image_line}\n"

    gallery_match = _WIKI_GALLERY_HEADING_RE.search(text)
    if gallery_match:
        # Insert at the end of the existing Gallery section (right before
        # the next H2, or at EOF if Gallery is the last section).
        start = gallery_match.end()
        next_h2 = _WIKI_NEXT_H2_RE.search(text, start)
        if next_h2:
            insert_pos = next_h2.start()
            head = text[:insert_pos].rstrip() + "\n\n"
            tail = text[insert_pos:]
            new_text = head + block + "\n" + tail
        else:
            new_text = text.rstrip() + "\n\n" + block
    else:
        new_text = text.rstrip() + "\n\n---\n\n## Gallery\n\n" + block

    source_path.write_text(new_text, encoding="utf-8")
    _chown_like_site(source_path)
    return True


def _wiki_link_for_name(name):
    label = str(name or "").strip()
    if not label:
        return ""
    lookup = None
    if engine and getattr(engine, "_name_index", None):
        lookup = engine._name_index.get(label.lower())
    if not lookup:
        escaped = html.escape(label)
        return escaped

    for entry in lookup:
        url = _source_file_url(entry.get("source_file"))
        if url:
            return f'<a href="{html.escape(url)}">{html.escape(label)}</a>'
    return html.escape(label)


def _connection_target_for(connections, *relation_words):
    words = tuple(word.lower() for word in relation_words)
    for item in connections or []:
        relation = str(item.get("relation") or "").lower()
        target = str(item.get("target") or "").strip()
        if target and any(word in relation for word in words):
            return target
    return ""


def _infer_item_type(title, summary, markdown, image_prompt):
    text = f"{title} {summary} {markdown} {image_prompt}".lower()
    checks = [
        ("scimitar", "Scimitar"),
        ("sword", "Sword"),
        ("blade", "Blade"),
        ("dagger", "Dagger"),
        ("knife", "Knife"),
        ("coin", "Coin"),
        ("key", "Key"),
        ("mask", "Mask"),
        ("book", "Book"),
        ("tome", "Tome"),
        ("ring", "Ring"),
        ("amulet", "Amulet"),
        ("cloak", "Cloak"),
        ("staff", "Staff"),
        ("wand", "Wand"),
        ("lantern", "Lantern"),
    ]
    for needle, label in checks:
        if needle in text:
            return label
    return "Item"


def _infer_item_category(title, summary, markdown, image_prompt):
    text = f"{title} {summary} {markdown} {image_prompt}".lower()
    if any(word in text for word in ("weapon", "scimitar", "sword", "blade", "dagger")):
        return "Magic weapon" if any(word in text for word in ("magic", "magical", "enchanted", "charge", "attunement")) else "Weapon"
    if any(word in text for word in ("magic", "magical", "enchanted", "charge", "spell", "attunement")):
        return "Magic item"
    return "Named item"


def _item_card_row(label, value):
    if not value:
        return ""
    return (
        '<div><span style="color: #8b7355; letter-spacing: 0.18em; '
        'text-transform: uppercase; font-size: 0.7rem; font-weight: 600;">'
        f'{html.escape(label)}</span> &nbsp;&middot;&nbsp; {value}</div>\n'
    )


def _card_html(title, image_url, rows, quote):
    """Shared stat-card HTML used by every published lore page. `rows` is
    a list of strings already rendered by _item_card_row()."""
    image_block = ""
    if image_url:
        image_block = (
            '\n<div style="flex-shrink: 0;">\n'
            f'<img src="{html.escape(image_url)}" alt="{html.escape(title)}" '
            'style="width: 280px; max-width: 100%; border-radius: 4px; '
            'box-shadow: 0 10px 36px rgba(0, 0, 0, 0.8); '
            'border: 1px solid rgba(139, 115, 85, 0.5);">\n'
            '</div>\n'
        )
    quote_block = ""
    quote_text = str(quote or "").strip()
    if quote_text:
        quote_block = (
            '<div style="margin-top: 1.25rem; padding-left: 1rem; '
            'border-left: 2px solid rgba(212, 165, 116, 0.4); font-style: '
            'italic; color: rgba(212, 165, 116, 0.9); font-family: '
            "'IM Fell English', Georgia, serif; font-size: 1rem;\">"
            f'"{html.escape(quote_text)}"</div>'
        )
    rows_html = ''.join(rows).rstrip()
    return f"""<div style="display: flex; gap: 2rem; align-items: flex-start; margin: 0 0 2.5rem; padding: 1.5rem 1.75rem; background: linear-gradient(135deg, rgba(20, 18, 24, 0.55) 0%, rgba(36, 28, 18, 0.4) 100%); border: 1px solid rgba(139, 115, 85, 0.35); border-radius: 6px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6); flex-wrap: wrap;">

<div style="flex: 1; min-width: 240px;">
<div style="font-family: 'Cinzel', Georgia, serif; font-size: 2rem; letter-spacing: 0.08em; color: #d4a574; line-height: 1.1; margin-bottom: 0.75rem; text-transform: uppercase;">{html.escape(title)}</div>
<div style="height: 1px; background: linear-gradient(90deg, rgba(212, 165, 116, 0.7), rgba(139, 115, 85, 0.2) 60%, transparent); margin-bottom: 1.25rem;"></div>

<div style="font-family: Georgia, serif; font-size: 0.95rem; color: #e8dcc8; line-height: 1.85;">
{rows_html}
</div>
{quote_block}
</div>
{image_block}
</div>"""


def _render_item_markdown(title, summary, markdown, image_url, connections, image_prompt):
    body = _strip_generated_images(_strip_markdown_title(markdown))
    item_type = _infer_item_type(title, summary, body, image_prompt)
    category = _infer_item_category(title, summary, body, image_prompt)
    owner = _connection_target_for(connections, "owner", "holder", "carried")
    prior_owner = _connection_target_for(connections, "prior", "previous", "former")

    rows = [
        _item_card_row("Category", html.escape(category)),
        _item_card_row("Type", html.escape(item_type)),
        _item_card_row("Owner", _wiki_link_for_name(owner)) if owner else "",
        _item_card_row("Prior Owner", _wiki_link_for_name(prior_owner)) if prior_owner else "",
    ]
    quote = (summary or "").strip() or "A named item in the Vallombrosa campaign."
    card = _card_html(title, image_url, rows, quote)
    if not body:
        body = f"{summary}\n\n## Connections\n\n" + _connections_markdown(connections)
    return f"# {title}\n\n{card}\n\n{body.strip()}\n"


def _render_card_markdown(title, summary, markdown, image_url, card_fields):
    """Render a non-item published page with the AI's card_fields. Each
    field value is run through _wiki_link_for_name so any value that
    matches a known wiki entity becomes a hyperlink."""
    body = _strip_generated_images(_strip_markdown_title(markdown))
    rows = []
    for field in card_fields or []:
        if not isinstance(field, dict):
            continue
        label = str(field.get("label") or "").strip()
        value = str(field.get("value") or "").strip()
        if not label or not value:
            continue
        rows.append(_item_card_row(label, _wiki_link_for_name(value)))
    if not rows:
        # No card_fields means no card — fall back to plain image substitution.
        return _markdown_with_image(markdown, title, image_url)
    card = _card_html(title, image_url, rows, (summary or "").strip())
    if not body:
        body = f"{summary}\n"
    return f"# {title}\n\n{card}\n\n{body.strip()}\n"


def _connections_markdown(connections):
    lines = []
    for item in connections or []:
        relation = str(item.get("relation") or "Connection").strip()
        target = str(item.get("target") or "").strip()
        note = str(item.get("note") or "").strip()
        if not target:
            continue
        line = f"- **{target}** — {relation}"
        if note:
            line += f"; {note}"
        lines.append(line)
    return "\n".join(lines) if lines else "- No connections were provided."


def _render_published_markdown(kind, title, summary, markdown, image_url, connections, image_prompt, card_fields=None):
    if kind == "item":
        return _render_item_markdown(title, summary, markdown, image_url, connections, image_prompt)
    if card_fields:
        return _render_card_markdown(title, summary, markdown, image_url, card_fields)
    return _markdown_with_image(markdown, title, image_url)


def _copy_draft_image(submission_id, kind, slug):
    draft_image = LORE_DRAFT_IMAGES_DIR / f"{submission_id}.png"
    if not draft_image.exists():
        return None
    config = LORE_SUBMISSION_KINDS[kind]
    image_rel = f"{config['image_dir']}/{slug}.png"
    image_target = SITE_SOURCE_DIR / image_rel
    image_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(draft_image, image_target)
    _chown_like_site(image_target)
    return f"/{image_rel}"


def _remove_index_link(text, page_url):
    escaped = re.escape(page_url.rstrip("/"))
    lines = [
        line for line in (text or "").splitlines()
        if not re.search(rf"\]\({escaped}/?\)", line)
    ]
    cleaned = "\n".join(lines).rstrip() + "\n"
    cleaned = re.sub(
        r"\n---\n\n## Player Additions\n\n(?:\s*)$",
        "\n",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned


def _append_to_markdown_list(text, bullet):
    lines = text.rstrip().splitlines()
    last_bullet = None
    for idx, line in enumerate(lines):
        if line.startswith("- "):
            last_bullet = idx
    if last_bullet is None:
        return text.rstrip() + "\n\n" + bullet + "\n"
    lines.insert(last_bullet + 1, bullet)
    return "\n".join(lines).rstrip() + "\n"


def _append_to_named_markdown_section(text, section_title, bullet):
    heading = f"## {section_title}"
    if heading not in text:
        return text.rstrip() + f"\n\n---\n\n{heading}\n\n{bullet}\n"
    pattern = re.compile(
        rf"({re.escape(heading)}\n\n)(.*?)(\n---\n|\n## |\Z)",
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        return text.rstrip() + "\n" + bullet + "\n"
    replacement = match.group(1) + match.group(2).rstrip() + "\n" + bullet + match.group(3)
    return text[:match.start()] + replacement + text[match.end():]


def _append_index_link(kind, title, slug, summary):
    config = LORE_SUBMISSION_KINDS[kind]
    index_path = SITE_SOURCE_DIR / config["index"]
    if not index_path.exists():
        return False

    page_url = f"{config['url_prefix']}/{slug}"
    try:
        text = index_path.read_text(encoding="utf-8")
    except Exception:
        logging.exception("Could not read index %s", index_path)
        return False
    if page_url in text and config["index_mode"] not in {"simple-markdown", "other-markdown"}:
        return True

    clean_summary = (summary or "").strip()[:220] or f"Player-submitted {config['label'].lower()}."
    if config["index_mode"] == "npc-html":
        chip = (
            f'    <a class="vos-row-chip" href="{html.escape(page_url)}/">'
            f'<span><span class="vos-row-chip-title">{html.escape(title)}</span>'
            f'<span class="vos-row-chip-meta">{html.escape(clean_summary)}</span></span>'
            f'<span class="vos-row-chip-arrow" aria-hidden="true">&rsaquo;</span></a>\n'
        )
        pattern = re.compile(
            r'(<section class="vos-compact-panel" aria-labelledby="npc-others">.*?'
            r'<div class="vos-row-chip-list">\n)(.*?)(  </div>\n</section>)',
            re.DOTALL,
        )
        if pattern.search(text):
            text = pattern.sub(lambda m: m.group(1) + m.group(2) + chip + m.group(3), text, count=1)
        else:
            text = text.rstrip() + f"\n\n- **[{title}]({page_url})** — {clean_summary}\n"
    else:
        bullet = f"- **[{title}]({page_url})** — {clean_summary}"
        text = _remove_index_link(text, page_url)
        if config["index_mode"] == "simple-markdown":
            text = _append_to_markdown_list(text, bullet)
        else:
            text = _append_to_named_markdown_section(text, "Other Locations", bullet)

    try:
        index_path.write_text(text, encoding="utf-8")
        _chown_like_site(index_path)
        return True
    except Exception:
        logging.exception("Could not update index %s", index_path)
        return False


def _update_descriptions_json(kind, title, slug, summary, image_prompt):
    section = {
        "item": "items",
        "person": "npcs",
        "place": "locations",
    }.get(kind)
    if not section:
        return False

    path = SITE_SOURCE_DIR / "chatbot" / "descriptions.json"
    if not path.exists():
        return False

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.setdefault(section, {})
        aliases = [title]
        slug_alias = slug.replace("-", " ")
        if slug_alias.lower() != title.lower():
            aliases.append(slug_alias)
        desc = (image_prompt or summary or title).strip()
        if section == "locations":
            data[section][title] = {"aliases": aliases, "desc": desc}
        else:
            data[section][title] = {"aliases": aliases, "desc": desc}
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        _chown_like_site(path)
        return True
    except Exception:
        logging.exception("Could not update descriptions.json")
        return False


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
        "next_steps": [
            "npm run knowledge",
            "docker compose up -d --build chatbot nginx",
        ],
    }, 200


@app.route("/api/lore-submissions", methods=["POST"])
def lore_submission_create():
    body = request.get_json(silent=True) or {}
    submitter, auth_error = _authenticated_player_name(body)
    if auth_error:
        return auth_error
    if not submitter:
        return jsonify({"error": "Login required before submitting lore"}), 401

    kind = str(body.get("kind") or "").strip().lower()
    if kind not in LORE_SUBMISSION_KINDS:
        return jsonify({"error": "Choose item, person, place, faction, or lore"}), 400

    title = str(body.get("title") or "").strip()
    description = str(body.get("description") or body.get("short_description") or "").strip()
    notes = str(body.get("notes") or "").strip()[:2000]
    connections = _parse_submission_connections(body.get("connections"))
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not description:
        return jsonify({"error": "Short description is required"}), 400
    if len(title) > 120:
        return jsonify({"error": "Title is too long"}), 400
    if len(description) > 2500:
        return jsonify({"error": "Description is too long"}), 400

    submission_id = secrets.token_urlsafe(18)
    slug = _slugify(title)
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO lore_submissions (
                id, submitter, kind, title, slug, short_description,
                connections_json, notes, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
        """, (
            submission_id,
            submitter,
            kind,
            title,
            slug,
            description,
            json.dumps(connections, separators=(",", ":")),
            notes,
            now,
            now,
        ))
    _start_lore_draft_thread(submission_id)
    return jsonify({"ok": True, "id": submission_id, "status": "submitted"}), 202


@app.route("/api/lore-submissions/mine", methods=["GET"])
def lore_submissions_mine():
    submitter, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT id, submitter, kind, title, slug, short_description,
                   connections_json, notes, status, context_json,
                   generated_markdown, generated_summary, generated_image_prompt,
                   generated_card_fields_json,
                   image_url, image_filename, error_message, created_at,
                   updated_at, published_at
            FROM lore_submissions
            WHERE submitter = ?
            ORDER BY updated_at DESC
            LIMIT 20
        """, (submitter,)))
    return jsonify({"submissions": [_submission_payload(row, include_markdown=False) for row in rows]})


@app.route("/api/lore-submissions/<submission_id>", methods=["GET"])
def lore_submission_detail(submission_id):
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
    if not row:
        return jsonify({"error": "Submission not found"}), 404
    submitter, auth_error = _logged_in_player_name({"name": row["submitter"]})
    if auth_error:
        return auth_error
    if submitter != row["submitter"]:
        return jsonify({"error": "Identity mismatch"}), 403
    return jsonify({"submission": _submission_payload(row, include_markdown=True)})


@app.route("/api/lore-submissions/<submission_id>/image", methods=["GET"])
def lore_submission_image(submission_id):
    if not re.fullmatch(r"[A-Za-z0-9_-]{12,80}", submission_id or ""):
        abort(404)
    if not LORE_DRAFT_IMAGES_DIR.exists():
        abort(404)
    return send_from_directory(LORE_DRAFT_IMAGES_DIR, f"{submission_id}.png", max_age=60)


@app.route("/api/admin/lore-submissions", methods=["GET"])
def admin_lore_submissions():
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    status = request.args.get("status", "").strip()
    try:
        limit = int(request.args.get("limit", "30"))
    except ValueError:
        limit = 30
    limit = max(1, min(limit, 100))

    where = ""
    args = []
    if status:
        where = "WHERE status = ?"
        args.append(status)
    args.append(limit)
    with _app_db() as conn:
        rows = list(conn.execute(f"""
            SELECT id, submitter, kind, title, slug, short_description,
                   connections_json, notes, status, context_json,
                   generated_markdown, generated_summary, generated_image_prompt,
                   generated_card_fields_json,
                   image_url, image_filename, error_message, created_at,
                   updated_at, published_at
            FROM lore_submissions
            {where}
            ORDER BY updated_at DESC
            LIMIT ?
        """, args))
    return jsonify({"submissions": [_submission_payload(row, include_markdown=False) for row in rows]})


@app.route("/api/admin/lore-submissions/<submission_id>", methods=["GET"])
def admin_lore_submission_detail(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
    if not row:
        return jsonify({"error": "Submission not found"}), 404
    return jsonify({"submission": _submission_payload(row, include_markdown=True, include_context=True)})


@app.route("/api/admin/lore-submissions/<submission_id>/save", methods=["POST"])
def admin_lore_submission_save(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return jsonify({"error": "Submission not found"}), 404
        title = str(body.get("title") or row["title"]).strip()[:120]
        slug = _slugify(body.get("slug") or row["slug"] or title)
        markdown = str(body.get("markdown") or row["generated_markdown"] or "").strip()
        summary = str(body.get("summary") or row["generated_summary"] or "").strip()[:300]
        image_prompt = str(body.get("image_prompt") or row["generated_image_prompt"] or "").strip()[:1800]
        if "card_fields" in body:
            card_fields = _sanitize_card_fields(body.get("card_fields") or [])
        else:
            card_fields = _json_loads(row["generated_card_fields_json"], [])
        card_fields_json = json.dumps(card_fields, separators=(",", ":"))
        conn.execute("""
            UPDATE lore_submissions
            SET title = ?, slug = ?, generated_markdown = ?,
                generated_summary = ?, generated_image_prompt = ?,
                generated_card_fields_json = ?,
                updated_at = ?
            WHERE id = ?
        """, (title, slug, markdown, summary, image_prompt,
              card_fields_json, _utc_now_iso(), submission_id))
        updated = _lore_submission_row(conn, submission_id)
    return jsonify({"ok": True, "submission": _submission_payload(updated, include_markdown=True)})


@app.route("/api/admin/lore-submissions/<submission_id>/draft", methods=["POST"])
def admin_lore_submission_redraft(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return jsonify({"error": "Submission not found"}), 404
        if row["status"] == "published":
            return jsonify({"error": "Published submissions cannot be regenerated"}), 409
    _start_lore_draft_thread(submission_id)
    return jsonify({"ok": True, "id": submission_id, "status": "drafting"}), 202


@app.route("/api/admin/lore-submissions/<submission_id>/reject", methods=["POST"])
def admin_lore_submission_reject(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    body = request.get_json(silent=True) or {}
    reason = str(body.get("reason") or "Rejected by DM").strip()[:500]
    with _app_db() as conn:
        row = _lore_submission_row(conn, submission_id)
        if not row:
            return jsonify({"error": "Submission not found"}), 404
        conn.execute("""
            UPDATE lore_submissions
            SET status = 'rejected', error_message = ?, updated_at = ?
            WHERE id = ?
        """, (reason, _utc_now_iso(), submission_id))
    return jsonify({"ok": True, "id": submission_id, "status": "rejected"})


@app.route("/api/admin/lore-submissions/<submission_id>/publish", methods=["POST"])
def admin_lore_submission_publish(submission_id):
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error
    payload, status = _publish_lore_submission(submission_id, request.get_json(silent=True) or {})
    return jsonify(payload), status


@app.route("/api/studio/generate", methods=["POST"])
def studio_generate():
    body = request.get_json(silent=True) or {}
    prompt, error = _studio_prompt_from_body(body)
    if error:
        payload, status = error
        payload.setdefault("error_code", "invalid_prompt")
        return jsonify(payload), status
    style_key, error = _studio_style_from_body(body)
    if error:
        payload, status = error
        payload.setdefault("error_code", "invalid_prompt")
        return jsonify(payload), status
    creator, auth_error = _studio_creator_from_body(body, require_login=True)
    if auth_error:
        # auth_error is a Flask Response object — re-tag with error_code.
        try:
            data = auth_error.get_json(silent=True) or {}
            if isinstance(data, dict) and "error_code" not in data:
                data["error_code"] = "auth"
                return jsonify(data), auth_error.status_code
        except Exception:
            pass
        return auth_error
    enhance = _studio_enhance_from_body(body)

    # Per-player monthly cap. STUDIO_MONTHLY_QUOTA=0 disables the check
    # (useful for local dev). The DM creator slot is also exempt so the
    # admin can backfill without burning their own budget.
    if STUDIO_MONTHLY_QUOTA > 0 and creator != "DM":
        used = _studio_quota_count(creator)
        if used >= STUDIO_MONTHLY_QUOTA:
            return jsonify({
                "error": (
                    f"You've used all {STUDIO_MONTHLY_QUOTA} of your image "
                    f"generations this month."
                ),
                "error_code": "quota",
                "quota": {
                    "used": used,
                    "limit": STUDIO_MONTHLY_QUOTA,
                    "resets_at": _studio_period_reset_iso(),
                },
            }), 429

    job_id = secrets.token_urlsafe(18)
    now = _utc_now_iso()
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO studio_jobs (
                id, creator, prompt, style, status, result_url,
                error_message, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
        """, (job_id, creator, prompt, style_key, now, now))

    # Count the quota here, before kicking off the background job, so a
    # mid-job server crash can't be used to bypass the cap. The job
    # itself may still fail at the OpenAI step — we deliberately don't
    # refund (failed attempts cost compute on our side too).
    if STUDIO_MONTHLY_QUOTA > 0 and creator != "DM":
        _studio_quota_consume(creator)

    thread = threading.Thread(
        target=_run_studio_job,
        args=(job_id, prompt, style_key, creator, enhance),
        daemon=True,
    )
    thread.start()
    return jsonify({"jobId": job_id}), 202


@app.route("/api/studio/jobs", methods=["GET"])
def studio_jobs():
    mine = request.args.get("mine") == "1"
    if not mine:
        return jsonify({"error": "Only mine=1 is supported"}), 400
    creator, auth_error = _logged_in_player_name()
    if auth_error:
        return auth_error
    if not creator:
        return jsonify({"jobs": []})
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT id, creator, prompt, style, status, result_url,
                   error_message, created_at, updated_at
            FROM studio_jobs
            WHERE creator = ?
            ORDER BY updated_at DESC
            LIMIT 10
        """, (creator,)))
    return jsonify({"jobs": [_studio_job_payload(row) for row in rows]})


@app.route("/api/studio/jobs/<job_id>", methods=["GET"])
def studio_job(job_id):
    with _app_db() as conn:
        row = conn.execute("""
            SELECT id, creator, prompt, style, status, result_url,
                   error_message, created_at, updated_at
            FROM studio_jobs
            WHERE id = ?
        """, (job_id,)).fetchone()
    if not row:
        return jsonify({"error": "Job not found"}), 404

    creator, auth_error = _logged_in_player_name({"name": row["creator"]})
    if auth_error:
        return auth_error
    if creator != row["creator"]:
        return jsonify({"error": "Identity mismatch"}), 403

    return jsonify(_studio_job_payload(row))


@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    """Generate an image via OpenAI's images API + persist to the gallery.

    Kept for legacy callers. The Studio app uses /api/studio/generate so page
    navigation cannot lose the active generation state.
    """
    body = request.get_json(silent=True) or {}
    prompt, error = _studio_prompt_from_body(body)
    if error:
        payload, status = error
        return jsonify(payload), status
    style_key, error = _studio_style_from_body(body)
    if error:
        payload, status = error
        return jsonify(payload), status
    created_by, auth_error = _studio_creator_from_body(body, require_login=True)
    if auth_error:
        return auth_error
    enhance = _studio_enhance_from_body(body)
    payload, status = _generate_image_payload(prompt, style_key, created_by, enhance)
    return jsonify(payload), status


@app.route("/api/art-styles", methods=["GET"])
def art_styles():
    """Return the list of style presets the Art Studio UI can show."""
    return jsonify({
        "default": DEFAULT_STYLE_KEY,
        "styles": [
            {
                "key": key,
                "label": preset["label"],
                "description": preset["description"],
            }
            for key, preset in ART_STYLE_PRESETS.items()
        ],
    })


@app.route("/api/gallery", methods=["GET"])
def list_gallery():
    """List gallery entries, most-recent first.

    Query params:
        limit   — max entries to return (default 60, capped at 200)
        offset  — pagination offset (default 0)
    """
    try:
        limit = int(request.args.get("limit", GALLERY_PAGE_LIMIT))
    except (TypeError, ValueError):
        limit = GALLERY_PAGE_LIMIT
    try:
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    entries = list(reversed(_load_manifest()))  # newest first
    page = entries[offset:offset + limit]

    # Don't leak `full_prompt` (it includes the style prefix; not useful to
    # the UI and longer than necessary). Return public-safe fields only.
    public = [
        {
            "id": e["id"],
            "image_url": f"/api/gallery/image/{e['filename']}",
            "prompt": e.get("prompt", ""),
            "enhanced_prompt": e.get("enhanced_prompt"),
            "grounded_in": e.get("grounded_in") or [],
            "style": e.get("style"),
            "created_by": e.get("created_by"),
            "created_at": e.get("created_at"),
            "model": e.get("model"),
        }
        for e in page
    ]
    return jsonify({
        "total": len(entries),
        "offset": offset,
        "limit": limit,
        "entries": public,
    })


@app.route("/api/descriptions", methods=["GET"])
def list_descriptions():
    """Return the names known to the prompt enhancer (descriptions.json),
    grouped by category. Used by the Studio's 'Available references'
    panel so players can see what entities they can mention without
    describing them visually."""
    try:
        with open(DEFAULT_DESCRIPTIONS_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return jsonify({"categories": []})

    category_labels = {
        "player_characters": "Player Characters",
        "npcs": "NPCs",
        "locations": "Locations",
        "items": "Items",
        "groups": "Groups",
    }
    categories = []
    for key, raw in data.items():
        if key.startswith("_") or not isinstance(raw, dict):
            continue
        names = sorted(raw.keys(), key=str.lower)
        categories.append({
            "key": key,
            "label": category_labels.get(key, key.replace("_", " ").title()),
            "entries": names,
        })
    return jsonify({"categories": categories})


@app.route("/api/gallery/<gallery_id>/favorite", methods=["POST", "DELETE"])
def gallery_favorite(gallery_id):
    """Toggle a per-player favorite on a gallery entry. POST stars,
    DELETE unstars. The favorite row is keyed by (player, gallery_id);
    a row whose gallery_id no longer exists in the manifest is left
    dangling and ignored client-side at render time."""
    if _auth_login_required():
        player, auth_error = _logged_in_player_name()
        if auth_error:
            return auth_error
    else:
        player = _player_name_from_request()
    if not player:
        return jsonify({"error": "Player name required", "error_code": "auth"}), 400

    if request.method == "POST":
        with _app_db() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO gallery_favorites
                    (player, gallery_id, favorited_at)
                VALUES (?, ?, ?)
            """, (player, gallery_id, _utc_now_iso()))
        return jsonify({"ok": True, "favorited": True})

    with _app_db() as conn:
        conn.execute("""
            DELETE FROM gallery_favorites
            WHERE player = ? AND gallery_id = ?
        """, (player, gallery_id))
    return jsonify({"ok": True, "favorited": False})


@app.route("/api/gallery/favorites", methods=["GET"])
def gallery_favorites_list():
    """Return the set of gallery_ids the named player has favorited.
    Cheap O(rows) — gallery is small. The client merges this with the
    gallery list to render the heart state on each card."""
    if _auth_login_required():
        player, auth_error = _logged_in_player_name()
        if auth_error:
            return auth_error
    else:
        player = _player_name_from_request()
    if not player:
        return jsonify({"ids": []})
    with _app_db() as conn:
        rows = list(conn.execute("""
            SELECT gallery_id FROM gallery_favorites
            WHERE player = ?
            ORDER BY favorited_at DESC
        """, (player,)))
    return jsonify({"ids": [r["gallery_id"] for r in rows]})


@app.route("/api/gallery/<gallery_id>/pin", methods=["POST"])
def gallery_pin(gallery_id):
    """Append a gallery image to a wiki page's ## Gallery section.

    Body: { "wiki_url": "/en/Venturia/Items/the-listener-s-coin/" }

    Auth: the image's creator (matched against the logged-in player) or
    a signed-in DM. Either authenticates by the usual flows — the player
    auth token in Authorization for the creator path, the DM session
    JWT in Authorization for the DM path. The wiki_url must resolve to
    an existing source markdown file under SITE_SOURCE_DIR. Pinning the
    same image twice is a no-op (idempotent on image URL)."""
    body = request.get_json(silent=True) or {}
    wiki_url = (body.get("wiki_url") or "").strip()
    if not wiki_url:
        return jsonify({"error": "wiki_url is required", "error_code": "invalid"}), 400

    # Look up the gallery entry by id from the manifest.
    entries = _load_manifest()
    entry = next((e for e in entries if e.get("id") == gallery_id), None)
    if not entry:
        return jsonify({"error": "Gallery image not found", "error_code": "not_found"}), 404

    # Auth: image creator OR signed-in DM.
    creator = (entry.get("created_by") or "").strip()
    actor = None
    player, _player_err = _logged_in_player_name({"name": creator})
    if player and player == creator:
        actor = player
    else:
        dm_email, _dm_err = _verify_session_jwt(_extract_bearer_token())
        if dm_email:
            actor = f"DM ({dm_email})"
    if not actor:
        return jsonify({
            "error": "Only the image creator or a signed-in DM can pin this image.",
            "error_code": "auth",
        }), 403

    source_path = _wiki_url_to_source_path(wiki_url)
    if not source_path:
        return jsonify({
            "error": f"No wiki page found at {wiki_url}",
            "error_code": "not_found",
        }), 404

    # Resolve the absolute image URL the wiki page should embed. The
    # gallery filename lives under /api/gallery/image/<filename>.
    filename = entry.get("filename")
    if not filename:
        return jsonify({"error": "Gallery entry has no filename", "error_code": "invalid"}), 500
    image_url = f"/api/gallery/image/{filename}"
    alt_text = entry.get("prompt") or "Pinned from the Studio"

    try:
        modified = _append_image_to_wiki_gallery(
            source_path, image_url, alt_text, gallery_id, actor
        )
    except Exception as exc:
        logging.exception("Failed to pin gallery image to wiki")
        return jsonify({"error": str(exc), "error_code": "api_error"}), 500

    return jsonify({
        "ok": True,
        "wiki_url": wiki_url,
        "source_file": str(source_path.relative_to(SITE_SOURCE_DIR)),
        "modified": modified,
        "already_pinned": not modified,
    })


@app.route("/api/gallery/image/<path:filename>", methods=["GET"])
def gallery_image(filename):
    """Serve a single persisted gallery image."""
    # send_from_directory does its own safe-path validation against ..
    # and absolute-path tricks, so this is safe to expose.
    if not GALLERY_IMAGES_DIR.exists():
        abort(404)
    return send_from_directory(
        GALLERY_IMAGES_DIR,
        filename,
        max_age=3600,
    )


def _extract_passphrase():
    """Pull a DM passphrase candidate from the request — header takes
    precedence, then JSON body. Returns the trimmed string (possibly empty)."""
    header = request.headers.get("X-DM-Passphrase", "")
    if header:
        return header.strip()
    body = request.get_json(silent=True) or {}
    return (body.get("passphrase") or "").strip()


def _check_dm_passphrase(candidate):
    """Constant-time compare of the candidate against DM_PASSPHRASE.
    Returns False when DM mode is disabled (env unset) so we never
    accidentally allow blank passwords."""
    if not DM_PASSPHRASE:
        return False
    if not candidate:
        return False
    import hmac
    return hmac.compare_digest(
        DM_PASSPHRASE.lower(), candidate.strip().lower()
    )


@app.route("/api/dm-check", methods=["POST"])
def dm_check():
    """Lightweight passphrase validator the UI hits when a DM is logging
    in. Returns 200 on match, 403 otherwise. 503 if DM mode is disabled
    on this server (env var unset) so the UI can hide the toggle entirely.
    """
    if not DM_PASSPHRASE:
        return jsonify({"error": "DM mode not configured on this server"}), 503
    if _check_dm_passphrase(_extract_passphrase()):
        return jsonify({"ok": True}), 200
    return jsonify({"error": "Invalid passphrase"}), 403


@app.route("/api/gallery/<gallery_id>", methods=["DELETE"])
def gallery_delete(gallery_id):
    """Delete one gallery entry — DM-only.

    Removes both the PNG on disk and the manifest entry, under the same
    file lock that guards manifest writes so a concurrent /api/generate-image
    can't corrupt the JSON. Returns 403 on bad/missing passphrase,
    404 if no entry has that id, 200 on success.

    The passphrase is accepted via X-DM-Passphrase header (preferred —
    keeps it out of URLs and access logs) or a JSON body {"passphrase": ...}.
    """
    if not DM_PASSPHRASE:
        return jsonify({"error": "DM mode not configured on this server"}), 503
    if not _check_dm_passphrase(_extract_passphrase()):
        return jsonify({"error": "Forbidden"}), 403

    # Sanity-check the id shape — the manifest uses
    # YYYYMMDD-HHMMSS-<8 hex chars> so reject anything else without
    # touching the filesystem.
    if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[0-9a-f]{6,16}", gallery_id):
        return jsonify({"error": "Bad id"}), 400

    try:
        _ensure_gallery_dirs()
        with open(GALLERY_MANIFEST.parent / ".manifest.lock", "a+") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
                entries = _load_manifest()
                target = next((e for e in entries if e.get("id") == gallery_id), None)
                if not target:
                    return jsonify({"error": "Not found"}), 404
                kept = [e for e in entries if e.get("id") != gallery_id]
                _write_manifest_atomic(kept)
                # Best-effort image cleanup. If the file is already gone
                # the manifest has still been pruned, which is what matters.
                try:
                    (GALLERY_IMAGES_DIR / target["filename"]).unlink()
                except (OSError, KeyError):
                    pass
                return jsonify({
                    "ok": True,
                    "deleted_id": gallery_id,
                    "remaining": len(kept),
                }), 200
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    except Exception:
        logging.exception("Gallery delete failed for %s", gallery_id)
        return jsonify({"error": "Delete failed"}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "loremaster"})


# ── Startup ──────────────────────────────────────────────────────────────────

_run_app_migrations()
engine.load()
logging.info("Loremaster ready (player-only)")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=False)
