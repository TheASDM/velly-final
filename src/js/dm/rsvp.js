import { authHeaders, getToken, initGoogleButton, persistSession, rsvpGoingEl, rsvpListEl, rsvpMaybeEl, rsvpOutEl, rsvpRefreshEl, rsvpStatusEl, setStatus } from './state.js';

export async function refreshRsvps() {
  const token = getToken(rsvpStatusEl);
  if (!token) return;
  // RSVPs are keyed to the next scheduled session in calendar_events.
  let eventId = null;
  let gatheringDate = '';
  try {
    const nextResponse = await fetch('/api/calendar/next', { cache: 'no-store' });
    const nextData = await nextResponse.json().catch(() => ({}));
    if (nextResponse.ok && nextData.gathering) {
      eventId = nextData.gathering.eventKey;
      gatheringDate = nextData.gathering.date;
    }
  } catch (error) { /* handled below */ }
  if (!eventId) {
    setStatus(rsvpStatusEl, 'No upcoming session is scheduled, so there is nothing to RSVP to.', true);
    return;
  }
  const rsvpHeading = document.getElementById('vos-dm-rsvp-title');
  if (rsvpHeading && gatheringDate) {
    rsvpHeading.textContent = 'RSVP Summary — ' + new Date(gatheringDate + 'T00:00:00')
      .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  rsvpRefreshEl.disabled = true;
  setStatus(rsvpStatusEl, 'Loading...');

  try {
    const response = await fetch(`/api/rsvp?eventId=${encodeURIComponent(eventId)}`, {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      persistSession(null);
      initGoogleButton();
      throw new Error(data.error || 'Session expired — sign in again.');
    }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
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
  } catch (error) {
    setStatus(rsvpStatusEl, error.message, true);
  } finally {
    rsvpRefreshEl.disabled = false;
  }
}
