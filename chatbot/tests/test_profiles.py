"""Profiles: who everyone is, what they chose to say, and the hard line
around what a profile does not carry.

The three things players now share with each other — a self-written bio, an
uploaded avatar, and last-seen — were chosen deliberately. Everything else
about a character stays where it was.
"""

import io
import json

import pytest
from PIL import Image

from vos.routes import profiles as profile_routes


def _headers(server_module, name, is_dm=False):
    return {"Authorization": f"Bearer {server_module._issue_player_token(name, is_dm=is_dm)}"}


def _clear(server_module):
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM player_profiles")
        conn.execute("DELETE FROM player_presence")
        conn.execute("DELETE FROM character_statblocks")
    if profile_routes.AVATAR_DIR.exists():
        for path in profile_routes.AVATAR_DIR.iterdir():
            path.unlink()


@pytest.fixture(autouse=True)
def clean(server_module):
    _clear(server_module)
    yield
    _clear(server_module)
    server_module.limiter.reset()


def png_bytes(width=300, height=300, colour=(70, 90, 120)):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


# ── The directory ─────────────────────────────────────────────────────

def test_the_directory_is_the_table_and_only_the_table(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        data = client.get("/api/profiles", headers=lotan).get_json()
    names = [profile["name"] for profile in data["profiles"]]
    assert "Lotan" in names
    assert "DM" in names
    # Enzo is not a person and has no profile.
    assert "Enzo" not in names
    # A directory carries faces, not bios.
    assert all("bio" not in profile for profile in data["profiles"])


def test_a_directory_entry_falls_back_to_the_curated_portrait(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        data = client.get("/api/profiles", headers=lotan).get_json()
    lotan_entry = next(p for p in data["profiles"] if p["name"] == "Lotan")
    assert lotan_entry["avatarUrl"].startswith("/images/app-profiles/")
    assert lotan_entry["display"] == "Lotan"


def test_anonymous_sees_no_profiles(app):
    with app.test_client() as client:
        assert client.get("/api/profiles").status_code == 401
        assert client.get("/api/profiles/Lotan").status_code == 401


# ── One profile ───────────────────────────────────────────────────────

def test_a_profile_carries_the_five_chosen_facts_and_no_others(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        client.put("/api/profile", json={"bio": "Keeps the ledger."}, headers=lotan)
        client.get("/api/profiles", headers=lotan)  # touches presence
        profile = client.get("/api/profiles/Lotan",
                             headers=_headers(server_module, "Valentro")).get_json()["profile"]
    assert profile["display"] == "Lotan"
    assert profile["bio"] == "Keeps the ledger."
    assert profile["avatarUrl"]
    assert profile["lastSeenAt"]
    assert "character" in profile
    # Nothing about play state, notes, records or scheduling leaks in.
    assert not {"hp", "notes", "rsvp", "availability", "questionnaire", "slots"} \
        & set(profile)


def test_the_character_line_comes_from_the_pushed_statblock(app, server_module):
    lotan = _headers(server_module, "Lotan")
    statblock = {
        "name": "Lotan",
        "derived": {"classes": [{"name": "Warlock", "levels": 5}], "raceName": "Tiefling"},
    }
    with server_module._app_db() as conn:
        conn.execute("""
            INSERT INTO character_statblocks (player_name, data, updated_at)
            VALUES (?, ?, ?)
        """, ("Lotan", json.dumps(statblock), server_module._utc_now_iso()))
    with app.test_client() as client:
        profile = client.get("/api/profiles/Lotan", headers=lotan).get_json()["profile"]
    assert profile["character"]["classLine"] == "Warlock 5"
    assert profile["character"]["race"] == "Tiefling"


def test_your_own_profile_knows_it_and_offers_no_thread_to_yourself(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        mine = client.get("/api/profiles/Lotan", headers=lotan).get_json()["profile"]
        theirs = client.get("/api/profiles/Valentro", headers=lotan).get_json()["profile"]
    assert mine["isYou"] is True
    assert mine["threadKey"] is None
    assert theirs["isYou"] is False
    # The client never has to know how a thread key is spelled.
    assert theirs["threadKey"] == "Lotan|Valentro"


def test_a_stranger_has_no_profile(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        assert client.get("/api/profiles/Nobody", headers=lotan).status_code == 404
        assert client.get("/api/profiles/Enzo", headers=lotan).status_code == 404


# ── Bios ──────────────────────────────────────────────────────────────

def test_you_can_only_write_your_own_bio(app, server_module):
    """There is no endpoint that takes someone else's name."""
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        client.put("/api/profile", json={"bio": "Mine.", "playerName": "Valentro"},
                   headers=lotan)
        mine = client.get("/api/profiles/Lotan", headers=lotan).get_json()["profile"]
        theirs = client.get("/api/profiles/Valentro", headers=lotan).get_json()["profile"]
    assert mine["bio"] == "Mine."
    assert theirs["bio"] == ""


def test_a_bio_has_a_ceiling_and_can_be_cleared(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        too_long = client.put("/api/profile",
                              json={"bio": "x" * (profile_routes.BIO_MAX + 1)},
                              headers=lotan)
        assert too_long.status_code == 400
        client.put("/api/profile", json={"bio": "  Something.  "}, headers=lotan)
        assert client.get("/api/profiles/Lotan",
                          headers=lotan).get_json()["profile"]["bio"] == "Something."
        client.put("/api/profile", json={"bio": ""}, headers=lotan)
        assert client.get("/api/profiles/Lotan",
                          headers=lotan).get_json()["profile"]["bio"] == ""


def test_a_bio_is_stored_verbatim_and_escaped_by_the_renderer(app, server_module):
    """Bios go through the same safe-markdown pipeline as everything else,
    so the store does not try to sanitise and half-succeed."""
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        client.put("/api/profile", json={"bio": "<script>alert(1)</script>"},
                   headers=lotan)
        profile = client.get("/api/profiles/Lotan", headers=lotan).get_json()["profile"]
    assert profile["bio"] == "<script>alert(1)</script>"


# ── Avatars ───────────────────────────────────────────────────────────

def _upload_avatar(client, headers, data, name="me.png", mime="image/png"):
    return client.post("/api/profile/avatar",
                       data={"file": (io.BytesIO(data), name, mime)},
                       content_type="multipart/form-data", headers=headers)


def test_an_uploaded_avatar_replaces_the_curated_one(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        created = _upload_avatar(client, lotan, png_bytes())
        assert created.status_code == 201
        url = created.get_json()["avatarUrl"]
        assert url.startswith("/api/profiles/Lotan/avatar")
        served = client.get(url, headers=lotan)
    assert served.status_code == 200
    assert served.mimetype == "image/jpeg"
    assert served.headers["X-Content-Type-Options"] == "nosniff"


def test_an_avatar_is_stored_at_avatar_size(app, server_module):
    """A twelve-megapixel selfie should not be what a 32px circle serves."""
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        _upload_avatar(client, lotan, png_bytes(2400, 2400))
        with server_module._app_db() as conn:
            stored = conn.execute(
                "SELECT avatar_file FROM player_profiles WHERE player_name = 'Lotan'"
            ).fetchone()["avatar_file"]
    with Image.open(profile_routes.AVATAR_DIR / stored) as image:
        assert max(image.size) <= profile_routes.AVATAR_BOX


def test_replacing_an_avatar_removes_the_old_file(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        _upload_avatar(client, lotan, png_bytes(colour=(10, 10, 10)))
        with server_module._app_db() as conn:
            first = conn.execute(
                "SELECT avatar_file FROM player_profiles WHERE player_name = 'Lotan'"
            ).fetchone()["avatar_file"]
        _upload_avatar(client, lotan, png_bytes(colour=(200, 200, 200)))
    assert not (profile_routes.AVATAR_DIR / first).exists()
    assert len(list(profile_routes.AVATAR_DIR.iterdir())) == 1


def test_removing_an_avatar_goes_back_to_the_curated_portrait(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        _upload_avatar(client, lotan, png_bytes())
        removed = client.delete("/api/profile/avatar", headers=lotan)
    assert removed.get_json()["avatarUrl"].startswith("/images/app-profiles/")
    assert not list(profile_routes.AVATAR_DIR.iterdir())


def test_an_avatar_goes_through_the_same_decode_as_an_attachment(app, server_module):
    lotan = _headers(server_module, "Lotan")
    wav = b"RIFF" + (36).to_bytes(4, "little") + b"WAVEfmt " + b"\x00" * 40
    with app.test_client() as client:
        assert _upload_avatar(client, lotan, b"MZ not an image").status_code == 415
        assert _upload_avatar(client, lotan, wav, "me.webp", "image/webp").status_code == 415
        assert _upload_avatar(client, lotan, png_bytes()[:20]).status_code == 415
        assert _upload_avatar(client, lotan, b"%PDF-1.4\n", "me.pdf",
                              "application/pdf").status_code == 415


def test_an_avatar_is_only_served_to_signed_in_players(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        url = _upload_avatar(client, lotan, png_bytes()).get_json()["avatarUrl"]
        assert client.get(url, headers=_headers(server_module, "Valentro")).status_code == 200
        assert client.get(url).status_code == 404


def test_an_avatar_url_that_names_no_upload_is_a_404(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        assert client.get("/api/profiles/Valentro/avatar", headers=lotan).status_code == 404
        assert client.get("/api/profiles/Nobody/avatar", headers=lotan).status_code == 404
