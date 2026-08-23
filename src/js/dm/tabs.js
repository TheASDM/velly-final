import { refreshAvailabilitySummary } from './availability.js';
import { refreshCalendarEvents } from './calendar.js';
import { refreshLoreSubmissions } from './lore.js';
import { refreshMessages } from './messages.js';
import { refreshPushSubscribers } from './push.js';
import { refreshQuestionnaires } from './questionnaires.js';
import { refreshRsvps } from './rsvp.js';
import { refreshRumors } from './rumors.js';
import { isSessionLive, wikiQueryEl } from './state.js';
import { loadWikiEntry, loadWikiPages } from './wiki.js';

export let adminDataLoaded = false;

export const loadedTabs = new Set();

export const TAB_LOADERS = {
  schedule: () => refreshCalendarEvents(),
  availability: () => refreshAvailabilitySummary(),
  rsvps: () => refreshRsvps(),
  message: () => {},
  history: () => refreshMessages(),
  push: () => refreshPushSubscribers(),
  wiki: () => {
    loadWikiPages();
    if (pendingWikiAutoLoad) {
      loadWikiEntry();
      pendingWikiAutoLoad = null;
    }
  },
  lore: () => {
    loadWikiPages(); // lore editor reuses the wiki page list
    refreshLoreSubmissions();
  },
  records: () => refreshQuestionnaires(),
  rumors: () => refreshRumors(),
  npc: () => {},
  inplay: () => {},
};

export function loadTabData(view) {
  if (!isSessionLive() || loadedTabs.has(view) || !TAB_LOADERS[view]) return;
  loadedTabs.add(view);
  TAB_LOADERS[view]();
}

export function activeTab() {
  const section = document.querySelector('[data-vos-view]:not([hidden])');
  return section ? section.dataset.vosView : 'schedule';
}

window.addEventListener('vos:view-shown', (event) => {
  loadTabData(event.detail.view);
});

export function loadAdminDataOnce() {
  if (adminDataLoaded || !isSessionLive()) return;
  adminDataLoaded = true;
  // A ?page= deep link should land the DM in the wiki editor.
  if (pendingWikiAutoLoad && window.VOS_TABS) {
    window.VOS_TABS.show('wiki');
    return;
  }
  loadTabData(activeTab());
}

export let pendingWikiAutoLoad = null;

try {
  const params = new URLSearchParams(window.location.search);
  pendingWikiAutoLoad = params.get('wiki') || '';
  if (pendingWikiAutoLoad && wikiQueryEl) wikiQueryEl.value = pendingWikiAutoLoad;
} catch (e) {}
