"""Runtime settings the DM can change without a redeploy.

One key/value table. Env vars stay the deployment default; a row here is the
DM's override, so flipping something at the table does not need a rebuild and
does not need a schema change per knob either.
"""
from ..imports import *
from ..symbols import *
from ..config import *

# The prompt-compiler backend used to turn a player's description into image
# direction. Two providers exist so the same request can be compared through
# both; players never choose, and never see that there is a choice.
IMAGE_COMPILER_SETTING_KEY = "image_compiler_provider"


def _get_app_setting(key, default=None):
    try:
        with _app_db() as conn:
            row = conn.execute(
                "SELECT value FROM app_settings WHERE key = ?", (key,),
            ).fetchone()
    except Exception:
        logging.exception("Could not read app setting %s", key)
        return default
    if not row:
        return default
    return row["value"]


def _set_app_setting(key, value):
    with _app_db() as conn:
        conn.execute("""
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (key, str(value), _utc_now_iso()))
    return str(value)

__all__ = [
    'IMAGE_COMPILER_SETTING_KEY',
    '_get_app_setting',
    '_set_app_setting',
]
