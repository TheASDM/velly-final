function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderMarkdown(text) {
    // Split on fenced code blocks first so we don't mangle them
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
            return `<pre style="white-space:pre-wrap;margin:0.4em 0;padding:0.5em;background:rgba(0,0,0,0.3);border-radius:3px;font-size:0.85em"><code>${escapeHtml(code)}</code></pre>`;
        }
        let p = escapeHtml(part);
        // Inline code
        p = p.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1em 0.3em;border-radius:2px;font-size:0.88em">$1</code>');
        // Headers → bold + line break
        p = p.replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>');
        // Bold
        p = p.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        p = p.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        // HR
        p = p.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(212,165,116,0.3);margin:0.5em 0">');
        // List items — collect runs then wrap
        p = p.replace(/((?:^[*\-] .+\n?)+)/gm, match => {
            const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[*\-] /, '')}</li>`).join('');
            return `<ul style="margin:0.4em 0;padding-left:1.4em">${items}</ul>`;
        });
        // Paragraph breaks
        p = p.replace(/\n\n+/g, '<br><br>');
        p = p.replace(/\n/g, '<br>');
        return p;
    }).join('');
}
function saveToLocalStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (error) { console.error('Error saving to localStorage:', error); }
}
function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}
class LoreMasterChatbot {
    constructor() {
        this.chatApiUrl = window.LOREMASTER_API_URL || '/api/chat';
        this.conversationHistory = [];
        this.isOpen = false;
        this.isWaitingForResponse = false;
        this.loadHistory();
        this.init();
    }
    init() {
        this.createWidget();
        this.setupEventListeners();
        this.displayHistory();
        this.applyMobileLayout(false);
        if (this.conversationHistory.length === 0) {
            this.addSystemMessage('I am the Lore Master — your guide to the city of Venturia and the Valley of Shadows. Ask me about characters, locations, factions, past sessions, or house rules.');
        }
        console.log('Lore Master initialized');
    }
    applyMobileLayout(isOpen) {
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
    }
    createWidget() {
        const container = document.getElementById('chatbot-container');
        if (!container) {
            console.error('Chatbot container not found');
            return;
        }
        container.innerHTML = `
            <div id="chatbot-widget" class="chatbot-collapsed">
                <div class="chatbot-header">
                    <span>Lore Master</span>
                    <button id="chat-clear-btn" style="display:none;margin-left:auto;margin-right:0.5rem;background:none;border:none;cursor:pointer;font-size:0.7rem;letter-spacing:0.08em;color:rgba(212,165,116,0.45);padding:0;line-height:1;text-transform:uppercase;font-family:inherit" title="Start a new conversation">new chat</button>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="chatbot-body">
                    <div id="chat-messages"></div>
                    <div class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Ask about NPCs, lore, locations..." autocomplete="off">
                        <button id="chat-send-btn">Send</button>
                    </div>
                </div>
            </div>
        `;
    }
    setupEventListeners() {
        const header = document.querySelector('.chatbot-header');
        if (header) header.addEventListener('click', () => this.toggleWidget());
        const clearBtn = document.getElementById('chat-clear-btn');
        if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); this.clearHistory(); });
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', () => this.handleSendMessage());
        const input = document.getElementById('chat-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }
    }
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
    }
    async handleSendMessage() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (!input || !sendBtn) return;
        const message = input.value.trim();
        if (!message) return;
        if (this.isWaitingForResponse) return;
        input.value = '';
        this.addMessage(message, 'user');
        this.isWaitingForResponse = true;
        input.disabled = true;
        sendBtn.disabled = true;
        this.showThinkingIndicator();
        try {
            const response = await this.sendMessageToAPI(message);
            this.hideThinkingIndicator();
            this.addMessage(response.response, 'assistant');
            this.conversationHistory = response.conversationHistory;
            this.saveHistory();
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideThinkingIndicator();
            this.addSystemMessage('⚠️ Failed to get response from Lore Master. Please try again.');
        } finally {
            this.isWaitingForResponse = false;
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }
    async sendMessageToAPI(message) {
        const response = await fetch(this.chatApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                conversationHistory: this.conversationHistory
            })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
    }
    addMessage(text, role) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        if (role === 'assistant') {
            messageDiv.innerHTML = renderMarkdown(text);
        } else {
            messageDiv.textContent = text;
        }
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    addSystemMessage(text) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    showThinkingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-indicator';
        thinkingDiv.id = 'thinking-indicator';
        thinkingDiv.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
        messagesContainer.appendChild(thinkingDiv);
        this.scrollToBottom();
    }
    hideThinkingIndicator() {
        const indicator = document.getElementById('thinking-indicator');
        if (indicator) indicator.remove();
    }
    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    displayHistory() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        this.conversationHistory.forEach(msg => {
            this.addMessage(msg.content, msg.role);
        });
    }
    saveHistory() {
        saveToLocalStorage('loreMasterHistory', this.conversationHistory);
    }
    loadHistory() {
        const saved = loadFromLocalStorage('loreMasterHistory');
        if (saved && Array.isArray(saved)) {
            this.conversationHistory = saved;
        }
    }
    clearHistory() {
        this.conversationHistory = [];
        this.saveHistory();
        this.displayHistory();
        this.addSystemMessage('Conversation cleared. How can I help you?');
    }
}
let loreMaster;
document.addEventListener('DOMContentLoaded', () => {
    loreMaster = new LoreMasterChatbot();
});
function clearChatHistory() {
    if (loreMaster) loreMaster.clearHistory();
}
