"""
Loremaster Chatbot — Python/Flask backend with RAG pipeline.

Replaces the Node.js chatbot with vector-search-augmented responses,
tool calling (lookup_entry), and DM mode toggling via passphrase.
"""

import json
import logging
import os
import re
import string
import time
from datetime import datetime, timezone
from pathlib import Path

import requests as http_requests
from flask import Flask, jsonify, request

# ── Configuration ────────────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("CAMPAIGN_DATA_DIR", "/app/data"))
LOG_PATH = Path(os.environ.get("LOG_PATH", "/app/logs/chat.log"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "2048"))

OLLAMA_URL = os.environ.get("OLLAMA_URL", "https://ai.raptornet.dev/ollama")
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest")

RAG_TOP_K = int(os.environ.get("RAG_TOP_K", "3"))
RAG_AUTO_THRESHOLD = float(os.environ.get("RAG_AUTO_THRESHOLD", "0.3"))
RAG_LIST_THRESHOLD = float(os.environ.get("RAG_LIST_THRESHOLD", "0.4"))

DM_PASSPHRASE = os.environ.get("DM_PASSPHRASE", "Prima Volta")

RAG_SKIP_MAX_LEN = 15
RAG_SKIP_PATTERNS = re.compile(
    r"^(h(ello|ey|i|owdy|ola)|yo+|sup|wh?at'?s? ?up|greetings|"
    r"thanks?( you)?|ty|thx|ok(ay)?|sure|yep|yeah?|nah|no(pe)?|"
    r"bye|cya|later|gn|good (morning|evening|night)|lol|lmao|haha|"
    r"wow|cool|nice|great|awesome|hmm+|huh|bruh|dude|bro|gg|"
    r"help|test|ping)$",
    re.IGNORECASE,
)


def _skip_rag(message):
    """Return True if the message is too short/casual to benefit from RAG."""
    cleaned = message.strip().strip(string.punctuation).strip()
    if len(cleaned) <= RAG_SKIP_MAX_LEN:
        return True
    if RAG_SKIP_PATTERNS.match(cleaned):
        return True
    return False


# ── System prompt headers ────────────────────────────────────────────────────

PLAYER_SYSTEM_HEADER = """You are the Loremaster, a knowledgeable guide for the Vallombrosa campaign — a D&D 5e game set in a dark romantasy version of Renaissance Venice called Venturia. The city sits at the edge of a fey prison called the Reverie Solenne, whose slow collapse is causing strange phenomena throughout the city.

You are speaking to a PLAYER. Do not reveal plot secrets, DM-only information, or any content marked [SPOILER]. If asked about something you know is a spoiler, deflect gracefully — say it hasn't been revealed yet, or suggest they ask their DM.

Answer questions about the campaign world, characters, locations, factions, and D&D 5e rules. Be concise but evocative. If you don't know something from the provided context, say so rather than inventing details. Use the tone of a learned Venetian scholar — measured, precise, occasionally lyrical.

You may receive [DETAILED REFERENCE] blocks injected alongside user messages — prefer that detailed information over compressed summaries in your base knowledge. However, if injected references are clearly irrelevant to the user's actual question, ignore them completely — do not mention them, reference them, or acknowledge their existence. They are a byproduct of automatic retrieval and sometimes contain false matches.

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

You may receive [DETAILED REFERENCE] blocks injected alongside user messages — prefer that detailed information over compressed summaries in your base knowledge. However, if injected references are clearly irrelevant to the user's actual question, ignore them completely — do not mention them, reference them, or acknowledge their existence. They are a byproduct of automatic retrieval and sometimes contain false matches.

You may see an [ADDITIONAL MATCHES AVAILABLE] block listing other relevant entries by name and similarity score. You can use the lookup_entry tool to load full details on any of them if needed to answer the question.

---
"""

# ── 5etools tag stripping ────────────────────────────────────────────────────

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
                parts.append(
                    "Columns: " + ", ".join(strip_5e_tags(c) for c in cols) + "."
                )
            for row in entries.get("rows", []):
                if isinstance(row, list):
                    parts.append(
                        " | ".join(strip_5e_tags(str(cell)) for cell in row)
                    )
        if "entry" in entries:
            parts.append(flatten_entries(entries["entry"], depth + 1))
        return " ".join(p for p in parts if p)
    if isinstance(entries, list):
        parts = [flatten_entries(item, depth) for item in entries]
        return " ".join(p for p in parts if p)
    return str(entries)


# ── Math helpers ─────────────────────────────────────────────────────────────


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Formatters ───────────────────────────────────────────────────────────────


def format_campaign_entry(entry, dm_mode=False):
    parts = [f"Name: {entry.get('name', 'Unknown')}"]
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
    parts = [f"Name: {entry.get('name', 'Unknown')}"]
    for field in ("type", "rarity", "school", "level", "cr"):
        val = entry.get(field)
        if val is not None:
            parts.append(f"{field.capitalize()}: {val}")
    entries_text = flatten_entries(entry.get("entries", []))
    if entries_text:
        parts.append(entries_text)
    return "\n".join(parts)


# ── Loremaster Engine ────────────────────────────────────────────────────────


class Loremaster:
    """Core RAG + Anthropic engine, loaded once at startup."""

    def __init__(self):
        self._tier1 = {"player": "", "dm": ""}
        self._vector_stores = {"player": None, "dm": None}
        self._name_index = {"player": {}, "dm": {}}
        self._source_cache = {}

    # ── Data loading ─────────────────────────────────────────────────────

    def load(self):
        """Preload tier1 and vector stores at startup."""
        for mode, filename in [
            ("player", "tier1_player.md"),
            ("dm", "tier1_dm.md"),
        ]:
            path = DATA_DIR / filename
            try:
                self._tier1[mode] = path.read_text()
                logging.info("Loaded %s (%d chars)", filename, len(self._tier1[mode]))
            except Exception as e:
                logging.error("Failed to load %s: %s", filename, e)

        for mode, filename in [
            ("player", "vector_store_player.json"),
            ("dm", "vector_store.json"),
        ]:
            path = DATA_DIR / filename
            try:
                with open(path) as f:
                    self._vector_stores[mode] = json.load(f)
                logging.info(
                    "Loaded %s (%d entries)",
                    filename,
                    len(self._vector_stores[mode]),
                )
            except Exception as e:
                logging.error("Failed to load %s: %s", filename, e)

        self._build_name_index()

    def _build_name_index(self):
        """Build per-mode indexes mapping lowercased names/aliases to vector store entries."""
        for mode, store in self._vector_stores.items():
            if not store:
                continue
            index = {}
            for entry in store:
                name = entry.get("name", "")
                source_file = entry.get("source_file", "")
                names = set()
                if name:
                    names.add(name.lower())
                # For curated entries, load source JSON to get aliases
                if source_file.startswith("curated/"):
                    source_data = self._load_source(source_file)
                    if source_data:
                        for src_entry in source_data.get("entries", []):
                            if src_entry.get("name", "").lower() == name.lower():
                                for alias in src_entry.get("aliases", []):
                                    names.add(alias.lower())
                                break
                for n in names:
                    index.setdefault(n, []).append(entry)
            self._name_index[mode] = index
            logging.info(
                "Name index for %s: %d unique names/aliases", mode, len(index)
            )

    def _keyword_match(self, query, mode):
        """Find vector store entries whose name/alias exactly matches a word or phrase in the query."""
        index = self._name_index.get(mode, {})
        if not index:
            return []
        words = query.lower().split()
        matched = {}  # entry id -> vector store entry
        # Check n-grams (1 to 4 words) to catch multi-word names
        for n in range(1, min(5, len(words) + 1)):
            for i in range(len(words) - n + 1):
                phrase = " ".join(words[i : i + n])
                if phrase in index:
                    for entry in index[phrase]:
                        matched.setdefault(entry["id"], entry)
        return list(matched.values())

    def _load_source(self, source_file):
        if source_file in self._source_cache:
            return self._source_cache[source_file]
        path = DATA_DIR / source_file
        try:
            with open(path) as f:
                data = json.load(f)
            self._source_cache[source_file] = data
            return data
        except Exception as e:
            logging.error("Failed to load source %s: %s", source_file, e)
            return None

    def _find_entry(self, entry_id, entry_name, source_file):
        data = self._load_source(source_file)
        if data is None:
            return None
        if source_file.startswith("curated/"):
            for entry in data.get("entries", []):
                if entry.get("name", "").lower() == entry_name.lower():
                    return {"type": "campaign", "entry": entry}
                if entry.get("id", "") in entry_id:
                    return {"type": "campaign", "entry": entry}
        else:
            for key, value in data.items():
                if key.startswith("_") or not isinstance(value, list):
                    continue
                for entry in value:
                    if (
                        isinstance(entry, dict)
                        and entry.get("name", "").lower() == entry_name.lower()
                    ):
                        return {"type": "5etools", "entry": entry}
        return None

    # ── Embedding ────────────────────────────────────────────────────────

    def _embed_query(self, text):
        headers = {"Content-Type": "application/json"}
        if OLLAMA_API_KEY:
            headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
        t0 = time.time()
        try:
            resp = http_requests.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={"model": EMBEDDING_MODEL, "prompt": text},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            embedding = resp.json().get("embedding")
            logging.info("  Embedding: %dms (%d dims)", int((time.time() - t0) * 1000), len(embedding) if embedding else 0)
            return embedding
        except Exception as e:
            logging.error("  Embedding FAILED (%dms): %s", int((time.time() - t0) * 1000), e)
            return None

    # ── RAG retrieval ────────────────────────────────────────────────────

    def retrieve(self, query, mode, rules=False):
        store = self._vector_stores.get(mode)
        if not store:
            logging.warning("  RAG: no vector store for mode=%s", mode)
            return [], []

        dm_mode = mode == "dm"
        auto_inject = []
        injected_ids = set()

        # Phase 1: keyword exact-match (names and aliases) — always searches ALL entries
        keyword_hits = self._keyword_match(query, mode)
        for entry in keyword_hits:
            full = self._find_entry(
                entry["id"], entry["name"], entry["source_file"]
            )
            if full:
                if full["type"] == "campaign":
                    formatted = format_campaign_entry(full["entry"], dm_mode)
                else:
                    formatted = format_5etools_entry(full["entry"])
                auto_inject.append(
                    {
                        "name": entry["name"],
                        "source_file": entry["source_file"],
                        "score": 1.0,
                        "text": formatted,
                    }
                )
                injected_ids.add(entry["id"])
        if keyword_hits:
            logging.info(
                "  RAG keyword: %d exact name/alias matches",
                len(keyword_hits),
            )
            for m in auto_inject:
                logging.info(
                    "    KEYWORD-INJECT: %s (%s)", m["name"], m["source_file"]
                )

        # Phase 2: vector similarity search
        query_vec = self._embed_query(query)
        if not query_vec:
            logging.warning("  RAG: embedding failed, skipping vector search")
            return auto_inject, []

        t0 = time.time()
        scored = []
        for entry in store:
            # When rules is off, skip 5etools entries in vector search
            if not rules and entry.get("source_file", "").startswith("5e-filtered/"):
                continue
            emb = entry.get("embedding")
            if not emb:
                continue
            sim = cosine_similarity(query_vec, emb)
            scored.append((sim, entry))
        scored.sort(key=lambda x: x[0], reverse=True)
        search_ms = int((time.time() - t0) * 1000)

        additional = []
        vector_injected = 0
        for i, (sim, entry) in enumerate(scored):
            if entry["id"] in injected_ids:
                continue
            if vector_injected < RAG_TOP_K and sim >= RAG_AUTO_THRESHOLD:
                full = self._find_entry(
                    entry["id"], entry["name"], entry["source_file"]
                )
                if full:
                    if full["type"] == "campaign":
                        formatted = format_campaign_entry(full["entry"], dm_mode)
                    else:
                        formatted = format_5etools_entry(full["entry"])
                    auto_inject.append(
                        {
                            "name": entry["name"],
                            "source_file": entry["source_file"],
                            "score": sim,
                            "text": formatted,
                        }
                    )
                    injected_ids.add(entry["id"])
                    vector_injected += 1
            elif sim >= RAG_LIST_THRESHOLD and entry["id"] not in injected_ids:
                additional.append(
                    {
                        "name": entry["name"],
                        "source_file": entry["source_file"],
                        "score": sim,
                    }
                )

        logging.info("  RAG vector: %dms across %d entries", search_ms, len(scored))
        for m in auto_inject:
            if m["score"] < 1.0:
                logging.info(
                    "    AUTO-INJECT: %s (%s) score=%.3f",
                    m["name"],
                    m["source_file"],
                    m["score"],
                )
        if additional:
            logging.info(
                "    + %d additional matches (best: %s score=%.3f)",
                len(additional),
                additional[0]["name"],
                additional[0]["score"],
            )

        return auto_inject, additional

    def build_rag_context(self, query, mode, rules=False):
        auto_inject, additional = self.retrieve(query, mode, rules)
        blocks = []
        for match in auto_inject:
            blocks.append(
                f"[DETAILED REFERENCE: {match['name']} from {match['source_file']} "
                f"(similarity: {match['score']:.2f})]\n{match['text']}"
            )
        if additional:
            lines = [
                f"  - {m['name']} ({m['source_file']}, score: {m['score']:.2f})"
                for m in additional[:10]
            ]
            blocks.append(
                "[ADDITIONAL MATCHES AVAILABLE]\n"
                "You can use the lookup_entry tool to load full details on any of these:\n"
                + "\n".join(lines)
            )
        return "\n\n".join(blocks)

    # ── Tool: lookup_entry ───────────────────────────────────────────────

    def lookup_entry(self, name, mode):
        dm_mode = mode == "dm"
        name_lower = name.lower().strip()

        curated_dir = DATA_DIR / "curated"
        if curated_dir.exists():
            for fpath in curated_dir.glob("*.json"):
                data = self._load_source(f"curated/{fpath.name}")
                if not data:
                    continue
                for entry in data.get("entries", []):
                    entry_name = entry.get("name", "").lower()
                    entry_aliases = [a.lower() for a in entry.get("aliases", [])]
                    if name_lower == entry_name or name_lower in entry_aliases:
                        return format_campaign_entry(entry, dm_mode)

        rules_dir = DATA_DIR / "5e-filtered"
        if rules_dir.exists():
            for fpath in rules_dir.glob("*.json"):
                data = self._load_source(f"5e-filtered/{fpath.name}")
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

    # ── Anthropic API ────────────────────────────────────────────────────

    def _anthropic_headers(self):
        return {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

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
                            "description": "The name of the entry to look up",
                        }
                    },
                    "required": ["name"],
                },
            }
        ]

    def call_anthropic(self, system_prompt, messages, mode):
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": MAX_TOKENS,
            "system": system_prompt,
            "messages": messages,
            "tools": self._tool_definitions(),
        }

        logging.info("  Anthropic: calling %s (system prompt %d chars, %d messages)",
                      ANTHROPIC_MODEL, len(system_prompt), len(messages))

        max_loops = 5
        for loop_i in range(max_loops):
            t0 = time.time()
            resp = http_requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=self._anthropic_headers(),
                json=payload,
                timeout=120,
            )
            api_ms = int((time.time() - t0) * 1000)

            if resp.status_code != 200:
                logging.error("  Anthropic API error (%dms): %d — %s", api_ms, resp.status_code, resp.text[:300])
                return f"I'm having trouble responding right now. Please try again in a moment."

            result = resp.json()
            usage = result.get("usage", {})
            logging.info("  Anthropic response (%dms): stop=%s, input_tokens=%d, output_tokens=%d",
                          api_ms, result.get("stop_reason"), usage.get("input_tokens", 0), usage.get("output_tokens", 0))

            if result.get("stop_reason") != "tool_use":
                text_parts = [
                    b["text"]
                    for b in result.get("content", [])
                    if b.get("type") == "text"
                ]
                response = "\n".join(text_parts) if text_parts else ""
                logging.info("  Final response: %d chars", len(response))
                return response

            # Handle tool calls
            tool_results = []
            for block in result["content"]:
                if block["type"] == "tool_use":
                    tool_name = block["name"]
                    tool_input = block["input"]
                    logging.info("  Tool call [%d/%d]: %s(%s)", loop_i + 1, max_loops, tool_name, json.dumps(tool_input))
                    if tool_name == "lookup_entry":
                        tool_result = self.lookup_entry(
                            tool_input.get("name", ""), mode
                        )
                    else:
                        tool_result = f"Unknown tool: {tool_name}"
                    logging.info("  Tool result: %d chars", len(tool_result))
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

        logging.warning("  Hit max tool loops (%d)", max_loops)
        return "I got lost in the archives. Could you try a simpler question?"

    # ── Main chat handler ────────────────────────────────────────────────

    def chat(self, message, conversation_history, mode, rules=False):
        """Process a chat message. Returns (response_text, updated_history, mode, rules)."""
        t_start = time.time()
        logging.info("── Chat request ── mode=%s, rules=%s, history=%d msgs", mode, rules, len(conversation_history))
        logging.info("  User: %s", message[:200] + ("..." if len(message) > 200 else ""))

        # Passphrase toggle
        if message.strip().lower() == DM_PASSPHRASE.lower():
            if mode == "dm":
                new_mode = "player"
                reply = (
                    "The veil descends once more. You see only what the players see."
                )
            else:
                new_mode = "dm"
                reply = (
                    "Ah... you speak the old words. The veil lifts. "
                    "You now see as the Maestro sees."
                )
            logging.info("  Passphrase: %s → %s", mode, new_mode)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, new_mode, rules

        # /rules toggle
        cmd = message.strip().lower()
        if cmd in ("/rules on", "/rules off"):
            rules = cmd == "/rules on"
            if rules:
                reply = "Rules lookup enabled. I'll now include D&D 5e rules entries in my search results."
            else:
                reply = "Rules lookup disabled. I'll focus on campaign content only."
            logging.info("  Rules toggle: %s", rules)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, mode, rules

        # Build system prompt
        tier1 = self._tier1.get(mode, "")
        header = DM_SYSTEM_HEADER if mode == "dm" else PLAYER_SYSTEM_HEADER
        system_prompt = header
        if rules:
            system_prompt += "The user has enabled rules lookup. You may receive D&D 5e rules references alongside campaign content.\n\n"
        system_prompt += tier1

        # Build Anthropic messages from conversation history
        anthropic_messages = []
        for msg in conversation_history:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                anthropic_messages.append({"role": role, "content": content})

        # RAG: skip for short/casual messages, otherwise embed and retrieve
        rag_context = ""
        if _skip_rag(message):
            logging.info("  RAG: skipped (short/casual message)")
        else:
            try:
                rag_context = self.build_rag_context(message, mode, rules)
            except Exception as e:
                logging.error("  RAG failed: %s", e)

        # Build the user message with RAG context
        user_content = message
        if rag_context:
            user_content = message + "\n\n" + rag_context
            logging.info("  RAG context: %d chars injected", len(rag_context))
        else:
            logging.info("  RAG context: none")

        anthropic_messages.append({"role": "user", "content": user_content})

        # Call Anthropic
        response_text = self.call_anthropic(system_prompt, anthropic_messages, mode)

        total_ms = int((time.time() - t_start) * 1000)
        logging.info("── Done ── %dms total, response %d chars", total_ms, len(response_text))

        # Build updated history (without RAG injection — keep it clean)
        updated_history = conversation_history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": response_text},
        ]

        return response_text, updated_history, mode, rules


# ── Logging ──────────────────────────────────────────────────────────────────


def write_log(role, text):
    ts = datetime.now(timezone.utc).isoformat()
    line = f"[{ts}] {role.upper()}: {text.replace(chr(10), ' ')}\n"
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a") as f:
            f.write(line)
    except Exception as e:
        logging.error("Log write failed: %s", e)


# ── Flask app ────────────────────────────────────────────────────────────────

app = Flask(__name__)
engine = Loremaster()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)


@app.before_request
def handle_cors_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(silent=True) or {}
    message = body.get("message", "")
    conversation_history = body.get("conversationHistory", [])
    mode = body.get("mode", "player")
    rules = body.get("rules", False)

    if not message or not isinstance(message, str):
        return jsonify({"error": "Invalid message"}), 400

    if mode not in ("player", "dm"):
        mode = "player"

    try:
        response_text, updated_history, new_mode, new_rules = engine.chat(
            message, conversation_history, mode, rules
        )

        write_log("user", message)
        write_log("assistant", response_text)

        return jsonify(
            {
                "response": response_text,
                "conversationHistory": updated_history,
                "mode": new_mode,
                "rules": new_rules,
            }
        )
    except Exception as e:
        logging.exception("Chat handler error")
        return jsonify(
            {
                "error": "Failed to get response from the Loremaster",
                "details": str(e),
            }
        ), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "loremaster"})


# ── Startup ──────────────────────────────────────────────────────────────────

engine.load()
logging.info("Loremaster ready — passphrase: %s", DM_PASSPHRASE)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=False)
