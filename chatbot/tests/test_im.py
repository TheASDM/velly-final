"""Instant messages: membership, unread math, soft delete, size limits.

The conftest player fixture is Lotan; more players are minted here. The DM
must be refused — with a stated reason — on player-pair threads.
"""

import threading
import urllib.parse

import pytest

from vos.routes import im as im_routes


def _headers(server_module, name, is_dm=False):
    token = server_module._issue_player_token(name, is_dm=is_dm)
    return {"Authorization": f"Bearer {token}"}


def _clear_chat(server_module):
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM chat_messages")
        conn.execute("DELETE FROM chat_reads")
        conn.execute("DELETE FROM player_presence")


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


def test_vesper_thread_exists_only_for_the_dm(app, server_module):
    dm = _headers(server_module, "DM", is_dm=True)
    lotan = _headers(server_module, "Lotan")

    with app.test_client() as client:
        dm_threads = client.get("/api/im/threads", headers=dm).get_json()["threads"]
        player_threads = client.get("/api/im/threads", headers=lotan).get_json()["threads"]
        dm_thread = client.get(_thread_url("DM|Vesper"), headers=dm)
        player_guess = client.get(_thread_url("DM|Vesper"), headers=lotan)

    assert next(thread for thread in dm_threads if thread["key"] == "DM|Vesper") == {
        "key": "DM|Vesper",
        "kind": "tester",
        "label": "Vesper",
        "unread": 0,
        "muted": False,
        "last": None,
    }
    assert "DM|Vesper" not in {thread["key"] for thread in player_threads}
    assert dm_thread.status_code == 200
    assert player_guess.status_code == 403


def test_loopback_can_inject_vesper_message_without_auth(
    app, server_module, monkeypatch
):
    notified = []
    monkeypatch.setattr(
        im_routes,
        "_notify_thread",
        lambda thread, sender, text: notified.append((thread, sender, text)),
    )
    payload = {
        "body": "The bell is ringing.",
        "clientMessageId": "26c3b5a4-5fb3-44b2-97b4-d94e4d28ca9d",
    }

    with app.test_client() as client:
        blocked = client.post(
            "/api/internal/im-test-message",
            json=payload,
            environ_overrides={"REMOTE_ADDR": "172.20.0.3"},
            headers={"X-Forwarded-For": "203.0.113.5"},
        )
        created = client.post(
            "/api/internal/im-test-message",
            json=payload,
            environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
        )
        replay = client.post(
            "/api/internal/im-test-message",
            json=payload,
            environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
        )

    assert blocked.status_code == 404
    assert created.status_code == 201
    assert created.get_json()["message"]["sender"] == "Vesper"
    assert created.get_json()["message"]["threadKey"] == "DM|Vesper"
    assert replay.status_code == 200
    assert replay.get_json()["idempotent"] is True
    assert notified == [("DM|Vesper", "Vesper", "The bell is ringing.")]


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


def test_read_pointer_is_clamped_to_an_existing_message_in_that_thread(app,
                                                                        server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    party = _send(app, roxy, "party", "At the table.").get_json()["message"]
    elsewhere = _send(app, roxy, 'Lotan|Roxanya "Roxy"', "Private.").get_json()["message"]
    assert elsewhere["id"] > party["id"]

    with app.test_client() as client:
        marked = client.post(
            "/api/im/read",
            json={"threadKey": "party", "lastReadId": elsewhere["id"] + 10000},
            headers=lotan,
        )
    assert marked.status_code == 200
    assert marked.get_json()["lastReadId"] == party["id"]

    _send(app, roxy, "party", "This must still be unread.")
    with app.test_client() as client:
        listing = client.get("/api/im/threads", headers=lotan).get_json()
    assert next(t for t in listing["threads"] if t["key"] == "party")["unread"] == 1


def test_replaying_a_client_message_id_returns_the_original_message(app,
                                                                    server_module):
    lotan = _headers(server_module, "Lotan")
    payload = {
        "body": "Only once.",
        "clientMessageId": "0b8e8ea1-45df-42e4-8b7a-29028e0ac3e8",
    }
    with app.test_client() as client:
        first = client.post(_thread_url("party"), json=payload, headers=lotan)
        replay = client.post(_thread_url("party"), json=payload, headers=lotan)
        fetched = client.get(_thread_url("party"), headers=lotan).get_json()["messages"]

    assert first.status_code == 201
    assert replay.status_code == 200
    assert replay.get_json()["idempotent"] is True
    assert replay.get_json()["message"]["id"] == first.get_json()["message"]["id"]
    assert [message["body"] for message in fetched] == ["Only once."]


def test_thread_history_pages_backward_without_gaps(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with server_module._app_db() as conn:
        created = [
            server_module._store_chat_message(conn, "party", "DM", f"Message {n}")
            for n in range(205)
        ]

    with app.test_client() as client:
        latest = client.get(_thread_url("party"), headers=lotan).get_json()
        older = client.get(
            _thread_url("party") + f"?before={latest['oldestId']}", headers=lotan
        ).get_json()

    assert len(latest["messages"]) == 200
    assert latest["hasOlder"] is True
    assert [message["id"] for message in latest["messages"]] == [
        row["id"] for row in created[5:]
    ]
    assert [message["id"] for message in older["messages"]] == [
        row["id"] for row in created[:5]
    ]
    assert older["hasOlder"] is False


def test_large_incremental_catchup_starts_at_the_first_unseen_message(app,
                                                                      server_module):
    lotan = _headers(server_module, "Lotan")
    with server_module._app_db() as conn:
        anchor = server_module._store_chat_message(conn, "party", "DM", "Anchor")
        created = [
            server_module._store_chat_message(conn, "party", "DM", f"New {n}")
            for n in range(205)
        ]

    with app.test_client() as client:
        first = client.get(
            _thread_url("party") + f"?after={anchor['id']}", headers=lotan
        ).get_json()
        rest = client.get(
            _thread_url("party") + f"?after={first['messages'][-1]['id']}",
            headers=lotan,
        ).get_json()

    assert [message["id"] for message in first["messages"]] == [
        row["id"] for row in created[:200]
    ]
    assert first["hasNewer"] is True
    assert [message["id"] for message in rest["messages"]] == [
        row["id"] for row in created[200:]
    ]
    assert rest["hasNewer"] is False


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



def test_unread_total_counts_only_other_peoples_live_messages(app, server_module):
    """The number the app-icon badge and the app-bar bubble both show."""
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    direct = 'Lotan|Roxanya "Roxy"'
    roster = server_module._im_roster()

    with server_module._app_db() as conn:
        assert server_module._unread_total(conn, "Lotan", roster) == 0

    _send(app, roxy, "party", "Anyone awake?")
    _send(app, roxy, direct, "Just us, then.")

    with server_module._app_db() as conn:
        assert server_module._unread_total(conn, "Lotan", roster) == 2
        # Roxy wrote both, so neither is unread for her.
        assert server_module._unread_total(conn, 'Roxanya "Roxy"', roster) == 0

    # Sending into a thread reads it: your own message never counts against
    # you, and it carries the pointer past everything before it.
    _send(app, lotan, "party", "Awake, and cold.")
    with server_module._app_db() as conn:
        assert server_module._unread_total(conn, "Lotan", roster) == 1
        assert server_module._unread_total(conn, 'Roxanya "Roxy"', roster) == 1

    # A soft-deleted message stops counting.
    with server_module._app_db() as conn:
        conn.execute(
            "UPDATE chat_messages SET deleted_at = ? WHERE thread_key = ?",
            (server_module._utc_now_iso(), direct),
        )
        assert server_module._unread_total(conn, "Lotan", roster) == 0


def test_thread_push_carries_thread_key_tag_and_per_reader_unread(app, server_module, monkeypatch):
    """The service worker needs the thread key to collapse a conversation
    into one banner, badge the icon, and open the overlay in place."""
    from vos.routes import im as im_routes

    calls = {}
    delivered = threading.Event()

    def fake_fanout(title, message, url, **kwargs):
        calls.update({"title": title, "message": message, "url": url, **kwargs})
        delivered.set()
        return {"ok": True}

    monkeypatch.setattr(im_routes, "_push_config_error", lambda: None)
    monkeypatch.setattr(im_routes, "_fanout_push", fake_fanout)

    roxy = _headers(server_module, 'Roxanya "Roxy"')
    _send(app, roxy, "party", "The fog is moving.")
    assert delivered.wait(1)

    assert calls["payload_extra"] == {"threadKey": "party", "tag": "im:party"}
    assert calls["url"] == "/messages/#party"
    assert "Roxanya" in calls["title"]
    # Every other member gets their own count; the sender is not a recipient.
    assert 'Roxanya "Roxy"' not in calls["recipients"]
    assert set(calls["per_recipient"]) == set(calls["recipients"])
    assert all(entry["unread"] == 1 for entry in calls["per_recipient"].values())


def test_muted_members_are_left_out_of_the_chat_push(app, server_module, monkeypatch):
    from vos.routes import im as im_routes

    calls = {}
    delivered = threading.Event()
    monkeypatch.setattr(im_routes, "_push_config_error", lambda: None)

    def fake_fanout(*args, **kwargs):
        calls.update(kwargs)
        delivered.set()
        return {"ok": True}

    monkeypatch.setattr(im_routes, "_fanout_push", fake_fanout)

    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        client.post("/api/im/mute", json={"threadKey": "party", "muted": True}, headers=lotan)
    _send(app, roxy, "party", "Still moving.")
    assert delivered.wait(1)

    assert "Lotan" not in calls["recipients"]
    assert "Lotan" not in calls["per_recipient"]


def test_push_payload_merges_per_recipient_extras(monkeypatch):
    """_push_one folds the per-reader dict over the shared payload."""
    import json

    from vos.routes import push as push_routes

    seen = []
    monkeypatch.setattr(
        push_routes, "send_webpush",
        lambda subscription_info=None, data=None, **kwargs: seen.append(data),
    )
    row = {"player_name": "Lotan", "endpoint": "https://push.example/1",
           "p256dh": "k", "auth": "a"}
    status, _code, _error = push_routes._push_one(
        row,
        {"title": "T", "body": "B", "url": "/", "messageId": None, "tag": "im:party"},
        {"Lotan": {"unread": 4}},
    )
    assert status == "sent"
    payload = json.loads(seen[0])
    assert payload["unread"] == 4
    assert payload["tag"] == "im:party"
    assert payload["playerName"] == "Lotan"


def test_recent_presence_does_not_suppress_push_to_another_device(app, server_module):
    """Presence belongs to a player, not a device. Every subscribed device
    receives the push and its own service worker decides whether to show it."""
    from vos.routes import im as im_routes

    calls = {}
    delivered = threading.Event()

    def fake_fanout(title, message, url, **kwargs):
        calls.update(kwargs)
        delivered.set()
        return {"ok": True}

    original_config, original_fanout = (im_routes._push_config_error,
                                        im_routes._fanout_push)
    im_routes._push_config_error = lambda: None
    im_routes._fanout_push = fake_fanout
    try:
        roxy = _headers(server_module, 'Roxanya "Roxy"')
        with server_module._app_db() as conn:
            # Lotan's client checked in a moment ago; Valentro's was an hour.
            server_module._touch_presence(conn, "Lotan")
            conn.execute("""
                INSERT INTO player_presence (player_name, last_seen_at) VALUES (?, ?)
                ON CONFLICT(player_name) DO UPDATE SET last_seen_at = excluded.last_seen_at
            """, ("Valentro", server_module._utc_now_iso_in(-3600)))
        _send(app, roxy, "party", "Anyone there?")
        assert delivered.wait(1)
    finally:
        im_routes._push_config_error = original_config
        im_routes._fanout_push = original_fanout

    assert "Lotan" in calls["recipients"]
    assert "Valentro" in calls["recipients"]
    assert "Lotan" in calls["per_recipient"]


def test_slow_push_delivery_never_blocks_message_acknowledgement(
        app, server_module, monkeypatch):
    from vos.routes import im as im_routes

    started = threading.Event()
    release = threading.Event()
    result = {}

    def slow_fanout(*args, **kwargs):
        started.set()
        release.wait(2)
        return {"ok": True}

    monkeypatch.setattr(im_routes, "_push_config_error", lambda: None)
    monkeypatch.setattr(im_routes, "_fanout_push", slow_fanout)
    roxy = _headers(server_module, 'Roxanya "Roxy"')

    sender = threading.Thread(
        target=lambda: result.setdefault("response", _send(
            app, roxy, "party", "Do not wait for push.",
        )),
    )
    try:
        sender.start()
        assert started.wait(1)
        sender.join(0.25)
        assert not sender.is_alive()
        assert result["response"].status_code == 201
    finally:
        release.set()
        sender.join(2)


def test_presence_window_is_wider_than_the_poll_interval(server_module):
    """A slow round trip must not read as absence — the open-thread poll is
    4s and the badge heartbeat 25s."""
    from vos.routes import im as im_routes

    assert im_routes.PRESENT_WITHIN_SECONDS > 25


def test_present_since_reads_the_presence_table(app, server_module):
    from vos.routes import im as im_routes

    with server_module._app_db() as conn:
        server_module._touch_presence(conn, "Lotan")
        recent = im_routes._present_since(conn, server_module._utc_now_iso_in(-60))
        ancient = im_routes._present_since(conn, server_module._utc_now_iso_in(60))
    assert "Lotan" in recent
    assert "Lotan" not in ancient
