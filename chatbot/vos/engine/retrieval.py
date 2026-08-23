from ..imports import *
from ..symbols import *
from ..config import *

def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class RetrievalMixin:
    def _embed_query(self, text):
        headers = {"Content-Type": "application/json"}
        if OLLAMA_API_KEY:
            headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
        # Three attempts with exponential backoff. A flaky Ollama
        # silently used to drop us to zero-context responses; the
        # retry covers transient hiccups (network, restart, brief
        # 5xx) without making the user re-ask.
        delays_ms = [100, 300, 900]
        last_error = None
        t0 = time.time()
        for attempt, delay_ms in enumerate(delays_ms + [0]):
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
                    "  Embedding: %dms total (%d attempt%s, %d dims)",
                    int((time.time() - t0) * 1000),
                    attempt + 1, "" if attempt == 0 else "s",
                    len(embedding) if embedding else 0,
                )
                return embedding
            except Exception as e:
                last_error = e
                if attempt < len(delays_ms):
                    logging.warning(
                        "  Embedding attempt %d failed: %s — retrying in %dms",
                        attempt + 1, e, delay_ms,
                    )
                    time.sleep(delay_ms / 1000.0)
                    continue
        logging.error(
            "  Embedding FAILED after %d attempts (%dms): %s",
            len(delays_ms) + 1, int((time.time() - t0) * 1000), last_error,
        )
        return None

    def _expand_query(self, text):
        """Ask Haiku for 3-5 alternate phrasings of the user query and
        append them to the original. Embedding the expanded text widens
        recall without changing the visible query. Cached for
        QUERY_EXPANSION_CACHE_TTL seconds per process."""
        cleaned = (text or "").strip()
        if not cleaned or len(cleaned) < 8:
            return text
        if not ANTHROPIC_API_KEY:
            return text

        key = hashlib.sha256(cleaned.lower().encode()).hexdigest()
        now = time.time()
        cached = self._query_expansion_cache.get(key)
        if cached and (now - cached[0]) < QUERY_EXPANSION_CACHE_TTL:
            logging.debug("  Query expansion: cache hit")
            return cached[1]

        try:
            resp = http_requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=self._anthropic_headers(),
                json={
                    "model": ANTHROPIC_MODEL,
                    "max_tokens": 200,
                    "system": (
                        "You are a query expansion helper for a wiki search "
                        "system. Given a user query, suggest 3-5 alternate "
                        "phrasings or alias terms that might appear in the "
                        "wiki. Return ONLY the expansions, one per line. No "
                        "preamble, no numbering, no quotes, no markdown. "
                        "Skip the original query."
                    ),
                    "messages": [{"role": "user", "content": cleaned}],
                    "temperature": 0.2,
                },
                timeout=8,
            )
            if resp.status_code != 200:
                logging.warning(
                    "  Query expansion HTTP %d: %s",
                    resp.status_code, resp.text[:200],
                )
                return text
            data = resp.json()
            lines = []
            for block in data.get("content") or []:
                if block.get("type") != "text":
                    continue
                for raw in (block.get("text") or "").splitlines():
                    stripped = raw.strip().lstrip("-*•0123456789. ").strip()
                    if stripped and stripped.lower() != cleaned.lower():
                        lines.append(stripped)
            if lines:
                expanded = cleaned + "\n" + "\n".join(lines[:5])
            else:
                expanded = text

            if len(self._query_expansion_cache) >= QUERY_EXPANSION_CACHE_MAX:
                oldest = min(self._query_expansion_cache.items(), key=lambda kv: kv[1][0])
                self._query_expansion_cache.pop(oldest[0], None)
            self._query_expansion_cache[key] = (now, expanded)
            logging.debug(
                "  Query expansion: %d → %d chars (+%d aliases)",
                len(cleaned), len(expanded), len(lines),
            )
            return expanded
        except Exception as e:
            logging.warning("  Query expansion failed: %s", e)
            return text

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

        # Phase 2: vector similarity search. Run the query through
        # Haiku-based expansion first so a short user message gets a
        # wider semantic net cast for retrieval. The keyword matcher
        # above already used the original query so we don't dilute
        # exact name matches.
        embed_input = self._expand_query(query) if QUERY_EXPANSION_ENABLED else query
        query_vec = self._embed_query(embed_input)
        if not query_vec:
            logging.warning("  RAG: embedding failed, skipping vector search")
            return auto_inject, []

        t0 = time.time()
        # Prefer the sqlite-vec index when available (sub-millisecond on
        # the current ~3k-entry store). Falls back to the in-memory
        # Python cosine loop when the extension didn't load or the
        # index isn't built (first-boot edge cases).
        candidate_cap = max(RAG_TOP_K * 8, 64)
        vec_scored = self._vec_search(query_vec, rules, candidate_cap)
        if vec_scored is not None:
            scored = vec_scored
            scored.sort(key=lambda x: x[0], reverse=True)
            search_path = "sqlite-vec"
        else:
            scored = []
            for entry in store:
                if not rules and entry.get("source_file", "").startswith("5e-filtered/"):
                    continue
                emb = entry.get("embedding")
                if not emb:
                    continue
                sim = cosine_similarity(query_vec, emb)
                scored.append((sim, entry))
            scored.sort(key=lambda x: x[0], reverse=True)
            search_path = "python-loop"
        search_ms = int((time.time() - t0) * 1000)
        logging.info("  Vector search (%s): %dms, %d candidates",
                     search_path, search_ms, len(scored))

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
        """Build the RAG context block AND the structured citations list
        that the chat endpoint surfaces to the client. Returns
        (text_block, citations) where citations is a list of
        {name, score, url} dicts deduplicated by source_file.

        When a 5e rules entry gets injected via keyword/alias match
        while the user has rules-mode OFF (Phase-1 retrieval doesn't
        filter source), it's almost always a name collision — a
        campaign NPC/place/item that happens to share a word with a
        spell or monster. We still include the entry so Claude has the
        data, but wrap it with a clear 'this is probably not what the
        user wants' header and skip it from the user-facing citation
        chips so the Sources row stays honest."""
        auto_inject, additional = self.retrieve(query, rules)
        blocks = []
        citations = []
        seen = set()
        for match in auto_inject:
            source = match.get("source_file") or ""
            is_5e_collision = (
                not rules and source.startswith("5e-filtered/")
            )
            if is_5e_collision:
                blocks.append(
                    f"[POSSIBLE NAME COLLISION — 5e rule entry, rules-mode is OFF]\n"
                    f"The user's message exact-name-matches this 5e rules "
                    f"entry ({match['name']!r} from {source}), but rules-mode "
                    f"is off — they're asking a campaign question. Treat this "
                    f"as a coincidental name collision (a campaign NPC, place, "
                    f"or item that happens to share a word with this 5e term). "
                    f"Do NOT reference this entry, its mechanics, or its 5e "
                    f"flavor in your reply unless the user explicitly asked "
                    f"for the rule. Look for a campaign entity with this name "
                    f"instead.\n{match['text']}"
                )
                # Skip the citation: the player would see this 5e entry as a
                # "source" even though Claude shouldn't (and won't) be leaning
                # on it. Misleading. The keyword inject log still records it
                # for DM visibility in the chatbot logs.
                continue
            blocks.append(
                f"[DETAILED REFERENCE: {match['name']} from {source} "
                f"(similarity: {match['score']:.2f})]\n{match['text']}"
            )
            if source in seen:
                continue
            seen.add(source)
            citations.append({
                "name": match.get("name") or "",
                "score": round(float(match.get("score", 0.0)), 3),
                "url": _source_file_url(source),
                "source_file": source,
            })
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
        return "\n\n".join(blocks), citations

    def lookup_entry(self, name):
        """Find a page by exact name/alias match. Long pages are stored as
        multiple chunks in the vector store — this reassembles all chunks of
        the matching page into a single full-text response."""
        name_norm = self._normalize(name)
        entries = self._name_index.get(name_norm) if name_norm else None
        if not entries:
            # Fall back to substring search against normalized names
            entries = [e for e in (self._vector_store or [])
                       if name_norm and name_norm in self._normalize(e.get("name", ""))]
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

__all__ = ['cosine_similarity', 'RetrievalMixin']
