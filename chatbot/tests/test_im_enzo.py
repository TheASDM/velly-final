"""Enzo as a chat partner: a direct-only pseudo-member with one thread per
person, private to that person, absent from the party channel, and backed
by the stored thread rather than the browser's localStorage."""

import json
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
        conn.execute("DELETE FROM chat_enzo_leases")


def _lease_count(server_module):
    with server_module._app_db() as conn:
        return conn.execute(
            "SELECT COUNT(*) AS n FROM chat_enzo_leases"
        ).fetchone()["n"]


@pytest.fixture(autouse=True)
def clean_chat(server_module):
    _clear_chat(server_module)
    yield
    _clear_chat(server_module)
    server_module.limiter.reset()


def _enzo_url(key):
    return "/api/im/thread/" + urllib.parse.quote(key, safe="") + "/enzo"


def _events(response):
    """Parse an SSE body into [(event_name, payload), ...]."""
    out = []
    for block in response.get_data(as_text=True).split("\n\n"):
        name, data = None, []
        for line in block.split("\n"):
            if line.startswith("event: "):
                name = line[7:].strip()
            elif line.startswith("data: "):
                data.append(line[6:])
        if name:
            out.append((name, json.loads("\n".join(data)) if data else {}))
    return out


@pytest.fixture
def scripted_enzo(server_module, monkeypatch):
    """Replace the engine so no test touches an LLM."""
    seen = {}

    def chat_stream(message, history, rules=False, vibe=None, viewer=None):
        seen["message"] = message
        seen["history"] = history
        seen["rules"] = rules
        seen["vibe"] = vibe
        seen["viewer"] = viewer
        yield {"type": "token", "text": "The fog "}
        yield {"type": "token", "text": "remembers."}
        yield {"type": "meta", "citations": [{"title": "Vallombrosa"}],
               "rules": rules, "vibe": vibe}

    monkeypatch.setattr(im_routes.engine, "chat_stream", chat_stream)
    monkeypatch.setattr(im_routes, "_push_config_error", lambda: "no push in tests")
    return seen


def test_everyone_at_the_table_has_an_enzo_thread(app, server_module):
    for name, is_dm in (("Lotan", False), ("DM", True)):
        with app.test_client() as client:
            data = client.get(
                "/api/im/threads", headers=_headers(server_module, name, is_dm)
            ).get_json()
        keys = [thread["key"] for thread in data["threads"]]
        assert server_module._enzo_thread_key(name) in keys
        # He sits right after the DM row, before the rest of the table.
        labels = [t["label"] for t in data["threads"]]
        assert "Enzo" in labels


def test_enzo_is_not_in_the_party_channel(server_module):
    roster = server_module._im_roster()
    assert "Enzo" not in roster
    assert "Enzo" not in server_module._thread_members("party", roster)


def test_an_enzo_thread_has_exactly_one_human_member(server_module):
    roster = server_module._im_roster()
    assert server_module._thread_members("Enzo|Lotan", roster) == {"Lotan"}
    assert server_module._enzo_partner("Enzo|Lotan", roster) == "Lotan"
    # Not a thread: Enzo with a stranger, or Enzo with himself.
    assert server_module._thread_members("Enzo|Nobody", roster) is None
    assert server_module._thread_members("Enzo|Enzo", roster) is None


def test_the_dm_cannot_read_a_players_enzo_thread(app, server_module):
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        refused = client.get(
            "/api/im/thread/" + urllib.parse.quote("Enzo|Lotan", safe=""), headers=dm
        )
    assert refused.status_code == 403
    assert "Enzo" in refused.get_json()["error"]


def test_send_streams_and_stores_both_halves(app, server_module, scripted_enzo):
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        response = client.post(_enzo_url(key), json={"body": "What is in the fog?"},
                               headers=lotan)
        assert response.status_code == 200
        assert response.mimetype == "text/event-stream"
        events = _events(response)

        names = [name for name, _ in events]
        assert names == ["sent", "token", "token", "meta", "message", "done"]
        assert events[0][1]["message"]["sender"] == "Lotan"
        assert events[-2][1]["message"]["sender"] == "Enzo"
        assert events[-2][1]["message"]["body"] == "The fog remembers."
        assert events[3][1]["citations"] == [{"title": "Vallombrosa"}]

        # Both halves are in the thread, in order, on the next fetch.
        stored = client.get(
            "/api/im/thread/" + urllib.parse.quote(key, safe=""), headers=lotan
        ).get_json()["messages"]
    assert [(m["sender"], m["body"]) for m in stored] == [
        ("Lotan", "What is in the fog?"),
        ("Enzo", "The fog remembers."),
    ]


def test_replaying_an_enzo_client_id_reuses_the_complete_exchange(
        app, server_module, scripted_enzo):
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    payload = {
        "body": "Only ask this once.",
        "clientMessageId": "c6372f06-fcca-45bb-8711-8eac8817d976",
    }
    with app.test_client() as client:
        first = _events(client.post(_enzo_url(key), json=payload, headers=lotan))
        replay = _events(client.post(_enzo_url(key), json=payload, headers=lotan))

    assert [name for name, _ in first] == [
        "sent", "token", "token", "meta", "message", "done",
    ]
    assert [name for name, _ in replay] == ["sent", "message", "done"]
    assert replay[-1][1]["idempotent"] is True
    assert replay[0][1]["message"]["id"] == first[0][1]["message"]["id"]
    assert replay[1][1]["message"]["id"] == first[-2][1]["message"]["id"]
    with server_module._app_db() as conn:
        rows = conn.execute(
            "SELECT id, reply_to_id FROM chat_messages ORDER BY id"
        ).fetchall()
    assert len(rows) == 2
    assert rows[1]["reply_to_id"] == rows[0]["id"]


def test_his_memory_is_the_stored_thread(app, server_module, scripted_enzo):
    """The point of moving it server-side: the second question arrives with
    the first exchange attached, without the client replaying anything."""
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        # The body has to be read: stream_with_context means the engine call
        # happens as the client consumes the response, not before.
        _events(client.post(_enzo_url(key), json={"body": "First question."},
                            headers=lotan))
        assert scripted_enzo["history"] == []
        _events(client.post(_enzo_url(key), json={"body": "Second question."},
                            headers=lotan))

    assert scripted_enzo["message"] == "Second question."
    assert scripted_enzo["history"] == [
        {"role": "user", "content": "First question."},
        {"role": "assistant", "content": "The fog remembers."},
    ]


def test_rules_and_vibe_ride_along(app, server_module, scripted_enzo):
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        events = dict(_events(client.post(
            _enzo_url(key),
            json={"body": "Grappling rules?", "rules": True, "vibe": "yasqueen"},
            headers=lotan,
        )))
    assert scripted_enzo["rules"] is True
    assert scripted_enzo["vibe"] == "yasqueen"
    assert events["meta"]["rules"] is True
    assert events["meta"]["vibe"] == "yasqueen"


def test_a_second_send_is_refused_while_one_is_in_flight(app, server_module):
    """Every message in this thread is an LLM call; a double-tap should not
    buy two of them."""
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    lease_token = im_routes._enzo_claim("Lotan")
    assert lease_token
    with app.test_client() as client:
        refused = client.post(_enzo_url(key), json={"body": "again"}, headers=lotan)
    assert refused.status_code == 429
    assert refused.get_json()["error_code"] == "busy"

    im_routes._enzo_release("Lotan", lease_token)
    assert im_routes._enzo_claim("Lotan")


def test_a_dropped_stream_does_not_wedge_the_thread(server_module):
    with server_module._app_db() as conn:
        conn.execute("""
            INSERT INTO chat_enzo_leases (player_name, lease_token, expires_at)
            VALUES (?, ?, ?)
        """, ("Lotan", "dead", server_module._utc_now_iso_in(-1)))
    assert im_routes._enzo_claim("Lotan")


def test_enzo_lease_is_atomic_across_concurrent_workers(server_module):
    barrier = threading.Barrier(3)
    claims = []

    def claim():
        barrier.wait()
        claims.append(im_routes._enzo_claim("Lotan"))

    workers = [threading.Thread(target=claim) for _ in range(2)]
    for worker in workers:
        worker.start()
    barrier.wait()
    for worker in workers:
        worker.join(2)

    assert sum(bool(token) for token in claims) == 1


def test_the_endpoint_refuses_threads_enzo_is_not_in(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        assert client.post(_enzo_url("party"), json={"body": "hi"},
                           headers=lotan).status_code == 404
        assert client.post(_enzo_url("DM|Lotan"), json={"body": "hi"},
                           headers=lotan).status_code == 404


def test_body_limits_apply_before_any_llm_call(app, server_module):
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        assert client.post(_enzo_url(key), json={"body": "  "},
                           headers=lotan).status_code == 400
        assert client.post(_enzo_url(key), json={"body": "x" * 5000},
                           headers=lotan).status_code == 400
    with server_module._app_db() as conn:
        rows = conn.execute("SELECT COUNT(*) AS n FROM chat_messages").fetchone()
    assert rows["n"] == 0
    assert _lease_count(server_module) == 0


def test_an_empty_reply_stores_nothing(app, server_module, monkeypatch):
    monkeypatch.setattr(im_routes.engine, "chat_stream",
                        lambda *a, **kw: iter([{"type": "error", "text": "upstream down"}]))
    monkeypatch.setattr(im_routes, "_push_config_error", lambda: "no push in tests")
    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        events = dict(_events(client.post(_enzo_url(key), json={"body": "hello?"},
                                          headers=lotan)))
    assert events["error"]["message"] == "upstream down"
    with server_module._app_db() as conn:
        senders = [r["sender"] for r in conn.execute(
            "SELECT sender FROM chat_messages ORDER BY id")]
    # The question is kept — it is the player's — but no empty Enzo bubble.
    assert senders == ["Lotan"]
    assert _lease_count(server_module) == 0


def test_enzo_is_told_who_is_asking(app, server_module, scripted_enzo):
    """Enzo inherits the caller's role from their credential. Nothing about
    who is asking comes from the request body, where a client could write it."""
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        # The stream is a generator; nothing runs until it is consumed.
        _events(client.post(_enzo_url(key), headers=_headers(server_module, "Lotan"),
                            json={"body": "What do I know about the fog?"}))
    assert scripted_enzo["viewer"]["name"] == "Lotan"
    assert scripted_enzo["viewer"]["is_dm"] is False

    dm_key = server_module._enzo_thread_key("DM")
    with app.test_client() as client:
        _events(client.post(_enzo_url(dm_key), headers=_headers(server_module, "DM", True),
                            json={"body": "Remind me what they have not found yet."}))
    assert scripted_enzo["viewer"]["name"] == "DM"
    assert scripted_enzo["viewer"]["is_dm"] is True
