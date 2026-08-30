"""Gallery pin: the wiki-append helper and the pin route's write confinement.

The append helper once referenced regexes that were defined nowhere, so every
pin that reached the existing-Gallery-section branch 500ed with a NameError —
these tests execute both branches for real. The route tests pin at repo-root
markdown (reachable as /en/<rel>/ but outside the wiki content roots), which
must read as "no such page", never as a writable target.
"""

import json
import os


def test_append_creates_gallery_section(tmp_path, server_module):
    page = tmp_path / "page.md"
    page.write_text("# A Page\n\nBody text.\n", encoding="utf-8")

    modified = server_module._append_image_to_wiki_gallery(
        page, "/api/gallery/image/a.png", "An image", "gal-1", "Lotan"
    )
    assert modified is True
    text = page.read_text(encoding="utf-8")
    assert "## Gallery" in text
    assert "![An image](/api/gallery/image/a.png)" in text

    # Idempotent on the image URL.
    assert (
        server_module._append_image_to_wiki_gallery(
            page, "/api/gallery/image/a.png", "An image", "gal-1", "Lotan"
        )
        is False
    )


def test_append_inserts_inside_existing_gallery_section(tmp_path, server_module):
    page = tmp_path / "page.md"
    page.write_text(
        "# A Page\n\n## Gallery\n\n![old](/api/gallery/image/old.png)\n\n"
        "## History\n\nAfterwards.\n",
        encoding="utf-8",
    )

    modified = server_module._append_image_to_wiki_gallery(
        page, "/api/gallery/image/new.png", "New image", "gal-2", "DM"
    )
    assert modified is True
    text = page.read_text(encoding="utf-8")
    new_pos = text.index("/api/gallery/image/new.png")
    assert text.index("## Gallery") < new_pos < text.index("## History")


def test_content_roots_helper(server_module):
    root = server_module.SITE_SOURCE_DIR
    assert server_module._wiki_source_in_content_roots(root / "Venturia" / "index.md")
    assert server_module._wiki_source_in_content_roots(root / "Articles" / "foo.md")
    assert not server_module._wiki_source_in_content_roots(root / "README.md")
    assert not server_module._wiki_source_in_content_roots(
        root / "node_modules" / "x" / "README.md"
    )
    assert not server_module._wiki_source_in_content_roots(root.parent / "outside.md")


def _seed_gallery_entry(server_module, entry):
    manifest = server_module.GALLERY_MANIFEST
    os.makedirs(manifest.parent, exist_ok=True)
    entries = server_module._load_manifest()
    entries = [e for e in entries if e.get("id") != entry["id"]] + [entry]
    with open(manifest, "w", encoding="utf-8") as handle:
        json.dump(entries, handle)


def test_pin_refuses_targets_outside_content_roots(app, server_module, auth_headers):
    _seed_gallery_entry(
        server_module,
        {
            "id": "pin-test-1",
            "filename": "pin-test-1.png",
            "visibility": "shared",
            "created_by": "Lotan",
        },
    )
    # README.md exists at repo root and resolves as /en/README/, but it is not
    # a wiki page — for the creator and for the DM alike this must 404.
    for role in ("player", "dm"):
        with app.test_client() as client:
            response = client.post(
                "/api/gallery/pin-test-1/pin",
                json={"wiki_url": "/en/README/"},
                headers=auth_headers[role],
            )
        assert response.status_code == 404, role
        assert response.get_json()["error_code"] == "not_found"


def test_pin_requires_creator_or_dm(app, server_module, auth_headers):
    _seed_gallery_entry(
        server_module,
        {
            "id": "pin-test-2",
            "filename": "pin-test-2.png",
            "visibility": "shared",
            "created_by": "Somebody Else",
        },
    )
    with app.test_client() as client:
        response = client.post(
            "/api/gallery/pin-test-2/pin",
            json={"wiki_url": "/en/Venturia/"},
            headers=auth_headers["player"],
        )
    assert response.status_code == 403
