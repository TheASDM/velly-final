/* The pill's half of "one conversation, two doors".
 *
 * Signed in, Enzo's memory is the stored thread: the widget loads it on
 * boot and sends through /api/im/thread/<key>/enzo, so asking a question
 * on a phone and following it up on a laptop meets the same Enzo. Signed
 * out — the widget also rides along on public wiki pages — it falls back
 * to the old localStorage history against the anonymous /api/chat.
 */
import { authHeaders, whenPwaReady } from '../shared/pwa.js';
import { readEventStream, supportsEventStream } from '../shared/sse.js';

const ENZO_NAME = 'Enzo';

export function enzoThreadKey(playerName) {
  return [playerName, ENZO_NAME].sort().join('|');
}

export const threadMethods = {
  /* Resolve the signed-in player and adopt their thread as the history.
   * Any failure leaves the widget exactly as it was: local and working. */
  async adoptServerThread() {
        const pwa = await whenPwaReady();
        const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
        if (!name) return false;
        const key = enzoThreadKey(name);
        try {
            const response = await fetch(
                `/api/im/thread/${encodeURIComponent(key)}?after=0`,
                { cache: 'no-store', headers: authHeaders() }
            );
            if (!response.ok) return false;
            const data = await response.json();
            this.enzoThreadKey = key;
            this.conversationHistory = (data.messages || [])
                .filter((message) => !message.deleted)
                .map((message) => ({
                    role: message.sender === ENZO_NAME ? 'assistant' : 'user',
                    content: message.body,
                }));
            this.displayHistory();
            this.renderEmptyState();
            this.hideLocalClearControls();
            return true;
        } catch (error) {
            return false;
        }
    },

  /* The conversation lives with the account now, so a local "clear" would
   * only lie about what it cleared. Deleting is the chat panel's job. */
  hideLocalClearControls() {
        ['chat-clear-btn', 'chat-native-clear-btn'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.style.display = 'none';
        });
    },

  async sendThroughThread(message) {
        const response = await fetch(
            `/api/im/thread/${encodeURIComponent(this.enzoThreadKey)}/enzo`,
            {
                method: 'POST',
                cache: 'no-store',
                headers: authHeaders({
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                }),
                body: JSON.stringify({
                    body: message,
                    rules: this.rules,
                    vibe: this.vibe,
                }),
            }
        );
        if (!supportsEventStream(response)) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `API error: ${response.status}`);
        }

        this.hideThinkingIndicator();
        const bubble = this._beginAssistantStreamBubble();
        let accumulated = '';
        let citations = [];
        let errorMessage = null;
        let rules = this.rules;
        let vibe = this.vibe;

        await readEventStream(response, (name, payload) => {
            if (name === 'token' && typeof payload.text === 'string') {
                accumulated += payload.text;
                if (bubble) {
                    bubble.text.textContent = accumulated;
                    this.scrollToBottom();
                }
            } else if (name === 'meta') {
                citations = payload.citations || [];
                if (typeof payload.rules === 'boolean') rules = payload.rules;
                if (payload.vibe !== undefined) vibe = payload.vibe;
            } else if (name === 'error') {
                errorMessage = payload.message || 'Stream error';
            }
        });

        this._finalizeAssistantStreamBubble(bubble, accumulated, citations);
        if (errorMessage) this.addSystemMessage(errorMessage);
        this.syncModeFromServer(rules, vibe);

        return {
            response: accumulated,
            // The server is the record; the local array is only what the
            // widget renders from.
            conversationHistory: this.conversationHistory.concat([
                { role: 'user', content: message },
                { role: 'assistant', content: accumulated },
            ]),
            rules,
            vibe,
            citations,
            historyTruncated: false,
            _streamed: true,
        };
    },
};
