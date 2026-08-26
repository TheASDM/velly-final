"""Play state: reading it, and changing it one operation at a time.

Two rules hold this together.

  A player may only touch their own character. The name comes from the verified
  token and a player cannot name a target; only the DM may, and only explicitly.

  Nothing here can reach the build layer. The endpoint takes an operation name
  from a fixed registry, never a patch — so there is no request that edits an
  ability score, because no operation to do so exists.
"""
from ..imports import *
from ..symbols import *
from ..config import *

bp = Blueprint("play", __name__)

OP_LOG_LIMIT = 50


def _load_statblock(conn, player_name):
    row = conn.execute(
        "SELECT data FROM character_statblocks WHERE player_name = ?", (player_name,)
    ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["data"])
    except (TypeError, ValueError):
        logging.warning("statblock for %r is not valid JSON", player_name)
        return None


def _load_play_row(conn, player_name):
    return conn.execute(
        "SELECT * FROM character_play_state WHERE player_name = ?", (player_name,)
    ).fetchone()


def _read_state(conn, player_name, statblock):
    """Current play state, seeded from Foundry the first time we are asked."""
    row = _load_play_row(conn, player_name)
    if row:
        try:
            return json.loads(row["state"]), int(row["version"]), False
        except (TypeError, ValueError):
            logging.warning("play state for %r is not valid JSON; reseeding", player_name)
    return seed_from_statblock(statblock), 0, True


def _decorate(state):
    """Add what only the server can know: how long a mask has left.

    The countdown runs on server time so a locked phone or a closed tab does not
    stop it, and a paused mask reports the remainder it was paused with.
    """
    mask = state.get("mask")
    if mask:
        mask = dict(mask)
        mask["remainingMs"] = _mask_remaining(state["mask"])
        mask["paused"] = state["mask"].get("pausedRemaining") is not None
        state = {**state, "mask": mask}
    return state


def _persist(conn, player_name, state, version, now):
    conn.execute(
        """
        INSERT INTO character_play_state (player_name, state, version, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(player_name) DO UPDATE SET
            state = excluded.state, version = excluded.version, updated_at = excluded.updated_at
        """,
        (player_name, json.dumps(state, separators=(",", ":")), version, now),
    )


def _target_player(body):
    """Who this request acts on.

    A player is always themselves. The DM may act on anyone, but has to say so —
    there is no implicit target, so a mis-sent request fails rather than
    silently editing the wrong character.
    """
    caller, auth_error = _authenticated_player_name()
    if auth_error:
        return None, None, auth_error

    requested = body.get("playerName")
    if requested is None:
        return caller, caller, None

    if not _is_dm_player(caller):
        return None, None, (jsonify({
            "error": "You can only change your own character.",
            "error_code": "forbidden_target",
        }), 403)

    requested = str(requested)
    if requested not in PLAYER_NAMES or requested in REVOKED_PLAYERS:
        return None, None, (jsonify({
            "error": f"{requested!r} is not an active roster player.",
            "error_code": "unknown_player",
        }), 422)
    return requested, caller, None


@bp.get("/api/play")
def api_play_state():
    """The signed-in player's play state, reconciled against their build."""
    player_name, auth_error = _authenticated_player_name()
    if auth_error:
        return auth_error

    with _app_db() as conn:
        statblock = _load_statblock(conn, player_name)
        state, version, fresh = _read_state(conn, player_name, statblock)
        limits = limits_from_statblock(statblock)
        state = reconcile(state, limits)
        if fresh:
            _persist(conn, player_name, state, version, _utc_now_iso())

    return jsonify({
        "ok": True,
        "playerName": player_name,
        "state": _decorate(state),
        "version": version,
        "limits": limits,
    })


@bp.post("/api/play/op")
def api_play_op():
    """Apply one operation. The only way play state ever changes."""
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return jsonify({"error": "Body must be a JSON object", "error_code": "bad_json"}), 400

    player_name, applied_by, auth_error = _target_player(body)
    if auth_error:
        return auth_error

    op = body.get("op")
    if not isinstance(op, str) or op not in OPS:
        return jsonify({
            "error": f"Unknown operation {op!r}",
            "error_code": "unknown_op",
            "allowed": sorted(OPS),
        }), 400

    now = _utc_now_iso()
    with _app_db() as conn:
        statblock = _load_statblock(conn, player_name)
        limits = limits_from_statblock(statblock)
        state, version, _fresh = _read_state(conn, player_name, statblock)
        state = reconcile(state, limits)

        try:
            state, note = apply_op(state, body, limits)
        except OpError as exc:
            # A refusal is a normal outcome — no slots left, already Dying —
            # so it reports cleanly rather than as a server error.
            return jsonify({"error": str(exc), "error_code": "op_refused"}), 409

        version += 1
        _persist(conn, player_name, state, version, now)
        conn.execute(
            """
            INSERT INTO character_play_ops (player_name, op, applied_by, version, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (player_name, json.dumps(body, separators=(",", ":")), applied_by, version, now),
        )

    return jsonify({
        "ok": True,
        "playerName": player_name,
        "state": _decorate(state),
        "version": version,
        "limits": limits,
        "note": note,
    })


@bp.get("/api/play/log")
def api_play_log():
    """Recent operations — what an undo and a session recap read from."""
    player_name, auth_error = _authenticated_player_name()
    if auth_error:
        return auth_error

    requested = request.args.get("playerName")
    if requested and requested != player_name:
        if not _is_dm_player(player_name):
            return jsonify({
                "error": "You can only read your own log.",
                "error_code": "forbidden_target",
            }), 403
        player_name = requested

    with _app_db() as conn:
        rows = conn.execute(
            """
            SELECT op, applied_by, version, created_at FROM character_play_ops
            WHERE player_name = ? ORDER BY id DESC LIMIT ?
            """,
            (player_name, OP_LOG_LIMIT),
        ).fetchall()

    entries = []
    for row in rows:
        try:
            op = json.loads(row["op"])
        except (TypeError, ValueError):
            continue
        entries.append({
            "op": op,
            "appliedBy": row["applied_by"],
            "version": row["version"],
            "at": row["created_at"],
        })
    return jsonify({"ok": True, "playerName": player_name, "entries": entries})


__all__ = ['OP_LOG_LIMIT', '_decorate', '_load_statblock', '_load_play_row', '_read_state',
           '_persist', '_target_player', 'api_play_state', 'api_play_op', 'api_play_log']
