// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAttachmentBlobStore } from '../../src/js/chat/attachment-blobs.js';

describe('private attachment blob lifecycle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('hydrates through authenticated fetch abstraction and revokes on delete', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const load = vi.fn().mockResolvedValue(new Blob(['secret'], { type: 'image/png' }));
    const blobs = createAttachmentBlobStore(load);
    const message = {
      id: 1,
      attachments: [{ id: 'abc', kind: 'image', url: '/api/im/attachment/abc' }],
    };

    const hydrated = await blobs.hydrateMessage(message);
    expect(load).toHaveBeenCalledWith(message.attachments[0]);
    expect(create).toHaveBeenCalledOnce();
    expect(hydrated.attachments[0].blobUrl).toBe('blob:private');

    blobs.revokeMessage(hydrated);
    expect(revoke).toHaveBeenCalledWith('blob:private');
  });
});
