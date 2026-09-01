/* Commands and async ownership for chat. Views may switch threads while a
 * command is in flight; the command still updates its originating normalized
 * thread and the view decides whether that thread is currently projected. */

export function createChatController({ store, outbox }) {
  let identity = null;
  let lifecycle = 0;
  let selectedThreadId = null;

  function setIdentity(nextIdentity) {
    if (identity !== nextIdentity) lifecycle += 1;
    identity = nextIdentity || null;
    store.setIdentity(identity);
    outbox.setIdentity(identity);
  }

  function selectThread(reference) {
    const thread = store.resolveThread(reference);
    selectedThreadId = thread ? thread.id : null;
    return { thread: thread || null, generation: ++lifecycle };
  }

  function enqueue(payload) {
    const thread = store.resolveThread(payload.threadId || payload.threadKey);
    if (!thread) throw new Error('No such thread');
    const entry = outbox.enqueue({
      ...payload,
      threadId: thread.id,
      threadKey: thread.key || payload.threadKey || '',
    });
    store.setOutbox(entry);
    return entry;
  }

  async function deliver(clientMessageId, transport) {
    let entry = outbox.get(clientMessageId);
    if (!entry) throw new Error('Pending message not found');
    entry = outbox.markSending(clientMessageId);
    store.setOutbox(entry);
    try {
      const result = await transport(entry);
      const message = result && result.message;
      if (message) store.upsertMessage(entry.threadId, message);
      outbox.remove(clientMessageId);
      store.removeOutbox(entry.threadId, clientMessageId);
      return result;
    } catch (error) {
      const failed = outbox.markFailed(clientMessageId, error);
      if (failed) store.setOutbox(failed);
      throw error;
    }
  }

  function purgeIdentity(outgoingIdentity = identity) {
    outbox.clear(outgoingIdentity);
    lifecycle += 1;
    selectedThreadId = null;
    store.reset(null);
    setIdentity(null);
  }

  return {
    setIdentity,
    selectThread,
    enqueue,
    deliver,
    purgeIdentity,
    pending: () => outbox.list(),
    isSelected(reference) {
      const thread = store.resolveThread(reference);
      return !!thread && thread.id === selectedThreadId;
    },
    get generation() { return lifecycle; },
    get identity() { return identity; },
  };
}
