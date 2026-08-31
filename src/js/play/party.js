/* The DM's view of the table (/party/).
 *
 * Built for the question you ask twenty times a session: who is hurt, who is
 * about to go down, and what has everyone got left. One screen, no tapping
 * through to find out.
 *
 * The whole table is one call, refreshed on a slow poll — a session runs for
 * hours on a tablet, and a websocket for a five-player game would be machinery
 * for its own sake. Anything the DM does here refreshes immediately, so the
 * poll only ever catches what the players did on their own phones.
 */
import { createControls } from './controls.js';
import { sendOp } from './api.js';
import { initTable } from './table.js';

const REFRESH_MS = 12000;

const root = document.getElementById('vos-party-root');
const statusEl = document.getElementById('vos-party-status');

let party = [];
let timer = null;
let paused = false;

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]),
  );
}

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

async function fetchParty() {
  const response = await fetch('/api/play/party', { cache: 'no-store', headers: authHeaders() });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body.party || [];
}

/* ── Rendering ─────────────────────────────────────────────────────── */

function healthTone(current, max) {
  if (!max || current == null) return '';
  const pct = current / max;
  if (current === 0) return 'is-down';
  if (pct <= 0.25) return 'is-bloodied';
  if (pct <= 0.5) return 'is-hurt';
  return '';
}

function slotSummary(entry) {
  const slots = (entry.limits && entry.limits.slots) || {};
  const spent = entry.state.slots || {};
  const levels = Object.keys(slots).sort();
  if (!levels.length) return '';
  return levels.map((level) => {
    const max = slots[level];
    const left = Math.max(0, max - (spent[level] || 0));
    return `<span class="vos-party-slot${left ? '' : ' is-empty'}">
      <i>${esc(level)}</i>${left}<b>/${max}</b></span>`;
  }).join('');
}

function card(entry) {
  const s = entry.state;
  const max = (entry.limits && entry.limits.maxHp) || 0;
  const current = s.hp.current != null ? s.hp.current : max;
  const pct = max ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const dying = (s.conditions || []).includes('dying');
  const conditions = (s.conditions || []).filter((c) => c !== 'dying');
  const hitDiceLeft = Math.max(0, ((entry.limits && entry.limits.hitDice) || 0) - (s.hitDiceSpent || 0));

  if (!entry.hasStatblock) {
    return `<article class="vos-party-card is-missing">
      <h2>${esc(entry.playerName)}</h2>
      <p class="vos-party-none">No statblock pushed yet.</p>
    </article>`;
  }

  return `<article class="vos-party-card ${healthTone(current, max)}${dying ? ' is-dying' : ''}"
                   data-player="${esc(entry.playerName)}">
    <header class="vos-party-head">
      <h2>${esc(entry.character)}</h2>
      <span class="vos-party-class">${esc(entry.classLine || '')}</span>
      ${entry.ac != null ? `<span class="vos-party-ac">AC ${esc(entry.ac)}</span>` : ''}
    </header>

    <button type="button" class="vos-party-hp" data-act="hp"
            aria-label="${esc(entry.character)} hit points ${current} of ${max}">
      <span class="vos-party-hp-fill" style="width:${pct}%"></span>
      <span class="vos-party-hp-text">
        <b>${current}</b><i>/${max || '—'}</i>
        ${s.hp.temp ? `<em>+${s.hp.temp}</em>` : ''}
      </span>
      ${dying ? '<span class="vos-party-dying">Dying</span>' : ''}
    </button>

    ${s.exhaustion ? `<div class="vos-party-exh" title="−${s.exhaustion * 2} to d20 tests, −${
      s.exhaustion * 5} ft">
      ${Array.from({ length: 6 }, (_, i) =>
        `<span class="${i < s.exhaustion ? 'is-on' : ''}"></span>`).join('')}
      <b>Exhaustion ${s.exhaustion}</b>
    </div>` : ''}

    ${s.mask ? `<div class="vos-party-mask">
      ${esc(s.form ? s.form.creature : s.mask.key)}
    </div>` : ''}

    ${s.concentration ? `<div class="vos-party-conc">Concentrating: ${
      esc(s.concentration.spell)}</div>` : ''}

    ${Object.keys(s.active || {}).length ? `<div class="vos-party-active">${
      Object.values(s.active).map((f) => esc(f.name)).join(' · ')}</div>` : ''}

    <div class="vos-party-row">
      ${slotSummary(entry)}
      ${hitDiceLeft ? `<span class="vos-party-hd">${hitDiceLeft} HD</span>` : ''}
    </div>

    <div class="vos-party-conds">
      ${conditions.length
        ? conditions.map((c) => `<span>${esc(c)}</span>`).join('')
        : '<span class="is-empty">—</span>'}
    </div>

    <div class="vos-party-acts">
      <button type="button" data-act="damage">Damage</button>
      <button type="button" data-act="heal">Heal</button>
      <button type="button" data-act="conditions">Conditions</button>
      <button type="button" class="vos-party-view" data-act="preview"
              data-player="${esc(entry.playerName)}"
              title="Open the app as they see it">Preview</button>
      <a class="vos-party-view" href="/profile/?p=${encodeURIComponent(entry.playerName)}"
         title="Open their profile">Profile</a>
    </div>
  </article>`;
}

function render() {
  root.innerHTML = party.map(card).join('');
}

function setStatus(text, tone = '') {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = `vos-party-status${tone ? ` is-${tone}` : ''}`;
  }
}

/* ── Acting on someone ─────────────────────────────────────────────── */

/* One controls instance per action, bound to that player. The controls module
 * already knows how to target a named character — the DM path exists on the
 * server — so nothing here reimplements the sheets. */
function controlsFor(playerName) {
  const entry = party.find((p) => p.playerName === playerName);
  if (!entry) return null;
  return createControls({
    root,
    playerName,
    state: entry.state,
    limits: entry.limits,
    onState(next) {
      entry.state = next;
      render();
    },
  });
}

async function quickAmount(entry, mode) {
  const label = mode === 'heal' ? 'Heal' : 'Damage';
  const amount = Number(window.prompt(`${label} ${entry.character} by how much?`, '5'));
  if (!Number.isFinite(amount) || amount <= 0) return;
  try {
    const body = await sendOp({ op: mode === 'heal' ? 'heal' : 'damage', amount }, entry.playerName);
    entry.state = body.state;
    entry.limits = body.limits || entry.limits;
    render();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function onClick(event) {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const cardEl = button.closest('[data-player]');
  if (!cardEl) return;
  const entry = party.find((p) => p.playerName === cardEl.dataset.player);
  if (!entry) return;

  const action = button.dataset.act;
  if (action === 'damage' || action === 'heal') { quickAmount(entry, action); return; }
  if (action === 'preview') {
    const pwa = window.VOS_PWA;
    if (!pwa || !pwa.beginPreview) return;
    button.disabled = true;
    pwa.beginPreview(entry.playerName).catch((error) => {
      button.disabled = false;
      setStatus(error.message || 'Could not open that seat.', 'error');
    });
    return;
  }

  const controls = controlsFor(entry.playerName);
  if (!controls) return;
  if (action === 'hp') controls.openHpPad();
  if (action === 'conditions') controls.openConditions();
}

/* ── Polling ───────────────────────────────────────────────────────── */

async function refresh({ quiet = false } = {}) {
  if (!quiet) setStatus('Refreshing…');
  try {
    party = await fetchParty();
    render();
    setStatus(`Updated ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      setStatus('DM only.', 'error');
      stop();
      return;
    }
    setStatus(`Could not refresh — ${error.message}`, 'error');
  }
}

function start() {
  stop();
  timer = setInterval(() => { if (!paused && !document.hidden) refresh({ quiet: true }); }, REFRESH_MS);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

// A backgrounded tablet should not keep polling; catch up when it returns.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh({ quiet: true });
});

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;
  if (!name) {
    root.innerHTML = '<div class="empty-state"><b>Sign in to open the party view.</b>DM only.</div>';
    return;
  }
  if (!(name === 'DM' || (pwa && pwa.isDm && pwa.isDm()))) {
    root.innerHTML = '<div class="empty-state"><b>DM only.</b>Your own sheet lives at /sheet/.</div>';
    return;
  }

  root.addEventListener('click', onClick);
  const pauseButton = document.getElementById('vos-party-pause');
  if (pauseButton) {
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      pauseButton.textContent = paused ? 'Resume updates' : 'Pause updates';
      pauseButton.setAttribute('aria-pressed', String(paused));
      if (!paused) refresh();
    });
  }
  const refreshButton = document.getElementById('vos-party-refresh');
  if (refreshButton) refreshButton.addEventListener('click', () => refresh());

  await refresh();
  start();
}

/* The areas are the page; the party grid is one of them. Wired before the
   DM check so the tabs work even on the refusal screen. */
initTable();

if (root) boot();
