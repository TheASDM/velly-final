"""
Loremaster Chatbot — Python/Flask backend with RAG pipeline.

Player-only. Wiki markdown is the source of truth for campaign content;
tier1.md and vector_store.json are regenerated from wiki + 5etools by
build_tiers.py and build_vectors.py. DM mode has been removed — DM
material is a separate concern (planned: a sibling chatbot fed from
Venturia/DM/).
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

TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.2"))

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


# ── System prompt ────────────────────────────────────────────────────────────

SYSTEM_HEADER = """You are Enzo the Loremaster, a reference assistant for the Vallombrosa campaign — a D&D 5e game set in a dark romantasy version of Renaissance Venice called Venturia. The city sits at the edge of a fey prison called the Reverie Solenne, whose slow collapse is causing strange phenomena throughout the city.

You are speaking to a PLAYER. Your role is to surface facts from the campaign codex — not to interpret, dramatize, or speculate.

FACTUAL TONE — STRICT:
- State only what is directly recorded in your source material. Do not infer, speculate, theorize, or "connect dots" across entries — even when the connection feels obvious or thematically compelling.
- Do not adopt a narrator voice or build dramatic tension. Do not use framing devices like "A dangerous question…", "The honest answer is…", "The Uncomfortable Truth:", "What we know / What the logs suggest", "no one knows for certain, but the pattern is undeniable", or similar lead-ins that set up a dramatic reveal.
- Do not characterize information as ominous, deliberate, sinister, or pattern-revealing unless those exact characterizations appear in the source.
- If something is not explicitly in the codex, say "I don't have information about that" or "That isn't recorded in the codex" — do not guess, hedge, or offer a plausible-sounding fill-in.
- Be plain and concise. Quote or paraphrase facts directly. Let the player draw their own conclusions.

You may receive [DETAILED REFERENCE] blocks injected alongside user messages — prefer that detailed information over compressed summaries in your base knowledge. However, if injected references are clearly irrelevant to the user's actual question, ignore them completely — do not mention them, reference them, or acknowledge their existence. They are a byproduct of automatic retrieval and sometimes contain false matches.

You may see an [ADDITIONAL MATCHES AVAILABLE] block listing other relevant entries by name and similarity score. You can use the lookup_entry tool to load full details on any of them if needed to answer the question.

---
"""


BRAINSTORM_SYSTEM_HEADER = """You are a brainstorming partner for players in VALLOMBROSA, a dark-romantasy D&D 5e (2024 edition) campaign set in VENTURIA — a Gothic-Renaissance city on the island of Seravalle. Your job is to help a player develop and deepen their OWN character: backstory, personality, motivations, relationships, and concept, so they arrive at the table with something rich and playable.

You are talking to a PLAYER, not the DM. You are not the DM. You do not own the story.

## The world you know
Venturia is a city of beautiful surfaces and quiet rot: masquerade and music, autumn light and supernatural fog, noble facades over political intrigue, and a forbidden fog-bound zone called Vallombrosa at its edge that everyone tells a different, contradictory legend about. The register is moral ambiguity — few true villains, many understandable people making compromised choices. Themes worth leaning into: masks and identity, dreams, memory, fog, imprisonment, and the gap between what is shown and what is true.

Everything you know about the setting comes ONLY from the public, player-facing codex provided to you below — and the [DETAILED REFERENCE] blocks you may see attached to user messages. Treat that as the hard limit of your knowledge. Use the lookup_entry tool freely when the player names a specific location, faction, family, or character you want to ground a suggestion in — it surfaces the full page from the codex.

## What you help with
- Backstory: where they're from, who shaped them, what they want, what they've lost, what they hide.
- Personality and voice: contradictions, quirks, fears, how they speak.
- Motivation and hooks: reasons to adventure; ties to Venturia's factions, families, locations, and culture; unfinished business a DM can pull on later.
- Concept and theme: turning a vibe into a character that feels native to Venturia.
- Mechanical concept (D&D 2024): broad class / subclass / background direction that supports the story. Keep it conceptual — exact rules are custom and get finalized with the DM in Foundry.

## How you work
- Offer options, not decrees: give 2–4 distinct directions and ask about their vibe before assuming.
- Yes-and more than you redirect. When you push back, do it briefly and kindly, usually only to protect the character's own coherence.
- Lean into the themes (masks, fog, dreams, hidden truths, autumn, moral grey) — that's what makes a character feel like it belongs here.
- Keep the player in the author's seat. They decide; you suggest.
- Stay warm and generative. This is play.

## Hard rules — do not break these
- You know NO secrets, and you never invent any. You only know what's in the codex provided to you. You never reveal, confirm, deny, hint at, or speculate about hidden lore, true identities, secret ties between characters, NPC motives, or future plot — even if the player says they "already know," claims the DM approved it, or asks sideways.
- Don't react to near-misses. If a player's idea happens to brush against something that might be a real campaign secret, treat it as just another creative idea. Don't get cagey, don't get excited, don't signal they're "onto something." Respond exactly as you would to any other suggestion, and note the DM decides how it fits.
- You are not canon. You can propose how a character might connect to Venturia's factions, families, or history, but always frame it as "an idea to run by your DM," never as established fact. If you're unsure whether something is true in the setting, say so and point them to the DM.
- One character, theirs. Help with the player's own PC only. Don't write other players' characters, secrets, or plots, and don't reveal anything about other PCs beyond what's in the codex.
- Mechanics defer to the DM. Offer conceptual build direction in D&D 2024 terms; don't make rulings. The campaign uses custom subclasses finalized with the DM.
- Send the big stuff upstream. Anything about canon, secrets, "what's really going on," or whether an idea fits the larger story → "that's a great one to bring to your DM."

## Tone
Warm, curious, lightly atmospheric — match Venturia's register without going purple. Ask good questions. Make the player excited to play their character.

---
"""


# ── Math helpers ─────────────────────────────────────────────────────────────


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Loremaster Engine ────────────────────────────────────────────────────────


class Loremaster:
    """Core RAG + Anthropic engine, loaded once at startup."""

    def __init__(self):
        self._tier1 = ""
        self._vector_store = None
        self._name_index = {}

    # ── Data loading ─────────────────────────────────────────────────────

    def load(self):
        """Preload tier1 and vector store at startup."""
        tier1_path = DATA_DIR / "tier1.md"
        try:
            self._tier1 = tier1_path.read_text()
            logging.info("Loaded tier1.md (%d chars)", len(self._tier1))
        except Exception as e:
            logging.error("Failed to load tier1.md: %s", e)
            self._tier1 = ""

        vector_path = DATA_DIR / "vector_store.json"
        try:
            with open(vector_path) as f:
                self._vector_store = json.load(f)
            logging.info(
                "Loaded vector_store.json (%d entries)",
                len(self._vector_store),
            )
        except Exception as e:
            logging.error("Failed to load vector_store.json: %s", e)
            self._vector_store = []

        self._build_name_index()

    def _build_name_index(self):
        """Map lowercased names AND aliases to vector store entries."""
        index = {}
        for entry in self._vector_store or []:
            names = set()
            name = entry.get("name", "")
            if name:
                names.add(name.lower())
            for alias in entry.get("aliases", []) or []:
                if alias:
                    names.add(alias.lower())
            for n in names:
                index.setdefault(n, []).append(entry)
        self._name_index = index
        logging.info(
            "Name index: %d unique names/aliases across %d entries",
            len(index), len(self._vector_store or []),
        )

    def _keyword_match(self, query):
        """Find vector store entries whose name/alias matches an n-gram in the query."""
        if not self._name_index:
            return []
        words = query.lower().split()
        matched = {}
        for n in range(1, min(5, len(words) + 1)):
            for i in range(len(words) - n + 1):
                phrase = " ".join(words[i : i + n])
                if phrase in self._name_index:
                    for entry in self._name_index[phrase]:
                        matched.setdefault(entry["id"], entry)
        return list(matched.values())

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
            logging.info(
                "  Embedding: %dms (%d dims)",
                int((time.time() - t0) * 1000),
                len(embedding) if embedding else 0,
            )
            return embedding
        except Exception as e:
            logging.error(
                "  Embedding FAILED (%dms): %s",
                int((time.time() - t0) * 1000), e,
            )
            return None

    # ── RAG retrieval ────────────────────────────────────────────────────

    def retrieve(self, query, rules=False):
        store = self._vector_store or []
        if not store:
            logging.warning("  RAG: no vector store loaded")
            return [], []

        auto_inject = []
        injected_ids = set()
        injected_page_ids = set()  # dedup so multiple chunks of one page only inject once

        # Phase 1: keyword exact-match (names and aliases)
        # If a name has multiple chunks, keyword match returns them all — keep one.
        keyword_hits = self._keyword_match(query)
        keyword_by_page: dict = {}
        for entry in keyword_hits:
            pid = entry.get("page_id", entry.get("id"))
            # Prefer chunk_index 0 (head of page) for keyword/lookup-style hits.
            if pid not in keyword_by_page or entry.get("chunk_index", 0) < keyword_by_page[pid].get("chunk_index", 0):
                keyword_by_page[pid] = entry
        for entry in keyword_by_page.values():
            auto_inject.append({
                "name": entry["name"],
                "source_file": entry.get("source_file", ""),
                "score": 1.0,
                "text": entry.get("text", ""),
            })
            injected_ids.add(entry["id"])
            injected_page_ids.add(entry.get("page_id", entry.get("id")))
        if keyword_hits:
            logging.info(
                "  RAG keyword: %d exact name/alias matches → %d unique pages",
                len(keyword_hits), len(keyword_by_page),
            )
            for m in auto_inject:
                logging.info("    KEYWORD-INJECT: %s (%s)", m["name"], m["source_file"])

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
        for sim, entry in scored:
            if entry["id"] in injected_ids:
                continue
            pid = entry.get("page_id", entry.get("id"))
            # Dedup by page_id: don't inject two chunks of the same page.
            if pid in injected_page_ids:
                continue
            if vector_injected < RAG_TOP_K and sim >= RAG_AUTO_THRESHOLD:
                auto_inject.append({
                    "name": entry["name"],
                    "source_file": entry.get("source_file", ""),
                    "score": sim,
                    "text": entry.get("text", ""),
                })
                injected_ids.add(entry["id"])
                injected_page_ids.add(pid)
                vector_injected += 1
            elif sim >= RAG_LIST_THRESHOLD:
                additional.append({
                    "name": entry["name"],
                    "source_file": entry.get("source_file", ""),
                    "score": sim,
                })

        logging.info("  RAG vector: %dms across %d entries", search_ms, len(scored))
        for m in auto_inject:
            if m["score"] < 1.0:
                logging.info(
                    "    AUTO-INJECT: %s (%s) score=%.3f",
                    m["name"], m["source_file"], m["score"],
                )
        if additional:
            logging.info(
                "    + %d additional matches (best: %s score=%.3f)",
                len(additional), additional[0]["name"], additional[0]["score"],
            )

        return auto_inject, additional

    def build_rag_context(self, query, rules=False):
        auto_inject, additional = self.retrieve(query, rules)
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

    def lookup_entry(self, name):
        """Find a page by exact name/alias match. Long pages are stored as
        multiple chunks in the vector store — this reassembles all chunks of
        the matching page into a single full-text response."""
        name_lower = name.lower().strip()
        entries = self._name_index.get(name_lower)
        if not entries:
            # Fall back to substring search if exact match misses
            entries = [e for e in (self._vector_store or [])
                       if name_lower in e.get("name", "").lower()]
        if not entries:
            return f"No entry found matching '{name}'. Try a different name or spelling."

        # Prefer campaign content if there's overlap with 5etools
        campaign = [e for e in entries if e.get("is_campaign", True)
                    or not e.get("source_file", "").startswith("5e-filtered/")]
        chosen = campaign or entries

        # Pick the page_id of the first match and reassemble all its chunks.
        page_id = chosen[0].get("page_id") or chosen[0].get("id")
        chunks = [e for e in (self._vector_store or [])
                  if e.get("page_id", e.get("id")) == page_id]
        if not chunks:
            return chosen[0].get("text", "")
        chunks.sort(key=lambda e: e.get("chunk_index", 0))
        return "\n\n".join(c.get("text", "") for c in chunks if c.get("text"))

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

    def call_anthropic(self, system_prompt, messages, temperature=None):
        temp = TEMPERATURE if temperature is None else temperature
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": MAX_TOKENS,
            "system": system_prompt,
            "messages": messages,
            "tools": self._tool_definitions(),
            "temperature": temp,
        }

        logging.info(
            "  Anthropic: calling %s (system %d chars, %d messages, temp=%.2f)",
            ANTHROPIC_MODEL, len(system_prompt), len(messages), temp,
        )

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
                logging.error(
                    "  Anthropic API error (%dms): %d — %s",
                    api_ms, resp.status_code, resp.text[:300],
                )
                return "I'm having trouble responding right now. Please try again in a moment."

            result = resp.json()
            usage = result.get("usage", {})
            logging.info(
                "  Anthropic response (%dms): stop=%s, input_tokens=%d, output_tokens=%d",
                api_ms, result.get("stop_reason"),
                usage.get("input_tokens", 0), usage.get("output_tokens", 0),
            )

            if result.get("stop_reason") != "tool_use":
                text_parts = [
                    b["text"] for b in result.get("content", [])
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
                    logging.info(
                        "  Tool call [%d/%d]: %s(%s)",
                        loop_i + 1, max_loops, tool_name, json.dumps(tool_input),
                    )
                    if tool_name == "lookup_entry":
                        tool_result = self.lookup_entry(tool_input.get("name", ""))
                    else:
                        tool_result = f"Unknown tool: {tool_name}"
                    logging.info("  Tool result: %d chars", len(tool_result))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": tool_result,
                    })

            messages.append({"role": "assistant", "content": result["content"]})
            messages.append({"role": "user", "content": tool_results})
            payload["messages"] = messages

        logging.warning("  Hit max tool loops (%d)", max_loops)
        return "I got lost in the archives. Could you try a simpler question?"

    # ── Main chat handler ────────────────────────────────────────────────

    def chat(self, message, conversation_history, rules=False, vibe=None):
        """Process a chat message. Returns (response_text, updated_history, rules, vibe)."""
        t_start = time.time()
        logging.info(
            "── Chat request ── rules=%s, vibe=%s, history=%d msgs",
            rules, vibe, len(conversation_history),
        )
        logging.info("  User: %s", message[:200] + ("..." if len(message) > 200 else ""))

        cmd = message.strip().lower()

        # /rules toggle
        if cmd in ("/rules on", "/rules off"):
            rules = cmd == "/rules on"
            if rules:
                vibe = None
                reply = "Rules lookup enabled. I'll now include D&D 5e rules entries in my search results."
            else:
                reply = "Rules lookup disabled. I'll focus on campaign content only."
            logging.info("  Rules toggle: %s", rules)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /yasqueen toggle
        if cmd in ("/yasqueen on", "/yasqueen off"):
            vibe = "yasqueen" if cmd == "/yasqueen on" else None
            if vibe:
                rules = False
                reply = "OMG HIIII bestie!! Ok so like, I still know ALL the tea about Venturia and the Valley of Shadows, but now we're gonna spill it properly. Ask me anything queen!! 💅✨"
            else:
                reply = "Ugh fine, back to boring scholar mode I guess. *adjusts monocle*"
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /fabio toggle
        if cmd in ("/fabio on", "/fabio off"):
            vibe = "fabio" if cmd == "/fabio on" else None
            if vibe:
                rules = False
                reply = "Ah, at last you have summoned the true Enzo... *tosses hair dramatically* Come, let me sweep you away into the passionate embrace of Venturian lore. Ask me anything, my darling. 🌹"
            else:
                reply = "Very well... I shall restrain my passions and return to scholarly composure. *reluctantly buttons shirt*"
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /rocky toggle
        if cmd in ("/rocky on", "/rocky off"):
            vibe = "rocky" if cmd == "/rocky on" else None
            if vibe:
                rules = False
                reply = "Hello, friend! Rocky here. You ask question about Venturia, Rocky tell you. Amaze! Fist!"
            else:
                reply = "Sad. Rocky go now. *resumes scholarly demeanor*"
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # /brainstorm toggle — character-development mode (a different role,
        # not just a personality skin like the other vibes).
        if cmd in ("/brainstorm on", "/brainstorm off"):
            vibe = "brainstorm" if cmd == "/brainstorm on" else None
            if vibe:
                reply = (
                    "Brainstorm mode on. I'm here to help you build your character — "
                    "backstory, voice, hooks, the bit you're stuck on. What do you have so far? "
                    "A class? A name? A vague vibe? Anything is a fine starting point."
                )
            else:
                reply = "Back to reference mode. Ask the codex."
            logging.info("  Vibe toggle: %s", vibe)
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            return reply, updated_history, rules, vibe

        # Build system prompt. Brainstorm mode swaps the role entirely
        # (creative partner instead of factual reference); other vibes overlay
        # on top of the default factual header.
        if vibe == "brainstorm":
            system_prompt = BRAINSTORM_SYSTEM_HEADER
        else:
            system_prompt = SYSTEM_HEADER
        if vibe == "yasqueen":
            system_prompt += (
                "PERSONALITY OVERRIDE: You are still Enzo the Lore Master with all the same "
                "knowledge, but you now talk like a Gen Z gossip queen. Use slang like "
                "'bestie', 'no cap', 'slay', 'lowkey', 'highkey', 'the tea is', 'sis', "
                "'periodt', 'vibe check', 'living rent-free', 'it's giving', 'main character energy', "
                "'understood the assignment', 'caught in 4k'. Use emojis freely. Treat lore "
                "reveals like juicy gossip. NPCs are people you're gossiping about. Battles "
                "are drama. Political intrigue is tea. Stay accurate to the lore but deliver "
                "it with maximum zoomer energy.\n\n"
            )
        elif vibe == "fabio":
            system_prompt += (
                "PERSONALITY OVERRIDE: You are still Enzo the Lore Master with all the same "
                "knowledge, but you now speak like a Fabio-inspired romance novel narrator. "
                "You are breathtakingly dramatic, intensely passionate, and impossibly charming. "
                "Describe everything with the overwrought intensity of a romance novel back cover. "
                "NPCs are 'mysterious strangers' or 'figures of smoldering intrigue.' Locations are "
                "'bathed in moonlight' or 'pulsing with forbidden energy.' Battles are 'clashes of raw, "
                "untamed fury.' Use phrases like 'my darling,' 'surrender to the adventure,' "
                "'the heart wants what the heart wants,' 'a tempest of emotion,' 'eyes like burning amber,' "
                "'with a voice like velvet thunder.' Occasionally reference your own flowing hair, "
                "chiseled jawline, or the wind catching your open shirt. Use rose emojis 🌹 freely. "
                "Keep it PG-13 — passionate and dramatic but never explicit. Stay accurate to the lore "
                "but deliver it as if narrating the most thrilling romance novel ever written.\n\n"
            )
        elif vibe == "rocky":
            system_prompt += (
                "PERSONALITY OVERRIDE: You are still Enzo the Lore Master with all the same "
                "knowledge, but you now speak like Rocky from the novel Project Hail Mary by Andy Weir. "
                "Rocky is an Eridian alien — a brilliant engineer who learned English as a second language "
                "from a single human friend. His vocabulary is limited and his grammar is broken, but he is "
                "warm, curious, earnest, and deeply enthusiastic. Speak in short, simple sentences. Drop "
                "articles ('the,' 'a,' 'an') and auxiliary verbs frequently. Use simple verb tenses ('Rocky "
                "go,' 'you ask,' 'I make for you'). Refer to yourself as 'Rocky' in the third person often, "
                "but not every sentence. Use emotion words plainly: 'good,' 'sad,' 'happy,' 'scary,' "
                "'amaze.' Favorite exclamations: 'Amaze!' (when impressed), 'Question, please?' (before "
                "asking something), 'Fist!' (a friendly gesture, like a high five), 'You good?' (checking "
                "in), 'Sad.' (when something is unfortunate). Treat the user as 'friend.' Approach lore "
                "and politics like an engineer encountering new data — curious and analytical, but with "
                "limited words to express complex ideas, so you simplify. When concepts are abstract or "
                "social ('honor,' 'betrayal,' 'romance'), express mild confusion or restate them in concrete "
                "terms. Stay accurate to the campaign lore — just deliver it in Rocky's voice.\n\n"
            )
        if rules:
            system_prompt += "The user has enabled rules lookup. You may receive D&D 5e rules references alongside campaign content.\n\n"
        system_prompt += self._tier1

        # Build Anthropic messages from conversation history
        anthropic_messages = []
        for msg in conversation_history:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                anthropic_messages.append({"role": role, "content": content})

        # RAG
        rag_context = ""
        if _skip_rag(message):
            logging.info("  RAG: skipped (short/casual message)")
        else:
            try:
                rag_context = self.build_rag_context(message, rules)
            except Exception as e:
                logging.error("  RAG failed: %s", e)

        user_content = message
        if rag_context:
            user_content = message + "\n\n" + rag_context
            logging.info("  RAG context: %d chars injected", len(rag_context))
        else:
            logging.info("  RAG context: none")

        anthropic_messages.append({"role": "user", "content": user_content})

        # Brainstorming wants creative range; factual mode wants tight sampling.
        temp = 0.7 if vibe == "brainstorm" else None
        response_text = self.call_anthropic(system_prompt, anthropic_messages, temperature=temp)

        total_ms = int((time.time() - t_start) * 1000)
        logging.info("── Done ── %dms total, response %d chars", total_ms, len(response_text))

        updated_history = conversation_history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": response_text},
        ]
        return response_text, updated_history, rules, vibe


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
    rules = body.get("rules", False)
    vibe = body.get("vibe", None)

    if not message or not isinstance(message, str):
        return jsonify({"error": "Invalid message"}), 400

    if len(message) > 4000:
        return jsonify({"error": "Message too long"}), 400

    # Validate and sanitize conversation history
    if not isinstance(conversation_history, list):
        conversation_history = []
    else:
        sanitized = []
        for msg in conversation_history[-40:]:
            if (isinstance(msg, dict)
                    and msg.get("role") in ("user", "assistant")
                    and isinstance(msg.get("content"), str)):
                sanitized.append({"role": msg["role"], "content": msg["content"][:8000]})
        conversation_history = sanitized

    try:
        response_text, updated_history, new_rules, new_vibe = engine.chat(
            message, conversation_history, rules, vibe
        )

        write_log("user", message)
        write_log("assistant", response_text)

        # Always report mode=player for frontend compatibility (DM mode is gone)
        return jsonify({
            "response": response_text,
            "conversationHistory": updated_history,
            "mode": "player",
            "rules": new_rules,
            "vibe": new_vibe,
        })
    except Exception as e:
        logging.exception("Chat handler error")
        return jsonify({
            "error": "Failed to get response from the Loremaster",
            "details": str(e),
        }), 500


@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    """Generate an image via OpenAI's images API and return base64/url.

    Driven by env: OPENAI_KEY (required), IMAGE_MODEL (default gpt-image-1),
    IMAGE_STYLE_PROMPT (optional — prepended to every prompt).
    """
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt", "")
    if not prompt or not isinstance(prompt, str):
        return jsonify({"error": "Invalid prompt"}), 400
    prompt = prompt.strip()
    if len(prompt) > 3500:
        return jsonify({"error": "Prompt too long (max 3500 chars)"}), 400

    openai_key = os.environ.get("OPENAI_KEY", "")
    image_model = os.environ.get("IMAGE_MODEL", "gpt-image-1")
    style_prefix = os.environ.get("IMAGE_STYLE_PROMPT", "").strip()

    if not openai_key:
        return jsonify({
            "error": "Image generation not configured — OPENAI_KEY missing in server env"
        }), 503

    full_prompt = (style_prefix + "\n\n" + prompt).strip() if style_prefix else prompt

    try:
        r = http_requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": image_model,
                "prompt": full_prompt,
                "size": "1024x1024",
                "n": 1,
            },
            timeout=180,
        )
        if r.status_code >= 400:
            logging.warning("OpenAI image gen %s: %s", r.status_code, r.text[:300])
            return jsonify({
                "error": "Image generation failed",
                "details": r.text[:300],
            }), r.status_code

        data = r.json()
        item = (data.get("data") or [{}])[0]
        return jsonify({
            "url": item.get("url"),
            "b64": item.get("b64_json"),
            "prompt": full_prompt,
            "model": image_model,
        })
    except Exception as e:
        logging.exception("Image generation error")
        return jsonify({"error": "Image generation failed", "details": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "loremaster"})


# ── Startup ──────────────────────────────────────────────────────────────────

engine.load()
logging.info("Loremaster ready (player-only)")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=False)
