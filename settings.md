---
title: Settings
description: Manage your profile, notifications, and app updates.
permalink: /settings/
autoIndex: false
published: false
---

<section class="vos-compact-panel vos-settings-panel" id="vos-settings-profile">
  <div class="vos-panel-head">
    <h2 class="vos-panel-title">Profile</h2>
  </div>
  <div class="vos-settings-profile-row">
    <span class="vos-settings-avatar-wrap">
      <img class="vos-settings-avatar-img" id="vos-settings-avatar" alt="">
      <svg class="vos-settings-avatar-fallback" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg>
    </span>
    <div class="vos-settings-profile-meta">
      <span class="vos-settings-profile-name" id="vos-settings-profile-name">Loading…</span>
      <span class="vos-settings-profile-sub" id="vos-settings-profile-sub"></span>
    </div>
  </div>
  <div class="vos-settings-actions">
    <button class="vos-button" id="vos-settings-switch-player" type="button">Switch player</button>
    <button class="vos-button" id="vos-settings-sign-out" type="button" hidden>Sign out</button>
  </div>
</section>

<section class="vos-compact-panel vos-settings-panel" id="vos-settings-notifications">
  <div class="vos-panel-head">
    <h2 class="vos-panel-title">Notifications</h2>
  </div>
  <p class="vos-settings-text">
    Receive a push notification on this device when the DM sends a message
    or a new session is announced.
  </p>
  <div class="vos-settings-status" id="vos-settings-push-status" aria-live="polite">Checking…</div>
  <div class="vos-settings-actions">
    <button class="vos-button" id="vos-settings-push-toggle" type="button" disabled>Enable notifications</button>
  </div>
</section>

<section class="vos-compact-panel vos-settings-panel" id="vos-settings-updates">
  <div class="vos-panel-head">
    <h2 class="vos-panel-title">App updates</h2>
  </div>
  <p class="vos-settings-text">
    The app caches itself for offline use. Check for a new version if
    something looks stale or broken.
  </p>
  <div class="vos-settings-status" id="vos-settings-update-status" aria-live="polite">Idle.</div>
  <div class="vos-settings-actions">
    <button class="vos-button" id="vos-settings-check-updates" type="button">Check for updates</button>
    <button class="vos-button" id="vos-settings-apply-update" type="button" hidden>Refresh to update</button>
  </div>
</section>

<script src="/js/settings.js" defer></script>
