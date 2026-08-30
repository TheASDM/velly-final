/* Element handles and tiny DOM utilities for the DM console.
 *
 * This module is the ground floor: every panel imports it, so it imports
 * none of them. Anything with behavior (session, HTTP, rebuild polling)
 * lives in its own module beside this one. */

export const authSignedOutEl = document.getElementById('vos-dm-auth-signed-out');
export const authSignedInEl = document.getElementById('vos-dm-auth-signed-in');
export const authBlockedEl = document.getElementById('vos-dm-auth-blocked');
export const authEmailEl = document.getElementById('vos-dm-auth-email');
export const authStatusEl = document.getElementById('vos-dm-auth-status');
export const signInEl = document.getElementById('vos-dm-sign-in');
export const signOutEl = document.getElementById('vos-dm-sign-out');
export const switchAccountEl = document.getElementById('vos-dm-switch-account');

export const summaryEl = document.getElementById('vos-dm-summary');
export const dotPrepEl = document.getElementById('vos-dm-dot-prep');
export const dotCommsEl = document.getElementById('vos-dm-dot-comms');

export const messageForm = document.getElementById('vos-dm-message-form');
export const messageTitleEl = document.getElementById('vos-dm-message-heading');
export const messageBodyEl = document.getElementById('vos-dm-message-body');
export const messageUrlEl = document.getElementById('vos-dm-message-url');
export const messageStatusEl = document.getElementById('vos-dm-message-status');
export const messageSendEl = document.getElementById('vos-dm-message-send');
export const messageNotifyOnlyEl = document.getElementById('vos-dm-message-notify-only');

export const historyEl = document.getElementById('vos-dm-history');
export const historyStatusEl = document.getElementById('vos-dm-history-status');
export const showDeletedEl = document.getElementById('vos-dm-show-deleted');

export const rsvpStatusEl = document.getElementById('vos-dm-rsvp-status');
export const rsvpListEl = document.getElementById('vos-dm-rsvps');
export const rsvpGoingEl = document.getElementById('vos-rsvp-going');
export const rsvpMaybeEl = document.getElementById('vos-rsvp-maybe');
export const rsvpOutEl = document.getElementById('vos-rsvp-out');

export const recipientPickers = new Map();

export const calFormEl = document.getElementById('vos-dm-cal-form');
export const calDateEl = document.getElementById('vos-dm-cal-date');
export const calTitleEl = document.getElementById('vos-dm-cal-title');
export const calTimeEl = document.getElementById('vos-dm-cal-time');
export const calLocationEl = document.getElementById('vos-dm-cal-location');
export const calNotesEl = document.getElementById('vos-dm-cal-notes');
export const calKindEl = document.getElementById('vos-dm-cal-kind');
export const calTasksEl = document.getElementById('vos-dm-cal-tasks');
export const calSaveEl = document.getElementById('vos-dm-cal-save');
export const calCancelEl = document.getElementById('vos-dm-cal-cancel');
export const calEventsEl = document.getElementById('vos-dm-cal-events');
export const calStatusEl = document.getElementById('vos-dm-cal-status');

export const pushSubsEl = document.getElementById('vos-dm-push-subs');
export const pushSubsStatusEl = document.getElementById('vos-dm-subs-status');

export const rumorFormEl = document.getElementById('vos-dm-rumor-form');
export const rumorTextEl = document.getElementById('vos-dm-rumor-text');
export const rumorAddEl = document.getElementById('vos-dm-rumor-add');
export const rumorsListEl = document.getElementById('vos-dm-rumors-list');
export const rumorsStatusEl = document.getElementById('vos-dm-rumors-status');

export const handoutFormEl = document.getElementById('vos-dm-handout-form');
export const handoutIdEl = document.getElementById('vos-dm-handout-id');
export const handoutTitleEl = document.getElementById('vos-dm-handout-title');
export const handoutTextEl = document.getElementById('vos-dm-handout-text');
export const handoutPlayersEl = document.getElementById('vos-dm-handout-players');
export const handoutImageEl = document.getElementById('vos-dm-handout-image');
export const handoutSaveEl = document.getElementById('vos-dm-handout-save');
export const handoutCancelEl = document.getElementById('vos-dm-handout-cancel');
export const handoutsListEl = document.getElementById('vos-dm-handouts-list');
export const handoutsStatusEl = document.getElementById('vos-dm-handouts-status');

export const soundsListEl = document.getElementById('vos-dm-sounds-list');
export const soundsSearchEl = document.getElementById('vos-dm-sounds-search');
export const soundsStatusEl = document.getElementById('vos-dm-sounds-status');
export const soundsStopEl = document.getElementById('vos-dm-sounds-stop');
export const soundsRefreshEl = document.getElementById('vos-dm-sounds-refresh');

export const npcRollEl = document.getElementById('vos-dm-npc-roll');
export const npcResultEl = document.getElementById('vos-dm-npc-result');

export const recordsListEl = document.getElementById('vos-dm-records-list');
export const recordsStatusEl = document.getElementById('vos-dm-records-status');

export const availSummaryEl = document.getElementById('vos-dm-avail-summary');
export const availSubmittedEl = document.getElementById('vos-dm-avail-submitted');
export const availStatusEl = document.getElementById('vos-dm-avail-status');

export const loreListEl = document.getElementById('vos-dm-lore-list');
export const loreBulkBarEl = document.getElementById('vos-dm-lore-bulk-bar');
export const loreSelectAllEl = document.getElementById('vos-dm-lore-select-all');
export const loreSelectCountEl = document.getElementById('vos-dm-lore-select-count');
export const loreBulkPublishEl = document.getElementById('vos-dm-lore-bulk-publish');
export const loreBulkRejectEl = document.getElementById('vos-dm-lore-bulk-reject');
export const selectedLoreIds = new Set();

export const wikiQueryEl = document.getElementById('vos-dm-wiki-query');
export const wikiLoadEl = document.getElementById('vos-dm-wiki-load');
export const wikiRebuildEl = document.getElementById('vos-dm-wiki-rebuild');
export const wikiForm = document.getElementById('vos-dm-wiki-form');
export const wikiContentRowEl = document.getElementById('vos-dm-wiki-content-row');
export const wikiContentEl = document.getElementById('vos-dm-wiki-content');
export const wikiMetaEl = document.getElementById('vos-dm-wiki-meta');
export const wikiOpenEl = document.getElementById('vos-dm-wiki-open');
export const wikiSaveEl = document.getElementById('vos-dm-wiki-save');
export const wikiStatusEl = document.getElementById('vos-dm-wiki-status');

export const inPlayListEl = document.getElementById('vos-dm-inplay-list');
export const inPlayStatusEl = document.getElementById('vos-dm-inplay-status');
export const inPlayAddEl = document.getElementById('vos-dm-inplay-add');
export const inPlaySaveEl = document.getElementById('vos-dm-inplay-save');

export const loreForm = document.getElementById('vos-dm-lore-form');
export const loreStatusEl = document.getElementById('vos-dm-lore-status');
export const loreTitleEl = document.getElementById('vos-dm-lore-entry-title');
export const loreSlugEl = document.getElementById('vos-dm-lore-slug');
export const loreSummaryEl = document.getElementById('vos-dm-lore-summary');
export const loreMarkdownEl = document.getElementById('vos-dm-lore-markdown');
export const loreImagePromptEl = document.getElementById('vos-dm-lore-image-prompt');
export const loreImageEl = document.getElementById('vos-dm-lore-image');
export const loreRedraftEl = document.getElementById('vos-dm-lore-redraft');
export const loreSaveEl = document.getElementById('vos-dm-lore-save');
export const loreRejectEl = document.getElementById('vos-dm-lore-reject');
export const loreRejectReasonEl = document.getElementById('vos-dm-lore-reject-reason');
export const lorePublishEl = document.getElementById('vos-dm-lore-publish');

export function setStatus(target, text, isError) {
  if (!target) return;
  target.textContent = text || '';
  target.classList.toggle('is-error', !!isError);
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
