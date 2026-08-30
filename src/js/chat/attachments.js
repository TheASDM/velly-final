/* The composer's side of attachments: pick, paste or drop a file, watch it
 * upload, and send when it is ready.
 *
 * Uploading happens as soon as a file is chosen rather than on send, so the
 * send stays instant and a rejected file costs you the file, never the
 * words you had already typed. Each pending file is a chip that can be
 * removed; a chip that fails says why and stays until you dismiss it.
 */
import { uploadAttachment } from './api.js';

export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';
export const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createAttachmentTray(options) {
  const trayEl = options.trayEl;
  const getThreadKey = options.getThreadKey;
  const onChange = options.onChange || (() => {});
  const pending = [];

  function render() {
    trayEl.textContent = '';
    trayEl.hidden = pending.length === 0;
    pending.forEach((entry) => {
      const chip = el('div', `vos-chat-chip is-${entry.state}`);
      if (entry.previewUrl) {
        const img = document.createElement('img');
        img.className = 'vos-chat-chip-thumb';
        img.alt = '';
        img.src = entry.previewUrl;
        chip.append(img);
      } else {
        chip.append(el('span', 'vos-chat-chip-icon', 'PDF'));
      }
      const text = el('span', 'vos-chat-chip-text');
      text.append(el('span', 'vos-chat-chip-name', entry.name));
      text.append(el('span', 'vos-chat-chip-state',
        entry.state === 'uploading' ? 'Uploading…'
          : entry.state === 'failed' ? (entry.error || 'Failed') : 'Ready'));
      chip.append(text);
      const remove = el('button', 'vos-chat-chip-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${entry.name}`);
      remove.addEventListener('click', () => discard(entry));
      chip.append(remove);
      trayEl.append(chip);
    });
    onChange();
  }

  function discard(entry) {
    const index = pending.indexOf(entry);
    if (index >= 0) pending.splice(index, 1);
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    render();
  }

  async function accept(file) {
    if (!file) return;
    if (pending.length >= MAX_FILES) return;
    const entry = {
      name: file.name || 'attachment',
      state: 'uploading',
      id: null,
      error: null,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    };
    pending.push(entry);
    render();

    if (file.size > MAX_BYTES) {
      // Caught here as well as at the server, so a 10MB photo on a phone
      // fails instantly instead of after a slow upload.
      entry.state = 'failed';
      entry.error = 'Larger than 10 MB';
      render();
      return;
    }
    try {
      const attachment = await uploadAttachment(getThreadKey(), file);
      entry.id = attachment.id;
      entry.state = 'ready';
    } catch (error) {
      entry.state = 'failed';
      entry.error = error.message;
    }
    render();
  }

  function addFiles(files) {
    Array.from(files || []).slice(0, MAX_FILES).forEach(accept);
  }

  return {
    addFiles,
    /* Ids in the order they were added; null while anything is still in
     * flight, so the composer can hold the send. */
    take() {
      if (pending.some((entry) => entry.state === 'uploading')) return null;
      return pending.filter((entry) => entry.state === 'ready').map((entry) => entry.id);
    },
    get count() { return pending.length; },
    get uploading() { return pending.some((entry) => entry.state === 'uploading'); },
    get hasReady() { return pending.some((entry) => entry.state === 'ready'); },
    clear() {
      pending.splice(0).forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      render();
    },
  };
}

/* Paste and drop, wired once per panel. Both are how people actually move
 * a screenshot into a conversation; a file picker alone is a fallback. */
export function wireFileIntake(root, dropZone, onFiles, isEnabled) {
  root.addEventListener('paste', (event) => {
    if (!isEnabled()) return;
    const files = Array.from((event.clipboardData && event.clipboardData.files) || []);
    if (!files.length) return;
    event.preventDefault();
    onFiles(files);
  });

  let depth = 0;
  const setDragging = (on) => dropZone.classList.toggle('is-dragging', on);

  dropZone.addEventListener('dragenter', (event) => {
    if (!isEnabled()) return;
    event.preventDefault();
    depth += 1;
    setDragging(true);
  });
  dropZone.addEventListener('dragover', (event) => {
    if (!isEnabled()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  dropZone.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) setDragging(false);
  });
  dropZone.addEventListener('drop', (event) => {
    if (!isEnabled()) return;
    event.preventDefault();
    depth = 0;
    setDragging(false);
    const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
    if (files.length) onFiles(files);
  });
}
