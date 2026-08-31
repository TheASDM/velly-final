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
    const viewAll = document.getElementById('vos-messages-view-all');
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
        syncEmptyState();
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
      syncEmptyState();

      const hasAny = list.children.length > 0;

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

    /* An empty card collapses to a line rather than holding a card's worth of
       nothing, and "Show older" never offers a page that does not exist. */
    function syncEmptyState() {
      const hasAny = list.children.length > 0;
      card.hidden = false;
      card.classList.toggle('is-empty', !hasAny);
      empty.hidden = hasAny;
      if (!hasAny) loadMore.hidden = true;
      if (viewAll) viewAll.hidden = list.children.length < 2;
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

/* ── Home by role ─────────────────────────────────────────────────────
 *
 * The same page answers two different questions. A player asks "what is
 * happening, and what needs me"; the DM asks "what is the state of the
 * campaign I am running". Same cards would be the wrong answer to one of
 * them, so both sets ship and one is revealed.
 *
 * Order is CSS `order` on a flow that already lays cards out, rather than
 * moving nodes — reordering the DOM would move focus out from under anyone
 * using a keyboard while the roster call was still in flight.
 */
(function () {
  const root = document.getElementById('vos-home');
  if (!root) return;

  const ORDER = {
    player: ['next', 'todo', 'announcements', 'updates', 'contribute', 'studio',
             'inplay', 'story', 'rumor'],
    dm: ['next', 'prep', 'review', 'attendance', 'activity', 'announcements',
         'updates', 'inplay', 'story'],
  };

  function whenPwa(timeout) {
    return new Promise((resolve) => {
      if (window.VOS_PWA) return resolve(window.VOS_PWA);
      const until = Date.now() + (timeout || 4000);
      const timer = setInterval(() => {
        if (window.VOS_PWA) { clearInterval(timer); resolve(window.VOS_PWA); }
        else if (Date.now() > until) { clearInterval(timer); resolve(null); }
      }, 50);
    });
  }

  function authHeaders() {
    const pwa = window.VOS_PWA;
    return pwa && pwa.authHeaders ? pwa.authHeaders() : {};
  }

  async function json(url) {
    try {
      const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) { return null; }
  }

  function row(text, meta, href) {
    const li = document.createElement('li');
    li.className = 'vos-task-row';
    const main = document.createElement(href ? 'a' : 'span');
    main.className = 'vos-task-main';
    main.textContent = text;
    if (href) main.href = href;
    li.appendChild(main);
    if (meta) {
      const span = document.createElement('span');
      span.className = 'vos-task-date';
      span.textContent = meta;
      li.appendChild(span);
    }
    return li;
  }

  /* One shape for every list card: fill it, or say plainly that there is
     nothing — never leave a card-sized hole where content would be. */
  function fill(listId, emptyId, items) {
    const list = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    if (!list || !empty) return;
    list.innerHTML = '';
    items.forEach((item) => list.appendChild(item));
    list.hidden = !items.length;
    empty.hidden = !!items.length;
    const card = list.closest('[data-home-card]');
    if (card) card.classList.toggle('is-empty', !items.length);
  }

  function applyRole(role) {
    root.dataset.homeRole = role;
    const order = ORDER[role] || ORDER.player;
    root.querySelectorAll('[data-home-card]').forEach((card) => {
      const only = card.dataset.homeRoleOnly;
      const at = order.indexOf(card.dataset.homeCard);
      const shown = at !== -1 && (!only || only === role);
      card.hidden = !shown;
      if (shown) card.style.order = String(at);
    });
  }

  /* The gathering's task list is the DM's actual ask of the table, and it
   * already arrives with the next session — no second request for it.
   *
   * Registered at load rather than after the roster resolves: the event fires
   * on DOMContentLoaded and a listener attached from a poll would miss it. */
  window.addEventListener('vos:next-gathering', (event) => {
    const gathering = (event.detail && event.detail.gathering) || null;
    // Nothing scheduled is one sentence, not a card-shaped hole.
    const nextCard = root.querySelector('[data-home-card="next"]');
    if (nextCard) nextCard.classList.toggle('is-empty', !gathering);
    const tasks = (gathering && gathering.tasks) || [];
    fill('vos-todo-list', 'vos-todo-empty', tasks.map((task) => row(
      task.text,
      task.due
        ? 'Due ' + new Date(task.due + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '',
    )));
  });

  /* ── Player: what is waiting on you ─────────────────────────────── */
  function initPlayerCards() {
    json('/api/gallery?scope=shared&limit=8').then((data) => {
      const rail = document.getElementById('vos-home-studio-rail');
      const empty = document.getElementById('vos-home-studio-empty');
      if (!rail || !empty) return;
      const entries = (data && data.entries) || [];
      rail.innerHTML = '';
      entries.slice(0, 8).forEach((entry) => {
        const link = document.createElement('a');
        link.className = 'vos-home-studio-piece';
        link.href = `/studio/?tab=view&gallery=shared&image=${encodeURIComponent(entry.id)}`;
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = entry.title || entry.prompt || 'Studio piece';
        img.src = entry.image_url || '';
        link.appendChild(img);
        rail.appendChild(link);
      });
      rail.hidden = !entries.length;
      empty.hidden = !!entries.length;
    });
  }

  /* ── DM: the state of the campaign ──────────────────────────────── */
  async function initDmCards() {
    const data = await json('/api/admin/dashboard');
    if (!data) return;

    const rsvpMissing = (data.rsvp && data.rsvp.missing) || [];
    const availMissing = (data.availability && data.availability.missing) || [];
    const pendingLore = (data.lore && data.lore.pending) || 0;
    const pushMissing = (data.push && data.push.missing) || [];

    const prep = [];
    if (!data.gathering) prep.push(row('No session on the books', 'Schedule one', '/dm/?view=schedule'));
    if (rsvpMissing.length) prep.push(row(`${rsvpMissing.length} still to RSVP`, rsvpMissing.join(', '), '/dm/?view=rsvps'));
    if (availMissing.length) prep.push(row(`${availMissing.length} owe availability`, availMissing.join(', '), '/dm/?view=availability'));
    if (pushMissing.length) prep.push(row(`${pushMissing.length} without notifications on`, pushMissing.join(', ')));
    fill('vos-prep-list', 'vos-prep-empty', prep);

    const review = [];
    if (pendingLore) review.push(row(`${pendingLore} lore submission${pendingLore === 1 ? '' : 's'}`, 'Waiting on you', '/dm/?view=lore'));
    fill('vos-review-list', 'vos-review-empty', review);

    const figures = document.getElementById('vos-attendance-figures');
    const attendanceEmpty = document.getElementById('vos-attendance-empty');
    if (figures && attendanceEmpty) {
      const counts = (data.rsvp && data.rsvp.counts) || null;
      figures.innerHTML = '';
      if (counts) {
        [['Going', counts.going || 0], ['Maybe', counts.maybe || 0], ['Out', counts.out || 0],
         ['No reply', rsvpMissing.length]].forEach(([label, value]) => {
          const cell = document.createElement('div');
          cell.className = 'vos-dash-figure';
          const strong = document.createElement('strong');
          strong.textContent = String(value);
          const span = document.createElement('span');
          span.textContent = label;
          cell.append(strong, span);
          figures.appendChild(cell);
        });
      }
      figures.hidden = !counts;
      attendanceEmpty.hidden = !!counts;
    }

    const activity = [];
    const unread = (data.im && data.im.unread) || 0;
    if (unread) activity.push(row(`${unread} unread message${unread === 1 ? '' : 's'}`, 'In your threads', '/messages/'));
    const responses = (data.rsvp && data.rsvp.responses) || [];
    responses.slice(0, 5).forEach((entry) => {
      activity.push(row(entry.player_name, `RSVP: ${entry.status || entry.response || '—'}`));
    });
    fill('vos-activity-list', 'vos-activity-empty', activity);
  }

  whenPwa().then((pwa) => {
    const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
    const isDm = !!(name === 'DM' || (pwa && pwa.isDm && pwa.isDm()));
    applyRole(isDm ? 'dm' : 'player');
    if (isDm) initDmCards();
    else initPlayerCards();
  });

  // A sign-in or a switch changes which question the page is answering.
  window.addEventListener('vos:identity', () => {
    const pwa = window.VOS_PWA;
    const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
    const isDm = !!(name === 'DM' || (pwa && pwa.isDm && pwa.isDm()));
    applyRole(isDm ? 'dm' : 'player');
  });
})();
