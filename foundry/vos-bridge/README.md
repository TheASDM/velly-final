# Vallombrosa Bridge

A Foundry module that pushes character statblocks to the Vallombrosa app, so a
player can open `/sheet/` on their phone and see what Foundry says.

## Why it pushes instead of the app pulling

Foundry computes AC, max HP, every ability modifier, every skill total and the
spell save DC at runtime and throws them away on export — `toObject()` gives you
`ac: {calc: "default"}` with no number and `hp.max: null`. This module reads
those values off the *prepared* actor, so the app displays Foundry's own numbers
and never reimplements 5e's arithmetic.

It is also the only direction that works. The app's server cannot open a
connection to the Foundry host; Foundry can reach the app. Everything here is
outbound.

## What it is not

- **Nothing listens.** No port is opened on the Foundry host.
- **Nothing writes back.** The app cannot change actors. This is deliberate —
  an unauthenticated `actor.update()` path is how you lose character data with
  no undo.
- **Not a server process.** Foundry module code runs in the browser, so pushes
  happen while a GM has Foundry open. Between sessions the app serves the last
  push.

## Install

The module lives in `Data/modules/vos-bridge/` on the Foundry host. To update it:

```bash
scp foundry/vos-bridge/* foundry:/home/foundry/foundryuserdata/Data/modules/vos-bridge/
```

Foundry reads module files at world load, so reload the browser after copying.

## Set up (once, in your browser)

1. **Game Settings → Manage Modules**, tick **Vallombrosa Bridge**, save. The
   world reloads.
2. **Game Settings → Configure Settings → Vallombrosa Bridge**, and fill in:
   - **App URL** — the app's base URL, no trailing path.
   - **Ingest token** — must equal `STATBLOCK_INGEST_TOKEN` in the app's `.env`.
   - **Push on change** — leave on.
3. **Push all characters → Push now** to send everyone for the first time.

These are *client-scoped* settings: they live in the browser you type them into
and are never sent to players. That matters — world-scoped settings replicate to
every connected client, so a token stored there would be readable from any
player's console.

## How pushes happen

- The GM's browser watches `updateActor` and the item hooks (items are the
  features, spells and inventory on the sheet).
- Changes are debounced ~2.5s, so dragging an HP bar sends one push, not thirty.
- Only the GM pushes. Every client sees the same hooks; without that guard five
  browsers would race to push the same character.
- Only player-owned `character` actors are pushed. An NPC is refused by the app
  with a 422, which the module treats as normal and stays quiet about.

## Checking it works

Foundry's console (F12) logs each push:

```
vos-bridge | pushed Car -> Caravel "Car" Asteri
```

From the Foundry host, the endpoint can be exercised directly:

```bash
curl -s -X POST https://<app>/api/statblocks/ingest \
  -H "Authorization: Bearer $STATBLOCK_INGEST_TOKEN" \
  -H 'Content-Type: application/json' \
  --data @statblock.json
```

Expected replies:

| Status | Meaning |
|---:|---|
| `200` | Stored. Body names the roster player it mapped to. |
| `401` | Token missing or wrong. |
| `422` | Actor name is not an active roster player (usually an NPC). |
| `400` | No `derived` block, or an export version the app does not know. |
| `413` | Larger than `STATBLOCK_MAX_BYTES`. |
| `503` | `STATBLOCK_INGEST_TOKEN` is unset on the app — ingest is closed. |

## Name mapping

The app maps the Foundry actor name onto a roster name using the same aliases as
sign-in, so `Car` resolves to `Caravel "Car" Asteri`. An actor whose name does
not resolve to an active player is refused rather than stored where nobody can
read it. Revoked players are refused too — a push cannot undo a revocation.

Rename an actor in Foundry and its pushes stop matching; either rename it back or
add the alias in `LOGIN_NAME_ALIASES` (`chatbot/vos/config.py`).
