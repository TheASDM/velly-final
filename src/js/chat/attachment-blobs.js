import { fetchAttachmentBlob } from './api.js';

/* Object URLs are capabilities to already-authorized private bytes. Keep one
 * per attachment, never persist them, and revoke them on delete/logout. */
export function createAttachmentBlobStore(loadBlob = fetchAttachmentBlob) {
  const urls = new Map();
  const pending = new Map();

  async function load(file) {
    if (!file || !file.id) return file;
    if (urls.has(file.id)) return { ...file, blobUrl: urls.get(file.id) };
    if (!pending.has(file.id)) {
      pending.set(file.id, Promise.resolve(loadBlob(file)).then((blob) => {
        const url = URL.createObjectURL(blob);
        urls.set(file.id, url);
        pending.delete(file.id);
        return url;
      }).catch((error) => {
        pending.delete(file.id);
        throw error;
      }));
    }
    const blobUrl = await pending.get(file.id);
    return { ...file, blobUrl };
  }

  async function hydrateMessage(message) {
    if (!message || message.deleted || !(message.attachments || []).length) return message;
    const attachments = await Promise.all((message.attachments || []).map(async (file) => {
      try { return await load(file); } catch (error) {
        return { ...file, blobError: error.message || 'Attachment unavailable' };
      }
    }));
    return { ...message, attachments };
  }

  function revoke(id) {
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
    pending.delete(id);
  }

  function revokeMessage(message) {
    (message && message.attachments || []).forEach((file) => revoke(file.id));
  }

  function revokeAll() {
    [...urls].forEach(([id]) => revoke(id));
    pending.clear();
  }

  return { load, hydrateMessage, revoke, revokeMessage, revokeAll };
}
