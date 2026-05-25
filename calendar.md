---
title: Calendar
description: Next Valley of Shadows gathering.
permalink: /calendar/
---

<style>
.vos-calendar {
  max-width: 760px;
  margin: 0 auto;
}
.vos-calendar-panel {
  border: 1px solid rgba(201,161,74,0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(18,16,23,0.94), rgba(8,7,11,0.98)),
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,161,74,0.06), transparent 70%);
  box-shadow: 0 16px 42px rgba(0,0,0,0.55);
  padding: clamp(1.2rem, 3vw, 1.8rem);
}
.vos-calendar-kicker {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-calendar-date {
  margin: 0.25rem 0 0.35rem;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.6rem, 5vw, 2.45rem);
  line-height: 1.12;
}
.vos-calendar-where {
  color: var(--vos-cream);
  font-size: 1.1rem;
}
.vos-calendar-notes {
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
}
.vos-calendar-notes li {
  padding: 0.65rem 0;
  border-top: 1px solid rgba(139,115,85,0.24);
}
.vos-calendar-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1.2rem;
  padding: 0.7rem 1rem;
  min-height: 44px;
  border: 1px solid var(--vos-border-strong);
  border-radius: 6px;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-calendar-link:hover {
  color: var(--vos-cream);
  border-bottom-color: var(--vos-gold-bright);
  background: rgba(212,165,116,0.08);
}
.vos-rsvp {
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid rgba(139,115,85,0.24);
}
.vos-rsvp-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.65rem;
}
.vos-rsvp-option {
  min-height: 44px;
  border: 1px solid rgba(212,165,116,0.34);
  border-radius: 6px;
  background: rgba(7,6,10,0.5);
  color: var(--vos-gold-bright);
  cursor: pointer;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.vos-rsvp-option:hover {
  background: rgba(212,165,116,0.12);
  color: var(--vos-cream);
}
.vos-rsvp-option.is-selected {
  background: rgba(212,165,116,0.2);
  border-color: rgba(232,205,132,0.82);
  color: var(--vos-cream);
}
.vos-rsvp-status {
  min-height: 1.35em;
  margin-top: 0.65rem;
  color: rgba(233,225,208,0.78);
}
.vos-rsvp-status.is-error {
  color: var(--vos-quest-bright);
}
@media (max-width: 560px) {
  .vos-rsvp-options { grid-template-columns: 1fr; }
}
</style>

<div class="vos-calendar">
  <h1>Calendar</h1>
  <section class="vos-calendar-panel" aria-labelledby="vos-next-gathering-title">
    <div class="vos-calendar-kicker">Next Gathering</div>
    <h2 id="vos-next-gathering-title" class="vos-calendar-date">{{ campaign.nextGathering.date }}</h2>
    <div class="vos-calendar-where">{{ campaign.nextGathering.timeLocation }}</div>
    <ul class="vos-calendar-notes">
      {%- for note in campaign.nextGathering.notes %}
      <li>{{ note }}</li>
      {%- endfor %}
    </ul>
    <div class="vos-rsvp" id="vos-rsvp" data-event-id="{{ campaign.nextGathering.eventId }}">
      <div class="vos-calendar-kicker">RSVP</div>
      <div class="vos-rsvp-options" role="group" aria-label="RSVP status">
        <button class="vos-rsvp-option" type="button" data-status="going">Going</button>
        <button class="vos-rsvp-option" type="button" data-status="maybe">Maybe</button>
        <button class="vos-rsvp-option" type="button" data-status="out">Out</button>
      </div>
      <div class="vos-rsvp-status" id="vos-rsvp-status" role="status" aria-live="polite"></div>
    </div>
    {%- if campaign.nextGathering.timefulUrl %}
    <a class="vos-calendar-link" href="{{ campaign.nextGathering.timefulUrl }}" target="_blank" rel="noopener">Set Availability in Timeful</a>
    {%- endif %}
  </section>
</div>

<script>
(function () {
  function boot() {
    const rsvp = document.getElementById('vos-rsvp');
    const statusEl = document.getElementById('vos-rsvp-status');
    if (!rsvp || !statusEl) return;

    const eventId = rsvp.getAttribute('data-event-id');
    const buttons = Array.from(rsvp.querySelectorAll('[data-status]'));

    function setStatus(text, isError) {
      statusEl.textContent = text || '';
      statusEl.classList.toggle('is-error', !!isError);
    }

    function setSelected(status) {
      buttons.forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.status === status);
        button.setAttribute('aria-pressed', button.dataset.status === status ? 'true' : 'false');
      });
    }

    async function getPlayerName() {
      if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
        return window.VOS_PWA.ensureIdentity();
      }
      try { return localStorage.getItem('vos.playerName'); } catch (error) { return null; }
    }

    async function loadExisting(name) {
      if (!eventId || !name) return;
      const url = `/api/rsvp?eventId=${encodeURIComponent(eventId)}&name=${encodeURIComponent(name)}`;
      const response = await fetch(url, { cache: 'no-store' });
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
            headers: { 'Content-Type': 'application/json' },
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
