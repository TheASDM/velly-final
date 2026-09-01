/* Normalized chat state. DOM views never own canonical entities: a thread,
 * message, reaction set, receipt set, cursor, or outbox record has one home
 * here and can be projected into either the overlay or full-page panel. */

function threadIdOf(thread) {
  return thread && (thread.threadId || thread.id || thread.key);
}

function updatedAtOf(message) {
  return Date.parse(message && (message.updatedAt || message.editedAt
    || message.created_at)) || 0;
}

function emptyThreadState(id) {
  return {
    id,
    messages: new Map(),
    reactions: {},
    receipts: {},
    presence: {},
    typing: [],
    cursor: { lastId: 0, since: '', hasOlder: false, hasNewer: false },
    outbox: new Map(),
  };
}

export function createChatStore() {
  const threadsById = new Map();
  const aliases = new Map();
  const threadStates = new Map();
  let order = [];
  let identity = null;

  function ensureState(id) {
    if (!threadStates.has(id)) threadStates.set(id, emptyThreadState(id));
    return threadStates.get(id);
  }

  function resolveThread(reference) {
    const id = aliases.get(reference) || reference;
    return threadsById.get(id) || null;
  }

  function replaceThreads(rawThreads) {
    const nextIds = [];
    (rawThreads || []).forEach((raw) => {
      const id = threadIdOf(raw);
      if (!id) return;
      const prior = threadsById.get(id) || {};
      const thread = { ...prior, ...raw, id, threadId: id };
      threadsById.set(id, thread);
      aliases.set(id, id);
      if (thread.key) aliases.set(thread.key, id);
      nextIds.push(id);
      ensureState(id);
    });
    order = nextIds;
    return getThreads();
  }

  function getThreads() {
    return order.map((id) => threadsById.get(id)).filter(Boolean);
  }

  function stateFor(reference) {
    const thread = resolveThread(reference);
    return thread ? ensureState(thread.id) : null;
  }

  function upsertMessage(reference, message) {
    const state = stateFor(reference || (message && (message.threadId || message.threadKey)));
    if (!state || !message || !Number.isFinite(Number(message.id))) return null;
    const id = Number(message.id);
    const previous = state.messages.get(id);
    if (previous && updatedAtOf(previous) > updatedAtOf(message)) return previous;
    const canonical = { ...previous, ...message, id };
    state.messages.set(id, canonical);
    state.cursor.lastId = Math.max(state.cursor.lastId, id);
    return canonical;
  }

  function applyThreadPayload(reference, payload) {
    const state = stateFor(reference);
    if (!state) return null;
    [...(payload.messages || []), ...(payload.revised || [])]
      .forEach((message) => upsertMessage(reference, message));
    if (payload.reactions) state.reactions = payload.reactions;
    if (payload.receipts) state.receipts = payload.receipts;
    if (payload.presence) state.presence = { ...state.presence, ...payload.presence };
    if (payload.typing) state.typing = [...payload.typing];
    state.cursor = {
      ...state.cursor,
      since: payload.now || state.cursor.since,
      hasOlder: payload.hasOlder == null ? state.cursor.hasOlder : !!payload.hasOlder,
      hasNewer: payload.hasNewer == null ? state.cursor.hasNewer : !!payload.hasNewer,
    };
    return state;
  }

  function setThreadSummary(reference, patch) {
    const thread = resolveThread(reference);
    if (!thread) return null;
    Object.assign(thread, patch || {});
    return thread;
  }

  function setOutbox(entry) {
    const state = stateFor(entry && (entry.threadId || entry.threadKey));
    if (!state || !entry || !entry.clientMessageId) return;
    state.outbox.set(entry.clientMessageId, { ...entry });
  }

  function removeOutbox(reference, clientMessageId) {
    const state = stateFor(reference);
    if (state) state.outbox.delete(clientMessageId);
  }

  function reset(nextIdentity = null) {
    identity = nextIdentity;
    threadsById.clear();
    aliases.clear();
    threadStates.clear();
    order = [];
  }

  return {
    replaceThreads,
    getThreads,
    resolveThread,
    stateFor,
    upsertMessage,
    applyThreadPayload,
    setThreadSummary,
    setOutbox,
    removeOutbox,
    reset,
    setIdentity(value) { identity = value || null; },
    get identity() { return identity; },
  };
}

export { threadIdOf };
