import { refreshAvailabilitySummary, rollNpc } from './availability.js';
import { exitEditMode, refreshCalendarEvents, saveCalendarEvent } from './calendar.js';
import { bulkPublishSelected, bulkRejectSelected, publishLoreSubmission, redraftLoreSubmission, refreshLoreSubmissions, rejectLoreSubmission, saveLoreSubmission, toggleSelectAll } from './lore.js';
import { initRecipientPickers, refreshMessages } from './messages.js';
import { refreshPushSubscribers } from './push.js';
import { refreshQuestionnaires } from './questionnaires.js';
import { refreshRsvps } from './rsvp.js';
import { addRumor, refreshRumors } from './rumors.js';
import { attachHandoutImage, cancelHandoutEdit, refreshHandouts, saveHandout } from './handouts.js';
import { handoutCancelEl, handoutFormEl, handoutImageEl, handoutsRefreshEl } from './state.js';
import { availRefreshEl, calCancelEl, calFormEl, calRefreshEl, historyRefreshEl, loreBulkPublishEl, loreBulkRejectEl, loreForm, loreRedraftEl, loreRefreshEl, loreRejectEl, loreSaveEl, loreSelectAllEl, npcRollEl, pushSubsRefreshEl, recordsRefreshEl, rsvpRefreshEl, rumorFormEl, rumorsRefreshEl, setStatus, showDeletedEl, triggerRebuild, wikiForm, wikiLoadEl, wikiQueryEl, wikiRebuildEl, wikiStatusEl } from './state.js';
import { loadAdminDataOnce } from './tabs.js';
import { loadWikiEntry, saveWikiEntry } from './wiki.js';

rsvpRefreshEl.addEventListener('click', refreshRsvps);

calFormEl.addEventListener('submit', saveCalendarEvent);

if (calCancelEl) calCancelEl.addEventListener('click', exitEditMode);

calRefreshEl.addEventListener('click', refreshCalendarEvents);

availRefreshEl.addEventListener('click', refreshAvailabilitySummary);

if (recordsRefreshEl) recordsRefreshEl.addEventListener('click', refreshQuestionnaires);

if (rumorFormEl) rumorFormEl.addEventListener('submit', addRumor);
if (handoutFormEl) handoutFormEl.addEventListener('submit', saveHandout);
if (handoutCancelEl) handoutCancelEl.addEventListener('click', cancelHandoutEdit);
if (handoutsRefreshEl) handoutsRefreshEl.addEventListener('click', refreshHandouts);
if (handoutImageEl) handoutImageEl.addEventListener('change', attachHandoutImage);

if (rumorsRefreshEl) rumorsRefreshEl.addEventListener('click', refreshRumors);

if (npcRollEl) npcRollEl.addEventListener('click', rollNpc);

if (pushSubsRefreshEl) pushSubsRefreshEl.addEventListener('click', refreshPushSubscribers);

historyRefreshEl.addEventListener('click', refreshMessages);

showDeletedEl.addEventListener('change', refreshMessages);

loreRefreshEl.addEventListener('click', refreshLoreSubmissions);

loreSaveEl.addEventListener('click', saveLoreSubmission);

loreRedraftEl.addEventListener('click', redraftLoreSubmission);

loreRejectEl.addEventListener('click', rejectLoreSubmission);

loreForm.addEventListener('submit', publishLoreSubmission);

if (loreSelectAllEl) loreSelectAllEl.addEventListener('change', toggleSelectAll);

if (loreBulkPublishEl) loreBulkPublishEl.addEventListener('click', bulkPublishSelected);

if (loreBulkRejectEl) loreBulkRejectEl.addEventListener('click', bulkRejectSelected);

if (wikiLoadEl) wikiLoadEl.addEventListener('click', loadWikiEntry);

if (wikiRebuildEl) wikiRebuildEl.addEventListener('click', async () => {
  wikiRebuildEl.disabled = true;
  setStatus(wikiStatusEl, 'Starting rebuild...');
  try {
    await triggerRebuild(wikiStatusEl, 'manual wiki editor rebuild');
  } catch (error) {
    setStatus(wikiStatusEl, error.message, true);
  } finally {
    wikiRebuildEl.disabled = false;
  }
});

if (wikiForm) wikiForm.addEventListener('submit', saveWikiEntry);

if (wikiQueryEl) {
  wikiQueryEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadWikiEntry();
    }
  });
}

initRecipientPickers().then(() => {
  loadAdminDataOnce();
});
