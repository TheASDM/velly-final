import json
import pytest


@pytest.fixture(autouse=True)
def sheets(server_module):
    """Two players, both variants, so isolation failures have something to leak."""
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM character_sheets")
        conn.executemany(
            """
            INSERT INTO character_sheets (player_name, variant, markdown, updated_at)
            VALUES (?, ?, ?, '2026-08-25T00:00:00Z')
            """,
            [
                ("Lotan", "player", "# LOTAN\nWhat Lotan reads.", ),
                ("Lotan", "dm", "# DM SHEET — Lotan\nLotan's arc spoiler.", ),
                ('Roxanya "Roxy"', "player", "# ROXY\nWhat Roxy reads.", ),
                ('Roxanya "Roxy"', "dm", "# DM SHEET — Roxy\nRoxy's arc spoiler.", ),
            ],
        )
    yield
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM character_sheets")


def test_my_sheet_requires_a_session(app):
    with app.test_client() as client:
        assert client.get("/api/sheet").status_code == 401


def test_my_sheet_returns_only_that_players_own_sheet(app, auth_headers):
    with app.test_client() as client:
        response = client.get("/api/sheet", headers=auth_headers["player"])

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["playerName"] == "Lotan"
    assert payload["sheet"]["markdown"] == "# LOTAN\nWhat Lotan reads."


def test_my_sheet_never_serves_the_dm_variant(app, auth_headers):
    """The player route hard-codes variant='player'; the spoiler copy of their
    own sheet must not come back through it."""
    with app.test_client() as client:
        response = client.get("/api/sheet", headers=auth_headers["player"])

    body = response.get_data(as_text=True)
    assert "arc spoiler" not in body
    assert "DM SHEET" not in body


def test_a_variant_parameter_cannot_promote_the_player_to_the_dm_sheet(app, auth_headers):
    """The route hard-codes the variant, so asking for the DM one changes nothing."""
    with app.test_client() as client:
        response = client.get("/api/sheet?variant=dm", headers=auth_headers["player"])

    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert response.get_json()["playerName"] == "Lotan"
    assert "arc spoiler" not in body


def test_asking_for_another_player_is_refused_not_silently_reinterpreted(app, auth_headers):
    """_authenticated_player_name() rejects a name that disagrees with the
    token rather than quietly serving the caller their own sheet."""
    with app.test_client() as client:
        response = client.get(
            '/api/sheet?player_name=Roxanya "Roxy"', headers=auth_headers["player"]
        )

    assert response.status_code == 403
    assert "Roxy" not in response.get_data(as_text=True)


def test_all_sheets_is_dm_only(app, auth_headers):
    expected = {"anonymous": 401, "player": 403, "dm": 200, "google_dm": 200}
    for role, status in expected.items():
        with app.test_client() as client:
            response = client.get("/api/sheets", headers=auth_headers[role])
        assert response.status_code == status, role


def test_all_sheets_returns_both_variants_for_everyone(app, auth_headers):
    with app.test_client() as client:
        response = client.get("/api/sheets", headers=auth_headers["dm"])

    sheets = {entry["playerName"]: entry for entry in response.get_json()["sheets"]}
    assert set(sheets) == {"Lotan", 'Roxanya "Roxy"'}
    assert sheets["Lotan"]["dm"]["markdown"] == "# DM SHEET — Lotan\nLotan's arc spoiler."
    assert sheets["Lotan"]["player"]["markdown"] == "# LOTAN\nWhat Lotan reads."


def test_missing_sheet_is_not_an_error(app, auth_headers, server_module):
    """A player with no sheet yet should get an empty answer, not a 404 or a
    stack trace — the page renders a 'not written yet' state from this."""
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM character_sheets WHERE player_name = 'Lotan'")

    with app.test_client() as client:
        response = client.get("/api/sheet", headers=auth_headers["player"])

    assert response.status_code == 200
    assert response.get_json()["sheet"] is None


def test_statblock_rides_along_with_the_players_own_sheet(app, auth_headers, server_module):
    with server_module._app_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO character_statblocks (player_name, data, updated_at)"
            " VALUES (?, ?, '2026-08-25T00:00:00Z')",
            ("Lotan", '{"name": "Lotan", "derived": {"level": 3}}'),
        )
    try:
        with app.test_client() as client:
            response = client.get("/api/sheet", headers=auth_headers["player"])
        payload = response.get_json()
        assert payload["statblock"]["data"]["derived"]["level"] == 3
    finally:
        with server_module._app_db() as conn:
            conn.execute("DELETE FROM character_statblocks")


def test_a_players_statblock_is_not_reachable_by_anyone_else(app, auth_headers, server_module):
    with server_module._app_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO character_statblocks (player_name, data, updated_at)"
            " VALUES (?, ?, '2026-08-25T00:00:00Z')",
            ('Roxanya "Roxy"', '{"name": "Roxy", "secretMarker": "roxy-only"}'),
        )
    try:
        with app.test_client() as client:
            response = client.get("/api/sheet", headers=auth_headers["player"])
        body = response.get_data(as_text=True)
        assert "roxy-only" not in body
        assert response.get_json()["statblock"] is None
    finally:
        with server_module._app_db() as conn:
            conn.execute("DELETE FROM character_statblocks")


def test_a_corrupt_statblock_does_not_take_the_sheet_down(app, auth_headers, server_module):
    """A row that will not parse should read as absent, not 500 the request."""
    with server_module._app_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO character_statblocks (player_name, data, updated_at)"
            " VALUES (?, ?, '2026-08-25T00:00:00Z')",
            ("Lotan", "{not json at all"),
        )
    try:
        with app.test_client() as client:
            response = client.get("/api/sheet", headers=auth_headers["player"])
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["statblock"] is None
        assert payload["sheet"]["markdown"] == "# LOTAN\nWhat Lotan reads."
    finally:
        with server_module._app_db() as conn:
            conn.execute("DELETE FROM character_statblocks")


# ── Foundry bridge ingest ──────────────────────────────────────────────

INGEST = "/api/statblocks/ingest"
TOKEN = "test-ingest-token"


def _export(name="Car", **overrides):
    doc = {
        "vosExport": {"version": 1, "exportedAt": "2026-08-26T00:00:00Z", "system": "5.2.4"},
        "name": name,
        "system": {"abilities": {}},
        "items": [],
        "derived": {"level": 3, "ac": 13, "prof": 2},
    }
    doc.update(overrides)
    return doc


@pytest.fixture
def ingest_enabled(server_module, monkeypatch):
    from vos.routes import sheets as sheets_route
    monkeypatch.setattr(sheets_route, "STATBLOCK_INGEST_TOKEN", TOKEN)
    yield
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM character_statblocks")


def _post(app, body, token=TOKEN):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with app.test_client() as client:
        return client.post(INGEST, data=json.dumps(body), headers=headers)


def test_ingest_is_closed_when_no_token_is_configured(app):
    """An unconfigured deploy must fail shut, not accept anonymous pushes."""
    response = _post(app, _export(), token=None)
    assert response.status_code == 503
    assert response.get_json()["error_code"] == "ingest_not_configured"


def test_ingest_rejects_a_wrong_token(app, ingest_enabled):
    assert _post(app, _export(), token="not-the-token").status_code == 401
    assert _post(app, _export(), token=None).status_code == 401


def test_ingest_maps_the_foundry_actor_name_onto_the_roster(app, ingest_enabled, server_module):
    response = _post(app, _export("Car"))
    assert response.status_code == 200
    assert response.get_json()["playerName"] == 'Caravel "Car" Asteri'

    with server_module._app_db() as conn:
        row = conn.execute(
            "SELECT player_name FROM character_statblocks"
        ).fetchone()
    assert row["player_name"] == 'Caravel "Car" Asteri'


def test_the_dms_test_wizard_no_longer_resolves(app, ingest_enabled, server_module):
    """The DM's test character was removed from the game, so the alias that
    used to admit it went too. A Foundry export that still contains the actor
    is refused rather than quietly rebuilding a character nobody plays."""
    response = _post(app, _export("DM Test Wizard"))
    assert response.status_code == 422

    with server_module._app_db() as conn:
        row = conn.execute("SELECT player_name FROM character_statblocks").fetchone()
    assert row is None


def test_the_dm_can_still_own_a_character(app, ingest_enabled, server_module):
    """Removing the wizard did not close the door on the DM ever playing one —
    an actor named for the DM still lands in their seat."""
    response = _post(app, _export("Dustin"))
    assert response.status_code == 200
    assert response.get_json()["playerName"] == "DM"


def test_ingest_refuses_an_actor_that_is_not_on_the_roster(app, ingest_enabled):
    response = _post(app, _export("Some Random NPC"))
    assert response.status_code == 422
    assert response.get_json()["error_code"] == "unknown_player"


def test_ingest_refuses_a_revoked_player(app, ingest_enabled, monkeypatch):
    """Revocation should not be undone by a push from Foundry."""
    from vos.routes import sheets as sheets_route
    monkeypatch.setattr(sheets_route, "REVOKED_PLAYERS", {"Valentro"})
    response = _post(app, _export("Valentro"))
    assert response.status_code == 422


def test_ingest_requires_the_derived_block(app, ingest_enabled):
    response = _post(app, _export(derived={}))
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "no_derived"


def test_ingest_refuses_an_unknown_export_version(app, ingest_enabled):
    response = _post(app, _export(vosExport={"version": 99}))
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "bad_version"


def test_ingest_rejects_an_oversized_payload(app, ingest_enabled, monkeypatch):
    from vos.routes import sheets as sheets_route
    monkeypatch.setattr(sheets_route, "STATBLOCK_MAX_BYTES", 200)
    response = _post(app, _export(system={"padding": "x" * 5000}))
    assert response.status_code == 413


def test_ingest_replaces_the_previous_push_for_that_player(app, ingest_enabled):
    _post(app, _export("Car", derived={"level": 3, "ac": 13}))
    _post(app, _export("Car", derived={"level": 4, "ac": 15}))

    with app.test_client() as client:
        response = client.post(
            INGEST,
            data=json.dumps(_export("Car", derived={"level": 5, "ac": 16})),
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        )
    assert response.status_code == 200

    from vos.routes import sheets as sheets_route
    with sheets_route._app_db() as conn:
        rows = conn.execute("SELECT data FROM character_statblocks").fetchall()
    assert len(rows) == 1
    assert json.loads(rows[0]["data"])["derived"]["level"] == 5
