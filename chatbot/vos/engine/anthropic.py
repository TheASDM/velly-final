from ..imports import *
from ..symbols import *
from ..config import *

class AnthropicMixin:
    def _anthropic_headers(self):
        return {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    def _tool_definitions(self):
        return [
            {
                "name": "lookup_entry",
                "description": (
                    "Look up a campaign entry (character, location, faction, lore) "
                    "or D&D 5e rules entry (spell, feat, item, monster, class feature, etc.) "
                    "by name. Use this when the auto-loaded references don't cover what's needed, "
                    "or when an [ADDITIONAL MATCHES AVAILABLE] block lists something relevant."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name of the entry to look up",
                        }
                    },
                    "required": ["name"],
                },
            }
        ]

    def call_anthropic(self, system_prompt, messages, temperature=None):
        temp = TEMPERATURE if temperature is None else temperature
        # Prompt caching: wrap the (mostly-static) system prompt in a
        # single cacheable block. Per-request context lives in user
        # messages, not in `system`, so the cache prefix is stable
        # across requests in the same vibe/mode. Anthropic returns
        # cache_creation_input_tokens / cache_read_input_tokens
        # alongside the normal input_tokens count.
        system_blocks = [{
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }]
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": MAX_TOKENS,
            "system": system_blocks,
            "messages": messages,
            "tools": self._tool_definitions(),
            "temperature": temp,
        }

        logging.info(
            "  Anthropic: calling %s (system %d chars, %d messages, temp=%.2f)",
            ANTHROPIC_MODEL, len(system_prompt), len(messages), temp,
        )

        max_loops = 5
        for loop_i in range(max_loops):
            t0 = time.time()
            resp = http_requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=self._anthropic_headers(),
                json=payload,
                timeout=120,
            )
            api_ms = int((time.time() - t0) * 1000)

            if resp.status_code != 200:
                logging.error(
                    "  Anthropic API error (%dms): %d — %s",
                    api_ms, resp.status_code, resp.text[:300],
                )
                return "I'm having trouble responding right now. Please try again in a moment."

            result = resp.json()
            usage = result.get("usage", {})
            logging.info(
                "  Anthropic response (%dms): stop=%s, input=%d "
                "(cache_create=%d, cache_read=%d), output=%d",
                api_ms, result.get("stop_reason"),
                usage.get("input_tokens", 0),
                usage.get("cache_creation_input_tokens", 0),
                usage.get("cache_read_input_tokens", 0),
                usage.get("output_tokens", 0),
            )

            if result.get("stop_reason") != "tool_use":
                text_parts = [
                    b["text"] for b in result.get("content", [])
                    if b.get("type") == "text"
                ]
                response = "\n".join(text_parts) if text_parts else ""
                logging.info("  Final response: %d chars", len(response))
                return response

            # Handle tool calls
            tool_results = []
            for block in result["content"]:
                if block["type"] == "tool_use":
                    tool_name = block["name"]
                    tool_input = block["input"]
                    logging.info(
                        "  Tool call [%d/%d]: %s(%s)",
                        loop_i + 1, max_loops, tool_name, json.dumps(tool_input),
                    )
                    if tool_name == "lookup_entry":
                        tool_result = self.lookup_entry(tool_input.get("name", ""))
                    else:
                        tool_result = f"Unknown tool: {tool_name}"
                    logging.info("  Tool result: %d chars", len(tool_result))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": tool_result,
                    })

            messages.append({"role": "assistant", "content": result["content"]})
            messages.append({"role": "user", "content": tool_results})
            payload["messages"] = messages

        logging.warning("  Hit max tool loops (%d)", max_loops)
        return "I got lost in the archives. Could you try a simpler question?"

    def call_anthropic_stream(self, system_prompt, messages, temperature=None):
        """Generator. Yields event dicts: {type: 'token', text: '...'},
        {type: 'done', usage: {...}}, or {type: 'error', text: '...'}.
        Handles tool_use inline by accumulating the tool call, running
        the tool, and re-issuing a fresh streaming request with the tool
        result appended to messages."""
        temp = TEMPERATURE if temperature is None else temperature
        system_blocks = [{
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }]
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": MAX_TOKENS,
            "system": system_blocks,
            "messages": messages,
            "tools": self._tool_definitions(),
            "temperature": temp,
            "stream": True,
        }

        max_loops = 5
        for loop_i in range(max_loops):
            t0 = time.time()
            resp = http_requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=self._anthropic_headers(),
                json=payload,
                stream=True,
                timeout=300,
            )
            if resp.status_code != 200:
                # Drain a few bytes so the connection releases cleanly.
                body = resp.text[:300]
                logging.error(
                    "  Anthropic stream HTTP %d: %s", resp.status_code, body,
                )
                yield {"type": "error", "text": "I'm having trouble responding right now. Please try again in a moment."}
                return

            content_blocks = []
            current_block = None
            partial_json_buf = ""
            stop_reason = None
            usage = {}

            for raw in resp.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                if not raw.startswith("data: "):
                    continue
                payload_str = raw[6:].strip()
                if not payload_str or payload_str == "[DONE]":
                    continue
                try:
                    event = json.loads(payload_str)
                except Exception:
                    continue
                etype = event.get("type")

                if etype == "content_block_start":
                    block = event.get("content_block") or {}
                    btype = block.get("type")
                    if btype == "text":
                        current_block = {"type": "text", "text": ""}
                    elif btype == "tool_use":
                        current_block = {
                            "type": "tool_use",
                            "id": block.get("id"),
                            "name": block.get("name"),
                            "input": {},
                        }
                    partial_json_buf = ""

                elif etype == "content_block_delta":
                    delta = event.get("delta") or {}
                    if not current_block:
                        continue
                    if current_block.get("type") == "text" and delta.get("type") == "text_delta":
                        chunk = delta.get("text", "")
                        if chunk:
                            current_block["text"] += chunk
                            yield {"type": "token", "text": chunk}
                    elif current_block.get("type") == "tool_use" and delta.get("type") == "input_json_delta":
                        partial_json_buf += delta.get("partial_json", "")

                elif etype == "content_block_stop":
                    if current_block:
                        if current_block.get("type") == "tool_use" and partial_json_buf:
                            try:
                                current_block["input"] = json.loads(partial_json_buf)
                            except Exception:
                                current_block["input"] = {}
                        content_blocks.append(current_block)
                    current_block = None
                    partial_json_buf = ""

                elif etype == "message_delta":
                    delta = event.get("delta") or {}
                    if delta.get("stop_reason"):
                        stop_reason = delta["stop_reason"]
                    usage.update(event.get("usage") or {})

                elif etype == "message_stop":
                    pass

            api_ms = int((time.time() - t0) * 1000)
            logging.info(
                "  Anthropic stream (%dms loop %d): stop=%s, "
                "input=%d (cache_create=%d, cache_read=%d), output=%d",
                api_ms, loop_i + 1, stop_reason,
                usage.get("input_tokens", 0),
                usage.get("cache_creation_input_tokens", 0),
                usage.get("cache_read_input_tokens", 0),
                usage.get("output_tokens", 0),
            )

            if stop_reason != "tool_use":
                yield {"type": "done", "usage": usage}
                return

            # Tool use: run each call, append tool result, loop with
            # updated messages.
            tool_results = []
            for block in content_blocks:
                if block.get("type") != "tool_use":
                    continue
                tool_name = block.get("name")
                tool_input = block.get("input") or {}
                logging.info(
                    "  Tool call [stream %d/%d]: %s(%s)",
                    loop_i + 1, max_loops, tool_name, json.dumps(tool_input),
                )
                if tool_name == "lookup_entry":
                    tool_result = self.lookup_entry(tool_input.get("name", ""))
                else:
                    tool_result = f"Unknown tool: {tool_name}"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.get("id"),
                    "content": tool_result,
                })

            messages.append({"role": "assistant", "content": content_blocks})
            messages.append({"role": "user", "content": tool_results})
            payload["messages"] = messages

        logging.warning("  Hit max tool loops (%d) in stream", max_loops)
        yield {"type": "error", "text": "I got lost in the archives. Could you try a simpler question?"}

__all__ = ['AnthropicMixin']
