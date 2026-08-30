"""The DM dashboard aggregate, the per-event RSVP embed, and the live
wiki-pages index."""


def _create_event(app, auth_headers, date="2099-02-03"):
    with app.test_client() as client:
        response = client.post(
            "/api/calendar/events",
            json={"date": date, "title": "Dashboard Session", "kind": "session"},
            headers=auth_headers["dm"],
        )
    assert response.status_code == 201
    return response.get_json()["event"]["id"]


def _delete_event(app, auth_headers, event_id):
    with app.test_client() as client:
        client.delete(f"/api/calendar/events/{event_id}", headers=auth_headers["dm"])


def _seed_rsvp(server_module, event_id, player, status):
    with server_module._app_db() as conn:
        conn.execute(
            """
            INSERT INTO rsvps (event_id, player_name, status, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(event_id, player_name) DO UPDATE SET
                status = excluded.status, updated_at = excluded.updated_at
            """,
            (f"cal-{event_id}", player, status, server_module._utc_now_iso()),
        )


def _clear_rsvps(server_module, event_id):
    with server_module._app_db() as conn:
        conn.execute("DELETE FROM rsvps WHERE event_id = ?", (f"cal-{event_id}",))


def test_dashboard_aggregates_in_one_call(app, server_module, auth_headers):
    event_id = _create_event(app, auth_headers)
    _seed_rsvp(server_module, event_id, "Lotan", "going")
    try:
        with app.test_client() as client:
            response = client.get("/api/admin/dashboard", headers=auth_headers["dm"])
        assert response.status_code == 200
        data = response.get_json()
        assert data["gathering"]["title"] == "Dashboard Session"
        assert data["rsvp"]["counts"]["going"] == 1
        assert "Lotan" not in data["rsvp"]["missing"]
        # Roster names come from _data/players.json — everyone who hasn't
        # responded is listed as missing.
        assert len(data["rsvp"]["missing"]) >= 1
        assert isinstance(data["availability"]["submitted"], list)
        assert isinstance(data["lore"]["pending"], int)
        assert isinstance(data["push"]["subscribed"], list)
        assert "state" in data["rebuild"]
    finally:
        _clear_rsvps(server_module, event_id)
        _delete_event(app, auth_headers, event_id)


def test_calendar_events_embed_rsvps_for_dm_only(app, server_module, auth_headers):
    event_id = _create_event(app, auth_headers, date="2099-03-04")
    _seed_rsvp(server_module, event_id, "Lotan", "maybe")
    try:
        query = "?from=2099-03-01&to=2099-03-08"
        with app.test_client() as client:
            dm_view = client.get(f"/api/calendar/events{query}", headers=auth_headers["dm"])
            player_view = client.get(
                f"/api/calendar/events{query}", headers=auth_headers["player"]
            )
        dm_event = next(e for e in dm_view.get_json()["events"] if e["id"] == event_id)
        assert dm_event["rsvp"]["counts"]["maybe"] == 1
        assert dm_event["rsvp"]["responses"][0]["player_name"] == "Lotan"
        player_event = next(
            e for e in player_view.get_json()["events"] if e["id"] == event_id
        )
        assert "rsvp" not in player_event
    finally:
        _clear_rsvps(server_module, event_id)
        _delete_event(app, auth_headers, event_id)


def test_wiki_pages_lists_live_source_tree(app, auth_headers):
    with app.test_client() as client:
        response = client.get("/api/admin/wiki-pages", headers=auth_headers["dm"])
    assert response.status_code == 200
    pages = response.get_json()["pages"]
    assert pages, "the content roots contain pages"
    urls = {page["url"] for page in pages}
    # Every page is inside the editable content roots, and the DM tree is
    # included (the public build index excludes it).
    assert all(u.startswith("/en/") for u in urls)
    assert any(u.startswith("/en/Venturia/") for u in urls)
    for page in pages:
        assert page["title"]
