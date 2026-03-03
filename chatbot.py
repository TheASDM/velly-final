#!/usr/bin/env python3
"""
Step 2 — Terminal chatbot using tier1 context files.

Usage:
    python3 chatbot.py --mode player   # player-safe knowledge only
    python3 chatbot.py --mode dm       # full knowledge including spoilers
"""

import argparse
import os
import sys
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Missing dependency. Run: pip install anthropic")
    sys.exit(1)

ROOT = Path(__file__).parent

TIER_FILES = {
    "player": ROOT / "tier1_player.md",
    "dm":     ROOT / "tier1_dm.md",
}

SYSTEM_HEADER = """\
You are the Loremaster, a knowledgeable guide for the Vallombrosa campaign — a D&D 5e game set in a \
dark romantasy version of Renaissance Venice called Venturia. The city sits at the edge of a fey \
prison called the Reverie Solenne, whose slow collapse is causing strange phenomena throughout the city.

{mode_note}

Answer questions about the campaign world, characters, locations, factions, and rules. \
Be concise but evocative. If you don't know something from the provided context, say so rather than inventing details. \
Use the tone of a learned Venetian scholar — measured, precise, occasionally lyrical.

---
{tier_content}"""

MODE_NOTES = {
    "player": "You are speaking to a PLAYER. Do not reveal plot secrets, DM-only information, \
or anything marked [SPOILER] in the context below. Treat spoiler content as if you don't know it.",
    "dm": "You are speaking to the DUNGEON MASTER. You have full access to all campaign information, \
including spoilers, hidden NPC motivations, and plot secrets. [SPOILER] content is fair game.",
}


def build_system_prompt(mode: str) -> str:
    tier_file = TIER_FILES[mode]
    if not tier_file.exists():
        print(f"Error: {tier_file.name} not found. Run build_tiers.py first.", file=sys.stderr)
        sys.exit(1)
    tier_content = tier_file.read_text(encoding="utf-8")
    return SYSTEM_HEADER.format(mode_note=MODE_NOTES[mode], tier_content=tier_content)


def chat(mode: str) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    system_prompt = build_system_prompt(mode)
    history: list[dict] = []

    mode_label = "Player Mode" if mode == "player" else "DM Mode (Full Access)"
    print(f"\n=== Loremaster Chatbot — {mode_label} ===")
    print("Type your question. Commands: /quit to exit, /clear to reset history.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nFarewell.")
            break

        if not user_input:
            continue
        if user_input.lower() in ("/quit", "/exit", "quit", "exit"):
            print("Farewell.")
            break
        if user_input.lower() == "/clear":
            history.clear()
            print("[History cleared]\n")
            continue

        history.append({"role": "user", "content": user_input})

        try:
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=1024,
                system=system_prompt,
                messages=history,
            )
            assistant_text = response.content[0].text
        except anthropic.APIError as e:
            print(f"API error: {e}", file=sys.stderr)
            history.pop()  # remove the user message that failed
            continue

        history.append({"role": "assistant", "content": assistant_text})
        print(f"\nLoremaster: {assistant_text}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Vallombrosa Loremaster chatbot")
    parser.add_argument(
        "--mode",
        choices=["player", "dm"],
        default="player",
        help="player = no spoilers; dm = full access (default: player)",
    )
    args = parser.parse_args()
    chat(args.mode)


if __name__ == "__main__":
    main()
