/* The player's own character sheet (/sheet/).
 *
 * Two views of one character: the story sheet the DM writes, and the statblock
 * imported from Foundry. Both come from /api/sheet in a single response, which
 * resolves whose they are from the token — there is nothing here that selects a
 * player, and that is the point.
 */
import { renderSheet, sheetSections } from './render.js';
import { loadAllSheets, loadHandouts, loadMySheet, loadRoster, whenPwaReady } from './data.js';
import { normalizeStatblock } from '../statblock/normalize.js';
import { renderStatblock } from '../statblock/render.js';
import { barLabel } from '../statblock/labels.js';
import { wireImageZoom } from '../components/image-zoom.js';
import { loadPlayState } from '../play/api.js';
import { createControls } from '../play/controls.js';

const root = document.getElementById('vos-sheet-root');
const indexEl = document.getElementById('vos-sheet-index');
const tabsEl = document.getElementById('vos-sheet-tabs');

let payload = null;
let seat = {};
let view = 'story';
let play = null;        // { state, limits } — null until the stats tab is opened
/* null until the tab is opened; then the list, or 'error'. Lazy for the same
 * reason play state is — most sheet opens never look here. */
let handouts = null;
let controls = null;
/* Set when the DM is viewing someone else's sheet. Everything downstream reads
 * it, so "view as" is the same page rather than a second implementation that
 * could drift from what the player actually sees. */
let viewingAs = null;
let statModel = null;
/* Entry ids (features, spells, items) this player has tucked away. A reading
 * preference, not play state, so it lives on the device rather than the
 * server — keyed by player name so the DM viewing as someone does not
 * overwrite their own. */
let hidden = new Set();
/* Resource ids the player put on the play bar themselves. The same kind of
 * preference as hiding, stored the same way. */
let pinned = new Set();

function prefKey(kind) {
  return `vos-sheet-${kind}:${payload && payload.playerName ? payload.playerName : ''}`;
}

function loadPrefs() {
  const read = (kind) => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(prefKey(kind)) || '[]'));
    } catch (error) {
      return new Set();
    }
  };
  hidden = read('hidden');
  pinned = read('pinned');
}

function savePref(kind, values) {
  try {
    window.localStorage.setItem(prefKey(kind), JSON.stringify([...values]));
  } catch (error) { /* private mode — the preference still works until reload */ }
}

function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

function notice(message, detail) {
  if (indexEl) indexEl.hidden = true;
  if (tabsEl) tabsEl.hidden = true;
  root.innerHTML = `<div class="empty-state"><b>${esc(message)}</b>${esc(detail || '')}</div>`;
}

function renderIndex(markdown) {
  if (!indexEl) return;
  const sections = markdown ? sheetSections(markdown) : [];
  if (sections.length < 3) { indexEl.hidden = true; return; }
  indexEl.innerHTML = sections
    .map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`)
    .join('');
  indexEl.hidden = false;
}

function renderTabs() {
  if (!tabsEl) return;
  const available = {
    story: Boolean(payload.sheet && payload.sheet.markdown),
    stats: Boolean(payload.statblock && payload.statblock.data),
    // Handouts are always offered: an empty tab that explains itself beats a
    // tab that appears the first time the DM slips you something.
    handouts: true,
  };
  // With only one view there is nothing to switch between.
  if (Object.values(available).filter(Boolean).length < 2) { tabsEl.hidden = true; return; }
  tabsEl.hidden = false;
  tabsEl.querySelectorAll('[data-view]').forEach((button) => {
    const name = button.dataset.view;
    button.classList.toggle('is-on', view === name);
    button.setAttribute('aria-selected', String(view === name));
    button.disabled = !available[name];
  });
}

function render() {
  const hasStory = Boolean(payload.sheet && payload.sheet.markdown);
  const hasStats = Boolean(payload.statblock && payload.statblock.data);
  if (view === 'story' && !hasStory) view = 'stats';
  if (view === 'stats' && !hasStats) view = 'story';

  renderTabs();

  if (view === 'handouts') {
    renderHandoutsView();
    renderPlayBar();          // removes it — the bar belongs to the stats view
    renderMaskBanner();
    if (indexEl) indexEl.hidden = true;
    return;
  }

  if (view === 'stats') {
    if (!statModel) statModel = normalizeStatblock(payload.statblock.data);
    root.innerHTML = renderStatblock(statModel, {
      play: play && play.state,
      limits: play && play.limits,
      interactive: Boolean(play),
      // The app bar carries the name; the sheet keeps one quiet identity line.
      identity: 'compact',
      hidden,
      hideable: true,
      pinned,
    });
    renderPlayBar();
    renderMaskBanner();
    renderFormBlock();
    if (indexEl) indexEl.hidden = true;
    return;
  }

  const markdown = payload.sheet.markdown;
  root.innerHTML = renderSheet(markdown, {
    eyebrow: 'Character sheet',
    fallbackTitle: seat.display || payload.playerName,
  });
  renderIndex(markdown);
}

/* ── Handouts ──────────────────────────────────────────────────────── */

/* What the DM has handed this character — and only this character. The list
 * never says who else received a copy; to each reader, a letter is a letter. */
function renderHandoutsView() {
  if (handouts === null) {
    root.innerHTML = '<div class="empty-state"><b>Opening the folder…</b>One moment.</div>';
    ensureHandouts();
    return;
  }
  if (handouts === 'error') {
    root.innerHTML = '<div class="empty-state"><b>Could not load your handouts.</b>Try again in a moment.</div>';
    return;
  }
  if (!handouts.length) {
    root.innerHTML = `<div class="empty-state"><b>Nothing in the folder yet.</b>
      When the DM hands ${viewingAs ? 'them' : 'you'} something — a letter, a map, a torn page — it appears here.</div>`;
    return;
  }

  root.innerHTML = `<div class="vos-handouts">${handouts.map((handout, index) => `
    <details class="vos-handout"${index === 0 ? ' open' : ''}>
      <summary>
        <span class="vos-handout-title">${esc(handout.title)}</span>
        <span class="vos-handout-date">${esc(handoutDate(handout))}</span>
      </summary>
      <div class="vos-handout-body">${renderSheet(handout.markdown, {
    fallbackTitle: handout.title,
  })}</div>
    </details>`).join('')}</div>`;
}

function handoutDate(handout) {
  const stamp = handout.updated_at || handout.created_at;
  const date = stamp ? new Date(stamp) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
}

async function ensureHandouts() {
  try {
    const body = await loadHandouts(viewingAs);
    handouts = body.handouts || [];
  } catch (error) {
    handouts = 'error';
  }
  if (view === 'handouts') render();
}

/* Whose sheet this is. Unmistakable, because acting here changes their
 * character rather than yours. */
function renderViewingAs() {
  if (!viewingAs) return;
  if (document.getElementById('vos-viewing-as')) return;
  const bar = document.createElement('div');
  bar.id = 'vos-viewing-as';
  bar.className = 'vos-viewing-as';
  bar.innerHTML = `<span>Viewing as <b>${esc(seat.display || viewingAs)}</b> — changes apply to them</span>
    <a href="/party/">Back to the table</a>`;
  const page = document.querySelector('.vos-sheet-page');
  if (page) page.insertBefore(bar, page.firstChild);
}

/* The mask banner: what is worn, and the ways out of it. No countdown — the
 * ten minutes are game time, and a wall clock ticking through table talk was
 * always wrong. The table keeps the time; the banner keeps the buttons. */
function renderMaskBanner() {
  let banner = document.getElementById('vos-mask-banner');
  const mask = play && play.state.mask;
  if (view !== 'stats' || !mask) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'vos-mask-banner';
    banner.className = 'vos-mask-banner';
    root.parentNode.insertBefore(banner, root);
    banner.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mask-action]');
      if (!button || !controls) return;
      const action = button.dataset.maskAction;
      if (action === 'form') controls.openForms();
      if (action === 'revert') controls.apply({ op: 'revertForm' });
      if (action === 'remove') controls.apply({ op: 'removeMask' });
    });
  }

  const form = play.state.form;
  banner.innerHTML = `
    <span class="vos-mask-name">${form ? form.creature : mask.key}</span>
    ${form
      ? '<button type="button" class="vos-mask-btn is-text" data-mask-action="revert">Revert</button>'
      : '<button type="button" class="vos-mask-btn is-text" data-mask-action="form">Assume form</button>'}
    <button type="button" class="vos-mask-btn is-text" data-mask-action="remove">Remove</button>`;
}

/* The bar lives at the bottom because that is where a thumb is. It holds
 * what this character touches every round and nothing else. */
/* Only a College of the Masquerade bard has masks, and the sheet says so —
 * the feature is on the character or it is not. */
function hasMasks() {
  return Boolean(statModel && (statModel.features || [])
    .some((f) => (f.name || '').toLowerCase().startsWith('maschera ')));
}

/* What goes on the bar is read from the character, not from a list of names
 * kept in step by hand: features you switch on (Rage), Bonus-Action charges
 * you spend (Bardic Inspiration, Adrenaline Rush), spells a feature casts for
 * free (Hunter's Mark), a pact caster's slots, and once-per-turn riders
 * (Sneak Attack). Each is a shape in the statblock, so the five characters
 * get five different bars from the same code. */
function spentOf(id) {
  return Number(((play && play.state.uses) || {})[id] || 0);
}

function chargesLeft(feature) {
  return Math.max(0, feature.uses.max - spentOf(feature.id));
}

function renderFeatureButtons() {
  const active = (play && play.state.active) || {};

  return ((statModel && statModel.activatable) || []).map((feature) => {
    const left = chargesLeft(feature);
    const on = Boolean(active[feature.id]);
    return `<button type="button" class="vos-play-bar-btn is-feature${
      on ? ' is-on' : ''}${!on && !left ? ' is-spent' : ''}"
      data-bar="feature" data-feature="${esc(feature.id)}"
      aria-pressed="${on}" title="${esc(feature.name)}"
      aria-label="${esc(feature.name)}: ${on ? 'active' : `${left} of ${feature.uses.max} uses left`}">
      ${esc(barLabel(feature.name))}<b>${on ? 'ON' : left}</b>
    </button>`;
  }).join('');
}

/* Resources the player pinned to the bar themselves — Lucky, a lineage trait,
 * whatever they reach for often enough to want under a thumb. Anything a
 * structural rule already placed is skipped rather than doubled. */
function pinnedExtras() {
  if (!statModel) return [];
  const taken = new Set([
    ...(statModel.activatable || []).map((f) => f.id),
    ...(statModel.quickSpend || []).map((f) => f.id),
    ...(statModel.freeCasts || []).map((f) => f.id),
    statModel.maskUses && statModel.maskUses.id,
  ].filter(Boolean));
  return [...pinned]
    .filter((id) => !taken.has(id))
    .map((id) => (statModel.features || []).find((f) => f.id === id))
    .filter((f) => f && f.uses && f.uses.max > 0)
    .map((f) => ({ id: f.id, name: f.name, uses: f.uses, tempHp: 0 }));
}

function quickSpendEntries() {
  return [...((statModel && statModel.quickSpend) || []), ...pinnedExtras()];
}

function renderQuickSpendButtons() {
  return quickSpendEntries().map((feature) => {
    const left = chargesLeft(feature);
    return `<button type="button" class="vos-play-bar-btn is-feature${left ? '' : ' is-spent'}"
      data-bar="spend" data-feature="${esc(feature.id)}" title="${esc(feature.name)}"
      aria-label="${esc(feature.name)}: ${left} of ${feature.uses.max} uses left">
      ${esc(barLabel(feature.name))}<b>${left}</b>
    </button>`;
  }).join('');
}

function renderFreeCastButtons() {
  const conc = play && play.state.concentration;
  return ((statModel && statModel.freeCasts) || []).map((entry) => {
    const on = Boolean(entry.concentration && conc && conc.spell === entry.spellName);
    const left = chargesLeft(entry);
    return `<button type="button" class="vos-play-bar-btn is-feature${
      on ? ' is-on' : ''}${!on && !left ? ' is-spent' : ''}"
      data-bar="cast" data-feature="${esc(entry.id)}"
      aria-pressed="${on}" title="${esc(entry.spellName)} — ${esc(entry.featureName)}"
      aria-label="${esc(entry.spellName)}: ${on ? 'active' : `${left} free casts left`}">
      ${esc(barLabel(entry.spellName))}<b>${on ? 'ON' : left}</b>
    </button>`;
  }).join('');
}

/* A warlock's two slots ARE their casting — they earn a place on the bar
 * itself, where a wizard's nine levels of pips would not fit and stay in the
 * sheet body. Only when every slot is pact. */
function renderPactPips() {
  const sc = statModel && statModel.spellcasting;
  if (!sc || !sc.slots.length || !sc.slots.every((slot) => slot.pact)) return '';
  const slot = sc.slots[0];
  const spent = Number((play && play.state.pact) || 0);
  const left = Math.max(0, slot.max - spent);
  const pips = Array.from({ length: slot.max }, (_, i) => {
    const used = i >= left;
    return `<span class="vos-play-bar-pip${used ? ' is-spent' : ''}" role="button" tabindex="0"
      data-bar="pact-pip" data-spent="${used ? '1' : '0'}"
      aria-label="Pact slot, ${used ? 'spent — tap to restore' : 'available — tap to spend'}"></span>`;
  }).join('');
  return `<div class="vos-play-bar-pact" aria-label="${left} of ${slot.max} pact slots left">
    <span class="vos-play-bar-pact-label">Pact${slot.level ? ` ${slot.level}` : ''}</span>
    <span class="vos-play-bar-pact-pips">${pips}</span>
  </div>`;
}

function renderPerTurnChips() {
  return ((statModel && statModel.perTurn) || []).map((feature) =>
    `<button type="button" class="vos-play-bar-btn is-rule"
      data-bar="rule" data-feature="${esc(feature.id)}"
      title="${esc(feature.name)} — once per turn" aria-label="${esc(feature.name)} rules">
      ${esc(barLabel(feature.name))}<i>1/turn</i>
    </button>`).join('');
}

/* Offered only in the moment it applies: Dying, with the feature unspent.
 * It sits beside the hit points because that is where the eyes already are. */
function renderRescueButton(dying) {
  const feature = statModel && statModel.zeroHpRescue;
  if (!dying || !feature || !chargesLeft(feature)) return '';
  return `<button type="button" class="vos-play-bar-btn is-rescue" data-bar="rescue"
    title="${esc(feature.name)}">Stand at 1 HP</button>`;
}

function renderPlayBar() {
  const page = document.querySelector('.vos-sheet-page');
  let bar = document.getElementById('vos-play-bar');
  if (view !== 'stats' || !play) {
    if (bar) bar.remove();
    if (page) page.classList.remove('has-play-bar');
    return;
  }
  if (page) page.classList.add('has-play-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'vos-play-bar';
    bar.className = 'vos-play-bar';
    document.body.appendChild(bar);
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bar]');
      if (!button || !controls) return;
      if (button.dataset.bar === 'hp') controls.openHpPad();
      if (button.dataset.bar === 'conditions') controls.openConditions();
      if (button.dataset.bar === 'mask') controls.openMasks();
      if (button.dataset.bar === 'prepare') controls.openPrepare();
      if (button.dataset.bar === 'rest') controls.openRests();
      if (button.dataset.bar === 'feature') controls.activateFeature(button.dataset.feature);
      if (button.dataset.bar === 'spend') {
        const entry = quickSpendEntries().find((f) => f.id === button.dataset.feature);
        if (entry) {
          controls.spendCharge({
            id: entry.id, name: entry.name, max: entry.uses.max, tempHp: entry.tempHp,
          });
        }
      }
      if (button.dataset.bar === 'cast') controls.castFreeSpell(button.dataset.feature);
      if (button.dataset.bar === 'rule') controls.openPerTurnRule(button.dataset.feature);
      if (button.dataset.bar === 'rescue') controls.rescueFromZero();
      if (button.dataset.bar === 'pact-pip') {
        controls.apply({
          op: button.dataset.spent === '1' ? 'restorePactSlot' : 'spendPactSlot',
        });
      }
    });
  }

  const s = play.state;
  const max = (play.limits && play.limits.maxHp) || 0;
  const current = s.hp.current != null ? s.hp.current : max;
  const pct = max ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const conditions = (s.conditions || []).filter((c) => c !== 'dying').length;
  const dying = (s.conditions || []).includes('dying');

  const maskUses = statModel && statModel.maskUses;
  const maskLeft = maskUses ? Math.max(0, maskUses.uses.max - spentOf(maskUses.id)) : null;

  bar.innerHTML = `
    <button type="button" class="vos-play-bar-hp${dying ? ' is-dying' : ''}" data-bar="hp"
            aria-label="Hit points ${current} of ${max}">
      <span class="vos-play-bar-fill" style="width:${pct}%"></span>
      <span class="vos-play-bar-hp-text">
        <b>${current}</b><i>/${max || '—'}</i>
        ${s.hp.temp ? `<em>+${s.hp.temp}</em>` : ''}
      </span>
      ${dying ? '<span class="vos-play-bar-dying">Dying</span>' : ''}
    </button>
    ${renderRescueButton(dying)}
    <button type="button" class="vos-play-bar-btn" data-bar="conditions">
      Conditions${conditions ? `<b>${conditions}</b>` : ''}
    </button>
    ${hasMasks() ? `<button type="button" class="vos-play-bar-btn" data-bar="mask">Mask${
      maskLeft != null ? `<b>${maskLeft}</b>` : ''}</button>` : ''}
    ${renderFeatureButtons()}
    ${renderQuickSpendButtons()}
    ${renderFreeCastButtons()}
    ${renderPactPips()}
    ${statModel && statModel.spellcasting
      ? '<button type="button" class="vos-play-bar-btn" data-bar="prepare">Spells</button>' : ''}
    ${renderPerTurnChips()}
    <button type="button" class="vos-play-bar-btn" data-bar="rest">Rest</button>`;
}

/* While transformed the creature's statblock goes above the character's, so
 * what you can do right now is what you read first. */
async function renderFormBlock() {
  const existing = document.getElementById('vos-form-block');
  if (existing) existing.remove();
  if (!controls || !play || !play.state.form) return;

  const html = await controls.formStatblockHtml();
  if (!html || !play.state.form) return;
  const holder = document.createElement('div');
  holder.id = 'vos-form-block';
  holder.innerHTML = html;
  root.parentNode.insertBefore(holder, root);
}

/* The character's name belongs in the sticky bar, where "Character Sheet"
 * was telling the player something they already knew. Everything the old
 * in-page header said moves up here, and the sheet starts at the numbers. */
function renderAppBar() {
  const titleEl = document.querySelector('.vos-app-bar .vos-app-title');
  const eyebrowEl = document.querySelector('.vos-app-bar .vos-app-eyebrow');
  if (!titleEl || !eyebrowEl) return;
  const name = (statModel && statModel.name) || seat.display || payload.playerName;
  if (!name) return;
  titleEl.textContent = name;
  const line = statModel
    ? [statModel.classLine, statModel.race].filter(Boolean).join(' · ')
    : '';
  eyebrowEl.textContent = line || 'Your character';
}

function wire() {
  if (tabsEl) {
    tabsEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (!button || button.disabled) return;
      view = button.dataset.view;
      render();
      if (view === 'stats') ensurePlay();
    });
  }

  // Hide / show / pin entries. Delegated, because render() replaces the contents.
  root.addEventListener('click', (event) => {
    const toggle = event.target.closest(
      '[data-hide-entry], [data-show-entry], [data-pin-entry], [data-unpin-entry]',
    );
    if (!toggle || !root.contains(toggle)) return;
    // The toggle sits inside a <summary>; without this the row would also
    // expand or collapse under the tap.
    event.preventDefault();
    if (toggle.dataset.hideEntry) hidden.add(toggle.dataset.hideEntry);
    if (toggle.dataset.showEntry) hidden.delete(toggle.dataset.showEntry);
    if (toggle.dataset.pinEntry) pinned.add(toggle.dataset.pinEntry);
    if (toggle.dataset.unpinEntry) pinned.delete(toggle.dataset.unpinEntry);
    savePref('hidden', hidden);
    savePref('pinned', pinned);
    /* Re-rendering closes every <details>. Bringing three things back should
     * not mean reopening the stash three times, so open stashes survive. */
    const openStashes = [...root.querySelectorAll('.vos-sb-section')]
      .filter((section) => section.querySelector('.vos-sb-hidden[open]'))
      .map((section) => section.id);
    render();
    openStashes.forEach((id) => {
      const stash = root.querySelector(`#${CSS.escape(id)} .vos-sb-hidden`);
      if (stash) stash.open = true;
    });
  });
}

/* Whose sheet? Shown to the DM in place of their own, which does not exist.
 *
 * Built from the same DM-gated collection the view itself reads, so a player
 * who has no sheet is listed as unavailable rather than offered and then
 * failing on the next screen.
 */
async function renderPicker() {
  if (tabsEl) tabsEl.hidden = true;
  if (indexEl) indexEl.hidden = true;
  root.innerHTML = '<div class="empty-state"><b>Loading the roster…</b></div>';

  let sheets = [];
  try {
    sheets = (await loadAllSheets()).sheets || [];
  } catch (error) {
    notice('Could not load the roster.', error.message || 'Try again in a moment.');
    return;
  }

  const roster = await loadRoster();
  if (!sheets.length) {
    notice('No sheets yet.', 'Push characters from Foundry and they appear here.');
    return;
  }

  const cards = sheets.map((entry) => {
    const seat = roster[entry.playerName] || {};
    const has = [entry.statblock ? 'stats' : null, entry.player ? 'story' : null]
      .filter(Boolean).join(' · ');
    const label = seat.display || entry.playerName;
    return `<a class="vos-sheet-pick" href="/sheet/?as=${encodeURIComponent(entry.playerName)}"
               style="--c:${esc(seat.color || '#d4a574')}">
      <b>${esc(label)}</b>
      <span>${esc(has || 'nothing pushed yet')}</span>
    </a>`;
  }).join('');

  root.innerHTML = `<div class="vos-sheet-picker">
    <p class="vos-sheet-pick-lede">Nothing pushed for your own character yet.
    Open someone else's — you will see it exactly as they do.</p>
    <div class="vos-sheet-picks">${cards}</div>
  </div>`;
}

/* One player's sheet, taken from the DM's collection.
 *
 * /api/sheet cannot be told whose sheet to return — that is deliberate, and
 * tested — so the DM's view reads /api/sheets, which is DM-gated already,
 * rather than opening a second door into the player endpoint.
 */
async function loadSheetAs(playerName) {
  const body = await loadAllSheets();
  const entry = (body.sheets || []).find((s) => s.playerName === playerName);
  if (!entry) {
    const error = new Error(`No sheet for ${playerName}.`);
    error.status = 404;
    throw error;
  }
  return {
    playerName,
    sheet: entry.player || entry.dm || null,
    statblock: entry.statblock || null,
  };
}

/* Play state is fetched once, lazily. A player who only wants to reread their
 * backstory should not pay for it. */
/* Tell the rest of the app what the hit points are now.
 *
 * The navigation medallion draws a ring from this. Without the event it would
 * have to poll, and a gauge in the chrome of every page cannot cost a request
 * per page. */
function announceHp() {
  if (!play || !play.limits || play.limits.maxHp == null) return;
  const max = play.limits.maxHp;
  const current = play.state.hp.current == null ? max : play.state.hp.current;
  window.dispatchEvent(new CustomEvent('vos:play-state', { detail: { hp: { current, max } } }));
}

async function ensurePlay() {
  if (play || !payload.statblock) return;
  if (!statModel) statModel = normalizeStatblock(payload.statblock.data);
  try {
    const body = await loadPlayState(viewingAs);
    play = { state: body.state, limits: body.limits };
  } catch (error) {
    // The sheet is still worth reading without it, so this degrades to the
    // read-only statblock rather than an error page.
    return;
  }

  render();
  announceHp();
  controls = createControls({
    root,
    playerName: viewingAs,
    model: statModel,
    state: play.state,
    limits: play.limits,
    onState(next) {
      play.state = next;
      controls.setState(next, play.limits);
      render();
      announceHp();
    },
  });
}

async function boot() {
  const pwa = await whenPwaReady();
  const name = pwa && pwa.getPlayerName ? pwa.getPlayerName() : null;

  if (!name) {
    notice('Sign in to read your sheet.', 'It is only visible to you and the DM.');
    return;
  }

  const asked = new URLSearchParams(window.location.search).get('as');
  const isDm = name === 'DM' || (pwa && pwa.isDm && pwa.isDm());
  if (asked && asked !== name) {
    if (!isDm) {
      notice('That is not your sheet.', 'Yours is at /sheet/.');
      return;
    }
    viewingAs = asked;
  }

  try {
    payload = viewingAs ? await loadSheetAs(viewingAs) : await loadMySheet();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      notice('That session isn\u2019t authorised.', 'Sign in again and try once more.');
    } else {
      notice('Could not load your sheet.', error.message || 'Try again in a moment.');
    }
    return;
  }

  const hasStory = Boolean(payload.sheet && payload.sheet.markdown);
  const hasStats = Boolean(payload.statblock && payload.statblock.data);
  if (!hasStory && !hasStats) {
    // The DM has their own character like anyone else; if it has not been
    // pushed yet, offering the roster is more useful than an empty page.
    if (isDm) { await renderPicker(); return; }
    notice('No sheet yet.', 'Your DM writes these \u2014 it will appear here once yours is ready.');
    return;
  }

  const roster = await loadRoster();
  seat = roster[payload.playerName] || {};
  if (seat.color) root.style.setProperty('--sheet-accent', seat.color);

  /* Stats first: at the table the sheet is opened to act, not to reread the
   * backstory. The story tab is one tap away when it is wanted. */
  view = hasStats ? 'stats' : 'story';
  loadPrefs();
  renderViewingAs();
  wire();
  wireImageZoom(root);
  render();
  renderAppBar();
  if (hasStats) ensurePlay();
}

if (root) boot();
