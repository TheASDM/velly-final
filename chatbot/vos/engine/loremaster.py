from ..imports import *
from ..symbols import *
from ..config import *

from .anthropic import AnthropicMixin
from .knowledge import KnowledgeMixin
from .retrieval import RetrievalMixin


class Loremaster(KnowledgeMixin, RetrievalMixin, AnthropicMixin):
    def __init__(self):
        self._tier1 = ""
        self._vector_store = None
        self._name_index = {}
        # Per-process cache for query expansion. Key: sha256(query.lower()),
        # value: (timestamp, expanded_text). Bounded + TTL'd so a long-
        # running worker doesn't grow unbounded.
        self._query_expansion_cache = {}
        # sqlite-vec index. None when the extension can't load (we then
        # fall back to the Python cosine loop). Populated by load().
        self._vec_db = None
        self._vec_dim = 0
        self._entries_by_id = {}
        self._loaded_data_signature = None
        self._load_lock = threading.RLock()

    def chat(self, message, conversation_history, rules=False, vibe=None, viewer=None):
        """Process a chat message. Returns (response_text, updated_history, rules, vibe).

        `viewer` is who is asking — {"name", "is_dm", "preview"} — resolved
        from the caller's credential, never from anything the client asserts.
        See _viewer_note() for what it currently does and does not change."""
        self.reload_if_stale()
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
            return reply, updated_history, rules, vibe, []

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
            return reply, updated_history, rules, vibe, []

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
            return reply, updated_history, rules, vibe, []

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
            return reply, updated_history, rules, vibe, []

        # /brainstorm toggle — character-development mode (a different role,
        # not just a personality skin like the other vibes).
        if cmd in ("/brainstorm on", "/brainstorm off"):
            vibe = "brainstorm" if cmd == "/brainstorm on" else None
            if vibe:
                rules = False
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
            return reply, updated_history, rules, vibe, []

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
        system_prompt += _viewer_note(viewer)
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
        citations = []
        if _skip_rag(message):
            logging.info("  RAG: skipped (short/casual message)")
        else:
            try:
                rag_context, citations = self.build_rag_context(message, rules)
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
        return response_text, updated_history, rules, vibe, citations

    def chat_stream(self, message, conversation_history, rules=False, vibe=None, viewer=None):
        """Streaming variant of chat(). Yields the same event dicts
        as call_anthropic_stream() plus a final
        {type: 'meta', conversationHistory, rules, vibe, citations}.

        For command toggles (/rules on/off, /vibe ...), there's nothing
        to stream — yields a single token event with the full reply
        followed by the meta event. Keeps the client renderer uniform."""
        self.reload_if_stale()
        cmd = (message or "").strip().lower()

        # Run the same toggle handling as chat() but yield instead of
        # return. Falls through to the LLM path on any non-toggle.
        def _yield_toggle_reply(reply, new_rules, new_vibe):
            updated_history = conversation_history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": reply},
            ]
            yield {"type": "token", "text": reply}
            yield {
                "type": "meta",
                "conversationHistory": updated_history,
                "rules": new_rules,
                "vibe": new_vibe,
                "citations": [],
            }

        # Delegate toggles to chat() (which returns the full reply
        # already). We get the exact same behaviour without duplicating
        # all the toggle strings.
        if cmd.startswith("/"):
            reply, updated_history, new_rules, new_vibe, citations = self.chat(
                message, conversation_history, rules, vibe
            )
            yield {"type": "token", "text": reply}
            yield {
                "type": "meta",
                "conversationHistory": updated_history,
                "rules": new_rules,
                "vibe": new_vibe,
                "citations": citations,
            }
            return

        # ── Normal flow: mirror chat()'s system-prompt construction ──
        # We can't easily call chat() then stream — by the time chat()
        # returns we've already paid the full latency. So we re-build
        # the prompt here. Tracked refactor target: extract a shared
        # _prepare_prompt() helper next pass.
        t_start = time.time()
        logging.info(
            "── Chat stream ── rules=%s, vibe=%s, history=%d msgs",
            rules, vibe, len(conversation_history),
        )

        if vibe == "brainstorm":
            system_prompt = BRAINSTORM_SYSTEM_HEADER
        else:
            system_prompt = SYSTEM_HEADER
        if vibe == "yasqueen":
            system_prompt += (
                "\nVIBE MODE — YasQueen: respond as a fabulously dramatic "
                "loremaster. Sprinkle in 'honey,' 'darling,' '✨', and exclamations. "
                "Still factually accurate but extra. Reference real campaign "
                "lore as drama. ALWAYS use real names/places — don't pretend.\n\n"
            )
        elif vibe == "fabio":
            system_prompt += (
                "\nVIBE MODE — Fabio: respond as a sultry romance-novel narrator. "
                "Lean into sensuality, longing, and dramatic flourishes — but keep "
                "the lore accurate. References to real campaign content remain "
                "verbatim; only your DELIVERY changes.\n\n"
            )
        elif vibe == "rocky":
            system_prompt += (
                "\nVIBE MODE — Rocky: respond as a salty, no-nonsense quarry "
                "rock. Brief, blunt, occasionally grumpy. When players bring up "
                "social ('honor,' 'betrayal,' 'romance'), express mild confusion or restate them in concrete "
                "terms. Stay accurate to the campaign lore — just deliver it in Rocky's voice.\n\n"
            )
        if rules:
            system_prompt += "The user has enabled rules lookup. You may receive D&D 5e rules references alongside campaign content.\n\n"
        system_prompt += _viewer_note(viewer)
        system_prompt += self._tier1

        anthropic_messages = []
        for msg in conversation_history:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role in ("user", "assistant") and isinstance(content, str):
                anthropic_messages.append({"role": role, "content": content})

        rag_context = ""
        citations = []
        if _skip_rag(message):
            logging.info("  RAG: skipped (short/casual message)")
        else:
            try:
                rag_context, citations = self.build_rag_context(message, rules)
            except Exception as e:
                logging.error("  RAG failed: %s", e)

        user_content = message
        if rag_context:
            user_content = message + "\n\n" + rag_context
            logging.info("  RAG context: %d chars injected", len(rag_context))

        anthropic_messages.append({"role": "user", "content": user_content})

        temp = 0.7 if vibe == "brainstorm" else None

        # Stream the model response, accumulating the full text so the
        # final meta event carries the full assistant message for the
        # history.
        full_response = ""
        for event in self.call_anthropic_stream(system_prompt, anthropic_messages, temperature=temp):
            if event.get("type") == "token":
                full_response += event.get("text", "")
            yield event
            if event.get("type") in ("done", "error"):
                break

        total_ms = int((time.time() - t_start) * 1000)
        logging.info(
            "── Done (stream) ── %dms total, response %d chars",
            total_ms, len(full_response),
        )

        updated_history = conversation_history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": full_response},
        ]
        yield {
            "type": "meta",
            "conversationHistory": updated_history,
            "rules": rules,
            "vibe": vibe,
            "citations": citations,
        }

def _viewer_note(viewer):
    """The one line of system prompt that says who is asking.

    Deliberately small. Enzo's corpus is built by build_tiers.py from
    published wiki content only — Venturia/DM/ and anything `published: false`
    never enters it — so a player cannot be told a DM secret today because no
    DM secret is in the index to retrieve.

    The consequence is the other half of the brief's requirement is not met
    yet either: the DM gets no privileged answers here, because there is no
    privileged tier to search. That needs a second corpus and a second vector
    store, built and rebuilt on the server — a change to the knowledge
    pipeline, not to this file. Until then this note is context, and the
    boundary is still enforced by what was indexed rather than by what the
    prompt asks the model to withhold.

    TODO(DESIGN-PROJECT): DM-visible Enzo knowledge tier
      Intended users: the DM only.
      Required data: campaign-data/tier1-dm.md and a DM-scoped vector
        namespace, both built from Venturia/DM/ by build_tiers.py and
        build_vectors.py, loaded separately by knowledge.py.
      Unresolved: whether preview mode should see the previewed player's
        private handouts, and how retrieval mixes two indexes in one answer.
      Acceptance criteria: retrieval — not the prompt — selects the tier from
        viewer.is_dm; a player token can never surface a DM-tier chunk; and
        rebuilding on the VPS covers both stores.
    """
    if not viewer or not viewer.get("name"):
        return ""
    if viewer.get("preview"):
        return (
            f"\nYou are answering {viewer['name']}. The person at the keyboard is "
            "the DM previewing their app, so answer exactly as you would answer "
            f"{viewer['name']} — nothing the DM knows that they do not.\n\n"
        )
    if viewer.get("is_dm"):
        return "\nYou are answering the DM.\n\n"
    return f"\nYou are answering {viewer['name']}, a player at this table.\n\n"


__all__ = ['Loremaster', '_viewer_note']
