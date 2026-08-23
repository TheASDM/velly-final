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


def _run_rebuild_job(lock_file, job_id, reason, include_knowledge):
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
    finally:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass
        try:
            lock_file.close()
        except Exception:
            pass


def _start_rebuild_job(reason, include_knowledge=True):
    if not AUTO_REBUILD_ON_WIKI_SAVE:
        return {
            "state": "disabled",
            "reason": reason,
            "include_knowledge": include_knowledge,
            "updated_at": _utc_now_iso(),
        }

    REBUILD_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    lock_file = open(REBUILD_LOCK_PATH, "a+")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        status = _read_rebuild_status()
        if status.get("state") not in {"queued", "running"}:
            status["state"] = "running"
        return status

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
    thread.start()
    return status


def _skip_rag(message):
    """Return True if the message is too short/casual to benefit from RAG."""
    cleaned = message.strip().strip(string.punctuation).strip()
    if len(cleaned) <= RAG_SKIP_MAX_LEN:
        return True
    if RAG_SKIP_PATTERNS.match(cleaned):
        return True
    return False

__all__ = ['_trim_output', '_join_process_output', '_write_rebuild_status', '_read_rebuild_status', '_run_rebuild_command', '_run_rebuild_job', '_start_rebuild_job', '_skip_rag']
