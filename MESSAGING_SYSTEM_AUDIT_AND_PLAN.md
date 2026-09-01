---
permalink: false
eleventyExcludeFromCollections: true
---

# Messaging System Audit and Remediation Plan

Status: Phases 1 and 2 complete; Phase 3 synchronization is next
Audit date: 2026-08-31  
Audited revision: `f4c86e4` locally and in production

## Phase 2 completion — 2026-09-01

The durable-contract and client-core phase is implemented. The release adds
immutable seat identities, opaque conversation IDs, authoritative membership
rows, and a compatibility migration that backfills the existing name/key
columns without breaking older installed clients. API responses now carry both
contracts during the cache handoff.

The browser now has a normalized per-thread store, a command/controller layer,
an identity-scoped durable outbox, complete retry intent, stale-update guards,
thread-bound asynchronous completions, deep-history reply snapshots, and
authenticated attachment blobs whose object URLs are revoked on delete and
logout. Sends remain idempotent across ambiguous retries.

Release validation was performed from a clean worktree containing only the
messaging changes: 282 backend tests and 11 browser unit tests passed, JavaScript
lint passed, the complete 354-page site build passed, and `git diff --check`
passed. A content-blind integrity checker was added for migration rehearsal and
production verification; it reports schema, foreign-key, identity-backfill, and
relationship consistency without reading message bodies.

## Executive verdict

The messaging system has a strong product shape and a better-than-average
server-side security baseline. Sender identity is derived from signed
credentials, thread membership is checked on every route, direct player
threads are hidden from an ordinary DM credential, message text is rendered
through the safe-markdown path, and uploaded images are decoded rather than
trusted by MIME type. The SQLite database is healthy and the backend suite is
green.

The bugs are concentrated in a different layer: client lifecycle and delivery
semantics. `panel.js` is a 1,446-line stateful component that combines thread
selection, polling, rendering, drafts, uploads, optimistic sends, read state,
typing, receipts, Enzo streaming, and responsive behavior. Several asynchronous
operations mutate whichever thread happens to be open when they finish rather
than the thread that started them. The system also clears unread state when a
message is fetched rather than when it is actually seen, has no idempotency key
for retries, waits on push-provider network calls before acknowledging a normal
send, and has no browser-side tests.

The right fix is not a cosmetic pass. First contain the privacy and message-
truth bugs, then introduce a small per-thread client store and idempotent server
contract, then consolidate synchronization and notifications. Once that core is
sound, the existing visual design can be polished instead of continually
fighting state races.

## Audit scope and evidence

Reviewed end to end:

- Client entry, lifecycle, state, panel, bubble, composer, uploads, badge, and
  full-page/overlay mounts under `src/js/chat/`.
- Messaging CSS and app-shell integration in
  `src/css/app-shell/chat.css` and `_includes/layouts/page.njk`.
- Flask routes for threads, messages, Enzo, reactions, reads, typing, presence,
  mute state, attachments, push, profiles, preview auth, and logout.
- SQLite migrations and indexes for messages, reads, reactions, typing,
  presence, and attachments.
- Service-worker push delivery and notification-click behavior.
- All messaging-specific backend tests, route smoke coverage, and JavaScript
  lint.
- Current production revision, container health, aggregate messaging database
  health, and recent error signatures. No message bodies or other player-written
  content were read.

Validation results:

- `npm run lint:js`: pass.
- Messaging/backend selection: 73 tests passed.
- Production and local revision: both `f4c86e4`.
- Production containers: healthy; `/health` returned `ok`.
- Production SQLite integrity: `ok`.
- Current aggregate data: 43 messages, 11 read rows, 2 reactions, 1 attachment.
- The one unclaimed attachment is not stale; there are no future read pointers,
  reactions on deleted messages, or attachments linked to deleted messages in
  the current production data.
- No matching Flask traceback, database-lock, Enzo-stream, or IM-push error was
  present in the sampled six-hour application log.
- One transient `GET /api/im/threads` 502 occurred while the API container was
  restarting during deployment. The client silently recovered later.
- In the most recent 300 messaging access-log lines, 267 were
  `GET /api/im/threads`; the system is already dominated by heartbeat polling
  at only six seats.

Limitation: the in-app browser was unavailable in this environment, so a
signed-in visual/touch walkthrough could not be performed. iPad Safari visual,
keyboard, focus, and screen-reader validation is therefore a mandatory plan
gate, not an audit claim.

## Current system map

```text
app shell
  -> global unread heartbeat (GET /api/im/threads every 25s)
  -> overlay or /messages/ page
       -> one large mutable panel
            -> thread list
            -> selected-thread poll (GET /api/im/thread/... every 4s)
            -> optimistic sends / edits / reactions / reads / typing
            -> attachment pre-uploads
            -> Enzo fetch-SSE stream

Flask
  -> credential-derived caller + derived thread membership
  -> SQLite messages / reads / reactions / typing / presence / attachments
  -> synchronous web-push fan-out after a normal message is committed

service worker
  -> always displays an arriving push as a system notification
  -> then tells open windows to refresh
```

The main architectural problem is visible here: there are two global pollers,
one mutable selected-thread view, and several independent async mutation paths,
but no authoritative client store or operation identity tying a completion back
to its originating thread.

## What should be preserved

These decisions are sound and should survive the rewrite:

- The same conversation component powers both the overlay and `/messages/`.
- The server, not the browser, derives sender identity and membership.
- Ordinary DM credentials cannot open player-to-player direct threads.
- Enzo is a pseudo-member in a private direct thread, not a party-channel bot.
- Bodies remain plain text with safe markdown, not arbitrary HTML.
- Deletion is visible as a tombstone rather than silently collapsing history.
- Reactions are allow-listed.
- Files are validated by magic bytes plus real image decode and a pixel cap.
- Attachment reads are membership-gated and PDFs are downloads, not inline
  active documents.
- SQLite WAL, per-operation connections, and bounded transactions are entirely
  appropriate for a six-person table.
- Push, installed-app badges, drafts, receipts, typing, and presence are useful
  features; they need firmer semantics rather than removal.

## Findings, ordered by severity

### P0 — Privacy, message truth, and data-loss risks

#### P0.1 Preview mode defeats the stated private-thread boundary

The messaging route refuses an ordinary DM token on player-to-player threads,
but preview mode mints a token that is the selected player. Messaging routes do
not distinguish that preview credential from the player's real credential.
Consequently a DM preview can read the player's direct and Enzo history, send
new messages, edit or delete the player's messages, react as the player, change
mute/read state, and retrieve the player's attachments.

This is not an accidental test gap: `test_preview.py` explicitly states that a
preview token opens every player door. That policy conflicts with the messaging
module's promise that player direct channels are theirs and the DM is not a
member.

Recommended policy: preview should never expose private messages or act as the
player in messaging. The least surprising behavior is to hide/disable the chat
door in preview and return `403 preview_forbidden` from all IM mutation routes
and private-thread reads. If support impersonation is intentionally retained,
the product must disclose it to players, make preview messaging read-only by
default, and audit every access and mutation. Silent impersonation should not
remain the policy.

Acceptance criteria:

- A preview token cannot read or mutate a player-to-player or Enzo thread.
- The chosen party-thread preview behavior is explicit and tested.
- The messaging button clearly states why it is unavailable in preview.
- Ordinary player and DM membership tests still pass.

#### P0.2 Logout and identity switches do not purge chat state

The panel caches `playerName`, thread data, and rendered messages after boot.
Logout removes auth storage but does not close or reset the panel. The chat
module listens for `vos:identity-ready`, an event that is never dispatched,
while the actual identity event is `vos:identity`. `syncBadge()` returns early
when no player exists and therefore leaves the old unread count painted.

Drafts, the last open thread, and scroll positions use one session-wide storage
key rather than an identity-scoped key. On the same tab, a subsequent player or
the DM returning from preview can inherit another seat's draft/open-thread
state. Even if the API correctly rejects new requests, already-rendered private
messages remain in the DOM.

Required fix:

- Define one canonical `vos:identity-changed` event with old and new stable seat
  IDs.
- Add `chatController.resetForIdentity()` that aborts active work, clears all
  entities and DOM, revokes blob URLs, stops typing/polls/streams, closes the
  overlay, and zeros every badge.
- Namespace drafts, scroll, and open-thread state by stable seat ID.
- Purge the old seat's ephemeral state on logout; do not reveal it after a
  switch.

Acceptance criteria:

- Logging out with a private thread open immediately removes every message and
  unread badge before the logout request completes.
- Logging into a different seat in the same tab cannot reveal the previous
  seat's thread, draft, scroll bookmark, attachment preview, or pending send.
- Entering and leaving preview cannot mix the DM and player stores.

#### P0.3 An Enzo response can render in the wrong conversation

`deliverToEnzo()` correctly checks the originating thread before replacing the
optimistic user bubble, but token and final-message handlers append to the
shared `messagesEl` and advance the shared `lastId` without the same guard. If a
user asks Enzo, switches threads, and the stream continues, tokens or the final
answer can appear in the newly opened human thread and corrupt its incremental
cursor.

The same lifecycle has weak behavior when the overlay closes, identity changes,
or a network stream dies after the server has stored the user's message.

Required fix:

- Give every open operation `{threadId, operationId, generation, kind}`.
- Route stream events into that thread's store, never directly into the current
  DOM.
- Render only the store selected by the current view.
- Detach a stream from the view on thread switch; abort it on logout or explicit
  cancel.
- Pass thread kind into `deliver()` rather than consulting mutable `openKind`.
- Reconcile the originating thread after a stream interruption.

Acceptance criteria:

- Rapidly alternate Enzo, Party, and a direct thread while tokens are arriving;
  no bubble, cursor, typing row, status, or unread state crosses threads.
- Closing and reopening the panel during a reply reconstructs the correct
  server state.
- A stream failure after the `sent` event does not mark a detached optimistic
  bubble or invite a duplicate resend.

#### P0.4 Fetching is incorrectly treated as reading

Every poll that returns messages calls `markRead()` through the newest fetched
ID. That occurs even when the user is scrolled far above the bottom. Initial
thread open fetches and marks everything read before restoring the saved scroll
position. The result is false “Seen” receipts and unread counts disappearing
for messages the player has not viewed.

The server also trusts an arbitrary client-supplied `lastReadId`. A modified
client can submit an ID beyond the thread's maximum and suppress all future
unread messages because read pointers only move forward.

Required fix:

- Separate delivered, rendered, visible, and read states.
- Advance the pointer only to the highest incoming message actually intersecting
  the visible message viewport while the document and panel are visible.
- Do not mark a below-the-fold arrival read; show a “N new messages” jump
  affordance instead.
- Restore scroll before establishing initial intersections.
- On the server, verify/clamp the pointer to an existing message in that thread
  and never accept a future/global ID.

Acceptance criteria:

- A message arriving while the reader is scrolled up stays unread and is not
  reported seen.
- Scrolling it into view advances the pointer exactly once.
- A forged high read pointer cannot suppress a later message.
- Opening a saved mid-thread position does not clear unread state below it.

#### P0.5 Sends are not idempotent and the failure path loses payload

Normal sends commit the SQLite row and then synchronously call web-push fan-out.
The push worker waits for provider calls that can each block for up to 15
seconds. A committed message can therefore leave the sender showing “Sending…”
long enough to retry or navigate away before receiving the 201 response.

There is no client message ID or unique idempotency constraint. A timeout after
commit followed by retry produces duplicate messages. The client also clears
the draft, reply context, and attachment tray before the request succeeds. Its
retry deliberately drops reply and attachment IDs, so a failed send can become
a different message from the one the user composed.

Required fix:

- Generate a durable UUID for each composed message attempt.
- Add `client_message_id` and a unique constraint for the sender/thread tuple.
- Reposting the same ID returns the original message rather than inserting.
- Keep an identity-scoped per-thread outbox with the complete text, reply ID,
  attachment IDs, and state (`uploading`, `sending`, `sent`, `failed`).
- Move push delivery behind an outbox/job boundary so the message API returns
  as soon as its own transaction commits.
- Reconcile ambiguous network failures by client ID before offering retry.

Acceptance criteria:

- Drop the response after the server commits, then retry: exactly one message
  exists and its reply/files remain intact.
- A slow or failed push provider does not delay the message acknowledgement.
- Switching threads or closing the overlay does not lose an in-flight send.

#### P0.6 “Delete for everyone” does not revoke attachment URLs

Deleting a message hides its files from subsequent message JSON, but the file
route authorizes only by thread membership. Anyone who retained the attachment
URL can still retrieve it after deletion. That does not match the confirmation
copy “Delete this message for everyone?”

Required fix:

- Join the attachment to its message on read and return 404 when the parent is
  deleted.
- Choose and document physical retention: immediate file deletion after commit,
  or a short recoverability window followed by a sweeper. The API must revoke
  access immediately either way.
- Remove reactions from deleted messages or exclude them from sync payloads.

Acceptance criteria:

- Both original and thumbnail URLs return 404 immediately after parent delete.
- Restore/retention behavior, if any, is DM-operational only and not a member
  download path.

### P1 — Confirmed visible behavior defects

#### P1.1 Reactions from another user do not repaint

Each thread poll replaces the in-memory reactions payload, but existing bubbles
are redrawn only when a new or revised message is also present. A reaction-only
poll therefore changes data without changing the UI. The server simultaneously
returns reactions for the entire thread on every four-second poll, so this is
both stale and increasingly expensive.

Fix through change-sequenced reaction deltas and targeted entity repainting.

#### P1.2 Thread rows and other-thread unread state go stale while chatting

The selected thread poll does not refresh the thread list. A sender's own list
preview/order is not updated after send, and messages in other threads rely on
the 25-second global badge or a push message to trigger refresh. When push is
disabled, muted, or suppressed by presence, the open panel can remain visibly
stale.

The invalidation event wiring is also broken because `vos:identity-ready` is
never emitted.

#### P1.3 Push suppression can cause missed notifications

Any request that touches global presence marks a player “watching.” The server
then excludes that player from push recipients for 45 seconds. This does not
prove the relevant conversation is visible. Worse, when an iPad turns off or a
tab becomes hidden, its last presence remains fresh for up to 45 seconds while
all client polling has stopped. A message during that gap receives neither a
system push nor a live poll.

The server comment says the four-second poll will show the message, but that is
true only when the exact thread is open. A visible wiki page uses the 25-second
badge heartbeat instead.

Recommended model: always deliver eligible push payloads to subscribed devices.
The receiving service worker should check its own visible windows: post an
in-app sync nudge without a system banner when a client is visible, and show the
notification when none is visible. Server-side presence should describe human
activity, not decide device notification delivery.

#### P1.4 Editing temporarily removes attachments and loses failed edit text

The PATCH response serializes the updated message without loading its
attachments. The client replaces the complete cached message, so files vanish
until a later poll restores them. The client exits edit mode and restores the
old draft before the PATCH succeeds; a failed edit discards the corrected text.

Return a canonical complete message entity from every mutation and keep edit
context until acknowledgement.

#### P1.5 Attachment-only failure states can enable a no-op Send button

The composer treats any tray entry, including an upload that failed, as a file
worth sending. With only failed chips and no text, Send is enabled but submit
silently does nothing because no ready attachment IDs exist. `tray.hasReady`
already exists and is not used.

#### P1.6 The advertised 10 MB file limit is lower in practice

nginx caps the entire multipart request at 10 MB while the application permits
a 10 MB file before multipart overhead. Near-limit uploads are rejected by
nginx before Flask can return the intended JSON error. Raise the proxy body
limit slightly above the application file cap and keep 10 MB as the single
user-facing limit.

#### P1.7 Attachment writes are not atomic with metadata

The original and thumbnail are written before the database row is inserted. A
database failure can leave a file with no row, which the row-based orphan sweep
can never discover. Duplicate attachment IDs in one crafted send are also not
rejected before claim.

Write to a temporary path, insert metadata, atomically rename after commit, and
clean up every exception path. Reject duplicate IDs and add a filesystem-versus-
database reconciliation check to maintenance diagnostics.

#### P1.8 Private attachments fail in DM preview for a second reason

Message JSON is fetched with the preview bearer token, but plain `<img src>` and
PDF links cannot attach that header and instead send the browser's DM auth
cookie. The file route correctly rejects the DM from the player's private
thread, so preview can list a player's message but fail to render its file.

If preview messaging is disabled as recommended, this disappears by policy.
For normal authenticated rendering, fetch private files as blobs with the
canonical auth headers and revoke object URLs on teardown; do not put bearer
tokens in query strings.

#### P1.9 History stops at the latest 200 messages

The initial GET returns only the newest 200 and there is no older cursor or
load-on-scroll path. A reply to an older, still-existing message renders as
“Message removed,” which is factually wrong.

Add `before_id`, `has_more`, and stable reverse pagination. Fetch an out-of-page
quoted entity on demand or return a compact quote snapshot with the reply.

#### P1.10 Enzo's single-flight protection is process-local

Production uses two Gunicorn workers, but `_enzo_in_flight` is an in-memory set.
Two requests landing on different workers can both start. Its three-minute
lease can also expire while the five-minute proxy timeout still permits the
original stream to run.

Use a SQLite lease keyed by stable seat ID with an owner token and expiry,
acquired transactionally and released in `finally`. Align the lease, model, and
proxy timeouts.

### P2 — Structural and scale risks

#### P2.1 The client needs a store/controller boundary

The current panel owns too many responsibilities and shares thread-specific
variables globally. Split it into:

- `chat-store`: normalized threads, messages, reactions, receipts, presence,
  drafts, outbox, and per-thread cursors.
- `chat-controller`: auth lifecycle, sync lifecycle, commands, idempotent sends,
  and operation cancellation/generation checks.
- `thread-list-view`, `thread-view`, and `composer-view`: DOM projection only.
- `chat-api`: typed/canonical payload parsing with abort signals and consistent
  error metadata.

A reducer-style store is enough; no framework migration is required.

#### P2.2 Polling returns too much and still misses changes

Every open-thread poll returns the complete reaction map, typing, receipts, and
presence. Two independent loops request overlapping thread information. Poll
responses can overlap with focus, service-worker, and manual refreshes; older
responses can overwrite newer reactions/receipts. Errors are mostly swallowed,
so stale state looks current.

Introduce one monotonic change cursor. The recommended small-scale design is a
SQLite-backed `chat_events` feed written in the same transaction as each
message/reaction/edit/delete/read/typing change, exposed over the existing
authenticated fetch-SSE parser with an adaptive polling fallback. Because the
feed is database-backed, both Gunicorn workers observe the same sequence. A
reconnect supplies its last sequence and deterministically catches up.

Do not introduce WebSockets or a new infrastructure service for six users.

#### P2.3 Names are database and thread identifiers

Direct-thread keys contain sorted display names and a delimiter. Renaming or
removing a roster seat can orphan its conversation history and attachment
access. A new party member automatically inherits the entire historical party
thread, while a removed member immediately loses it; neither policy is modeled
as membership history.

Add immutable seat IDs to `_data/players.json` and use opaque thread IDs plus a
`chat_thread_members` table. Keep names as display metadata. Explicitly decide
whether party membership grants full history or only messages after `joined_at`.

#### P2.4 There is no client reliability or interaction test layer

The 73 passing tests validate Flask well but cannot detect cross-thread stream
bleed, false read receipts, logout DOM leakage, stale reactions, failed upload
chips, focus behavior, or iPad keyboard regressions. There are currently no
tests importing `panel.js` or exercising it in a browser.

#### P2.5 Errors and delivery latency are largely invisible

Badge, poll, typing, avatar, and refresh failures are deliberately swallowed.
There is no correlation from client message ID through DB commit and push job,
no send latency metric, and no durable view of failed push work. A quiet stale
panel is indistinguishable from a quiet conversation.

### P3 — UX and accessibility gaps to validate visually

- Mobile overlay behavior lacks a focus trap and explicit focus restoration.
- The same root is `role="dialog"` even on the full messages page; semantics
  should differ by mount.
- The listbox contains button/options while the pinned Party and Enzo controls
  sit outside its keyboard model.
- A below-the-fold arrival shows only an arrow, not how many new messages are
  waiting.
- Poll/reconnect failure has no visible “reconnecting” or stale-state treatment.
- Uploads have states but no progress or cancellation.
- The 4 KB server byte limit and 4,000-character textarea limit disagree for
  emoji and other multibyte input.
- Date/time grouping, touch long-press, software keyboard insets, safe areas,
  rotation, split view, reduced motion, contrast, and VoiceOver announcements
  require real iPad Safari validation.

## Recommended implementation sequence

### Phase 0 — Freeze behavior with failing tests

Relative size: medium. Do this before refactoring.

1. Add server regression tests for:
   - preview messaging policy;
   - read-pointer clamping and cross-thread IDs;
   - deleted attachment URL revocation;
   - duplicate attachment IDs;
   - idempotent message creation;
   - canonical mutation responses retaining attachments;
   - multi-worker-safe Enzo lease behavior;
   - push failure never changing send success.
2. Add a lightweight browser-unit layer (Vitest plus a DOM environment) for
   store/controller lifecycle and pure view projection.
3. Add Playwright end-to-end fixtures with two isolated authenticated contexts
   and test-only short-lived tokens. Cover Chromium plus WebKit/iPad viewport.
4. Add deterministic network controls: delay, abort after commit, duplicate
   response, out-of-order poll, offline/reconnect, and slow upload.
5. Record the current happy paths before altering DOM structure.

Exit gate: every P0/P1 defect above has a failing automated reproduction or a
documented manual-only iPad/VoiceOver script.

### Phase 1 — Privacy and correctness containment

Relative size: medium.

1. Enforce the approved preview messaging policy on the server and UI.
2. Replace the dead identity event with one canonical identity-change contract.
3. Implement full chat teardown and identity-scoped session state.
4. Bind Enzo and normal delivery operations to their originating thread and
   operation generation.
5. Clamp server read pointers and stop marking fetched-but-unseen messages read.
6. Revoke deleted attachments and exclude deleted-message reactions.
7. Fix attachment-only send enablement, edit failure retention, and complete
   attachment-bearing mutation responses.
8. Raise nginx's multipart envelope above the application file cap.

Exit gate: all P0 privacy/message-truth tests pass, and no schema-breaking client
change has shipped yet.

### Phase 2 — Durable message contract and client core

Relative size: large; this is the central repair.

1. Back up production SQLite before migration.
2. Add immutable seat IDs and opaque thread IDs/membership rows, with a verified
   migration for all 43 current messages, reads, reactions, and attachments.
3. Add `client_message_id`, canonical `updated_at`, and appropriate uniqueness,
   foreign-key, and change-query indexes.
4. Make send idempotent and return the same complete message on replay.
5. Build the normalized per-thread store and controller; convert the current
   panel into views over that store without changing its visual language.
6. Add a durable outbox that retains text, reply target, attachments, and state
   across thread switches and transient failures.
7. Add older-history pagination and correct out-of-page reply handling.
8. Fetch private attachment blobs with canonical auth and explicit URL cleanup.

Exit gate: all mutations return canonical entities, every async completion is
thread-bound, offline/ambiguous retry is exactly-once, and a 300-message thread
is fully navigable.

### Phase 3 — Synchronization, presence, and notifications

Relative size: large.

1. Add the transactionally written, monotonic `chat_events` feed.
2. Add one authenticated fetch-SSE sync channel per visible signed-in client,
   with sequence resume, heartbeat, backoff, and adaptive polling fallback.
3. Remove the duplicate global/thread full-state polling loops after a measured
   compatibility period.
4. Emit targeted deltas for messages, reactions, reads, typing, presence, mute,
   and thread summaries.
5. Move web-push work to a durable SQLite outbox/dispatcher with attempts,
   next-attempt time, terminal state, and dead-subscription pruning.
6. Always deliver eligible push payloads to subscribed devices. Let each
   service worker choose live in-app nudge versus system notification based on
   its own visible clients.
7. Make presence a short visible-client lease and label older timestamps as
   “active recently,” not “online.” Do not use presence to suppress push.
8. Surface reconnecting/stale state without blocking composition.

Exit gate: reaction/edit/read/thread-list changes converge across two devices in
under two seconds on the sync path, reconnect resumes without duplication, and
push-provider latency is absent from the message-send critical path.

### Phase 4 — Make the interaction feel finished

Relative size: medium.

1. Turn the jump affordance into “N new messages” and advance read state only as
   those messages become visible.
2. Keep a clear per-message send state with retry/cancel details that do not
   alter the payload.
3. Add upload progress, cancellation, retry, and explicit failed-chip behavior.
4. Preserve reply/edit context through errors and thread changes.
5. Add focus management:
   - trap and restore focus for the mobile modal sheet;
   - keep desktop dock non-modal;
   - use page semantics, not dialog semantics, on `/messages/`;
   - make pinned and ordinary conversations one coherent keyboard model.
6. Tune live-region announcements so a reaction repaint does not reread the
   conversation.
7. Validate touch long-press versus scroll, keyboard resizing, orientation,
   split view, safe areas, reduced motion, contrast, and VoiceOver on a real
   iPad.
8. Remove dead announcement API helpers and correct stale design comments after
   behavior settles.

Exit gate: the manual device matrix and automated accessibility scan pass with
no known P0/P1 issue.

### Phase 5 — Compatibility rollout and production proof

Relative size: medium.

1. Ship the new server contract backward-compatible with the current installed
   PWA first. Do not remove old endpoints while stale service workers can still
   call them.
2. Bump `CACHE_VERSION` and the visible app build.
3. Enable the new client behind a server-controlled feature flag for the DM,
   then one player, then the table.
4. Observe send acknowledgement time, sync lag, reconnect count, duplicate
   prevention hits, push queue age/failures, and client reset events.
5. Exercise one deploy/restart while two clients are connected. The client must
   show reconnecting and catch up after the transient 502 without losing a
   draft or duplicating a send.
6. Remove the legacy polling/client path only after active installed clients
   have moved to the new cache version.
7. Run a post-migration integrity report and verify filesystem/attachment rows
   agree.

## Acceptance matrix

### Correctness

- Direct, Party, and Enzo messages always remain in their originating thread.
- Text, reply target, attachments, and sender identity survive timeout/retry.
- Duplicate submission of one client ID creates one server row.
- Reactions, edits, deletes, mute state, typing, and receipts converge across
  two live clients.
- Unread counts reflect messages actually viewed, not merely fetched.
- Older history and replies beyond 200 messages are accurate.

### Privacy and authorization

- Preview behavior matches the explicitly approved policy.
- Logout and seat switch purge all prior-seat DOM and ephemeral storage.
- Nonmembers learn nothing about private messages or attachments.
- Deleted attachment URLs are immediately revoked.
- Read pointers cannot reference a different thread or the future.
- Stable IDs preserve access and history through display-name changes.

### Reliability

- A push provider stalled for 15 seconds does not delay send acknowledgement.
- Losing a response after DB commit does not create a duplicate on retry.
- Server restart, tab sleep, iPad screen-off, and network changes converge after
  reconnect.
- Pending uploads and sends have honest recoverable states.
- Sync responses cannot regress a newer client state.

### Performance

- One visible client uses one incremental sync path rather than overlapping
  full thread-list and selected-thread polling loops.
- No request returns the complete lifetime reaction map without need.
- Query plans use thread/change indexes; a 1,000-message thread remains smooth.
- DOM nodes are patched by entity and are not rebuilt wholesale on heartbeat.

### Accessibility and iPad UX

- Mobile focus enters the sheet, stays within it, and returns to the opener.
- Desktop dock remains intentionally non-modal.
- Party, Enzo, and direct rows are all reachable and operable by one keyboard
  model.
- VoiceOver announces new messages and errors without rereading old content.
- Portrait, landscape, split view, software keyboard, paste, drop, file picker,
  long-press, and scroll-up/new-message behavior pass on iPad Safari.

## Test and release commands

The implementation should not ship until all of these are green:

```bash
npm run lint:js
npm run test:unit
npm run test:e2e
npm run clean && npm run build
for f in .eleventy.js sw.js scripts/build-js.mjs public/js/*.js; do node --check "$f" || break; done
(cd chatbot && python3 -m pytest tests/ -q)
git diff --check
```

Production proof should additionally include:

- current revision and `/health`;
- DB integrity and migration version;
- old and new client compatibility during the cache handoff;
- two-seat live exchange, edit, reaction, delete, and attachment;
- screen-off push and visible-client in-app delivery;
- restart/reconnect without duplicate or lost content.

## Product decisions required before implementation

These are the only decisions that materially change architecture. Recommended
defaults are included so work can proceed without reopening the entire design.

1. **Preview and private chat — recommended: no access.** Hide messaging in
   preview and reject IM routes for preview credentials. Alternative support
   impersonation requires disclosure, audit logs, and read-only default.
2. **Party history for a newly added seat — recommended: full campaign archive.**
   Model this explicitly in membership policy rather than inheriting it by
   accident from the current roster.
3. **Delete retention — recommended: immediate access revocation, physical file
   sweep after a short operational recovery window.**
4. **Realtime transport — recommended: database-backed fetch-SSE with polling
   fallback.** WebSockets and an external broker are unnecessary for this
   table size.

## Explicit non-goals

- No Slack/Discord-scale channel system.
- No new frontend framework solely for chat.
- No external realtime or queue service unless production evidence disproves
  the SQLite design.
- No end-to-end encryption claim; the server necessarily stores and serves
  messages to authorized members.
- No expansion of DM moderation access to private player threads without an
  explicit product-policy change.

## Definition of done

Messaging “sings” when it is boring under stress: the right message appears
once in the right thread; unread and seen mean what they say; switching seats
or logging out leaves no private residue; retries never alter or duplicate the
payload; files obey deletion; notifications arrive when the app sleeps and stay
quiet when it is already visible; and the entire behavior is covered by two-
client tests plus a real iPad pass.
