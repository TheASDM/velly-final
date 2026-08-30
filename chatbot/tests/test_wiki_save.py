"""Wiki save confinement and frontmatter validation.

Every repo-root .md resolves as /en/<rel>/, so without the content-root gate
README.md, CLAUDE.md, and node_modules docs were writable through the API.
Broken frontmatter used to save fine and then fail the async build silently.
"""

VALID_PAGE = "---\ntitle: \"A Page\"\ndescription: \"d\"\ntags: test\n---\n\n# A Page\n"


def _put(app, auth_headers, url, content):
    with app.test_client() as client:
        return client.put(
            "/api/admin/wiki-entry",
            json={"url": url, "content": content},
            headers=auth_headers["dm"],
        )


def test_saves_outside_content_roots_are_refused(app, auth_headers):
    # README.md exists at repo root and resolves as /en/README/ — the gate
    # must answer "no such page", and must not write.
    response = _put(app, auth_headers, "/en/README/", VALID_PAGE)
    assert response.status_code == 404


def test_reads_outside_content_roots_are_refused(app, auth_headers):
    with app.test_client() as client:
        response = client.get(
            "/api/admin/wiki-entry?url=/en/README/", headers=auth_headers["dm"]
        )
    assert response.status_code == 404


def test_broken_yaml_is_refused_at_save_time(app, auth_headers):
    broken = "---\ntitle: \"unclosed\ndescription: [\n---\n\nbody\n"
    response = _put(app, auth_headers, "/en/Venturia/", broken)
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "invalid_frontmatter"


def test_missing_title_is_refused(app, auth_headers):
    no_title = "---\ndescription: \"d\"\n---\n\nbody\n"
    response = _put(app, auth_headers, "/en/Venturia/", no_title)
    assert response.status_code == 400
    assert "title" in response.get_json()["error"]


def test_missing_frontmatter_is_refused(app, auth_headers):
    response = _put(app, auth_headers, "/en/Venturia/", "# Just a heading\n")
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "invalid_frontmatter"


def test_validator_accepts_a_normal_page(server_module):
    assert server_module._validate_wiki_frontmatter(VALID_PAGE) is None
