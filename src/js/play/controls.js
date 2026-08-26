/* The parts of the sheet you touch at the table.
 *
 * Designed around one question: mid-combat, in bad light, holding dice — how
 * many taps to record 7 damage? Two. Tap the hit points, tap 7.
 *
 * Everything here follows the same shape: predict locally so the tap feels
 * instant, send the operation, then take the server's answer as the truth. The
 * rules live on the server so every device agrees; this file is only ever a
 * fast, honest surface over them.
 */
import { inverseOf, predict, sendOp } from './api.js';
import { loadConditions, loadSpellList, preparedLimit, spellKey, spellListNameFor } from './reference.js';
import { clock, formCrCap, formOverrides, formsForMask, loadForms, loadMasquerade, masksFor } from './masquerade.js';

const QUICK_DAMAGE = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
const HAPTIC_MS = 12;

export function createControls(options) {
  const root = options.root;
  const onState = options.onState;
  const playerName = options.playerName || null;
  const model = options.model || null;
  let state = options.state;
  let limits = options.limits;
  let busy = false;
  let spellList = null;
  let masquerade = null;
  let forms = null;

  function tap() {
    // A small tick makes a tap feel acknowledged before the network answers.
    if (navigator.vibrate) { try { navigator.vibrate(HAPTIC_MS); } catch (error) { /* ignore */ } }
  }

  async function apply(op, { undoable = true } = {}) {
    if (busy) return;
    busy = true;
    const before = state;
    tap();

    const guess = predict(state, op, limits);
    if (guess) { state = guess; onState(state, { optimistic: true }); }

    try {
      const body = await sendOp(op, playerName);
      state = body.state;
      limits = body.limits || limits;
      onState(state, { note: body.note });
      if (undoable) offerUndo(op, before, body.note);
    } catch (error) {
      state = before;                      // the guess was wrong or refused
      onState(state, { error: error.message });
      toast(error.message, { tone: 'error' });
    } finally {
      busy = false;
    }
  }

  /* ── Undo ──────────────────────────────────────────────────────── */

  function offerUndo(op, before, note) {
    const inverse = inverseOf(op, before);
    toast(note || 'Done', {
      action: inverse ? {
        label: 'Undo',
        run: () => apply(inverse, { undoable: false }),
      } : null,
    });
  }

  let toastEl = null;
  let toastTimer = null;

  function toast(message, { tone = '', action = null } = {}) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'vos-play-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.className = `vos-play-toast is-on${tone ? ` is-${tone}` : ''}`;
    toastEl.innerHTML = `<span class="vos-play-toast-text"></span>`;
    toastEl.querySelector('.vos-play-toast-text').textContent = message;
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vos-play-toast-action';
      button.textContent = action.label;
      button.addEventListener('click', () => { hideToast(); action.run(); });
      toastEl.appendChild(button);
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 3000);
  }

  function hideToast() {
    if (toastEl) toastEl.classList.remove('is-on');
  }

  /* ── Sheets ────────────────────────────────────────────────────── */

  let sheetEl = null;

  function openSheet(title, bodyHtml, wire) {
    closeSheet();
    sheetEl = document.createElement('div');
    sheetEl.className = 'vos-play-sheet';
    sheetEl.innerHTML = `
      <div class="vos-play-sheet-scrim" data-close="1"></div>
      <div class="vos-play-sheet-panel" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="vos-play-sheet-head">
          <span>${title}</span>
          <button type="button" class="vos-play-sheet-close" data-close="1" aria-label="Close">✕</button>
        </div>
        <div class="vos-play-sheet-body">${bodyHtml}</div>
      </div>`;
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) closeSheet();
    });
    if (wire) wire(sheetEl);
    const first = sheetEl.querySelector('button:not([data-close])');
    if (first) first.focus();
  }

  function closeSheet() {
    if (sheetEl) { sheetEl.remove(); sheetEl = null; }
  }

  /* The pad. Big targets, the numbers people actually use, and a keypad for
   * the ones they don't — never a stepper you have to press eleven times. */
  function openHpPad() {
    const max = (limits && limits.maxHp) || 0;
    const current = state.hp.current != null ? state.hp.current : max;
    const quick = QUICK_DAMAGE.map((n) =>
      `<button type="button" class="vos-play-num" data-amount="${n}">${n}</button>`).join('');

    openSheet('Hit points', `
      <div class="vos-play-hp">
        <span class="vos-play-hp-now">${current}<i>/${max || '—'}</i></span>
        ${state.hp.temp ? `<span class="vos-play-hp-temp">+${state.hp.temp} temp</span>` : ''}
      </div>
      <div class="vos-play-mode" role="group" aria-label="Damage or healing">
        <button type="button" class="is-on" data-mode="damage">Damage</button>
        <button type="button" data-mode="heal">Heal</button>
      </div>
      <div class="vos-play-nums">${quick}</div>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="999" placeholder="Other" aria-label="Amount">
        <button type="submit">Apply</button>
      </form>
      <label class="vos-play-check"><input type="checkbox" data-critical> Critical hit</label>
      <div class="vos-play-row">
        <button type="button" class="vos-play-secondary" data-temp>Set temp HP</button>
        <button type="button" class="vos-play-secondary" data-full>Full</button>
      </div>
    `, (sheet) => {
      let mode = 'damage';
      sheet.querySelectorAll('[data-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          mode = button.dataset.mode;
          sheet.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-on', b === button));
        });
      });
      const critical = () => Boolean(sheet.querySelector('[data-critical]').checked);
      const run = (amount) => {
        if (!(amount > 0)) return;
        closeSheet();
        apply(mode === 'heal'
          ? { op: 'heal', amount }
          : { op: 'damage', amount, critical: critical() });
      };
      sheet.querySelectorAll('[data-amount]').forEach((button) => {
        button.addEventListener('click', () => run(Number(button.dataset.amount)));
      });
      sheet.querySelector('.vos-play-custom').addEventListener('submit', (event) => {
        event.preventDefault();
        run(Number(event.target.querySelector('input').value));
      });
      sheet.querySelector('[data-full]').addEventListener('click', () => {
        closeSheet();
        apply({ op: 'setHp', value: max });
      });
      sheet.querySelector('[data-temp]').addEventListener('click', () => {
        const value = Number(window.prompt('Temporary hit points', String(state.hp.temp || 0)));
        closeSheet();
        if (Number.isFinite(value) && value >= 0) {
          apply({ op: 'setTempHp', value, keepHigher: false });
        }
      });
    });
  }

  /* Hit dice heal by a roll the player makes with real dice, so the app asks
   * for the number rather than inventing one. A Field Rest takes the maximum
   * automatically, which is the whole point of it. */
  function openHitDice() {
    const spent = Number(state.hitDiceSpent || 0);
    const total = (limits && limits.hitDice) || 0;
    openSheet('Hit dice', `
      <p class="vos-play-note">${Math.max(0, total - spent)} of ${total} left. Roll, then enter what you got.</p>
      <form class="vos-play-custom">
        <input type="number" inputmode="numeric" min="0" max="99" placeholder="Rolled" aria-label="Amount healed">
        <button type="submit">Spend</button>
      </form>
      <button type="button" class="vos-play-secondary" data-nothing>Spend without healing</button>
    `, (sheet) => {
      sheet.querySelector('.vos-play-custom').addEventListener('submit', (event) => {
        event.preventDefault();
        const healed = Number(event.target.querySelector('input').value) || 0;
        closeSheet();
        apply({ op: 'spendHitDie', healed });
      });
      sheet.querySelector('[data-nothing]').addEventListener('click', () => {
        closeSheet();
        apply({ op: 'spendHitDie' });
      });
    });
  }

  function openRests() {
    openSheet('Rest', `
      <button type="button" class="vos-play-rest" data-rest="shortRest">
        <b>Short rest</b><span>30 minutes. Spend hit dice one at a time.</span>
      </button>
      <button type="button" class="vos-play-rest" data-rest="fieldRest">
        <b>Field rest</b><span>8 hours somewhere unsafe. Hit dice heal for their maximum.</span>
      </button>
      <button type="button" class="vos-play-rest is-long" data-rest="longRest">
        <b>Long rest</b><span>Everything back, and one point of exhaustion clears.</span>
      </button>
      <p class="vos-play-note">A long rest needs your own bed or a Secure place — or three
      quiet nights to establish a haven. Never inside the fog.</p>
    `, (sheet) => {
      sheet.querySelectorAll('[data-rest]').forEach((button) => {
        button.addEventListener('click', () => {
          const op = button.dataset.rest;
          if (op === 'longRest' && !window.confirm('Take a long rest?')) return;
          closeSheet();
          apply({ op });
        });
      });
    });
  }

  const CONDITIONS = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled',
    'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
    'restrained', 'stunned', 'unconscious'];

  /* Conditions carry their rules text, because the moment you need to know what
   * Restrained does is the moment you have just been restrained. Exhaustion and
   * Dying show this table's wording, not the book's, and say so. */
  async function openConditions() {
    const active = new Set(state.conditions || []);
    let rules = {};
    try { rules = await loadConditions(); } catch (error) { /* names still work */ }

    const list = CONDITIONS.map((c) => {
      const entry = rules[c] || {};
      return `<div class="vos-play-cond-row${active.has(c) ? ' is-on' : ''}">
        <button type="button" class="vos-play-cond" data-condition="${c}">${
          esc(entry.name || c.charAt(0).toUpperCase() + c.slice(1))
        }</button>
        ${entry.text ? `<details class="vos-play-cond-rules">
          <summary>What it does${entry.houseRuled ? ' <em>house rule</em>' : ''}</summary>
          <p>${esc(entry.text)}</p>
        </details>` : ''}
      </div>`;
    }).join('');

    const conc = state.concentration;
    const concentration = `<div class="vos-play-conc">
      ${conc
        ? `<span>Concentrating on <b>${esc(conc.spell)}</b></span>
           <button type="button" class="vos-play-secondary" data-break>Break</button>`
        : `<span>Not concentrating</span>
           <button type="button" class="vos-play-secondary" data-concentrate>Set</button>`}
    </div>`;

    openSheet('Conditions', concentration + `<div class="vos-play-conds is-rows">${list}</div>`,
      (sheet) => {
        sheet.querySelectorAll('[data-condition]').forEach((button) => {
          button.addEventListener('click', () => {
            const condition = button.dataset.condition;
            const row = button.closest('.vos-play-cond-row');
            const on = !row.classList.contains('is-on');
            row.classList.toggle('is-on', on);
            apply({ op: on ? 'addCondition' : 'removeCondition', condition });
          });
        });
        const breakButton = sheet.querySelector('[data-break]');
        if (breakButton) {
          breakButton.addEventListener('click', () => { closeSheet(); apply({ op: 'breakConcentration' }); });
        }
        const setButton = sheet.querySelector('[data-concentrate]');
        if (setButton) {
          setButton.addEventListener('click', () => {
            const spell = window.prompt('Concentrating on which spell?');
            closeSheet();
            if (spell && spell.trim()) apply({ op: 'concentrate', spell: spell.trim() });
          });
        }
      });
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(
      /[&<>"]/g,
      (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]),
    );
  }

  /* Preparing spells.
   *
   * The list is the character's own, not the class's. That is what a wizard's
   * spellbook is — thirteen spells scribed, six of them prepared — and it is
   * equally right for everyone else, because Foundry already holds exactly the
   * spells they have. Offering the whole class list instead would let a player
   * prepare something they have never learned.
   *
   * Cantrips and always-prepared spells are shown but not toggleable: they are
   * castable by definition and are not spending one of the slots.
   */
  async function openPrepare() {
    const groups = (model && model.spells) || [];
    if (!groups.length) {
      toast('This character has no spells.', { tone: 'error' });
      return;
    }

    const cap = await preparedCap();
    const prepared = new Set(state.prepared || []);
    const rows = groups.map((group) => {
      const spells = group.spells.map((spell) => {
        const fixed = spell.always || spell.level === 0;
        const on = fixed || prepared.has(spell.id);
        const meta = [spell.school, ...spell.meta].filter(Boolean).join(' · ');
        return `<label class="vos-play-spell${on ? ' is-on' : ''}${fixed ? ' is-fixed' : ''}"
                       data-name="${esc(spell.name.toLowerCase())}">
          <input type="checkbox" data-spell="${esc(spell.id)}"${on ? ' checked' : ''}${
            fixed ? ' disabled' : ''}>
          <span class="vos-play-spell-name">${esc(spell.name)}${
            fixed ? '<i title="Always available">always</i>' : ''}</span>
          <span class="vos-play-spell-meta">${esc(meta)}</span>
        </label>`;
      }).join('');
      return `<h4 class="vos-play-spell-level">${esc(group.label)}</h4>${spells}`;
    }).join('');

    const counted = countPrepared();
    openSheet('Prepare spells', `
      <div class="vos-play-prep-head">
        <span class="vos-play-prep-count" data-count>${counted}${cap ? ` / ${cap}` : ''}</span>
        <input type="search" class="vos-play-search" placeholder="Search your spells"
               aria-label="Search spells">
      </div>
      <p class="vos-play-note">Your spellbook. Cantrips and always-prepared spells do not
      count against the total.${cap ? ` Your class prepares ${cap} at this level; going over
      is allowed if something says so.` : ''}</p>
      <div class="vos-play-spells">${rows}</div>
    `, (sheet) => {
      const count = sheet.querySelector('[data-count]');
      sheet.querySelectorAll('[data-spell]').forEach((box) => {
        box.addEventListener('change', () => {
          box.closest('.vos-play-spell').classList.toggle('is-on', box.checked);
          apply({ op: 'togglePrepared', spell: box.dataset.spell }, { undoable: false });
          const now = countPrepared(sheet);
          count.textContent = cap ? `${now} / ${cap}` : String(now);
          count.classList.toggle('is-over', Boolean(cap && now > cap));
        });
      });
      const search = sheet.querySelector('.vos-play-search');
      search.addEventListener('input', () => {
        const term = search.value.trim().toLowerCase();
        sheet.querySelectorAll('.vos-play-spell').forEach((row) => {
          row.hidden = Boolean(term) && !row.dataset.name.includes(term);
        });
      });
    });
  }

  /* Only levelled, non-always spells count against the class's number. */
  function countPrepared(sheet) {
    if (sheet) {
      return sheet.querySelectorAll('[data-spell]:checked:not(:disabled)').length;
    }
    const fixed = new Set();
    ((model && model.spells) || []).forEach((group) => group.spells.forEach((spell) => {
      if (spell.always || spell.level === 0) fixed.add(spell.id);
    }));
    return (state.prepared || []).filter((id) => !fixed.has(id)).length;
  }

  /* How many this class prepares, from its own table. Loaded lazily because it
   * is the only thing here that needs the class data at all. */
  async function preparedCap() {
    if (!spellList) {
      spellList = await loadSpellList(spellListNameFor(model)).catch(() => null);
    }
    return preparedLimit(spellList, (model && model.level) || 0);
  }

  /* ── The Masquerade ────────────────────────────────────────────── */

  async function ensureMasquerade() {
    if (!masquerade) masquerade = await loadMasquerade().catch(() => null);
    if (!forms) forms = await loadForms().catch(() => null);
    return Boolean(masquerade);
  }

  async function openMasks() {
    if (!(await ensureMasquerade())) {
      toast('Could not load the masks.', { tone: 'error' });
      return;
    }
    const mine = masksFor(model, masquerade);
    if (!mine.length) {
      toast('This character has no masks.', { tone: 'error' });
      return;
    }

    const worn = state.mask;
    const cards = mine.map((mask) => `
      <button type="button" class="vos-play-mask${worn && worn.key === mask.key ? ' is-on' : ''}"
              data-mask="${esc(mask.key)}">
        <b>${esc(mask.name)}</b>
        <span>${esc(mask.type)} · ${
          formsForMask(forms, mask, formCrCap(model)).length} forms available</span>
      </button>`).join('');

    openSheet('The Masquerade', `
      ${worn ? `<p class="vos-play-note">Wearing <b>${esc(worn.key)}</b> — ${
        clock(worn.remainingMs)}${worn.paused ? ' (paused)' : ''} left.</p>` : ''}
      ${cards}
      <p class="vos-play-note">A Bonus Action. Ten minutes, or until you are incapacitated
      or take it off. Masked Resilience gives temporary hit points equal to your Charisma
      modifier plus your bard level.</p>
      ${worn ? '<button type="button" class="vos-play-secondary" data-remove>Remove mask</button>' : ''}
    `, (sheet) => {
      sheet.querySelectorAll('[data-mask]').forEach((button) => {
        button.addEventListener('click', () => {
          const key = button.dataset.mask;
          closeSheet();
          const cha = (model.abilities || []).find((a) => a.key === 'cha');
          const bardLevel = (model.classes || [])
            .filter((c) => String(c.identifier).toLowerCase() === 'bard')
            .reduce((sum, c) => sum + (c.levels || 0), 0) || model.level || 0;
          const tempHp = cha ? Math.max(0, cha.mod + bardLevel) : 0;
          apply({ op: 'donMask', mask: key, tempHp });
        });
      });
      const remove = sheet.querySelector('[data-remove]');
      if (remove) remove.addEventListener('click', () => { closeSheet(); apply({ op: 'removeMask' }); });
    });
  }

  async function openForms() {
    if (!state.mask) { openMasks(); return; }
    if (!(await ensureMasquerade())) return;

    const mask = masquerade.masks[state.mask.key];
    const cap = formCrCap(model);
    const available = formsForMask(forms, mask, cap);
    if (!available.length) {
      toast('No forms available for this mask.', { tone: 'error' });
      return;
    }

    const cards = available.map((creature, index) => `
      <button type="button" class="vos-play-form" data-form="${index}">
        <b>${esc(creature.name)}</b>
        <span class="vos-play-form-cr">CR ${esc(creature.cr)}</span>
        <span class="vos-play-form-meta">AC ${esc(creature.ac)} · ${esc(creature.hp)} HP · ${
          esc(creature.speed)}</span>
      </button>`).join('');

    openSheet(`Assume a form — ${esc(mask.name)}`, `
      <p class="vos-play-note">Challenge Rating ${cap} or lower${
        model.level < 6 ? ', rising to 3 at sixth level' : ''}. You keep your Intelligence and
        your spell save DC; you assume the creature's hit points.</p>
      <div class="vos-play-forms">${cards}</div>
    `, (sheet) => {
      sheet.querySelectorAll('[data-form]').forEach((button) => {
        button.addEventListener('click', () => {
          const creature = available[Number(button.dataset.form)];
          closeSheet();
          apply({
            op: 'assumeForm',
            creature: creature.name,
            source: creature.source,
            cr: creature.cr,
            hp: creature.hp,
          });
        });
      });
    });
  }

  /* While transformed, the sheet shows the creature rather than the character,
   * with the substitutions the feature makes spelled out. */
  async function formStatblockHtml() {
    if (!state.form || !(await ensureMasquerade())) return '';
    const mask = masquerade.masks[state.mask ? state.mask.key : ''];
    const pool = (forms && mask && forms[mask.type]) || [];
    const creature = pool.find((c) => c.name === state.form.creature);
    if (!creature) return '';

    const notes = formOverrides(creature, model).map((note) => `
      <div class="vos-play-override">
        <b>${esc(note.label)}</b><span>${esc(note.value)}</span><i>${esc(note.why)}</i>
      </div>`).join('');

    const block = (list, title) => (list.length ? `
      <h4 class="vos-play-form-h">${title}</h4>
      ${list.map((entry) => `<p class="vos-play-form-entry"><b>${esc(entry.name)}.</b> ${
        esc(entry.text)}</p>`).join('')}` : '');

    return `
      <article class="vos-play-formblock">
        <header>
          <h3>${esc(creature.name)}</h3>
          <p>${esc(creature.size)} ${esc(creature.type)} · CR ${esc(creature.cr)}</p>
        </header>
        <div class="vos-play-form-vitals">
          <span><b>${esc(creature.ac)}</b>AC</span>
          <span><b>${esc(state.form.hp)}</b>/${esc(state.form.maxHp)} HP</span>
          <span><b>${esc(creature.speed)}</b>Speed</span>
        </div>
        <div class="vos-play-overrides">${notes}</div>
        ${block(creature.traits, 'Traits')}
        ${block(creature.actions, 'Actions')}
      </article>`;
  }

  /* ── Binding ───────────────────────────────────────────────────── */

/* ── Activatable features ──────────────────────────────────────── */

  function featureById(id) {
    return ((model && model.activatable) || []).find((entry) => entry.id === id) || null;
  }

  function featureIsActive(id) {
    return Boolean((state.active || {})[id]);
  }

  function usesLeft(feature) {
    const spent = Number((state.uses || {})[feature.id] || 0);
    return Math.max(0, feature.uses.max - spent);
  }

  /* One tap enters, because it is a Bonus Action taken mid-turn and nobody
   * wants a confirmation dialog between them and their Rage. Leaving goes
   * through the panel instead — ending early wastes the use, so it should take
   * a moment's deliberation rather than a mis-tap. */
  function activateFeature(id) {
    const feature = featureById(id);
    if (!feature) return;
    if (featureIsActive(id)) { openFeature(id); return; }
    if (!usesLeft(feature)) {
      toast(`No uses of ${feature.name} left — a rest brings them back.`, { tone: 'warn' });
      return;
    }
    apply({
      op: 'activateFeature',
      feature: feature.id,
      name: feature.name,
      max: feature.uses.max,
    });
  }

  function openFeature(id) {
    const feature = featureById(id);
    if (!feature) return;
    const active = featureIsActive(id);
    const left = usesLeft(feature);

    openSheet(feature.name, `
      <p class="vos-play-feature-state">${active
        ? 'Active now.'
        : `${left} of ${feature.uses.max} uses left${
            feature.uses.recovery ? `, back on a ${esc(feature.uses.recovery)}` : ''}${
            feature.activation ? ` · ${esc(feature.activation)}` : ''}.`}</p>
      <ul class="vos-play-feature-grants">${
        feature.grants.map((grant) => `<li>${esc(grant)}</li>`).join('')
      }</ul>
      ${active
        ? '<button type="button" class="vos-play-btn is-danger" data-feature-act="end">End it</button>'
        : `<button type="button" class="vos-play-btn is-primary" data-feature-act="start"${
            left ? '' : ' disabled'}>${
            left ? `Use ${esc(feature.name)}` : 'No uses left'}</button>`}
    `, (sheet) => {
      const button = sheet.querySelector('[data-feature-act]');
      if (!button) return;
      button.addEventListener('click', () => {
        closeSheet();
        apply(button.dataset.featureAct === 'end'
          ? { op: 'endFeature', feature: feature.id }
          : { op: 'activateFeature', feature: feature.id, name: feature.name, max: feature.uses.max });
      });
    });
  }

  function onActivate(event) {
    const target = event.target.closest('[data-play]');
    if (!target || !root.contains(target)) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (event.type === 'keydown') event.preventDefault();

    switch (target.dataset.play) {
      case 'hp':
        openHpPad();
        break;
      case 'hitdice':
        openHitDice();
        break;
      case 'slot': {
        const level = Number(target.dataset.level);
        const spent = target.dataset.spent === '1';
        apply({ op: spent ? 'restoreSlot' : 'spendSlot', level });
        break;
      }
      case 'pact': {
        // Pact slots are their own pool; restoring one is a short rest away.
        if (target.dataset.spent === '1') return;
        apply({ op: 'spendPactSlot' });
        break;
      }
      case 'charge': {
        const feature = target.dataset.feature;
        if (!feature) return;
        apply({ op: 'useCharge', feature, max: Number(target.dataset.max) || undefined });
        break;
      }
      /* A tracker pip works both ways, the way slot pips already do: tap a
         full one to spend it, tap a spent one to take it back. Mis-taps during
         a fight are common and a resource you cannot un-spend is a resource
         people stop touching. */
      case 'charge-pip': {
        const feature = target.dataset.feature;
        if (!feature) return;
        apply(target.dataset.spent === '1'
          ? { op: 'restoreCharge', feature }
          : { op: 'useCharge', feature, max: Number(target.dataset.max) || undefined });
        break;
      }
      case 'feature':
        openFeature(target.dataset.feature);
        break;
      case 'end-feature':
        apply({ op: 'endFeature', feature: target.dataset.feature });
        break;
      case 'exhaustion': {
        const value = Number(target.dataset.value);
        // Tapping the level you are already at steps back down, so the track
        // works in both directions without a second control.
        apply({ op: 'setExhaustion', value: value === state.exhaustion ? value - 1 : value });
        break;
      }
      case 'conditions':
      case 'condition':
        openConditions();
        break;
      default:
        break;
    }
  }

  root.addEventListener('click', onActivate);
  root.addEventListener('keydown', onActivate);

  return {
    apply,
    openHpPad,
    openRests,
    openConditions,
    openPrepare,
    openMasks,
    openForms,
    openFeature,
    activateFeature,
    formStatblockHtml,
    setState(next, nextLimits) {
      state = next;
      if (nextLimits) limits = nextLimits;
    },
    destroy() {
      root.removeEventListener('click', onActivate);
      root.removeEventListener('keydown', onActivate);
      closeSheet();
      hideToast();
    },
  };
}
