/* The console's summary strip and the pending-work dots on the group labels.
 *
 * One /api/admin/dashboard call answers: when is the next session and who
 * has RSVPed, who still owes availability, how deep is the lore queue, who
 * has alerts on, and what the last build did. Refreshes when the session
 * goes live and quietly on tab activity when it is more than a minute old. */

import { dotCommsEl, dotPrepEl, summaryEl } from './dom.js';
import { adminJson } from './http.js';
import { isSessionLive, onSessionDead, onSessionLive } from './session.js';
import { rebuildStatusText } from './rebuild.js';

const STALE_MS = 60_000;
let loadedAt = 0;
let loading = false;

function chip(label, value, { alert = false } = {}) {
  const el = document.createElement('div');
  el.className = 'vos-dm-summary-chip' + (alert ? ' is-alert' : '');
  const strong = document.createElement('strong');
  strong.textContent = value;
  const span = document.createElement('span');
  span.textContent = label;
  el.append(strong, span);
  return el;
}

function render(data) {
  if (!summaryEl) return;
  summaryEl.innerHTML = '';
  summaryEl.hidden = false;

  const gathering = data.gathering;
  if (gathering) {
    const date = new Date(gathering.date + 'T00:00:00')
      .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    summaryEl.appendChild(chip('next session', date));
    const counts = (data.rsvp && data.rsvp.counts) || {};
    summaryEl.appendChild(chip('going / maybe / out',
      `${counts.going || 0} / ${counts.maybe || 0} / ${counts.out || 0}`));
    const missing = (data.rsvp && data.rsvp.missing) || [];
    if (missing.length) {
      summaryEl.appendChild(chip('no RSVP yet', String(missing.length), { alert: true }));
    }
  } else {
    summaryEl.appendChild(chip('next session', 'none scheduled', { alert: true }));
  }

  const availMissing = (data.availability && data.availability.missing) || [];
  if (availMissing.length) {
    summaryEl.appendChild(chip('availability owed', String(availMissing.length)));
  }

  const pendingLore = (data.lore && data.lore.pending) || 0;
  summaryEl.appendChild(chip('lore queue', String(pendingLore), { alert: pendingLore > 0 }));

  const rebuild = data.rebuild || {};
  if (rebuild.state && rebuild.state !== 'idle') {
    summaryEl.appendChild(chip('build', rebuildStatusText(rebuild) || rebuild.state,
      { alert: rebuild.state === 'failed' }));
  }

  const rsvpMissing = (data.rsvp && data.rsvp.missing) || [];
  if (dotPrepEl) dotPrepEl.hidden = !(rsvpMissing.length || availMissing.length);
  if (dotCommsEl) dotCommsEl.hidden = !(pendingLore > 0);
}

export async function refreshDashboard({ force = false } = {}) {
  if (!isSessionLive() || !summaryEl || loading) return;
  if (!force && loadedAt && Date.now() - loadedAt < STALE_MS) return;
  loading = true;
  try {
    const data = await adminJson('/api/admin/dashboard');
    loadedAt = Date.now();
    render(data);
  } catch (error) {
    // The summary is glanceable extra — a failure must not add noise.
    summaryEl.hidden = true;
  } finally {
    loading = false;
  }
}

onSessionLive(() => refreshDashboard({ force: true }));

onSessionDead(() => {
  loadedAt = 0;
  if (summaryEl) summaryEl.hidden = true;
});

window.addEventListener('vos:view-shown', () => refreshDashboard());
