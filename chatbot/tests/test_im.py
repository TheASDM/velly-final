"""Instant messages: membership, unread math, soft delete, size limits.

The conftest player fixture is Lotan; more players are minted here. The DM
must be refused — with a stated reason — on player-pair threads.
"""

import urllib.parse

import pytest


def _headers(server_module, name, is_dm=False):
    token = server_module._issue_player_token(name, is_dm=is_dm)
    return {"Authorization": f"Bearer {token}"}


def _clear_chat(server_module):
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM chat_messages")
        conn.execute("DELETE FROM chat_reads")


@pytest.fixture(autouse=True)
def clean_chat(server_module):
    _clear_chat(server_module)
    yield
    _clear_chat(server_module)
    server_module.limiter.reset()


def _thread_url(key):
    return "/api/im/thread/" + urllib.parse.quote(key, safe="")


def _send(app, headers, key, body):
    with app.test_client() as client:
        return client.post(_thread_url(key), json={"body": body}, headers=headers)


def test_send_and_fetch_direct_thread(app, server_module):
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    key = "DM|Lotan"

    created = _send(app, lotan, key, "We need to talk about the fog.")
    assert created.status_code == 201
    message = created.get_json()["message"]
    assert message["sender"] == "Lotan"
    assert message["body"] == "We need to talk about the fog."
    assert message["threadKey"] == key

    with app.test_client() as client:
        fetched = client.get(_thread_url(key), headers=dm)
    assert fetched.status_code == 200
    messages = fetched.get_json()["messages"]
    assert [m["body"] for m in messages] == ["We need to talk about the fog."]

    # Incremental fetch: nothing after the newest id.
    with app.test_client() as client:
        after = client.get(
            _thread_url(key) + f"?after={message['id']}", headers=dm
        )
    assert after.get_json()["messages"] == []


def test_membership_is_enforced(app, server_module):
    lotan = _headers(server_module, "Lotan")
    noname = _headers(server_module, "Noname")
    valentro = _headers(server_module, "Valentro")

    key = "Lotan|Noname"
    assert _send(app, lotan, key, "psst").status_code == 201
    # A third player is not a member of someone else's direct thread.
    with app.test_client() as client:
        response = client.get(_thread_url(key), headers=valentro)
    assert response.status_code == 403
    # Sending is refused too.
    assert _send(app, valentro, key, "let me in").status_code == 403
    # Members read fine.
    with app.test_client() as client:
        assert client.get(_thread_url(key), headers=noname).status_code == 200


def test_dm_is_refused_on_player_pair_threads_with_reason(app, server_module):
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        response = client.get(_thread_url("Lotan|Noname"), headers=dm)
    assert response.status_code == 403
    assert "between players" in response.get_json()["error"]


def test_bad_thread_keys_are_not_found(app, server_module):
    lotan = _headers(server_module, "Lotan")
    for key in ("Lotan|Nobody Real", "Noname|Lotan", "Lotan|Lotan", "x"):
        with app.test_client() as client:
            response = client.get(_thread_url(key), headers=lotan)
        assert response.status_code == 404, key


def test_unread_math_and_read_pointer(app, server_module):
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    key = "DM|Lotan"
    _send(app, dm, key, "one")
    _send(app, dm, key, "two")

    def unread_for(headers, thread_key):
        with app.test_client() as client:
            data = client.get("/api/im/threads", headers=headers).get_json()
        return next(t["unread"] for t in data["threads"] if t["key"] == thread_key)

    # Two unread for Lotan; the DM's own messages never count against the DM.
    assert unread_for(lotan, key) == 2
    assert unread_for(dm, key) == 0

    with app.test_client() as client:
        fetched = client.get(_thread_url(key), headers=lotan).get_json()
        last_id = fetched["messages"][-1]["id"]
        marked = client.post(
            "/api/im/read",
            json={"threadKey": key, "lastReadId": last_id},
            headers=lotan,
        )
    assert marked.status_code == 200
    assert unread_for(lotan, key) == 0

    # Threads list carries the preview of the newest message.
    with app.test_client() as client:
        data = client.get("/api/im/threads", headers=lotan).get_json()
    thread = next(t for t in data["threads"] if t["key"] == key)
    assert thread["last"]["body"] == "two"
    # The DM thread is pinned first for players.
    assert data["threads"][0]["key"] == key
    assert data["threads"][-1]["key"] == "party"


def test_party_thread_includes_everyone(app, server_module):
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    assert _send(app, lotan, "party", "who took the coin?").status_code == 201
    with app.test_client() as client:
        fetched = client.get(_thread_url("party"), headers=dm)
    assert fetched.status_code == 200
    assert fetched.get_json()["messages"][0]["sender"] == "Lotan"


def test_soft_delete_own_messages_only(app, server_module):
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    key = "DM|Lotan"
    message = _send(app, lotan, key, "delete me").get_json()["message"]

    with app.test_client() as client:
        refused = client.delete(f"/api/im/message/{message['id']}", headers=dm)
    assert refused.status_code == 403

    with app.test_client() as client:
        deleted = client.delete(f"/api/im/message/{message['id']}", headers=lotan)
    assert deleted.status_code == 200

    with app.test_client() as client:
        fetched = client.get(_thread_url(key), headers=dm).get_json()
    assert fetched["messages"][0]["deleted"] is True
    assert fetched["messages"][0]["body"] == ""


def test_body_limits(app, server_module):
    lotan = _headers(server_module, "Lotan")
    assert _send(app, lotan, "party", "").status_code == 400
    assert _send(app, lotan, "party", "x" * 5000).status_code == 400


def test_mute_flag_round_trips(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        muted = client.post(
            "/api/im/mute", json={"threadKey": "party", "muted": True}, headers=lotan
        )
        assert muted.get_json()["muted"] is True
        data = client.get("/api/im/threads", headers=lotan).get_json()
    assert next(t for t in data["threads"] if t["key"] == "party")["muted"] is True


def test_anonymous_gets_nothing(app):
    with app.test_client() as client:
        assert client.get("/api/im/threads").status_code == 401
        assert client.get(_thread_url("party")).status_code == 401
        assert client.post(_thread_url("party"), json={"body": "hi"}).status_code == 401
