"""The house style has to survive all the way to the image model.

The Studio drifted because it did not: a prompt naming several campaign
entities could push the composer past its cap, and the branch that made room
threw away the style prefix along with the grounding. Most images came back
in the house look and the elaborate ones came back generic, which reads as
the style having quietly changed rather than as a bug.
"""
import pytest


@pytest.fixture
def compose(server_module):
    return server_module._compose_final_image_prompt


# A realistically long house style. Length is the point: the real Valley
# prefixes are ~950 characters, and it is that plus a full 2800-character
# grounding block that pushes the composer over the line where it used to
# start discarding things.
STYLE = ("HOUSE STYLE MARKER. Warm practical flame, shallow depth of field. "
         + "Tarnished brass, quilted wool, jewel-tone grade. " * 18)


def _entries(n, chars):
    """Curated entries — only descriptions.json ones become grounding, and
    grounding is what pushes the composer over its cap."""
    return [{"name": f"Entity {i}", "text": "word " * (chars // 5),
             "source": "descriptions", "source_file": "descriptions.json"}
            for i in range(n)]


def test_style_leads_a_normal_prompt(compose):
    out = compose(STYLE, "A masked figure on the bridge.", [])
    assert out.startswith("HOUSE STYLE MARKER")
    assert "A masked figure on the bridge." in out


def test_style_survives_a_prompt_that_blows_the_cap(server_module, compose):
    """The regression. A long body plus heavy grounding used to drop both."""
    body = "A crowded masquerade. " * 400
    assert len(STYLE) > 900, "the fixture must be as long as a real preset"
    out = compose(STYLE, body, _entries(8, 2000))
    assert "HOUSE STYLE MARKER" in out, "the house style was dropped"
    assert out.startswith("HOUSE STYLE MARKER")
    assert len(out) <= server_module.IMAGE_PROMPT_MAX_CHARS


def test_style_outlives_the_grounding_block(compose):
    """When something has to go it is the grounding, not the look — the
    enhancer has already woven those details into the body."""
    out = compose(STYLE, "A masked figure. " * 300, _entries(8, 2400))
    assert "HOUSE STYLE MARKER" in out


def test_every_valley_preset_carries_the_house_look(server_module):
    presets = server_module.ART_STYLE_PRESETS
    valley = [k for k in presets if k.startswith("valley-")]
    assert valley, "the Valley presets went missing"
    for key in valley:
        prefix = presets[key]["prefix"]
        # The look, stated concretely enough for an image model to act on.
        assert "Reign" in prefix
        assert "shallow depth of field" in prefix.lower()
        assert "chiaroscuro" in prefix.lower()
        # And each one still says how the shot is framed.
        assert "framing:" in prefix.lower()
