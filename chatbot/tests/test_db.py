"""Connection contract for _app_db(): WAL, pragmas, commit/rollback/close."""

import sqlite3

import pytest


def test_app_db_pragmas_and_close(server_module):
    with server_module._app_db() as conn:
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 30000
    # The old implementation used sqlite3's transaction context manager,
    # which never closes — connections must actually close now.
    with pytest.raises(sqlite3.ProgrammingError):
        conn.execute("SELECT 1")


def test_app_db_commits_on_success_and_rolls_back_on_error(server_module):
    with server_module._app_db() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS _db_contract_probe (x INTEGER)")

    with server_module._app_db() as conn:
        conn.execute("INSERT INTO _db_contract_probe VALUES (1)")

    with pytest.raises(RuntimeError):
        with server_module._app_db() as conn:
            conn.execute("INSERT INTO _db_contract_probe VALUES (2)")
            raise RuntimeError("boom")

    with server_module._app_db() as conn:
        rows = conn.execute("SELECT x FROM _db_contract_probe").fetchall()
        assert [row["x"] for row in rows] == [1]
        conn.execute("DROP TABLE _db_contract_probe")
