---
title: Vallombrosa — Vision for v2
description: A design doc for what Vallombrosa becomes if you keep its best instincts and let them compound.
published: false
date: 2026-05-27
---

# Vallombrosa v2 — Vision

You've built five things that are unusually good:

1. **A wiki with a soul.** Frontmatter is consistent, breadcrumbs are correct, DM and player content cleanly partitioned, and Submit Lore lets players *contribute* to the canon instead of just reading it.
2. **A RAG chatbot that actually knows your campaign** — not a generic assistant.
3. **An art generator with named-entity grounding.** "Caravel on the bridge" works, and that's rare.
4. **A DM-controlled news layer** (push messages, in-play, next session).
5. **A real ownership model.** Identity, DM mode, player roster — all live concepts in the app, not just static text.

Everything in this doc is a way to **make those five things compound**. Nothing here exists for its own sake; each addition either feeds the corpus, makes the table smoother, or makes a player feel more like a co-author.

---

## The organizing principle

> **The campaign is the database. Every feature is a lens onto it.**

Today you have five lenses (Home, Calendar, Wiki, Studio, Enzo). Keep them — the mental model works. What changes is that **every lens both reads from and writes to the same canon**:

- A session recap published in Calendar → becomes a wiki page → becomes searchable in Enzo → can be cited by Enzo with a link → can spawn a player journal entry → can prompt new lore submissions.
- An image generated in Studio → tagged with grounded entities → appears on those entities' wiki pages → appears in Home's "Latest from the Atelier" → can be referenced in Enzo answers.
- A player journal → optionally promoted to canon → enters Submit Lore queue → DM approves → it's in the vector store next rebuild.

This is the loop. Everything below either tightens the loop or makes a turn around it feel better.

---

## The five lenses, reimagined

### 1. **Home** → **The Pavilion**
*"What's going on right now?"*

Keep the next-session card, DM messages, and gallery carousel. Add:

- **The Threads strip.** Today `inPlay` is a static list of characters in play. Promote it: each Thread is a card with a one-line **stake**, a **last update** date, the **PCs entangled**, and a **link to its wiki anchor**. When a thread resolves, it gets a Resolved badge and slides down. This is the single highest-impact addition — it gives the campaign a *visible state*.
- **The Wake** — an in-character rumor feed. Players post short attributed lines ("Heard at the Salted Cup: the di Errante family is hiring again"). Costs nothing, feels alive between sessions. Auto-decays after 14 days unless DM pins.
- **A "Previously on..." card** above the next session: 3 sentences synthesized by Enzo from the most recent Chronicle, with optional 30-second audio voice-over (TTS). One tap, you remember where the table left off.
- **Quick RSVP inline** (the audit already flagged this — folding it into Home means players never bounce to Calendar for a single click).
- **A "DM is online" presence dot.** Trivial; emotionally meaningful before a session.

### 2. **Calendar** → **The Ledger**
*"What's scheduled, what happened, what's next."*

Today Calendar is "the next RSVP." It can be the table's memory.

- **A real session list** with three states per row: *Scheduled* (RSVP), *Live* (open the DM Screen), *Played* (Chronicle published).
- **Chronicles**, not session notes. The DM dictates or pastes bullets after a session; Enzo writes a 400-word in-voice recap; DM edits; it publishes to the wiki and back-fills the Thread cards' "last update" lines automatically.
- **Calendar of Venturia** — the *in-world* calendar (festivals, full moons, faction holidays). Sits alongside the real-world session calendar. Drives RAG context when a player asks Enzo "what time of year is it?" and tinges Home with seasonal cues.
- **Downtime planner.** Between sessions: each player picks a downtime activity (research, train, schmooze with faction X). DM responds with an outcome. Outcomes become micro-Chronicles. This is how you keep a campaign alive between play nights without forcing a Discord debrief.
- **Reminders that actually fire** (the audit caught that `data-reminder-date` is unwired).
- **iCal export and a countdown** — small, but they remove friction at the moments people are deciding to show up.

### 3. **Wiki** → **The Codex**
*"Everything we know about Venturia."*

The Codex is already strong. The upgrades are about making it *converse* with the player.

- **Semantic search** beside Pagefind. You already have the embeddings — let the search bar take a *question* ("who saved Marcello?") and return wiki pages ranked by meaning, with Enzo's one-sentence summary above the results.
- **Character sheets, lightweight.** Each PC gets a sheet linked from their wiki entry: HP, AC, abilities, current inventory, recent feats. Not a VTT — just a "what I need to see at the table" surface. Pull from a small per-PC JSON in `_data/sheets/`.
- **Inventory & shared loot.** A second small per-PC list plus a Party Loot ledger. Items can be `[[wiki-link]]`s to Items entries — so the Listener's Coin in the loot pile shows the same lore as the Items page.
- **Faction reputation tracker.** A small dashboard per faction (Autumn Council, College of the Masquerade-Bard, etc.) with a numeric standing, an in-character one-liner ("They will hear you out, but watch your hands"), and the events that moved the needle. DM edits; everyone sees.
- **The Atlas.** Promote the maps in `Venturia/Maps/` into a proper fog-of-war viewer. The DM marks regions as Discovered after a session. Players only see what they've been to. This rides on top of the existing `map-viewer.njk`.
- **Promote Submit Lore.** A tile on the Codex index, a chip on Home, and the player's recent submissions in their own profile sheet. Right now it's hidden; it should feel like a *flagship*.
- **Add rejection feedback + batch ops + a player-visible status timeline** to the submission flow (audit S2). When a submission is rejected, the player sees the DM's note and a "Revise" button — same UI, prefilled.

### 4. **Studio** → **The Atelier**
*"Make the campaign visible."*

Studio is your most distinctive feature. Make it the place where players generate *anything* visual.

- **The reference pickerr.** A typeahead pulled from `descriptions.json`. Type "the" → "the Echoing Court / the Salted Cup / the Listener's Coin." Removes the entire "did I spell that right?" friction.
- **Token mode.** A preset that frames a single character in a circular crop, lit from above, ready to drop into a VTT or a portrait card. One click from the Characters wiki entry.
- **NPC voice cards.** TTS samples for major NPCs — 8 seconds of "this is what Marcello sounds like." The DM picks a voice once; it gets baked into the NPC's wiki entry. Massively helps the DM remember.
- **Map regions.** Generate a stylized region card (Venice-like skyline of Venturia at dusk) and tag it to a location entry. The Codex Atlas uses these as region thumbnails.
- **Quota + per-style throttling** (audit S1). 30 free generations a month is plenty; cap and surface the count.
- **"Pin to wiki."** After generation, the player can suggest the image be added to a specific wiki entry. DM approves in the same queue as Submit Lore. This is how the wiki becomes lavishly illustrated without you doing it.
- **Group portraits.** A preset that grounds *multiple* PCs together with a scene prompt — "the party at the Salted Cup, raining outside." Builds party identity.

### 5. **Enzo** → **The Loremaster**
*"Ask anything."*

Enzo is solid. The upgrades are about trust, speed, and reach.

- **Citations** (audit S3). Each answer ends with chip-shaped sources: `Caravel (92%) · Echoing Court (81%)`, linking into the wiki. Closes the trust gap.
- **Streaming responses** (audit S3). Perceived latency drops 5x with no model change.
- **Voice mode.** Push-to-talk button. STT → Enzo → TTS. *This is what makes Enzo useful at the table* when nobody wants to type. Open a panel, hold the button, ask "what does the Listener's Coin do?", hear the answer in 4 seconds.
- **`/lookup` quick chips** below the input — Spells, Monsters, Items, Conditions. Tap, type a name, get a card instead of a chat answer. Same backing data, different UI surface. Faster at the table.
- **Proactive nudges (opt-in).** Once a week, Enzo posts "I noticed nobody's followed up on the di Errante hook in three sessions — want to pin it as a Thread?" to the DM only. Light, dismissable, valuable.
- **DM Loremaster mode.** When the DM toggles in (with a real server-enforced token — audit S1), Enzo gains a second tool: `draft_scene(prompt)`. The DM types "scene where Marcello betrays Caravel in the rain"; Enzo returns a 200-word scene draft in voice. Not for production — for the DM's pocket between sessions.
- **Conversation export.** Any chat → save to a player's journal → optionally promote to lore submission.

---

## New surfaces (small, high-yield)

### **The DM Screen**
The current [dm.md](dm.md) at 1,073 lines wants to be a real surface, not a markdown wall. Recompose it as a tab visible only when the DM is authed:

- **Inbox** — submissions, journal-to-lore promotions, image-to-wiki pins, all in one queue with batch actions.
- **Live mode** — initiative tracker, monster cards from `5e-filtered/bestiary-*.json`, fog-of-war map, NPC voice cards, a private Enzo panel for DM Loremaster mode. This is the only surface that should ever load *during* a session.
- **Quill** — write a DM message (group or per-player), draft a Chronicle, set the next session, mark a Thread resolved, change faction reputations.
- **Mirror** — a read-only view of what each player sees. Catches accidental DM-info leaks before they happen.

### **Player Profile**
Tap the avatar in the app bar → a full profile page:

- PC sheet, inventory share, faction reputation
- "My submissions" with status timeline
- "My journals" — private (DM-readable) and shared
- "My art" — gallery filtered to this player
- Notification preferences (per channel: messages, RSVPs, threads, recap-ready)

### **Onboarding**
Right now identity is "type your code." For a new player, that's a cliff. Add a one-screen guided onboarding: pick your PC → grant push → see what each tab does in a 4-slide tour → land on Home with a "Previously on..." card waiting for them.

---

## The data model that makes this work

Everything above runs on three tables you don't have yet (plus a few you already have):

| Table | Why it exists |
|---|---|
| `threads` | The Threads strip on Home and the Resolved badge. `{id, title, stake, status, pc_ids[], wiki_anchor, last_update_at}` |
| `chronicles` | Per-session recap. `{id, session_id, body_md, generated_by, published, pinned_image_url}` Stays out of `Venturia/` until published, then mirrors as a wiki page. |
| `journals` | Per-player journal entries. `{id, player, body_md, private, promote_state}` Promotion routes through the existing Submit Lore queue. |
| `quotas` | Studio (and Enzo, eventually). `{player, month, generations, tokens_in, tokens_out}` |
| `factions` | Reputation tracker. `{slug, standing, line, updated_at}` |
| `events_inworld` | Venturia calendar — separate from `events` (sessions). |
| `discoveries` | Atlas fog-of-war. `{region_slug, party, discovered_at}` |
| `pins` | "Pin to wiki" image-to-entry suggestions, mirroring lore submissions. |

All SQLite. No new infra.

---

## What to remove or fold

Honesty is part of perfect. Some things shouldn't survive the rewrite:

- **The `descriptions.json` flat file** moves into the wiki. Each character entry's frontmatter gets a `studio:` block (`{ appearance, voice, palette }`). The Studio fetches it at build time. One source of truth instead of two.
- **The hardcoded `PLAYERS` list** in [pwa-client.js:8](pwa-client.js#L8) moves to `_data/players.json` (audit caught this).
- **`inPlay` in `_data/campaign.js`** becomes the `threads` table.
- **`Tools/art.md` at 1,819 lines** becomes a normal page + an external JS module. It's the same surgery the audit prescribed for `page.njk`.
- **DM mode as a client-controlled toggle** dies. Replaced by a DM token issued from the identity flow.
- **Any "version 2" Finder duplicates** (`* 2.json`, `* 2.png`, `*.bak`, `files.zip`) are out.

---

## The aesthetic stays
Don't redesign the look. The Venetian-gothic palette, Cinzel headers, IM Fell English italics, the gold-on-near-black — that's the brand. Every new surface inherits the existing CSS vars from a real `app-shell.css` (post-refactor) and stays inside the same visual language. The wins above are *structural and behavioral*, not visual.

---

## A 6-month arc

You don't have to build all of this. If you built it in this order, each step would already make the app feel substantially better than the last:

**Month 1 — Foundations.** Refactor `page.njk` into a real shell. Server-enforced DM token. Quotas. Rate limits. Prompt caching. Pagefind + semantic search side by side.

**Month 2 — The Loop.** Threads (replaces `inPlay`). Chronicles (replaces ad-hoc Session-Chronicles). Submit Lore promoted + rejection feedback + batch approval. Citations and streaming in Enzo.

**Month 3 — The Player.** Profile page. Lightweight PC sheets + party loot. RSVP-on-Home. Reminders that actually fire. Studio reference picker + token mode.

**Month 4 — The Table.** DM Screen with initiative + monster cards + private Loremaster. NPC voice cards. Voice mode in Enzo. Map fog-of-war.

**Month 5 — Between Sessions.** Downtime planner. Faction reputation. The Wake (rumor feed). Player journals + promote-to-lore.

**Month 6 — Polish.** "Previously on..." cards with TTS. Onboarding flow. Group portraits. Proactive Enzo nudges. iCal export. In-world calendar.

At the end of six months Vallombrosa isn't a campaign wiki with a chatbot bolted on — it's a **table operating system**, with a wiki, a chatbot, an art studio, and a session ledger all sharing one canon. There isn't anything else like that out there, and the parts you've already built are the hard parts.

---

## The single most important principle

> **Nothing exists in this app that doesn't feed the canon.**

Every message, every image, every journal, every rumor, every recap — they all live in the same world, in the same database, and they all end up retrievable by Enzo. That's what makes Vallombrosa worth the effort over an off-the-shelf tool. Protect that.
