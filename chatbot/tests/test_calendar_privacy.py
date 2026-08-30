"""Anonymous calendar reads must not carry the DM's notes or the location.

The calendar endpoints are deliberately public (the app shell renders before
sign-in), but location and DM notes are for the table — a signed-in player or
DM gets them, the open web gets the same shape with those fields blank. The
per-event ICS is fetched by calendar apps without auth, so it keeps location
(the point of importing the event) but never the notes.
"""


def _create_event(app, auth_headers):
    with app.test_client() as client:
        response = client.post(
            "/api/calendar/events",
            json={
                "date": "2099-01-02",
                "title": "Test Session",
                "kind": "session",
                "location": "The cellar under the Song and Supper",
                "notes": "DM prep: ambush at the gatehouse",
            },
            headers=auth_headers["dm"],
        )
    assert response.status_code == 201
    return response.get_json()["event"]["id"]


def _delete_event(app, auth_headers, event_id):
    with app.test_client() as client:
        client.delete(f"/api/calendar/events/{event_id}", headers=auth_headers["dm"])


def test_calendar_private_fields_scoped_to_signed_in_readers(app, auth_headers):
    event_id = _create_event(app, auth_headers)
    try:
        query = "?from=2099-01-01&to=2099-01-03"
        with app.test_client() as client:
            anon = client.get(f"/api/calendar/events{query}")
            player = client.get(
                f"/api/calendar/events{query}", headers=auth_headers["player"]
            )
            google_dm = client.get(
                f"/api/calendar/events{query}", headers=auth_headers["google_dm"]
            )

        anon_event = next(
            e for e in anon.get_json()["events"] if e["id"] == event_id
        )
        assert anon_event["location"] == ""
        assert anon_event["notes"] == ""
        assert anon_event["title"] == "Test Session"

        for response in (player, google_dm):
            event = next(
                e for e in response.get_json()["events"] if e["id"] == event_id
            )
            assert event["location"] == "The cellar under the Song and Supper"
            assert event["notes"] == "DM prep: ambush at the gatehouse"
    finally:
        _delete_event(app, auth_headers, event_id)


def test_calendar_ics_keeps_location_but_never_notes(app, auth_headers):
    event_id = _create_event(app, auth_headers)
    try:
        with app.test_client() as client:
            response = client.get(f"/api/calendar/events/{event_id}.ics")
        assert response.status_code == 200
        text = response.get_data(as_text=True)
        assert "ambush" not in text.lower()
        assert "LOCATION:The cellar under the Song and Supper" in text
    finally:
        _delete_event(app, auth_headers, event_id)
