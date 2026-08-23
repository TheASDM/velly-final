from .imports import *
from .symbols import *
from .config import *
from .migrations_legacy import apply_legacy_migrations
from .migrations_current import apply_current_migrations

def _app_db():
    APP_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(APP_DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


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
