import { PLAYER_KEY, getStorage } from './core.js';
import { authHeaders } from './identity.js';
import { clearIdentity, ensureIdentity } from './identity-modal.js';

export function initRsvpControls() {
  document.querySelectorAll('.vos-rsvp-control[data-event-id]').forEach((rsvp) => {
    if (rsvp.dataset.ready === '1') return;
    rsvp.dataset.ready = '1';

    const eventId = rsvp.getAttribute('data-event-id');
    const statusEl = rsvp.querySelector('.vos-rsvp-status');
    const buttons = Array.from(rsvp.querySelectorAll('[data-status]'));
    if (!eventId || !statusEl || !buttons.length) return;

    function setStatus(text, isError) {
      statusEl.textContent = text || '';
      statusEl.classList.toggle('is-error', !!isError);
    }

    function setSelected(status) {
      buttons.forEach((button) => {
        const active = button.dataset.status === status;
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }

    async function getPlayerName() {
      if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
        return window.VOS_PWA.ensureIdentity();
      }
      return getStorage(PLAYER_KEY);
    }

    async function loadExisting(name) {
      if (!name) return;
      const url = `/api/rsvp?eventId=${encodeURIComponent(eventId)}&name=${encodeURIComponent(name)}`;
      const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
      if (response.status === 401 || response.status === 403) {
        clearIdentity();
        const newName = await ensureIdentity({ force: true });
        if (newName) await loadExisting(newName);
        return;
      }
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      if (data.status) setSelected(data.status);
    }

    buttons.forEach((button) => {
      button.addEventListener('click', async () => {
        const name = await getPlayerName();
        if (!name) {
          setStatus('Choose your name first.', true);
          return;
        }

        buttons.forEach((candidate) => { candidate.disabled = true; });
        setStatus('Saving...');

        try {
          const response = await fetch('/api/rsvp', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              eventId,
              name,
              status: button.dataset.status,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
          setSelected(button.dataset.status);
          setStatus('Saved.');
        } catch (error) {
          setStatus(error.message, true);
        } finally {
          buttons.forEach((candidate) => { candidate.disabled = false; });
        }
      });
    });

    getPlayerName().then(loadExisting).catch(() => {});
  });
}
