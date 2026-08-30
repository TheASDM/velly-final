from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("auth", __name__)

@bp.route("/api/auth/config", methods=["GET"])
def auth_config():
    return jsonify({
        "loginRequired": _auth_login_required(),
        "authConfigured": bool((AUTH_TOKEN_SECRET and (PLAYER_LOGIN_CODES or _oauth_login_configured())) or not _auth_login_required()),
        "players": PLAYER_NAMES,
        "providers": _auth_provider_list(),
        "legacyCodeLogin": bool(PLAYER_LOGIN_CODES),
    })


@bp.route("/api/auth/oauth/<provider>/start", methods=["GET"])
def auth_oauth_start(provider):
    provider = (provider or "").lower()
    next_url = _safe_next_url(request.args.get("next") or request.referrer or "/")
    state = _issue_oauth_state(provider, next_url)
    if not state:
        return jsonify({"error": "OAuth state signing is not configured"}), 503

    if provider == "discord":
        if not DISCORD_OAUTH_CLIENT_ID:
            return jsonify({"error": "Discord OAuth client id is not configured"}), 503
        params = urlencode({
            "client_id": DISCORD_OAUTH_CLIENT_ID,
            "redirect_uri": _oauth_redirect_uri("discord"),
            "response_type": "code",
            "scope": "identify email",
            "state": state,
            "prompt": "consent",
        })
        return redirect(f"https://discord.com/api/oauth2/authorize?{params}")

    if provider == "google":
        if not GOOGLE_OAUTH_CLIENT_ID:
            return jsonify({"error": "Google OAuth client id is not configured"}), 503
        params = urlencode({
            "client_id": GOOGLE_OAUTH_CLIENT_ID,
            "redirect_uri": _oauth_redirect_uri("google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
            "access_type": "online",
        })
        return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")

    return jsonify({"error": "Unknown OAuth provider"}), 404


@bp.route("/api/auth/oauth/<provider>/callback", methods=["GET"])
def auth_oauth_callback(provider):
    provider = (provider or "").lower()
    state_data = _verify_oauth_state(request.args.get("state", ""), provider)
    next_url = _safe_next_url((state_data or {}).get("next") or "/")
    if not state_data:
        return redirect(_with_auth_status(next_url, "error"))
    if request.args.get("error"):
        return redirect(_with_auth_status(next_url, "error"))
    code = request.args.get("code", "")
    if not code:
        return redirect(_with_auth_status(next_url, "error"))

    try:
        if provider == "discord":
            if not _discord_oauth_configured():
                raise ValueError("Discord OAuth is not fully configured")
            profile = _exchange_discord_code(code)
        elif provider == "google":
            if not _google_oauth_configured():
                raise ValueError("Google OAuth is not fully configured")
            profile = _exchange_google_code(code)
        else:
            raise ValueError("Unknown OAuth provider")
        player_name, is_dm = _resolve_oauth_player(profile)
        token = _issue_player_token(
            player_name,
            is_dm=is_dm,
            provider=profile.get("provider") or provider,
            principal=profile.get("principal") or "",
        )
        if not token:
            raise ValueError("Auth token signing is not configured")
    except Exception:
        logging.exception("OAuth callback failed for provider %s", provider)
        return redirect(_with_auth_status(next_url, "error"))

    response = make_response(redirect(_with_auth_status(next_url, "ok")))
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        max_age=AUTH_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="Lax",
    )
    return response


@bp.route("/api/auth/login", methods=["POST"])
@limiter.limit("10/minute;60/hour")
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
    response = jsonify({
        "ok": True,
        "playerName": name,
        "token": token,
        "expiresIn": AUTH_TOKEN_TTL_SECONDS,
    })
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        max_age=AUTH_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="Lax",
    )
    return response


@bp.route("/api/auth/session", methods=["GET"])
def auth_session():
    if not _auth_login_required():
        return jsonify({"ok": True, "loginRequired": False})
    payload = _auth_session_payload(_extract_player_token())
    if not payload:
        return jsonify({"error": "Login required"}), 401
    return jsonify(payload)


@bp.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    response = jsonify({"ok": True})
    response.delete_cookie(AUTH_COOKIE_NAME, samesite="Lax")
    return response

__all__ = ['auth_config', 'auth_oauth_start', 'auth_oauth_callback', 'auth_login', 'auth_session', 'auth_logout']
