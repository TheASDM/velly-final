"""The mutable half of a character sheet.

Foundry owns who a character is. This owns what is happening to them: current
hit points, expended slots, spent hit dice, conditions, an active mask. The two
never write to the same field, so they can never disagree.

Every change arrives as a named operation rather than a state write, for three
reasons that all matter at a real table:

  - Two devices touch the same character seconds apart. `damage 7` and
    `spendSlot 1` compose; two writes of a whole state document do not, and one
    of them would vanish silently.
  - A phone that dropped off the wifi can replay its queue when it comes back
    and still arrive at the right answer.
  - Undo, a session log, and any future sync back into Foundry all need to know
    what happened, not just where things ended up.

OPS is also the security boundary. There is no generic setter — a field with no
operation cannot be changed through this API at all, which is what keeps ability
scores, AC and max HP out of players' hands by construction rather than by
convention.

House rules from House-Rules/simplification.md are applied here rather than in
the client, so every device agrees: no death saves, Exhaustion as the death
clock, and the Dying condition.
"""
from ..imports import *
from ..symbols import *
from ..config import *

STATE_VERSION = 1
MAX_EXHAUSTION = 6          # six is fatal, per the house rules
CONDITION_MAX = 24
NOTE_MAX = 200

# The 2024 conditions, plus Dying, which replaces unconsciousness at this table.
CONDITIONS = {
    "blinded", "charmed", "deafened", "dying", "exhaustion", "frightened",
    "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
    "poisoned", "prone", "restrained", "stunned", "unconscious",
}


def default_state():
    return {
        "v": STATE_VERSION,
        "hp": {"current": None, "temp": 0},
        "exhaustion": 0,
        "slots": {},
        "pact": 0,
        "hitDiceSpent": 0,
        "uses": {},
        "prepared": [],
        "conditions": [],
        "reaction": {"used": False, "assessUsed": False},
        "mask": None,
        "form": None,
        "items": [],
        "seededAt": None,
    }


def limits_from_statblock(statblock):
    """What the build layer says the play layer may not exceed.

    Read from the pushed `derived` block, so the ceilings are Foundry's own
    numbers.

    `known` matters as much as the numbers. Without a statblock the ceilings are
    unknown and the handlers stay permissive — refusing to let someone record
    damage until their sheet has been pushed would be worse than allowing it.
    With one, silence becomes an answer: a spell level absent from `slots` means
    they have none, not that they have unlimited.
    """
    derived = (statblock or {}).get("derived") or {}
    hp = derived.get("hp") or {}
    slots = {}
    for key, slot in (derived.get("spells") or {}).items():
        match = re.fullmatch(r"spell([1-9])", str(key))
        if match and int((slot or {}).get("max") or 0) > 0:
            slots[match.group(1)] = int(slot["max"])
    hit_dice = derived.get("hitDice") or {}
    return {
        "known": bool(derived),
        "maxHp": hp.get("max"),
        "slots": slots,
        "pact": int(((derived.get("spells") or {}).get("pact") or {}).get("max") or 0),
        "hitDice": hit_dice.get("max"),
        "prof": derived.get("prof"),
    }


def _clamp(value, low, high):
    if high is not None:
        value = min(value, high)
    return max(value, low)


def _int_arg(op, key, default=0, low=0, high=10_000):
    raw = op.get(key, default)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise OpError(f"{key} must be a whole number")
    if value < low or value > high:
        raise OpError(f"{key} must be between {low} and {high}")
    return value


class OpError(ValueError):
    """A rejected operation. The message reaches the client."""


# ── Handlers ──────────────────────────────────────────────────────────
#
# Each takes (state, op, limits) and mutates state in place. Returning a
# description is optional; it is what the undo toast and the session log show.

def _op_damage(state, op, limits):
    amount = _int_arg(op, "amount", low=0)
    critical = bool(op.get("critical"))
    hp = state["hp"]
    was_dying = "dying" in state["conditions"]

    # Temporary hit points soak first and are not restored by healing.
    absorbed = min(hp["temp"], amount)
    hp["temp"] -= absorbed
    remaining = amount - absorbed

    if hp["current"] is not None:
        hp["current"] = max(0, hp["current"] - remaining)

    notes = [f"{amount} damage"]

    # House rule: no death saves. Dropping to 0 costs a point of Exhaustion and
    # gives you Dying; taking damage while already Dying costs two, or three on
    # a critical.
    if was_dying:
        cost = 3 if critical else 2
        state["exhaustion"] = _clamp(state["exhaustion"] + cost, 0, MAX_EXHAUSTION)
        notes.append(f"+{cost} exhaustion (damaged while Dying)")
    elif hp["current"] == 0:
        state["exhaustion"] = _clamp(state["exhaustion"] + 1, 0, MAX_EXHAUSTION)
        if "dying" not in state["conditions"]:
            state["conditions"].append("dying")
        notes.append("dropped to 0 — Dying, +1 exhaustion")

    return ", ".join(notes)


def _op_heal(state, op, limits):
    amount = _int_arg(op, "amount", low=0)
    hp = state["hp"]
    if hp["current"] is None:
        hp["current"] = 0
    hp["current"] = _clamp(hp["current"] + amount, 0, limits.get("maxHp"))
    if hp["current"] > 0 and "dying" in state["conditions"]:
        state["conditions"].remove("dying")
        return f"healed {amount} — no longer Dying"
    return f"healed {amount}"


def _op_set_hp(state, op, limits):
    """Setting hit points directly is still play state, and the DM needs it."""
    value = _int_arg(op, "value", low=0)
    state["hp"]["current"] = _clamp(value, 0, limits.get("maxHp"))
    return f"hit points set to {state['hp']['current']}"


def _op_set_temp_hp(state, op, limits):
    value = _int_arg(op, "value", low=0)
    # Temporary hit points never stack; the larger pool wins.
    state["hp"]["temp"] = max(state["hp"]["temp"], value) if op.get("keepHigher", True) else value
    return f"temporary hit points {state['hp']['temp']}"


def _op_set_exhaustion(state, op, limits):
    state["exhaustion"] = _clamp(_int_arg(op, "value", low=0, high=MAX_EXHAUSTION),
                                 0, MAX_EXHAUSTION)
    return f"exhaustion {state['exhaustion']}"


def _op_adjust_exhaustion(state, op, limits):
    delta = _int_arg(op, "delta", low=-MAX_EXHAUSTION, high=MAX_EXHAUSTION)
    state["exhaustion"] = _clamp(state["exhaustion"] + delta, 0, MAX_EXHAUSTION)
    return f"exhaustion {state['exhaustion']}"


def _slot_level(op):
    level = str(_int_arg(op, "level", low=1, high=9))
    return level


def _op_spend_slot(state, op, limits):
    level = _slot_level(op)
    maximum = (limits.get("slots") or {}).get(level)
    if maximum is None and limits.get("known"):
        raise OpError(f"No level {level} slots")
    spent = int(state["slots"].get(level, 0)) + 1
    if maximum is not None and spent > maximum:
        raise OpError(f"No level {level} slots remaining")
    state["slots"][level] = spent
    return f"spent a level {level} slot"


def _op_restore_slot(state, op, limits):
    level = _slot_level(op)
    state["slots"][level] = max(0, int(state["slots"].get(level, 0)) - 1)
    return f"restored a level {level} slot"


def _op_spend_pact(state, op, limits):
    maximum = limits.get("pact") or 0
    if limits.get("known") and not maximum:
        raise OpError("No pact slots")
    if maximum and state["pact"] + 1 > maximum:
        raise OpError("No pact slots remaining")
    state["pact"] += 1
    return "spent a pact slot"


def _op_spend_hit_die(state, op, limits):
    maximum = limits.get("hitDice")
    spent = state["hitDiceSpent"] + 1
    if maximum is not None and spent > maximum:
        raise OpError("No hit dice remaining")
    state["hitDiceSpent"] = spent
    healed = _int_arg(op, "healed", low=0)
    if healed:
        _op_heal(state, {"amount": healed}, limits)
        return f"spent a hit die, healed {healed}"
    return "spent a hit die"


def _op_use_charge(state, op, limits):
    feature = str(op.get("feature") or "").strip()[:64]
    if not feature:
        raise OpError("feature is required")
    maximum = op.get("max")
    spent = int(state["uses"].get(feature, 0)) + 1
    if maximum is not None and spent > int(maximum):
        raise OpError("No uses remaining")
    state["uses"][feature] = spent
    return "used a charge"


def _op_restore_charge(state, op, limits):
    feature = str(op.get("feature") or "").strip()[:64]
    if not feature:
        raise OpError("feature is required")
    state["uses"][feature] = max(0, int(state["uses"].get(feature, 0)) - 1)
    return "restored a charge"


def _op_add_condition(state, op, limits):
    key = str(op.get("condition") or "").strip().lower()[:32]
    if key not in CONDITIONS:
        raise OpError(f"Unknown condition {key!r}")
    if key not in state["conditions"]:
        if len(state["conditions"]) >= CONDITION_MAX:
            raise OpError("Too many conditions")
        state["conditions"].append(key)
    return f"gained {key}"


def _op_remove_condition(state, op, limits):
    key = str(op.get("condition") or "").strip().lower()[:32]
    if key in state["conditions"]:
        state["conditions"].remove(key)
    return f"cleared {key}"


def _op_use_reaction(state, op, limits):
    if state["reaction"]["used"]:
        raise OpError("Reaction already used this round")
    state["reaction"]["used"] = True
    return "reaction used"


def _op_use_assess(state, op, limits):
    # House rule: Assess is once per player per combat, not per round.
    if state["reaction"]["assessUsed"]:
        raise OpError("Assess already used this combat")
    state["reaction"]["assessUsed"] = True
    state["reaction"]["used"] = True
    return "assessed"


def _op_new_round(state, op, limits):
    state["reaction"]["used"] = False
    return "new round"


def _op_end_combat(state, op, limits):
    state["reaction"] = {"used": False, "assessUsed": False}
    return "combat ended"


# ── Rests ─────────────────────────────────────────────────────────────

def _op_short_rest(state, op, limits):
    """30 minutes. Hit dice are spent individually, so nothing is restored
    here beyond short-rest resources; the dice themselves come back on a long
    rest."""
    state["pact"] = 0
    for feature in list(state["uses"]):
        if feature in set(op.get("shortRestFeatures") or []):
            state["uses"][feature] = 0
    state["reaction"] = {"used": False, "assessUsed": False}
    return "short rest"


def _op_field_rest(state, op, limits):
    """8 hours somewhere unsafe. Not a long rest — its only benefit is that
    hit dice spent during it heal for their maximum, which the client applies
    as a heal, so there is nothing to restore here."""
    state["reaction"] = {"used": False, "assessUsed": False}
    return "field rest"


def _op_long_rest(state, op, limits):
    max_hp = limits.get("maxHp")
    state["hp"]["current"] = max_hp if max_hp is not None else state["hp"]["current"]
    state["hp"]["temp"] = 0
    state["slots"] = {}
    state["pact"] = 0
    # Half your hit dice back, rounded down, minimum one.
    total = limits.get("hitDice")
    if total:
        state["hitDiceSpent"] = max(0, state["hitDiceSpent"] - max(1, total // 2))
    else:
        state["hitDiceSpent"] = 0
    state["uses"] = {}
    state["exhaustion"] = max(0, state["exhaustion"] - 1)
    if "dying" in state["conditions"]:
        state["conditions"].remove("dying")
    state["reaction"] = {"used": False, "assessUsed": False}
    state["mask"] = None
    state["form"] = None
    return "long rest"


OPS = {
    "damage": _op_damage,
    "heal": _op_heal,
    "setHp": _op_set_hp,
    "setTempHp": _op_set_temp_hp,
    "setExhaustion": _op_set_exhaustion,
    "adjustExhaustion": _op_adjust_exhaustion,
    "spendSlot": _op_spend_slot,
    "restoreSlot": _op_restore_slot,
    "spendPactSlot": _op_spend_pact,
    "spendHitDie": _op_spend_hit_die,
    "useCharge": _op_use_charge,
    "restoreCharge": _op_restore_charge,
    "addCondition": _op_add_condition,
    "removeCondition": _op_remove_condition,
    "useReaction": _op_use_reaction,
    "useAssess": _op_use_assess,
    "newRound": _op_new_round,
    "endCombat": _op_end_combat,
    "shortRest": _op_short_rest,
    "fieldRest": _op_field_rest,
    "longRest": _op_long_rest,
}


def apply_op(state, op, limits):
    """Apply one operation to a copy of state. Raises OpError if refused."""
    name = op.get("op")
    handler = OPS.get(name) if isinstance(name, str) else None
    if handler is None:
        raise OpError(f"Unknown operation {name!r}")

    working = json.loads(json.dumps(state))  # never mutate the caller's copy
    note = handler(working, op, limits or {})
    return working, (note or name)[:NOTE_MAX]


def seed_from_statblock(statblock):
    """Play state for a character we have not seen before.

    Foundry's current values are a reasonable starting point exactly once. After
    this the two diverge on purpose, and pushes stop touching any of it.
    """
    state = default_state()
    derived = (statblock or {}).get("derived") or {}
    hp = derived.get("hp") or {}
    state["hp"]["current"] = hp.get("value") if hp.get("value") is not None else hp.get("max")
    state["hp"]["temp"] = int(hp.get("temp") or 0)

    for key, slot in (derived.get("spells") or {}).items():
        match = re.fullmatch(r"spell([1-9])", str(key))
        if not match:
            continue
        maximum = int((slot or {}).get("max") or 0)
        value = int((slot or {}).get("value") or 0)
        if maximum > 0 and value < maximum:
            state["slots"][match.group(1)] = maximum - value

    hit_dice = derived.get("hitDice") or {}
    if hit_dice.get("max") is not None and hit_dice.get("value") is not None:
        state["hitDiceSpent"] = max(0, int(hit_dice["max"]) - int(hit_dice["value"]))

    state["seededAt"] = _utc_now_iso()
    return state


def reconcile(state, limits):
    """Keep play state inside the build's ceilings after a Foundry push.

    A level-up raises maximum hit points; a rebuild can lower them. Neither
    should leave a character sitting above their own maximum, and slot counts
    should not exceed what they now have.
    """
    state = json.loads(json.dumps(state))
    max_hp = limits.get("maxHp")
    if max_hp is not None and state["hp"]["current"] is not None:
        state["hp"]["current"] = _clamp(state["hp"]["current"], 0, max_hp)

    for level, spent in list(state["slots"].items()):
        maximum = limits.get("slots", {}).get(level)
        if maximum is None:
            state["slots"].pop(level, None)
        else:
            state["slots"][level] = _clamp(int(spent), 0, maximum)

    total = limits.get("hitDice")
    if total is not None:
        state["hitDiceSpent"] = _clamp(state["hitDiceSpent"], 0, total)

    state["exhaustion"] = _clamp(state["exhaustion"], 0, MAX_EXHAUSTION)
    return state


__all__ = [
    'STATE_VERSION', 'MAX_EXHAUSTION', 'CONDITIONS', 'OPS', 'OpError',
    'default_state', 'limits_from_statblock', 'apply_op', 'seed_from_statblock',
    'reconcile',
]
