---
title: DM
description: DM tools for Vallombrosa.
permalink: /dm/
---

<style>
.vos-dm {
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}
.vos-dm-panel {
  border: 1px solid rgba(201,161,74,0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(18,16,23,0.94), rgba(8,7,11,0.98)),
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,161,74,0.06), transparent 70%);
  box-shadow: 0 16px 42px rgba(0,0,0,0.55);
  padding: clamp(1.2rem, 3vw, 1.8rem);
}
.vos-dm-form {
  display: grid;
  gap: 0.85rem;
}
.vos-dm-form label {
  display: grid;
  gap: 0.35rem;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-form input,
.vos-dm-form textarea {
  width: 100%;
  border: 1px solid rgba(201,168,76,0.25);
  border-radius: 6px;
  background: rgba(7,6,10,0.72);
  color: var(--vos-cream);
  font: 1rem 'EB Garamond', Georgia, serif;
  line-height: 1.4;
  padding: 0.65rem 0.75rem;
}
.vos-dm-form textarea {
  min-height: 110px;
  resize: vertical;
}
.vos-dm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}
.vos-dm-actions button {
  min-height: 44px;
  padding: 0.55rem 1rem;
  border: 1px solid rgba(212,165,116,0.44);
  border-radius: 6px;
  background: rgba(212,165,116,0.1);
  color: var(--vos-gold-bright);
  cursor: pointer;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-dm-actions button:hover {
  background: rgba(212,165,116,0.16);
  color: var(--vos-cream);
}
.vos-dm-status {
  min-height: 1.4em;
  margin-top: 0.85rem;
  color: var(--vos-text);
}
.vos-dm-status.is-error {
  color: var(--vos-quest-bright);
}
.vos-dm-counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin: 0.85rem 0 1rem;
}
.vos-dm-count {
  border: 1px solid rgba(201,168,76,0.22);
  border-radius: 6px;
  background: rgba(7,6,10,0.5);
  padding: 0.75rem;
  text-align: center;
}
.vos-dm-count strong {
  display: block;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 1.35rem;
}
.vos-dm-count span {
  color: rgba(233,225,208,0.72);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-dm-rsvps {
  list-style: none;
  margin: 0;
  padding: 0;
}
.vos-dm-rsvps li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0;
  border-top: 1px solid rgba(139,115,85,0.24);
}
.vos-dm-rsvps span {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
@media (max-width: 560px) {
  .vos-dm-counts { grid-template-columns: 1fr; }
  .vos-dm-actions { justify-content: stretch; }
  .vos-dm-actions button { width: 100%; }
}
</style>

<div class="vos-dm">
  <h1>DM</h1>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-token-title">
    <h2 id="vos-dm-token-title">Admin Token</h2>
    <div class="vos-dm-form">
      <label>
        Admin Token
        <input id="vos-dm-token" type="password" autocomplete="current-password">
      </label>
    </div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-message-title">
    <h2 id="vos-dm-message-title">DM Message</h2>
    <form class="vos-dm-form" id="vos-dm-message-form">
      <label>
        Title
        <input id="vos-dm-message-heading" type="text" value="Message from the DM">
      </label>
      <label>
        Message
        <textarea id="vos-dm-message-body"></textarea>
      </label>
      <label>
        URL
        <input id="vos-dm-message-url" type="text" value="/">
      </label>
      <div class="vos-dm-actions">
        <button id="vos-dm-message-send" type="submit">Post and Notify</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-message-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-rsvp-title" data-event-id="{{ campaign.nextGathering.eventId }}">
    <h2 id="vos-dm-rsvp-title">RSVP Summary</h2>
    <div class="vos-dm-counts" aria-label="RSVP counts">
      <div class="vos-dm-count"><strong id="vos-rsvp-going">0</strong><span>Going</span></div>
      <div class="vos-dm-count"><strong id="vos-rsvp-maybe">0</strong><span>Maybe</span></div>
      <div class="vos-dm-count"><strong id="vos-rsvp-out">0</strong><span>Out</span></div>
    </div>
    <ul class="vos-dm-rsvps" id="vos-dm-rsvps"></ul>
    <div class="vos-dm-actions">
      <button id="vos-dm-rsvp-refresh" type="button">Refresh RSVPs</button>
    </div>
    <div class="vos-dm-status" id="vos-dm-rsvp-status" role="status" aria-live="polite"></div>
  </section>

  <section class="vos-dm-panel" aria-labelledby="vos-dm-push-title">
    <h2 id="vos-dm-push-title">Test Push</h2>
    <form class="vos-dm-form" id="vos-dm-push-form">
      <label>
        Title
        <input id="vos-dm-title" type="text" value="Vallombrosa">
      </label>
      <label>
        Message
        <textarea id="vos-dm-body">Test push from the DM page.</textarea>
      </label>
      <label>
        URL
        <input id="vos-dm-url" type="text" value="/">
      </label>
      <div class="vos-dm-actions">
        <button id="vos-dm-send" type="submit">Send Test Push</button>
      </div>
    </form>
    <div class="vos-dm-status" id="vos-dm-status" role="status" aria-live="polite"></div>
  </section>
</div>

<script>
(function () {
  const TOKEN_KEY = 'vos.adminToken';
  const tokenEl = document.getElementById('vos-dm-token');
  const messageForm = document.getElementById('vos-dm-message-form');
  const messageTitleEl = document.getElementById('vos-dm-message-heading');
  const messageBodyEl = document.getElementById('vos-dm-message-body');
  const messageUrlEl = document.getElementById('vos-dm-message-url');
  const messageStatusEl = document.getElementById('vos-dm-message-status');
  const messageSendEl = document.getElementById('vos-dm-message-send');
  const rsvpPanel = document.querySelector('[data-event-id]');
  const rsvpRefreshEl = document.getElementById('vos-dm-rsvp-refresh');
  const rsvpStatusEl = document.getElementById('vos-dm-rsvp-status');
  const rsvpListEl = document.getElementById('vos-dm-rsvps');
  const rsvpGoingEl = document.getElementById('vos-rsvp-going');
  const rsvpMaybeEl = document.getElementById('vos-rsvp-maybe');
  const rsvpOutEl = document.getElementById('vos-rsvp-out');
  const form = document.getElementById('vos-dm-push-form');
  const titleEl = document.getElementById('vos-dm-title');
  const bodyEl = document.getElementById('vos-dm-body');
  const urlEl = document.getElementById('vos-dm-url');
  const statusEl = document.getElementById('vos-dm-status');
  const sendEl = document.getElementById('vos-dm-send');

  try {
    tokenEl.value = localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {}

  tokenEl.addEventListener('change', () => {
    try { localStorage.setItem(TOKEN_KEY, tokenEl.value.trim()); } catch (error) {}
  });

  function getToken(statusTarget) {
    const token = tokenEl.value.trim();
    if (!token) {
      setStatus(statusTarget, 'Enter the admin token.', true);
      tokenEl.focus();
      return null;
    }
    try { localStorage.setItem(TOKEN_KEY, token); } catch (error) {}
    return token;
  }

  function setStatus(target, text, isError) {
    target.textContent = text || '';
    target.classList.toggle('is-error', !!isError);
  }

  async function postJson(url, token, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = getToken(messageStatusEl);
    if (!token) return;

    messageSendEl.disabled = true;
    setStatus(messageStatusEl, 'Posting...');

    try {
      const data = await postJson('/api/messages', token, {
        title: messageTitleEl.value.trim(),
        body: messageBodyEl.value.trim(),
        url: messageUrlEl.value.trim() || '/',
      });
      const push = data.push || {};
      setStatus(messageStatusEl, `Posted. Push sent ${push.sent || 0} of ${push.attempted || 0}.`);
      messageBodyEl.value = '';
    } catch (error) {
      setStatus(messageStatusEl, error.message, true);
    } finally {
      messageSendEl.disabled = false;
    }
  });

  async function refreshRsvps() {
    const token = getToken(rsvpStatusEl);
    if (!token) return;
    const eventId = rsvpPanel.getAttribute('data-event-id');
    if (!eventId) {
      setStatus(rsvpStatusEl, 'No event id is set for the next gathering.', true);
      return;
    }

    rsvpRefreshEl.disabled = true;
    setStatus(rsvpStatusEl, 'Loading...');

    try {
      const response = await fetch(`/api/rsvp?eventId=${encodeURIComponent(eventId)}`, {
        headers: { 'X-Admin-Token': token },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const counts = data.counts || {};
      rsvpGoingEl.textContent = counts.going || 0;
      rsvpMaybeEl.textContent = counts.maybe || 0;
      rsvpOutEl.textContent = counts.out || 0;

      rsvpListEl.innerHTML = '';
      (data.responses || []).forEach((item) => {
        const li = document.createElement('li');
        const name = document.createElement('strong');
        const status = document.createElement('span');
        name.textContent = item.player_name;
        status.textContent = item.status;
        li.append(name, status);
        rsvpListEl.appendChild(li);
      });
      if (!rsvpListEl.children.length) {
        const li = document.createElement('li');
        li.textContent = 'No RSVPs yet.';
        rsvpListEl.appendChild(li);
      }
      setStatus(rsvpStatusEl, 'Updated.');
    } catch (error) {
      setStatus(rsvpStatusEl, error.message, true);
    } finally {
      rsvpRefreshEl.disabled = false;
    }
  }

  rsvpRefreshEl.addEventListener('click', refreshRsvps);
  if (tokenEl.value.trim()) refreshRsvps();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = getToken(statusEl);
    if (!token) return;

    sendEl.disabled = true;
    setStatus(statusEl, 'Sending...');

    try {
      const data = await postJson('/api/push/send', token, {
        title: titleEl.value.trim(),
        body: bodyEl.value.trim(),
        url: urlEl.value.trim() || '/',
      });
      setStatus(statusEl, `Sent ${data.sent} of ${data.attempted}. Pruned ${data.pruned}.`);
    } catch (error) {
      setStatus(statusEl, error.message, true);
    } finally {
      sendEl.disabled = false;
    }
  });
})();
</script>
