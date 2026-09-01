/* A send is durable before the network sees it. The complete intent stays
 * identity-scoped until the canonical server entity acknowledges it, so a
 * timeout, navigation, or thread switch cannot drop its quote or files. */

const PREFIX = 'vos:chat:outbox:v1:';
const VALID_STATES = new Set(['queued', 'sending', 'failed']);

function keyFor(identity) {
  return identity ? `${PREFIX}${encodeURIComponent(identity)}` : null;
}

function cleanEntry(value) {
  if (!value || typeof value !== 'object' || !value.clientMessageId) return null;
  return {
    clientMessageId: String(value.clientMessageId),
    threadId: String(value.threadId || ''),
    threadKey: String(value.threadKey || ''),
    kind: String(value.kind || 'direct'),
    text: String(value.text || '').slice(0, 4000),
    replyToId: value.replyToId == null ? null : Number(value.replyToId),
    attachmentIds: Array.isArray(value.attachmentIds)
      ? value.attachmentIds.filter((id) => typeof id === 'string').slice(0, 6) : [],
    state: VALID_STATES.has(value.state) ? value.state : 'queued',
    attempts: Math.max(0, Number(value.attempts) || 0),
    createdAt: value.createdAt || new Date().toISOString(),
    updatedAt: value.updatedAt || new Date().toISOString(),
    lastError: value.lastError ? String(value.lastError).slice(0, 500) : '',
  };
}

export function createDurableOutbox(storage = window.localStorage) {
  let identity = null;

  function read(forIdentity = identity) {
    const key = keyFor(forIdentity);
    if (!key) return [];
    try {
      const values = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(values) ? values.map(cleanEntry).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function write(entries) {
    const key = keyFor(identity);
    if (!key) return;
    try { storage.setItem(key, JSON.stringify(entries)); } catch (error) { /* quota */ }
  }

  function put(value) {
    const entry = cleanEntry({ ...value, updatedAt: new Date().toISOString() });
    if (!identity || !entry) throw new Error('Outbox needs an identity and client message ID');
    const entries = read();
    const index = entries.findIndex((item) => item.clientMessageId === entry.clientMessageId);
    if (index >= 0) entries[index] = { ...entries[index], ...entry };
    else entries.push(entry);
    write(entries);
    return entry;
  }

  function update(clientMessageId, patch) {
    const current = read().find((entry) => entry.clientMessageId === clientMessageId);
    return current ? put({ ...current, ...patch }) : null;
  }

  function remove(clientMessageId) {
    write(read().filter((entry) => entry.clientMessageId !== clientMessageId));
  }

  function clear(forIdentity = identity) {
    const key = keyFor(forIdentity);
    if (!key) return;
    try { storage.removeItem(key); } catch (error) { /* unavailable */ }
  }

  return {
    setIdentity(value) { identity = value || null; },
    list: () => read(),
    get: (id) => read().find((entry) => entry.clientMessageId === id) || null,
    enqueue(value) { return put({ ...value, state: 'queued', attempts: 0 }); },
    markSending(id) {
      const current = read().find((entry) => entry.clientMessageId === id);
      return current && update(id, {
        state: 'sending', attempts: current.attempts + 1, lastError: '',
      });
    },
    markFailed(id, error) {
      return update(id, { state: 'failed', lastError: error && error.message || String(error || '') });
    },
    remove,
    clear,
    get identity() { return identity; },
  };
}
