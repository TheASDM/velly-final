from .imports import *
from .symbols import *
from .config import *

def apply_current_migrations(conn, done):
    if "011_studio_quotas" not in done:
        # Per-player monthly count of /api/studio/generate calls.
        # `period` is 'YYYY-MM' (UTC) so the row keys to the calendar
        # month and resets automatically on the 1st.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS studio_quotas (
                player TEXT NOT NULL,
                period TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (player, period)
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("011_studio_quotas", _utc_now_iso()),
        )

    if "012_gallery_favorites" not in done:
        # Per-player favorite/pin on gallery entries. gallery_id is the
        # 'id' field from the gallery manifest (not a DB FK — manifest
        # is JSON on disk). A favorite row whose entry has been
        # deleted from the manifest is just a dangling pointer the
        # client filters out at render time.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gallery_favorites (
                player TEXT NOT NULL,
                gallery_id TEXT NOT NULL,
                favorited_at TEXT NOT NULL,
                PRIMARY KEY (player, gallery_id)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_gallery_favorites_gallery
            ON gallery_favorites (gallery_id)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("012_gallery_favorites", _utc_now_iso()),
        )

    if "013_studio_job_details" not in done:
        # Preserve the prompt lineage for each generated image so the
        # player-facing submissions page can show what they typed, what
        # Enzo sent to the image model, and the saved gallery image.
        cols = _table_columns(conn, "studio_jobs")
        if "enhanced_prompt" not in cols:
            conn.execute("ALTER TABLE studio_jobs ADD COLUMN enhanced_prompt TEXT")
        if "gallery_id" not in cols:
            conn.execute("ALTER TABLE studio_jobs ADD COLUMN gallery_id TEXT")
        if "title" not in cols:
            conn.execute("ALTER TABLE studio_jobs ADD COLUMN title TEXT")
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("013_studio_job_details", _utc_now_iso()),
        )

    if "014_notes" not in done:
        # Runtime notes are intentionally SQLite-backed instead of
        # markdown-backed: they should save instantly and never require
        # a static rebuild.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                owner TEXT NOT NULL,
                scope TEXT NOT NULL CHECK(scope IN ('private', 'dm')),
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notes_owner_scope_updated
            ON notes (owner, scope, deleted_at, updated_at DESC)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("014_notes", _utc_now_iso()),
        )

    if "015_calendar_events" not in done:
        # DM-scheduled calendar entries. SQLite-backed (not campaign.js)
        # so the DM can schedule from the app without a static rebuild.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                time_label TEXT,
                location TEXT,
                notes TEXT,
                kind TEXT NOT NULL DEFAULT 'session'
                    CHECK(kind IN ('session', 'deadline', 'other')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_calendar_events_date
            ON calendar_events (date)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("015_calendar_events", _utc_now_iso()),
        )

    if "016_availability" not in done:
        # Player availability marks, one row per player per day.
        # Weekends: preferred/available/unavailable. Weekdays: only
        # 'unavailable' (meaning "can't make that evening"); an
        # unmarked day has no row. times is a JSON array of
        # morning/afternoon/evening, only used on green Saturdays.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                date TEXT NOT NULL,
                rating TEXT NOT NULL
                    CHECK(rating IN ('preferred', 'available', 'unavailable')),
                times TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL,
                UNIQUE(player_name, date)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_availability_date
            ON availability (date)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("016_availability", _utc_now_iso()),
        )

    if "017_calendar_event_tasks" not in done:
        # Player-facing prep tasks per event (JSON list of {text, due}).
        # Lets the DM-scheduled session carry the "bring X / send Y by
        # date" lines the old campaign.js nextGathering had.
        cols = _table_columns(conn, "calendar_events")
        if "tasks" not in cols:
            conn.execute(
                "ALTER TABLE calendar_events ADD COLUMN tasks TEXT NOT NULL DEFAULT '[]'"
            )
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("017_calendar_event_tasks", _utc_now_iso()),
        )

    if "018_questionnaires" not in done:
        # Character-record questionnaire answers, one row per player.
        # answers is a JSON object of field-key -> text; drafts autosave
        # and 'submitted' just marks the seal — players can keep editing.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS questionnaires (
                player_name TEXT PRIMARY KEY,
                answers TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'draft'
                    CHECK(status IN ('draft', 'submitted')),
                submitted_at TEXT,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("018_questionnaires", _utc_now_iso()),
        )

    if "019_rumors" not in done:
        # DM-curated tavern rumor table for the home page's roll-a-rumor
        # card. Seeded with starters the DM can delete from /dm/.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rumors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        now = _utc_now_iso()
        conn.executemany(
            "INSERT INTO rumors (text, created_at) VALUES (?, ?)",
            [(text, now) for text in (
                "The Ferriers won't take fares past the Tidekeeper's Lodge after dark this week, and they won't say why.",
                "A fishmonger at the Salted Cup swears the fog bell rang thirteen times on Thursday. Everyone else counted twelve. She's stopped selling eel.",
                "Somebody's been buying up plain white masks. Not the good ones — all of them.",
                "The Overlook's lamps burned green for a full minute last new moon. The lamplighter quit the next morning.",
                "A Fog Warden was seen weeping into his tankard at the Burnt Quill. His partner didn't come back from the line, but no one's been reported missing.",
                "The Covenant Archive turned away three customers this week, saying their contracts were 'already spoken for.'",
                "Old Maren says the tide came in twice on the same morning. Old Maren is never wrong about water.",
                "The sisters at St. Viro's have started taking shifts just to watch the bandaged stranger sleep.",
            )],
        )
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("019_rumors", _utc_now_iso()),
        )

    if "020_push_opens" not in done:
        # Notification-tap receipts. The service worker beacons back
        # when a player taps a push; only taps are recorded, so this
        # is a floor on who saw it, never a ceiling.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS push_opens (
                message_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                opened_at TEXT NOT NULL,
                PRIMARY KEY (message_id, player_name)
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("020_push_opens", _utc_now_iso()),
        )

    if "021_character_sheets" not in done:
        # Rendered character sheets, one row per player per variant. These are
        # written from the DM's source markdown by import_sheets.py rather than
        # edited in the app, and they live in SQLite for one reason: the repo is
        # public and these hold player-written detail plus DM-only spoilers.
        # Keying on (player_name, variant) lets the import re-run idempotently.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS character_sheets (
                player_name TEXT NOT NULL,
                variant TEXT NOT NULL CHECK(variant IN ('player', 'dm')),
                markdown TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (player_name, variant)
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("021_character_sheets", _utc_now_iso()),
        )

    if "022_character_statblocks" not in done:
        # The Foundry export for a character, stored whole. We keep the raw
        # document rather than shredding it into columns: the dnd5e schema
        # moves between system versions, and the client normalises it anyway,
        # so a re-import should be able to change shape without a migration.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS character_statblocks (
                player_name TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("022_character_statblocks", _utc_now_iso()),
        )

    if "023_character_play_state" not in done:
        # The mutable half of a character: current HP, expended slots, spent
        # hit dice, conditions, an active mask. Foundry owns everything
        # permanent and never sees any of this.
        #
        # `state` is a JSON document rather than columns because its shape
        # tracks the rules rather than the database, and the client normalises
        # it anyway. `version` increments per applied operation so a client can
        # tell whether the state it holds is current.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS character_play_state (
                player_name TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            )
        """)
        # Every applied operation, kept rather than discarded. This is what an
        # undo needs, what a session recap could read, and what a later
        # sync-back to Foundry would replay — none of which are possible if we
        # only ever store the current values.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS character_play_ops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                op TEXT NOT NULL,
                applied_by TEXT NOT NULL,
                version INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_play_ops_player_created
            ON character_play_ops (player_name, created_at DESC)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("023_character_play_state", _utc_now_iso()),
        )

    if "024_handouts" not in done:
        # Documents the DM hands to specific characters — a letter, a map key,
        # a torn page. `players` is a JSON array of roster names because the
        # audience is part of the handout, not a join against it: three rows
        # per handout would invite the exact bug this design forbids, a player
        # seeing a handout that was never theirs.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS handouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                markdown TEXT NOT NULL,
                players TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("024_handouts", _utc_now_iso()),
        )

    if "025_chat" not in done:
        # Instant messages: player↔DM, player↔player, and the party channel.
        # thread_key is derived, never a membership table — the sorted pair
        # "Alice|Bob" for directs, "party" for the table — and membership is
        # checked against the roster at request time. Soft delete only.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_key TEXT NOT NULL,
                sender TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                deleted_at TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
            ON chat_messages (thread_key, id)
        """)
        # One row per (thread, reader): the unread pointer and the mute flag.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_reads (
                thread_key TEXT NOT NULL,
                player_name TEXT NOT NULL,
                last_read_id INTEGER NOT NULL DEFAULT 0,
                muted INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (thread_key, player_name)
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("025_chat", _utc_now_iso()),
        )

    if "026_chat_depth" not in done:
        # Replies and edits ride on the existing message row. edited_at is
        # NULL until the first edit, so "edited" is a fact the row carries
        # rather than a flag the client has to infer.
        cols = _table_columns(conn, "chat_messages")
        if "reply_to_id" not in cols:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER")
        if "edited_at" not in cols:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN edited_at TEXT")
        # One row per (message, reader, emoji): reacting twice with the same
        # face is the same reaction, and the primary key says so.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_reactions (
                message_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                emoji TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (message_id, player_name, emoji)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
            ON chat_reactions (message_id)
        """)
        # Typing rows are disposable — a heartbeat with an expiry, no
        # history. Readers treat an unexpired row as "typing" and nothing
        # ever reads these again.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_typing (
                thread_key TEXT NOT NULL,
                player_name TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                PRIMARY KEY (thread_key, player_name)
            )
        """)
        # Presence is per player, not per thread, so it gets its own row
        # rather than a column on the composite-keyed chat_reads.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS player_presence (
                player_name TEXT PRIMARY KEY,
                last_seen_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("026_chat_depth", _utc_now_iso()),
        )

    if "027_chat_attachments" not in done:
        # Files land before the message that carries them exists, so
        # message_id is NULL until the send claims them. thread_key is
        # bound at upload time: serving has to answer "is this caller a
        # member" for a file nobody has attached yet.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_attachments (
                id TEXT PRIMARY KEY,
                thread_key TEXT NOT NULL,
                uploader TEXT NOT NULL,
                message_id INTEGER,
                kind TEXT NOT NULL,
                filename TEXT NOT NULL,
                mime TEXT NOT NULL,
                bytes INTEGER NOT NULL,
                width INTEGER,
                height INTEGER,
                -- The order the sender picked them in. Uploads run
                -- concurrently, so created_at is arrival order, not intent.
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_attachments_message
            ON chat_attachments (message_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_attachments_unclaimed
            ON chat_attachments (message_id, created_at)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("027_chat_attachments", _utc_now_iso()),
        )

    if "028_player_profiles" not in done:
        # Bios are player-written and avatars are player-uploaded, so both
        # are runtime data: this table and app-data/profile-avatars/, never
        # the repo. avatar_file is NULL until someone uploads one, and the
        # curated portrait in _data/players.json is what shows until then.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS player_profiles (
                player_name TEXT PRIMARY KEY,
                bio TEXT NOT NULL DEFAULT '',
                avatar_file TEXT,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("028_player_profiles", _utc_now_iso()),
        )

    if "029_app_settings" not in done:
        # Runtime settings the DM flips from the console. One row per knob,
        # so a new knob is a new key rather than a new migration.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("029_app_settings", _utc_now_iso()),
        )

    if "030_studio_job_compiler" not in done:
        # Which prompt compiler drew this one. The point of running two is
        # comparing their output later, which needs the answer stored with
        # the job rather than inferred from when it ran.
        cols = _table_columns(conn, "studio_jobs")
        if "compiler" not in cols:
            conn.execute("ALTER TABLE studio_jobs ADD COLUMN compiler TEXT")
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("030_studio_job_compiler", _utc_now_iso()),
        )

    if "031_chat_delivery_hardening" not in done:
        # A sender-created UUID makes an ambiguous retry safe. The same UUID
        # in the same thread from the same sender names the message already
        # committed; it must never create a second row.
        cols = _table_columns(conn, "chat_messages")
        if "client_message_id" not in cols:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN client_message_id TEXT")
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_client_id
            ON chat_messages (thread_key, sender, client_message_id)
            WHERE client_message_id IS NOT NULL
        """)
        # Enzo's single-flight guard must be shared by every Gunicorn worker.
        # A deadline makes a dead stream self-healing; the opaque token keeps
        # an older stream from releasing a newer lease.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_enzo_leases (
                player_name TEXT PRIMARY KEY,
                lease_token TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("031_chat_delivery_hardening", _utc_now_iso()),
        )

    if "032_session_chronicles" not in done:
        # One row per session write-up, from the DM's raw notes through to a
        # published chronicle. Everything the pipeline produces is stored as
        # JSON on the row rather than in side tables: a draft is reviewed,
        # regenerated, and thrown away as a unit, and nothing else joins to
        # its parts.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS session_chronicles (
                id TEXT PRIMARY KEY,
                created_by TEXT NOT NULL,
                session_number TEXT,
                session_date TEXT,
                title TEXT,
                slug TEXT,
                raw_notes TEXT NOT NULL,
                extra_sources TEXT,
                art_count INTEGER NOT NULL DEFAULT 3,
                status TEXT NOT NULL,
                stage TEXT,
                context_json TEXT,
                research_json TEXT,
                draft_markdown TEXT,
                draft_summary TEXT,
                recap TEXT,
                continuity_json TEXT,
                art_json TEXT,
                updates_json TEXT,
                threads_json TEXT,
                in_play_json TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                published_at TEXT,
                published_url TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_session_chronicles_updated
            ON session_chronicles (updated_at DESC)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("032_session_chronicles", _utc_now_iso()),
        )

__all__ = ['apply_current_migrations']
