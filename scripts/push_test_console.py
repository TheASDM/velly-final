#!/usr/bin/env python3
"""Run a no-login localhost console that sends a Vesper DM to the DM seat.

The console does not mint or transmit an application credential. It uses the
developer machine's existing ``ssh vapp`` connection to call a route that is
available only on loopback inside the production chatbot container.
"""

from __future__ import annotations

import argparse
import html
import json
import subprocess
import threading
import time
import uuid
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


LOOPBACK_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DEFAULT_SSH_HOST = "vapp"
TEST_MESSENGER_NAME = "Vesper"
MAX_FORM_BYTES = 16 * 1024
MAX_MESSAGE_BYTES = 4096
SEND_COOLDOWN_SECONDS = 1.5
REMOTE_SEND_COMMAND = (
    "docker exec -i dnd_chatbot "
    "curl -sS --max-time 20 -X POST "
    "-H 'Content-Type: application/json' --data-binary @- "
    "-w '\\n%{http_code}' "
    "http://127.0.0.1:3001/api/internal/im-test-message"
)
REMOTE_CHECK_COMMAND = (
    "docker exec dnd_chatbot "
    "curl -fsS --max-time 10 http://127.0.0.1:3001/health"
)


class ConsoleError(RuntimeError):
    """An expected validation, SSH, or private API failure."""


def _api_error(raw: bytes) -> str:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return raw.decode("utf-8", errors="replace")[:240].strip()
    return str(payload.get("error") or payload.get("message") or "")[:240]


def _run_ssh(
    ssh_host: str,
    remote_command: str,
    *,
    input_bytes: bytes | None = None,
    runner=subprocess.run,
) -> subprocess.CompletedProcess:
    try:
        return runner(
            ["ssh", ssh_host, remote_command],
            input=input_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=35,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ConsoleError("ssh is not installed on this machine.") from exc
    except subprocess.TimeoutExpired as exc:
        raise ConsoleError("The private VPS request timed out.") from exc


def check_private_connection(ssh_host: str, *, runner=subprocess.run) -> None:
    result = _run_ssh(ssh_host, REMOTE_CHECK_COMMAND, runner=runner)
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ConsoleError(detail or "Could not reach the production container over SSH.")
    try:
        payload = json.loads(result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConsoleError("The production health check returned invalid data.") from exc
    if payload.get("status") != "ok":
        raise ConsoleError("The production chatbot is not healthy.")


def send_test_message(
    message: str,
    *,
    ssh_host: str = DEFAULT_SSH_HOST,
    runner=subprocess.run,
) -> dict:
    message = message.strip()
    if not message:
        raise ConsoleError("Write a test message first.")
    if len(message.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise ConsoleError("The message is longer than the app's 4 KB limit.")

    request_body = json.dumps(
        {"body": message, "clientMessageId": str(uuid.uuid4())},
        separators=(",", ":"),
    ).encode("utf-8")
    result = _run_ssh(
        ssh_host,
        REMOTE_SEND_COMMAND,
        input_bytes=request_body,
        runner=runner,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ConsoleError(detail or "The private VPS request failed.")

    try:
        raw, status_text = result.stdout.rsplit(b"\n", 1)
        status = int(status_text)
    except (ValueError, TypeError) as exc:
        raise ConsoleError("The private messaging route returned an invalid response.") from exc
    if status not in {HTTPStatus.OK, HTTPStatus.CREATED}:
        raise ConsoleError(
            f"The private messaging route returned {status}: "
            f"{_api_error(raw) or 'request rejected'}"
        )
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConsoleError("The private messaging route returned invalid JSON.") from exc
    if not payload.get("ok"):
        raise ConsoleError(_api_error(raw) or "The message was rejected.")
    return payload


def default_message() -> str:
    stamp = datetime.now().astimezone().strftime("%I:%M:%S %p")
    return f"Push notification test from {TEST_MESSENGER_NAME} at {stamp}"


def render_page(
    *,
    message: str | None = None,
    notice: str = "",
    failed: bool = False,
) -> bytes:
    message = default_message() if message is None else message
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
    textarea {{ width: 100%; min-height: 118px; resize: vertical; border: 1px solid #695b73;
      border-radius: 12px; color: #fff; background: #110e15; padding: 13px 14px;
      font: inherit; line-height: 1.45; }}
    textarea:focus {{ outline: 3px solid rgba(217,184,108,.25); border-color: #d9b86c; }}
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
    <h1>Ring the bell</h1>
    <p class="intro"><strong>{TEST_MESSENGER_NAME}</strong> is a private test character who appears only in Dustin's DM inbox. This sends a real production message and runs the normal push fan-out.</p>
    <div class="warning"><strong>For a system banner:</strong> put Foglight in the background or lock the target device before sending. A visible app intentionally handles the event in-app instead.</div>
    {status}
    <form method="post" action="/send" autocomplete="off">
      <label for="message">Message from {TEST_MESSENGER_NAME}</label>
      <textarea id="message" name="message" maxlength="4096" required>{html.escape(message)}</textarea>
      <button type="submit">Send real DM + push</button>
    </form>
    <footer>No app login, auth code, or token · bound to <code>127.0.0.1</code> only</footer>
  </main>
</body>
</html>"""
    return page.encode("utf-8")


class PushTestServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, ssh_host: str):
        super().__init__(address, handler)
        self.ssh_host = ssh_host
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
        if self.headers.get("Sec-Fetch-Site", "").lower() == "cross-site":
            return False
        origin = self.headers.get("Origin", "")
        if not origin or origin == "null":
            return True
        parsed = urlparse(origin)
        return (
            parsed.scheme == "http"
            and parsed.hostname in {LOOPBACK_HOST, "localhost"}
            and parsed.port == self.server.server_port
        )

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

    def _reply(
        self,
        status: int,
        body: bytes,
        content_type: str = "text/html; charset=utf-8",
    ) -> None:
        self._send_headers(status, content_type, len(body))
        self.wfile.write(body)

    def do_GET(self) -> None:
        if not self._allowed_host():
            self._reply(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
            return
        if self.path == "/health":
            self._reply(HTTPStatus.OK, b'{"ok":true}', "application/json; charset=utf-8")
            return
        if self.path not in {"/", ""}:
            self._reply(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
            return
        self._reply(HTTPStatus.OK, render_page())

    def do_POST(self) -> None:
        if self.path != "/send":
            self._reply(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
            return
        if not self._allowed_host() or not self._allowed_origin():
            self._reply(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
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
                max_num_fields=5,
            )
        except (UnicodeDecodeError, ValueError):
            self._reply(HTTPStatus.BAD_REQUEST, b"Invalid form", "text/plain; charset=utf-8")
            return
        message = fields.get("message", [""])[0]

        try:
            with self.server.send_lock:
                elapsed = time.monotonic() - self.server.last_send_at
                if elapsed < SEND_COOLDOWN_SECONDS:
                    raise ConsoleError("Wait a moment before sending another test.")
                self.server.last_send_at = time.monotonic()
            payload = send_test_message(message, ssh_host=self.server.ssh_host)
            message_id = payload.get("message", {}).get("id")
            notice = (
                f"{TEST_MESSENGER_NAME} sent message #{message_id}. "
                "It is in the DM-only thread and push fan-out was queued."
            )
            self._reply(HTTPStatus.OK, render_page(notice=notice))
        except ConsoleError as exc:
            self._reply(
                HTTPStatus.BAD_GATEWAY,
                render_page(message=message, notice=str(exc), failed=True),
            )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--ssh-host", default=DEFAULT_SSH_HOST)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the private SSH path without starting the web server",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not 1024 <= args.port <= 65535:
        raise SystemExit("--port must be between 1024 and 65535")
    if not args.ssh_host.strip() or any(char.isspace() for char in args.ssh_host):
        raise SystemExit("--ssh-host must be one SSH host or alias")
    if args.check:
        try:
            check_private_connection(args.ssh_host)
        except ConsoleError as exc:
            raise SystemExit(f"Connection error: {exc}") from exc
        print(
            f"Private path ready: {args.ssh_host} -> dnd_chatbot -> {TEST_MESSENGER_NAME}",
            flush=True,
        )
        return 0

    server = PushTestServer((LOOPBACK_HOST, args.port), PushTestHandler, args.ssh_host)
    print(f"Foglight push test console: http://{LOOPBACK_HOST}:{args.port}", flush=True)
    print(
        f"Messages come from {TEST_MESSENGER_NAME}; no app credential is used. "
        "Press Ctrl+C to stop.",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping push test console.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
