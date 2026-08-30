/* Calendar hub: DM-scheduled event grid + player availability form.
 *
 * Both surfaces render every month section up front (so availability marks
 * survive month flips) and a pager shows one month at a time:
 *  - #vos-cal-months     read-only grids of calendar_events, current month
 *                        through +6, big Prev/Next controls
 *  - #vos-avail-months   interactive 3-month availability window; the
 *                        Submit button always sends the whole window
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

  const AVAIL_MONTHS = 3;   // availability submission window
  const CAL_MONTHS = 7;     // group calendar paging horizon
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
  const RATING_CYCLE = ['preferred', 'available', 'unavailable'];
  const RATING_SYMBOLS = { preferred: '★', available: '✓', unavailable: '✕' };

  const today = new Date();

  function isoDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  const todayIso = isoDate(today);
  const availFrom = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const availTo = isoDate(new Date(today.getFullYear(), today.getMonth() + AVAIL_MONTHS, 0));
  const calFrom = availFrom;
  const calTo = isoDate(new Date(today.getFullYear(), today.getMonth() + CAL_MONTHS, 0));

  function monthDateAt(offset) {
    return new Date(today.getFullYear(), today.getMonth() + offset, 1);
  }

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

  // One-month-at-a-time pager. sections[i] is the month section for offset
  // i; showDots adds the per-month fill indicators (availability only).
  function attachPager(root, sections, options) {
    const pager = document.createElement('div');
    pager.className = 'vos-cal-pager';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'vos-cal-pager-btn';
    prev.textContent = '◀ Prev';
    prev.setAttribute('aria-label', 'Previous month');

    const label = document.createElement('div');
    label.className = 'vos-cal-pager-label';
    const labelText = document.createElement('div');
    label.appendChild(labelText);
    let dots = null;
    if (options && options.showDots) {
      dots = document.createElement('div');
      dots.className = 'vos-cal-pager-dots';
      sections.forEach(() => {
        const dot = document.createElement('span');
        dot.className = 'vos-cal-pager-dot';
        dots.appendChild(dot);
      });
      label.appendChild(dots);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'vos-cal-pager-btn';
    next.textContent = 'Next ▶';
    next.setAttribute('aria-label', 'Next month');

    pager.append(prev, label, next);
    root.prepend(pager);

    let current = 0;
    function show(index) {
      current = Math.max(0, Math.min(sections.length - 1, index));
      sections.forEach((section, i) => { section.hidden = i !== current; });
      labelText.textContent = monthTitle(monthDateAt(current));
      prev.disabled = current === 0;
      next.disabled = current === sections.length - 1;
      if (dots) refreshDots();
    }
    function refreshDots() {
      if (!dots) return;
      Array.from(dots.children).forEach((dot, i) => {
        dot.classList.toggle('is-current', i === current);
        dot.classList.toggle(
          'is-filled',
          !!(options.monthHasContent && options.monthHasContent(i))
        );
      });
    }
    prev.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    show(0);
    return { show, refreshDots };
  }

  // ── Event calendar (read-only) ──────────────────────────────────────

  async function initEventCalendar() {
    if (!calRoot) return;
    let events = [];
    try {
      // Signed-in readers get location and notes; anonymous readers get the
      // stripped shape. Waiting for the PWA client means the token is sent.
      await whenPwaReady();
      const response = await fetch(
        `/api/calendar/events?from=${calFrom}&to=${calTo}`,
        { cache: 'no-store', headers: authHeaders() }
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
    const sections = [];
    for (let offset = 0; offset < CAL_MONTHS; offset += 1) {
      const monthDate = monthDateAt(offset);
      const section = document.createElement('section');
      section.className = 'vos-cal-month';
      section.hidden = true;

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

      const monthKey = isoDate(monthDate).slice(0, 7);
      const monthEvents = events.filter((event) => event.date.slice(0, 7) === monthKey);
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
        empty.textContent = 'Nothing scheduled this month.';
        section.appendChild(empty);
      }
      sections.push(section);
      calRoot.appendChild(section);
    }
    attachPager(calRoot, sections, {});
  }

  // ── Availability form ───────────────────────────────────────────────

  async function initAvailabilityForm() {
    if (!availRoot) return;
    const statusEl = document.getElementById('vos-avail-status');
    const submitBtn = document.getElementById('vos-avail-submit');
    const updatedEl = document.getElementById('vos-avail-updated');
    const segDot = document.getElementById('vos-avail-dot');

    // date iso -> { rating, times: [] }
    const marks = new Map();
    const cells = new Map();
    const timeRows = new Map(); // month key -> container element
    let pager = null;

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.classList.toggle('is-error', !!isError);
    }

    function monthHasContent(offset) {
      const key = isoDate(monthDateAt(offset)).slice(0, 7);
      for (const iso of marks.keys()) {
        if (iso.slice(0, 7) === key) return true;
      }
      return false;
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
      if (pager) pager.refreshDots();
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
        // Weekends start grey (unrated) and cycle through the three
        // ratings forever — once rated, there's no going back to grey.
        if (!mark) {
          marks.set(iso, { rating: RATING_CYCLE[0], times: [] });
        } else {
          const next = (RATING_CYCLE.indexOf(mark.rating) + 1) % RATING_CYCLE.length;
          marks.set(iso, { rating: RATING_CYCLE[next], times: next === 2 ? [] : mark.times });
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
    const sections = [];
    for (let offset = 0; offset < AVAIL_MONTHS; offset += 1) {
      const monthDate = monthDateAt(offset);
      const monthKey = isoDate(monthDate).slice(0, 7);
      const section = document.createElement('section');
      section.className = 'vos-cal-month';
      section.hidden = true;

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

      sections.push(section);
      availRoot.appendChild(section);
    }
    pager = attachPager(availRoot, sections, { showDots: true, monthHasContent });

    async function prefill() {
      const pwa = await whenPwaReady();
      const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
      if (!name) {
        setStatus('Choose your name (tap Submit) to load your saved availability.');
        if (segDot) segDot.hidden = false;
        return;
      }
      try {
        const response = await fetch(
          `/api/availability?from=${availFrom}&to=${availTo}&name=${encodeURIComponent(name)}`,
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
        if (segDot) segDot.hidden = (data.entries || []).length > 0;
        pager.refreshDots();
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
        .filter(([iso]) => iso >= availFrom && iso <= availTo)
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
          body: JSON.stringify({ from: availFrom, to: availTo, name, entries }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setStatus(`Saved ${data.saved} day${data.saved === 1 ? '' : 's'}. Thanks!`);
        if (updatedEl) updatedEl.textContent = 'Last submitted just now';
        if (segDot) segDot.hidden = entries.length > 0;
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
