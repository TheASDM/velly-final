from ..imports import *
from ..symbols import *
from ..config import *
from ..web import limiter

bp = Blueprint("chat", __name__)


def _chat_viewer():
    """Who is asking, from the credential — never from the request body.

    /api/chat took no credential at all before this, so Enzo answered every
    request identically and had no way to know whether the reader was a
    player, the DM, or nobody. Reading the token here is what makes "Enzo
    inherits the caller's role" a fact the server can act on rather than a
    sentence in a prompt.

    Anonymous readers are still served: the corpus is published wiki content,
    which is what an anonymous reader may see anyway. Refusing them would
    take the widget off the public wiki for no gain in safety."""
    payload = _verify_player_token_payload(_extract_player_token())
    if not payload:
        return None
    preview = bool(payload.get("preview"))
    return {
        "name": payload.get("name"),
        "is_dm": (not preview) and bool(payload.get("is_dm") or _is_dm_player(payload.get("name"))),
        "preview": preview,
    }

@bp.route("/api/chat", methods=["POST"])
@limiter.limit(lambda: CHAT_RATE_LIMIT)
def chat():
    body = request.get_json(silent=True) or {}
    message = body.get("message", "")
    conversation_history = body.get("conversationHistory", [])
    rules = body.get("rules", False)
    vibe = body.get("vibe", None)

    if not message or not isinstance(message, str):
        return jsonify({"error": "Invalid message"}), 400

    if len(message) > 4000:
        return jsonify({"error": "Message too long"}), 400

    # Validate and sanitize conversation history. Cap is two-sided:
    # last 40 messages AND a total-bytes budget so a misbehaving client
    # can't ship megabytes of replayed history per request.
    history_truncated = False
    if not isinstance(conversation_history, list):
        conversation_history = []
    else:
        original_count = len(conversation_history)
        sanitized = []
        for msg in conversation_history[-40:]:
            if (isinstance(msg, dict)
                    and msg.get("role") in ("user", "assistant")
                    and isinstance(msg.get("content"), str)):
                sanitized.append({"role": msg["role"], "content": msg["content"][:8000]})
        # Now trim from the OLDEST end until we fit MAX_CONVERSATION_BYTES.
        running_bytes = sum(len(m["content"]) for m in sanitized)
        while sanitized and running_bytes > MAX_CONVERSATION_BYTES:
            running_bytes -= len(sanitized[0]["content"])
            sanitized.pop(0)
        if len(sanitized) < original_count:
            history_truncated = True
        conversation_history = sanitized

    # Streaming opt-in: the client sets Accept: text/event-stream when
    # it wants SSE. Otherwise we fall back to the legacy JSON response
    # so older clients + the offline stub keep working without change.
    viewer = _chat_viewer()

    accept = (request.headers.get("Accept") or "").lower()
    wants_stream = "text/event-stream" in accept

    if wants_stream:
        write_log("user", message)

        def event_stream():
            try:
                full_response_chunks = []
                for event in engine.chat_stream(
                    message, conversation_history, rules, vibe, viewer=viewer
                ):
                    etype = event.get("type")
                    if etype == "token":
                        full_response_chunks.append(event.get("text", ""))
                        yield (
                            "event: token\n"
                            "data: " + json.dumps({"text": event.get("text", "")}) + "\n\n"
                        )
                    elif etype == "meta":
                        payload = {
                            "conversationHistory": event.get("conversationHistory") or [],
                            "rules": event.get("rules"),
                            "vibe": event.get("vibe"),
                            "citations": event.get("citations") or [],
                            "historyTruncated": history_truncated,
                        }
                        yield (
                            "event: meta\n"
                            "data: " + json.dumps(payload) + "\n\n"
                        )
                    elif etype == "error":
                        yield (
                            "event: error\n"
                            "data: " + json.dumps({"message": event.get("text", "")}) + "\n\n"
                        )
                    elif etype == "done":
                        pass  # final 'done' event sent after meta below
                # End-of-stream marker so the client can finalise UI.
                yield "event: done\ndata: {}\n\n"
                write_log("assistant", "".join(full_response_chunks))
            except Exception as e:
                logging.exception("Chat stream error")
                yield (
                    "event: error\n"
                    "data: " + json.dumps({"message": str(e)}) + "\n\n"
                )

        return Response(
            stream_with_context(event_stream()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-store",
                # Tell nginx not to buffer; otherwise tokens batch up
                # behind the proxy and the client doesn't see streaming.
                "X-Accel-Buffering": "no",
            },
        )

    try:
        response_text, updated_history, new_rules, new_vibe, citations = engine.chat(
            message, conversation_history, rules, vibe, viewer=viewer
        )

        write_log("user", message)
        write_log("assistant", response_text)

        return jsonify({
            "response": response_text,
            "conversationHistory": updated_history,
            "rules": new_rules,
            "vibe": new_vibe,
            "historyTruncated": history_truncated,
            "citations": citations,
        })
    except Exception as e:
        logging.exception("Chat handler error")
        return jsonify({
            "error": "Failed to get response from the Loremaster",
            "details": str(e),
        }), 500

__all__ = ['chat', '_chat_viewer']
