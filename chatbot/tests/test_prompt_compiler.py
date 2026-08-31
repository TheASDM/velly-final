"""The image-prompt compiler: what it sends, what it accepts back, and what
happens when the provider fails.

Two providers exist so the same request can be compiled both ways and
compared. The rules that matter here are that the choice is the DM's alone,
that the house style is assembled from configuration rather than written by
whichever model ran, and that a compiler failure costs refinement rather than
the image.
"""
import json

import pytest


@pytest.fixture
def compiler(server_module):
    return server_module


def test_provider_names_are_forgiving(compiler):
    normalize = compiler._normalize_image_compiler
    assert normalize("claude") == "claude"
    assert normalize("Anthropic") == "claude"
    assert normalize("chatgpt") == "chatgpt"
    assert normalize("OpenAI") == "chatgpt"
    assert normalize("gpt") == "chatgpt"
    assert normalize("midjourney") is None
    assert normalize("") is None
    assert normalize(None) is None


def test_the_active_provider_round_trips_through_the_setting(compiler):
    compiler._set_active_image_compiler("chatgpt")
    assert compiler._active_image_compiler() == "chatgpt"
    compiler._set_active_image_compiler("claude")
    assert compiler._active_image_compiler() == "claude"
    with pytest.raises(ValueError):
        compiler._set_active_image_compiler("stable-diffusion")


def test_an_unconfigured_provider_hands_over(compiler, monkeypatch):
    """A provider with no API key must not fail the image."""
    monkeypatch.setenv("OPENAI_KEY", "sk-test")
    monkeypatch.setattr(compiler, "ANTHROPIC_API_KEY", "", raising=False)
    # The test server has no Anthropic key, so asking for Claude lands on the
    # provider that does have credentials.
    assert compiler._resolve_image_compiler("chatgpt") == "chatgpt"


def test_json_survives_a_fenced_answer(compiler):
    parse = compiler._parse_compiler_json
    assert parse('{"scene_prompt": "a canal"}')["scene_prompt"] == "a canal"
    assert parse('```json\n{"scene_prompt": "a canal"}\n```')["scene_prompt"] == "a canal"
    assert parse('Here you go:\n{"scene_prompt": "a canal"}\nHope that helps.')[
        "scene_prompt"] == "a canal"
    with pytest.raises(ValueError):
        parse("no json at all")


def test_validation_fills_the_contract(compiler):
    record = compiler._validate_compiler_record({
        "scene_prompt": "  A half-orc captain,   three-quarter to camera. ",
        "subject_and_identity": "A half-orc woman",
        "hard_constraints": "no helmet",
        "compiled_prompt": "the model's own assembly",
    }, "valley-portrait")
    assert record["preset_key"] == "valley-portrait"
    assert record["scene_kind"] == "portrait"
    assert record["scene_prompt"] == "A half-orc captain, three-quarter to camera."
    assert record["hard_constraints"] == ["no helmet"]
    # Kept for debugging only: the application assembles what is actually sent.
    assert record["model_compiled_prompt"] == "the model's own assembly"
    for field in compiler.COMPILER_TEXT_FIELDS:
        assert field in record


def test_a_missing_scene_prompt_is_rebuilt_from_the_fields(compiler):
    record = compiler._validate_compiler_record({
        "subject_and_identity": "A masked courier.",
        "environment": "A narrow canal lane before dawn.",
        "composition_and_camera": "Waist-up, low angle.",
    }, "valley-scene")
    assert "masked courier" in record["scene_prompt"]
    assert "canal lane" in record["scene_prompt"]


def test_validation_refuses_an_empty_answer(compiler):
    with pytest.raises(ValueError):
        compiler._validate_compiler_record({}, "valley-scene")
    with pytest.raises(ValueError):
        compiler._validate_compiler_record(["not", "an", "object"], "valley-scene")


def test_requested_text_pins_itself_as_the_only_text(compiler):
    record = compiler._validate_compiler_record({
        "scene_prompt": "A notice nailed to a door.",
        "exact_text": "BY ORDER OF THE COUNCIL",
    }, "valley-place")
    assert any("text" in c.lower() for c in record["hard_constraints"])


def test_reference_roles_are_a_closed_vocabulary(compiler):
    normalize = compiler._normalize_reference_roles
    assert normalize(["identity"]) == [{"role": "identity_reference", "note": ""}]
    assert normalize([{"role": "costume_reference", "note": "the black coat"}]) == [
        {"role": "costume_reference", "note": "the black coat"}]
    assert normalize(["face_reference"]) == []
    assert normalize(None) == []


def test_the_system_prompt_never_restates_the_house_style(compiler):
    """The whole point of assembling the style from configuration: the
    compiler is told to leave the look alone, not handed it to reword."""
    system = compiler._compiler_system_prompt("portrait", ["identity_reference"])
    assert compiler.VALLEY_HOUSE_STYLE not in system
    assert compiler.VALLEY_CHARACTER_STYLE not in system
    # It does carry the behavior rules, the output contract, and the policy
    # for the reference role it was given.
    assert "scene_prompt" in system
    assert "identity_reference" in system
    assert "costume_reference" not in system
    assert "unrequested tattoos" in system, "the character avoid-list is missing"


def test_place_shots_get_the_place_avoid_list(compiler):
    system = compiler._compiler_system_prompt("place")
    assert "empty theme-park streets" in system
    assert "unrequested tattoos" not in system


def test_the_request_carries_canonical_continuity(compiler):
    message = compiler._compiler_user_message(
        "Roxy at the Penny Shrine before sunrise.",
        "valley-portrait",
        [{"name": "Roxy", "text": "Halfling, copper braid, scarred left hand.",
          "source_file": "descriptions.json"}],
    )
    assert "Roxy at the Penny Shrine" in message
    assert "scarred left hand" in message
    assert "do not redesign" in message.lower()


def test_a_compiled_prompt_is_scene_then_configured_style(compiler, monkeypatch):
    monkeypatch.setenv("OPENAI_KEY", "sk-test")
    answer = json.dumps({
        "scene_prompt": "A half-orc captain in black watch leather.",
        "hard_constraints": ["no helmet"],
        "compiled_prompt": "IGNORE ME — the model's own assembly",
    })
    monkeypatch.setitem(
        compiler.IMAGE_COMPILER_CALLERS, "chatgpt",
        lambda system, user_message: answer,
    )
    result = compiler._compile_image_prompt(
        "the captain of the watch, no helmet", "valley-portrait", [],
        provider="chatgpt",
    )
    assert result["ok"] and result["compiled"]
    assert result["provider"] == "chatgpt"
    prompt = result["compiled_prompt"]
    assert prompt.startswith("A half-orc captain in black watch leather.")
    assert compiler.VALLEY_HOUSE_STYLE in prompt
    assert prompt.rstrip().endswith("Required: no helmet.")
    assert "IGNORE ME" not in prompt


def test_a_broken_provider_costs_refinement_not_the_image(compiler, monkeypatch):
    monkeypatch.setenv("OPENAI_KEY", "sk-test")

    def explode(system, user_message):
        raise RuntimeError("OpenAI 500: upstream on fire")

    monkeypatch.setitem(compiler.IMAGE_COMPILER_CALLERS, "chatgpt", explode)
    result = compiler._compile_image_prompt(
        "Roxy at the shrine", "valley-portrait", [], provider="chatgpt",
    )
    assert result["ok"] is False
    assert "upstream on fire" in result["error"]
    # Still a usable prompt, still in the house style.
    assert "Roxy at the shrine" in result["compiled_prompt"]
    assert compiler.VALLEY_HOUSE_STYLE in result["compiled_prompt"]


def test_refinement_off_still_carries_the_style(compiler):
    result = compiler._uncompiled_image_prompt(
        "A quiet canal at dawn.", "valley-place", [],
    )
    assert result["compiled"] is False
    assert result["compiled_prompt"].startswith("A quiet canal at dawn.")
    assert compiler.VALLEY_HOUSE_STYLE in result["compiled_prompt"]


def test_only_the_dm_can_pick_a_compiler(server_module, app, auth_headers):
    """Players get whatever is active and are never told there is a choice."""
    body = {"compiler": "chatgpt"}
    with app.test_request_context(
        "/api/studio/generate", json=body, headers=auth_headers["player"],
    ):
        assert server_module._studio_compiler_from_body(body) is None
    with app.test_request_context(
        "/api/studio/generate", json=body, headers=auth_headers["dm"],
    ):
        assert server_module._studio_compiler_from_body(body) == "chatgpt"
    with app.test_request_context(
        "/api/studio/generate", json={}, headers=auth_headers["dm"],
    ):
        assert server_module._studio_compiler_from_body({}) is None
