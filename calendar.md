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
@media (max-width: 560px) {
  .vos-calendar-panel {
    padding: 1rem;
  }
  .vos-calendar-date {
    font-size: 1.75rem;
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
      {%- if gathering.timefulUrl %}
      <a class="vos-calendar-link" href="{{ gathering.timefulUrl }}" target="_blank" rel="noopener">Set Availability in Timeful</a>
      {%- endif %}
      {%- if gathering.dateIso %}
      <a class="vos-calendar-link" href="/api/calendar/{{ gathering.eventId }}.ics">Add to Calendar</a>
      {%- endif %}
    </div>
  </section>
  {%- endfor %}
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
