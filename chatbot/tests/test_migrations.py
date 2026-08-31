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
    "chat_messages",
    "chat_reactions",
    "chat_reads",
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
