/* Talking to the play layer.
 *
 * Operations are sent one at a time and the server answers with the whole new
 * state, so the client never has to reimplement the rules to stay correct — it
 * predicts just enough to feel instant, then takes the server's word for it.
 *
 * The server is always right. If a prediction and the response disagree, the
 * response wins silently: it applied the house rules, and the prediction is
 * only there so a tap doesn't feel laggy across a room's wifi.
 */

function authHeaders(extra) {
  const pwa = window.VOS_PWA;
  if (pwa && pwa.authHeaders) return pwa.authHeaders(extra || {});
  return extra || {};
}

async function request(url, options) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...(options || {}),
    headers: authHeaders({ 'Content-Type': 'application/json', ...((options || {}).headers || {}) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = body.error_code;
    throw error;
  }
  return body;
}

export function loadPlayState(playerName) {
  const query = playerName ? `?playerName=${encodeURIComponent(playerName)}` : '';
  return request(`/api/play${query}`);
}

export function sendOp(op, playerName) {
  const body = playerName ? { ...op, playerName } : op;
  return request('/api/play/op', { method: 'POST', body: JSON.stringify(body) });
}

export function loadLog(playerName) {
  const query = playerName ? `?playerName=${encodeURIComponent(playerName)}` : '';
  return request(`/api/play/log${query}`);
}

/* The handful of predictions worth making locally.
 *
 * Deliberately partial. Anything with a rules consequence — dropping to 0,
 * exhaustion, a rest — is left to the server rather than half-implemented here,
 * because a wrong guess that flashes on screen is worse than a slower correct
 * one. These are the taps that happen every round.
 */
export function predict(state, op, limits) {
  if (!state) return state;
  const next = JSON.parse(JSON.stringify(state));
  const max = limits && limits.maxHp;

  switch (op.op) {
    case 'damage': {
      const absorbed = Math.min(next.hp.temp || 0, op.amount);
      next.hp.temp -= absorbed;
      if (next.hp.current != null) {
        next.hp.current = Math.max(0, next.hp.current - (op.amount - absorbed));
      }
      // Hitting zero has consequences; let the server say what they are.
      return next.hp.current === 0 ? null : next;
    }
    case 'heal': {
      if (next.hp.current == null) next.hp.current = 0;
      const healed = next.hp.current + op.amount;
      next.hp.current = max != null ? Math.min(healed, max) : healed;
      return next;
    }
    case 'spendSlot': {
      const level = String(op.level);
      const ceiling = ((limits || {}).slots || {})[level];
      const spent = (next.slots[level] || 0) + 1;
      if (ceiling != null && spent > ceiling) return null;
      next.slots[level] = spent;
      return next;
    }
    case 'restoreSlot': {
      const level = String(op.level);
      next.slots[level] = Math.max(0, (next.slots[level] || 0) - 1);
      return next;
    }
    case 'useCharge': {
      const spent = (next.uses[op.feature] || 0) + 1;
      if (op.max != null && spent > op.max) return null;
      next.uses[op.feature] = spent;
      return next;
    }
    case 'restoreCharge':
      next.uses[op.feature] = Math.max(0, (next.uses[op.feature] || 0) - 1);
      return next;
    default:
      return null;
  }
}

/* Reverse an operation, for the undo on the toast. Returns null when an
 * operation cannot be cleanly undone — a rest changes too much to invert, and
 * offering a broken undo is worse than offering none. */
export function inverseOf(op, before) {
  switch (op.op) {
    case 'damage':
      return { op: 'setHp', value: before.hp.current, _restore: before };
    case 'heal':
      return { op: 'setHp', value: before.hp.current };
    case 'setHp':
      return { op: 'setHp', value: before.hp.current };
    case 'setTempHp':
      return { op: 'setTempHp', value: before.hp.temp, keepHigher: false };
    case 'spendSlot':
      return { op: 'restoreSlot', level: op.level };
    case 'restoreSlot':
      return { op: 'spendSlot', level: op.level };
    case 'useCharge':
      return { op: 'restoreCharge', feature: op.feature };
    case 'restoreCharge':
      return { op: 'useCharge', feature: op.feature };
    case 'addCondition':
      return { op: 'removeCondition', condition: op.condition };
    case 'removeCondition':
      return { op: 'addCondition', condition: op.condition };
    case 'adjustExhaustion':
      return { op: 'adjustExhaustion', delta: -op.delta };
    case 'setExhaustion':
      return { op: 'setExhaustion', value: before.exhaustion };
    default:
      return null;
  }
}
