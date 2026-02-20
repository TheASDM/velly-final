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
        if (this.conversationHistory.length === 0) {
            this.addSystemMessage('🎲 Greetings, adventurer! I am the Lore Master, keeper of The Crimson Tavern Chronicles. Ask me about NPCs, locations, factions, past sessions, or house rules.');
        }
        console.log('🎲 Lore Master initialized');
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
                    <span>🎲 Lore Master</span>
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
        if (this.isOpen) {
            widget.classList.remove('chatbot-collapsed');
            setTimeout(() => {
                const input = document.getElementById('chat-input');
                if (input) input.focus();
            }, 300);
        } else {
            widget.classList.add('chatbot-collapsed');
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
        messageDiv.textContent = text;
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
