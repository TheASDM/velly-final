// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { createChatController } from '../../src/js/chat/controller.js';
import { createDurableOutbox } from '../../src/js/chat/outbox.js';
import { createChatStore } from '../../src/js/chat/store.js';

const THREAD_ID = '8b0f9419-e725-54a3-a257-7fcfb8185512';
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};

describe('normalized chat store', () => {
  it('resolves legacy and opaque references to one thread entity', () => {
    const store = createChatStore();
    store.replaceThreads([{ key: 'DM|Lotan', threadId: THREAD_ID, label: 'DM' }]);

    expect(store.resolveThread('DM|Lotan')).toBe(store.resolveThread(THREAD_ID));
    expect(store.getThreads()[0].id).toBe(THREAD_ID);
  });

  it('keeps messages isolated per thread and refuses an older rewrite', () => {
    const store = createChatStore();
    store.replaceThreads([
      { key: 'party', threadId: 'party-id' },
      { key: 'DM|Lotan', threadId: THREAD_ID },
    ]);
    store.upsertMessage('party-id', { id: 1, body: 'party', updatedAt: '2026-09-01T02:00:00Z' });
    store.upsertMessage(THREAD_ID, { id: 2, body: 'new', updatedAt: '2026-09-01T03:00:00Z' });
    store.upsertMessage(THREAD_ID, { id: 2, body: 'stale', updatedAt: '2026-09-01T01:00:00Z' });

    expect(store.stateFor('party').messages.get(1).body).toBe('party');
    expect(store.stateFor(THREAD_ID).messages.get(2).body).toBe('new');
  });
});

describe('durable outbox controller', () => {
  beforeEach(() => values.clear());

  function setup() {
    const store = createChatStore();
    store.replaceThreads([{ key: 'DM|Lotan', threadId: THREAD_ID }]);
    const outbox = createDurableOutbox(storage);
    const controller = createChatController({ store, outbox });
    controller.setIdentity('lotan-seat');
    return { store, outbox, controller };
  }

  it('persists the complete send until canonical acknowledgement', async () => {
    const { outbox, controller } = setup();
    const entry = controller.enqueue({
      clientMessageId: '04c78a15-ceee-4a39-8946-078909c0b41a',
      threadId: THREAD_ID,
      text: 'Keep all of this',
      replyToId: 41,
      attachmentIds: ['abc'],
    });

    expect(outbox.get(entry.clientMessageId)).toMatchObject({
      text: 'Keep all of this', replyToId: 41, attachmentIds: ['abc'], state: 'queued',
    });
    await controller.deliver(entry.clientMessageId, async () => ({
      message: { id: 42, threadId: THREAD_ID, body: 'Keep all of this' },
    }));
    expect(outbox.get(entry.clientMessageId)).toBeNull();
  });

  it('retains the same client ID and payload after a transient failure', async () => {
    const { outbox, controller } = setup();
    const entry = controller.enqueue({
      clientMessageId: '04c78a15-ceee-4a39-8946-078909c0b41a',
      threadId: THREAD_ID,
      text: 'retry me',
      attachmentIds: ['def'],
    });
    await expect(controller.deliver(entry.clientMessageId, async () => {
      throw new Error('offline');
    })).rejects.toThrow('offline');

    expect(outbox.get(entry.clientMessageId)).toMatchObject({
      state: 'failed', attempts: 1, text: 'retry me', attachmentIds: ['def'],
    });
  });
});
