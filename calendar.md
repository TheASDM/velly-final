---
title: Calendar
description: Next Valley of Shadows gathering.
permalink: /calendar/
templateEngineOverride: njk
---

<style>
.vos-calendar {
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  gap: 0.9rem;
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
.vos-calendar-countdown {
  display: inline-flex;
  align-items: center;
  margin: 0 0 0.85rem;
  padding: 0.32rem 0.7rem;
  border: 1px solid rgba(212, 165, 116, 0.38);
  border-radius: 999px;
  background: rgba(212, 165, 116, 0.08);
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1;
  text-transform: uppercase;
}
.vos-calendar-countdown[hidden] {
  display: none;
}
.vos-calendar-where {
  color: var(--vos-cream);
  font-size: 1.1rem;
}
.vos-calendar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.2rem;
}
.vos-calendar-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  margin-top: 1rem;
  padding-top: 0.95rem;
  border-top: 1px solid rgba(139,115,85,0.24);
}
.vos-calendar-tasks {
  margin-top: 1rem;
}
.vos-calendar-section-title {
  margin: 0.25rem 0 0.9rem;
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.25rem, 4vw, 1.7rem);
  line-height: 1.15;
}
.vos-cal-months {
  display: grid;
  gap: 1.4rem;
  color: var(--vos-cream);
}
.vos-cal-month-title {
  margin: 0 0 0.5rem;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.vos-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.vos-cal-dow {
  padding: 0.2rem 0;
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}
.vos-cal-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-height: 44px;
  padding: 0.2rem 0;
  border: 1px solid rgba(139,115,85,0.22);
  border-radius: 6px;
  background: rgba(18,16,23,0.6);
  color: var(--vos-cream);
  font-size: 0.85rem;
  line-height: 1;
}
.vos-cal-day.is-today {
  border-color: var(--vos-gold-bright);
  box-shadow: 0 0 0 1px rgba(212,165,116,0.45);
}
.vos-cal-day.is-past {
  opacity: 0.35;
}
.vos-cal-day.has-event {
  border-color: rgba(212,165,116,0.65);
  background: rgba(212,165,116,0.12);
}
.vos-cal-day-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--vos-gold-bright);
}
.vos-cal-day-flag {
  font-size: 0.7rem;
  min-height: 0.75rem;
}
.vos-cal-blank {
  min-height: 44px;
}
.vos-cal-events {
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.45rem;
}
.vos-cal-event {
  display: grid;
  gap: 0.1rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid rgba(212,165,116,0.3);
  border-left: 3px solid var(--vos-gold-bright);
  border-radius: 6px;
  background: rgba(212,165,116,0.07);
}
.vos-cal-event.kind-deadline {
  border-left-color: #b3402f;
}
.vos-cal-event-date {
  color: var(--vos-gold-bright);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.vos-cal-event-title {
  color: var(--vos-cream);
  font-size: 0.95rem;
}
.vos-cal-event-notes {
  color: rgba(232,220,200,0.7);
  font-size: 0.82rem;
}
.vos-cal-empty {
  margin-top: 0.6rem;
  color: rgba(232,220,200,0.55);
  font-size: 0.85rem;
  font-style: italic;
}
/* Availability marking */
button.vos-avail-day {
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  -webkit-tap-highlight-color: transparent;
}
button.vos-avail-day:disabled {
  cursor: default;
}
.vos-avail-day.is-weekend {
  border-color: rgba(201,161,74,0.4);
}
.vos-avail-day.is-preferred {
  background: rgba(38,110,52,0.75);
  border-color: rgba(76,175,80,0.8);
  color: #eaf5e6;
}
.vos-avail-day.is-available {
  background: rgba(104,159,56,0.4);
  border-color: rgba(156,204,101,0.7);
  color: #eaf5e6;
}
.vos-avail-day.is-unavailable {
  background: rgba(140,44,32,0.55);
  border-color: rgba(198,83,64,0.75);
  color: #f6e2dd;
}
.vos-avail-legend {
  display: grid;
  gap: 0.35rem;
  margin: 0 0 0.75rem;
}
.vos-avail-legend-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--vos-cream);
  font-size: 0.88rem;
}
.vos-avail-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(139,115,85,0.4);
  font-size: 0.75rem;
}
.vos-avail-swatch.is-preferred {
  background: rgba(38,110,52,0.75);
  border-color: rgba(76,175,80,0.8);
  color: #eaf5e6;
}
.vos-avail-swatch.is-available {
  background: rgba(104,159,56,0.4);
  border-color: rgba(156,204,101,0.7);
  color: #eaf5e6;
}
.vos-avail-swatch.is-unavailable {
  background: rgba(140,44,32,0.55);
  border-color: rgba(198,83,64,0.75);
  color: #f6e2dd;
}
.vos-avail-help {
  margin: 0 0 1rem;
  color: rgba(232,220,200,0.78);
  font-size: 0.88rem;
  line-height: 1.5;
}
.vos-avail-times {
  margin-top: 0.7rem;
  display: grid;
  gap: 0.45rem;
}
.vos-avail-times-heading {
  color: var(--vos-gold-dim);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.vos-avail-times-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}
.vos-avail-times-date {
  min-width: 6.2rem;
  color: var(--vos-cream);
  font-size: 0.85rem;
}
.vos-avail-time-chip {
  padding: 0.35rem 0.7rem;
  min-height: 34px;
  border: 1px solid rgba(139,115,85,0.4);
  border-radius: 999px;
  background: rgba(18,16,23,0.6);
  color: var(--vos-cream);
  font-size: 0.78rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.vos-avail-time-chip.is-selected {
  background: rgba(38,110,52,0.7);
  border-color: rgba(76,175,80,0.8);
  color: #eaf5e6;
}
.vos-avail-footer {
  margin-top: 1.1rem;
  display: grid;
  gap: 0.45rem;
  justify-items: start;
}
.vos-avail-submit {
  border-color: var(--vos-gold-bright);
  background: rgba(212,165,116,0.12);
  cursor: pointer;
  font: inherit;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}
.vos-avail-submit:disabled {
  opacity: 0.55;
  cursor: default;
}
.vos-avail-status {
  color: var(--vos-cream);
  font-size: 0.85rem;
  min-height: 1.1em;
}
.vos-avail-status.is-error {
  color: #e08573;
}
.vos-avail-updated {
  color: rgba(232,220,200,0.55);
  font-size: 0.78rem;
}
@media (max-width: 560px) {
  .vos-calendar-panel {
    padding: 1rem;
  }
  .vos-calendar-date {
    font-size: 1.75rem;
  }
  .vos-cal-day,
  .vos-cal-blank {
    min-height: 40px;
  }
  .vos-avail-times-date {
    min-width: 100%;
  }
}
</style>

<div class="vos-calendar">
  {%- set gatherings = campaign.nextGatherings -%}
  {%- if not gatherings or not gatherings.length -%}
    {%- set gatherings = [campaign.nextGathering] -%}
  {%- endif -%}
  {%- for gathering in gatherings %}
  <section class="vos-calendar-panel" aria-labelledby="vos-next-gathering-title-{{ loop.index }}">
    <div class="vos-calendar-kicker">Next Gathering</div>
    <h2 id="vos-next-gathering-title-{{ loop.index }}" class="vos-calendar-date">{{ gathering.date }}</h2>
    {%- if gathering.dateIso %}
    <div class="vos-calendar-countdown" data-date-iso="{{ gathering.dateIso }}" hidden aria-live="polite">...</div>
    {%- endif %}
    <div class="vos-calendar-where">{{ gathering.timeLocation }}</div>
    <ul class="vos-task-list vos-calendar-tasks">
      {%- for task in gathering.tasks %}
      <li class="vos-task-row"{% if task.dueIso %} data-reminder-date="{{ task.dueIso }}"{% endif %}>
        <span class="vos-task-check" aria-hidden="true">✓</span>
        <span class="vos-task-main">{{ task.text }}</span>
        {%- if task.due %}<span class="vos-task-date">Due {{ task.due }}</span>{%- endif %}
      </li>
      {%- endfor %}
    </ul>
    <div class="vos-rsvp">
      <div class="vos-calendar-kicker">RSVP</div>
      {% set rsvpEventId = gathering.eventId %}
      {% include "partials/rsvp-control.njk" %}
    </div>
    <div class="vos-calendar-actions">
      {%- if gathering.dateIso %}
      <a class="vos-calendar-link" href="/api/calendar/{{ gathering.eventId }}.ics">Add to Calendar</a>
      {%- endif %}
    </div>
  </section>
  {%- endfor %}

  <section class="vos-calendar-panel" aria-labelledby="vos-schedule-title">
    <div class="vos-calendar-kicker">Schedule</div>
    <h2 id="vos-schedule-title" class="vos-calendar-section-title">The Next Three Months</h2>
    <div id="vos-cal-months" class="vos-cal-months">Loading the calendar…</div>
  </section>

  <section class="vos-calendar-panel" aria-labelledby="vos-availability-title">
    <div class="vos-calendar-kicker">Your Availability</div>
    <h2 id="vos-availability-title" class="vos-calendar-section-title">When Can You Play?</h2>
    <div class="vos-avail-legend">
      <div class="vos-avail-legend-row"><span class="vos-avail-swatch is-preferred">★</span> Most preferred</div>
      <div class="vos-avail-legend-row"><span class="vos-avail-swatch is-available">✓</span> Can make it, but prefer another day</div>
      <div class="vos-avail-legend-row"><span class="vos-avail-swatch is-unavailable">✕</span> Can&rsquo;t make it</div>
    </div>
    <p class="vos-avail-help">
      Tap Saturdays and Sundays to cycle through the three marks. On weekdays,
      only mark the evenings you <strong>can&rsquo;t</strong> make &mdash; one tap marks
      a weekday red, another clears it. For Saturdays you can make, pick which
      times of day work. Nothing is shared until you hit Submit.
    </p>
    <div id="vos-avail-months" class="vos-cal-months"></div>
    <div class="vos-avail-footer">
      <button id="vos-avail-submit" class="vos-calendar-link vos-avail-submit" type="button">Submit Availability</button>
      <div id="vos-avail-status" class="vos-avail-status" role="status" aria-live="polite"></div>
      <div id="vos-avail-updated" class="vos-avail-updated"></div>
    </div>
  </section>
</div>

<script>
(function () {
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function relative(iso) {
    const isDateOnly = iso.length <= 10;
    const now = new Date();
    const target = new Date(isDateOnly ? iso + 'T00:00:00' : iso);
    if (Number.isNaN(target.getTime())) return null;

    if (isDateOnly) {
      const days = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
      if (days < 0) return 'In the past';
      if (days === 0) return 'Today';
      if (days === 1) return 'Tomorrow';
      if (days < 14) return `In ${days} days`;
      if (days < 60) {
        const weeks = Math.round(days / 7);
        return weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`;
      }
      return target.toLocaleDateString();
    }

    const ms = target - now;
    if (ms < -60000) return 'In the past';
    if (ms < 60000) return 'Starting now';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return minutes === 1 ? 'In 1 minute' : `In ${minutes} minutes`;
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return hours === 1 ? 'In 1 hour' : `In ${hours} hours`;
    const days = Math.floor(ms / 86400000);
    if (days < 14) return days === 1 ? 'Tomorrow' : `In ${days} days`;
    const weeks = Math.round(days / 7);
    return weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`;
  }

  function tickOne(el) {
    const iso = el.getAttribute('data-date-iso');
    if (!iso) return;
    const text = relative(iso);
    if (!text) return;
    el.textContent = text;
    el.hidden = false;
  }

  const countdowns = Array.from(document.querySelectorAll('.vos-calendar-countdown[data-date-iso]'));
  countdowns.forEach(tickOne);
  // Once a minute is plenty for the date-only case and not wasteful for
  // datetime entries — the label only changes on hour/day boundaries.
  setInterval(() => countdowns.forEach(tickOne), 60 * 1000);
})();
</script>
<script src="/js/vos-calendar.js" defer></script>
