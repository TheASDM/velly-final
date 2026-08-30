/* A styled confirm sheet in place of window.confirm.
 *
 * Same contract — await confirmSheet(message) resolves true/false — but it
 * matches the console's look, labels the confirming action, and can carry
 * danger styling so "Delete" never looks like "OK". */

let dialog = null;
let messageEl = null;
let confirmEl = null;
let cancelEl = null;
let resolveOpen = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'vos-dm-confirm';
  messageEl = document.createElement('p');
  messageEl.className = 'vos-dm-confirm-message';
  const actions = document.createElement('div');
  actions.className = 'vos-dm-actions';
  cancelEl = document.createElement('button');
  cancelEl.type = 'button';
  cancelEl.className = 'vos-dm-button';
  cancelEl.textContent = 'Cancel';
  confirmEl = document.createElement('button');
  confirmEl.type = 'button';
  confirmEl.className = 'vos-dm-button';
  actions.append(cancelEl, confirmEl);
  dialog.append(messageEl, actions);
  document.body.appendChild(dialog);

  cancelEl.addEventListener('click', () => dialog.close('cancel'));
  confirmEl.addEventListener('click', () => dialog.close('confirm'));
  dialog.addEventListener('close', () => {
    if (resolveOpen) {
      resolveOpen(dialog.returnValue === 'confirm');
      resolveOpen = null;
    }
  });
  return dialog;
}

export function confirmSheet(message, { confirmLabel = 'Confirm', danger = false } = {}) {
  // No <dialog> support (or no DOM yet): fall back to the native confirm
  // rather than silently approving.
  if (typeof document === 'undefined' || !window.HTMLDialogElement) {
    return Promise.resolve(window.confirm(message));
  }
  ensureDialog();
  messageEl.textContent = message;
  confirmEl.textContent = confirmLabel;
  confirmEl.classList.toggle('is-danger', !!danger);
  return new Promise((resolve) => {
    resolveOpen = resolve;
    dialog.showModal();
    cancelEl.focus();
  });
}
