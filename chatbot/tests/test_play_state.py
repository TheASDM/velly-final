import json

import pytest


STATBLOCK = {
    "vosExport": {"version": 1},
    "name": "Lotan",
    "system": {},
    "items": [],
    "derived": {
        "level": 3,
        "prof": 2,
        "ac": 13,
        "hp": {"value": 21, "max": 21, "temp": 0, "tempmax": 0},
        "hitDice": {"value": 3, "max": 3},
        "spells": {"spell1": {"value": 4, "max": 4}, "spell2": {"value": 2, "max": 2}},
    },
}


@pytest.fixture(autouse=True)
def clean(server_module):
    def wipe():
        with server_module._app_db() as conn:
            conn.execute("DELETE FROM character_play_state")
            conn.execute("DELETE FROM character_play_ops")
            conn.execute("DELETE FROM character_statblocks")
    wipe()
    with server_module._app_db() as conn:
        conn.execute(
            "INSERT INTO character_statblocks (player_name, data, updated_at)"
            " VALUES (?, ?, '2026-08-26T00:00:00Z')",
            ("Lotan", json.dumps(STATBLOCK)),
        )
    yield
    wipe()


def post(app, headers, body):
    with app.test_client() as client:
        return client.post("/api/play/op", data=json.dumps(body),
                           headers={**headers, "Content-Type": "application/json"})


def get(app, headers, path="/api/play"):
    with app.test_client() as client:
        return client.get(path, headers=headers)


# ── The boundary ──────────────────────────────────────────────────────

def test_play_state_requires_a_session(app):
    assert get(app, {}).status_code == 401
    assert post(app, {}, {"op": "damage", "amount": 1}).status_code == 401


def test_no_operation_can_reach_the_build_layer(server_module):
    """The registry is the security boundary, so assert the invariant directly:
    running every operation must never introduce a key outside the play-state
    document, and must never change one that belongs to Foundry."""
    from vos.services import play_state

    allowed = set(play_state.default_state())
    limits = {"known": True, "maxHp": 21, "slots": {"1": 4}, "pact": 1, "hitDice": 3, "prof": 2}

    for name in play_state.OPS:
        state = play_state.default_state()
        state["hp"]["current"] = 21
        try:
            after, _note = play_state.apply_op(
                state,
                {"op": name, "amount": 1, "value": 1, "delta": 1, "level": 1,
                 "condition": "prone", "feature": "x", "healed": 1},
                limits,
            )
        except play_state.OpError:
            continue
        assert set(after) <= allowed, f"{name} introduced {set(after) - allowed}"

    # There is no operation to set an ability score, because none exists.
    with pytest.raises(play_state.OpError):
        play_state.apply_op(play_state.default_state(), {"op": "setAbility", "str": 20}, limits)


def test_a_character_cannot_spend_a_slot_level_they_do_not_have(app, auth_headers):
    """Lotan has levels 1 and 2. A missing level means none, not unlimited."""
    refused = post(app, auth_headers["player"], {"op": "spendSlot", "level": 9})
    assert refused.status_code == 409
    assert "No level 9 slots" in refused.get_json()["error"]


def test_limits_stay_permissive_until_a_statblock_arrives(server_module):
    """Someone whose sheet has not been pushed can still record damage."""
    from vos.services.play_state import apply_op, default_state, limits_from_statblock

    limits = limits_from_statblock(None)
    assert limits["known"] is False
    after, _ = apply_op(default_state(), {"op": "spendSlot", "level": 3}, limits)
    assert after["slots"]["3"] == 1


def test_unknown_operations_are_refused(app, auth_headers):
    response = post(app, auth_headers["player"], {"op": "setAbility", "str": 20})
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "unknown_op"


def test_a_player_cannot_touch_another_character(app, auth_headers):
    response = post(app, auth_headers["player"],
                    {"op": "damage", "amount": 5, "playerName": 'Roxanya "Roxy"'})
    assert response.status_code == 403
    assert response.get_json()["error_code"] == "forbidden_target"


def test_the_dm_may_act_on_a_named_player(app, auth_headers):
    response = post(app, auth_headers["dm"],
                    {"op": "damage", "amount": 5, "playerName": "Lotan"})
    assert response.status_code == 200
    assert response.get_json()["playerName"] == "Lotan"


def test_the_dm_cannot_act_on_a_revoked_player(app, auth_headers, monkeypatch):
    from vos.routes import play as play_route
    monkeypatch.setattr(play_route, "REVOKED_PLAYERS", {"Orabella"})
    response = post(app, auth_headers["dm"], {"op": "heal", "amount": 1, "playerName": "Orabella"})
    assert response.status_code == 422


# ── Seeding and reconciliation ────────────────────────────────────────

def test_first_read_seeds_from_foundry(app, auth_headers):
    body = get(app, auth_headers["player"]).get_json()
    assert body["state"]["hp"]["current"] == 21
    assert body["limits"]["maxHp"] == 21
    assert body["limits"]["slots"] == {"1": 4, "2": 2}


def test_a_foundry_push_does_not_reset_play_state(app, auth_headers, server_module):
    """The whole point of the split: editing a character in Foundry must not
    heal them mid-session."""
    post(app, auth_headers["player"], {"op": "damage", "amount": 8})
    assert get(app, auth_headers["player"]).get_json()["state"]["hp"]["current"] == 13

    from vos.routes import sheets as sheets_route
    monkeypatched = dict(STATBLOCK)
    with server_module._app_db() as conn:
        conn.execute(
            "UPDATE character_statblocks SET data = ? WHERE player_name = 'Lotan'",
            (json.dumps(monkeypatched),),
        )
        row = conn.execute(
            "SELECT state FROM character_play_state WHERE player_name = 'Lotan'"
        ).fetchone()
        state = sheets_route.reconcile(json.loads(row["state"]),
                                       sheets_route.limits_from_statblock(monkeypatched))
    assert state["hp"]["current"] == 13


def test_a_lower_maximum_pulls_current_hp_down(server_module):
    from vos.services.play_state import reconcile
    state = {"v": 1, "hp": {"current": 21, "temp": 0}, "exhaustion": 0, "slots": {"1": 1},
             "pact": 0, "hitDiceSpent": 0, "uses": {}, "prepared": [], "conditions": [],
             "reaction": {"used": False, "assessUsed": False}, "mask": None, "form": None,
             "items": [], "seededAt": None}
    out = reconcile(state, {"maxHp": 12, "slots": {"1": 4}, "hitDice": 3})
    assert out["hp"]["current"] == 12


# ── House rules ───────────────────────────────────────────────────────

def test_dropping_to_zero_gives_exhaustion_and_dying_not_death_saves(app, auth_headers):
    """No death saves at this table: 0 HP costs a point of Exhaustion and the
    character keeps acting while Dying."""
    response = post(app, auth_headers["player"], {"op": "damage", "amount": 30})
    state = response.get_json()["state"]
    assert state["hp"]["current"] == 0
    assert state["exhaustion"] == 1
    assert "dying" in state["conditions"]


def test_damage_while_dying_costs_two_and_three_on_a_crit(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 30})   # now Dying, 1
    post(app, auth_headers["player"], {"op": "damage", "amount": 1})    # +2 -> 3
    state = post(app, auth_headers["player"],
                 {"op": "damage", "amount": 1, "critical": True}).get_json()["state"]
    assert state["exhaustion"] == 6


def test_exhaustion_stops_at_six(app, auth_headers):
    for _ in range(6):
        post(app, auth_headers["player"], {"op": "adjustExhaustion", "delta": 2})
    assert get(app, auth_headers["player"]).get_json()["state"]["exhaustion"] == 6


def test_healing_clears_dying(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 30})
    state = post(app, auth_headers["player"], {"op": "heal", "amount": 4}).get_json()["state"]
    assert state["hp"]["current"] == 4
    assert "dying" not in state["conditions"]


def test_temporary_hit_points_absorb_damage_first(app, auth_headers):
    post(app, auth_headers["player"], {"op": "setTempHp", "value": 5})
    state = post(app, auth_headers["player"], {"op": "damage", "amount": 8}).get_json()["state"]
    assert state["hp"]["temp"] == 0
    assert state["hp"]["current"] == 18          # 21 - (8 - 5)


def test_temporary_hit_points_do_not_stack(app, auth_headers):
    post(app, auth_headers["player"], {"op": "setTempHp", "value": 7})
    state = post(app, auth_headers["player"], {"op": "setTempHp", "value": 3}).get_json()["state"]
    assert state["hp"]["temp"] == 7


def test_healing_cannot_exceed_maximum(app, auth_headers):
    state = post(app, auth_headers["player"], {"op": "heal", "amount": 999}).get_json()["state"]
    assert state["hp"]["current"] == 21


def test_slots_run_out(app, auth_headers):
    for _ in range(2):
        assert post(app, auth_headers["player"], {"op": "spendSlot", "level": 2}).status_code == 200
    refused = post(app, auth_headers["player"], {"op": "spendSlot", "level": 2})
    assert refused.status_code == 409
    assert refused.get_json()["error_code"] == "op_refused"


def test_hit_dice_run_out(app, auth_headers):
    for _ in range(3):
        assert post(app, auth_headers["player"], {"op": "spendHitDie"}).status_code == 200
    assert post(app, auth_headers["player"], {"op": "spendHitDie"}).status_code == 409


def test_assess_is_once_per_combat_not_per_round(app, auth_headers):
    assert post(app, auth_headers["player"], {"op": "useAssess"}).status_code == 200
    post(app, auth_headers["player"], {"op": "newRound"})
    assert post(app, auth_headers["player"], {"op": "useAssess"}).status_code == 409
    post(app, auth_headers["player"], {"op": "endCombat"})
    assert post(app, auth_headers["player"], {"op": "useAssess"}).status_code == 200


def test_long_rest_restores_and_clears_one_exhaustion(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 30})   # 0 HP, Dying, 1 exhaustion
    post(app, auth_headers["player"], {"op": "spendSlot", "level": 1})
    post(app, auth_headers["player"], {"op": "adjustExhaustion", "delta": 2})  # 3
    state = post(app, auth_headers["player"], {"op": "longRest"}).get_json()["state"]

    assert state["hp"]["current"] == 21
    assert state["slots"] == {}
    assert state["exhaustion"] == 2
    assert "dying" not in state["conditions"]


def test_conditions_are_from_the_known_list(app, auth_headers):
    assert post(app, auth_headers["player"],
                {"op": "addCondition", "condition": "prone"}).status_code == 200
    assert post(app, auth_headers["player"],
                {"op": "addCondition", "condition": "smug"}).status_code == 409


# ── The log ───────────────────────────────────────────────────────────

def test_every_operation_is_logged_with_who_applied_it(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 3})
    post(app, auth_headers["dm"], {"op": "heal", "amount": 1, "playerName": "Lotan"})

    entries = get(app, auth_headers["player"], "/api/play/log").get_json()["entries"]
    assert [e["op"]["op"] for e in entries] == ["heal", "damage"]
    assert entries[0]["appliedBy"] == "DM"
    assert entries[1]["appliedBy"] == "Lotan"


def test_version_advances_once_per_applied_operation(app, auth_headers):
    first = post(app, auth_headers["player"], {"op": "damage", "amount": 1}).get_json()
    second = post(app, auth_headers["player"], {"op": "damage", "amount": 1}).get_json()
    assert second["version"] == first["version"] + 1

    refused = post(app, auth_headers["player"], {"op": "spendSlot", "level": 9})
    assert refused.status_code == 409
    assert get(app, auth_headers["player"]).get_json()["version"] == second["version"]


def test_a_player_cannot_read_another_players_log(app, auth_headers):
    response = get(app, auth_headers["player"], '/api/play/log?playerName=Roxanya "Roxy"')
    assert response.status_code == 403


# ── The Masquerade ────────────────────────────────────────────────────

def test_donning_a_mask_starts_a_clock_and_grants_temporary_hit_points(app, auth_headers):
    state = post(app, auth_headers["player"],
                 {"op": "donMask", "mask": "diabolica", "tempHp": 7}).get_json()["state"]
    assert state["mask"]["key"] == "diabolica"
    assert state["mask"]["remainingMs"] > 9 * 60 * 1000
    assert state["hp"]["temp"] == 7


def test_the_mask_timer_pauses_and_resumes(app, auth_headers):
    post(app, auth_headers["player"], {"op": "donMask", "mask": "fiabesco"})
    paused = post(app, auth_headers["player"], {"op": "pauseMask"}).get_json()["state"]
    assert paused["mask"]["paused"] is True
    remaining = paused["mask"]["remainingMs"]

    # Paused time does not count, so the remainder is unchanged on resume.
    resumed = post(app, auth_headers["player"], {"op": "resumeMask"}).get_json()["state"]
    assert resumed["mask"]["paused"] is False
    assert abs(resumed["mask"]["remainingMs"] - remaining) < 2000

    assert post(app, auth_headers["player"], {"op": "resumeMask"}).status_code == 409


def test_a_form_needs_a_mask(app, auth_headers):
    refused = post(app, auth_headers["player"],
                   {"op": "assumeForm", "creature": "Il Rosso", "hp": 18})
    assert refused.status_code == 409
    assert "mask" in refused.get_json()["error"]


def test_assuming_a_form_sets_your_own_hit_points_aside(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 6})       # 15 of 21
    post(app, auth_headers["player"], {"op": "donMask", "mask": "diabolica"})
    state = post(app, auth_headers["player"],
                 {"op": "assumeForm", "creature": "Il Rosso", "hp": 18, "cr": "1/2"}).get_json()["state"]

    assert state["form"]["creature"] == "Il Rosso"
    assert state["form"]["hp"] == 18
    assert state["form"]["restore"]["current"] == 15


def test_reverting_restores_the_hit_points_you_had(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 6})
    post(app, auth_headers["player"], {"op": "donMask", "mask": "diabolica"})
    post(app, auth_headers["player"], {"op": "assumeForm", "creature": "Il Rosso", "hp": 18})
    post(app, auth_headers["player"], {"op": "damage", "amount": 5})       # the form takes it
    state = post(app, auth_headers["player"], {"op": "revertForm"}).get_json()["state"]

    assert state["form"] is None
    assert state["mask"] is None          # reverting ends the mask too
    assert state["hp"]["current"] == 15   # not 10 — the form took that damage


def test_damage_lands_on_the_form_and_overflows_to_the_body(app, auth_headers):
    """A form dropped to 0 carries the excess back, per the feature."""
    post(app, auth_headers["player"], {"op": "donMask", "mask": "diabolica"})
    post(app, auth_headers["player"], {"op": "assumeForm", "creature": "Vivo", "hp": 10})
    state = post(app, auth_headers["player"], {"op": "damage", "amount": 14}).get_json()["state"]

    assert state["form"] is None          # dropped, so reverted
    assert state["hp"]["current"] == 17   # 21 - the 4 that carried over


def test_a_long_rest_clears_the_mask(app, auth_headers):
    post(app, auth_headers["player"], {"op": "donMask", "mask": "diabolica", "tempHp": 7})
    state = post(app, auth_headers["player"], {"op": "longRest"}).get_json()["state"]
    assert state["mask"] is None
    assert state["hp"]["temp"] == 0


# ── The party view ────────────────────────────────────────────────────

def test_the_party_view_is_dm_only(app, auth_headers):
    expected = {"anonymous": 401, "player": 403, "dm": 200, "google_dm": 200}
    for role, status in expected.items():
        with app.test_client() as client:
            response = client.get("/api/play/party", headers=auth_headers[role])
        assert response.status_code == status, role


def test_the_dm_joins_the_table_only_with_a_character(app, auth_headers, server_module):
    """An empty seat helps nobody, so the DM appears once they have pushed one."""
    party = get(app, auth_headers["dm"], "/api/play/party").get_json()["party"]
    assert "DM" not in [e["playerName"] for e in party]
    assert "Lotan" in [e["playerName"] for e in party]

    with server_module._app_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO character_statblocks (player_name, data, updated_at)"
            " VALUES ('DM', ?, '2026-08-26T00:00:00Z')",
            (json.dumps({"name": "DM Test Wizard", "derived": {"level": 5, "ac": 12,
                                                               "hp": {"max": 22}}}),),
        )
    party = get(app, auth_headers["dm"], "/api/play/party").get_json()["party"]
    dm = next(e for e in party if e["playerName"] == "DM")
    assert dm["character"] == "DM Test Wizard"
    assert dm["limits"]["maxHp"] == 22


def test_a_player_without_a_statblock_is_visibly_missing(app, auth_headers):
    """Absent is different from empty — the DM should see who has not pushed."""
    party = get(app, auth_headers["dm"], "/api/play/party").get_json()["party"]
    lotan = next(e for e in party if e["playerName"] == "Lotan")
    others = [e for e in party if e["playerName"] != "Lotan"]

    assert lotan["hasStatblock"] is True
    assert lotan["limits"]["maxHp"] == 21
    assert all(e["hasStatblock"] is False for e in others)


def test_the_party_reflects_play_state(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 8})
    post(app, auth_headers["player"], {"op": "addCondition", "condition": "prone"})

    party = get(app, auth_headers["dm"], "/api/play/party").get_json()["party"]
    lotan = next(e for e in party if e["playerName"] == "Lotan")
    assert lotan["state"]["hp"]["current"] == 13
    assert "prone" in lotan["state"]["conditions"]


def test_a_revoked_player_is_not_in_the_party(app, auth_headers, monkeypatch):
    from vos.routes import play as play_route
    monkeypatch.setattr(play_route, "REVOKED_PLAYERS", {"Orabella", "Kryton Novelli"})
    party = get(app, auth_headers["dm"], "/api/play/party").get_json()["party"]
    names = {entry["playerName"] for entry in party}
    assert "Orabella" not in names
    assert "Kryton Novelli" not in names


# ── Viewing as a player ───────────────────────────────────────────────

def test_the_dm_can_read_another_players_state(app, auth_headers):
    post(app, auth_headers["player"], {"op": "damage", "amount": 8})
    body = get(app, auth_headers["dm"], "/api/play?playerName=Lotan").get_json()
    assert body["playerName"] == "Lotan"
    assert body["state"]["hp"]["current"] == 13


def test_a_player_cannot_read_another_players_state(app, auth_headers):
    response = get(app, auth_headers["player"], '/api/play?playerName=Roxanya "Roxy"')
    assert response.status_code == 403
    assert response.get_json()["error_code"] == "forbidden_target"


def test_naming_yourself_is_still_your_own_state(app, auth_headers):
    body = get(app, auth_headers["player"], "/api/play?playerName=Lotan").get_json()
    assert body["playerName"] == "Lotan"


def test_the_sheet_endpoint_still_refuses_to_be_told_whose_it_is(app, auth_headers):
    """View-as reads /api/play and /api/sheets. /api/sheet stays sealed — it
    refuses a name outright, even the DM's, rather than growing a second way to
    reach another player's sheet."""
    response = get(app, auth_headers["dm"], '/api/sheet?playerName=Lotan')
    assert response.status_code == 403


def test_the_dm_can_read_another_players_log(app, auth_headers):
    """The player-refused case passed even while this was broken, so assert the
    DM path too rather than only the denial."""
    post(app, auth_headers["player"], {"op": "damage", "amount": 2})
    post(app, auth_headers["dm"], {"op": "heal", "amount": 1, "playerName": "Lotan"})

    body = get(app, auth_headers["dm"], "/api/play/log?playerName=Lotan").get_json()
    assert body["playerName"] == "Lotan"
    assert [(e["op"]["op"], e["appliedBy"]) for e in body["entries"]] == [
        ("heal", "DM"), ("damage", "Lotan")]


# ── Preparation ───────────────────────────────────────────────────────

PREPARED_BLOCK = {
    "vosExport": {"version": 1},
    "name": "DM Test Wizard",
    "system": {},
    "derived": {"level": 3, "prof": 2, "ac": 12, "hp": {"value": 20, "max": 20},
                "spells": {"spell1": {"value": 4, "max": 4}}},
    "items": [
        {"_id": "c1", "type": "spell", "name": "Fire Bolt", "system": {"level": 0, "prepared": 2}},
        {"_id": "s1", "type": "spell", "name": "Burning Hands", "system": {"level": 1, "prepared": 1}},
        {"_id": "s2", "type": "spell", "name": "Charm Person", "system": {"level": 1, "prepared": 0}},
        # An older export, to prove the previous shape still reads.
        {"_id": "s3", "type": "spell", "name": "Shield",
         "system": {"level": 1, "preparation": {"mode": "prepared", "prepared": True}}},
    ],
}


def test_preparation_is_seeded_from_foundry(app, auth_headers, server_module):
    """A character arrived with nothing prepared and the sheet said 0 of 6,
    while their real choices sat unread in the export."""
    with server_module._app_db() as conn:
        conn.execute("UPDATE character_statblocks SET data = ? WHERE player_name = 'Lotan'",
                     (json.dumps(PREPARED_BLOCK),))

    state = get(app, auth_headers["player"]).get_json()["state"]
    assert set(state["prepared"]) == {"c1", "s1", "s3"}   # not the unprepared one


def test_the_numeric_and_legacy_shapes_both_read(server_module):
    from vos.services.play_state import _spell_is_prepared

    assert _spell_is_prepared({"system": {"prepared": 2}}) is True    # always
    assert _spell_is_prepared({"system": {"prepared": 1}}) is True
    assert _spell_is_prepared({"system": {"prepared": 0}}) is False
    assert _spell_is_prepared({"system": {"preparation": {"prepared": True}}}) is True
    assert _spell_is_prepared({"system": {"preparation": {"mode": "always"}}}) is True
    assert _spell_is_prepared({"system": {"preparation": {"mode": "prepared"}}}) is False
    assert _spell_is_prepared({"system": {}}) is False


# ── Activatable features ──────────────────────────────────────────────

def test_activating_a_feature_spends_a_use_and_marks_it_on(app, auth_headers):
    body = post(app, auth_headers["player"],
                {"op": "activateFeature", "feature": "rage1", "name": "Rage", "max": 3}).get_json()

    assert body["state"]["uses"]["rage1"] == 1
    assert body["state"]["active"]["rage1"]["name"] == "Rage"
    assert body["state"]["active"]["rage1"]["startedAt"] > 0


def test_a_feature_cannot_be_activated_twice(app, auth_headers):
    post(app, auth_headers["player"], {"op": "activateFeature", "feature": "rage1", "name": "Rage", "max": 3})
    again = post(app, auth_headers["player"],
                 {"op": "activateFeature", "feature": "rage1", "name": "Rage", "max": 3})

    assert again.status_code == 409          # a refused op, not a malformed one
    assert "already active" in again.get_json()["error"]


def test_activating_stops_at_the_last_use(app, auth_headers):
    for _ in range(2):
        post(app, auth_headers["player"], {"op": "activateFeature", "feature": "r", "name": "Rage", "max": 2})
        post(app, auth_headers["player"], {"op": "endFeature", "feature": "r"})

    refused = post(app, auth_headers["player"],
                   {"op": "activateFeature", "feature": "r", "name": "Rage", "max": 2})
    assert refused.status_code == 409
    assert "No uses of Rage remaining" in refused.get_json()["error"]


def test_ending_a_feature_does_not_refund_the_use(app, auth_headers):
    """You spent it to start. Stopping early is not a mistake to be undone."""
    post(app, auth_headers["player"], {"op": "activateFeature", "feature": "r", "name": "Rage", "max": 3})
    body = post(app, auth_headers["player"], {"op": "endFeature", "feature": "r"}).get_json()

    assert body["state"]["active"] == {}
    assert body["state"]["uses"]["r"] == 1


def test_ending_a_feature_that_was_never_on_is_not_an_error(app, auth_headers):
    """Two phones at one table: the second tap should be a no-op, not a 400."""
    response = post(app, auth_headers["player"], {"op": "endFeature", "feature": "r"})
    assert response.status_code == 200
    assert response.get_json()["state"]["active"] == {}


@pytest.mark.parametrize("op", ["shortRest", "longRest", "fieldRest", "endCombat"])
def test_rests_and_the_end_of_a_fight_put_everything_down(app, auth_headers, op):
    post(app, auth_headers["player"], {"op": "activateFeature", "feature": "r", "name": "Rage", "max": 3})
    body = post(app, auth_headers["player"], {"op": op}).get_json()

    assert body["state"]["active"] == {}


def test_states_stored_before_this_field_existed_still_read(server_module):
    """Nobody's play state gets reset to add a key."""
    from vos.services.play_state import reconcile, apply_op

    old = {"hp": {"current": 10, "temp": 0}, "exhaustion": 0, "slots": {}, "pact": 0,
           "hitDiceSpent": 0, "uses": {}, "prepared": [], "conditions": [],
           "reaction": {"used": False, "assessUsed": False}, "concentration": None,
           "mask": None, "form": None, "items": [], "seededAt": None}

    assert reconcile(old, {"maxHp": 21})["active"] == {}
    state, _ = apply_op(old, {"op": "activateFeature", "feature": "r", "name": "Rage", "max": 3}, {})
    assert state["active"]["r"]["name"] == "Rage"
