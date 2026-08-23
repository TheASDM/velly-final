import { saveToLocalStorage } from './format.js';

export const shellMethods = {
  applyMobileLayout(isOpen) {
        if (this.isNativePage) return;
        if (window.innerWidth > 768) return;
        const container = document.getElementById('chatbot-container');
        const widget = document.getElementById('chatbot-widget');
        if (!container || !widget) return;
        if (isOpen) {
            container.style.right = '0.75rem';
            container.style.left = '0.75rem';
            widget.style.width = '';
        } else {
            container.style.right = '0';
            container.style.left = 'auto';
            widget.style.width = '180px';
        }
    },
  createWidget() {
        const container = document.getElementById('chatbot-container');
        if (!container) {
            console.error('Chatbot container not found');
            return;
        }
        const collapsedClass = this.isOpen ? '' : 'chatbot-collapsed';
        container.innerHTML = `
            <div id="chatbot-widget" class="${collapsedClass}">
                <div class="chatbot-header">
                    <img src="${this.baseUrl}/images/loremaster192x192.png" alt="" class="chatbot-avatar-header">
                    <span>Enzo</span>
                    <span id="rules-badge" style="display:none;margin-left:0.3rem;font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;color:#e8dcc8;background:rgba(139,26,42,0.5);border:1px solid rgba(139,26,42,0.7);padding:0.1rem 0.35rem;border-radius:2px;font-weight:700;vertical-align:middle">5e</span>
                    <span id="vibe-badge" style="display:none;margin-left:0.3rem;font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.1rem 0.35rem;border-radius:2px;font-weight:700;vertical-align:middle">💅</span>
                    <button id="chat-clear-btn" style="display:none;margin-left:auto;margin-right:0.5rem;background:none;border:none;cursor:pointer;font-size:0.7rem;letter-spacing:0.08em;color:rgba(212,165,116,0.45);padding:0;line-height:1;text-transform:uppercase;font-family:inherit" title="Start a new conversation">new chat</button>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="chatbot-body">
                    <div class="chatbot-native-actions" aria-label="Chat controls">
                        <button id="chat-native-clear-btn" class="chatbot-clear-action" type="button" title="Clear chat" aria-label="Clear chat">
                            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                            <span>Clear</span>
                        </button>
                    </div>
                    <div id="chat-messages"></div>
                    <div class="chat-mode-controls" aria-label="Enzo response mode">
                        <button class="chat-mode-button" type="button" data-chat-mode="lore" aria-pressed="true">Lore</button>
                        <button class="chat-mode-button" type="button" data-chat-mode="rules" aria-pressed="false">Rules</button>
                        <button class="chat-mode-button" type="button" data-chat-mode="brainstorm" aria-pressed="false">Brainstorm</button>
                    </div>
                    <div class="chat-input-area">
                        <textarea id="chat-input" placeholder="Ask about NPCs, lore, locations…" autocomplete="off" rows="1"></textarea>
                        <button id="chat-send-btn" type="button" aria-label="Send message" title="Send">
                            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
  setupEventListeners() {
        const header = document.querySelector('.chatbot-header');
        if (header && !this.isNativePage) header.addEventListener('click', () => this.toggleWidget());
        const clearBtn = document.getElementById('chat-clear-btn');
        if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); this.clearHistory(); });
        const nativeClearBtn = document.getElementById('chat-native-clear-btn');
        if (nativeClearBtn) nativeClearBtn.addEventListener('click', () => this.clearHistory());
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', () => this.handleSendMessage());
        const input = document.getElementById('chat-input');
        if (input) {
            const grow = () => {
                input.style.height = 'auto';
                const max = parseFloat(getComputedStyle(input).lineHeight || '20') * 4 + 22;
                input.style.height = `${Math.min(input.scrollHeight, max)}px`;
            };
            input.addEventListener('input', grow);
            grow();
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }
        document.querySelectorAll('[data-chat-suggestion]').forEach((button) => {
            button.addEventListener('click', () => {
                const prompt = button.getAttribute('data-chat-suggestion') || button.textContent || '';
                this.submitPrompt(prompt.trim());
            });
        });
        document.querySelectorAll('[data-chat-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                this.handleModeButton(button.getAttribute('data-chat-mode'));
            });
        });
    },
  toggleWidget() {
        const widget = document.getElementById('chatbot-widget');
        if (!widget) return;
        this.isOpen = !this.isOpen;
        const clearBtn = document.getElementById('chat-clear-btn');
        if (this.isOpen) {
            widget.classList.remove('chatbot-collapsed');
            if (clearBtn) clearBtn.style.display = 'inline';
            this.applyMobileLayout(true);
            setTimeout(() => {
                const input = document.getElementById('chat-input');
                if (input) input.focus();
            }, 300);
        } else {
            widget.classList.add('chatbot-collapsed');
            if (clearBtn) clearBtn.style.display = 'none';
            this.applyMobileLayout(false);
        }
        saveToLocalStorage('loreMasterOpen', this.isOpen);
    },
  submitPrompt(prompt) {
        const input = document.getElementById('chat-input');
        if (!input || !prompt) return;
        input.value = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        this.handleSendMessage();
    },
  getActiveResponseMode() {
        if (this.vibe === 'brainstorm') return 'brainstorm';
        if (this.rules) return 'rules';
        return 'lore';
    },
  async handleModeButton(targetMode) {
        const input = document.getElementById('chat-input');
        if (this.isWaitingForResponse) return;

        const currentMode = this.getActiveResponseMode();
        if (!targetMode || targetMode === currentMode) {
            if (input) input.focus();
            return;
        }

        let command = '';
        if (targetMode === 'rules') {
            command = '/rules on';
        } else if (targetMode === 'brainstorm') {
            command = '/brainstorm on';
        } else if (targetMode === 'lore') {
            command = currentMode === 'rules' ? '/rules off' : '/brainstorm off';
        }
        if (!command) return;

        const sendBtn = document.getElementById('chat-send-btn');
        const previousHistory = this.conversationHistory.slice();
        this.isWaitingForResponse = true;
        if (sendBtn) sendBtn.disabled = true;
        this.updateModeControls();
        try {
            const response = await this.sendMessageToAPI(command);
            this.conversationHistory = previousHistory;
            this.saveHistory();
            this.addSystemMessage(response.response || 'Mode updated.');
        } catch (error) {
            console.error('Mode switch failed:', error);
            this.addSystemMessage('Could not switch modes. Try again.');
        } finally {
            this.isWaitingForResponse = false;
            if (sendBtn) sendBtn.disabled = false;
            this.updateModeControls();
            if (input) input.focus();
        }
    },
  async getArtIdentity() {
        if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
            const needsLogin = !window.VOS_PWA.getAuthToken || !window.VOS_PWA.getAuthToken();
            const name = await window.VOS_PWA.ensureIdentity({ force: needsLogin });
            const token = window.VOS_PWA.getAuthToken ? window.VOS_PWA.getAuthToken() : '';
            return { name, token };
        }
        let name = '';
        let token = '';
        try {
            name = localStorage.getItem('vos.playerName') || '';
            token = localStorage.getItem('vos.authToken') || '';
        } catch (error) {}
        return { name, token };
    }
};
