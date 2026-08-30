from .imports import *
from .symbols import *
from .config import *
from .migrations_legacy import apply_legacy_migrations
from .migrations_current import apply_current_migrations

@contextmanager
def _app_db():
    """One SQLite connection per `with` block: commit on success, rollback on
    exception, and — unlike a bare sqlite3 connection used as a context
    manager — actually closed on exit. WAL + a generous busy timeout let the
    two Gunicorn workers, the rebuild thread, and the studio/lore threads
    write without tripping over each other."""
    APP_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(APP_DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        with conn:
            yield conn
    finally:
        conn.close()


def _table_columns(conn, table_name):
    return {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table_name})")
    }



def _run_app_migrations():
    with _app_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
        """)

        done = {
            row["name"]
            for row in conn.execute("SELECT name FROM schema_migrations")
        }
        apply_legacy_migrations(conn, done)
        apply_current_migrations(conn, done)

__all__ = ['_app_db', '_table_columns', '_run_app_migrations']
