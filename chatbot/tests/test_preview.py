"""Previewing a player opens their app surfaces without impersonating them in chat.

Hiding DM controls is not authorization. These tests hold the line that the
brief's preview mode is a different credential rather than a client flag. It
can inspect ordinary player surfaces, but private messaging is a boundary the
DM cannot cross by changing seats.
"""

import urllib.parse


def _preview_headers(client, auth_headers, player="Lotan"):
    response = client.post(
        "/api/auth/preview", headers=auth_headers["dm"], json={"player": player}
    )
    assert response.status_code == 200, response.get_json()
    return {"Authorization": f"Bearer {response.get_json()['token']}"}


def test_only_the_dm_can_mint_a_preview(app, auth_headers):
    with app.test_client() as client:
        assert client.post("/api/auth/preview", headers=auth_headers["anonymous"],
                           json={"player": "Lotan"}).status_code == 401
        assert client.post("/api/auth/preview", headers=auth_headers["player"],
                           json={"player": "Lotan"}).status_code == 403


def test_preview_refuses_a_name_that_is_not_at_the_table(app, auth_headers):
    with app.test_client() as client:
        assert client.post("/api/auth/preview", headers=auth_headers["dm"],
                           json={"player": "Nobody"}).status_code == 404
        # The DM's own seat is not a preview of anything.
        assert client.post("/api/auth/preview", headers=auth_headers["dm"],
                           json={"player": "DM"}).status_code == 400


def test_preview_token_reads_as_that_player(app, auth_headers):
    with app.test_client() as client:
        headers = _preview_headers(client, auth_headers)
        session = client.get("/api/auth/session", headers=headers).get_json()
        assert session["playerName"] == "Lotan"
        assert session["isDm"] is False
        assert session["preview"] is True
        assert session["previewActor"]


def test_preview_token_cannot_open_dm_doors(app, auth_headers):
    """The important one. Every route below answers the DM and must not
    answer someone wearing a player's seat, however they got into it."""
    dm_only = [
        ("GET", "/api/admin/dashboard"),
        ("GET", "/api/admin/messages"),
        ("GET", "/api/admin/lore-submissions"),
        ("GET", "/api/admin/wiki-pages"),
        ("GET", "/api/sheets"),
        ("GET", "/api/play/party"),
        ("GET", "/api/handouts/all"),
        ("GET", "/api/availability/summary"),
        ("GET", "/api/gallery?scope=all"),
    ]
    with app.test_client() as client:
        headers = _preview_headers(client, auth_headers)
        for method, path in dm_only:
            response = client.open(path, method=method, headers=headers)
            assert response.status_code == 403, f"{path} answered {response.status_code}"

        # And it cannot mint itself a fresh preview of somebody else.
        assert client.post("/api/auth/preview", headers=headers,
                           json={"player": "Car"}).status_code == 403


def test_preview_token_cannot_read_or_act_as_the_player_in_chat(app, auth_headers,
                                                                server_module):
    roxy = {
        "Authorization":
            f"Bearer {server_module._issue_player_token('Roxanya \"Roxy\"')}"
    }
    key = 'Lotan|Roxanya "Roxy"'
    url = "/api/im/thread/" + urllib.parse.quote(key, safe="")
    with app.test_client() as client:
        client.post(url, headers=roxy, json={"body": "Between players."})
        preview = _preview_headers(client, auth_headers)

        for method, path, body in (
            ("GET", "/api/im/threads", None),
            ("GET", url, None),
            ("POST", url, {"body": "Not from the player."}),
            ("POST", "/api/im/read", {"threadKey": key, "lastReadId": 1}),
            ("POST", "/api/im/typing", {"threadKey": key, "typing": True}),
        ):
            response = client.open(path, method=method, headers=preview, json=body)
            assert response.status_code == 403, (method, path, response.get_json())
            assert response.get_json()["error_code"] == "preview_forbidden"
