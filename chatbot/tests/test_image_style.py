"""The house style has to survive all the way to the image model.

The Studio drifted because it did not: a prompt naming several campaign
entities could push the composer past its cap, and the branch that made room
threw away the style along with the grounding. Most images came back in the
house look and the elaborate ones came back generic, which reads as the style
having quietly changed rather than as a bug.

The style now comes out of vos/image_prompt_compiler.json and is assembled by
configuration rather than rewritten per image, so these tests also cover that
file loading at all — a missing config means every preset silently carries no
look, which is exactly the failure that is invisible from the response.
"""
import pytest


@pytest.fixture
def compose(server_module):
    return server_module._compose_image_prompt


# A realistically long house style. Length is the point: the real Valley
# style blocks are ~2500 characters, and it is that plus a full grounding
# block that pushes the composer over the line where it used to start
# discarding things.
STYLE = ("HOUSE STYLE MARKER. Warm practical flame, shallow depth of field. "
         + "Tarnished brass, quilted wool, jewel-tone grade. " * 18)


def _entries(n, chars):
    """Curated entries — only descriptions.json ones become grounding, and
    grounding is what pushes the composer over its cap."""
    return [{"name": f"Entity {i}", "text": "word " * (chars // 5),
             "source": "descriptions", "source_file": "descriptions.json"}
            for i in range(n)]


def test_scene_leads_and_the_style_follows(compose):
    """The assembly order the configuration specifies: scene, then style."""
    out = compose("A masked figure on the bridge.", STYLE, [])
    assert out.startswith("A masked figure on the bridge.")
    assert "HOUSE STYLE MARKER" in out


def test_style_survives_a_prompt_that_blows_the_cap(server_module, compose):
    """The regression. A long scene plus heavy grounding used to drop both."""
    scene = "A crowded masquerade. " * 400
    assert len(STYLE) > 900, "the fixture must be as long as a real preset"
    out = compose(scene, STYLE, _entries(8, 2000))
    assert "HOUSE STYLE MARKER" in out, "the house style was dropped"
    assert len(out) <= server_module.IMAGE_PROMPT_MAX_CHARS


def test_style_outlives_the_grounding_block(compose):
    """When something has to go it is the grounding, not the look — the
    compiler has already woven those details into the scene."""
    out = compose("A masked figure. " * 300, STYLE, _entries(8, 2400))
    assert "HOUSE STYLE MARKER" in out


def test_hard_constraints_come_last(compose):
    out = compose(
        "A single candle on a table.", STYLE, [],
        ["exactly one candle", "no additional text", "exactly one candle"],
    )
    assert out.rstrip().endswith(
        "Required: exactly one candle; no additional text.")
    assert out.count("exactly one candle") == 1, "duplicates should collapse"


def test_no_constraints_means_no_trailing_line(compose):
    out = compose("A quiet canal.", STYLE, [], [])
    assert "Required:" not in out


def test_the_compiler_configuration_actually_loads(server_module):
    """A missing config file is silent everywhere except the finished art."""
    config = server_module.IMAGE_COMPILER_CONFIG
    assert config, f"{server_module.IMAGE_COMPILER_CONFIG_PATH} did not load"
    assert server_module.VALLEY_HOUSE_STYLE
    assert server_module.VALLEY_CHARACTER_STYLE
    assert config["style_system"]["presets"]
    assert config["output_contract"]["schema"]["scene_prompt"]


def test_every_preset_carries_a_style(server_module):
    presets = server_module.ART_STYLE_PRESETS
    # The keys the client sends are a stable contract with the UI.
    assert set(presets) == {
        "valley-portrait", "valley-scene", "valley-place", "cinematic",
        "illustrated", "watercolor", "ink", "photoreal", "sketch",
        "stained-glass",
    }
    for key, preset in presets.items():
        assert preset["label"], key
        assert preset["description"], key
        assert preset["kind"] in {"portrait", "scene", "place", "other"}, key
        assert len(preset["style"]) > 200, key


def test_every_valley_preset_carries_the_house_look(server_module):
    presets = server_module.ART_STYLE_PRESETS
    valley = [k for k in presets if k.startswith("valley-")]
    assert len(valley) == 3, "the Valley presets went missing"
    for key in valley:
        style = presets[key]["style"]
        # The look, stated concretely enough for an image model to act on.
        assert server_module.VALLEY_HOUSE_STYLE in style, key
        assert "chiaroscuro" in style.lower(), key
        assert "shallow depth of field" in style.lower(), key


def test_only_figure_presets_carry_the_character_block(server_module):
    """Place shots have no principal figure, so skin-and-hair realism is
    prompt weight spent on nothing."""
    presets = server_module.ART_STYLE_PRESETS
    character = server_module.VALLEY_CHARACTER_STYLE
    assert character in presets["valley-portrait"]["style"]
    assert character in presets["valley-scene"]["style"]
    assert character not in presets["valley-place"]["style"]


def test_alternative_presets_stand_alone(server_module):
    """A non-Valley style is the whole look, not a house-style variation."""
    presets = server_module.ART_STYLE_PRESETS
    house = server_module.VALLEY_HOUSE_STYLE
    for key in ("cinematic", "watercolor", "ink", "sketch", "stained-glass"):
        assert house not in presets[key]["style"], key
