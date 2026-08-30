from .imports import *
from .symbols import *
from .config import *

def _trim_output(text, max_chars=6000):
    text = str(text or "")
    if len(text) <= max_chars:
        return text
    return text[-max_chars:]


def _join_process_output(*parts):
    output = []
    for part in parts:
        if not part:
            continue
        if isinstance(part, bytes):
            output.append(part.decode("utf-8", "replace"))
        else:
            output.append(str(part))
    return "\n".join(output)


def _write_rebuild_status(status):
    REBUILD_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(status or {})
    payload["updated_at"] = _utc_now_iso()
    tmp = REBUILD_STATUS_PATH.with_name(REBUILD_STATUS_PATH.name + f".{secrets.token_hex(4)}.tmp")
    try:
        tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp, REBUILD_STATUS_PATH)
    finally:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass
    return payload


def _read_rebuild_status():
    try:
        return json.loads(REBUILD_STATUS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {
            "state": "idle",
            "updated_at": None,
            "commands": [],
        }


def _run_rebuild_command(command, label):
    started_at = _utc_now_iso()
    result = subprocess.run(
        command,
        cwd=str(SITE_SOURCE_DIR),
        text=True,
        capture_output=True,
        timeout=REBUILD_COMMAND_TIMEOUT_SECONDS,
    )
    output = _join_process_output(result.stdout, result.stderr)
    return {
        "label": label,
        "command": " ".join(command),
        "returncode": result.returncode,
        "started_at": started_at,
        "finished_at": _utc_now_iso(),
        "output_tail": _trim_output(output),
    }


@contextmanager
def _pending_rebuild_lock():
    """Serializes 'write pending + try main lock' (savers) against 'final
    pending check + main lock release' (the worker). Without it, a save that
    lands in the gap between those two worker steps is never built."""
    REBUILD_PENDING_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    lock_file = open(REBUILD_PENDING_LOCK_PATH, "a+")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass
        lock_file.close()


def _write_pending_rebuild(reason, include_knowledge):
    """Record that (at least) one more rebuild is wanted. Merges with any
    existing request: include_knowledge is OR'd, the reason keeps the latest."""
    current = {}
    try:
        current = json.loads(REBUILD_PENDING_PATH.read_text(encoding="utf-8"))
    except Exception:
        current = {}
    if not isinstance(current, dict):
        current = {}
    payload = {
        "reason": str(reason or "")[:160],
        "include_knowledge": bool(include_knowledge) or bool(current.get("include_knowledge")),
        "requested_at": _utc_now_iso(),
    }
    tmp = REBUILD_PENDING_PATH.with_name(
        REBUILD_PENDING_PATH.name + f".{secrets.token_hex(4)}.tmp"
    )
    tmp.write_text(json.dumps(payload) + "\n", encoding="utf-8")
    os.replace(tmp, REBUILD_PENDING_PATH)


def _consume_pending_rebuild():
    """Read and clear the pending request. Returns the request dict or None."""
    try:
        payload = json.loads(REBUILD_PENDING_PATH.read_text(encoding="utf-8"))
    except Exception:
        payload = None
    try:
        REBUILD_PENDING_PATH.unlink()
    except OSError:
        pass
    return payload if isinstance(payload, dict) else None


def _release_rebuild_lock(lock_file):
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
    except Exception:
        pass
    try:
        lock_file.close()
    except Exception:
        pass


def _run_rebuild_job(lock_file, job_id, reason, include_knowledge):
    """Worker thread: run the requested rebuild, then keep re-looping on any
    request that queued while it ran. The final empty check and the lock
    release happen under the pending lock — see _pending_rebuild_lock."""
    released = False
    try:
        while True:
            _run_one_rebuild(job_id, reason, include_knowledge)
            with _pending_rebuild_lock():
                pending = _consume_pending_rebuild()
                if not pending:
                    _release_rebuild_lock(lock_file)
                    released = True
                    return
            job_id = secrets.token_hex(6)
            reason = str(pending.get("reason") or "queued during rebuild")
            include_knowledge = bool(pending.get("include_knowledge"))
    finally:
        if not released:
            _release_rebuild_lock(lock_file)


def _run_one_rebuild(job_id, reason, include_knowledge):
    commands = [("site", ["npm", "run", "build"])]
    if include_knowledge:
        commands.append(("knowledge", ["npm", "run", "knowledge"]))

    status = {
        "job_id": job_id,
        "state": "running",
        "reason": reason,
        "include_knowledge": include_knowledge,
        "started_at": _utc_now_iso(),
        "finished_at": None,
        "current_step": "starting",
        "commands": [],
    }
    _write_rebuild_status(status)
    try:
        for label, command in commands:
            status["current_step"] = label
            _write_rebuild_status(status)
            step = _run_rebuild_command(command, label)
            status["commands"].append(step)
            if step["returncode"] != 0:
                status.update({
                    "state": "failed",
                    "finished_at": _utc_now_iso(),
                    "current_step": label,
                    "error": f"{step['command']} exited {step['returncode']}",
                })
                _write_rebuild_status(status)
                logging.error("Rebuild job %s failed at %s", job_id, label)
                return

        if include_knowledge:
            try:
                engine.reload_if_stale(force=True)
            except Exception:
                logging.exception("Rebuild job %s could not hot-reload Enzo", job_id)

        status.update({
            "state": "succeeded",
            "finished_at": _utc_now_iso(),
            "current_step": "done",
            "error": "",
        })
        _write_rebuild_status(status)
        logging.info("Rebuild job %s completed", job_id)
    except subprocess.TimeoutExpired as exc:
        output = _join_process_output(exc.stdout, exc.stderr)
        status["commands"].append({
            "label": status.get("current_step") or "unknown",
            "command": " ".join(exc.cmd) if isinstance(exc.cmd, list) else str(exc.cmd),
            "returncode": None,
            "started_at": status.get("updated_at"),
            "finished_at": _utc_now_iso(),
            "output_tail": _trim_output(output),
        })
        status.update({
            "state": "failed",
            "finished_at": _utc_now_iso(),
            "error": f"Rebuild timed out after {REBUILD_COMMAND_TIMEOUT_SECONDS}s",
        })
        _write_rebuild_status(status)
        logging.exception("Rebuild job %s timed out", job_id)
    except Exception as exc:
        status.update({
            "state": "failed",
            "finished_at": _utc_now_iso(),
            "error": str(exc),
        })
        _write_rebuild_status(status)
        logging.exception("Rebuild job %s failed", job_id)


def _start_rebuild_job(reason, include_knowledge=True):
    if not AUTO_REBUILD_ON_WIKI_SAVE:
        return {
            "state": "disabled",
            "reason": reason,
            "include_knowledge": include_knowledge,
            "updated_at": _utc_now_iso(),
        }

    REBUILD_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _pending_rebuild_lock():
        # Record the request first, then try for the lock: either this call
        # runs it (and consumes it below), or the current holder's re-loop
        # picks it up before releasing.
        _write_pending_rebuild(reason, include_knowledge)
        lock_file = open(REBUILD_LOCK_PATH, "a+")
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock_file.close()
            status = _read_rebuild_status()
            if status.get("state") not in {"queued", "running"}:
                status["state"] = "running"
            status["pending"] = True
            status["pending_reason"] = str(reason or "")[:160]
            return status
        pending = _consume_pending_rebuild() or {}
        reason = str(pending.get("reason") or reason)
        include_knowledge = bool(pending.get("include_knowledge", include_knowledge))

    job_id = secrets.token_hex(6)
    status = _write_rebuild_status({
        "job_id": job_id,
        "state": "queued",
        "reason": reason,
        "include_knowledge": include_knowledge,
        "started_at": None,
        "finished_at": None,
        "current_step": "queued",
        "commands": [],
    })
    thread = threading.Thread(
        target=_run_rebuild_job,
        args=(lock_file, job_id, reason, include_knowledge),
        daemon=True,
    )
    try:
        thread.start()
    except Exception:
        # The lock must not leak if the thread cannot start, or every later
        # save reports "running" forever against a job that does not exist.
        _release_rebuild_lock(lock_file)
        _write_rebuild_status({
            "job_id": job_id,
            "state": "failed",
            "reason": reason,
            "include_knowledge": include_knowledge,
            "error": "Could not start the rebuild worker thread",
            "finished_at": _utc_now_iso(),
            "commands": [],
        })
        raise
    return status


# ── Debounced rebuilds ───────────────────────────────────────────────────
# Wiki saves come in bursts (an editing session is many small saves). Each
# save restarts a trailing timer; the build fires once the burst goes quiet.
# Per-worker state is fine: if both Gunicorn workers fire, the main rebuild
# lock plus the pending queue serialize them into consecutive builds.

_debounce_mutex = threading.Lock()
_debounce_state = {"timer": None, "reason": "", "include_knowledge": False}
_last_knowledge_build_at = 0.0


def _fire_debounced_rebuild():
    global _last_knowledge_build_at
    with _debounce_mutex:
        reason = _debounce_state["reason"]
        include_knowledge = _debounce_state["include_knowledge"]
        _debounce_state.update(timer=None, reason="", include_knowledge=False)
    if include_knowledge:
        now = time.time()
        if now - _last_knowledge_build_at < REBUILD_KNOWLEDGE_MIN_INTERVAL_SECONDS:
            include_knowledge = False
        else:
            _last_knowledge_build_at = now
    try:
        _start_rebuild_job(reason or "debounced wiki edits",
                           include_knowledge=include_knowledge)
    except Exception:
        logging.exception("Debounced rebuild failed to start")


def _schedule_debounced_rebuild(reason, include_knowledge=True):
    """Ask for a rebuild soon rather than now. Returns a status the save
    response can carry: state 'scheduled' plus the debounce window."""
    if not AUTO_REBUILD_ON_WIKI_SAVE:
        return {
            "state": "disabled",
            "reason": reason,
            "include_knowledge": include_knowledge,
            "updated_at": _utc_now_iso(),
        }
    with _debounce_mutex:
        _debounce_state["reason"] = str(reason or "")[:160]
        _debounce_state["include_knowledge"] = (
            _debounce_state["include_knowledge"] or bool(include_knowledge)
        )
        if _debounce_state["timer"] is not None:
            _debounce_state["timer"].cancel()
        timer = threading.Timer(REBUILD_DEBOUNCE_SECONDS, _fire_debounced_rebuild)
        timer.daemon = True
        _debounce_state["timer"] = timer
        timer.start()
    return {
        "state": "scheduled",
        "reason": str(reason or "")[:160],
        "debounce_seconds": REBUILD_DEBOUNCE_SECONDS,
        "updated_at": _utc_now_iso(),
    }


def _cancel_debounced_rebuild():
    """Cancel a scheduled debounce (an explicit build supersedes it).
    Returns (reason, include_knowledge) of the canceled request, if any."""
    with _debounce_mutex:
        timer = _debounce_state["timer"]
        reason = _debounce_state["reason"]
        include_knowledge = _debounce_state["include_knowledge"]
        _debounce_state.update(timer=None, reason="", include_knowledge=False)
    if timer is None:
        return None, False
    timer.cancel()
    return reason, include_knowledge


def _skip_rag(message):
    """Return True if the message is too short/casual to benefit from RAG."""
    cleaned = message.strip().strip(string.punctuation).strip()
    if len(cleaned) <= RAG_SKIP_MAX_LEN:
        return True
    if RAG_SKIP_PATTERNS.match(cleaned):
        return True
    return False

__all__ = ['_trim_output', '_join_process_output', '_write_rebuild_status', '_read_rebuild_status', '_run_rebuild_command', '_pending_rebuild_lock', '_write_pending_rebuild', '_consume_pending_rebuild', '_release_rebuild_lock', '_run_rebuild_job', '_run_one_rebuild', '_start_rebuild_job', '_fire_debounced_rebuild', '_schedule_debounced_rebuild', '_cancel_debounced_rebuild', '_skip_rag']
