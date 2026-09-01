"""Grounding a request in descriptions.json when nobody typed a canonical name.

The literal matcher only ever fires on phrases someone wrote. The prompt that
motivated this file — "each party member ... so it will have 5 squares" —
matched nothing, so the compiler was told the app knew nobody in the request
and invented five strangers. These tests hold the line at three places: the
catalog a model is allowed to see, the lookup it is not allowed to do, and
the failure behavior that keeps resolution from ever costing an image.
"""
import json

import pytest


@pytest.fixture
def grounding(server_module):
    return server_module


@pytest.fixture
def resolver_module(server_module):
    """The module the resolver actually reads its names out of.

    vos.runtime copies every exported name into every module, so patching
    `server.ANTHROPIC_API_KEY` changes a different variable than the one
    _entity_resolver_provider() looks at.
    """
    from vos.services import prompt_compiler
    return prompt_compiler


# ── The catalog ──────────────────────────────────────────────────────────────

def test_the_catalog_lists_names_and_never_descriptions(grounding):
    catalog = grounding._descriptions_catalog()
    assert 'The Party [the party;' in catalog
    # Groups expand, so "the party" is answerable as five people.
    for member in ("Lotan", "Noname", "Valentro"):
        assert member in catalog
    # Aliases are how an indirect reference gets recognised at all.
    assert "the gnome arcane trickster" in catalog
    # The visual facts stay in the file. A model picks names; it never writes
    # or reads what a name looks like.
    roxy = grounding._load_descriptions_index()["roxy"][1]
    assert roxy not in catalog


def test_the_file_is_found_without_a_site_mount(grounding):
    """The fallback used to point at a path that has never existed, so a
    container with no /site mount lost every description and said nothing."""
    assert grounding.DESCRIPTIONS_FILE.exists()
    assert grounding.DESCRIPTIONS_CANDIDATES[-1].name == "descriptions.json"
    assert grounding.DESCRIPTIONS_CANDIDATES[-1].exists()


def test_a_broken_descriptions_file_costs_the_catalog_not_the_request(grounding):
    assert grounding._build_descriptions_catalog({"nope": 1}) == ""
    assert grounding._build_descriptions_catalog(None) == ""


# ── The lookup ───────────────────────────────────────────────────────────────

def test_names_resolve_to_curated_descriptions(grounding):
    resolved = grounding._lookup_descriptions_by_name(
        ["The Party", "roxy", "Ser Nobody of Nowhere"])
    names = [m["name"] for m in resolved]
    assert names == ["The Party", 'Roxanya "Roxy"']
    assert resolved[0]["text"].startswith("Group reference")
    assert all(m["source_file"] == "descriptions.json" for m in resolved)


def test_the_lookup_will_not_repeat_what_is_already_matched(grounding):
    already = [{"name": "The Party", "source_file": "descriptions.json"}]
    assert grounding._lookup_descriptions_by_name(["the party"], already) == []


def test_an_invented_name_simply_finds_nothing(grounding):
    """The app owns the lookup, so a hallucinated name is inert."""
    assert grounding._lookup_descriptions_by_name(
        ["Roxanya's Secret Twin", "", None]) == []


# ── The resolver ─────────────────────────────────────────────────────────────

class _FakePoster:
    """Stands in for the requests module so the outbound call can be read."""

    def __init__(self, post):
        self.post = post


def _answer(*names):
    return lambda system, user_message: json.dumps({"entities": list(names)})


def test_the_prompt_that_invented_five_strangers(grounding, resolver_module, monkeypatch):
    """The regression this whole path exists for.

    "each party member" never produces the phrase "the party", so the literal
    matcher returns nothing and the compiler is told to invent nothing — which
    it satisfies by inventing everyone.
    """
    prompt = ("Create one image with each party member in a squished style "
              "with a transparent background. So it will have 5 squares.")
    assert grounding._match_descriptions(
        prompt, grounding._load_descriptions_index()) == []

    monkeypatch.setattr(resolver_module, "ANTHROPIC_API_KEY", "sk-test", raising=False)
    monkeypatch.setitem(
        grounding.ENTITY_RESOLVER_CALLERS, "claude", _answer("The Party"))
    resolved = grounding._resolve_prompt_entities(prompt)
    assert [m["name"] for m in resolved] == ["The Party"]
    # The five are now in the prompt as themselves.
    for member in ("Lotan", "Noname", "Valentro"):
        assert member in resolved[0]["text"]


def test_the_resolver_is_shown_the_catalog_and_not_the_descriptions(grounding, resolver_module, monkeypatch):
    seen = {}

    def capture(system, user_message):
        seen["system"] = system
        seen["user"] = user_message
        return json.dumps({"entities": []})

    monkeypatch.setattr(resolver_module, "ANTHROPIC_API_KEY", "sk-test", raising=False)
    monkeypatch.setitem(grounding.ENTITY_RESOLVER_CALLERS, "claude", capture)
    grounding._resolve_prompt_entities("the whole group on the docks")
    assert "The Party" in seen["user"]
    assert "the whole group on the docks" in seen["user"]
    assert "you do not describe anyone" in seen["system"].lower()


def test_a_dead_resolver_costs_grounding_not_the_image(grounding, resolver_module, monkeypatch):
    def explode(system, user_message):
        raise RuntimeError("Anthropic 529: overloaded")

    monkeypatch.setattr(resolver_module, "ANTHROPIC_API_KEY", "sk-test", raising=False)
    monkeypatch.setitem(grounding.ENTITY_RESOLVER_CALLERS, "claude", explode)
    assert grounding._resolve_prompt_entities("each party member") == []


def test_a_nonsense_answer_costs_grounding_not_the_image(grounding, resolver_module, monkeypatch):
    monkeypatch.setattr(resolver_module, "ANTHROPIC_API_KEY", "sk-test", raising=False)
    monkeypatch.setitem(
        grounding.ENTITY_RESOLVER_CALLERS, "claude",
        lambda system, user_message: "I'm afraid I can't help with that.")
    assert grounding._resolve_prompt_entities("each party member") == []


def test_resolution_can_be_switched_off(grounding, resolver_module, monkeypatch):
    monkeypatch.setattr(resolver_module, "IMAGE_ENTITY_RESOLVER_ENABLED", False, raising=False)
    monkeypatch.setattr(resolver_module, "ANTHROPIC_API_KEY", "sk-test", raising=False)
    monkeypatch.setitem(
        grounding.ENTITY_RESOLVER_CALLERS, "claude", _answer("The Party"))
    assert grounding._resolve_prompt_entities("each party member") == []


def test_an_unconfigured_server_resolves_nothing(grounding, resolver_module, monkeypatch):
    monkeypatch.setattr(resolver_module, "ANTHROPIC_API_KEY", "", raising=False)
    monkeypatch.delenv("OPENAI_KEY", raising=False)
    assert grounding._entity_resolver_provider() is None
    assert grounding._resolve_prompt_entities("each party member") == []


def test_the_answer_list_is_cleaned_and_capped(grounding):
    parse = grounding._parse_resolved_entities
    assert parse('{"entities": ["The  Party", "The Party", "Roxy"]}') == [
        "The Party", "Roxy"]
    assert parse('```json\n{"entities": "The Party"}\n```') == ["The Party"]
    assert parse('{"entities": null}') == []
    assert len(parse(json.dumps({"entities": [f"n{i}" for i in range(50)]}))) == (
        grounding.IMAGE_ENTITY_RESOLVER_MAX_NAMES)


# ── The compiler sees the catalog either way ─────────────────────────────────

def test_the_compiler_is_always_name_aware(grounding):
    message = grounding._compiler_user_message(
        "a quiet street at dusk", "valley-place", [])
    assert "ENTITY CATALOG" in message
    assert "The Party" in message
    assert "do not invent visual facts" in message


# ── A request with no style still gets one ───────────────────────────────────

def test_a_request_with_no_style_gets_the_default(grounding, resolver_module, monkeypatch):
    """Enzo's /art posts no style. It must not generate unstyled art."""
    monkeypatch.delenv("OPENAI_KEY", raising=False)
    monkeypatch.delenv("IMAGE_STYLE_PROMPT", raising=False)
    # No OPENAI_KEY means it stops before calling anything, which is far
    # enough: the style is resolved above that point.
    payload, status = grounding._generate_image_payload("a canal", None, "DM")
    assert status == 503 and "OPENAI_KEY" in payload["error"]

    monkeypatch.setenv("OPENAI_KEY", "sk-test")
    captured = {}

    def fake_post(url, **kwargs):
        captured["prompt"] = (kwargs.get("json") or {}).get("prompt", "")
        raise RuntimeError("stop here — the prompt is what is under test")

    from vos.services import studio as studio_service
    monkeypatch.setattr(studio_service, "http_requests", _FakePoster(fake_post))
    monkeypatch.setattr(resolver_module, "IMAGE_ENTITY_RESOLVER_ENABLED", False, raising=False)
    grounding._generate_image_payload("a canal", None, "DM", enhance=False)
    assert grounding.VALLEY_HOUSE_STYLE in captured["prompt"]
