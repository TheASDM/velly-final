import { loadFromLocalStorage, saveToLocalStorage } from './format.js';

export const historyMethods = {
  saveHistory() {
        saveToLocalStorage('loreMasterHistory', this.conversationHistory);
        saveToLocalStorage('loreMasterRules', this.rules);
        saveToLocalStorage('loreMasterVibe', this.vibe);
        saveToLocalStorage('loreMasterArtMode', this.artMode);
    },
  loadHistory() {
        const saved = loadFromLocalStorage('loreMasterHistory');
        if (saved && Array.isArray(saved)) {
            this.conversationHistory = saved;
        }
        const savedRules = loadFromLocalStorage('loreMasterRules');
        if (savedRules === true) {
            this.rules = true;
        }
        const savedVibe = loadFromLocalStorage('loreMasterVibe');
        if (savedVibe) {
            this.vibe = savedVibe;
        }
        if (this.vibe === 'brainstorm') {
            this.rules = false;
        }
        const savedArt = loadFromLocalStorage('loreMasterArtMode');
        if (savedArt === true) {
            this.artMode = true;
        }
        const savedOpen = loadFromLocalStorage('loreMasterOpen');
        if (savedOpen === true || savedOpen === false) {
            this.isOpen = savedOpen;
        }
    },
  updateArtIndicator() {
        // Inject/remove a 🎨 badge in the header next to the others
        const header = document.querySelector('.chatbot-header');
        let badge = document.getElementById('art-badge');
        if (!header) return;
        if (this.artMode) {
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'art-badge';
                badge.style.cssText = 'margin-left:0.3rem;font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;color:#0d0b11;background:#d4a574;padding:0.1rem 0.35rem;border-radius:2px;font-weight:700;vertical-align:middle';
                badge.textContent = '🎨 ART';
                const toggleIcon = header.querySelector('.toggle-icon');
                header.insertBefore(badge, toggleIcon);
            }
            badge.style.display = 'inline';
        } else if (badge) {
            badge.style.display = 'none';
        }
        this.updateInputPlaceholder();
    },
  clearHistory() {
        this.conversationHistory = [];
        this.rules = false;
        this.vibe = null;
        this.artMode = false;
        this.saveHistory();
        this.displayHistory();
        this.updateRulesIndicator();
        this.updateVibeIndicator();
        this.updateArtIndicator();
        this.renderEmptyState();
    }
};
