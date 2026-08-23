from ..imports import *
from ..symbols import *
from ..config import *

# ── Player lore-submission pipeline ──────────────────────────────────────────

LORE_SUBMISSION_KINDS = {
    "item": {
        "label": "Item",
        "source_dir": "Venturia/Items",
        "url_prefix": "/en/Venturia/Items",
        "image_dir": "images/items",
        "style": "valley-portrait",
        "tags": "venturia, items",
        "index": "Venturia/Items/index.md",
        "index_mode": "simple-markdown",
    },
    "person": {
        "label": "Person",
        "source_dir": "Venturia/Characters/NPCs",
        "url_prefix": "/en/Venturia/Characters/NPCs",
        "image_dir": "images/character-art",
        "style": "valley-portrait",
        "tags": "venturia, characters, npcs",
        "index": "Venturia/Characters/NPCs/index.md",
        "index_mode": "npc-html",
    },
    "place": {
        "label": "Place",
        "source_dir": "Venturia/Locations",
        "url_prefix": "/en/Venturia/Locations",
        "image_dir": "images/locations",
        "style": "valley-place",
        "tags": "venturia, locations",
        "index": "Venturia/Locations/index.md",
        "index_mode": "other-markdown",
    },
    "faction": {
        "label": "Faction",
        "source_dir": "Venturia/Factions",
        "url_prefix": "/en/Venturia/Factions",
        "image_dir": "images/factions",
        "style": "valley-scene",
        "tags": "venturia, factions",
        "index": "Venturia/Factions/index.md",
        "index_mode": "simple-markdown",
    },
    "lore": {
        "label": "Lore",
        "source_dir": "Venturia/Lore",
        "url_prefix": "/en/Venturia/Lore",
        "image_dir": "images/lore",
        "style": "valley-scene",
        "tags": "venturia, lore",
        "index": "Venturia/Lore/index.md",
        "index_mode": "simple-markdown",
    },
    "culture": {
        "label": "Culture",
        "source_dir": "Venturia/Culture",
        "url_prefix": "/en/Venturia/Culture",
        "image_dir": "images/culture",
        "style": "valley-scene",
        "tags": "venturia, culture",
        "index": "Venturia/Culture/index.md",
        "index_mode": "simple-markdown",
    },
}

def _slugify(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    ascii_text = ascii_text.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:80] or f"entry-{secrets.token_hex(4)}"


def _json_loads(value, fallback):
    if not value:
        return fallback
    try:
        data = json.loads(value)
        return data if data is not None else fallback
    except Exception:
        return fallback


def _parse_submission_connections(raw):
    if raw is None:
        return []

    if isinstance(raw, list):
        parsed = []
        for item in raw[:30]:
            if isinstance(item, dict):
                relation = str(item.get("relation") or "Connection").strip()[:60]
                target = str(item.get("target") or "").strip()[:160]
                note = str(item.get("note") or "").strip()[:240]
            else:
                relation = "Connection"
                target = str(item or "").strip()[:160]
                note = ""
            if target:
                parsed.append({"relation": relation or "Connection", "target": target, "note": note})
        return parsed

    text = str(raw or "")
    parsed = []
    for line in text.splitlines()[:30]:
        line = line.strip().lstrip("-*").strip()
        if not line:
            continue
        if ":" in line:
            relation, target = line.split(":", 1)
        elif " - " in line:
            relation, target = line.split(" - ", 1)
        elif " — " in line:
            relation, target = line.split(" — ", 1)
        else:
            relation, target = "Connection", line
        relation = relation.strip()[:60] or "Connection"
        target = target.strip()[:160]
        if target:
            parsed.append({"relation": relation, "target": target, "note": ""})
    return parsed


def _connections_to_text(connections):
    lines = []
    for item in connections or []:
        relation = item.get("relation") or "Connection"
        target = item.get("target") or ""
        note = item.get("note") or ""
        line = f"{relation}: {target}"
        if note:
            line += f" ({note})"
        lines.append(line)
    return "\n".join(lines) or "(none provided)"


def _submission_context_query(kind, title, description, connections, notes=""):
    pieces = [
        LORE_SUBMISSION_KINDS.get(kind, {}).get("label", kind),
        title,
        description,
        _connections_to_text(connections),
        notes,
    ]
    return "\n".join(str(piece or "") for piece in pieces if piece)


def _submission_context(kind, title, description, connections, notes=""):
    query = _submission_context_query(kind, title, description, connections, notes)
    matches = []
    additional = []
    try:
        auto_inject, additional = engine.retrieve(query, rules=False)
    except Exception:
        logging.exception("Lore submission context retrieval failed")
        auto_inject = []
        additional = []

    blocks = []
    for match in auto_inject:
        if len(matches) >= 8:
            break
        if (match.get("source_file") or "").startswith("5e-filtered/"):
            continue
        item = {
            "name": match.get("name"),
            "source_file": match.get("source_file"),
            "score": match.get("score"),
            "text": (match.get("text") or "")[:2200],
        }
        matches.append(item)
        blocks.append(
            f"### {item['name']} ({item['source_file']})\n{item['text']}"
        )

    context_text = "\n\n".join(blocks) if blocks else "(no matching codex context found)"
    if additional:
        extra_lines = [
            f"- {m.get('name')} ({m.get('source_file')}, score {float(m.get('score') or 0):.2f})"
            for m in additional[:10]
        ]
        context_text += "\n\nAdditional possible matches:\n" + "\n".join(extra_lines)

    return {
        "query": query,
        "matches": matches,
        "additional": [
            {
                "name": m.get("name"),
                "source_file": m.get("source_file"),
                "score": m.get("score"),
            }
            for m in additional[:10]
        ],
        "text": context_text[:14000],
    }

__all__ = ['LORE_SUBMISSION_KINDS', '_slugify', '_json_loads', '_parse_submission_connections', '_connections_to_text', '_submission_context_query', '_submission_context']
