import { renderMarkdown, saveToLocalStorage } from './format.js';

export const transportMethods = {
  async handleSendMessage() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (!input || !sendBtn) return;
        const message = input.value.trim();
        if (!message) return;
        if (this.isWaitingForResponse) return;

        // /art on / /art off — toggle persistent art mode like other slash commands
        if (/^\/art\s+on\s*$/i.test(message)) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            this.artMode = true;
            this.saveHistory();
            this.updateArtIndicator();
            this.addSystemMessage('🎨 Art mode on. Send any description and I will generate an image of it (this can take 30–90 seconds). Type /art off to go back to normal chat.');
            input.focus();
            return;
        }
        if (/^\/art\s+off\s*$/i.test(message)) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            this.artMode = false;
            this.saveHistory();
            this.updateArtIndicator();
            this.addSystemMessage('Art mode off. Back to your regular conversation with Enzo.');
            input.focus();
            return;
        }

        // /art <prompt> — one-shot image generation, no mode change
        // OR any message while in art mode — treat it as the image prompt.
        const oneShotMatch = /^\/art\s+/i.test(message);
        if (oneShotMatch || this.artMode) {
            const artPrompt = oneShotMatch ? message.replace(/^\/art\s+/i, '').trim() : message;
            if (!artPrompt) {
                this.addSystemMessage('Usage: /art <description>, or /art on to enter art mode.');
                return;
            }
            const identity = await this.getArtIdentity();
            if (!identity.name || !identity.token) {
                this.addSystemMessage('Log in before generating images.');
                input.focus();
                return;
            }
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            this.removeEmptyState();
            this.addMessage(message, 'user');
            this.isWaitingForResponse = true;
            input.disabled = true;
            sendBtn.disabled = true;
            this.showThinkingIndicator();
            try {
                const url = this.chatApiUrl.replace(/\/api\/chat$/, '/api/generate-image');
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${identity.token}`,
                    },
                    body: JSON.stringify({ prompt: artPrompt, creator: identity.name }),
                });
                this.hideThinkingIndicator();
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) {
                    const detail = data.details || data.error || `HTTP ${resp.status}`;
                    throw new Error(detail);
                }
                const src = data.b64 ? `data:image/png;base64,${data.b64}` : data.url;
                if (!src) throw new Error('Image returned no data');
                this.addImageMessage(src, artPrompt);
            } catch (error) {
                console.error('Image gen error:', error);
                this.hideThinkingIndicator();
                this.addSystemMessage('Image generation failed: ' + error.message);
            } finally {
                this.isWaitingForResponse = false;
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
            }
            return;
        }

        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        this.removeEmptyState();
        this.addMessage(message, 'user');
        this.isWaitingForResponse = true;
        input.disabled = true;
        sendBtn.disabled = true;
        this.showThinkingIndicator();
        try {
            const response = await this.sendMessageToAPI(message);
            this.hideThinkingIndicator();
            // Streamed responses already drew the bubble live; skip
            // the duplicate addMessage call.
            if (!response._streamed) {
                this.addMessage(response.response, 'assistant', {
                    citations: Array.isArray(response.citations) ? response.citations : [],
                });
            }
            this.conversationHistory = response.conversationHistory;
            this.saveHistory();
            if (response.historyTruncated && !this.historyTruncatedNoticed) {
                this.historyTruncatedNoticed = true;
                this.addSystemMessage('Older messages condensed to fit Enzo’s memory budget.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideThinkingIndicator();
            const msg = error.message.includes('offline')
                ? error.message
                : 'Failed to get response from Enzo. Please try again.';
            this.addSystemMessage(msg);
        } finally {
            this.isWaitingForResponse = false;
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    },
  addImageMessage(src, caption) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'message-row assistant';
        const iconName = this.getIconName();
        const safeCaption = caption.replace(/[<>&"']/g, c => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
        }[c]));
        wrapper.innerHTML = `<img src="${this.baseUrl}/images/${iconName}192x192.png" alt="" class="chatbot-avatar"><div class="message assistant"><img src="${src}" alt="${safeCaption}" style="max-width:100%;border-radius:6px;display:block;margin-bottom:0.5rem"><em style="opacity:0.7;font-size:0.85em">${safeCaption}</em></div>`;
        messagesContainer.appendChild(wrapper);
        this.scrollToBottom();
    },
  async sendMessageToAPI(message) {
        if (!navigator.onLine) {
            throw new Error('You appear to be offline. Enzo requires a connection to consult the archives.');
        }
        const response = await fetch(this.chatApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream, application/json',
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: this.conversationHistory,
                rules: this.rules,
                vibe: this.vibe
            })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const ctype = (response.headers.get('Content-Type') || '').toLowerCase();
        if (ctype.includes('text/event-stream') && response.body && typeof response.body.getReader === 'function') {
            return await this._consumeStreamResponse(response);
        }
        const data = await response.json();
        if (typeof data.rules === 'boolean' && data.rules !== this.rules) {
            this.rules = data.rules;
            this.updateRulesIndicator();
            saveToLocalStorage('loreMasterRules', this.rules);
        }
        if (data.vibe !== undefined && data.vibe !== this.vibe) {
            this.vibe = data.vibe;
            this.updateVibeIndicator();
            saveToLocalStorage('loreMasterVibe', this.vibe);
        }
        return data;
    },
  async _consumeStreamResponse(response) {
        // Drop the thinking indicator before the bubble appears.
        this.hideThinkingIndicator();
        const bubble = this._beginAssistantStreamBubble();
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulated = '';
        const meta = {
            conversationHistory: this.conversationHistory,
            rules: this.rules,
            vibe: this.vibe,
            citations: [],
            historyTruncated: false,
        };
        let errorMessage = null;

        const handleEvent = (name, dataStr) => {
            if (!dataStr) return;
            let data;
            try { data = JSON.parse(dataStr); } catch (e) { return; }
            if (name === 'token' && data && typeof data.text === 'string') {
                accumulated += data.text;
                bubble.text.textContent = accumulated;
                this.scrollToBottom();
            } else if (name === 'meta' && data) {
                Object.assign(meta, data);
            } else if (name === 'error' && data) {
                errorMessage = data.message || 'Stream error';
            }
        };

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf('\n\n')) >= 0) {
                    const block = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    let eventName = 'message';
                    const dataLines = [];
                    for (const line of block.split('\n')) {
                        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
                        else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
                    }
                    if (dataLines.length) handleEvent(eventName, dataLines.join('\n'));
                }
            }
        } finally {
            try { reader.releaseLock(); } catch (e) {}
        }

        // Replace the plain-text bubble with rendered markdown + sources.
        this._finalizeAssistantStreamBubble(bubble, accumulated, meta.citations || []);

        if (errorMessage) {
            // Append a system message so the player sees something useful
            // even when partial text already streamed in.
            this.addSystemMessage(errorMessage);
        }

        // Reflect mode-bearing fields the server toggled mid-stream.
        if (typeof meta.rules === 'boolean' && meta.rules !== this.rules) {
            this.rules = meta.rules;
            this.updateRulesIndicator();
            saveToLocalStorage('loreMasterRules', this.rules);
        }
        if (meta.vibe !== undefined && meta.vibe !== this.vibe) {
            this.vibe = meta.vibe;
            this.updateVibeIndicator();
            saveToLocalStorage('loreMasterVibe', this.vibe);
        }

        return {
            response: accumulated,
            conversationHistory: meta.conversationHistory || this.conversationHistory,
            rules: meta.rules,
            vibe: meta.vibe,
            citations: meta.citations || [],
            historyTruncated: !!meta.historyTruncated,
            _streamed: true,
        };
    },
  _beginAssistantStreamBubble() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return null;
        this.removeEmptyState();
        const wrapper = document.createElement('div');
        wrapper.className = 'message-row assistant';
        const iconName = this.getIconName();
        wrapper.innerHTML = `<img src="${this.baseUrl}/images/${iconName}192x192.png" alt="" class="chatbot-avatar"><div class="message assistant"><div class="message-stream-text" style="white-space:pre-wrap;"></div><span class="streaming-cursor" aria-hidden="true">▍</span></div>`;
        const textEl = wrapper.querySelector('.message-stream-text');
        const cursorEl = wrapper.querySelector('.streaming-cursor');
        const messageEl = wrapper.querySelector('.message.assistant');
        messagesContainer.appendChild(wrapper);
        this.scrollToBottom();
        return { wrapper, messageEl, text: textEl, cursor: cursorEl };
    },
  _finalizeAssistantStreamBubble(bubble, fullText, citations) {
        if (!bubble || !bubble.messageEl) return;
        // Swap raw text for rendered markdown + add citation chips +
        // the existing "from the codex" footer tag.
        bubble.messageEl.innerHTML = renderMarkdown(fullText)
            + '<span class="message-source-tag">from the codex</span>';
        if (Array.isArray(citations) && citations.length) {
            bubble.messageEl.appendChild(this.renderCitations(citations));
        }
        this.scrollToBottom();
    }
};
