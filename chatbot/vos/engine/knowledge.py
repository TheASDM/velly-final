from ..imports import *
from ..symbols import *
from ..config import *

class KnowledgeMixin:
    _VEC_SQLITE_SCHEMA_VERSION = "2"

    def load(self):
        """Preload tier1 and vector store at startup."""
        with self._load_lock:
            if self._vec_db is not None:
                try:
                    self._vec_db.close()
                except Exception:
                    pass
                self._vec_db = None

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
                    raw = json.load(f)
                # Accept both shapes: the legacy `[entry, ...]` and the new
                # `{meta: {...}, entries: [...]}`. Once every deploy is on
                # the new format we can drop the legacy branch.
                if isinstance(raw, dict) and isinstance(raw.get("entries"), list):
                    self._vector_store = raw["entries"]
                    meta = raw.get("meta") or {}
                    logging.info(
                        "Loaded vector_store.json (%d entries, built %s, model %s)",
                        len(self._vector_store),
                        meta.get("built_at", "?"),
                        meta.get("embedding_model", "?"),
                    )
                    # Stale-deploy warning: if tier1.md on disk doesn't
                    # match the hash baked into the vector store, the
                    # embeddings might be out of sync with the system prompt.
                    tier1_hash = meta.get("tier1_hash") or ""
                    if tier1_hash and self._tier1:
                        actual = hashlib.sha256(self._tier1.encode("utf-8")).hexdigest()
                        if actual != tier1_hash:
                            logging.warning(
                                "vector_store.json tier1_hash mismatch — "
                                "vectors may be stale (rerun build_vectors.py)"
                            )
                elif isinstance(raw, list):
                    self._vector_store = raw
                    logging.info(
                        "Loaded vector_store.json (%d entries, legacy shape)",
                        len(self._vector_store),
                    )
                else:
                    logging.error("vector_store.json has unexpected shape — empty store")
                    self._vector_store = []
            except Exception as e:
                logging.error("Failed to load vector_store.json: %s", e)
                self._vector_store = []

            # ID→entry map for the sqlite-vec retrieval path (and a few
            # other lookups). Built before _init_vector_sqlite because
            # that uses it implicitly via self._vector_store.
            self._entries_by_id = {
                e.get("id"): e
                for e in (self._vector_store or [])
                if e.get("id")
            }

            self._build_name_index()
            self._init_vector_sqlite()
            self._loaded_data_signature = self._data_signature()

    def _data_signature(self):
        signature = []
        for filename in ("tier1.md", "vector_store.json"):
            path = DATA_DIR / filename
            try:
                stat = path.stat()
                signature.append((filename, stat.st_mtime_ns, stat.st_size))
            except OSError:
                signature.append((filename, None, None))
        return tuple(signature)

    def reload_if_stale(self, force=False):
        signature = self._data_signature()
        if not force and signature == self._loaded_data_signature:
            return False
        logging.info("Reloading Enzo knowledge after source rebuild")
        self.load()
        return True

    @staticmethod
    def _normalize(text):
        """Lowercase, accent-fold, drop apostrophes/quotes/hyphens, then
        collapse whitespace. Lets 'Caravel’s backstory' match the
        'Caravel' alias and 'San Lorenzo's' match 'san lorenzo'."""
        if not text:
            return ""
        text = unicodedata.normalize("NFKD", str(text))
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        text = text.lower()
        # Strip apostrophes (incl. curly), quotes, hyphens; keep other
        # word-separators (spaces, slashes) as-is so n-gram boundaries
        # stay sensible.
        text = re.sub(r"[’'‘“”\"\-]+", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _build_name_index(self):
        """Map normalized names AND aliases to vector store entries.
        Normalization (NFKD + accent-fold + lowercase + apostrophe-strip)
        lets the keyword matcher catch 'Caravel’s', 'Caravel,',
        accented variants, etc."""
        index = {}
        for entry in self._vector_store or []:
            names = set()
            name = entry.get("name", "")
            if name:
                names.add(self._normalize(name))
            for alias in entry.get("aliases", []) or []:
                if alias:
                    names.add(self._normalize(alias))
            names.discard("")
            for n in names:
                index.setdefault(n, []).append(entry)
        self._name_index = index
        logging.info(
            "Name index: %d unique names/aliases across %d entries",
            len(index), len(self._vector_store or []),
        )

    def _vector_source_hash(self):
        """sha256 of vector_store.json — used to detect rebuilds needed."""
        try:
            path = DATA_DIR / "vector_store.json"
            h = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    h.update(chunk)
            return h.hexdigest()
        except Exception:
            return ""

    def _existing_vec_meta(self):
        """Return (source_hash, schema_version) baked into the existing
        sqlite file, or (None, None) if missing/unreadable."""
        if not VECTOR_SQLITE_PATH.exists():
            return None, None
        try:
            con = sqlite3.connect(VECTOR_SQLITE_PATH)
            rows = con.execute(
                "SELECT key, value FROM vec_meta WHERE key IN (?, ?)",
                ("source_hash", "schema_version"),
            ).fetchall()
            con.close()
            meta = dict(rows)
            return meta.get("source_hash"), meta.get("schema_version")
        except Exception:
            return None, None

    def _init_vector_sqlite(self):
        """Load (and if necessary rebuild) the sqlite-vec index. Falls
        back to leaving self._vec_db = None when the extension can't
        load — retrieve() then takes the Python-loop path."""
        try:
            import sqlite_vec
        except ImportError:
            logging.warning(
                "sqlite-vec not installed; vector search will use the "
                "Python cosine fallback."
            )
            return
        if not self._vector_store:
            return

        # Detect embedding dimension from the first entry that has one.
        dim = 0
        for entry in self._vector_store:
            emb = entry.get("embedding")
            if emb:
                dim = len(emb)
                break
        if not dim:
            logging.warning("No embeddings in vector_store.json — sqlite-vec disabled")
            return
        self._vec_dim = dim

        source_hash = self._vector_source_hash()
        existing_hash, existing_schema = self._existing_vec_meta()
        if (
            source_hash
            and existing_hash == source_hash
            and existing_schema == self._VEC_SQLITE_SCHEMA_VERSION
        ):
            logging.info(
                "Vector sqlite index up-to-date (source_hash=%s…, schema=v%s)",
                source_hash[:12], existing_schema,
            )
        else:
            logging.info(
                "Rebuilding vector_store.sqlite3 "
                "(source_hash=%s, was=%s; schema=v%s, was=v%s)",
                (source_hash or "?")[:12], (existing_hash or "none")[:12],
                self._VEC_SQLITE_SCHEMA_VERSION, existing_schema or "none",
            )
            if VECTOR_SQLITE_PATH.exists():
                try:
                    VECTOR_SQLITE_PATH.unlink()
                except Exception as e:
                    logging.warning("Could not unlink stale vec db: %s", e)

            try:
                con = sqlite3.connect(VECTOR_SQLITE_PATH)
                con.enable_load_extension(True)
                sqlite_vec.load(con)
                con.enable_load_extension(False)
            except Exception as e:
                logging.error(
                    "sqlite-vec failed to load (extension support disabled "
                    "in libsqlite3?). Falling back to Python loop. %s", e,
                )
                return

            con.execute("CREATE TABLE vec_meta (key TEXT PRIMARY KEY, value TEXT)")
            # distance_metric=cosine keeps the ordering identical to the
            # legacy cosine_similarity path. is_5e filter was originally
            # an auxiliary `+is_5e` column here, but vec0 KNN queries
            # don't allow WHERE constraints on auxiliary columns, so we
            # pull a wider candidate set and filter in Python (cheap at
            # this size).
            con.execute(
                f"CREATE VIRTUAL TABLE vec_entries USING vec0("
                f"  embedding float[{dim}] distance_metric=cosine, "
                f"  +entry_id TEXT"
                f")"
            )
            inserted = 0
            rowid = 1
            for entry in self._vector_store:
                emb = entry.get("embedding")
                if not emb or len(emb) != dim:
                    continue
                try:
                    con.execute(
                        "INSERT INTO vec_entries (rowid, embedding, entry_id) "
                        "VALUES (?, ?, ?)",
                        (rowid, sqlite_vec.serialize_float32(emb), entry.get("id", "")),
                    )
                    inserted += 1
                    rowid += 1
                except Exception as e:
                    logging.warning("vec_entries insert failed for %s: %s", entry.get("id"), e)
            con.execute(
                "INSERT INTO vec_meta (key, value) VALUES (?, ?)",
                ("source_hash", source_hash),
            )
            con.execute(
                "INSERT INTO vec_meta (key, value) VALUES (?, ?)",
                ("schema_version", self._VEC_SQLITE_SCHEMA_VERSION),
            )
            con.execute(
                "INSERT INTO vec_meta (key, value) VALUES (?, ?)",
                ("entry_count", str(inserted)),
            )
            con.execute(
                "INSERT INTO vec_meta (key, value) VALUES (?, ?)",
                ("dim", str(dim)),
            )
            con.commit()
            con.close()
            logging.info(
                "vector_store.sqlite3 rebuilt with %d entries (dim=%d, schema=v%s)",
                inserted, dim, self._VEC_SQLITE_SCHEMA_VERSION,
            )

        # Open the long-lived connection for retrieve() to query.
        try:
            con = sqlite3.connect(VECTOR_SQLITE_PATH, check_same_thread=False)
            con.enable_load_extension(True)
            sqlite_vec.load(con)
            con.enable_load_extension(False)
            self._vec_db = con
            logging.info("sqlite-vec ready (dim=%d)", dim)
        except Exception as e:
            logging.error("Could not open vector_store.sqlite3: %s", e)
            self._vec_db = None

    def _vec_search(self, query_vec, rules, limit):
        """Cosine top-k via sqlite-vec. Returns list of (similarity, entry).

        vec0 doesn't permit WHERE filters on auxiliary columns in a KNN
        query, so we pull a wider candidate set and filter is_5e in
        Python. When rules=False, ~95% of the store is 5e content, so
        we ask for several times more candidates than RAG_TOP_K to
        guarantee enough campaign rows survive."""
        if not self._vec_db:
            return None
        try:
            import sqlite_vec
        except ImportError:
            return None
        # When rules is off and the store is mostly 5e, widen the SQL
        # candidate set so the post-filter has enough campaign rows left.
        sql_limit = limit if rules else max(limit * 4, 200)
        try:
            q_blob = sqlite_vec.serialize_float32(query_vec)
            rows = self._vec_db.execute(
                "SELECT entry_id, distance FROM vec_entries "
                "WHERE embedding MATCH ? "
                "ORDER BY distance LIMIT ?",
                (q_blob, sql_limit),
            ).fetchall()
        except Exception as e:
            logging.warning("vec0 query failed, falling back to Python: %s", e)
            return None

        scored = []
        for entry_id, distance in rows:
            entry = self._entries_by_id.get(entry_id)
            if not entry:
                continue
            if not rules and (entry.get("source_file") or "").startswith("5e-filtered/"):
                continue
            sim = 1.0 - float(distance)
            scored.append((sim, entry))
            if len(scored) >= limit:
                break
        return scored

    def _keyword_match(self, query):
        """Find vector store entries whose name/alias matches an n-gram
        in the query. Both query and index are normalized via _normalize
        so punctuation/accents don't break the lookup."""
        if not self._name_index:
            return []
        words = self._normalize(query).split()
        matched = {}
        for n in range(1, min(5, len(words) + 1)):
            for i in range(len(words) - n + 1):
                phrase = " ".join(words[i : i + n])
                if phrase in self._name_index:
                    for entry in self._name_index[phrase]:
                        matched.setdefault(entry["id"], entry)
        return list(matched.values())

__all__ = ['KnowledgeMixin']
