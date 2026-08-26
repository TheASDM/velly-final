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
    # The caller comes from the token alone. _authenticated_player_name() also
    # compares against a name in the request, which is right for endpoints that
    # never accept one — but here a name is the whole point, and letting it
    # decide would refuse the DM before this function ever ran.
    caller = _verify_player_token(_extract_player_token())
    if not caller:
        return None, None, (jsonify({"error": "Login required"}), 401)

    requested = body.get("playerName")
    if requested is None or str(requested) == caller:
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
    """Play state, reconciled against the build it belongs to.

    Yours by default. The DM may ask for someone else's by naming them, which is
    what "view as" reads — the same rule as the operation endpoint, so there is
    one place where a caller may act on another character and it is explicit.
    """
    player_name, _viewer, auth_error = _target_player(request.args)
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


@bp.get("/api/play/party")
def api_play_party():
    """Everyone's play state in one call — the DM's view of the table.

    Returns a row per active roster player, whether or not they have a statblock
    yet, so a character who has not been pushed is visibly missing rather than
    silently absent. Play state is seeded on read the same way the player's own
    sheet seeds it, so opening the party view does not create a different answer
    from opening a sheet.
    """
    admin_error = _admin_error_response()
    if admin_error:
        return admin_error

    party = []
    with _app_db() as conn:
        for player_name in PLAYER_NAMES:
            if player_name == "DM" or player_name in REVOKED_PLAYERS:
                continue

            statblock = _load_statblock(conn, player_name)
            derived = (statblock or {}).get("derived") or {}
            state, version, fresh = _read_state(conn, player_name, statblock)
            limits = limits_from_statblock(statblock)
            state = reconcile(state, limits)
            if fresh and statblock:
                _persist(conn, player_name, state, version, _utc_now_iso())

            classes = derived.get("classes") or []
            party.append({
                "playerName": player_name,
                "hasStatblock": bool(statblock),
                "character": (statblock or {}).get("name") or player_name,
                "level": derived.get("level"),
                "classLine": " / ".join(
                    " ".join(str(x) for x in [c.get("subclass"), c.get("name"), c.get("levels")] if x)
                    for c in classes),
                "ac": derived.get("ac"),
                "state": _decorate(state),
                "limits": limits,
                "version": version,
            })

    return jsonify({"ok": True, "party": party, "at": _utc_now_iso()})


@bp.get("/api/play/log")
def api_play_log():
    """Recent operations — what an undo and a session recap read from."""
    # Same resolution as everywhere else: yours unless you are the DM and say
    # otherwise. Going through _authenticated_player_name() here would refuse
    # the DM, because it treats a name in the request as a claim about identity.
    player_name, _viewer, auth_error = _target_player(request.args)
    if auth_error:
        return auth_error

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


__all__ = ['OP_LOG_LIMIT', '_decorate', 'api_play_party', '_load_statblock', '_load_play_row', '_read_state',
           '_persist', '_target_player', 'api_play_state', 'api_play_op', 'api_play_log']
