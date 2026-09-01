/* The session chronicler's console panel.
 *
 * Two jobs live here. Starting a draft is a form-and-forget: the pipeline
 * takes minutes (one long drafting call, then one image generation per art
 * moment), so the panel follows the row's own stage field rather than
 * spinning. Reviewing a draft is where the DM actually spends time — the
 * chronicle text, the art, and the proposed wiki edits, each of which they
 * can change or refuse before anything is written.
 *
 * The two invariants worth keeping when editing this file:
 *   - a proposed wiki update is applied only when its box is ticked, and
 *     the box starts unticked no matter what the model said
 *   - publishing sends the editor's current values, so the DM never has to
 *     remember to press Save first
 */

import {
  chronicleArcEl, chronicleArtCountEl, chronicleArtEl, chronicleArtWrapEl,
  chronicleCampaignStateEl, chronicleContinuityEl, chronicleContinuityWrapEl,
  chronicleDateEl, chronicleDeleteEl, chronicleEditorEl, chronicleExtraEl,
  chronicleListEl, chronicleMarkdownEl, chronicleNewStatusEl, chronicleNotesEl,
  chronicleNumberEl, chronicleOpenEl, chroniclePublishEl, chronicleRecapEl,
  chronicleRedraftEl, chronicleSaveEl, chronicleSlugEl, chronicleStageEl,
  chronicleStartEl,
  chronicleStatusEl, chronicleSummaryEl, chronicleTitleEl, chronicleUpdatesEl,
  chronicleUpdatesWrapEl,
  chronicleWorkingTitleEl, formatDate, setStatus,
} from './dom.js';
import { adminJson, postJson, withPanel } from './http.js';
import { confirmSheet } from './confirm.js';
import { confirmDiscard, trackDirty } from './dirty.js';
import { followRebuild } from './rebuild.js';

/* Statuses that mean the server is still working. Anything else is a
 * resting state the panel can stop polling. */
const IN_FLIGHT = new Set(['queued', 'researching', 'drafting', 'illustrating']);
const POLL_MS = 5000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

export let selectedChronicleId = null;
let selectedChronicleStatus = null;
let editorSnapshot = null;
/* Art and update state the form fields do not hold: prompts, styles, drop
 * flags, approvals. Rendered from here and read back from here on save. */
let artState = [];
let updateState = [];
let pollToken = 0;

function editorState() {
  return JSON.stringify(chroniclePayload());
}

export function chronicleEditorDirty() {
  return !chronicleEditorEl.hidden && editorSnapshot !== null && editorState() !== editorSnapshot;
}

trackDirty('chronicle-editor', chronicleEditorDirty);

function chroniclePayload() {
  return {
    title: chronicleTitleEl.value.trim(),
    slug: chronicleSlugEl.value.trim(),
    summary: chronicleSummaryEl.value.trim(),
    recap: chronicleRecapEl.value.trim(),
    markdown: chronicleMarkdownEl.value.trim(),
    art: artState.map((item) => ({
      slot: item.slot,
      caption: item.caption || '',
      prompt: item.prompt || '',
      style: item.style || '',
      dropped: !!item.dropped,
    })),
    updates: updateState.map((item) => ({
      id: item.id,
      approved: !!item.approved,
      markdown: item.markdown || '',
      section: item.section || '',
      title: item.title || '',
      summary: item.summary || '',
    })),
  };
}

/* ── The list ─────────────────────────────────────────────────────────── */

function statusLabel(chronicle) {
  if (IN_FLIGHT.has(chronicle.status)) {
    return chronicle.stage || chronicle.status;
  }
  if (chronicle.status === 'published') return 'published';
  if (chronicle.status === 'failed') return 'failed';
  return 'ready for review';
}

function renderChronicleList(chronicles) {
  chronicleListEl.innerHTML = '';
  if (!chronicles.length) {
    const empty = document.createElement('p');
    empty.className = 'vos-dm-empty';
    empty.textContent = 'No chronicles yet. Paste a session’s notes above.';
    chronicleListEl.appendChild(empty);
    chronicleEditorEl.hidden = true;
    selectedChronicleId = null;
    editorSnapshot = null;
    return;
  }

  const ids = new Set(chronicles.map((item) => item.id));
  if (selectedChronicleId && !ids.has(selectedChronicleId)) {
    selectedChronicleId = null;
    editorSnapshot = null;
    chronicleEditorEl.hidden = true;
  }

  chronicles.forEach((chronicle) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vos-dm-submission-item';
    button.dataset.id = chronicle.id;
    if (chronicle.id === selectedChronicleId) button.classList.add('is-selected');

    const title = document.createElement('span');
    title.className = 'vos-dm-submission-title';
    title.textContent = chronicle.title || chronicle.session_number || 'Untitled session';

    const meta = document.createElement('span');
    meta.className = 'vos-dm-submission-meta';
    const bits = [chronicle.session_number, chronicle.session_date, statusLabel(chronicle)]
      .filter(Boolean);
    meta.textContent = bits.join(' · ');

    button.append(title, meta);
    button.addEventListener('click', () => selectChronicle(chronicle.id));
    chronicleListEl.appendChild(button);
  });
}

export function refreshChronicles() {
  return withPanel(chronicleStatusEl, null, async () => {
    const data = await adminJson('/api/admin/chronicles?limit=40');
    const chronicles = data.chronicles || [];
    renderChronicleList(chronicles);
    setStatus(chronicleStatusEl, 'Updated.');
    if (!selectedChronicleId && chronicles.length) {
      await selectChronicle(chronicles[0].id, { skipDirtyCheck: true });
    }
    // Something still drafting keeps its own poll alive across a refresh.
    const busy = chronicles.find((item) => IN_FLIGHT.has(item.status));
    if (busy) followChronicle(busy.id);
  });
}

/* ── Art cards ────────────────────────────────────────────────────────── */

function renderArt() {
  chronicleArtEl.innerHTML = '';
  chronicleArtWrapEl.hidden = artState.length === 0;
  artState.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'vos-dm-chronicle-art-card';
    if (item.dropped) card.classList.add('is-dropped');

    const figure = document.createElement('div');
    figure.className = 'vos-dm-chronicle-art-figure';
    if (item.image_url && item.status === 'done') {
      const img = document.createElement('img');
      // updated_at busts the cache after a redraw — the URL never changes.
      img.src = `${item.image_url}?v=${encodeURIComponent(item.cacheKey || '')}`;
      img.alt = item.caption || `Art ${item.slot}`;
      img.loading = 'lazy';
      figure.appendChild(img);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'vos-dm-chronicle-art-placeholder';
      placeholder.textContent = item.status === 'error'
        ? (item.error || 'Failed')
        : 'Drawing…';
      figure.appendChild(placeholder);
    }

    const fields = document.createElement('div');
    fields.className = 'vos-dm-chronicle-art-fields';

    const marker = document.createElement('div');
    marker.className = 'vos-dm-chronicle-art-marker';
    marker.textContent = `{{ART:${item.slot}}}`;

    const caption = document.createElement('input');
    caption.type = 'text';
    caption.value = item.caption || '';
    caption.placeholder = 'Caption';
    caption.addEventListener('input', () => { item.caption = caption.value; });

    const prompt = document.createElement('textarea');
    prompt.rows = 3;
    prompt.spellcheck = false;
    prompt.value = item.prompt || '';
    prompt.addEventListener('input', () => { item.prompt = prompt.value; });

    const controls = document.createElement('div');
    controls.className = 'vos-dm-chronicle-art-controls';

    const redraw = document.createElement('button');
    redraw.type = 'button';
    redraw.className = 'vos-dm-button';
    redraw.textContent = 'Redraw';
    redraw.disabled = item.status === 'pending';
    redraw.addEventListener('click', () => redrawArt(item.slot));

    const drop = document.createElement('label');
    drop.className = 'vos-dm-checkbox-row';
    const dropBox = document.createElement('input');
    dropBox.type = 'checkbox';
    dropBox.checked = !!item.dropped;
    dropBox.addEventListener('change', () => {
      item.dropped = dropBox.checked;
      card.classList.toggle('is-dropped', dropBox.checked);
    });
    drop.append(dropBox, document.createTextNode('Leave this one out'));

    controls.append(redraw, drop);
    fields.append(marker, caption, prompt, controls);
    card.append(figure, fields);
    chronicleArtEl.appendChild(card);
  });
}

/* ── Proposed wiki updates ────────────────────────────────────────────── */

function renderUpdates() {
  chronicleUpdatesEl.innerHTML = '';
  chronicleUpdatesWrapEl.hidden = updateState.length === 0;
  updateState.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'vos-dm-chronicle-update';

    const head = document.createElement('label');
    head.className = 'vos-dm-checkbox-row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!item.approved;
    box.addEventListener('change', () => {
      item.approved = box.checked;
      card.classList.toggle('is-approved', box.checked);
    });
    const label = document.createElement('span');
    const verb = item.action === 'create' ? 'Create' : 'Add to';
    label.textContent = `${verb} ${item.title || item.target_url || 'a page'}`;
    head.append(box, label);

    const meta = document.createElement('div');
    meta.className = 'vos-dm-chronicle-update-meta';
    if (item.action === 'append') {
      meta.textContent = `${item.target_url} · under "${item.section}"`;
    } else {
      meta.textContent = `new ${item.kind} page · ${item.slug}`;
    }

    const body = document.createElement('textarea');
    body.rows = 4;
    body.spellcheck = false;
    body.value = item.markdown || '';
    body.addEventListener('input', () => { item.markdown = body.value; });

    card.append(head, meta);
    if (item.reason) {
      const reason = document.createElement('p');
      reason.className = 'vos-dm-chronicle-update-reason';
      reason.textContent = item.reason;
      card.appendChild(reason);
    }
    card.appendChild(body);
    if (item.result) {
      const result = document.createElement('div');
      result.className = 'vos-dm-chronicle-update-result';
      result.textContent = item.result.ok
        ? `Applied${item.result.skipped ? ` (${item.result.skipped})` : ''}`
        : `Failed: ${item.result.error}`;
      result.classList.toggle('is-error', !item.result.ok);
      card.appendChild(result);
    }
    card.classList.toggle('is-approved', !!item.approved);
    chronicleUpdatesEl.appendChild(card);
  });
}

function renderContinuity(notes) {
  chronicleContinuityEl.innerHTML = '';
  chronicleContinuityWrapEl.hidden = !notes.length;
  notes.forEach((note) => {
    const item = document.createElement('li');
    item.className = 'vos-dm-chronicle-continuity-item';
    if (note.severity === 'conflict') item.classList.add('is-conflict');
    const about = document.createElement('b');
    about.textContent = note.about ? `${note.about}: ` : '';
    item.append(about, document.createTextNode(note.note));
    chronicleContinuityEl.appendChild(item);
  });
}

/* ── Filling the editor ───────────────────────────────────────────────── */

function fillChronicle(chronicle) {
  selectedChronicleId = chronicle.id;
  selectedChronicleStatus = chronicle.status;
  chronicleEditorEl.hidden = false;
  chronicleTitleEl.value = chronicle.title || '';
  chronicleSlugEl.value = chronicle.slug || '';
  chronicleSummaryEl.value = chronicle.summary || '';
  chronicleRecapEl.value = chronicle.recap || '';
  chronicleMarkdownEl.value = chronicle.markdown || '';

  artState = (chronicle.art || []).map((item) => ({
    ...item,
    cacheKey: chronicle.updated_at || '',
  }));
  updateState = (chronicle.updates || []).map((item) => ({ ...item }));
  renderArt();
  renderUpdates();
  renderContinuity(chronicle.continuity || []);

  const busy = IN_FLIGHT.has(chronicle.status);
  chronicleStageEl.hidden = !busy;
  chronicleStageEl.textContent = busy ? (chronicle.stage || chronicle.status) : '';
  chroniclePublishEl.disabled = busy;
  chronicleRedraftEl.disabled = busy;
  chroniclePublishEl.textContent = chronicle.status === 'published' ? 'Republish' : 'Publish';

  if (chronicle.published_url) {
    chronicleOpenEl.hidden = false;
    chronicleOpenEl.href = chronicle.published_url;
  } else {
    chronicleOpenEl.hidden = true;
    chronicleOpenEl.removeAttribute('href');
  }

  editorSnapshot = editorState();
  const stamp = chronicle.updated_at ? ` (${formatDate(chronicle.updated_at)})` : '';
  setStatus(
    chronicleStatusEl,
    chronicle.error_message || `${statusLabel(chronicle)}${stamp}.`,
    !!chronicle.error_message,
  );
}

export async function selectChronicle(id, { skipDirtyCheck = false } = {}) {
  if (!skipDirtyCheck && id !== selectedChronicleId
      && !(await confirmDiscard('chronicle-editor', 'Discard unsaved edits to the open chronicle?'))) {
    return;
  }
  await withPanel(chronicleStatusEl, null, async () => {
    const data = await adminJson(`/api/admin/chronicles/${encodeURIComponent(id)}`);
    fillChronicle(data.chronicle);
    Array.from(chronicleListEl.querySelectorAll('.vos-dm-submission-item')).forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.id === id);
    });
    if (IN_FLIGHT.has(data.chronicle.status)) followChronicle(id);
  }, { loading: 'Loading chronicle…' });
}

/* ── Following a running pipeline ─────────────────────────────────────── */

/* One poll at a time. A new follow supersedes the old one by bumping the
 * token, so switching between two drafting chronicles doesn't leave two
 * loops fighting over the editor. */
export function followChronicle(id) {
  pollToken += 1;
  const token = pollToken;
  const deadline = Date.now() + POLL_LIMIT_MS;

  const tick = async () => {
    if (token !== pollToken) return;
    if (Date.now() > deadline) {
      setStatus(chronicleStatusEl, 'Still working — reload in a minute.', true);
      return;
    }
    let chronicle = null;
    try {
      const data = await adminJson(`/api/admin/chronicles/${encodeURIComponent(id)}`);
      chronicle = data.chronicle;
    } catch (error) {
      setStatus(chronicleStatusEl, error.message, true);
      return;
    }
    if (token !== pollToken) return;
    if (selectedChronicleId === id) {
      // Only overwrite the editor while the server still owns the content;
      // once it is resting, the DM's edits are the newer ones.
      if (IN_FLIGHT.has(chronicle.status)) {
        chronicleStageEl.hidden = false;
        chronicleStageEl.textContent = chronicle.stage || chronicle.status;
        artState = (chronicle.art || []).map((item) => ({
          ...item, cacheKey: chronicle.updated_at || '',
        }));
        renderArt();
      } else {
        fillChronicle(chronicle);
      }
    }
    if (IN_FLIGHT.has(chronicle.status)) {
      setTimeout(tick, POLL_MS);
      return;
    }
    await refreshChronicles();
  };

  setTimeout(tick, POLL_MS);
}

/* ── Actions ──────────────────────────────────────────────────────────── */

export async function startChronicle(event) {
  event.preventDefault();
  const notes = chronicleNotesEl.value.trim();
  if (notes.length < 40) {
    setStatus(chronicleNewStatusEl, 'Paste the session notes first.', true);
    return;
  }
  await withPanel(chronicleNewStatusEl, chronicleStartEl, async () => {
    const data = await postJson('/api/admin/chronicles', {
      notes,
      extra_sources: chronicleExtraEl.value.trim(),
      session_number: chronicleNumberEl.value.trim(),
      session_date: chronicleDateEl.value,
      title: chronicleWorkingTitleEl.value.trim(),
      art_count: Number(chronicleArtCountEl.value) || 0,
    });
    setStatus(
      chronicleNewStatusEl,
      'Drafting — reading the notes against the wiki. This takes a few minutes.',
    );
    chronicleNotesEl.value = '';
    chronicleExtraEl.value = '';
    selectedChronicleId = null;
    editorSnapshot = null;
    await refreshChronicles();
    await selectChronicle(data.id, { skipDirtyCheck: true });
  }, { loading: 'Starting…' });
}

export async function saveChronicle() {
  if (!selectedChronicleId) return;
  await withPanel(chronicleStatusEl, chronicleSaveEl, async () => {
    const data = await postJson(
      `/api/admin/chronicles/${encodeURIComponent(selectedChronicleId)}/save`,
      chroniclePayload(),
    );
    fillChronicle(data.chronicle);
    await refreshChronicles();
    setStatus(chronicleStatusEl, 'Saved.');
  }, { loading: 'Saving…' });
}

export async function redraftChronicle() {
  if (!selectedChronicleId) return;
  const confirmed = await confirmSheet(
    'Redraft this chronicle from the notes? Your edits to the text are replaced when the new draft finishes.',
    { confirmLabel: 'Redraft' },
  );
  if (!confirmed) return;
  const id = selectedChronicleId;
  await withPanel(chronicleStatusEl, chronicleRedraftEl, async () => {
    await postJson(`/api/admin/chronicles/${encodeURIComponent(id)}/draft`, {});
    editorSnapshot = null;
    chronicleStageEl.hidden = false;
    chronicleStageEl.textContent = 'Queued';
    setStatus(chronicleStatusEl, 'Redrafting…');
    followChronicle(id);
  }, { loading: 'Redrafting…' });
}

export async function redrawArt(slot) {
  if (!selectedChronicleId) return;
  const item = artState.find((entry) => entry.slot === slot);
  if (!item) return;
  const id = selectedChronicleId;
  await withPanel(chronicleStatusEl, null, async () => {
    await postJson(
      `/api/admin/chronicles/${encodeURIComponent(id)}/art/${slot}`,
      { prompt: item.prompt, style: item.style },
    );
    item.status = 'pending';
    item.error = null;
    renderArt();
    setStatus(chronicleStatusEl, `Redrawing image ${slot}…`);
    followChronicle(id);
  }, { loading: 'Redrawing…' });
}

export async function deleteChronicle() {
  if (!selectedChronicleId) return;
  const confirmed = await confirmSheet(
    'Delete this draft? A chronicle already published keeps its wiki page — only the draft goes.',
    { confirmLabel: 'Delete', danger: true },
  );
  if (!confirmed) return;
  await withPanel(chronicleStatusEl, chronicleDeleteEl, async () => {
    await adminJson(
      `/api/admin/chronicles/${encodeURIComponent(selectedChronicleId)}`,
      { method: 'DELETE' },
    );
    selectedChronicleId = null;
    editorSnapshot = null;
    chronicleEditorEl.hidden = true;
    await refreshChronicles();
    setStatus(chronicleStatusEl, 'Draft deleted.');
  }, { loading: 'Deleting…' });
}

export async function publishChronicle(event) {
  event.preventDefault();
  if (!selectedChronicleId) return;
  const approved = updateState.filter((item) => item.approved);
  const republish = selectedChronicleStatus === 'published';
  const lines = [
    republish
      ? 'Republish this chronicle and overwrite its wiki page?'
      : 'Publish this chronicle to the wiki?',
    approved.length
      ? `${approved.length} wiki ${approved.length === 1 ? 'update' : 'updates'} will be applied.`
      : 'No wiki updates are approved, so only the chronicle page is written.',
    'Enzo’s corpus rebuilds afterwards.',
  ];
  if (!(await confirmSheet(lines.join(' '), { confirmLabel: republish ? 'Republish' : 'Publish' }))) return;

  await withPanel(chronicleStatusEl, chroniclePublishEl, async () => {
    const payload = {
      ...chroniclePayload(),
      arc: chronicleArcEl.value.trim(),
      approved_updates: approved.map((item) => item.id),
      update_campaign_state: chronicleCampaignStateEl.checked,
    };
    if (republish) payload.overwrite = true;
    // Publishing saves as it goes, so the DM's edits go live without a
    // separate Save — the save endpoint runs first for the fields publish
    // does not carry (art captions, per-update text).
    await postJson(
      `/api/admin/chronicles/${encodeURIComponent(selectedChronicleId)}/save`,
      chroniclePayload(),
    );
    const data = await postJson(
      `/api/admin/chronicles/${encodeURIComponent(selectedChronicleId)}/publish`,
      payload,
    );
    editorSnapshot = editorState();
    const failures = (data.updates_applied || []).filter((item) => !item.ok);
    await refreshChronicles();
    await selectChronicle(selectedChronicleId, { skipDirtyCheck: true });
    const note = failures.length
      ? `Published: ${data.url}. ${failures.length} wiki update(s) failed — see the cards.`
      : `Published: ${data.url}.`;
    followRebuild(chronicleStatusEl, note, data.rebuild);
  }, { loading: 'Publishing…' });
}
