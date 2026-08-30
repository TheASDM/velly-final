"""Scoping contract for /api/questionnaire/definitions.

The definitions file carries every character's secret Part II prompts and
on-file vitals. A player must receive only their own character; the DM (via
player token or Google session) receives all of them; anonymous callers get
nothing. The conftest player fixture is "Lotan", who owns the "lotan"
character in _data/questionnaire.json.
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _definitions_on_disk():
    with open(REPO_ROOT / "_data" / "questionnaire.json", encoding="utf-8") as handle:
        return json.load(handle)


def _get(app, headers):
    with app.test_client() as client:
        return client.get("/api/questionnaire/definitions", headers=headers)


def test_anonymous_is_refused(app, auth_headers):
    response = _get(app, auth_headers["anonymous"])
    assert response.status_code == 401


def test_player_sees_only_their_own_character(app, auth_headers):
    on_disk = _definitions_on_disk()
    own = {
        key
        for key, character in on_disk["characters"].items()
        if character.get("player") == "Lotan"
    }
    assert own, "fixture player Lotan should own a character"

    response = _get(app, auth_headers["player"])
    assert response.status_code == 200
    data = response.get_json()
    assert set(data["characters"]) == own
    # The shared question sets still come through untouched.
    assert data["part1"] == on_disk["part1"]
    assert data["tables"] == on_disk["tables"]


def test_dm_sees_every_character(app, auth_headers):
    on_disk = _definitions_on_disk()
    for role in ("dm", "google_dm"):
        response = _get(app, auth_headers[role])
        assert response.status_code == 200, role
        data = response.get_json()
        assert set(data["characters"]) == set(on_disk["characters"]), role
