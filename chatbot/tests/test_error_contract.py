"""API error responses are JSON with error + error_code — never HTML, never
exception text."""


def test_api_404_is_json(app):
    with app.test_client() as client:
        response = client.get("/api/no-such-endpoint")
    assert response.status_code == 404
    data = response.get_json()
    assert data["error_code"] == "not_found"


def test_api_405_is_json(app):
    with app.test_client() as client:
        response = client.delete("/api/auth/config")
    assert response.status_code == 405
    data = response.get_json()
    assert data["error_code"] == "method_not_allowed"


def test_non_api_404_stays_default(app):
    with app.test_client() as client:
        response = client.get("/no-such-page")
    assert response.status_code == 404
    assert response.get_json(silent=True) is None
