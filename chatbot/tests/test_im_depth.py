"""Replies, reactions, read receipts, typing, presence — and the one-hour
edit window. All of it stays inside a thread's membership: none of these
tell you anything about a conversation you are not in."""

import urllib.parse

import pytest

from vos.routes import im as im_routes


def _headers(server_module, name, is_dm=False):
    return {"Authorization": f"Bearer {server_module._issue_player_token(name, is_dm=is_dm)}"}


def _clear(server_module):
    with server_module._app_db() as conn:
        for table in ("chat_messages", "chat_reads", "chat_reactions",
                      "chat_typing", "player_presence"):
            conn.execute(f"DELETE FROM {table}")


@pytest.fixture(autouse=True)
def clean(server_module):
    _clear(server_module)
    yield
    _clear(server_module)
    server_module.limiter.reset()


def _url(key):
    return "/api/im/thread/" + urllib.parse.quote(key, safe="")


def _send(client, headers, key, body, **extra):
    return client.post(_url(key), json={"body": body, **extra}, headers=headers)


THUMB = im_routes.REACTION_EMOJI[0]
HEART = im_routes.REACTION_EMOJI[1]


# ── Replies ───────────────────────────────────────────────────────────

def test_a_reply_points_at_the_message_it_answers(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        first = _send(client, roxy, "party", "Who has the ledger?").get_json()["message"]
        answer = _send(client, lotan, "party", "I do.",
                       replyToId=first["id"]).get_json()["message"]
        assert answer["replyToId"] == first["id"]
        fetched = client.get(_url("party"), headers=lotan).get_json()["messages"]
    assert fetched[-1]["replyToId"] == first["id"]
    assert fetched[0]["replyToId"] is None


def test_a_reply_cannot_reach_outside_its_thread(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        elsewhere = _send(client, lotan, "DM|Lotan", "A private word.").get_json()["message"]
        refused = _send(client, lotan, "party", "Quoting that.",
                        replyToId=elsewhere["id"])
    assert refused.status_code == 400
    assert refused.get_json()["error_code"] == "invalid"


def test_a_reply_to_nothing_is_refused(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        assert _send(client, lotan, "party", "hi", replyToId=9999).status_code == 400
        assert _send(client, lotan, "party", "hi", replyToId="soon").status_code == 400


# ── Reactions ─────────────────────────────────────────────────────────

def test_reactions_group_by_face_and_know_which_are_yours(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        message = _send(client, roxy, "party", "We made it out.").get_json()["message"]
        client.post(f"/api/im/message/{message['id']}/reaction",
                    json={"emoji": THUMB}, headers=lotan)
        client.post(f"/api/im/message/{message['id']}/reaction",
                    json={"emoji": THUMB}, headers=roxy)
        added = client.post(f"/api/im/message/{message['id']}/reaction",
                            json={"emoji": HEART}, headers=lotan).get_json()
        assert {face["emoji"]: len(face["players"]) for face in added["reactions"]} == {
            THUMB: 2, HEART: 1,
        }
        assert all(face["mine"] for face in added["reactions"])

        thread = client.get(_url("party"), headers=roxy).get_json()
        faces = thread["reactions"][str(message["id"])]
    assert {face["emoji"]: face["mine"] for face in faces} == {THUMB: True, HEART: False}


def test_reacting_twice_with_the_same_face_is_one_reaction(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        message = _send(client, lotan, "party", "Again.").get_json()["message"]
        for _ in range(3):
            client.post(f"/api/im/message/{message['id']}/reaction",
                        json={"emoji": THUMB}, headers=lotan)
        removed = client.delete(f"/api/im/message/{message['id']}/reaction",
                                json={"emoji": THUMB}, headers=lotan).get_json()
    assert removed["reactions"] == []


def test_only_the_six_faces_are_accepted(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        message = _send(client, lotan, "party", "Careful.").get_json()["message"]
        refused = client.post(f"/api/im/message/{message['id']}/reaction",
                              json={"emoji": "<script>"}, headers=lotan)
    assert refused.status_code == 400


def test_you_cannot_react_into_a_thread_you_are_not_in(app, server_module):
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        private = _send(client, lotan, 'Lotan|Roxanya "Roxy"', "Between us.")
        message = private.get_json()["message"]
        # Not "forbidden" — whether that message exists is not the DM's to
        # learn from the response.
        refused = client.post(f"/api/im/message/{message['id']}/reaction",
                              json={"emoji": THUMB}, headers=dm)
    assert refused.status_code == 404


# ── Editing, for an hour ──────────────────────────────────────────────

def test_you_can_edit_your_own_message_and_it_says_so(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        message = _send(client, lotan, "party", "Meet at the mil").get_json()["message"]
        assert message["editedAt"] is None
        edited = client.patch(f"/api/im/message/{message['id']}",
                              json={"body": "Meet at the mill"}, headers=lotan)
        assert edited.status_code == 200
        updated = edited.get_json()["message"]
        assert updated["body"] == "Meet at the mill"
        assert updated["editedAt"]

        fetched = client.get(_url("party"), headers=lotan).get_json()["messages"]
    assert fetched[0]["body"] == "Meet at the mill"
    assert fetched[0]["editedAt"]


def test_an_edit_expires_after_an_hour(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        message = _send(client, lotan, "party", "Long ago.").get_json()["message"]
        with server_module._app_db() as conn:
            conn.execute(
                "UPDATE chat_messages SET created_at = ? WHERE id = ?",
                (server_module._utc_now_iso_in(-(im_routes.MESSAGE_EDIT_WINDOW_SECONDS + 60)),
                 message["id"]),
            )
        refused = client.patch(f"/api/im/message/{message['id']}",
                               json={"body": "Actually…"}, headers=lotan)
    assert refused.status_code == 409
    assert refused.get_json()["error_code"] == "too_late"


def test_only_the_sender_can_edit(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        message = _send(client, roxy, "party", "Mine.").get_json()["message"]
        refused = client.patch(f"/api/im/message/{message['id']}",
                               json={"body": "Not yours"}, headers=lotan)
    assert refused.status_code == 403


def test_a_deleted_message_cannot_be_edited_back(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        message = _send(client, lotan, "party", "Oops.").get_json()["message"]
        client.delete(f"/api/im/message/{message['id']}", headers=lotan)
        refused = client.patch(f"/api/im/message/{message['id']}",
                               json={"body": "Never mind"}, headers=lotan)
    assert refused.status_code == 404


def test_edits_and_deletes_reach_a_client_that_already_has_the_message(app, server_module):
    """`after=<id>` only ever finds new ids; `since` is what carries a
    rewrite back to everyone still looking at the old words."""
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        message = _send(client, lotan, "party", "First draft").get_json()["message"]
        poll = client.get(_url("party"), headers=roxy).get_json()
        assert [m["id"] for m in poll["messages"]] == [message["id"]]
        assert poll["revised"] == []

        client.patch(f"/api/im/message/{message['id']}",
                     json={"body": "Second draft"}, headers=lotan)
        again = client.get(
            f"{_url('party')}?after={message['id']}&since={urllib.parse.quote(poll['now'])}",
            headers=roxy,
        ).get_json()
    assert again["messages"] == []
    assert [(m["id"], m["body"]) for m in again["revised"]] == [
        (message["id"], "Second draft"),
    ]


# ── Receipts, typing, presence ────────────────────────────────────────

def test_receipts_expose_only_the_other_members_pointers(app, server_module):
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        message = _send(client, lotan, "DM|Lotan", "Read this.").get_json()["message"]
        before = client.get(_url("DM|Lotan"), headers=lotan).get_json()
        assert before["receipts"].get("DM") in (None, 0)

        client.post("/api/im/read",
                    json={"threadKey": "DM|Lotan", "lastReadId": message["id"]}, headers=dm)
        after = client.get(_url("DM|Lotan"), headers=lotan).get_json()
    assert after["receipts"]["DM"] == message["id"]
    # Your own pointer is not a receipt you need shown back to you.
    assert "Lotan" not in after["receipts"]


def test_typing_is_a_heartbeat_that_expires(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        assert client.post("/api/im/typing", json={"threadKey": "party"},
                           headers=roxy).status_code == 200
        seen = client.get(_url("party"), headers=lotan).get_json()
        assert seen["typing"] == ['Roxanya "Roxy"']
        # You are never shown as typing to yourself.
        assert client.get(_url("party"), headers=roxy).get_json()["typing"] == []

        with server_module._app_db() as conn:
            conn.execute("UPDATE chat_typing SET expires_at = ?",
                         (server_module._utc_now_iso_in(-30),))
        assert client.get(_url("party"), headers=lotan).get_json()["typing"] == []


def test_sending_stops_you_typing(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        client.post("/api/im/typing", json={"threadKey": "party"}, headers=roxy)
        _send(client, roxy, "party", "There.")
        assert client.get(_url("party"), headers=lotan).get_json()["typing"] == []


def test_typing_is_refused_on_a_thread_you_are_not_in(app, server_module):
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        refused = client.post("/api/im/typing",
                              json={"threadKey": 'Lotan|Roxanya "Roxy"'}, headers=dm)
    assert refused.status_code == 403


def test_presence_is_touched_by_the_polls_already_being_made(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        client.get("/api/im/threads", headers=roxy)
        listing = client.get("/api/im/threads", headers=lotan).get_json()
        assert listing["presence"]['Roxanya "Roxy"']
        thread = client.get(_url("party"), headers=lotan).get_json()
    assert thread["presence"]["Lotan"]
    # Enzo is not a person and has no last-seen.
    with server_module._app_db() as conn:
        enzo = client.get(_url(server_module._enzo_thread_key("Lotan")), headers=lotan)
        assert "Enzo" not in enzo.get_json()["presence"]
        assert conn.execute(
            "SELECT COUNT(*) AS n FROM player_presence WHERE player_name = 'Enzo'"
        ).fetchone()["n"] == 0
