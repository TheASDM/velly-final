from pathlib import Path

from campaign_lib.chunking import chunk_text, emit_chunks
from campaign_lib.frontmatter import parse_frontmatter
from campaign_lib.wiki import first_heading, iter_published_markdown, normalize_aliases


def test_frontmatter_and_alias_helpers():
    metadata, body = parse_frontmatter(
        "---\ntitle: 'A Page'\npublished: false\naliases:\n  - One\n  - Two\n---\n# Body\n"
    )

    assert metadata == {
        "title": "A Page",
        "published": False,
        "aliases": ["One", "Two"],
    }
    assert body == "# Body\n"
    assert normalize_aliases("One, Two") == ["One", "Two"]
    assert first_heading(body) == "Body"


def test_published_markdown_walk_is_stable_and_safe(tmp_path: Path):
    wiki = tmp_path / "Wiki"
    wiki.mkdir()
    (wiki / "b.md").write_text("---\ntitle: B\n---\nB body", encoding="utf-8")
    (wiki / "a.md").write_text("---\ntitle: A\npublished: true\n---\nA body", encoding="utf-8")
    (wiki / "draft.md").write_text(
        "---\ntitle: Draft\npublished: false\n---\nSecret", encoding="utf-8"
    )
    (wiki / "index.md").write_text("---\ntitle: Index\n---\nNavigation", encoding="utf-8")

    pages = list(iter_published_markdown(tmp_path, "Wiki"))

    assert [path.name for path, _metadata, _body in pages] == ["a.md", "b.md"]
    assert [metadata["title"] for _path, metadata, _body in pages] == ["A", "B"]


def test_chunk_metadata_remains_consistent():
    text = "First paragraph.\n\nSecond paragraph."

    chunks = chunk_text(text, max_chars=20)
    entries = emit_chunks("page", "Page", [], "page.md", text, is_campaign=True)

    assert chunks == ["First paragraph.", "Second paragraph."]
    assert entries[0]["page_id"] == "page"
    assert entries[0]["chunk_total"] == 1
    assert entries[0]["is_campaign"] is True
