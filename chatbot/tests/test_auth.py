import pytest


def test_admin_auth_accepts_both_dm_credentials(app, auth_headers):
    expected = {
        "anonymous": 401,
        "player": 403,
        "dm": 200,
        "google_dm": 200,
    }
    for role, status in expected.items():
        with app.test_client() as client:
            response = client.get("/api/admin/messages", headers=auth_headers[role])
        assert response.status_code == status, role


def test_player_session_rejects_google_admin_session(app, auth_headers):
    expected = {
        "anonymous": 401,
        "player": 200,
        "dm": 200,
        "google_dm": 401,
    }
    for role, status in expected.items():
        with app.test_client() as client:
            response = client.get("/api/auth/session", headers=auth_headers[role])
        assert response.status_code == status, role


def test_admin_auth_reports_invalid_bearer(app):
    with app.test_client() as client:
        response = client.get(
            "/api/admin/messages",
            headers={"Authorization": "Bearer definitely-not-a-token"},
        )
    assert response.status_code == 401
    assert response.get_json()["error_code"] == "auth"


def test_revoked_player_loses_a_still_valid_token(app, server_module, monkeypatch):
    """Revocation is re-checked per request, so a correctly signed, unexpired
    token stops working immediately instead of lasting out its 180-day TTL."""
    from vos import auth as vos_auth

    token = server_module._issue_player_token("Lotan")
    assert server_module._verify_player_token(token) == "Lotan"

    monkeypatch.setattr(vos_auth, "REVOKED_PLAYERS", {"Lotan"})

    assert server_module._verify_player_token(token) is None
    with app.test_client() as client:
        response = client.get(
            "/api/auth/session", headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 401


def test_revoking_one_player_leaves_the_others_alone(app, server_module, monkeypatch):
    from vos import auth as vos_auth

    monkeypatch.setattr(vos_auth, "REVOKED_PLAYERS", {"Orabella"})

    for name in ("Lotan", 'Roxanya "Roxy"', "DM"):
        token = server_module._issue_player_token(name)
        assert server_module._verify_player_token(token) == name


def test_revoked_player_cannot_log_back_in_through_oauth(server_module, monkeypatch):
    """Even with the principal still mapped, OAuth refuses a revoked player."""
    from vos import auth as vos_auth

    monkeypatch.setattr(vos_auth, "DISCORD_PLAYER_MAP", {"123456789012345678": "Orabella"})
    profile = {"provider": "discord", "principal": "123456789012345678", "email": ""}

    assert vos_auth._resolve_oauth_player(profile) == ("Orabella", False)

    monkeypatch.setattr(vos_auth, "REVOKED_PLAYERS", {"Orabella"})
    with pytest.raises(ValueError, match="revoked"):
        vos_auth._resolve_oauth_player(profile)


def test_revoked_players_accepts_display_names_and_aliases():
    from vos.config import _parse_revoked_players

    assert _parse_revoked_players("Kryton,Orabella") == {"Kryton Novelli", "Orabella"}
    assert _parse_revoked_players("Roxy; Val") == {'Roxanya "Roxy"', "Valentro"}
    assert _parse_revoked_players("") == set()
    assert _parse_revoked_players(None) == set()
