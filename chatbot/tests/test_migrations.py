EXPECTED_MIGRATIONS = {
    "001_push_subscriptions",
    "002_dm_messages",
    "003_rsvps",
    "004_studio_jobs",
    "005_targeted_dm_messages",
    "006_lore_submissions",
    "007_message_dismissals",
    "008_in_play",
    "009_culture_kind",
    "010_card_fields",
    "011_studio_quotas",
    "012_gallery_favorites",
    "013_studio_job_details",
    "014_notes",
    "015_calendar_events",
    "016_availability",
    "017_calendar_event_tasks",
    "018_questionnaires",
    "019_rumors",
    "020_push_opens",
    "021_character_sheets",
    "022_character_statblocks",
    "023_character_play_state",
    "024_handouts",
    "025_chat",
    "026_chat_depth",
    "027_chat_attachments",
    "028_player_profiles",
    "029_app_settings",
    "030_studio_job_compiler",
    "031_chat_delivery_hardening",
    "032_session_chronicles",
    "033_chat_identity_core",
}

EXPECTED_TABLES = {
    "app_settings",
    "availability",
    "calendar_events",
    "character_sheets",
    "character_statblocks",
    "character_play_state",
    "character_play_ops",
    "chat_attachments",
    "chat_enzo_leases",
    "chat_messages",
    "chat_reactions",
    "chat_reads",
    "chat_seat_aliases",
    "chat_seats",
    "chat_thread_members",
    "chat_threads",
    "chat_typing",
    "gallery_favorites",
    "handouts",
    "in_play",
    "lore_submissions",
    "message_dismissals",
    "message_recipients",
    "messages",
    "notes",
    "player_presence",
    "player_profiles",
    "push_deliveries",
    "push_opens",
    "questionnaires",
    "rsvps",
    "rumors",
    "schema_migrations",
    "session_chronicles",
    "studio_jobs",
    "studio_quotas",
    "subscriptions",
}


def _schema_snapshot(server_module):
    with server_module._app_db() as conn:
        migrations = {
            row["name"]
            for row in conn.execute("SELECT name FROM schema_migrations")
        }
        tables = {
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
            if not row["name"].startswith("sqlite_")
        }
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    return migrations, tables, integrity


def test_fresh_database_reaches_current_schema(server_module):
    migrations, tables, integrity = _schema_snapshot(server_module)
    assert migrations == EXPECTED_MIGRATIONS
    assert tables == EXPECTED_TABLES
    assert integrity == "ok"


def test_migrations_are_idempotent(server_module):
    before = _schema_snapshot(server_module)
    server_module._run_app_migrations()
    server_module._run_app_migrations()
    assert _schema_snapshot(server_module) == before


def test_chat_identity_catalog_is_stable_and_fully_linked(server_module):
    from vos.config import CHAT_PARTY_THREAD_ID, CHAT_SEAT_IDS

    with server_module._app_db() as conn:
        seats = conn.execute(
            "SELECT id, canonical_name, kind FROM chat_seats"
        ).fetchall()
        threads = conn.execute(
            "SELECT id, legacy_key, kind FROM chat_threads"
        ).fetchall()
        memberships = conn.execute("""
            SELECT t.legacy_key, s.canonical_name, m.history_from_message_id
            FROM chat_thread_members m
            JOIN chat_threads t ON t.id = m.thread_id
            JOIN chat_seats s ON s.id = m.seat_id
        """).fetchall()

    assert len(seats) == len(CHAT_SEAT_IDS) + 2
    assert {row["canonical_name"] for row in seats} == {
        *CHAT_SEAT_IDS,
        "Enzo",
        "Vesper",
    }
    assert len(threads) == 23
    party = next(row for row in threads if row["legacy_key"] == "party")
    assert party["id"] == CHAT_PARTY_THREAD_ID
    assert party["kind"] == "party"
    party_members = {
        row["canonical_name"]
        for row in memberships
        if row["legacy_key"] == "party"
    }
    assert party_members == set(CHAT_SEAT_IDS)
    assert all(row["history_from_message_id"] == 0 for row in memberships)


def test_chat_identity_columns_exist(server_module):
    expected = {
        "chat_messages": {"thread_id", "sender_seat_id", "updated_at"},
        "chat_reads": {"thread_id", "seat_id"},
        "chat_reactions": {"seat_id"},
        "chat_typing": {"thread_id", "seat_id"},
        "player_presence": {"seat_id"},
        "chat_attachments": {"thread_id", "uploader_seat_id"},
    }
    with server_module._app_db() as conn:
        for table, columns in expected.items():
            assert columns <= server_module._table_columns(conn, table)
