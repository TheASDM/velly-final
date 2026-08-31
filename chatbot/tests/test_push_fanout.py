"""Fan-out contract: webpush I/O runs outside any DB transaction, deliveries
are recorded afterwards, and dead subscriptions (404/410) are pruned."""

from vos.routes import push as push_routes


def _seed_subscription(server_module, player, endpoint):
    with server_module._app_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO subscriptions
                (player_name, endpoint, p256dh, auth, created_at)
            VALUES (?, ?, 'k', 'a', ?)
            """,
            (player, endpoint, server_module._utc_now_iso()),
        )


def _clear_push_tables(server_module):
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM subscriptions")
        conn.execute("DELETE FROM push_deliveries")


def test_fanout_sends_and_records_deliveries(server_module, monkeypatch):
    _clear_push_tables(server_module)
    _seed_subscription(server_module, "Lotan", "https://push.example/1")
    _seed_subscription(server_module, "Valentro", "https://push.example/2")

    sent_payloads = []

    def fake_webpush(subscription_info=None, data=None, **kwargs):
        sent_payloads.append(subscription_info["endpoint"])

    monkeypatch.setattr(push_routes, "send_webpush", fake_webpush)

    result = push_routes._fanout_push("Title", "Body", "/", recipients=["Lotan"])
    assert result["attempted"] == 1
    assert result["sent"] == 1
    assert result["failed"] == 0
    assert sent_payloads == ["https://push.example/1"]

    with server_module._app_db() as conn:
        rows = conn.execute(
            "SELECT player_name, status FROM push_deliveries"
        ).fetchall()
    assert [(r["player_name"], r["status"]) for r in rows] == [("Lotan", "sent")]
    _clear_push_tables(server_module)


def test_fanout_prunes_gone_subscriptions(server_module, monkeypatch):
    _clear_push_tables(server_module)
    _seed_subscription(server_module, "Lotan", "https://push.example/dead")

    class FakeResponse:
        status_code = 410

    def gone_webpush(**kwargs):
        exc = push_routes.WebPushException("gone")
        exc.response = FakeResponse()
        raise exc

    monkeypatch.setattr(push_routes, "send_webpush", gone_webpush)

    result = push_routes._fanout_push("Title", "Body", "/")
    assert result["pruned"] == 1
    assert result["failed"] == 1

    with server_module._app_db() as conn:
        remaining = conn.execute("SELECT COUNT(*) AS n FROM subscriptions").fetchone()["n"]
        statuses = [
            row["status"]
            for row in conn.execute("SELECT status FROM push_deliveries")
        ]
    assert remaining == 0
    assert statuses == ["pruned"]
    _clear_push_tables(server_module)


def test_fanout_holds_no_transaction_during_send(server_module, monkeypatch):
    """A concurrent writer must not be blocked while webpush I/O runs."""
    _clear_push_tables(server_module)
    _seed_subscription(server_module, "Lotan", "https://push.example/1")

    def writing_webpush(**kwargs):
        # If the fan-out held a write transaction, this second connection's
        # write would hit the busy timeout instead of returning instantly.
        with server_module._app_db() as conn:
            conn.execute("PRAGMA busy_timeout=200")
            conn.execute(
                "INSERT INTO push_deliveries (message_id, player_name, endpoint, status, error, created_at) "
                "VALUES (NULL, 'probe', 'probe', 'failed', NULL, ?)",
                (server_module._utc_now_iso(),),
            )

    monkeypatch.setattr(push_routes, "send_webpush", writing_webpush)

    result = push_routes._fanout_push("Title", "Body", "/")
    assert result["sent"] == 1

    with server_module._app_db() as conn:
        by_player = {
            row["player_name"]: row["status"]
            for row in conn.execute("SELECT player_name, status FROM push_deliveries")
        }
    assert by_player == {"probe": "failed", "Lotan": "sent"}
    _clear_push_tables(server_module)
