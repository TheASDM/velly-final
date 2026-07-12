/* Calendar page: DM-scheduled event grid + player availability form.
 *
 * Two independent surfaces, both driven from here:
 *  - #vos-cal-months     read-only month grids showing calendar_events
 *  - #vos-avail-months   interactive month grids where players mark
 *                        availability and submit it as a batch
 *
 * Availability rules (mirrors server-side validation):
 *  - Sat/Sun: tap cycles preferred -> available -> unavailable -> clear
 *  - Mon-Fri: tap toggles unavailable ("can't make that evening")
 *  - Saturdays marked preferred/available get morning/afternoon/evening
 *    multi-select chips rendered under the month
 */
(function () {
  const calRoot = document.getElementById('vos-cal-months');
  const availRoot = document.getElementById('vos-avail-months');
  if (!calRoot && !availRoot) return;

  const MONTHS_TO_SHOW = 3;
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
  const RATING_CYCLE = ['preferred', 'available', 'unavailable'];
  const RATING_SYMBOLS = { preferred: '★', available: '✓', unavailable: '✕' };

  const today = new Date();
  const rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const rangeEnd = new Date(today.getFullYear(), today.getMonth() + MONTHS_TO_SHOW, 0);

  function isoDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  const todayIso = isoDate(today);
  const rangeFrom = isoDate(rangeStart);
  const rangeTo = isoDate(rangeEnd);

  function monthTitle(date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function shortDate(iso) {
    const date = new Date(iso + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // pwa-client.js is a deferred script that may execute after this one;
  // identity helpers appear on window.VOS_PWA whenever it lands.
  function whenPwaReady(timeoutMs = 6000) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      (function poll() {
        if (window.VOS_PWA) return resolve(window.VOS_PWA);
        if (Date.now() - startedAt > timeoutMs) return resolve(null);
        setTimeout(poll, 80);
      })();
    });
  }

  function authHeaders(extra) {
    const pwa = window.VOS_PWA;
    if (pwa && pwa.authHeaders) return pwa.authHeaders(extra || {});
    return extra || {};
  }

  // Walks a month and hands each real day to the callback; returns the
  // grid element with weekday headers and leading blanks already placed.
  function buildMonthGrid(monthDate, makeDayCell) {
    const grid = document.createElement('div');
    grid.className = 'vos-cal-grid';
    DOW_LABELS.forEach((label) => {
      const dow = document.createElement('div');
      dow.className = 'vos-cal-dow';
      dow.textContent = label;
      grid.appendChild(dow);
    });
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    for (let i = 0; i < first.getDay(); i += 1) {
      const blank = document.createElement('div');
      blank.className = 'vos-cal-blank';
      grid.appendChild(blank);
    }
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum);
      grid.appendChild(makeDayCell(date, isoDate(date)));
    }
    return grid;
  }

  // ── Event calendar (read-only) ──────────────────────────────────────

  async function initEventCalendar() {
    if (!calRoot) return;
    let events = [];
    try {
      const response = await fetch(
        `/api/calendar/events?from=${rangeFrom}&to=${rangeTo}`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      if (response.ok && Array.isArray(data.events)) events = data.events;
    } catch (error) {
      calRoot.textContent = 'Could not load the calendar. Try again later.';
      return;
    }

    const byDate = {};
    events.forEach((event) => {
      (byDate[event.date] = byDate[event.date] || []).push(event);
    });

    calRoot.textContent = '';
    for (let offset = 0; offset < MONTHS_TO_SHOW; offset += 1) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const section = document.createElement('section');
      section.className = 'vos-cal-month';

      const title = document.createElement('h3');
      title.className = 'vos-cal-month-title';
      title.textContent = monthTitle(monthDate);
      section.appendChild(title);

      section.appendChild(buildMonthGrid(monthDate, (date, iso) => {
        const cell = document.createElement('div');
        cell.className = 'vos-cal-day';
        if (iso === todayIso) cell.classList.add('is-today');
        if (iso < todayIso) cell.classList.add('is-past');
        if (byDate[iso]) {
          cell.classList.add('has-event');
          cell.title = byDate[iso].map((event) => event.title).join(', ');
        }
        const num = document.createElement('span');
        num.className = 'vos-cal-day-num';
        num.textContent = date.getDate();
        cell.appendChild(num);
        if (byDate[iso]) {
          const dot = document.createElement('span');
          dot.className = 'vos-cal-day-dot';
          cell.appendChild(dot);
        }
        return cell;
      }));

      const monthEvents = events.filter((event) => event.date.slice(0, 7) === isoDate(monthDate).slice(0, 7));
      if (monthEvents.length) {
        const list = document.createElement('ul');
        list.className = 'vos-cal-events';
        monthEvents.forEach((event) => {
          const item = document.createElement('li');
          item.className = `vos-cal-event kind-${event.kind}`;
          const when = document.createElement('span');
          when.className = 'vos-cal-event-date';
          when.textContent = shortDate(event.date) + (event.timeLabel ? ` · ${event.timeLabel}` : '');
          const what = document.createElement('span');
          what.className = 'vos-cal-event-title';
          what.textContent = event.title + (event.location ? ` — ${event.location}` : '');
          item.appendChild(when);
          item.appendChild(what);
          if (event.notes) {
            const notes = document.createElement('span');
            notes.className = 'vos-cal-event-notes';
            notes.textContent = event.notes;
            item.appendChild(notes);
          }
          list.appendChild(item);
        });
        section.appendChild(list);
      } else {
        const empty = document.createElement('div');
        empty.className = 'vos-cal-empty';
        empty.textContent = 'Nothing scheduled yet.';
        section.appendChild(empty);
      }
      calRoot.appendChild(section);
    }
  }

  // ── Availability form ───────────────────────────────────────────────

  async function initAvailabilityForm() {
    if (!availRoot) return;
    const statusEl = document.getElementById('vos-avail-status');
    const submitBtn = document.getElementById('vos-avail-submit');
    const updatedEl = document.getElementById('vos-avail-updated');

    // date iso -> { rating, times: [] }
    const marks = new Map();
    const cells = new Map();
    const timeRows = new Map(); // month key -> container element

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.classList.toggle('is-error', !!isError);
    }

    function paintCell(iso) {
      const cell = cells.get(iso);
      if (!cell) return;
      const mark = marks.get(iso);
      cell.classList.remove('is-preferred', 'is-available', 'is-unavailable');
      const flag = cell.querySelector('.vos-cal-day-flag');
      if (mark) {
        cell.classList.add(`is-${mark.rating}`);
        flag.textContent = RATING_SYMBOLS[mark.rating];
      } else {
        flag.textContent = '';
      }
      const labels = {
        preferred: 'most preferred',
        available: 'can make it, prefer another day',
        unavailable: 'cannot make it',
      };
      cell.setAttribute('aria-pressed', mark ? 'true' : 'false');
      cell.setAttribute('aria-label', `${shortDate(iso)}${mark ? ': ' + labels[mark.rating] : ''}`);
    }

    function isGreenSaturday(iso) {
      const mark = marks.get(iso);
      return !!mark
        && mark.rating !== 'unavailable'
        && new Date(iso + 'T00:00:00').getDay() === 6;
    }

    // Time-of-day chips for every green Saturday in the month, kept in
    // date order regardless of the order days were tapped in.
    function renderTimeRows(monthKey) {
      const container = timeRows.get(monthKey);
      if (!container) return;
      container.textContent = '';
      const saturdays = Array.from(marks.keys())
        .filter((iso) => iso.slice(0, 7) === monthKey && isGreenSaturday(iso))
        .sort();
      if (!saturdays.length) {
        container.hidden = true;
        return;
      }
      container.hidden = false;
      const heading = document.createElement('div');
      heading.className = 'vos-avail-times-heading';
      heading.textContent = 'Saturday times that work for you';
      container.appendChild(heading);
      saturdays.forEach((iso) => {
        const row = document.createElement('div');
        row.className = 'vos-avail-times-row';
        const label = document.createElement('span');
        label.className = 'vos-avail-times-date';
        label.textContent = shortDate(iso);
        row.appendChild(label);
        TIME_SLOTS.forEach((slot) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'vos-avail-time-chip';
          chip.textContent = slot.charAt(0).toUpperCase() + slot.slice(1);
          const mark = marks.get(iso);
          const active = mark.times.includes(slot);
          chip.classList.toggle('is-selected', active);
          chip.setAttribute('aria-pressed', active ? 'true' : 'false');
          chip.addEventListener('click', () => {
            const current = marks.get(iso);
            if (!current) return;
            if (current.times.includes(slot)) {
              current.times = current.times.filter((t) => t !== slot);
            } else {
              current.times = TIME_SLOTS.filter((t) => current.times.includes(t) || t === slot);
            }
            renderTimeRows(monthKey);
          });
          row.appendChild(chip);
        });
        container.appendChild(row);
      });
    }

    function handleDayTap(iso, dayOfWeek) {
      const mark = marks.get(iso);
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (!mark) {
          marks.set(iso, { rating: RATING_CYCLE[0], times: [] });
        } else {
          const next = RATING_CYCLE.indexOf(mark.rating) + 1;
          if (next >= RATING_CYCLE.length) marks.delete(iso);
          else marks.set(iso, { rating: RATING_CYCLE[next], times: next === 2 ? [] : mark.times });
        }
      } else {
        // Weekdays: red toggle only ("can't make that evening").
        if (mark) marks.delete(iso);
        else marks.set(iso, { rating: 'unavailable', times: [] });
      }
      paintCell(iso);
      renderTimeRows(iso.slice(0, 7));
      setStatus('');
    }

    availRoot.textContent = '';
    for (let offset = 0; offset < MONTHS_TO_SHOW; offset += 1) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const monthKey = isoDate(monthDate).slice(0, 7);
      const section = document.createElement('section');
      section.className = 'vos-cal-month';

      const title = document.createElement('h3');
      title.className = 'vos-cal-month-title';
      title.textContent = monthTitle(monthDate);
      section.appendChild(title);

      section.appendChild(buildMonthGrid(monthDate, (date, iso) => {
        const isPast = iso < todayIso;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'vos-cal-day vos-avail-day';
        cell.disabled = isPast;
        if (iso === todayIso) cell.classList.add('is-today');
        if (isPast) cell.classList.add('is-past');
        const dow = date.getDay();
        if (dow === 0 || dow === 6) cell.classList.add('is-weekend');

        const num = document.createElement('span');
        num.className = 'vos-cal-day-num';
        num.textContent = date.getDate();
        cell.appendChild(num);
        const flag = document.createElement('span');
        flag.className = 'vos-cal-day-flag';
        flag.setAttribute('aria-hidden', 'true');
        cell.appendChild(flag);

        cell.addEventListener('click', () => handleDayTap(iso, dow));
        cells.set(iso, cell);
        return cell;
      }));

      const times = document.createElement('div');
      times.className = 'vos-avail-times';
      times.hidden = true;
      timeRows.set(monthKey, times);
      section.appendChild(times);

      availRoot.appendChild(section);
    }

    async function prefill() {
      const pwa = await whenPwaReady();
      const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
      if (!name) {
        setStatus('Choose your name (tap Submit) to load your saved availability.');
        return;
      }
      try {
        const response = await fetch(
          `/api/availability?from=${rangeFrom}&to=${rangeTo}&name=${encodeURIComponent(name)}`,
          { cache: 'no-store', headers: authHeaders() }
        );
        if (!response.ok) return;
        const data = await response.json();
        (data.entries || []).forEach((entry) => {
          marks.set(entry.date, {
            rating: entry.rating,
            times: Array.isArray(entry.times) ? entry.times : [],
          });
          paintCell(entry.date);
        });
        timeRows.forEach((_container, monthKey) => renderTimeRows(monthKey));
        if (updatedEl && data.updated_at) {
          updatedEl.textContent = `Last submitted ${new Date(data.updated_at).toLocaleDateString()}`;
        }
      } catch (error) {
        /* prefill is best-effort */
      }
    }

    async function submit() {
      const pwa = await whenPwaReady();
      const name = pwa && pwa.ensureIdentity ? await pwa.ensureIdentity() : null;
      if (!name) {
        setStatus('Choose your name first.', true);
        return;
      }
      const entries = Array.from(marks.entries())
        .filter(([iso]) => iso >= rangeFrom && iso <= rangeTo)
        .map(([date, mark]) => ({
          date,
          rating: mark.rating,
          times: isGreenSaturday(date) ? mark.times : [],
        }));

      submitBtn.disabled = true;
      setStatus('Saving…');
      try {
        const response = await fetch('/api/availability', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ from: rangeFrom, to: rangeTo, name, entries }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setStatus(`Saved ${data.saved} day${data.saved === 1 ? '' : 's'}. Thanks!`);
        if (updatedEl) updatedEl.textContent = 'Last submitted just now';
      } catch (error) {
        setStatus(error.message, true);
      } finally {
        submitBtn.disabled = false;
      }
    }

    if (submitBtn) submitBtn.addEventListener('click', submit);
    prefill();
  }

  initEventCalendar();
  initAvailabilityForm();
})();
