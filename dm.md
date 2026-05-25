---
title: DM
description: DM tools for Vallombrosa.
permalink: /dm/
---

<style>
.vos-dm {
  max-width: 760px;
  margin: 0 auto;
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
</style>

<div class="vos-dm">
  <h1>DM</h1>
  <section class="vos-dm-panel" aria-labelledby="vos-dm-push-title">
    <h2 id="vos-dm-push-title">Test Push</h2>
    <form class="vos-dm-form" id="vos-dm-push-form">
      <label>
        Admin Token
        <input id="vos-dm-token" type="password" autocomplete="current-password">
      </label>
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
  const form = document.getElementById('vos-dm-push-form');
  const tokenEl = document.getElementById('vos-dm-token');
  const titleEl = document.getElementById('vos-dm-title');
  const bodyEl = document.getElementById('vos-dm-body');
  const urlEl = document.getElementById('vos-dm-url');
  const statusEl = document.getElementById('vos-dm-status');
  const sendEl = document.getElementById('vos-dm-send');

  try {
    tokenEl.value = localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {}

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = tokenEl.value.trim();
    if (!token) {
      setStatus('Enter the admin token.', true);
      tokenEl.focus();
      return;
    }

    try { localStorage.setItem(TOKEN_KEY, token); } catch (error) {}

    sendEl.disabled = true;
    setStatus('Sending...');

    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token,
        },
        body: JSON.stringify({
          title: titleEl.value.trim(),
          body: bodyEl.value.trim(),
          url: urlEl.value.trim() || '/',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setStatus(`Sent ${data.sent} of ${data.attempted}. Pruned ${data.pruned}.`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      sendEl.disabled = false;
    }
  });
})();
</script>
