import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  whenPwaReady: vi.fn(),
  fetchThreads: vi.fn(),
  fetchProfiles: vi.fn(),
  fetchMessages: vi.fn(),
  markThreadRead: vi.fn(),
}));

vi.mock('../../src/js/shared/pwa.js', () => ({
  escapeHtml: (value) => String(value || ''),
  whenPwaReady: mocks.whenPwaReady,
}));

vi.mock('../../src/js/chat/api.js', () => ({
  deleteMessage: vi.fn(),
  editMessage: vi.fn(),
  fetchMessages: mocks.fetchMessages,
  fetchOlderMessages: vi.fn(),
  fetchProfiles: mocks.fetchProfiles,
  fetchThreads: mocks.fetchThreads,
  markThreadRead: mocks.markThreadRead,
  sendMessage: vi.fn(),
  sendTyping: vi.fn(),
  setReaction: vi.fn(),
  setThreadMuted: vi.fn(),
  streamToEnzo: vi.fn(),
}));

vi.mock('../../src/js/chat/attachments.js', () => ({
  ACCEPT: 'image/*',
  createAttachmentTray: () => ({
    get hasReady() { return false; },
    uploading: false,
    addFiles: vi.fn(),
    clear: vi.fn(),
    take: () => [],
  }),
  wireFileIntake: vi.fn(),
}));

vi.mock('../../src/js/chat/bubble.js', () => ({
  renderBubble: (message) => {
    const node = document.createElement('div');
    node.className = 'vos-chat-bubble';
    node.dataset.id = String(message.id);
    node.dataset.sender = message.sender;
    node.dataset.at = message.created_at;
    node.textContent = message.body;
    return node;
  },
}));

vi.mock('../../src/js/components/image-zoom.js', () => ({ openImageViewer: vi.fn() }));

import { createChatPanel } from '../../src/js/chat/panel.js';

function threadData() {
  return {
    threads: [{ key: 'party', kind: 'party', label: 'The Party', unread: 1, last: null }],
    presence: {},
  };
}

describe('chat panel privacy lifecycle', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.VOS_RENDER_MARKDOWN = (value) => value;
    mocks.fetchProfiles.mockResolvedValue({ profiles: [] });
    mocks.fetchThreads.mockResolvedValue(threadData());
    mocks.fetchMessages.mockResolvedValue({
      messages: [], revised: [], reactions: {}, receipts: {}, presence: {},
      typing: [], now: '2026-08-31T00:00:00Z', hasOlder: false, hasNewer: false,
    });
    mocks.markThreadRead.mockResolvedValue({ ok: true, lastReadId: 1 });
  });

  it('refuses to hydrate private messaging during a player preview', async () => {
    const ensureIdentity = vi.fn();
    mocks.whenPwaReady.mockResolvedValue({
      isPreviewing: () => true,
      ensureIdentity,
    });
    const panel = createChatPanel({ mode: 'page' });
    document.body.append(panel.root);

    await expect(panel.boot()).resolves.toBeNull();

    expect(ensureIdentity).not.toHaveBeenCalled();
    expect(mocks.fetchThreads).not.toHaveBeenCalled();
    expect(panel.root.textContent).toContain('Messaging is unavailable while previewing');
  });

  it('drops stale boot responses after an identity reset', async () => {
    let resolveThreads;
    mocks.whenPwaReady.mockResolvedValue({
      isPreviewing: () => false,
      ensureIdentity: () => Promise.resolve('Lotan'),
    });
    mocks.fetchThreads.mockImplementation(() => new Promise((resolve) => {
      resolveThreads = resolve;
    }));
    const panel = createChatPanel({ mode: 'page' });
    document.body.append(panel.root);

    const booting = panel.boot();
    await vi.waitFor(() => expect(resolveThreads).toBeTypeOf('function'));
    panel.resetForIdentity('Valentro');
    resolveThreads(threadData());

    await expect(booting).resolves.toBeNull();
    expect(panel.playerName).toBeNull();
    expect(panel.hasThread('party')).toBe(false);
  });

  it('purges rendered messages and outgoing-seat drafts on logout', async () => {
    mocks.whenPwaReady.mockResolvedValue({
      isPreviewing: () => false,
      ensureIdentity: () => Promise.resolve('Lotan'),
    });
    mocks.fetchMessages.mockResolvedValue({
      messages: [{
        id: 1, threadKey: 'party', sender: 'DM', body: 'Secret for Lotan',
        created_at: '2026-08-31T00:00:00Z', attachments: [],
      }],
      revised: [], reactions: {}, receipts: {}, presence: {}, typing: [],
      now: '2026-08-31T00:00:01Z', hasOlder: false, hasNewer: false,
    });
    const panel = createChatPanel({ mode: 'page' });
    document.body.append(panel.root);
    await panel.boot();
    await panel.openThread('party');
    const input = panel.root.querySelector('.vos-chat-input');
    input.value = 'unsent private draft';
    input.dispatchEvent(new Event('input'));

    panel.resetForIdentity(null);

    expect(panel.root.textContent).not.toContain('Secret for Lotan');
    expect(panel.root.textContent).not.toContain('unsent private draft');
    expect(window.sessionStorage.getItem('vos:chat:state:Lotan')).toBeNull();
    expect(panel.playerName).toBeNull();
  });

  it('renders the DM-only Vesper fixture as a read-only conversation', async () => {
    mocks.whenPwaReady.mockResolvedValue({
      isPreviewing: () => false,
      ensureIdentity: () => Promise.resolve('DM'),
    });
    mocks.fetchThreads.mockResolvedValue({
      threads: [{
        key: 'DM|Vesper', kind: 'tester', label: 'Vesper', unread: 1, last: null,
      }],
      presence: {},
    });
    const panel = createChatPanel({ mode: 'page' });
    document.body.append(panel.root);

    await panel.boot();
    await panel.openThread('DM|Vesper');

    expect(panel.root.querySelector('.vos-chat-title').textContent).toBe('Vesper');
    expect(panel.root.querySelector('.vos-chat-composer').hidden).toBe(true);
    expect(panel.root.querySelector('.vos-chat-mute').hidden).toBe(true);
    expect(panel.root.textContent).toContain('Use the local push console');
  });
});
