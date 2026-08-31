/* The Table's five areas.
 *
 * Run, Prepare, Players, NPCs, Review. Before this, The Table was one HP grid
 * and the DM's actual tools were rows in the profile menu — Console, Bench,
 * Character Sheets, Dossiers, four words you had to already know. The words
 * are plain now and the doors are here.
 */
const AREAS = ['run', 'prepare', 'players', 'npcs', 'review'];

function panels() {
  return Array.from(document.querySelectorAll('[data-table-panel]'));
}

function tabs() {
  return Array.from(document.querySelectorAll('[data-table-area]'));
}

let current = 'run';

export function setArea(area, { keepUrl = false } = {}) {
  current = AREAS.includes(area) ? area : 'run';
  panels().forEach((panel) => { panel.hidden = panel.dataset.tablePanel !== current; });
  tabs().forEach((tab) => {
    const active = tab.dataset.tableArea === current;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  if (keepUrl) return current;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('area', current);
    window.history.replaceState({}, '', url.toString());
  } catch (error) { /* the address is a convenience, not a dependency */ }
  return current;
}

function authHeaders() {
  const pwa = window.VOS_PWA;
  return pwa && pwa.authHeaders ? pwa.authHeaders() : {};
}

/* What is waiting on the DM, on the tab and on the medallion. A count, and
 * only of things that are genuinely actionable today — the Studio review
 * queue is a design project, and counting a queue that cannot be worked
 * would be a number that never goes down. */
async function loadReview() {
  const list = document.getElementById('vos-table-review-list');
  const empty = document.getElementById('vos-table-review-empty');
  const count = document.getElementById('vos-table-review-count');
  if (!list || !empty) return;

  let pending = [];
  try {
    const response = await fetch('/api/admin/lore-submissions', {
      cache: 'no-store', headers: authHeaders(),
    });
    if (response.ok) {
      const body = await response.json();
      pending = (body.submissions || []).filter((entry) =>
        ['submitted', 'drafting', 'needs_review'].includes(entry.status));
    }
  } catch (error) { /* an empty queue reads the same as an unreachable one */ }

  list.innerHTML = '';
  pending.forEach((entry) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'vos-row-chip';
    link.href = `/dm/?view=lore&submission=${encodeURIComponent(entry.id)}`;
    link.innerHTML = '<span></span><span class="vos-row-chip-arrow" aria-hidden="true">›</span>';
    const label = link.querySelector('span');
    const title = document.createElement('span');
    title.className = 'vos-row-chip-title';
    title.textContent = entry.title || entry.name || 'Untitled submission';
    const meta = document.createElement('span');
    meta.className = 'vos-row-chip-meta';
    meta.textContent = [entry.player_name, entry.status].filter(Boolean).join(' · ');
    label.append(title, meta);
    li.appendChild(link);
    list.appendChild(li);
  });
  list.hidden = !pending.length;
  empty.hidden = !!pending.length;

  if (count) {
    count.textContent = pending.length > 9 ? '9+' : String(pending.length);
    count.hidden = !pending.length;
  }
  // The same number on the middle of the tab bar, where the DM's medallion
  // used to wear somebody's hit points.
  const badge = document.querySelector('[data-vos-table-badge]');
  if (badge) {
    badge.textContent = pending.length > 9 ? '9+' : String(pending.length);
    badge.hidden = !pending.length;
  }
}

/* Preview lives under Players because opening someone's seat is a thing you
 * do to a person, and this is where the people are. */
async function renderRoster() {
  const host = document.getElementById('vos-table-roster');
  if (!host) return;
  let roster = [];
  try {
    const response = await fetch('/data/players.json', { cache: 'default' });
    if (response.ok) roster = await response.json();
  } catch (error) { /* fall through to the empty state below */ }

  host.innerHTML = '';
  const players = (Array.isArray(roster) ? roster : []).filter((p) => p.name && p.name !== 'DM');
  if (!players.length) {
    host.innerHTML = '<div class="vos-table-empty">No roster to preview.</div>';
    return;
  }
  players.forEach((player) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vos-table-preview-seat';
    button.innerHTML = `<span class="vos-table-preview-name"></span><span class="vos-table-preview-verb">Preview</span>`;
    button.querySelector('.vos-table-preview-name').textContent = player.display || player.name;
    button.setAttribute('aria-label', `Preview the app as ${player.display || player.name}`);
    button.addEventListener('click', async () => {
      const pwa = window.VOS_PWA;
      if (!pwa || !pwa.beginPreview) return;
      button.disabled = true;
      try {
        await pwa.beginPreview(player.name);
      } catch (error) {
        button.disabled = false;
        const note = document.createElement('span');
        note.className = 'vos-table-preview-error';
        note.textContent = error.message || 'Could not open that seat.';
        button.after(note);
      }
    });
    host.appendChild(button);
  });
}

export function initTable() {
  const bar = document.getElementById('vos-table-areas');
  if (!bar) return;

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-table-area]');
    if (!button) return;
    setArea(button.dataset.tableArea);
  });

  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const order = tabs();
    const at = order.findIndex((tab) => tab.dataset.tableArea === current);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const target = order[(at + step + order.length) % order.length];
    if (!target) return;
    event.preventDefault();
    setArea(target.dataset.tableArea);
    target.focus();
  });

  let asked = 'run';
  try { asked = (new URLSearchParams(window.location.search).get('area') || 'run').toLowerCase(); }
  catch (error) { /* default stands */ }
  setArea(asked, { keepUrl: true });

  renderRoster();
  loadReview();
}
