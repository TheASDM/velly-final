"""Login brute-force protection: short static codes need a rate limit."""


def test_player_login_is_rate_limited(app, server_module):
    try:
        statuses = []
        with app.test_client() as client:
            for _ in range(11):
                statuses.append(client.post("/api/auth/login", json={}).status_code)
        assert 429 not in statuses[:10]
        assert statuses[-1] == 429
    finally:
        # Rate state is per-process; clear it so later tests that touch the
        # same endpoints see a clean slate.
        server_module.limiter.reset()


def test_admin_login_is_rate_limited(app, server_module):
    try:
        statuses = []
        with app.test_client() as client:
            for _ in range(11):
                statuses.append(client.post("/api/admin/login", json={}).status_code)
        assert 429 not in statuses[:10]
        assert statuses[-1] == 429
        body = None
        with app.test_client() as client:
            body = client.post("/api/admin/login", json={}).get_json()
        assert body["error_code"] == "rate_limited"
    finally:
        server_module.limiter.reset()
