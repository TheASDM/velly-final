---
title: Messages
description: DM messages for the signed-in player.
permalink: /messages/
published: false
autoIndex: false
---

<section class="vos-compact-panel" aria-labelledby="vos-messages-page-title">
  <div class="vos-panel-head">
    <h2 class="vos-panel-title" id="vos-messages-page-title">Messages</h2>
    <button class="vos-button" id="vos-messages-page-refresh" type="button">Refresh</button>
  </div>
  <div class="vos-row-chip-list" id="vos-messages-page-list"></div>
  <div class="vos-settings-status" id="vos-messages-page-status" role="status" aria-live="polite">Loading...</div>
</section>

<script>
(function () {
  const listEl = document.getElementById('vos-messages-page-list');
  const statusEl = document.getElementById('vos-messages-page-status');
  const refreshEl = document.getElementById('vos-messages-page-refresh');

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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

  function render(messages) {
    listEl.innerHTML = '';
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'vos-submit-empty';
      empty.textContent = 'No messages right now.';
      listEl.appendChild(empty);
      return;
    }
    messages.forEach((message) => {
      const row = document.createElement('article');
      row.className = 'vos-row-chip';
      if (message.url) {
        row.classList.add('is-clickable');
        row.setAttribute('role', 'link');
        row.tabIndex = 0;
        row.addEventListener('click', (event) => {
          if (event.target.closest('a, button')) return;
          window.location.href = message.url;
        });
        row.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          window.location.href = message.url;
        });
      }
      row.innerHTML = `
        <div class="vos-row-chip-copy">
          <span class="vos-row-chip-title"></span>
          <div class="vos-row-chip-meta vos-safe-markdown"></div>
        </div>
        <span class="vos-row-chip-badge" aria-hidden="true"></span>
      `;
      row.querySelector('.vos-row-chip-title').textContent = message.title || 'DM Message';
      row.querySelector('.vos-row-chip-meta').innerHTML = renderMarkdown(message.body || '');
      row.querySelector('.vos-row-chip-badge').textContent = formatDate(message.created_at);
      listEl.appendChild(row);
    });
  }

  async function loadMessages() {
    const pwa = window.VOS_PWA;
    const name = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity().catch(() => null) : null;
    if (!name) {
      setStatus('Sign in to see your messages.', true);
      return;
    }
    refreshEl.disabled = true;
    setStatus('Loading...');
    try {
      const params = new URLSearchParams({ limit: '20', name });
      const headers = pwa && pwa.authHeaders ? pwa.authHeaders() : {};
      const response = await fetch(`/api/messages?${params.toString()}`, { cache: 'no-store', headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      render(Array.isArray(data.messages) ? data.messages : []);
      setStatus('Updated.');
    } catch (error) {
      setStatus(error.message || 'Could not load messages.', true);
    } finally {
      refreshEl.disabled = false;
    }
  }

  refreshEl.addEventListener('click', loadMessages);
  window.addEventListener('DOMContentLoaded', loadMessages);
})();
</script>
