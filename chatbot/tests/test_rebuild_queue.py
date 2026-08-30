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


def test_failed_build_carries_error_detail(monkeypatch):
    def failing_command(command, label):
        return {
            "label": label,
            "command": " ".join(command),
            "returncode": 1,
            "started_at": "t",
            "finished_at": "t",
            "output_tail": "\n".join(f"line {i}" for i in range(1, 31)),
        }

    monkeypatch.setattr(rebuild, "_run_rebuild_command", failing_command)
    started = rebuild._start_rebuild_job("failing edit", include_knowledge=False)

    deadline = time.time() + 10
    while time.time() < deadline:
        status = rebuild._read_rebuild_status()
        if status.get("state") == "failed" and status.get("job_id") == started["job_id"]:
            break
        time.sleep(0.05)
    else:
        raise AssertionError(f"build never failed: {rebuild._read_rebuild_status()}")

    assert "exited 1" in status["error"]
    detail_lines = status["error_detail"].splitlines()
    assert len(detail_lines) == 15
    assert detail_lines[0] == "line 16"
    assert detail_lines[-1] == "line 30"


def test_debounced_saves_collapse_into_one_build(monkeypatch):
    fired = []
    monkeypatch.setattr(rebuild, "REBUILD_DEBOUNCE_SECONDS", 0.15)
    monkeypatch.setattr(
        rebuild,
        "_start_rebuild_job",
        lambda reason, include_knowledge=True: fired.append((reason, include_knowledge)),
    )

    first = rebuild._schedule_debounced_rebuild("edit one", include_knowledge=False)
    assert first["state"] == "scheduled"
    second = rebuild._schedule_debounced_rebuild("edit two", include_knowledge=True)
    assert second["state"] == "scheduled"

    deadline = time.time() + 5
    while not fired and time.time() < deadline:
        time.sleep(0.02)
    time.sleep(0.2)  # would catch a second, spurious fire

    # One build for the whole burst; the knowledge request survived the merge.
    assert len(fired) == 1
    assert fired[0][0] == "edit two"
    assert fired[0][1] is True


def test_cancel_supersedes_debounce(monkeypatch):
    fired = []
    monkeypatch.setattr(rebuild, "REBUILD_DEBOUNCE_SECONDS", 0.1)
    monkeypatch.setattr(
        rebuild,
        "_start_rebuild_job",
        lambda reason, include_knowledge=True: fired.append(reason),
    )
    rebuild._schedule_debounced_rebuild("about to be superseded", include_knowledge=True)
    reason, include_knowledge = rebuild._cancel_debounced_rebuild()
    assert reason == "about to be superseded"
    assert include_knowledge is True
    time.sleep(0.25)
    assert fired == []


def test_knowledge_rides_along_at_most_once_per_interval(monkeypatch):
    fired = []
    monkeypatch.setattr(
        rebuild,
        "_start_rebuild_job",
        lambda reason, include_knowledge=True: fired.append(include_knowledge),
    )
    monkeypatch.setattr(rebuild, "REBUILD_KNOWLEDGE_MIN_INTERVAL_SECONDS", 3600)
    monkeypatch.setattr(rebuild, "_last_knowledge_build_at", 0.0)

    rebuild._debounce_state.update(timer=None, reason="k1", include_knowledge=True)
    rebuild._fire_debounced_rebuild()
    rebuild._debounce_state.update(timer=None, reason="k2", include_knowledge=True)
    rebuild._fire_debounced_rebuild()

    assert fired == [True, False]


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
