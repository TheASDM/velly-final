#!/usr/bin/env python3
"""Run a loopback-only console that sends a real player DM to the DM seat.

The browser never receives a credential. This process reads the production
origin and signing secret from the repository's local .env, mints a short-lived
player token, and calls the same IM endpoint as the installed app.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import html
import json
import os
import secrets
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = REPO_ROOT / ".env"
PLAYERS_FILE = REPO_ROOT / "_data" / "players.json"
LOOPBACK_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
MAX_FORM_BYTES = 16 * 1024
MAX_MESSAGE_BYTES = 4096
TOKEN_TTL_SECONDS = 10 * 60
SEND_COOLDOWN_SECONDS = 1.5


class ConsoleError(RuntimeError):
    """An expected configuration, validation, or upstream API failure."""


@dataclass(frozen=True)
class ConsoleConfig:
    base_url: str
    auth_token_secret: str
    players: tuple[str, ...]


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def read_dotenv(path: Path) -> dict[str, str]:
    """Read simple KEY=VALUE entries without executing the env file."""
    if not path.is_file():
        raise ConsoleError(f"Environment file not found: {path}")
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def _validated_base_url(value: str) -> str:
    base_url = value.strip().rstrip("/")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ConsoleError("PUBLIC_BASE_URL must be a complete http(s) URL.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ConsoleError("PUBLIC_BASE_URL must be an origin, without credentials or a query.")
    return base_url


def load_config(env_file: Path = DEFAULT_ENV_FILE) -> ConsoleConfig:
    file_values = read_dotenv(env_file)
    base_url = os.environ.get("PUBLIC_BASE_URL", "").strip() or file_values.get(
        "PUBLIC_BASE_URL", ""
    )
    secret = os.environ.get("AUTH_TOKEN_SECRET", "").strip() or file_values.get(
        "AUTH_TOKEN_SECRET", ""
    )
    if not base_url:
        raise ConsoleError(f"PUBLIC_BASE_URL is missing from {env_file}.")
    if not secret:
        raise ConsoleError(f"AUTH_TOKEN_SECRET is missing from {env_file}.")

    try:
        roster = json.loads(PLAYERS_FILE.read_text(encoding="utf-8"))
        players = tuple(
            row["name"]
            for row in roster
            if isinstance(row, dict)
            and isinstance(row.get("name"), str)
            and row["name"] != "DM"
        )
    except (OSError, json.JSONDecodeError, TypeError, KeyError) as exc:
        raise ConsoleError(f"Could not load the player roster: {exc}") from exc
    if not players:
        raise ConsoleError("The player roster has no non-DM players.")
    return ConsoleConfig(_validated_base_url(base_url), secret, players)


def issue_player_token(player_name: str, secret: str, now: int | None = None) -> str:
    """Mirror chatbot.vos.auth._issue_player_token without importing Flask."""
    issued_at = int(time.time()) if now is None else int(now)
    payload = {
        "name": player_name,
        "is_dm": False,
        "provider": "push-test-console",
        "principal": "loopback",
        "iat": issued_at,
        "exp": issued_at + TOKEN_TTL_SECONDS,
    }
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature = hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{payload_b64}.{_b64url_encode(signature)}"


def direct_thread_key(first: str, second: str) -> str:
    return "|".join(sorted((first, second)))


def send_dm(
    config: ConsoleConfig,
    player_name: str,
    message: str,
    *,
    opener=urlopen,
) -> dict:
    if player_name not in config.players:
        raise ConsoleError("Choose a player from the roster.")
    message = message.strip()
    if not message:
        raise ConsoleError("Write a test message first.")
    if len(message.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise ConsoleError("The message is longer than the app's 4 KB limit.")

    thread_key = direct_thread_key("DM", player_name)
    endpoint = f"{config.base_url}/api/im/thread/{quote(thread_key, safe='')}"
    body = json.dumps(
        {"body": message, "clientMessageId": str(uuid.uuid4())},
        separators=(",", ":"),
    ).encode("utf-8")
    request = Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {issue_player_token(player_name, config.auth_token_secret)}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Vallombrosa-Push-Test-Console/1",
        },
    )
    try:
        with opener(request, timeout=15) as response:
            status = response.status
            raw = response.read()
    except HTTPError as exc:
        raw = exc.read()
        detail = _upstream_error(raw) or exc.reason
        raise ConsoleError(f"The messaging API returned {exc.code}: {detail}") from exc
    except URLError as exc:
        raise ConsoleError(f"Could not reach the messaging API: {exc.reason}") from exc

    if status not in {HTTPStatus.OK, HTTPStatus.CREATED}:
        raise ConsoleError(f"The messaging API returned unexpected status {status}.")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConsoleError("The messaging API returned an invalid response.") from exc
    if not payload.get("ok"):
        raise ConsoleError(_upstream_error(raw) or "The messaging API rejected the message.")
    return payload


def _upstream_error(raw: bytes) -> str:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return raw.decode("utf-8", errors="replace")[:240].strip()
    return str(payload.get("error") or payload.get("message") or "")[:240]


def default_message(player_name: str) -> str:
    stamp = datetime.now().astimezone().strftime("%I:%M:%S %p")
    return f"Push notification test from {player_name} at {stamp}"


def render_page(
    config: ConsoleConfig,
    form_nonce: str,
    *,
    selected: str | None = None,
    message: str | None = None,
    notice: str = "",
    failed: bool = False,
) -> bytes:
    selected = selected if selected in config.players else config.players[0]
    message = default_message(selected) if message is None else message
    options = "".join(
        f'<option value="{html.escape(name, quote=True)}"'
        f'{" selected" if name == selected else ""}>{html.escape(name)}</option>'
        for name in config.players
    )
    status = ""
    if notice:
        status_class = "status error" if failed else "status success"
        status = f'<div class="{status_class}" role="status">{html.escape(notice)}</div>'
    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Foglight push test</title>
  <style>
    :root {{ color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; color: #f4ead8;
      background: radial-gradient(circle at top, #342844 0, #17131d 44%, #0d0b10 100%); }}
    main {{ width: min(620px, calc(100% - 28px)); margin: 28px auto; padding: 32px;
      border: 1px solid #685579; border-radius: 22px; background: rgba(23, 18, 29, .94);
      box-shadow: 0 28px 80px rgba(0,0,0,.48); }}
    .eyebrow {{ margin: 0 0 8px; color: #d9b86c; font-size: .74rem; font-weight: 800;
      letter-spacing: .16em; text-transform: uppercase; }}
    h1 {{ margin: 0; font-family: Georgia, serif; font-size: clamp(2rem, 7vw, 3.1rem); line-height: 1; }}
    .intro {{ color: #c9bdce; line-height: 1.55; }}
    .warning {{ margin: 22px 0; padding: 14px 16px; border-left: 3px solid #d9b86c;
      background: #282131; color: #eee2cf; line-height: 1.45; }}
    label {{ display: block; margin: 18px 0 8px; font-weight: 750; }}
    select, textarea {{ width: 100%; border: 1px solid #695b73; border-radius: 12px; color: #fff;
      background: #110e15; padding: 13px 14px; font: inherit; }}
    textarea {{ min-height: 118px; resize: vertical; line-height: 1.45; }}
    select:focus, textarea:focus {{ outline: 3px solid rgba(217,184,108,.25); border-color: #d9b86c; }}
    button {{ width: 100%; margin-top: 18px; border: 0; border-radius: 12px; padding: 14px 18px;
      color: #171018; background: #d9b86c; font: inherit; font-weight: 850; cursor: pointer; }}
    button:hover {{ background: #efd18a; }}
    .status {{ margin: 18px 0 0; padding: 13px 15px; border-radius: 12px; line-height: 1.4; }}
    .success {{ color: #d9f6df; background: #173622; border: 1px solid #3c7650; }}
    .error {{ color: #ffdcd7; background: #421e20; border: 1px solid #8a4548; }}
    footer {{ margin-top: 22px; color: #918797; font-size: .78rem; text-align: center; }}
    code {{ color: #ead18e; }}
    @media (max-width: 480px) {{ main {{ padding: 24px 20px; }} }}
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Local test console</p>
    <h1>Send Dustin a DM</h1>
    <p class="intro">This creates a real production message from the selected player to the DM seat and runs the normal push-notification fan-out.</p>
    <div class="warning"><strong>For a system banner:</strong> put Foglight in the background or lock the target device before sending. A visible app intentionally handles the event in-app instead.</div>
    {status}
    <form method="post" action="/send" autocomplete="off">
      <input type="hidden" name="nonce" value="{html.escape(form_nonce, quote=True)}">
      <label for="player">Message from</label>
      <select id="player" name="player">{options}</select>
      <label for="message">Message</label>
      <textarea id="message" name="message" maxlength="4096" required>{html.escape(message)}</textarea>
      <button type="submit">Send real DM + push</button>
    </form>
    <footer>Bound to <code>127.0.0.1</code> only · credentials never enter the browser</footer>
  </main>
</body>
</html>"""
    return page.encode("utf-8")


class PushTestServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, config: ConsoleConfig):
        super().__init__(address, handler)
        self.config = config
        self.form_nonce = secrets.token_urlsafe(32)
        self.send_lock = threading.Lock()
        self.last_send_at = 0.0


class PushTestHandler(BaseHTTPRequestHandler):
    server: PushTestServer

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {fmt % args}", flush=True)

    def _allowed_host(self) -> bool:
        port = self.server.server_port
        return self.headers.get("Host", "").lower() in {
            LOOPBACK_HOST,
            "localhost",
            f"{LOOPBACK_HOST}:{port}",
            f"localhost:{port}",
        }

    def _allowed_origin(self) -> bool:
        origin = self.headers.get("Origin", "")
        if not origin:
            return True
        port = self.server.server_port
        return origin.lower() in {
            f"http://{LOOPBACK_HOST}:{port}",
            f"http://localhost:{port}",
        }

    def _send_headers(self, status: int, content_type: str, length: int) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()

    def _reply(self, status: int, body: bytes, content_type: str = "text/html; charset=utf-8") -> None:
        self._send_headers(status, content_type, len(body))
        self.wfile.write(body)

    def do_GET(self) -> None:
        if not self._allowed_host():
            self._reply(HTTPStatus.FORBIDDEN, b"Forbidden", "text/plain; charset=utf-8")
            return
        if self.path == "/health":
            body = b'{"ok":true}'
            self._reply(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return
        if self.path not in {"/", ""}:
            self._reply(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
            return
        self._reply(
            HTTPStatus.OK,
            render_page(self.server.config, self.server.form_nonce),
        )

    def do_POST(self) -> None:
        if self.path != "/send":
            self._reply(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
            return
        if not self._allowed_host() or not self._allowed_origin():
            self._reply(HTTPStatus.FORBIDDEN, b"Forbidden", "text/plain; charset=utf-8")
            return
        if self.headers.get_content_type() != "application/x-www-form-urlencoded":
            self._reply(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, b"Use the form", "text/plain; charset=utf-8")
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_FORM_BYTES:
            self._reply(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, b"Invalid form size", "text/plain; charset=utf-8")
            return
        try:
            fields = parse_qs(
                self.rfile.read(content_length).decode("utf-8"),
                keep_blank_values=True,
                max_num_fields=10,
            )
        except (UnicodeDecodeError, ValueError):
            self._reply(HTTPStatus.BAD_REQUEST, b"Invalid form", "text/plain; charset=utf-8")
            return
        nonce = fields.get("nonce", [""])[0]
        player = fields.get("player", [""])[0]
        message = fields.get("message", [""])[0]
        if not secrets.compare_digest(nonce, self.server.form_nonce):
            self._reply(HTTPStatus.FORBIDDEN, b"Refresh the page and try again", "text/plain; charset=utf-8")
            return

        try:
            with self.server.send_lock:
                elapsed = time.monotonic() - self.server.last_send_at
                if elapsed < SEND_COOLDOWN_SECONDS:
                    raise ConsoleError("Wait a moment before sending another test.")
                self.server.last_send_at = time.monotonic()
            payload = send_dm(self.server.config, player, message)
            message_id = payload.get("message", {}).get("id")
            notice = f"Sent as {player}. Message #{message_id} is in the DM thread; push fan-out was queued."
            body = render_page(
                self.server.config,
                self.server.form_nonce,
                selected=player,
                notice=notice,
            )
            self._reply(HTTPStatus.OK, body)
        except ConsoleError as exc:
            body = render_page(
                self.server.config,
                self.server.form_nonce,
                selected=player,
                message=message,
                notice=str(exc),
                failed=True,
            )
            self._reply(HTTPStatus.BAD_REQUEST, body)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate configuration without starting the web server",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not 1024 <= args.port <= 65535:
        raise SystemExit("--port must be between 1024 and 65535")
    try:
        config = load_config(args.env_file.resolve())
    except ConsoleError as exc:
        raise SystemExit(f"Configuration error: {exc}") from exc
    if args.check:
        print(
            f"Configuration ready: {len(config.players)} players, "
            f"API origin {config.base_url}",
            flush=True,
        )
        return 0

    server = PushTestServer((LOOPBACK_HOST, args.port), PushTestHandler, config)
    print(f"Foglight push test console: http://{LOOPBACK_HOST}:{args.port}", flush=True)
    print("Press Ctrl+C to stop. No credential is exposed to the browser.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping push test console.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
