/* The instant-message API, in one place.
 *
 * Every call is authenticated through the shared pwa helpers, and every
 * failure throws an Error carrying the server's message — the panel turns
 * those into a status line rather than swallowing them. */
import { authHeaders, getJson } from '../shared/pwa.js';
import { readEventStream, supportsEventStream } from '../shared/sse.js';

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function fetchThreads() {
  return getJson('/api/im/threads');
}

export function fetchMessages(threadKey, afterId) {
  return getJson(
    `/api/im/thread/${encodeURIComponent(threadKey)}?after=${afterId || 0}`
  );
}

export function sendMessage(threadKey, body) {
  return postJson(`/api/im/thread/${encodeURIComponent(threadKey)}`, { body });
}

export function markThreadRead(threadKey, lastReadId) {
  return postJson('/api/im/read', { threadKey, lastReadId });
}

export function setThreadMuted(threadKey, muted) {
  return postJson('/api/im/mute', { threadKey, muted });
}

export async function deleteMessage(messageId) {
  const response = await fetch(`/api/im/message/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
}

/* The DM's one-way broadcasts. A different system from threads — one-way
 * and dismissible — shown as a pinned row above the conversations. */
export function fetchAnnouncements(playerName) {
  return getJson(`/api/messages?limit=10&name=${encodeURIComponent(playerName)}`);
}

export async function dismissAnnouncement(messageId) {
  const response = await fetch(`/api/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
}

/* Enzo's thread streams: the reply arrives token by token, and both halves
 * are stored server-side before the stream closes. Handlers fire as events
 * land; the promise resolves when the stream ends. */
export async function streamToEnzo(threadKey, body, options, onEvent) {
  const response = await fetch(
    `/api/im/thread/${encodeURIComponent(threadKey)}/enzo`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: authHeaders({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      }),
      body: JSON.stringify({ body, ...(options || {}) }),
    }
  );
  if (!supportsEventStream(response)) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data.error_code;
    throw error;
  }
  await readEventStream(response, onEvent);
}
