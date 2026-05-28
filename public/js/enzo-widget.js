// Enzo floating chat widget loader.
//
// Production (any non-localhost host): wires the real chatbot.js and its
// stylesheet. API calls stay same-origin via /api/chat.
//
// Local preview (localhost / 127.0.0.1): renders a visual-only stub that
// mirrors the production widget's DOM. The stub doesn't call /api/chat;
// it's there so design changes can be screenshotted without booting the
// chatbot backend. Reads/writes the same `loreMasterOpen` localStorage
// key as the real script so pill/expanded state persists locally.
(function () {
  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const isEnzoPage = location.pathname.replace(/\/$/, '') === '/enzo';

  // Always include the chatbot stylesheet — local stub uses it too.
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/css/chatbot.css';
  document.head.appendChild(css);

  if (!isLocal) {
    window.LOREMASTER_API_URL = location.origin + '/api/chat';
    if (isEnzoPage) {
      try { localStorage.setItem('loreMasterOpen', 'true'); } catch (e) {}
    }
    const js = document.createElement('script');
    js.src = '/js/chatbot.js';
    js.defer = true;
    document.body.appendChild(js);
    return;
  }

  function readPref() {
    try { return JSON.parse(localStorage.getItem('loreMasterOpen')); } catch (e) { return null; }
  }
  function writePref(v) {
    try { localStorage.setItem('loreMasterOpen', JSON.stringify(v)); } catch (e) {}
  }

  const startOpen = isEnzoPage || readPref() === true;
  const c = document.getElementById('chatbot-container');
  if (!c) return;
  c.innerHTML = `
    <div id="chatbot-widget" class="${startOpen ? '' : 'chatbot-collapsed'}">
      <div class="chatbot-header" id="vos-stub-header">
        <img src="/images/maskicon2.png" alt="" class="chatbot-avatar-header">
        <span>Enzo</span>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="chatbot-body">
        <div id="chat-messages">
          <div id="chat-empty-state" class="chat-empty-state">
            <div class="chat-empty-title">Ask Enzo</div>
            <div class="chat-empty-chips" aria-label="Suggested prompts">
              <span>Who is…</span>
              <span>Where is…</span>
              <span>Rules question…</span>
            </div>
          </div>
        </div>
        <div class="chat-mode-controls" aria-label="Enzo response mode">
          <button class="chat-mode-button is-active" type="button" data-chat-mode="lore" aria-pressed="true">Lore</button>
          <button class="chat-mode-button" type="button" data-chat-mode="rules" aria-pressed="false">Rules</button>
          <button class="chat-mode-button" type="button" data-chat-mode="brainstorm" aria-pressed="false">Brainstorm</button>
        </div>
        <div class="chat-input-area">
          <textarea id="chat-input" placeholder="Ask about NPCs, lore, locations…" rows="1"></textarea>
          <button id="chat-send-btn" type="button" aria-label="Send message" title="Send">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  const widget = document.getElementById('chatbot-widget');
  const header = document.getElementById('vos-stub-header');
  header.addEventListener('click', () => {
    const open = widget.classList.toggle('chatbot-collapsed');
    writePref(!open); // class on = collapsed, so flip for "open"
  });
  c.querySelectorAll('[data-chat-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      c.querySelectorAll('[data-chat-mode]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const input = document.getElementById('chat-input');
      if (input) input.focus();
    });
  });
})();

// Compatibility for any stale chatbot bundle that still renders a single-line
// input: swap it for the compact growing textarea used by the native app UI.
(function () {
  function enhance(ta) {
    const grow = () => {
      ta.style.height = 'auto';
      const max = parseFloat(getComputedStyle(ta).lineHeight || '20') * 4 + 22;
      ta.style.height = `${Math.min(ta.scrollHeight, max)}px`;
    };
    ta.addEventListener('input', grow);
    grow();
  }
  function swap() {
    const old = document.getElementById('chat-input');
    if (!old) return false;
    if (old.tagName === 'TEXTAREA') {
      enhance(old);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.id = 'chat-input';
    ta.placeholder = old.placeholder || '';
    ta.setAttribute('autocomplete', 'off');
    ta.rows = 1;
    old.parentNode.replaceChild(ta, old);
    enhance(ta);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const btn = document.getElementById('chat-send-btn');
        if (btn) btn.click();
      }
    });
    return true;
  }
  const t = setInterval(() => { if (swap()) clearInterval(t); }, 100);
  setTimeout(() => clearInterval(t), 10000);
})();
