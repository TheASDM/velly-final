import json
import importlib


def test_loremaster_retrieves_keyword_and_vector_matches(
    server_module, monkeypatch, tmp_path
):
    entries = [
        {
            "id": "three-fanes",
            "page_id": "three-fanes",
            "name": "The Three Fanes",
            "aliases": ["Three Fanes"],
            "source_file": "Venturia/Lore/three-fanes.md",
            "text": "Three old sanctuaries stand at the city's edge.",
            "embedding": [1.0, 0.0],
        },
        {
            "id": "burnt-quill",
            "page_id": "burnt-quill",
            "name": "The Burnt Quill",
            "aliases": [],
            "source_file": "Venturia/Locations/burnt-quill.md",
            "text": "A tavern used by locals and travelers.",
            "embedding": [0.0, 1.0],
        },
    ]
    (tmp_path / "tier1.md").write_text("Fixture lore.\n", encoding="utf-8")
    (tmp_path / "vector_store.json").write_text(
        json.dumps({"meta": {"built_at": "test"}, "entries": entries}),
        encoding="utf-8",
    )
    knowledge_module = importlib.import_module(
        server_module.Loremaster.__mro__[1].__module__
    )
    monkeypatch.setattr(knowledge_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(
        knowledge_module, "VECTOR_SQLITE_PATH", tmp_path / "vector_store.sqlite3"
    )

    engine = server_module.Loremaster()
    engine.load()
    if engine._vec_db is not None:
        engine._vec_db.close()
        engine._vec_db = None
    monkeypatch.setattr(engine, "_embed_query", lambda _query: [1.0, 0.0])

    exact, _ = engine.retrieve("Tell me about the Three Fanes")
    assert exact[0]["name"] == "The Three Fanes"
    assert exact[0]["score"] == 1.0

    vector, _ = engine.retrieve("Which sanctuary protects the city?")
    assert vector[0]["name"] == "The Three Fanes"
    assert vector[0]["score"] == 1.0

    context, citations = engine.build_rag_context("Which sanctuary protects the city?")
    assert "Three old sanctuaries" in context
    assert citations[0]["name"] == "The Three Fanes"
