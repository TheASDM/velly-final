import { historyMethods } from './history.js';
import { renderingMethods } from './rendering.js';
import { shellMethods } from './shell.js';
import { transportMethods } from './transport.js';

class LoreMasterChatbot {
  constructor() {
        this.chatApiUrl = window.LOREMASTER_API_URL || '/api/chat';
        // Derive base URL for images — when embedded on wiki, resolve against loremaster origin
        if (window.LOREMASTER_API_URL) {
            const u = new URL(window.LOREMASTER_API_URL);
            this.baseUrl = u.origin;
        } else {
            this.baseUrl = '';
        }
        this.conversationHistory = [];
        this.rules = false;
        this.vibe = null;
        this.artMode = false;
        this.isOpen = false;
        this.isNativePage = document.body.classList.contains('vos-is-enzo-page') ||
            window.location.pathname.replace(/\/$/, '') === '/enzo';
        this.isWaitingForResponse = false;
        this.loadHistory();
        if (this.isNativePage) this.isOpen = true;
        this.init();
    }

  init() {
        this.createWidget();
        this.setupEventListeners();
        this.displayHistory();
        // Apply restored open/closed state from localStorage
        const widget = document.getElementById('chatbot-widget');
        if (widget && this.isOpen) {
            widget.classList.remove('chatbot-collapsed');
            const clearBtn = document.getElementById('chat-clear-btn');
            if (clearBtn) clearBtn.style.display = 'inline';
        }
        this.applyMobileLayout(this.isOpen);
        this.updateRulesIndicator();
        this.updateVibeIndicator();
        this.updateArtIndicator();
        this.renderEmptyState();
        console.log('Enzo initialized');
    }
}

Object.assign(
  LoreMasterChatbot.prototype,
  shellMethods,
  transportMethods,
  renderingMethods,
  historyMethods,
);
let loreMaster;
function initLoreMaster() {
    if (loreMaster) return;
    loreMaster = new LoreMasterChatbot();

    // Lock favicon for embedded contexts that mutate the active icon.
    const FAVICON_URL = window.LOREMASTER_FAVICON_URL;
    if (FAVICON_URL) {
        const enforceFavicon = () => {
            let link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
            if (link && link.href !== FAVICON_URL) {
                link.href = FAVICON_URL;
            }
        };
        enforceFavicon();
        new MutationObserver(enforceFavicon).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoreMaster);
} else {
    initLoreMaster();
}
