from .imports import *
from .symbols import *
from .auth import _utc_now_iso
from .config import (
    CHAT_PARTY_THREAD_ID,
    CHAT_SEAT_IDS,
    CHAT_SYSTEM_SEAT_IDS,
    chat_thread_id,
)


def _table_columns(conn, table):
    """Read a table shape without depending on runtime symbol injection."""
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def _chat_identity_catalog():
    seats = [(seat_id, name, "human") for name, seat_id in CHAT_SEAT_IDS.items()]
    seats.extend(
        (seat_id, name, "system")
        for name, seat_id in CHAT_SYSTEM_SEAT_IDS.items()
    )
    threads = [{
        "id": CHAT_PARTY_THREAD_ID,
        "legacy_key": "party",
        "kind": "party",
        "seat_ids": list(CHAT_SEAT_IDS.values()),
    }]
    humans = list(CHAT_SEAT_IDS.items())
    for index, (left_name, left_id) in enumerate(humans):
        for right_name, right_id in humans[index + 1:]:
            threads.append({
                "id": chat_thread_id("direct", left_id, right_id),
                "legacy_key": "|".join(sorted((left_name, right_name))),
                "kind": "direct",
                "seat_ids": [left_id, right_id],
            })
    enzo_id = CHAT_SYSTEM_SEAT_IDS["Enzo"]
    for name, seat_id in humans:
        threads.append({
            "id": chat_thread_id("assistant", seat_id, enzo_id),
            "legacy_key": "|".join(sorted((name, "Enzo"))),
            "kind": "assistant",
            "seat_ids": [seat_id, enzo_id],
        })
    dm_id = CHAT_SEAT_IDS["DM"]
    vesper_id = CHAT_SYSTEM_SEAT_IDS["Vesper"]
    threads.append({
        "id": chat_thread_id("test", dm_id, vesper_id),
        "legacy_key": "DM|Vesper",
        "kind": "test",
        "seat_ids": [dm_id, vesper_id],
    })
    return seats, threads


def _sync_chat_identity_catalog(conn):
    seats, threads = _chat_identity_catalog()
    now = _utc_now_iso()
    for seat_id, name, kind in seats:
        conn.execute("""
            INSERT INTO chat_seats
                (id, canonical_name, kind, active, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                canonical_name = excluded.canonical_name,
                kind = excluded.kind,
                active = 1,
                updated_at = excluded.updated_at
        """, (seat_id, name, kind, now, now))
        conn.execute("""
            INSERT INTO chat_seat_aliases (seat_id, name, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO NOTHING
        """, (seat_id, name, now))
    for thread in threads:
        conn.execute("""
            INSERT INTO chat_threads (id, legacy_key, kind, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                kind = excluded.kind,
                updated_at = excluded.updated_at
        """, (thread["id"], thread["legacy_key"], thread["kind"], now, now))
        for seat_id in thread["seat_ids"]:
            conn.execute("""
                INSERT INTO chat_thread_members
                    (thread_id, seat_id, joined_at, history_from_message_id)
                VALUES (?, ?, ?, 0)
                ON CONFLICT(thread_id, seat_id) DO NOTHING
            """, (thread["id"], seat_id, now))


def _backfill_name(conn, table, identity_column, name_column):
    for name, seat_id in {**CHAT_SEAT_IDS, **CHAT_SYSTEM_SEAT_IDS}.items():
        conn.execute(
            f"UPDATE {table} SET {identity_column} = ? "
            f"WHERE {identity_column} IS NULL AND {name_column} = ?",
            (seat_id, name),
        )


def _require_complete(conn, table, column):
    missing = conn.execute(
        f"SELECT COUNT(*) FROM {table} WHERE {column} IS NULL"
    ).fetchone()[0]
    if missing:
        raise RuntimeError(
            f"Chat identity migration could not backfill {missing} "
            f"{table}.{column} value(s)"
        )


def apply_chat_identity_migration(conn, done):
    if "033_chat_identity_core" not in done:
        # Additive compatibility migration: old clients keep name/key columns,
        # while new clients and all new writes also use immutable identities.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_seats (
                id TEXT PRIMARY KEY,
                canonical_name TEXT NOT NULL UNIQUE,
                kind TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_seat_aliases (
                seat_id TEXT NOT NULL,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                PRIMARY KEY (seat_id, name),
                FOREIGN KEY (seat_id) REFERENCES chat_seats(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_threads (
                id TEXT PRIMARY KEY,
                legacy_key TEXT NOT NULL UNIQUE,
                kind TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_thread_members (
                thread_id TEXT NOT NULL,
                seat_id TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                history_from_message_id INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (thread_id, seat_id),
                FOREIGN KEY (thread_id) REFERENCES chat_threads(id),
                FOREIGN KEY (seat_id) REFERENCES chat_seats(id)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_thread_members_seat
            ON chat_thread_members (seat_id, thread_id)
        """)
        _sync_chat_identity_catalog(conn)

        identity_columns = {
            "chat_messages": ("thread_id", "sender_seat_id", "updated_at"),
            "chat_reads": ("thread_id", "seat_id"),
            "chat_reactions": ("seat_id",),
            "chat_typing": ("thread_id", "seat_id"),
            "player_presence": ("seat_id",),
            "chat_attachments": ("thread_id", "uploader_seat_id"),
        }
        for table, columns in identity_columns.items():
            existing = _table_columns(conn, table)
            for column in columns:
                if column not in existing:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT")

        for thread in _chat_identity_catalog()[1]:
            for table in (
                "chat_messages", "chat_reads", "chat_typing", "chat_attachments",
            ):
                conn.execute(
                    f"UPDATE {table} SET thread_id = ? "
                    "WHERE thread_id IS NULL AND thread_key = ?",
                    (thread["id"], thread["legacy_key"]),
                )
        for table, identity_column, name_column in (
            ("chat_messages", "sender_seat_id", "sender"),
            ("chat_reads", "seat_id", "player_name"),
            ("chat_reactions", "seat_id", "player_name"),
            ("chat_typing", "seat_id", "player_name"),
            ("player_presence", "seat_id", "player_name"),
            ("chat_attachments", "uploader_seat_id", "uploader"),
        ):
            _backfill_name(conn, table, identity_column, name_column)
        conn.execute("""
            UPDATE chat_messages
            SET updated_at = COALESCE(deleted_at, edited_at, created_at)
            WHERE updated_at IS NULL
        """)
        for table, column in (
            ("chat_messages", "thread_id"),
            ("chat_messages", "sender_seat_id"),
            ("chat_messages", "updated_at"),
            ("chat_reads", "thread_id"),
            ("chat_reads", "seat_id"),
            ("chat_reactions", "seat_id"),
            ("chat_typing", "thread_id"),
            ("chat_typing", "seat_id"),
            ("player_presence", "seat_id"),
            ("chat_attachments", "thread_id"),
            ("chat_attachments", "uploader_seat_id"),
        ):
            _require_complete(conn, table, column)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_messages_stable_thread
            ON chat_messages (thread_id, id)
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_stable_client_id
            ON chat_messages (thread_id, sender_seat_id, client_message_id)
            WHERE client_message_id IS NOT NULL
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_reads_stable_identity
            ON chat_reads (thread_id, seat_id)
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_typing_stable_identity
            ON chat_typing (thread_id, seat_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_attachments_stable_thread
            ON chat_attachments (thread_id, message_id)
        """)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            ("033_chat_identity_core", _utc_now_iso()),
        )

    # Renames are configuration changes, not schema changes. Preserve old
    # aliases while keeping canonical display metadata current on every boot.
    tables = {
        row["name"] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    if "chat_seats" in tables:
        _sync_chat_identity_catalog(conn)


__all__ = ["apply_chat_identity_migration", "_chat_identity_catalog"]
