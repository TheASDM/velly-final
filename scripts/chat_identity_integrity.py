#!/usr/bin/env python3
"""Content-blind integrity report for the stable chat identity migration."""

import argparse
import json
import sqlite3
import sys
from pathlib import Path


REQUIRED_MIGRATION = "033_chat_identity_core"
IDENTITY_COLUMNS = {
    "chat_messages": ("thread_id", "sender_seat_id", "updated_at"),
    "chat_reads": ("thread_id", "seat_id"),
    "chat_reactions": ("seat_id",),
    "chat_typing": ("thread_id", "seat_id"),
    "player_presence": ("seat_id",),
    "chat_attachments": ("thread_id", "uploader_seat_id"),
}


def scalar(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()[0]


def build_report(db_path):
    uri = f"file:{Path(db_path).resolve()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    try:
        migrations = {
            row["name"] for row in conn.execute("SELECT name FROM schema_migrations")
        }
        tables = {
            row["name"] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        missing_tables = sorted({
            "chat_seats", "chat_seat_aliases", "chat_threads",
            "chat_thread_members", *IDENTITY_COLUMNS,
        } - tables)
        report = {
            "database": str(Path(db_path)),
            "integrity": scalar(conn, "PRAGMA integrity_check"),
            "foreign_key_violations": len(conn.execute("PRAGMA foreign_key_check").fetchall()),
            "migration_applied": REQUIRED_MIGRATION in migrations,
            "missing_tables": missing_tables,
            "catalog": {},
            "rows": {},
            "missing_identity_values": {},
            "relationship_mismatches": {},
        }
        if missing_tables:
            report["ok"] = False
            return report

        report["catalog"] = {
            "seats": scalar(conn, "SELECT COUNT(*) FROM chat_seats"),
            "aliases": scalar(conn, "SELECT COUNT(*) FROM chat_seat_aliases"),
            "threads": scalar(conn, "SELECT COUNT(*) FROM chat_threads"),
            "memberships": scalar(conn, "SELECT COUNT(*) FROM chat_thread_members"),
        }
        for table, columns in IDENTITY_COLUMNS.items():
            report["rows"][table] = scalar(conn, f"SELECT COUNT(*) FROM {table}")
            report["missing_identity_values"][table] = {
                column: scalar(
                    conn, f"SELECT COUNT(*) FROM {table} WHERE {column} IS NULL"
                )
                for column in columns
            }

        report["relationship_mismatches"] = {
            "message_threads": scalar(conn, """
                SELECT COUNT(*) FROM chat_messages m
                LEFT JOIN chat_threads t ON t.id = m.thread_id
                WHERE t.id IS NULL OR t.legacy_key != m.thread_key
            """),
            "message_senders": scalar(conn, """
                SELECT COUNT(*) FROM chat_messages m
                LEFT JOIN chat_seat_aliases a
                  ON a.seat_id = m.sender_seat_id AND a.name = m.sender
                WHERE a.seat_id IS NULL
            """),
            "read_threads": scalar(conn, """
                SELECT COUNT(*) FROM chat_reads r
                LEFT JOIN chat_threads t ON t.id = r.thread_id
                WHERE t.id IS NULL OR t.legacy_key != r.thread_key
            """),
            "read_seats": scalar(conn, """
                SELECT COUNT(*) FROM chat_reads r
                LEFT JOIN chat_seat_aliases a
                  ON a.seat_id = r.seat_id AND a.name = r.player_name
                WHERE a.seat_id IS NULL
            """),
            "attachment_threads": scalar(conn, """
                SELECT COUNT(*) FROM chat_attachments a
                LEFT JOIN chat_threads t ON t.id = a.thread_id
                WHERE t.id IS NULL OR t.legacy_key != a.thread_key
            """),
            "attachment_uploaders": scalar(conn, """
                SELECT COUNT(*) FROM chat_attachments a
                LEFT JOIN chat_seat_aliases s
                  ON s.seat_id = a.uploader_seat_id AND s.name = a.uploader
                WHERE s.seat_id IS NULL
            """),
        }
        zero_groups = [
            report["foreign_key_violations"],
            *report["relationship_mismatches"].values(),
            *(count for values in report["missing_identity_values"].values()
              for count in values.values()),
        ]
        report["ok"] = (
            report["integrity"] == "ok"
            and report["migration_applied"]
            and not report["missing_tables"]
            and all(value == 0 for value in zero_groups)
        )
        return report
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("database", help="Path to the SQLite database")
    args = parser.parse_args()
    report = build_report(args.database)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
