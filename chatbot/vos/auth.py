from .imports import *
from .symbols import *
from .config import *

def _utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _b64url_encode(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(value):
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def _google_oauth_configured():
    return bool(GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)


def _discord_oauth_configured():
    return bool(DISCORD_OAUTH_CLIENT_ID and DISCORD_OAUTH_CLIENT_SECRET)


def _oauth_login_configured():
    return _discord_oauth_configured() or _google_oauth_configured()


def _auth_login_required():
    return bool(PLAYER_LOGIN_CODES or _oauth_login_configured())


def _is_dm_player(player_name):
    return player_name == "DM"


def _issue_player_token(player_name, is_dm=False, provider="", principal=""):
    if not AUTH_TOKEN_SECRET:
        return None
    now = int(time.time())
    payload = {
        "name": player_name,
        "is_dm": bool(is_dm or _is_dm_player(player_name)),
        "provider": provider,
        "principal": principal,
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


def _verify_player_token_payload(token):
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
    # Re-check the revocation list on every request so removing someone's
    # access takes effect within a request, not whenever their 180-day token
    # happens to expire. Mirrors the ALLOWED_DM_EMAILS re-check below.
    if _canonical_login_name(name) in REVOKED_PLAYERS:
        return None
    return payload


def _verify_player_token(token):
    payload = _verify_player_token_payload(token)
    if not payload:
        return None
    return payload.get("name")


def _extract_player_token(body=None):
    body = body or {}
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    header_token = request.headers.get("X-Player-Token", "").strip()
    if header_token:
        return header_token
    token = body.get("token") or request.args.get("token")
    if isinstance(token, str) and token.strip():
        return token.strip()
    return request.cookies.get(AUTH_COOKIE_NAME, "").strip()


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
    idinfo = _verify_google_oauth_id_token(credential)
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
    player_payload = _verify_player_token_payload(_extract_player_token())
    if player_payload and bool(player_payload.get("is_dm") or _is_dm_player(player_payload.get("name"))):
        request.dm_email = player_payload.get("principal") or player_payload.get("name") or "DM"
        return None

    # A verified player who is not the DM is refused here rather than falling
    # through. Past this point the checks are about the server's OAuth setup,
    # and answering "auth is not configured" to someone who is simply not the DM
    # reports on the wrong thing — they are authenticated, just not allowed.
    if player_payload:
        return jsonify({"error": "DM access required", "error_code": "forbidden"}), 403

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


def _safe_next_url(value):
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//"):
        return "/"
    return value[:300]


def _with_auth_status(next_url, status):
    next_url = _safe_next_url(next_url)
    base, sep, frag = next_url.partition("#")
    glue = "&" if "?" in base else "?"
    url = f"{base}{glue}auth={status}"
    return f"{url}#{frag}" if sep else url


def _oauth_redirect_uri(provider):
    if provider == "discord" and DISCORD_OAUTH_REDIRECT_URI:
        return DISCORD_OAUTH_REDIRECT_URI
    if provider == "google" and GOOGLE_OAUTH_REDIRECT_URI:
        return GOOGLE_OAUTH_REDIRECT_URI
    base = PUBLIC_BASE_URL or request.host_url.rstrip("/")
    return f"{base}/api/auth/oauth/{provider}/callback"


def _oauth_state_secret():
    return AUTH_TOKEN_SECRET or SESSION_JWT_SECRET or VAPID_PRIVATE_KEY or ANTHROPIC_API_KEY


def _issue_oauth_state(provider, next_url):
    secret = _oauth_state_secret()
    if not secret:
        return None
    payload = {
        "provider": provider,
        "next": _safe_next_url(next_url),
        "nonce": secrets.token_urlsafe(16),
        "exp": int(time.time()) + 10 * 60,
    }
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"


def _verify_oauth_state(state, provider):
    secret = _oauth_state_secret()
    if not state or not secret:
        return None
    try:
        payload_b64, sig_b64 = state.split(".", 1)
    except ValueError:
        return None
    expected = hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
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
    if payload.get("provider") != provider:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def _auth_provider_list():
    providers = []
    if DISCORD_OAUTH_CLIENT_ID:
        providers.append({
            "id": "discord",
            "label": "Continue with Discord",
            "primary": True,
            "configured": _discord_oauth_configured(),
            "login_url": "/api/auth/oauth/discord/start",
        })
    if GOOGLE_OAUTH_CLIENT_ID:
        providers.append({
            "id": "google",
            "label": "Continue with Google",
            "primary": not providers,
            "configured": _google_oauth_configured(),
            "login_url": "/api/auth/oauth/google/start",
        })
    return providers


def _verify_google_oauth_id_token(credential):
    if not credential:
        raise ValueError("No Google credential supplied")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except ImportError as exc:
        raise ValueError(f"google-auth not installed: {exc}")
    try:
        return google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_OAUTH_CLIENT_ID
        )
    except Exception as exc:
        raise ValueError(f"Google rejected the credential: {exc}")


def _exchange_google_code(code):
    response = http_requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": _oauth_redirect_uri("google"),
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    if response.status_code >= 400:
        raise ValueError("Google rejected the authorization code")
    token_data = response.json()
    idinfo = _verify_google_oauth_id_token(token_data.get("id_token"))
    email = (idinfo.get("email") or "").lower()
    if not email or not idinfo.get("email_verified"):
        raise ValueError("Google did not return a verified email")
    return {
        "provider": "google",
        "principal": email,
        "email": email,
        "display": idinfo.get("name") or email,
    }


def _exchange_discord_code(code):
    response = http_requests.post(
        "https://discord.com/api/oauth2/token",
        data={
            "client_id": DISCORD_OAUTH_CLIENT_ID,
            "client_secret": DISCORD_OAUTH_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": _oauth_redirect_uri("discord"),
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    if response.status_code >= 400:
        raise ValueError("Discord rejected the authorization code")
    token_data = response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError("Discord did not return an access token")
    user_response = http_requests.get(
        "https://discord.com/api/users/@me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    if user_response.status_code >= 400:
        raise ValueError("Discord profile lookup failed")
    user = user_response.json()
    discord_id = str(user.get("id") or "").strip()
    if not discord_id:
        raise ValueError("Discord did not return a user id")
    display = user.get("global_name") or user.get("username") or "Discord user"
    return {
        "provider": "discord",
        "principal": discord_id,
        "email": (user.get("email") or "").lower(),
        "display": display,
    }


def _resolve_oauth_player(profile):
    provider = profile.get("provider")
    principal = (profile.get("principal") or "").lower()
    email = (profile.get("email") or "").lower()

    def _allow(player_name):
        if _canonical_login_name(player_name) in REVOKED_PLAYERS:
            raise ValueError("This account's access has been revoked.")
        return player_name

    if provider == "google":
        if email in ALLOWED_DM_EMAILS:
            return "DM", True
        if email in GOOGLE_PLAYER_MAP:
            return _allow(GOOGLE_PLAYER_MAP[email]), False

    if provider == "discord":
        discord_principal = _normalize_discord_principal(profile.get("principal"))
        if discord_principal in ALLOWED_DM_DISCORD_IDS:
            return "DM", True
        if discord_principal in DISCORD_PLAYER_MAP:
            return _allow(DISCORD_PLAYER_MAP[discord_principal]), False

    raise ValueError(
        "This OAuth account is not mapped to a player. "
        f"provider={provider or 'unknown'} "
        f"principal={principal or 'unknown'} "
        f"display={profile.get('display') or 'unknown'} "
        f"discord_map_entries={len(DISCORD_PLAYER_MAP)} "
        f"discord_dm_ids={len(ALLOWED_DM_DISCORD_IDS)} "
        "Add it to GOOGLE_PLAYER_MAP or DISCORD_PLAYER_MAP."
    )


def _auth_session_payload(token):
    payload = _verify_player_token_payload(token)
    if not payload:
        return None
    name = payload.get("name")
    return {
        "ok": True,
        "loginRequired": _auth_login_required(),
        "playerName": name,
        "isDm": bool(payload.get("is_dm") or _is_dm_player(name)),
        "provider": payload.get("provider") or "",
    }

__all__ = ['_utc_now_iso', '_b64url_encode', '_b64url_decode', '_google_oauth_configured', '_discord_oauth_configured', '_oauth_login_configured', '_auth_login_required', '_is_dm_player', '_issue_player_token', '_verify_player_token_payload', '_verify_player_token', '_extract_player_token', '_authenticated_player_name', '_logged_in_player_name', '_player_name_from_request', '_admin_auth_configured', '_extract_bearer_token', '_verify_google_id_token', '_mint_session_jwt', '_verify_session_jwt', '_admin_error_response', '_safe_next_url', '_with_auth_status', '_oauth_redirect_uri', '_oauth_state_secret', '_issue_oauth_state', '_verify_oauth_state', '_auth_provider_list', '_verify_google_oauth_id_token', '_exchange_google_code', '_exchange_discord_code', '_resolve_oauth_player', '_auth_session_payload']
