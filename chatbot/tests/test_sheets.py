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
    expected = {"anonymous": 401, "player": 401, "dm": 200, "google_dm": 200}
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
