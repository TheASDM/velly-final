---
title: Notes
description: Private notes for the signed-in player.
permalink: /notes/
published: false
autoIndex: false
pageStyles:
  - /css/notes.css
pageScripts:
  - /js/vos-notes.js
---

<section class="vos-compact-panel vos-notes-panel" aria-labelledby="vos-notes-title">
  <div class="vos-panel-head">
    <h2 class="vos-panel-title" id="vos-notes-title">Notes</h2>
    <div class="vos-settings-actions">
      <button class="vos-button" id="vos-notes-new" type="button">New</button>
      <button class="vos-button" id="vos-notes-refresh" type="button">Refresh</button>
    </div>
  </div>

  <div class="vos-notes-scope" id="vos-notes-scope" hidden>
    <button class="vos-button is-selected" type="button" data-scope="private">Mine</button>
    <button class="vos-button" type="button" data-scope="dm">DM</button>
  </div>

  <div class="vos-settings-status" id="vos-notes-status" role="status" aria-live="polite">Loading...</div>

  <div class="vos-notes-layout">
    <aside class="vos-notes-list" id="vos-notes-list" aria-label="Saved notes"></aside>
    <form class="vos-notes-editor" id="vos-notes-form">
      <label>
        Title
        <input id="vos-notes-title-input" type="text" maxlength="140" autocomplete="off">
      </label>
      <label>
        Body
        <textarea id="vos-notes-body" spellcheck="true"></textarea>
      </label>
      <div class="vos-notes-editor-actions">
        <button class="vos-button" id="vos-notes-delete" type="button" disabled>Delete</button>
        <button class="vos-button" id="vos-notes-save" type="submit">Save</button>
      </div>
    </form>
  </div>
</section>
