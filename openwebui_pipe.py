"""
title: Vallombrosa Loremaster
author: TheASDM
version: 1.0.0
license: MIT
description: D&D 5e campaign chatbot for the Vallombrosa campaign. Uses RAG with embedded campaign lore and 5e rules, backed by Claude via Anthropic API.
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Generator, Iterator, List, Optional, Union

import requests
from pydantic import BaseModel, Field

# ── Constants ────────────────────────────────────────────────────────────────

CAMPAIGN_DATA_DIR = Path(os.environ.get("CAMPAIGN_DATA_DIR", "/app/backend/data"))

PLAYER_SYSTEM_HEADER = """You are the Loremaster, a knowledgeable guide for the Vallombrosa campaign — a D&D 5e game set in a dark romantasy version of Renaissance Venice called Venturia. The city sits at the edge of a fey prison called the Reverie Solenne, whose slow collapse is causing strange phenomena throughout the city.

You are speaking to a PLAYER. Do not reveal plot secrets, DM-only information, or any content marked [SPOILER]. If asked about something you know is a spoiler, deflect gracefully — say it hasn't been revealed yet, or suggest they ask their DM.

Answer questions about the campaign world, characters, locations, factions, and D&D 5e rules. Be concise but evocative. If you don't know something from the provided context, say so rather than inventing details. Use the tone of a learned Venetian scholar — measured, precise, occasionally lyrical.

You may receive [DETAILED REFERENCE] blocks injected alongside user messages — prefer that detailed information over compressed summaries in your base knowledge.

You may see an [ADDITIONAL MATCHES AVAILABLE] block listing other relevant entries by name and similarity score. You can use the lookup_entry tool to load full details on any of them if needed to answer the question.

---
"""

DM_SYSTEM_HEADER = """You are the Loremaster, a comprehensive campaign assistant for the Vallombrosa campaign — a D&D 5e game set in a dark romantasy version of Renaissance Venice called Venturia.

You are speaking to the DM. You have full access to all campaign information including spoilers, plot secrets, NPC motivations, and DM notes. Be direct and useful. Help with:
- Session prep and encounter planning
- NPC motivations and connections
- Plot threads and how they connect
- Rules questions and rulings
- Lore consistency checks

You may receive [DETAILED REFERENCE] blocks injected alongside user messages — prefer that detailed information over compressed summaries in your base knowledge.

You may see an [ADDITIONAL MATCHES AVAILABLE] block listing other relevant entries by name and similarity score. You can use the lookup_entry tool to load full details on any of them if needed to answer the question.

---
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

# 5etools tag stripping
_5E_TAG_RE = re.compile(r"\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}")


def strip_5e_tags(text):
    if not isinstance(text, str):
        return str(text)
    return _5E_TAG_RE.sub(r"\1", text)


def flatten_entries(entries, depth=0):
    if entries is None:
        return ""
    if isinstance(entries, str):
        return strip_5e_tags(entries)
    if isinstance(entries, dict):
        parts = []
        name = entries.get("name", "")
        if name:
            parts.append(f"{strip_5e_tags(name)}.")
        if "entries" in entries:
            parts.append(flatten_entries(entries["entries"], depth + 1))
        if "headerEntries" in entries:
            parts.append(flatten_entries(entries["headerEntries"], depth + 1))
        if "items" in entries and isinstance(entries["items"], list):
            for item in entries["items"]:
                parts.append(flatten_entries(item, depth + 1))
        if entries.get("type") == "table":
            cols = entries.get("colLabels", [])
            if cols:
                parts.append("Columns: " + ", ".join(strip_5e_tags(c) for c in cols) + ".")
            for row in entries.get("rows", []):
                if isinstance(row, list):
                    parts.append(" | ".join(strip_5e_tags(str(cell)) for cell in row))
        if "entry" in entries:
            parts.append(flatten_entries(entries["entry"], depth + 1))
        return " ".join(p for p in parts if p)
    if isinstance(entries, list):
        parts = [flatten_entries(item, depth) for item in entries]
        return " ".join(p for p in parts if p)
    return str(entries)


def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors using pure Python."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def format_campaign_entry(entry, dm_mode=False):
    """Format a campaign curated entry for injection."""
    parts = []
    parts.append(f"Name: {entry.get('name', 'Unknown')}")

    aliases = entry.get("aliases", [])
    if aliases:
        parts.append(f"Also known as: {', '.join(aliases)}")

    summary = entry.get("summary", "")
    if summary:
        parts.append(f"Summary: {summary}")

    for detail in entry.get("details", []):
        if not dm_mode and detail.get("spoiler"):
            continue
        label = detail.get("label", "")
        content = detail.get("content", "")
        if label and content:
            parts.append(f"{label}: {content}")

    for conn in entry.get("connections", []):
        if not dm_mode and conn.get("spoiler"):
            continue
        target = conn.get("target_name", "")
        rel = conn.get("relationship", "")
        if target and rel:
            parts.append(f"Connected to {target}: {rel}")

    if dm_mode:
        dm_notes = entry.get("dm_notes", "")
        if dm_notes:
            parts.append(f"DM Notes: {dm_notes}")

    return "\n".join(parts)


def format_5etools_entry(entry):
    """Format a 5etools entry for injection."""
    parts = [f"Name: {entry.get('name', 'Unknown')}"]

    # Common fields
    for field in ("type", "rarity", "school", "level", "cr"):
        val = entry.get(field)
        if val is not None:
            parts.append(f"{field.capitalize()}: {val}")

    entries_text = flatten_entries(entry.get("entries", []))
    if entries_text:
        parts.append(entries_text)

    return "\n".join(parts)


# ── Pipe Class ────────────────────────────────────────────────────────────────


class Pipe:
    class Valves(BaseModel):
        ANTHROPIC_API_KEY: str = Field(default="", description="Anthropic API key")
        ANTHROPIC_MODEL: str = Field(
            default="claude-haiku-4-5-20251001", description="Claude model to use"
        )
        MAX_TOKENS: int = Field(default=2048, description="Max response tokens")
        OLLAMA_URL: str = Field(
            default="https://ai.raptornet.dev/ollama",
            description="Ollama server URL for embeddings (include /ollama for OpenWebUI proxy)",
        )
        OLLAMA_API_KEY: str = Field(
            default="", description="Bearer token for Ollama/OpenWebUI"
        )
        EMBEDDING_MODEL: str = Field(
            default="mxbai-embed-large:latest", description="Ollama embedding model"
        )
        CAMPAIGN_DATA_DIR: str = Field(
            default="/app/backend/data",
            description="Directory containing campaign data files",
        )
        RAG_TOP_K: int = Field(
            default=3, description="Number of top matches to auto-inject"
        )
        RAG_AUTO_THRESHOLD: float = Field(
            default=0.3, description="Minimum similarity for auto-injection"
        )
        RAG_LIST_THRESHOLD: float = Field(
            default=0.4, description="Minimum similarity for listing additional matches"
        )

    def __init__(self):
        self.type = "manifold"
        self.valves = self.Valves()
        self._vector_store_dm = None
        self._vector_store_player = None
        self._tier1_player = None
        self._tier1_dm = None
        self._campaign_data = {}  # {source_file: parsed JSON}

    def pipes(self):
        return [
            {"id": "loremaster-player", "name": "Loremaster (Player)"},
            {"id": "loremaster-dm", "name": "Loremaster (DM)"},
        ]

    # ── Data Loading ──────────────────────────────────────────────────────

    def _data_dir(self):
        return Path(self.valves.CAMPAIGN_DATA_DIR)

    def _load_tier1(self, mode):
        filename = "tier1_dm.md" if mode == "dm" else "tier1_player.md"
        path = self._data_dir() / filename
        try:
            return path.read_text()
        except Exception as e:
            print(f"[Loremaster] Failed to load {filename}: {e}")
            return ""

    def _ensure_tier1(self, mode):
        if mode == "dm":
            if self._tier1_dm is None:
                self._tier1_dm = self._load_tier1("dm")
            return self._tier1_dm
        else:
            if self._tier1_player is None:
                self._tier1_player = self._load_tier1("player")
            return self._tier1_player

    def _load_vector_store(self, mode):
        filename = "vector_store.json" if mode == "dm" else "vector_store_player.json"
        path = self._data_dir() / filename
        try:
            with open(path) as f:
                return json.load(f)
        except Exception as e:
            print(f"[Loremaster] Failed to load {filename}: {e}")
            return None

    def _ensure_vector_store(self, mode):
        if mode == "dm":
            if self._vector_store_dm is None:
                self._vector_store_dm = self._load_vector_store("dm")
            return self._vector_store_dm
        else:
            if self._vector_store_player is None:
                self._vector_store_player = self._load_vector_store("player")
            return self._vector_store_player

    def _load_source_file(self, source_file):
        """Load and cache a Tier 2 JSON file."""
        if source_file in self._campaign_data:
            return self._campaign_data[source_file]

        path = self._data_dir() / source_file
        try:
            with open(path) as f:
                data = json.load(f)
            self._campaign_data[source_file] = data
            return data
        except Exception as e:
            print(f"[Loremaster] Failed to load {source_file}: {e}")
            return None

    def _find_entry_in_source(self, entry_id, entry_name, source_file):
        """Find the full entry in the source JSON file."""
        data = self._load_source_file(source_file)
        if data is None:
            return None

        # Campaign curated files
        if source_file.startswith("curated/"):
            for entry in data.get("entries", []):
                if entry.get("name", "").lower() == entry_name.lower():
                    return {"type": "campaign", "entry": entry}
                if entry.get("id", "") in entry_id:
                    return {"type": "campaign", "entry": entry}

        # 5etools files
        else:
            for key, value in data.items():
                if key.startswith("_"):
                    continue
                if not isinstance(value, list):
                    continue
                for entry in value:
                    if isinstance(entry, dict) and entry.get("name", "").lower() == entry_name.lower():
                        return {"type": "5etools", "entry": entry}

        return None

    # ── Embedding ─────────────────────────────────────────────────────────

    def _embed_query(self, text):
        """Embed a query string via Ollama."""
        headers = {"Content-Type": "application/json"}
        if self.valves.OLLAMA_API_KEY:
            headers["Authorization"] = f"Bearer {self.valves.OLLAMA_API_KEY}"

        try:
            resp = requests.post(
                f"{self.valves.OLLAMA_URL}/api/embeddings",
                json={"model": self.valves.EMBEDDING_MODEL, "prompt": text},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json().get("embedding")
        except Exception as e:
            print(f"[Loremaster] Embedding failed: {e}")
            return None

    # ── RAG ───────────────────────────────────────────────────────────────

    def _retrieve(self, query, mode):
        """Embed query, search vector store, return (auto_inject, additional)."""
        store = self._ensure_vector_store(mode)
        if not store:
            return [], []

        query_vec = self._embed_query(query)
        if not query_vec:
            return [], []

        # Score all entries
        scored = []
        for entry in store:
            emb = entry.get("embedding")
            if not emb:
                continue
            sim = cosine_similarity(query_vec, emb)
            scored.append((sim, entry))

        scored.sort(key=lambda x: x[0], reverse=True)

        dm_mode = mode == "dm"
        auto_inject = []
        additional = []

        for i, (sim, entry) in enumerate(scored):
            if i < self.valves.RAG_TOP_K and sim >= self.valves.RAG_AUTO_THRESHOLD:
                # Load full entry from source file
                full = self._find_entry_in_source(
                    entry["id"], entry["name"], entry["source_file"]
                )
                if full:
                    if full["type"] == "campaign":
                        formatted = format_campaign_entry(full["entry"], dm_mode)
                    else:
                        formatted = format_5etools_entry(full["entry"])
                    auto_inject.append({
                        "name": entry["name"],
                        "source_file": entry["source_file"],
                        "score": sim,
                        "text": formatted,
                    })
            elif sim >= self.valves.RAG_LIST_THRESHOLD:
                additional.append({
                    "name": entry["name"],
                    "source_file": entry["source_file"],
                    "score": sim,
                })

        return auto_inject, additional

    def _build_rag_context(self, query, mode):
        """Build RAG context blocks to inject alongside the user message."""
        auto_inject, additional = self._retrieve(query, mode)

        blocks = []
        for match in auto_inject:
            blocks.append(
                f"[DETAILED REFERENCE: {match['name']} from {match['source_file']} "
                f"(similarity: {match['score']:.2f})]\n{match['text']}"
            )

        if additional:
            lines = [f"  - {m['name']} ({m['source_file']}, score: {m['score']:.2f})"
                     for m in additional[:10]]
            blocks.append(
                "[ADDITIONAL MATCHES AVAILABLE]\n"
                "You can use the lookup_entry tool to load full details on any of these:\n"
                + "\n".join(lines)
            )

        return "\n\n".join(blocks)

    # ── Tool: lookup_entry ────────────────────────────────────────────────

    def _lookup_entry(self, name, mode):
        """Look up a campaign or rules entry by name."""
        dm_mode = mode == "dm"
        name_lower = name.lower().strip()

        # Search campaign curated files
        curated_dir = self._data_dir() / "curated"
        if curated_dir.exists():
            for fpath in curated_dir.glob("*.json"):
                data = self._load_source_file(f"curated/{fpath.name}")
                if not data:
                    continue
                for entry in data.get("entries", []):
                    entry_name = entry.get("name", "").lower()
                    entry_aliases = [a.lower() for a in entry.get("aliases", [])]
                    if name_lower == entry_name or name_lower in entry_aliases:
                        return format_campaign_entry(entry, dm_mode)

        # Search 5etools files
        rules_dir = self._data_dir() / "5e-filtered"
        if rules_dir.exists():
            for fpath in rules_dir.glob("*.json"):
                data = self._load_source_file(f"5e-filtered/{fpath.name}")
                if not data:
                    continue
                for key, value in data.items():
                    if key.startswith("_") or not isinstance(value, list):
                        continue
                    for entry in value:
                        if isinstance(entry, dict):
                            if entry.get("name", "").lower() == name_lower:
                                return format_5etools_entry(entry)

        return f"No entry found matching '{name}'. Try a different name or spelling."

    # ── Anthropic API ─────────────────────────────────────────────────────

    def _anthropic_headers(self):
        return {
            "x-api-key": self.valves.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    def _convert_messages(self, messages):
        """Convert OpenAI format messages to Anthropic format."""
        result = []
        for msg in messages:
            if msg["role"] == "system":
                continue
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    part.get("text", "")
                    for part in content
                    if isinstance(part, dict) and part.get("type") == "text"
                )
            if not content:
                continue
            result.append({"role": msg["role"], "content": content})
        return result

    def _tool_definitions(self):
        return [
            {
                "name": "lookup_entry",
                "description": (
                    "Look up a campaign entry (character, location, faction, lore) "
                    "or D&D 5e rules entry (spell, feat, item, monster, class feature, etc.) "
                    "by name. Use this when the auto-loaded references don't cover what's needed, "
                    "or when an [ADDITIONAL MATCHES AVAILABLE] block lists something relevant."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name of the entry to look up (e.g. 'Fireball', 'Venturia', 'Lotan')",
                        }
                    },
                    "required": ["name"],
                },
            }
        ]

    def _call_anthropic(self, system_prompt, messages, tools=None, stream=False):
        """Call Anthropic API and handle tool use loop."""
        payload = {
            "model": self.valves.ANTHROPIC_MODEL,
            "max_tokens": self.valves.MAX_TOKENS,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            payload["tools"] = tools

        if stream and not tools:
            return self._stream_anthropic(payload)

        # Non-streaming with tool loop
        max_loops = 5
        for _ in range(max_loops):
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=self._anthropic_headers(),
                json=payload,
                timeout=60,
            )

            if resp.status_code != 200:
                return f"API error: {resp.status_code} — {resp.text[:200]}"

            result = resp.json()

            if result.get("stop_reason") != "tool_use":
                # Extract text
                text_parts = [
                    b["text"]
                    for b in result.get("content", [])
                    if b.get("type") == "text"
                ]
                return "\n".join(text_parts) if text_parts else ""

            # Handle tool calls
            tool_results = []
            for block in result["content"]:
                if block["type"] == "tool_use":
                    tool_name = block["name"]
                    tool_input = block["input"]
                    if tool_name == "lookup_entry":
                        mode = self._current_mode or "player"
                        tool_result = self._lookup_entry(
                            tool_input.get("name", ""), mode
                        )
                    else:
                        tool_result = f"Unknown tool: {tool_name}"

                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": tool_result,
                        }
                    )

            messages.append({"role": "assistant", "content": result["content"]})
            messages.append({"role": "user", "content": tool_results})
            payload["messages"] = messages

        return "Too many tool calls. Please try a simpler question."

    def _stream_anthropic(self, payload):
        """Stream response from Anthropic API."""
        payload["stream"] = True

        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=self._anthropic_headers(),
            json=payload,
            stream=True,
            timeout=60,
        )

        if resp.status_code != 200:
            yield f"API error: {resp.status_code}"
            return

        for line in resp.iter_lines():
            if not line:
                continue
            line = line.decode("utf-8")
            if not line.startswith("data: "):
                continue
            data = line[6:]
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
                if chunk.get("type") == "content_block_delta":
                    delta = chunk.get("delta", {})
                    if delta.get("type") == "text_delta":
                        yield delta.get("text", "")
            except json.JSONDecodeError:
                continue

    # ── Main pipe handler ─────────────────────────────────────────────────

    async def pipe(
        self,
        body: dict,
        __user__: dict = None,
        __event_emitter__=None,
        __task__=None,
        __model__=None,
        **kwargs,
    ) -> Union[str, Generator]:

        # Determine mode from selected model ID
        model_id = body.get("model", "")
        if "dm" in model_id.lower():
            mode = "dm"
        else:
            mode = "player"

        self._current_mode = mode

        # Handle special tasks (title generation etc.) simply
        if __task__ and __task__ != "chat":
            messages = self._convert_messages(body.get("messages", []))
            if not messages:
                return "Vallombrosa Loremaster"
            return self._call_anthropic(
                "Generate a short, concise title for this conversation.",
                messages,
            )

        # Emit loading status
        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": "Consulting the campaign archives...",
                        "done": False,
                    },
                }
            )

        # Build system prompt
        tier1 = self._ensure_tier1(mode)
        header = DM_SYSTEM_HEADER if mode == "dm" else PLAYER_SYSTEM_HEADER
        system_prompt = header + tier1

        # Convert messages
        messages = self._convert_messages(body.get("messages", []))
        if not messages:
            return "Please ask a question about the Vallombrosa campaign or D&D 5e rules."

        # RAG: embed the user's latest message and inject context
        user_query = messages[-1].get("content", "")
        rag_context = ""
        try:
            rag_context = self._build_rag_context(user_query, mode)
        except Exception as e:
            print(f"[Loremaster] RAG failed: {e}")

        if rag_context:
            # Inject RAG context alongside the user's message
            messages[-1]["content"] = (
                user_query + "\n\n" + rag_context
            )

        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": "The Loremaster is composing a response...",
                        "done": False,
                    },
                }
            )

        # Call Anthropic with tools
        tools = self._tool_definitions()
        result = self._call_anthropic(system_prompt, messages, tools=tools)

        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {"description": "Complete", "done": True},
                }
            )

        return result
