/* A server-sent-event reader for `fetch` responses.
 *
 * EventSource can't POST and can't carry an Authorization header, so both
 * Enzo surfaces read the stream by hand. One parser rather than two: the
 * floating pill and the chat panel are the same conversation now, and they
 * should not disagree about how a half-delivered frame is read. */

export async function readEventStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split;
      // Frames are separated by a blank line; anything after the last one
      // is a partial frame and waits for the next chunk.
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        let name = 'message';
        const data = [];
        block.split('\n').forEach((line) => {
          if (line.startsWith('event: ')) name = line.slice(7).trim();
          else if (line.startsWith('data: ')) data.push(line.slice(6));
        });
        if (!data.length) continue; // keepalive or comment frame
        let payload;
        try { payload = JSON.parse(data.join('\n')); } catch (error) { payload = null; }
        if (payload !== null) onEvent(name, payload);
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (error) { /* already released */ }
  }
}

export function supportsEventStream(response) {
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  return type.includes('text/event-stream')
    && !!response.body
    && typeof response.body.getReader === 'function';
}
