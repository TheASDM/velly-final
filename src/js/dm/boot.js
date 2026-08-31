import { rollNpc } from './availability.js';
import { exitEditMode, saveCalendarEvent } from './calendar.js';
import { calCancelEl, calFormEl, handoutCancelEl, handoutFormEl, handoutImageEl, loreBulkPublishEl, loreBulkRejectEl, loreForm, loreRedraftEl, loreRejectEl, loreSaveEl, loreSelectAllEl, npcRollEl, rumorFormEl, setStatus, showDeletedEl, wikiForm, wikiLoadEl, wikiQueryEl, wikiRebuildEl, wikiStatusEl } from './dom.js';
import { attachHandoutImage, cancelHandoutEdit, saveHandout } from './handouts.js';
import { bulkPublishSelected, bulkRejectSelected, publishLoreSubmission, redraftLoreSubmission, rejectLoreSubmission, saveLoreSubmission, toggleSelectAll } from './lore.js';
import { initMessagePreview, initRecipientPickers, refreshMessages } from './messages.js';
import { triggerRebuild } from './rebuild.js';
import { addRumor } from './rumors.js';
import { bootAdminAuth, onSessionLive } from './session.js';
import { wireSounds } from './sounds.js';
import { loadWikiEntry, saveWikiEntry } from './wiki.js';

calFormEl.addEventListener('submit', saveCalendarEvent);

if (calCancelEl) calCancelEl.addEventListener('click', exitEditMode);

if (rumorFormEl) rumorFormEl.addEventListener('submit', addRumor);
if (handoutFormEl) handoutFormEl.addEventListener('submit', saveHandout);
if (handoutCancelEl) handoutCancelEl.addEventListener('click', cancelHandoutEdit);
if (handoutImageEl) handoutImageEl.addEventListener('change', attachHandoutImage);

wireSounds();

/* Not gated on the session: checking how your markdown renders is a local
   question, and it should answer before you have signed in. */
initMessagePreview();

if (npcRollEl) npcRollEl.addEventListener('click', rollNpc);

showDeletedEl.addEventListener('change', refreshMessages);

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

// Recipient pickers need the roster; build them once the session is live so
// a signed-out visit doesn't fetch for nothing.
onSessionLive(() => {
  initRecipientPickers();
});

bootAdminAuth();
