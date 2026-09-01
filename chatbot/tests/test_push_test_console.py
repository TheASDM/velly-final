import json
import subprocess
import uuid

import pytest

from scripts import push_test_console as console


def test_send_uses_private_ssh_path_without_an_app_credential():
    seen = {}

    def runner(command, **kwargs):
        seen["command"] = command
        seen["kwargs"] = kwargs
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=b'{"ok":true,"message":{"id":42}}\n201',
            stderr=b"",
        )

    result = console.send_test_message("  ring my phone  ", runner=runner)

    command = seen["command"]
    assert command[:2] == ["ssh", "vapp"]
    assert "docker exec -i dnd_chatbot" in command[2]
    assert "127.0.0.1:3001/api/internal/im-test-message" in command[2]
    assert "Authorization" not in command[2]
    assert "token" not in command[2].lower()
    request_body = json.loads(seen["kwargs"]["input"])
    assert request_body["body"] == "ring my phone"
    assert str(uuid.UUID(request_body["clientMessageId"])) == request_body["clientMessageId"]
    assert result["message"]["id"] == 42


def test_send_surfaces_private_route_errors():
    def runner(command, **_kwargs):
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=b'{"error":"Not ready"}\n503',
            stderr=b"",
        )

    with pytest.raises(console.ConsoleError, match="503: Not ready"):
        console.send_test_message("test", runner=runner)


def test_check_private_connection_requires_healthy_json():
    def healthy(command, **_kwargs):
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=b'{"service":"loremaster","status":"ok"}',
            stderr=b"",
        )

    console.check_private_connection("vapp", runner=healthy)


def test_send_rejects_empty_message_before_ssh():
    with pytest.raises(console.ConsoleError, match="Write a test message"):
        console.send_test_message("  ", runner=lambda *_args, **_kwargs: None)
