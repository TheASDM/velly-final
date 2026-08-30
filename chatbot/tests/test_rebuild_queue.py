"""A save that lands while a rebuild is running must queue a follow-up build.

The old BlockingIOError branch returned the running job's status and queued
nothing — the client polled job A to success and showed "Rebuild complete."
while the second edit sat unpublished forever.
"""

import threading
import time

from vos import rebuild


def test_save_during_rebuild_queues_follow_up(monkeypatch):
    release = threading.Event()
    first_running = threading.Event()
    calls = []

    def fake_command(command, label):
        calls.append(label)
        first_running.set()
        if len(calls) == 1:
            release.wait(timeout=10)
        return {
            "label": label,
            "command": " ".join(command),
            "returncode": 0,
            "started_at": "t",
            "finished_at": "t",
            "output_tail": "",
        }

    monkeypatch.setattr(rebuild, "_run_rebuild_command", fake_command)

    first = rebuild._start_rebuild_job("first edit", include_knowledge=False)
    assert first["state"] == "queued"
    assert first_running.wait(timeout=10)

    # The lock is held by the first job: this request must be queued, and the
    # caller must be able to see that it was.
    second = rebuild._start_rebuild_job("second edit", include_knowledge=False)
    assert second.get("pending") is True
    assert second["job_id"] == first["job_id"]

    release.set()
    deadline = time.time() + 10
    while time.time() < deadline:
        status = rebuild._read_rebuild_status()
        if status.get("state") == "succeeded" and status.get("job_id") != first["job_id"]:
            break
        time.sleep(0.05)
    else:
        raise AssertionError(
            f"queued rebuild never ran: {rebuild._read_rebuild_status()}"
        )

    # Two distinct site builds ran, and nothing is left in the queue.
    assert calls == ["site", "site"]
    assert not rebuild.REBUILD_PENDING_PATH.exists()


def test_idle_start_runs_one_job(monkeypatch):
    def fake_command(command, label):
        return {
            "label": label,
            "command": " ".join(command),
            "returncode": 0,
            "started_at": "t",
            "finished_at": "t",
            "output_tail": "",
        }

    monkeypatch.setattr(rebuild, "_run_rebuild_command", fake_command)
    status = rebuild._start_rebuild_job("solo edit", include_knowledge=False)
    assert status["state"] == "queued"

    deadline = time.time() + 10
    while time.time() < deadline:
        current = rebuild._read_rebuild_status()
        if current.get("state") == "succeeded" and current.get("job_id") == status["job_id"]:
            break
        time.sleep(0.05)
    else:
        raise AssertionError(f"rebuild never finished: {rebuild._read_rebuild_status()}")
    assert not rebuild.REBUILD_PENDING_PATH.exists()
