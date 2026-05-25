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
    {%- if campaign.nextGathering.timefulUrl %}
    <a class="vos-calendar-link" href="{{ campaign.nextGathering.timefulUrl }}" target="_blank" rel="noopener">Set Availability in Timeful</a>
    {%- endif %}
  </section>
</div>
