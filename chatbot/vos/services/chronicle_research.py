"""Research pass for the session chronicler.

The DM's notes are the only source of what happened. The wiki is the only
source of how it is spelled, who it belongs to, and what was already true —
and the difference between those two roles is the whole reason this pass
exists separately from the drafting one.

A single retrieval over a whole session's notes returns the top few chunks
for an average of everything that happened, which is close to useless: a
three-hour session touches a dozen subjects and the vector store answers one
question at a time. So this fans out. A cheap model reads the notes against
the canonical name catalog and says what the session was *about* — resolving
the misspellings and the half-names a DM types at midnight back to real
entities — and then one retrieval runs per subject. What comes back is
merged, deduped, and handed to the drafter as labelled blocks with their
source files attached, so a claim can be traced to the page it came from.

Every failure path degrades to plain keyword topics rather than to nothing:
a chronicle drafted with thin context is worth more than no chronicle.
"""

from ..imports import *
from ..symbols import *
from ..config import *

CHRONICLE_SUBJECT_SYSTEM = """You read a DM's raw session notes and say what \
the session was about, so the app can look those subjects up in its own wiki.

You are given the catalog of canonical campaign names. Your job is matching, \
not writing: never describe anyone, never summarize the session, and never \
invent a name.

Return one JSON object and nothing else:
{
  "entities": ["Exact Canonical Name"],
  "topics": ["short search phrase"],
  "unknown": ["a name the notes use that is not in the catalog"]
}

- "entities": every catalog entity the notes actually involve, written with \
the exact canonical spelling from the catalog even when the notes misspell \
it, abbreviate it, or refer to it only by role or relationship. A group name \
resolves to the group entry.
- "topics": up to eight short phrases naming subjects the notes raise that \
are not catalog entities — a ritual, a rumour, an organisation, a place, an \
event. These become wiki searches, so write them the way a wiki page would \
be titled, not as questions.
- "unknown": names the notes clearly treat as people, places, or things but \
that are not in the catalog. These are candidates for new wiki pages, so \
copy them exactly as the notes spell them.

Guessing costs accuracy here: a wrong canonical name pins the chronicle to \
the wrong character. Leave a list empty rather than filling it."""


def _chronicle_notes_text(raw_notes, extra_sources=None):
    """The DM's material as one block, sources labelled. Long transcripts are
    truncated from the middle: the opening and the ending of a session are
    where the notes are densest, and a hard head-truncation loses the part
    that says how it ended."""
    parts = [str(raw_notes or "").strip()]
    extra = str(extra_sources or "").strip()
    if extra:
        parts.append("--- Additional material ---\n" + extra)
    text = "\n\n".join(part for part in parts if part)
    if len(text) <= CHRONICLE_MAX_NOTES_CHARS:
        return text
    keep = CHRONICLE_MAX_NOTES_CHARS // 2
    return (
        text[:keep]
        + "\n\n[… middle of the notes omitted for length …]\n\n"
        + text[-keep:]
    )


def _chronicle_fallback_subjects(notes):
    """No model, or the model failed: mine the notes for capitalized runs and
    treat the longest paragraphs as topics. Crude, and enough to retrieve on."""
    names = []
    seen = set()
    for match in re.finditer(r"\b([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})", notes or ""):
        candidate = match.group(1).strip()
        if len(candidate) < 4:
            continue
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(candidate)
    paragraphs = [
        para.strip()
        for para in re.split(r"\n\s*\n", notes or "")
        if len(para.strip()) > 60
    ]
    paragraphs.sort(key=len, reverse=True)
    return {
        "entities": [],
        "topics": [para[:200] for para in paragraphs[:4]] + names[:8],
        "unknown": [],
    }


def _chronicle_resolve_subjects(notes):
    """Ask the cheap model what this session is about, against the catalog.

    Returns (subjects, warning). Any failure returns the fallback and a
    warning string — never an exception, because a research pass that raises
    costs the DM the whole chronicle.
    """
    fallback = _chronicle_fallback_subjects(notes)
    if not ANTHROPIC_API_KEY:
        return fallback, "ANTHROPIC_API_KEY is not set; used keyword subjects."

    catalog = _descriptions_catalog()
    user_message = (
        "ENTITY CATALOG — the only canonical names in this campaign:\n\n"
        f"{catalog or '(the catalog is empty)'}\n\n"
        "RAW SESSION NOTES:\n\n"
        f"{notes}\n\n"
        "Return the JSON object now."
    )
    try:
        response = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": CHRONICLE_RESEARCH_MODEL,
                "max_tokens": CHRONICLE_RESEARCH_MAX_TOKENS,
                "system": CHRONICLE_SUBJECT_SYSTEM,
                "messages": [{"role": "user", "content": user_message}],
            },
            timeout=CHRONICLE_RESEARCH_TIMEOUT_S,
        )
        if response.status_code != 200:
            return fallback, f"Subject resolution failed: {response.text[:200]}"
        text = "\n".join(
            block.get("text", "")
            for block in response.json().get("content") or []
            if block.get("type") == "text"
        )
        parsed = _extract_json_object(text)
    except Exception as exc:
        logging.exception("Chronicle subject resolution failed")
        return fallback, f"Subject resolution failed: {str(exc)[:200]}"

    def _clean(values, limit):
        out = []
        seen = set()
        for value in values if isinstance(values, list) else []:
            item = str(value or "").strip()[:160]
            if not item or item.lower() in seen:
                continue
            seen.add(item.lower())
            out.append(item)
            if len(out) >= limit:
                break
        return out

    subjects = {
        "entities": _clean(parsed.get("entities"), 20),
        "topics": _clean(parsed.get("topics"), 10),
        "unknown": _clean(parsed.get("unknown"), 12),
    }
    if not subjects["entities"] and not subjects["topics"]:
        return fallback, "Subject resolution returned nothing; used keyword subjects."
    return subjects, None


def _chronicle_retrieval_queries(subjects, notes):
    """One query per subject, entities first — they are the ones whose
    spelling and history the drafter must not get wrong. The notes' opening
    paragraph rides along so a session about something the catalog has never
    heard of still retrieves on its own words."""
    queries = []
    seen = set()

    def _add(query):
        text = str(query or "").strip()
        if len(text) < 3:
            return
        key = text.lower()
        if key in seen or len(queries) >= CHRONICLE_MAX_QUERIES:
            return
        seen.add(key)
        queries.append(text)

    for name in subjects.get("entities") or []:
        _add(name)
    for topic in subjects.get("topics") or []:
        _add(topic)
    for name in subjects.get("unknown") or []:
        _add(name)
    lead = (notes or "").strip()
    if lead:
        _add(lead[:400])
    return queries


def _chronicle_context(notes, subjects):
    """Run every query, merge what comes back into one labelled corpus.

    Blocks are deduped on (name, source_file) and kept at their best score;
    5e rules chunks are dropped outright — the drafter is writing about a
    night at a table, not about the grapple rules.
    """
    by_key = {}
    per_query = []
    for query in _chronicle_retrieval_queries(subjects, notes):
        try:
            auto_inject, additional = engine.retrieve(query, rules=False)
        except Exception:
            logging.exception("Chronicle retrieval failed for %r", query)
            continue
        hits = []
        for match in auto_inject:
            source_file = match.get("source_file") or ""
            if source_file.startswith("5e-filtered/"):
                continue
            name = match.get("name") or source_file or "Unknown"
            key = (name.lower(), source_file)
            score = float(match.get("score") or 0)
            hits.append(name)
            existing = by_key.get(key)
            if existing and existing["score"] >= score:
                continue
            by_key[key] = {
                "name": name,
                "source_file": source_file,
                "url": _source_file_url(source_file),
                "score": score,
                "text": (match.get("text") or "")[:3000],
            }
        per_query.append({
            "query": query,
            "hits": hits[:8],
            "near_misses": [m.get("name") for m in (additional or [])[:5]],
        })

    matches = sorted(by_key.values(), key=lambda item: -item["score"])
    matches = matches[:CHRONICLE_MAX_CONTEXT_BLOCKS]

    blocks = []
    for item in matches:
        header = f"### {item['name']}"
        if item["source_file"]:
            header += f"  ({item['source_file']})"
        blocks.append(f"{header}\n{item['text']}")
    context_text = "\n\n".join(blocks) if blocks else "(no matching wiki context found)"

    return {
        "subjects": subjects,
        "queries": per_query,
        "matches": [
            {
                "name": item["name"],
                "source_file": item["source_file"],
                "url": item["url"],
                "score": item["score"],
            }
            for item in matches
        ],
        "text": context_text[:CHRONICLE_CONTEXT_CHARS],
    }


def _chronicle_known_pages():
    """Titles and URLs of every page the drafter is allowed to propose an
    edit to. Without this it proposes edits to pages that do not exist, and
    the publisher then has to guess whether that was a new page or a typo."""
    pages = []
    for root in WIKI_CONTENT_ROOTS:
        base = SITE_SOURCE_DIR / root
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            url = _source_file_url(path.relative_to(SITE_SOURCE_DIR).as_posix())
            if not url:
                continue
            try:
                with open(path, encoding="utf-8") as handle:
                    head = handle.read(2048)
            except OSError:
                continue
            title = _wiki_source_title(head)
            if title:
                pages.append({"title": title, "url": url})
    return pages


def _chronicle_page_catalog(pages, limit=400):
    lines = [f"- {page['title']} — {page['url']}" for page in pages[:limit]]
    return "\n".join(lines)


def _chronicle_research(raw_notes, extra_sources=None):
    """The whole pass: notes in, grounded research context out."""
    notes = _chronicle_notes_text(raw_notes, extra_sources)
    subjects, warning = _chronicle_resolve_subjects(notes)
    context = _chronicle_context(notes, subjects)
    context["warning"] = warning
    context["notes_chars"] = len(notes)
    return notes, context, warning


__all__ = [
    'CHRONICLE_SUBJECT_SYSTEM',
    '_chronicle_notes_text',
    '_chronicle_fallback_subjects',
    '_chronicle_resolve_subjects',
    '_chronicle_retrieval_queries',
    '_chronicle_context',
    '_chronicle_known_pages',
    '_chronicle_page_catalog',
    '_chronicle_research',
]
