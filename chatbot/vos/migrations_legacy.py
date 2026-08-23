from .imports import *
from .symbols import *
from .config import *

def apply_legacy_migrations(conn, done):
    if "001_push_subscriptions" not in done:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("001_push_subscriptions", _utc_now_iso()),
        )

    if "002_dm_messages" not in done:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("002_dm_messages", _utc_now_iso()),
        )

    if "003_rsvps" not in done:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rsvps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                player_name TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('going', 'maybe', 'out')),
                updated_at TEXT NOT NULL,
                UNIQUE(event_id, player_name)
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("003_rsvps", _utc_now_iso()),
        )

    if "004_studio_jobs" not in done:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS studio_jobs (
                id TEXT PRIMARY KEY,
                creator TEXT NOT NULL,
                prompt TEXT NOT NULL,
                style TEXT,
                status TEXT NOT NULL CHECK(status IN ('pending', 'done', 'error')),
                result_url TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_studio_jobs_creator_updated
            ON studio_jobs (creator, updated_at DESC)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("004_studio_jobs", _utc_now_iso()),
        )

    if "005_targeted_dm_messages" not in done:
        columns = _table_columns(conn, "messages")
        if "url" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN url TEXT NOT NULL DEFAULT '/'")
        if "target_type" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all'")
        if "deleted_at" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN deleted_at TEXT")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS message_recipients (
                message_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                PRIMARY KEY (message_id, player_name)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_message_recipients_player
            ON message_recipients (player_name, message_id)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS push_deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER,
                player_name TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('sent', 'failed', 'pruned')),
                error TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_push_deliveries_message
            ON push_deliveries (message_id, created_at DESC)
        """)
        conn.execute("""
            UPDATE messages
            SET url = COALESCE(NULLIF(url, ''), '/'),
                target_type = COALESCE(NULLIF(target_type, ''), 'all')
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("005_targeted_dm_messages", _utc_now_iso()),
        )

    if "006_lore_submissions" not in done:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS lore_submissions (
                id TEXT PRIMARY KEY,
                submitter TEXT NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('item', 'person', 'place', 'faction', 'lore')),
                title TEXT NOT NULL,
                slug TEXT NOT NULL,
                short_description TEXT NOT NULL,
                connections_json TEXT NOT NULL,
                notes TEXT,
                status TEXT NOT NULL CHECK(status IN (
                    'submitted', 'drafting', 'needs_review', 'approved',
                    'rejected', 'published', 'error'
                )),
                context_json TEXT,
                generated_markdown TEXT,
                generated_summary TEXT,
                generated_image_prompt TEXT,
                image_url TEXT,
                image_filename TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                published_at TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lore_submissions_status_updated
            ON lore_submissions (status, updated_at DESC)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lore_submissions_submitter_updated
            ON lore_submissions (submitter, updated_at DESC)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("006_lore_submissions", _utc_now_iso()),
        )

    if "007_message_dismissals" not in done:
        # Recipient-side soft delete for DM messages. A broadcast
        # ("all") message is dismissed per-player here; targeted
        # messages still live in message_recipients but a row here
        # hides them from that one recipient's home feed.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS message_dismissals (
                message_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                dismissed_at TEXT NOT NULL,
                PRIMARY KEY (message_id, player_name)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_message_dismissals_player
            ON message_dismissals (player_name, message_id)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("007_message_dismissals", _utc_now_iso()),
        )

    if "009_culture_kind" not in done:
        # Widen the lore_submissions.kind CHECK constraint to include
        # 'culture'. SQLite has no ALTER for CHECK constraints, so this
        # rebuilds the table. Indexes are dropped with the old table and
        # recreated below; existing rows are preserved.
        conn.execute("""
            CREATE TABLE lore_submissions_new (
                id TEXT PRIMARY KEY,
                submitter TEXT NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN (
                    'item', 'person', 'place', 'faction', 'lore', 'culture'
                )),
                title TEXT NOT NULL,
                slug TEXT NOT NULL,
                short_description TEXT NOT NULL,
                connections_json TEXT NOT NULL,
                notes TEXT,
                status TEXT NOT NULL CHECK(status IN (
                    'submitted', 'drafting', 'needs_review', 'approved',
                    'rejected', 'published', 'error'
                )),
                context_json TEXT,
                generated_markdown TEXT,
                generated_summary TEXT,
                generated_image_prompt TEXT,
                image_url TEXT,
                image_filename TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                published_at TEXT
            )
        """)
        conn.execute("""
            INSERT INTO lore_submissions_new (
                id, submitter, kind, title, slug, short_description,
                connections_json, notes, status, context_json,
                generated_markdown, generated_summary, generated_image_prompt,
                image_url, image_filename, error_message,
                created_at, updated_at, published_at
            )
            SELECT
                id, submitter, kind, title, slug, short_description,
                connections_json, notes, status, context_json,
                generated_markdown, generated_summary, generated_image_prompt,
                image_url, image_filename, error_message,
                created_at, updated_at, published_at
            FROM lore_submissions
        """)
        conn.execute("DROP TABLE lore_submissions")
        conn.execute("ALTER TABLE lore_submissions_new RENAME TO lore_submissions")
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lore_submissions_status_updated
            ON lore_submissions (status, updated_at DESC)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lore_submissions_submitter_updated
            ON lore_submissions (submitter, updated_at DESC)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("009_culture_kind", _utc_now_iso()),
        )

    if "008_in_play" not in done:
        # Live overlay for the "Currently In Play" cards on home and the
        # Venturia hub. The static campaign.js list still ships as a
        # fallback; client JS replaces it once the API responds.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS in_play (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT '',
                kind TEXT NOT NULL DEFAULT '',
                emblem TEXT NOT NULL DEFAULT '',
                link TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_in_play_sort
            ON in_play (sort_order, id)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("008_in_play", _utc_now_iso()),
        )

    if "010_card_fields" not in done:
        # Persist AI-generated stat-card fields so the publisher can
        # render the gold-bordered card on top of any kind (not just
        # items). NULL is fine — non-item submissions before this
        # column existed will publish with just the body, same as
        # before. Items keep their existing field-inference path.
        cols = _table_columns(conn, "lore_submissions")
        if "generated_card_fields_json" not in cols:
            conn.execute(
                "ALTER TABLE lore_submissions ADD COLUMN "
                "generated_card_fields_json TEXT"
            )
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("010_card_fields", _utc_now_iso()),
        )

__all__ = ['apply_legacy_migrations']
