from .imports import *
from .symbols import *
from .config import *

# ── Logging ──────────────────────────────────────────────────────────────────


def write_log(role, text):
    ts = datetime.now(timezone.utc).isoformat()
    line = f"[{ts}] {role.upper()}: {text.replace(chr(10), ' ')}\n"
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a") as f:
            f.write(line)
    except Exception as e:
        logging.error("Log write failed: %s", e)

__all__ = ['write_log']
