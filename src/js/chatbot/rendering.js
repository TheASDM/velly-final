import { renderMarkdown } from './format.js';

export const renderingMethods = {
  getIconName() {
        const yq = this.vibe === 'yasqueen';
        const fab = this.vibe === 'fabio';
        const rocky = this.vibe === 'rocky';
        const r = this.rules;
        if (yq)       return 'loremasterYasQueen';
        if (fab)      return 'loremasterfabio';
        if (rocky)    return 'loremasterRocky';
        if (r)        return 'loremaster5e';
        return 'loremaster';
    },
  updateIcons() {
        const name = this.getIconName();
        const src = `${this.baseUrl}/images/${name}192x192.png`;
        const headerAvatar = document.querySelector('.chatbot-avatar-header');
        if (headerAvatar) headerAvatar.src = src;
        document.querySelectorAll('.chatbot-avatar').forEach(img => img.src = src);
    },
  updateRulesIndicator() {
        const badge = document.getElementById('rules-badge');
        if (badge) badge.style.display = this.rules ? 'inline' : 'none';
        this.updateIcons();
        this.updateModeControls();
    },
  updateVibeIndicator() {
        const badge = document.getElementById('vibe-badge');
        if (badge) {
            badge.style.display = this.vibe ? 'inline' : 'none';
            if (this.vibe === 'fabio') {
                badge.textContent = '🌹';
                badge.style.color = '#0d0b11';
                badge.style.background = '#c94c4c';
            } else if (this.vibe === 'rocky') {
                badge.textContent = '🪨';
                badge.style.color = '#e8dcc8';
                badge.style.background = '#5a4632';
            } else if (this.vibe === 'brainstorm') {
                badge.textContent = 'IDEAS';
                badge.style.color = '#0d0b11';
                badge.style.background = '#c9a84c';
            } else {
                badge.textContent = '💅';
                badge.style.color = '#0d0b11';
                badge.style.background = '#e85d9b';
            }
        }
        this.updateIcons();
        this.updateModeControls();
    },
  updateModeControls() {
        const activeMode = this.getActiveResponseMode();
        document.querySelectorAll('[data-chat-mode]').forEach((button) => {
            const mode = button.getAttribute('data-chat-mode');
            const active = mode === activeMode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
            button.disabled = !!this.isWaitingForResponse;
        });
        this.updateInputPlaceholder();
    },
  updateInputPlaceholder() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        if (this.artMode) {
            input.placeholder = 'Describe the image you want…';
        } else if (this.vibe === 'brainstorm') {
            input.placeholder = 'Ask for character hooks, backstory, voice…';
        } else if (this.rules) {
            input.placeholder = 'Ask a D&D 5e rules question…';
        } else {
            input.placeholder = 'Ask about NPCs, lore, locations…';
        }
    },
  addMessage(text, role, options) {
        const opts = options || {};
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        this.removeEmptyState();
        if (role === 'assistant') {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-row assistant';
            const iconName = this.getIconName();
            wrapper.innerHTML = `<img src="${this.baseUrl}/images/${iconName}192x192.png" alt="" class="chatbot-avatar"><div class="message assistant">${renderMarkdown(text)}<span class="message-source-tag">from the codex</span></div>`;
            const messageEl = wrapper.querySelector('.message.assistant');
            const citations = Array.isArray(opts.citations) ? opts.citations : [];
            if (messageEl && citations.length) {
                messageEl.appendChild(this.renderCitations(citations));
            }
            messagesContainer.appendChild(wrapper);
        } else {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${role}`;
            messageDiv.textContent = text;
            messagesContainer.appendChild(messageDiv);
        }
        this.scrollToBottom();
    },
  renderCitations(citations) {
        // Collapsible "Sources" chip row under each assistant message.
        // Chips with a url become links; ones without (5e rules etc.)
        // render as plain spans. Citations are pre-deduplicated server
        // side and capped at the top auto-injected matches.
        const details = document.createElement('details');
        details.className = 'chatbot-citations';
        details.style.cssText = 'margin-top:0.65rem;font-size:0.82rem;';
        const summary = document.createElement('summary');
        summary.textContent = `Sources (${citations.length})`;
        summary.style.cssText = 'cursor:pointer;color:rgba(212,165,116,0.85);letter-spacing:0.08em;text-transform:uppercase;font-size:0.62rem;font-family:Cinzel,Georgia,serif;';
        details.appendChild(summary);
        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.4rem;';
        citations.forEach((c) => {
            const label = `${c.name || c.source_file || 'source'}${
                typeof c.score === 'number' ? ` · ${Math.round(c.score * 100)}%` : ''
            }`;
            const chipStyle = 'display:inline-flex;align-items:center;padding:0.18rem 0.55rem;border:1px solid rgba(212,165,116,0.28);border-radius:999px;background:rgba(212,165,116,0.06);color:#e8dcc8;font-family:Crimson Text,Georgia,serif;line-height:1.2;text-decoration:none;';
            let chip;
            if (c.url) {
                chip = document.createElement('a');
                chip.href = c.url;
                chip.target = '_blank';
                chip.rel = 'noopener';
            } else {
                chip = document.createElement('span');
            }
            chip.style.cssText = chipStyle;
            chip.textContent = label;
            list.appendChild(chip);
        });
        details.appendChild(list);
        return details;
    },
  addSystemMessage(text) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        this.removeEmptyState();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    },
  showThinkingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-indicator';
        thinkingDiv.id = 'thinking-indicator';
        thinkingDiv.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
        messagesContainer.appendChild(thinkingDiv);
        this.scrollToBottom();
    },
  hideThinkingIndicator() {
        const indicator = document.getElementById('thinking-indicator');
        if (indicator) indicator.remove();
    },
  scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    },
  displayHistory() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        this.conversationHistory.forEach(msg => {
            this.addMessage(msg.content, msg.role);
        });
        this.renderEmptyState();
    },
  renderEmptyState() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer || this.conversationHistory.length || document.getElementById('chat-empty-state')) return;
        const empty = document.createElement('div');
        empty.id = 'chat-empty-state';
        empty.className = 'chat-empty-state';
        empty.innerHTML = `
            <div class="chat-empty-title">Ask Enzo</div>
            <div class="chat-empty-chips" aria-label="Suggested prompts">
                <span>Who is…</span>
                <span>Where is…</span>
                <span>Rules question…</span>
            </div>
        `;
        messagesContainer.appendChild(empty);
    },
  removeEmptyState() {
        const empty = document.getElementById('chat-empty-state');
        if (empty) empty.remove();
    }
};
