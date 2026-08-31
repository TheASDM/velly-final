"""Attachments: what gets in, who can read it, and what happens to the
files nobody ever sent.

The security claims worth testing are all about the gap between what a file
says it is and what it decodes as, and about the fact that an unguessable
URL is not access control.
"""

import io
import urllib.parse

import pytest
from PIL import Image

from vos.routes import im as im_routes
from vos.routes import im_attachments as attach_routes


def _headers(server_module, name, is_dm=False):
    return {"Authorization": f"Bearer {server_module._issue_player_token(name, is_dm=is_dm)}"}


def _clear(server_module):
    with server_module._app_db() as conn:
        for table in ("chat_messages", "chat_reads", "chat_reactions",
                      "chat_typing", "player_presence", "chat_attachments"):
            conn.execute(f"DELETE FROM {table}")
    directory = attach_routes.ATTACHMENT_DIR
    if directory.exists():
        for path in directory.iterdir():
            path.unlink()


@pytest.fixture(autouse=True)
def clean(server_module):
    _clear(server_module)
    yield
    _clear(server_module)
    server_module.limiter.reset()


def png_bytes(width=40, height=30, colour=(200, 40, 40)):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def _upload(client, headers, data, filename, mimetype, thread_key="party"):
    return client.post(
        "/api/im/attachment",
        data={"threadKey": thread_key, "file": (io.BytesIO(data), filename, mimetype)},
        content_type="multipart/form-data",
        headers=headers,
    )


def _url(key):
    return "/api/im/thread/" + urllib.parse.quote(key, safe="")


# ── What gets in ──────────────────────────────────────────────────────

def test_an_image_upload_is_measured_and_thumbnailed(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        created = _upload(client, lotan, png_bytes(120, 90), "mill.png", "image/png")
    assert created.status_code == 201
    attachment = created.get_json()["attachment"]
    assert attachment["kind"] == "image"
    assert (attachment["width"], attachment["height"]) == (120, 90)
    assert attachment["filename"] == "mill.png"
    assert attachment["thumbUrl"].endswith("?thumb=1")
    assert (attach_routes.ATTACHMENT_DIR / f"{attachment['id']}.png").exists()
    assert (attach_routes.ATTACHMENT_DIR / f"{attachment['id']}.thumb.jpg").exists()


def test_a_pdf_is_accepted_but_never_given_a_thumbnail(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        created = _upload(client, lotan, PDF_BYTES, "ledger.pdf", "application/pdf")
    attachment = created.get_json()["attachment"]
    assert attachment["kind"] == "pdf"
    assert attachment["thumbUrl"] is None
    assert (attach_routes.ATTACHMENT_DIR / f"{attachment['id']}.pdf").exists()


def test_a_renamed_file_does_not_become_an_image(app, server_module):
    """The declared type is a claim; the magic bytes are a better one."""
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        refused = _upload(client, lotan, b"MZ\x90\x00 not an image at all",
                          "sneaky.png", "image/png")
    assert refused.status_code == 415
    assert "does not look like" in refused.get_json()["error"]


def test_a_riff_container_is_not_a_webp(app, server_module):
    """A .wav renamed .webp used to pass the handout check outright: the
    magic test was "RIFF" alone, and a WAV is a RIFF file."""
    wav = b"RIFF" + (36).to_bytes(4, "little") + b"WAVEfmt " + b"\x00" * 40
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        refused = _upload(client, lotan, wav, "sound.webp", "image/webp")
        handout = client.post(
            "/api/handouts/image",
            data={"image": (io.BytesIO(wav), "sound.webp", "image/webp")},
            content_type="multipart/form-data",
            headers=_headers(server_module, "DM", is_dm=True),
        )
    assert refused.status_code == 415
    assert handout.status_code == 415


def test_a_truncated_png_survives_the_magic_test_and_fails_the_decode(app, server_module):
    """Exactly the gap a header check leaves open."""
    broken = png_bytes()[:24]
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        refused = _upload(client, lotan, broken, "half.png", "image/png")
    assert refused.status_code == 415
    assert "decode" in refused.get_json()["error"]


def test_the_pixel_cap_is_enforced_on_decode(server_module, monkeypatch):
    from vos.services import uploads

    monkeypatch.setattr(uploads, "MAX_IMAGE_PIXELS", 1000)
    with pytest.raises(uploads.UploadRejected) as rejected:
        uploads.decode_image(png_bytes(100, 100), ".png")
    assert rejected.value.status == 413


def test_other_types_are_refused(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        for data, name, mime in (
            (b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "x.svg", "image/svg+xml"),
            (b"#!/bin/sh\necho hi\n", "x.sh", "text/x-shellscript"),
            (b"PK\x03\x04", "x.zip", "application/zip"),
        ):
            assert _upload(client, lotan, data, name, mime).status_code == 415


def test_a_non_member_cannot_upload_into_a_thread(app, server_module):
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        refused = _upload(client, dm, png_bytes(), "x.png", "image/png",
                          thread_key='Lotan|Roxanya "Roxy"')
    assert refused.status_code == 403


# ── Sending them ──────────────────────────────────────────────────────

def test_upload_then_send_attaches_the_files(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "a.png", "image/png").get_json()["attachment"]
        two = _upload(client, lotan, PDF_BYTES, "b.pdf", "application/pdf").get_json()["attachment"]
        sent = client.post(_url("party"), json={"body": "Both of these.",
                                                "attachments": [one["id"], two["id"]]},
                           headers=lotan)
        assert sent.status_code == 201
        assert [a["id"] for a in sent.get_json()["message"]["attachments"]] == \
            [one["id"], two["id"]]
        fetched = client.get(_url("party"), headers=lotan).get_json()["messages"]
    assert [a["kind"] for a in fetched[0]["attachments"]] == ["image", "pdf"]


def test_a_picture_with_no_caption_is_still_a_message(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "a.png", "image/png").get_json()["attachment"]
        sent = client.post(_url("party"), json={"attachments": [one["id"]]}, headers=lotan)
        assert sent.status_code == 201
        assert sent.get_json()["message"]["body"] == ""
        # Nothing at all still is not.
        assert client.post(_url("party"), json={}, headers=lotan).status_code == 400


def test_you_cannot_send_someone_elses_upload(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    with app.test_client() as client:
        theirs = _upload(client, roxy, png_bytes(), "a.png", "image/png").get_json()["attachment"]
        refused = client.post(_url("party"),
                              json={"body": "Mine now", "attachments": [theirs["id"]]},
                              headers=lotan)
    assert refused.status_code == 400
    # And the failed send left no stub behind.
    with server_module._app_db() as conn:
        assert conn.execute(
            "SELECT COUNT(*) AS n FROM chat_messages").fetchone()["n"] == 0


def test_an_upload_cannot_be_sent_twice_or_into_another_thread(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "a.png", "image/png").get_json()["attachment"]
        assert client.post(_url("party"), json={"attachments": [one["id"]]},
                           headers=lotan).status_code == 201
        assert client.post(_url("party"), json={"attachments": [one["id"]]},
                           headers=lotan).status_code == 400
        two = _upload(client, lotan, png_bytes(), "b.png", "image/png").get_json()["attachment"]
        assert client.post(_url("DM|Lotan"), json={"attachments": [two["id"]]},
                           headers=lotan).status_code == 400


def test_there_is_a_cap_on_files_per_message(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        ids = [_upload(client, lotan, png_bytes(), f"{n}.png", "image/png")
               .get_json()["attachment"]["id"]
               for n in range(attach_routes.ATTACHMENTS_PER_MESSAGE + 1)]
        refused = client.post(_url("party"), json={"attachments": ids}, headers=lotan)
    assert refused.status_code == 400


# ── Reading them ──────────────────────────────────────────────────────

def test_only_members_of_the_thread_can_read_a_file(app, server_module):
    lotan = _headers(server_module, "Lotan")
    roxy = _headers(server_module, 'Roxanya "Roxy"')
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "a.png", "image/png",
                      thread_key='Lotan|Roxanya "Roxy"').get_json()["attachment"]
        client.post(_url('Lotan|Roxanya "Roxy"'),
                    json={"attachments": [one["id"]]}, headers=lotan)

        assert client.get(one["url"], headers=lotan).status_code == 200
        assert client.get(one["url"], headers=roxy).status_code == 200
        # The DM is not a member of a player pair, and neither is anonymous.
        assert client.get(one["url"], headers=dm).status_code == 404
        assert client.get(one["url"]).status_code == 404


def test_an_unsent_upload_is_still_only_readable_by_its_thread(app, server_module):
    """thread_key is bound at upload time precisely so this check exists
    before any message carries the file."""
    lotan = _headers(server_module, "Lotan")
    dm = _headers(server_module, "DM", is_dm=True)
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "a.png", "image/png",
                      thread_key='Lotan|Roxanya "Roxy"').get_json()["attachment"]
        assert client.get(one["url"], headers=lotan).status_code == 200
        assert client.get(one["url"], headers=dm).status_code == 404


def test_a_pdf_is_handed_over_rather_than_rendered(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, PDF_BYTES, "ledger.pdf",
                      "application/pdf").get_json()["attachment"]
        served = client.get(one["url"], headers=lotan)
    assert served.status_code == 200
    assert served.headers["Content-Disposition"].startswith("attachment")
    assert "ledger.pdf" in served.headers["Content-Disposition"]
    assert served.headers["X-Content-Type-Options"] == "nosniff"


def test_the_thumbnail_is_smaller_than_the_original(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(1400, 1000), "big.png",
                      "image/png").get_json()["attachment"]
        full = client.get(one["url"], headers=lotan)
        thumb = client.get(one["url"] + "?thumb=1", headers=lotan)
    assert thumb.status_code == 200
    assert thumb.mimetype == "image/jpeg"
    assert len(thumb.data) < len(full.data)


def test_a_made_up_id_is_a_404_not_a_hint(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        assert client.get("/api/im/attachment/" + "a" * 32, headers=lotan).status_code == 404
        assert client.get("/api/im/attachment/../../etc/passwd",
                          headers=lotan).status_code == 404


# ── Housekeeping ──────────────────────────────────────────────────────

def test_uploads_nobody_ever_sent_are_swept(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        orphan = _upload(client, lotan, png_bytes(), "a.png",
                         "image/png").get_json()["attachment"]
        kept = _upload(client, lotan, png_bytes(), "b.png",
                       "image/png").get_json()["attachment"]
        client.post(_url("party"), json={"attachments": [kept["id"]]}, headers=lotan)

        with server_module._app_db() as conn:
            conn.execute(
                "UPDATE chat_attachments SET created_at = ? WHERE message_id IS NULL",
                (server_module._utc_now_iso_in(-(attach_routes.ATTACHMENT_ORPHAN_SECONDS + 60)),),
            )
        # The next upload sweeps on its way past.
        _upload(client, lotan, png_bytes(), "c.png", "image/png")

    with server_module._app_db() as conn:
        remaining = {row["id"] for row in
                     conn.execute("SELECT id FROM chat_attachments")}
    assert orphan["id"] not in remaining
    assert kept["id"] in remaining
    assert not (attach_routes.ATTACHMENT_DIR / f"{orphan['id']}.png").exists()
    assert (attach_routes.ATTACHMENT_DIR / f"{kept['id']}.png").exists()


def test_a_deleted_message_stops_showing_its_files(app, server_module):
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "a.png", "image/png").get_json()["attachment"]
        sent = client.post(_url("party"), json={"body": "Look",
                                                "attachments": [one["id"]]},
                           headers=lotan).get_json()["message"]
        client.delete(f"/api/im/message/{sent['id']}", headers=lotan)
        fetched = client.get(_url("party"), headers=lotan).get_json()["messages"]
    assert fetched[0]["deleted"] is True
    assert fetched[0]["attachments"] == []


def test_enzo_keeps_files_on_the_message_but_never_sees_them(app, server_module, monkeypatch):
    seen = {}

    def chat_stream(message, history, rules=False, vibe=None, viewer=None):
        seen["message"] = message
        seen["history"] = history
        yield {"type": "token", "text": "Noted."}

    monkeypatch.setattr(im_routes.engine, "chat_stream", chat_stream)
    monkeypatch.setattr(im_routes, "_push_config_error", lambda: "no push in tests")

    lotan = _headers(server_module, "Lotan")
    key = server_module._enzo_thread_key("Lotan")
    with app.test_client() as client:
        one = _upload(client, lotan, png_bytes(), "map.png", "image/png",
                      thread_key=key).get_json()["attachment"]
        response = client.post(
            "/api/im/thread/" + urllib.parse.quote(key, safe="") + "/enzo",
            json={"body": "What is this?", "attachments": [one["id"]]}, headers=lotan)
        response.get_data()
        stored = client.get(_url(key), headers=lotan).get_json()["messages"]
    assert [a["id"] for a in stored[0]["attachments"]] == [one["id"]]
    # The model was handed the words only.
    assert seen["message"] == "What is this?"
    assert "map.png" not in str(seen)


def test_files_keep_the_order_they_were_picked_in(app, server_module):
    """Uploads run concurrently, so arrival order is not intent."""
    lotan = _headers(server_module, "Lotan")
    with app.test_client() as client:
        ids = [_upload(client, lotan, png_bytes(), f"{n}.png", "image/png")
               .get_json()["attachment"]["id"] for n in range(3)]
        picked = [ids[2], ids[0], ids[1]]
        client.post(_url("party"), json={"attachments": picked}, headers=lotan)
        fetched = client.get(_url("party"), headers=lotan).get_json()["messages"]
    assert [a["id"] for a in fetched[0]["attachments"]] == picked
