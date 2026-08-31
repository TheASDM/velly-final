/* Tab data lifecycle.
 *
 * A tab is "loaded" only when its loader succeeds — a failed load retries
 * the next time the tab is shown instead of being marked done forever. Data
 * older than a minute reloads on tab show, and everything resets when the
 * session dies so a re-auth doesn't stare at stale panels. */

import { wikiQueryEl } from './dom.js';
import { refreshArtCompilers } from './art.js';
import { refreshAvailabilitySummary } from './availability.js';
import { refreshCalendarEvents } from './calendar.js';
import { refreshHandouts } from './handouts.js';
import { refreshInPlay } from './in-play.js';
import { refreshSounds } from './sounds.js';
import { refreshLoreSubmissions } from './lore.js';
import { refreshMessages } from './messages.js';
import { refreshPushSubscribers } from './push.js';
import { refreshQuestionnaires } from './questionnaires.js';
import { refreshRsvps } from './rsvp.js';
import { refreshRumors } from './rumors.js';
import { isSessionLive, onSessionDead, onSessionLive } from './session.js';
import { loadWikiEntry, loadWikiPages } from './wiki.js';

const STALE_MS = 60_000;

// view -> { loadedAt, loading }
const tabState = new Map();

export const TAB_LOADERS = {
  schedule: () => refreshCalendarEvents(),
  availability: () => refreshAvailabilitySummary(),
  rsvps: () => refreshRsvps(),
  compose: () => refreshPushSubscribers(),
  history: () => refreshMessages(),
  wiki: async () => {
    await loadWikiPages();
    if (pendingWikiAutoLoad) {
      pendingWikiAutoLoad = null;
      return loadWikiEntry();
    }
    return true;
  },
  lore: async () => {
    await loadWikiPages(); // lore editor reuses the wiki page list
    return refreshLoreSubmissions();
  },
  records: () => refreshQuestionnaires(),
  rumors: () => refreshRumors(),
  art: () => refreshArtCompilers(),
  handouts: () => refreshHandouts(),
  sounds: () => refreshSounds(),
  npc: () => true,
  inplay: () => refreshInPlay(),
};

export async function loadTabData(view, { force = false } = {}) {
  const loader = TAB_LOADERS[view];
  if (!isSessionLive() || !loader) return;
  const state = tabState.get(view) || { loadedAt: 0, loading: false };
  if (state.loading) return;
  if (!force && state.loadedAt && Date.now() - state.loadedAt < STALE_MS) return;
  tabState.set(view, { ...state, loading: true });
  let ok = false;
  try {
    // Loaders run through withPanel, which reports its own errors and
    // resolves null on failure — null means "not loaded, try again".
    ok = (await loader()) !== null;
  } finally {
    tabState.set(view, { loadedAt: ok ? Date.now() : 0, loading: false });
  }
}

export function activeTab() {
  const section = document.querySelector('[data-vos-view]:not([hidden])');
  return section ? section.dataset.vosView : 'schedule';
}

window.addEventListener('vos:view-shown', (event) => {
  loadTabData(event.detail.view);
});

onSessionLive(() => {
  // A ?wiki= deep link should land the DM in the wiki editor.
  if (pendingWikiAutoLoad && window.VOS_TABS) {
    window.VOS_TABS.show('wiki');
    return;
  }
  loadTabData(activeTab());
});

onSessionDead(() => {
  tabState.clear();
});

export let pendingWikiAutoLoad = null;

try {
  const params = new URLSearchParams(window.location.search);
  pendingWikiAutoLoad = params.get('wiki') || '';
  if (pendingWikiAutoLoad && wikiQueryEl) wikiQueryEl.value = pendingWikiAutoLoad;
} catch (e) { /* no URL params, nothing to prefill */ }
