"""The session chronicler: the parts that can be wrong quietly.

Three failure modes are worth pinning down here, because none of them show up
as an error at the time:

  * a {{ART:n}} placeholder that outlives the art moment it named renders as
    literal braces on a published page
  * a proposed wiki edit that arrives pre-approved, or that targets a page the
    drafter invented, writes a session's aftermath onto the wrong file
  * a publish that writes outside the wiki content roots

Publishing is exercised against a temporary site tree rather than the real
repo — the module reads SITE_SOURCE_DIR from its own globals, so that is what
gets pointed elsewhere.
"""

import json

import pytest


# ── Sanitizers ───────────────────────────────────────────────────────────────

def test_art_moments_are_renumbered_and_clamped(server_module):
    art = server_module._sanitize_chronicle_art(
        [
            {"slot": 0, "prompt": "A", "style": "valley-place", "caption": "one"},
            {"slot": 4, "prompt": "", "style": "valley-scene"},          # no prompt
            {"slot": 7, "prompt": "B", "style": "not-a-real-style"},
            {"slot": 9, "prompt": "C"},
        ],
        limit=2,
    )
    assert [item["slot"] for item in art] == [1, 2]
    assert art[0]["style"] == "valley-place"
    # An unknown style falls back to the house default rather than reaching
    # the image API as a bare word.
    assert art[1]["style"] == server_module.DEFAULT_STYLE_KEY
    assert all(item["status"] == "pending" for item in art)


def test_placeholders_follow_the_art_that_survived(server_module):
    art = server_module._sanitize_chronicle_art(
        [
            {"slot": 3, "prompt": "kept"},
            {"slot": 5, "prompt": ""},      # dropped: no prompt
            {"slot": 8, "prompt": "kept too"},
        ],
        limit=4,
    )
    body = "Intro\n\n{{ART:3}}\n\nMiddle\n\n{{ART:5}}\n\nEnd\n\n{{ART:8}}\n"
    renumbered = server_module._renumber_art_placeholders(body, art)
    assert "{{ART:1}}" in renumbered
    assert "{{ART:2}}" in renumbered
    # The dropped moment's placeholder is removed, not left to render as text.
    assert "{{ART:5}}" not in renumbered
    assert "{{ART:3}}" not in renumbered


def test_proposed_updates_arrive_unapproved_and_targeted(server_module):
    known = {"/en/Venturia/Characters/NPCs/real/"}
    updates = server_module._sanitize_chronicle_updates(
        [
            {
                "action": "append",
                "target_url": "/en/Venturia/Characters/NPCs/real",
                "title": "Real",
                "markdown": "What changed.",
                "approved": True,          # the model does not get a vote
            },
            {
                "action": "append",
                "target_url": "/en/Venturia/Characters/NPCs/invented/",
                "title": "Invented",
                "markdown": "Something.",
            },
            {"action": "append", "target_url": "../../etc/passwd", "markdown": "x"},
            {
                "action": "create",
                "kind": "person",
                "title": "A New Face",
                "markdown": "Who they are.",
            },
            {"action": "create", "kind": "spaceship", "title": "No", "markdown": "x"},
        ],
        known,
    )
    assert [u["action"] for u in updates] == ["append", "create"]
    assert updates[0]["target_url"] == "/en/Venturia/Characters/NPCs/real/"
    assert updates[0]["section"] == "Aftermath"
    assert all(u["approved"] is False for u in updates)
    assert updates[1]["slug"] == "a-new-face"


def test_threads_and_in_play_are_bounded(server_module):
    threads = server_module._sanitize_chronicle_threads([
        {"question": "What now?", "status": "screaming", "tag": "Fog"},
        {"question": "", "status": "hot"},
    ])
    assert len(threads) == 1
    assert threads[0]["status"] == "pending"

    in_play = server_module._sanitize_chronicle_in_play([
        {"name": "Maruk Grommarg", "role": "Missing", "kind": "NPC"},
        {"name": ""},
    ])
    assert len(in_play) == 1
    assert in_play[0]["emblem"] == "MG"


# ── Placing the art at publish time ──────────────────────────────────────────

def test_leftover_art_lands_in_a_gallery(server_module):
    art = [
        {"slot": 1, "caption": "The arrival", "site_url": "/images/chronicles/x-1.png"},
        {"slot": 2, "caption": "Nobody asked for this", "site_url": "/images/chronicles/x-2.png"},
    ]
    body = server_module._place_chronicle_art("# T\n\n{{ART:1}}\n\nText.\n", art, "T")
    assert "![The arrival](/images/chronicles/x-1.png)" in body
    assert "*The arrival*" in body
    # Slot 2 had no placeholder, so it is appended rather than dropped.
    assert "## Gallery" in body
    assert "/images/chronicles/x-2.png" in body
    assert "{{ART:" not in body


# ── A temporary site tree ────────────────────────────────────────────────────

@pytest.fixture
def site(tmp_path, server_module, monkeypatch):
    """Point every module that writes wiki files at a scratch tree."""
    root = tmp_path / "site"
    (root / "Session-Chronicles").mkdir(parents=True)
    (root / "Venturia" / "Characters" / "NPCs").mkdir(parents=True)
    (root / "Session-Chronicles" / "index.md").write_text(
        "---\ntitle: Session Chronicles\n---\n\n# Session Chronicles\n\n"
        "No chronicles have been recorded yet. The first session recap will appear here.\n",
        encoding="utf-8",
    )
    (root / "Venturia" / "Characters" / "NPCs" / "real.md").write_text(
        "---\ntitle: \"Real Person\"\ndescription: \"d\"\n---\n\n# Real Person\n\nBody.\n",
        encoding="utf-8",
    )
    import vos.services.chronicle_publish as publish_module
    import vos.services.wiki_render as render_module
    import vos.services.wiki_source as source_module

    for module in (publish_module, render_module, source_module):
        monkeypatch.setattr(module, "SITE_SOURCE_DIR", root, raising=False)
    monkeypatch.setattr(
        publish_module, "CAMPAIGN_STATE_PATH", root / "_data" / "campaign-state.json",
        raising=False,
    )
    return root


def _insert_chronicle(server_module, chronicle_id, **overrides):
    row = {
        "session_number": "Session 3",
        "session_date": "2026-08-30",
        "title": "The Long Way Down",
        "slug": "the-long-way-down",
        "raw_notes": "Notes about the session." * 4,
        "art_count": 1,
        "draft_markdown": "# The Long Way Down\n\nThey went down.\n\n{{ART:1}}\n",
        "draft_summary": "They went down, and something followed.",
        "recap": "The party went down and something followed them back up.",
        "art_json": json.dumps([{
            "slot": 1, "caption": "The descent", "prompt": "p",
            "style": "valley-scene", "status": "done",
            "filename": f"{chronicle_id}-1.png",
        }]),
        "updates_json": json.dumps([
            {
                "id": "u1", "action": "append",
                "target_url": "/en/Venturia/Characters/NPCs/real/",
                "title": "Real Person", "section": "After the descent",
                "markdown": "They were seen at the bottom of the stair.",
                "approved": False, "result": None,
            },
            {
                "id": "u2", "action": "append",
                "target_url": "/en/Venturia/Characters/NPCs/real/",
                "title": "Real Person", "section": "Never approved",
                "markdown": "This paragraph must not reach the wiki.",
                "approved": False, "result": None,
            },
        ]),
        "threads_json": json.dumps([
            {"question": "What followed them?", "status": "hot", "tag": "The stair"}
        ]),
        "in_play_json": json.dumps([]),
    }
    row.update(overrides)
    now = server_module._utc_now_iso()
    with server_module._app_db() as conn:
        conn.execute(
            """
            INSERT INTO session_chronicles (
                id, created_by, session_number, session_date, title, slug,
                raw_notes, art_count, status, stage, draft_markdown,
                draft_summary, recap, art_json, updates_json, threads_json,
                in_play_json, created_at, updated_at
            ) VALUES (?, 'DM', ?, ?, ?, ?, ?, ?, 'needs_review', 'Ready', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chronicle_id, row["session_number"], row["session_date"],
                row["title"], row["slug"], row["raw_notes"], row["art_count"],
                row["draft_markdown"], row["draft_summary"], row["recap"],
                row["art_json"], row["updates_json"], row["threads_json"],
                row["in_play_json"], now, now,
            ),
        )
    return row


def test_publish_writes_the_page_index_and_only_approved_updates(server_module, site):
    chronicle_id = "chronicle-publish-test-1"
    _insert_chronicle(server_module, chronicle_id)
    art_path = server_module._chronicle_art_path(chronicle_id, 1)
    art_path.parent.mkdir(parents=True, exist_ok=True)
    art_path.write_bytes(b"\x89PNG\r\n\x1a\n fake")

    payload, status = server_module._publish_chronicle(chronicle_id, {
        "approved_updates": ["u1"],
        "auto_rebuild": False,
    })
    assert status == 200, payload
    assert payload["url"] == "/en/Session-Chronicles/the-long-way-down/"

    page = (site / "Session-Chronicles" / "the-long-way-down.md").read_text(encoding="utf-8")
    assert page.startswith("---\n")
    assert "title: \"The Long Way Down\"" in page
    assert "![The descent](/images/chronicles/the-long-way-down-1.png)" in page
    assert "{{ART:" not in page
    assert (site / "images" / "chronicles" / "the-long-way-down-1.png").exists()

    index = (site / "Session-Chronicles" / "index.md").read_text(encoding="utf-8")
    assert "No chronicles have been recorded yet" not in index
    assert "/en/Session-Chronicles/the-long-way-down/" in index

    npc = (site / "Venturia" / "Characters" / "NPCs" / "real.md").read_text(encoding="utf-8")
    assert "They were seen at the bottom of the stair." in npc
    assert "## After the descent" in npc
    # The attribution is what answers "when did we learn this" later.
    assert "[The Long Way Down](/en/Session-Chronicles/the-long-way-down/)" in npc
    # The update nobody approved never reached the page.
    assert "This paragraph must not reach the wiki." not in npc

    state = json.loads((site / "_data" / "campaign-state.json").read_text(encoding="utf-8"))
    assert state["latestSession"]["link"] == "/en/Session-Chronicles/the-long-way-down/"
    assert state["latestSession"]["number"] == "Session 3"
    assert state["openThreads"][0]["tag"] == "The stair"

    with server_module._app_db() as conn:
        row = server_module._chronicle_row(conn, chronicle_id)
    assert row["status"] == "published"
    assert row["published_url"] == "/en/Session-Chronicles/the-long-way-down/"


def test_publishing_twice_refuses_without_overwrite(server_module, site):
    chronicle_id = "chronicle-publish-test-2"
    _insert_chronicle(server_module, chronicle_id, slug="second-descent")
    first, status = server_module._publish_chronicle(chronicle_id, {"auto_rebuild": False})
    assert status == 200, first
    _payload, status = server_module._publish_chronicle(chronicle_id, {"auto_rebuild": False})
    assert status == 409


def test_appends_outside_the_content_roots_are_refused(server_module, site):
    # README.md resolves as /en/README/ but is not an editable wiki page.
    result = server_module._apply_chronicle_append(
        {
            "target_url": "/en/README/",
            "section": "Aftermath",
            "markdown": "Should never be written.",
        },
        "A Chronicle",
        "/en/Session-Chronicles/a-chronicle/",
    )
    assert result["ok"] is False


def test_creating_a_page_uses_the_lore_directory_map(server_module, site):
    (site / "Venturia" / "Characters" / "NPCs" / "index.md").write_text(
        "---\ntitle: NPCs\n---\n\n# NPCs\n\n- **[Someone](/en/Venturia/Characters/NPCs/someone)** — x\n",
        encoding="utf-8",
    )
    result = server_module._apply_chronicle_create(
        {
            "kind": "person",
            "title": "The Stairwell Man",
            "slug": "the-stairwell-man",
            "summary": "Seen once, at the bottom.",
            "markdown": "Nobody caught his name.",
        },
        "The Long Way Down",
        "/en/Session-Chronicles/the-long-way-down/",
    )
    assert result["ok"] is True
    page = (site / "Venturia" / "Characters" / "NPCs" / "the-stairwell-man.md")
    assert page.exists()
    text = page.read_text(encoding="utf-8")
    assert "# The Stairwell Man" in text
    assert "First recorded in [The Long Way Down]" in text


# ── Gating ───────────────────────────────────────────────────────────────────

def test_players_cannot_create_a_chronicle(app, auth_headers):
    with app.test_client() as client:
        response = client.post(
            "/api/admin/chronicles",
            json={"notes": "A" * 200},
            headers=auth_headers["player"],
        )
    assert response.status_code == 403


def test_short_notes_are_refused(app, auth_headers):
    with app.test_client() as client:
        response = client.post(
            "/api/admin/chronicles",
            json={"notes": "too short"},
            headers=auth_headers["dm"],
        )
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "invalid"
