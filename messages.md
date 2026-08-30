---
title: Messages
description: Direct messages, the party channel, and DM announcements.
permalink: /messages/
published: false
autoIndex: false
pageScripts:
  - /js/vos-messages.js
---

<section class="vos-messages-page" aria-labelledby="vos-messages-page-title">
  <div class="vos-messages-page-head">
    <h2 class="vos-messages-page-title" id="vos-messages-page-title">Messages</h2>
  </div>

  <div class="vos-im-announcements" id="vos-im-announcements" hidden>
    <h3 class="vos-im-announcements-title">From the DM</h3>
    <div class="vos-messages-page-list" id="vos-messages-page-list"></div>
  </div>

  <div class="vos-im" id="vos-im-root">
    <div class="vos-im-threads" id="vos-im-threads" aria-label="Conversations"></div>

    <div class="vos-im-thread" id="vos-im-thread" hidden>
      <div class="vos-im-thread-head">
        <button type="button" class="vos-im-back" id="vos-im-back" aria-label="Back to conversations">←</button>
        <h3 class="vos-im-thread-title" id="vos-im-thread-title"></h3>
        <button type="button" class="vos-im-mute" id="vos-im-mute" aria-pressed="false">Mute</button>
      </div>
      <div class="vos-im-messages" id="vos-im-messages" aria-live="polite"></div>
      <form class="vos-im-composer" id="vos-im-composer">
        <textarea id="vos-im-input" rows="1" maxlength="4000"
                  placeholder="Write a message…" aria-label="Message"></textarea>
        <button type="submit" id="vos-im-send">Send</button>
      </form>
    </div>
  </div>

  <div class="vos-messages-page-status" id="vos-messages-page-status" role="status" aria-live="polite">Loading…</div>
</section>
