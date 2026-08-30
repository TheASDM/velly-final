import { rsvpGoingEl, rsvpListEl, rsvpMaybeEl, rsvpOutEl, rsvpStatusEl, setStatus } from './dom.js';
import { adminJson, withPanel } from './http.js';

export function refreshRsvps() {
  return withPanel(rsvpStatusEl, null, async () => {
    // RSVPs are keyed to the next scheduled session in calendar_events.
    // A network failure here is a failure — it must not read as "nothing
    // is scheduled".
    const nextData = await adminJson('/api/calendar/next');
    const gathering = nextData.gathering;
    if (!gathering) {
      setStatus(rsvpStatusEl, 'No upcoming session is scheduled, so there is nothing to RSVP to.');
      rsvpListEl.innerHTML = '';
      return;
    }
    const rsvpHeading = document.getElementById('vos-dm-rsvp-title');
    if (rsvpHeading && gathering.date) {
      rsvpHeading.textContent = 'RSVP Summary — ' + new Date(gathering.date + 'T00:00:00')
        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    const data = await adminJson(`/api/rsvp?eventId=${encodeURIComponent(gathering.eventKey)}`);
    const counts = data.counts || {};
    rsvpGoingEl.textContent = counts.going || 0;
    rsvpMaybeEl.textContent = counts.maybe || 0;
    rsvpOutEl.textContent = counts.out || 0;

    rsvpListEl.innerHTML = '';
    (data.responses || []).forEach((item) => {
      const li = document.createElement('li');
      const name = document.createElement('strong');
      const status = document.createElement('span');
      name.textContent = item.player_name;
      status.textContent = item.status;
      li.append(name, status);
      rsvpListEl.appendChild(li);
    });
    if (!rsvpListEl.children.length) {
      const li = document.createElement('li');
      li.textContent = 'No RSVPs yet.';
      rsvpListEl.appendChild(li);
    }
    setStatus(rsvpStatusEl, 'Updated.');
  });
}
