/* One message, drawn.
 *
 * A bubble carries more than words now: the message it answers, the faces
 * people put on it, whether it was edited, and the actions you can take on
 * it. The action bar opens *inside* the bubble and wraps — a floating
 * popover over a full-screen sheet is a fight with the software keyboard,
 * and a row of controls must never scroll sideways.
 */

export const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pill(label, className, onClick) {
  const button = el('button', className, label);
  button.type = 'button';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function quoteRow(quoted, ctx) {
  const row = el('button', 'vos-chat-quote');
  row.type = 'button';
  if (!quoted) {
    row.classList.add('is-missing');
    row.append(el('span', 'vos-chat-quote-text', 'Message removed'));
    row.disabled = true;
    return row;
  }
  row.append(el('span', 'vos-chat-quote-who', ctx.displayName(quoted.sender)));
  row.append(el('span', 'vos-chat-quote-text',
    quoted.deleted ? 'Message removed' : quoted.body));
  row.addEventListener('click', (event) => {
    event.stopPropagation();
    ctx.onJump(quoted.id);
  });
  return row;
}

function humanBytes(value) {
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/* Images inline, opening in the deep-zoom viewer the wiki's maps use;
 * PDFs as a row you download, because handing a PDF to the page to render
 * is a bigger surface than a conversation needs. */
function docRow(file) {
  const link = el('a', 'vos-chat-file-doc');
  link.href = file.url;
  link.rel = 'noopener';
  const label = file.kind === 'image' ? 'IMG' : 'PDF';
  link.append(el('span', 'vos-chat-file-icon', label));
  const text = el('span', 'vos-chat-file-text');
  text.append(el('span', 'vos-chat-file-name', file.filename || 'attachment'));
  text.append(el('span', 'vos-chat-file-size', humanBytes(file.bytes)));
  link.append(text);
  link.addEventListener('click', (event) => event.stopPropagation());
  return link;
}

function attachmentsRow(message, ctx) {
  const files = message.attachments || [];
  if (!files.length) return null;
  const row = el('div', 'vos-chat-files');
  const images = files.filter((file) => file.kind === 'image');
  row.classList.toggle('is-grid', images.length > 1);
  files.forEach((file) => {
    if (file.kind === 'image') {
      const figure = el('button', 'vos-chat-file-image');
      figure.type = 'button';
      figure.setAttribute('aria-label', `Open ${file.filename}`);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = file.filename || '';
      img.src = images.length > 1 && file.thumbUrl ? file.thumbUrl : file.url;
      if (file.width && file.height) {
        img.width = file.width;
        img.height = file.height;
      }
      // A thumb that will not load falls back to the full image, and an
      // image that will not load at all becomes a plain row rather than a
      // broken-picture icon.
      let triedFull = false;
      img.addEventListener('error', () => {
        if (!triedFull && img.src !== file.url) {
          triedFull = true;
          img.src = file.url;
          return;
        }
        figure.replaceWith(docRow(file));
      });
      figure.append(img);
      figure.addEventListener('click', (event) => {
        event.stopPropagation();
        ctx.onOpenImage(file);
      });
      row.append(figure);
      return;
    }
    row.append(docRow(file));
  });
  return row;
}

function reactionsRow(message, ctx) {
  const faces = ctx.getReactions(message.id);
  if (!faces.length) return null;
  const row = el('div', 'vos-chat-reactions');
  faces.forEach((face) => {
    const button = pill('', `vos-chat-reaction${face.mine ? ' is-mine' : ''}`,
      () => ctx.onReact(message, face.emoji, !face.mine));
    button.append(el('span', 'vos-chat-reaction-face', face.emoji));
    button.append(el('span', 'vos-chat-reaction-count', String(face.players.length)));
    button.title = face.players.map(ctx.displayName).join(', ');
    row.append(button);
  });
  return row;
}

function actionsRow(message, ctx, close) {
  const row = el('div', 'vos-chat-actions');
  const faces = ctx.getReactions(message.id);
  REACTION_EMOJI.forEach((emoji) => {
    const mine = faces.some((face) => face.emoji === emoji && face.mine);
    const button = pill(emoji, `vos-chat-action-emoji${mine ? ' is-mine' : ''}`, () => {
      ctx.onReact(message, emoji, !mine);
      close();
    });
    button.setAttribute('aria-label', `React ${emoji}`);
    button.setAttribute('aria-pressed', mine ? 'true' : 'false');
    row.append(button);
  });
  row.append(pill('Reply', 'vos-chat-action', () => { ctx.onReply(message); close(); }));
  if (message.body && ctx.canEdit(message)) {
    row.append(pill('Edit', 'vos-chat-action', () => { ctx.onEdit(message); close(); }));
  }
  if (message.sender === ctx.playerName) {
    row.append(pill('Delete', 'vos-chat-action is-danger',
      () => { ctx.onDelete(message); close(); }));
  }
  return row;
}

export function renderBubble(message, ctx) {
  const bubble = el('div', 'vos-chat-bubble');
  bubble.dataset.id = String(message.id);
  const mine = message.sender === ctx.playerName;
  bubble.classList.toggle('is-mine', mine);

  if (message.deleted) {
    bubble.classList.add('is-deleted');
    bubble.textContent = 'Message removed';
    return bubble;
  }

  if (message.replyToId) {
    bubble.append(quoteRow(ctx.getMessage(message.replyToId), ctx));
  }
  if (ctx.showSenders() && !mine) {
    const who = el('a', 'vos-chat-bubble-sender', ctx.displayName(message.sender));
    who.href = ctx.profileHref(message.sender);
    who.addEventListener('click', (event) => event.stopPropagation());
    bubble.append(who);
  }
  if (message.body) {
    const body = el('div', 'vos-chat-bubble-body vos-safe-markdown');
    body.innerHTML = ctx.renderMarkdown(message.body);
    bubble.append(body);
  }

  const files = attachmentsRow(message, ctx);
  if (files) bubble.append(files);

  const meta = el('div', 'vos-chat-bubble-meta', ctx.formatDate(message.created_at));
  if (message.editedAt) {
    // Marked, not hidden: an edited message says so for everyone.
    meta.append(el('span', 'vos-chat-edited', ' · edited'));
  }
  bubble.append(meta);

  const reactions = reactionsRow(message, ctx);
  if (reactions) bubble.append(reactions);

  // The trigger: a hover affordance on a pointer, always faintly there on
  // a finger, and a long-press anywhere on the bubble does the same.
  let actions = null;
  const closeActions = () => {
    if (actions) { actions.remove(); actions = null; }
    bubble.classList.remove('has-actions');
  };
  const toggleActions = () => {
    if (actions) return closeActions();
    ctx.closeOtherActions(bubble);
    actions = actionsRow(message, ctx, closeActions);
    bubble.append(actions);
    bubble.classList.add('has-actions');
  };
  bubble.vosCloseActions = closeActions;

  const trigger = el('button', 'vos-chat-bubble-menu', '⋯');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Message actions');
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleActions();
  });
  bubble.append(trigger);

  let pressTimer = null;
  const cancelPress = () => {
    if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = null; }
  };
  bubble.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    cancelPress();
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      toggleActions();
    }, 420);
  });
  ['pointerup', 'pointercancel', 'pointermove', 'pointerleave']
    .forEach((name) => bubble.addEventListener(name, cancelPress));

  return bubble;
}
