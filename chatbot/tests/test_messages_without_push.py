"""Posting a message must work without VAPID keys — the in-app card needs no
push, so missing push config downgrades to push: {skipped: not_configured}
instead of a 503 that blocks the whole announcement."""


def test_message_posts_when_push_unconfigured(app, server_module, auth_headers):
    # The test environment configures no VAPID keys.
    assert server_module._push_config_error()

    with app.test_client() as client:
        response = client.post(
            "/api/messages",
            json={"title": "Session moved", "body": "We start at 6."},
            headers=auth_headers["dm"],
        )
    assert response.status_code == 201
    data = response.get_json()
    assert data["ok"] is True
    assert data["push"]["skipped"] == "not_configured"
    message_id = data["message"]["id"]

    with server_module._app_db() as conn:
        conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))
