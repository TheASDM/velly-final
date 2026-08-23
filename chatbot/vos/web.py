from .imports import *
from .symbols import *
from .config import *

# ── Flask app ────────────────────────────────────────────────────────────────

app = Flask(__name__)


def _chat_rate_limit_key():
    """Limit by the player auth token when we can identify the user
    (so a shared NAT/IP doesn't penalise everyone), falling back to
    the remote IP for anonymous callers."""
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            # Hash so the key cache doesn't carry the raw token around.
            return "tok:" + hashlib.sha256(token.encode()).hexdigest()[:24]
    return "ip:" + get_remote_address()


limiter = Limiter(
    app=app,
    key_func=_chat_rate_limit_key,
    storage_uri="memory://",
    default_limits=[],   # no global default; only /api/chat is limited
)


@app.errorhandler(429)
def _rate_limited(exc):
    return jsonify({
        "error": (
            "Slow down — you've hit the chat rate limit. "
            "Try again in a minute."
        ),
        "error_code": "rate_limited",
    }), 429

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)


_CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS"
_CORS_HEADERS = "Content-Type, Authorization, X-Admin-Token, X-Player-Token"

# Comma-separated list of allowed origins. When unset we fall open to
# "*" so local dev (no env vars, file://, etc.) keeps working. Set in
# .env on the VPS to lock down production.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]


def _cors_origin_for_request():
    """Return the value to send back in Access-Control-Allow-Origin for
    this request, or None to omit the header entirely (which makes the
    browser block the response). When ALLOWED_ORIGINS is unset, fall
    open to '*' so local dev works without configuration."""
    if not ALLOWED_ORIGINS:
        return "*"
    origin = (request.headers.get("Origin") or "").strip()
    if origin and origin in ALLOWED_ORIGINS:
        return origin
    return None


def _apply_cors_headers(response):
    allowed = _cors_origin_for_request()
    if allowed:
        response.headers["Access-Control-Allow-Origin"] = allowed
        if allowed != "*":
            # Tell caches the response depends on the Origin header so a
            # cached response for one origin can't be served to another.
            response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = _CORS_METHODS
    response.headers["Access-Control-Allow-Headers"] = _CORS_HEADERS
    return response


@app.before_request
def handle_cors_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        return _apply_cors_headers(response)


@app.after_request
def add_cors_headers(response):
    return _apply_cors_headers(response)

__all__ = ['app', '_chat_rate_limit_key', 'limiter', '_rate_limited', '_CORS_METHODS', '_CORS_HEADERS', 'ALLOWED_ORIGINS', '_cors_origin_for_request', '_apply_cors_headers', 'handle_cors_preflight', 'add_cors_headers']
