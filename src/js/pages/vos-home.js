(function () {
  const rollButton = document.getElementById('vos-rumor-roll');
  const rumorText = document.getElementById('vos-rumor-text');
  if (!rollButton || !rumorText) return;
  let lastId = null;
  rollButton.addEventListener('click', async () => {
    rollButton.disabled = true;
    try {
      const url = '/api/rumors/roll' + (lastId ? `?not=${lastId}` : '');
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (!data.rumor) {
        rumorText.textContent = 'The tavern is strangely quiet tonight.';
        return;
      }
      lastId = data.rumor.id;
      rumorText.textContent = '“' + data.rumor.text + '”';
    } catch (error) {
      rumorText.textContent = 'The barkeep shrugs. (Could not reach the server.)';
    } finally {
      rollButton.disabled = false;
    }
  });
})();

(function () {
  const PAGE_SIZE = 5;

  window.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('vos-message-card');
    const list = document.getElementById('vos-messages-list');
    const empty = document.getElementById('vos-messages-empty');
    const loadMore = document.getElementById('vos-messages-load-more');
    if (!card || !list || !empty || !loadMore) return;

    let offset = 0;
    let playerName = null;

    function formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderMarkdown(value) {
      const renderer = window.VOS_RENDER_MARKDOWN || (window.VOS_PWA && window.VOS_PWA.renderSafeMarkdown);
      if (renderer) return renderer(value || '');
      return escapeHtml(value).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
    }

    function renderMessage(message) {
      const item = document.createElement('li');
      item.className = 'vos-message-item';
      item.dataset.messageId = String(message.id);

      const head = document.createElement('div');
      head.className = 'vos-message-head';
      const title = document.createElement('div');
      title.className = 'vos-message-title';
      title.textContent = message.title || 'DM Message';
      head.appendChild(title);

      // Dismiss button is only meaningful when we know who's dismissing.
      if (playerName) {
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'vos-message-dismiss';
        dismiss.textContent = '×';
        dismiss.setAttribute('aria-label', 'Dismiss');
        dismiss.addEventListener('click', () => dismissMessage(message.id, item, dismiss));
        head.appendChild(dismiss);
      }
      item.appendChild(head);

      const body = document.createElement('div');
      body.className = 'vos-message-body vos-safe-markdown';
      body.innerHTML = renderMarkdown(message.body || '');
      item.appendChild(body);

      const meta = document.createElement('div');
      meta.className = 'vos-message-meta';
      meta.textContent = formatDate(message.created_at);
      item.appendChild(meta);

      return item;
    }

    async function dismissMessage(id, item, button) {
      const pwa = window.VOS_PWA;
      const headers = pwa && pwa.authHeaders ? pwa.authHeaders() : {};
      button.disabled = true;
      try {
        const response = await fetch(`/api/messages/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        item.remove();
        // Pull in a replacement so the list stays full. If there are no
        // more messages and the list is empty, show the empty state.
        const fetched = await loadPage(offset > 0 ? offset - 1 : offset, 1);
        if (fetched && fetched.length) {
          list.appendChild(renderMessage(fetched[0]));
        }
        if (!list.children.length) {
          empty.hidden = false;
          loadMore.hidden = true;
        }
        try {
          window.dispatchEvent(new CustomEvent('vos:avatar-badge-refresh'));
        } catch (error) {}
      } catch (error) {
        button.disabled = false;
      }
    }

    // Fetch one page of messages without touching the DOM. Returns the
    // raw array (or empty on failure).
    async function loadPage(startOffset, limit) {
      const pwa = window.VOS_PWA;
      const headers = pwa && pwa.authHeaders ? pwa.authHeaders() : {};
      const params = new URLSearchParams({ limit: String(limit), offset: String(startOffset) });
      if (playerName) params.set('name', playerName);
      try {
        const response = await fetch(`/api/messages?${params.toString()}`, {
          cache: 'no-store',
          headers,
        });
        if (!response.ok) return [];
        const data = await response.json().catch(() => null);
        return (data && data.messages) || [];
      } catch (error) {
        return [];
      }
    }

    async function loadAndAppend() {
      const messages = await loadPage(offset, PAGE_SIZE);
      messages.forEach((message) => list.appendChild(renderMessage(message)));
      offset += messages.length;

      // If we got a full page back, there may be more — show the button.
      // If we got less, we've reached the end.
      loadMore.hidden = messages.length < PAGE_SIZE;

      const hasAny = list.children.length > 0;
      card.hidden = false;
      empty.hidden = hasAny;
      if (!hasAny) loadMore.hidden = true;

      // Mark the newest message as seen so the avatar badge resolves.
      if (hasAny) {
        const firstId = list.children[0].dataset.messageId;
        if (firstId) {
          try {
            localStorage.setItem('vos.dmMessage.seenId', firstId);
            window.dispatchEvent(new CustomEvent('vos:avatar-badge-refresh'));
          } catch (error) {}
        }
      }
    }

    loadMore.addEventListener('click', () => {
      loadMore.disabled = true;
      loadAndAppend().finally(() => {
        loadMore.disabled = false;
      });
    });

    (async () => {
      const pwa = window.VOS_PWA;
      playerName = pwa && pwa.ensureIdentity
        ? await pwa.ensureIdentity().catch(() => null)
        : null;
      await loadAndAppend();
    })();
  });
})();
