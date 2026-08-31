import base64
import hashlib
import hmac
import json
import uuid

import pytest

from scripts import push_test_console as console


def _decode_payload(token):
    payload_b64, signature_b64 = token.split(".", 1)
    padding = "=" * ((4 - len(payload_b64) % 4) % 4)
    return payload_b64, signature_b64, json.loads(
        base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
    )


def test_read_dotenv_does_not_execute_values(tmp_path):
    marker = tmp_path / "should-not-exist"
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# comment\nexport PUBLIC_BASE_URL='https://example.test'\n"
        f"AUTH_TOKEN_SECRET=$(touch {marker})\n",
        encoding="utf-8",
    )

    values = console.read_dotenv(env_file)

    assert values["PUBLIC_BASE_URL"] == "https://example.test"
    assert values["AUTH_TOKEN_SECRET"] == f"$(touch {marker})"
    assert not marker.exists()


def test_issue_player_token_matches_server_signature_contract():
    token = console.issue_player_token("Lotan", "test-secret", now=1_000)
    payload_b64, signature_b64, payload = _decode_payload(token)
    expected = base64.urlsafe_b64encode(
        hmac.new(b"test-secret", payload_b64.encode("ascii"), hashlib.sha256).digest()
    ).decode("ascii").rstrip("=")

    assert signature_b64 == expected
    assert payload == {
        "name": "Lotan",
        "is_dm": False,
        "provider": "push-test-console",
        "principal": "loopback",
        "iat": 1_000,
        "exp": 1_000 + console.TOKEN_TTL_SECONDS,
    }


def test_send_dm_calls_the_real_direct_message_contract():
    seen = {}

    class Response:
        status = 201

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"ok":true,"message":{"id":42}}'

    def opener(request, timeout):
        seen["request"] = request
        seen["timeout"] = timeout
        return Response()

    config = console.ConsoleConfig(
        "https://example.test", "test-secret", ("Lotan", "Noname")
    )
    result = console.send_dm(config, "Lotan", "  ring my phone  ", opener=opener)

    request = seen["request"]
    assert request.full_url == "https://example.test/api/im/thread/DM%7CLotan"
    assert request.get_method() == "POST"
    assert request.headers["Authorization"].startswith("Bearer ")
    request_body = json.loads(request.data)
    assert request_body["body"] == "ring my phone"
    assert str(uuid.UUID(request_body["clientMessageId"])) == request_body["clientMessageId"]
    assert result["message"]["id"] == 42
    assert seen["timeout"] == 15


def test_send_dm_rejects_unknown_player_before_network_call():
    config = console.ConsoleConfig("https://example.test", "secret", ("Lotan",))

    with pytest.raises(console.ConsoleError, match="Choose a player"):
        console.send_dm(config, "DM", "test", opener=lambda *_args, **_kwargs: None)
