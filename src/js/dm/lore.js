import { loreBulkBarEl, loreBulkPublishEl, loreBulkRejectEl, loreForm, loreImageEl, loreImagePromptEl, loreListEl, loreMarkdownEl, lorePublishEl, loreRedraftEl, loreRefreshEl, loreRejectEl, loreRejectReasonEl, loreSaveEl, loreSelectAllEl, loreSelectCountEl, loreSlugEl, loreStatusEl, loreSummaryEl, loreTitleEl, selectedLoreIds, setStatus } from './dom.js';
import { adminJson, postJson, withPanel } from './http.js';
import { followRebuild, triggerRebuild } from './rebuild.js';
import { confirmDiscard, trackDirty } from './dirty.js';

export let selectedLoreId = null;

export let selectedLoreStatus = null;

/* Status per listed submission, so bulk publish can tell "needs overwrite"
 * (already published) apart from real failures instead of blind-retrying
 * everything with overwrite:true. */
const statusById = new Map();

/* The editor's fields as last loaded/saved — anything else is unsaved work. */
let editorSnapshot = null;

function editorState() {
  return JSON.stringify(lorePayloadFromForm());
}

export function loreEditorDirty() {
  return !loreForm.hidden && editorSnapshot !== null && editorState() !== editorSnapshot;
}

trackDirty('lore-editor', loreEditorDirty);

export function lorePayloadFromForm() {
  return {
    title: loreTitleEl.value.trim(),
    slug: loreSlugEl.value.trim(),
    summary: loreSummaryEl.value.trim(),
    markdown: loreMarkdownEl.value.trim(),
    image_prompt: loreImagePromptEl.value.trim(),
  };
}

export function renderLoreList(submissions) {
  loreListEl.innerHTML = '';
  statusById.clear();
  submissions.forEach((s) => statusById.set(s.id, s.status));
  // Drop any selections that aren't in the new list anymore (e.g.,
  // after a refresh that removed published / rejected items).
  const incomingIds = new Set(submissions.map((s) => s.id));
  for (const id of Array.from(selectedLoreIds)) {
    if (!incomingIds.has(id)) selectedLoreIds.delete(id);
  }
  // Same for the editor's selection: a vanished submission must not leave
  // the editor pointed at an id that will 404.
  if (selectedLoreId && !incomingIds.has(selectedLoreId)) {
    selectedLoreId = null;
    selectedLoreStatus = null;
    editorSnapshot = null;
    loreForm.hidden = true;
  }

  if (!submissions.length) {
    const empty = document.createElement('p');
    empty.className = 'vos-dm-empty';
    empty.textContent = 'No lore submissions yet.';
    loreListEl.appendChild(empty);
    loreForm.hidden = true;
    selectedLoreId = null;
    selectedLoreStatus = null;
    editorSnapshot = null;
    updateBulkBar();
    return;
  }

  submissions.forEach((submission) => {
    const row = document.createElement('div');
    row.className = 'vos-dm-submission-row';
    row.dataset.id = submission.id;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'vos-dm-submission-check';
    check.checked = selectedLoreIds.has(submission.id);
    check.setAttribute('aria-label', `Select ${submission.title || 'submission'}`);
    check.addEventListener('change', () => {
      if (check.checked) selectedLoreIds.add(submission.id);
      else selectedLoreIds.delete(submission.id);
      updateBulkBar();
    });

    const button = document.createElement('button');
    const title = document.createElement('span');
    const meta = document.createElement('span');
    button.type = 'button';
    button.className = 'vos-dm-submission-item';
    button.dataset.id = submission.id;
    if (submission.id === selectedLoreId) button.classList.add('is-selected');
    title.className = 'vos-dm-submission-title';
    meta.className = 'vos-dm-submission-meta';
    title.textContent = submission.title || 'Untitled';
    meta.textContent = `${submission.kindLabel || submission.kind} · ${submission.submitter} · ${submission.status}`;
    button.append(title, meta);
    button.addEventListener('click', () => selectLoreSubmission(submission.id));

    row.append(check, button);
    loreListEl.appendChild(row);
  });

  updateBulkBar();
}

export function updateBulkBar() {
  if (!loreBulkBarEl) return;
  const rows = loreListEl.querySelectorAll('.vos-dm-submission-row');
  const hasRows = rows.length > 0;
  loreBulkBarEl.hidden = !hasRows;
  if (!hasRows) return;
  const count = selectedLoreIds.size;
  loreSelectCountEl.textContent = count === 0
    ? '0 selected'
    : `${count} selected`;
  loreBulkPublishEl.disabled = count === 0;
  loreBulkRejectEl.disabled = count === 0;
  // Header checkbox reflects the "select-all" state of visible rows.
  let allChecked = true;
  let anyChecked = false;
  rows.forEach((row) => {
    const cb = row.querySelector('.vos-dm-submission-check');
    if (cb && cb.checked) anyChecked = true;
    else allChecked = false;
  });
  loreSelectAllEl.checked = anyChecked && allChecked;
  loreSelectAllEl.indeterminate = anyChecked && !allChecked;
}

export function toggleSelectAll() {
  const rows = loreListEl.querySelectorAll('.vos-dm-submission-row');
  const target = loreSelectAllEl.checked;
  rows.forEach((row) => {
    const id = row.dataset.id;
    const cb = row.querySelector('.vos-dm-submission-check');
    if (!cb) return;
    cb.checked = target;
    if (target) selectedLoreIds.add(id);
    else selectedLoreIds.delete(id);
  });
  updateBulkBar();
}

async function runBulk(ids, label, act) {
  loreBulkPublishEl.disabled = true;
  loreBulkRejectEl.disabled = true;
  const failures = [];
  let ok = 0;
  try {
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      setStatus(loreStatusEl, `${label} ${i + 1} / ${ids.length}…`);
      try {
        await act(id);
        ok += 1;
      } catch (error) {
        failures.push({ id, message: error.message });
      }
    }
    selectedLoreIds.clear();
    await refreshLoreSubmissions();
    if (failures.length) {
      const detail = failures
        .slice(0, 3)
        .map((f) => f.message)
        .join(' · ');
      setStatus(loreStatusEl, `${label}: ${ok} done, ${failures.length} failed — ${detail}`, true);
    } else {
      setStatus(loreStatusEl, `${label}: ${ok} done.`);
    }
  } finally {
    // Selection is gone, so the buttons come back disabled-until-selected —
    // but never stuck disabled after an exception.
    updateBulkBar();
  }
  return { ok, failures };
}

export async function bulkPublishSelected() {
  const ids = Array.from(selectedLoreIds);
  if (!ids.length) return;
  const confirmText = ids.length === 1
    ? 'Publish 1 submission to the wiki?'
    : `Publish ${ids.length} submissions to the wiki?`;
  if (!window.confirm(confirmText)) return;

  const { ok } = await runBulk(ids, 'Publishing', async (id) => {
    // Already-published rows need overwrite to refresh their page; anything
    // else publishes plainly, and its real error surfaces if it fails.
    const payload = { auto_rebuild: false };
    if (statusById.get(id) === 'published') payload.overwrite = true;
    await postJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}/publish`, payload);
  });
  if (ok > 0) {
    try {
      await triggerRebuild(loreStatusEl, `bulk lore publish: ${ok}`);
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    }
  }
}

export async function bulkRejectSelected() {
  const ids = Array.from(selectedLoreIds);
  if (!ids.length) return;
  const reason = (loreRejectReasonEl && loreRejectReasonEl.value || '').trim();
  const confirmText = reason
    ? `Reject ${ids.length === 1 ? 'this submission' : ids.length + ' submissions'} with the reason in the editor?`
    : `Reject ${ids.length === 1 ? 'this submission' : ids.length + ' submissions'} without a reason? (Players see "Rejected by DM".)`;
  if (!window.confirm(confirmText)) return;

  await runBulk(ids, 'Rejecting', async (id) => {
    await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(id)}/reject`,
      reason ? { reason } : {}
    );
  });
  if (loreRejectReasonEl) loreRejectReasonEl.value = '';
}

export function fillLoreForm(submission) {
  selectedLoreId = submission.id;
  selectedLoreStatus = submission.status || null;
  loreForm.hidden = false;
  loreTitleEl.value = submission.title || '';
  loreSlugEl.value = submission.slug || '';
  loreSummaryEl.value = submission.generated_summary || submission.short_description || '';
  loreMarkdownEl.value = submission.generated_markdown || '';
  loreImagePromptEl.value = submission.generated_image_prompt || '';
  if (submission.image_url) {
    loreImageEl.hidden = false;
    loreImageEl.src = `${submission.image_url}?v=${encodeURIComponent(submission.updated_at || Date.now())}`;
    loreImageEl.alt = submission.title || 'Draft image';
  } else {
    loreImageEl.hidden = true;
    loreImageEl.removeAttribute('src');
  }
  editorSnapshot = editorState();
  setStatus(loreStatusEl, submission.error_message || `Loaded ${submission.status}.`, !!submission.error_message);
}

export function refreshLoreSubmissions() {
  return withPanel(loreStatusEl, loreRefreshEl, async () => {
    const data = await adminJson('/api/admin/lore-submissions?limit=40');
    const submissions = data.submissions || [];
    renderLoreList(submissions);
    setStatus(loreStatusEl, 'Updated.');
    if (!selectedLoreId && submissions.length) {
      await selectLoreSubmission(submissions[0].id, { skipDirtyCheck: true });
    }
  });
}

export async function selectLoreSubmission(id, { skipDirtyCheck = false } = {}) {
  if (!skipDirtyCheck && id !== selectedLoreId
      && !confirmDiscard('lore-editor', 'Discard unsaved edits to the open draft?')) {
    return;
  }
  await withPanel(loreStatusEl, null, async () => {
    const data = await adminJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}`);
    fillLoreForm(data.submission);
    Array.from(loreListEl.querySelectorAll('.vos-dm-submission-item')).forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.id === id);
    });
  }, { loading: 'Loading draft…' });
}

export async function saveLoreSubmission() {
  if (!selectedLoreId) return;
  await withPanel(loreStatusEl, loreSaveEl, async () => {
    const data = await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/save`,
      lorePayloadFromForm()
    );
    fillLoreForm(data.submission);
    await refreshLoreSubmissions();
    setStatus(loreStatusEl, 'Saved.');
  }, { loading: 'Saving…' });
}

export async function redraftLoreSubmission() {
  if (!selectedLoreId) return;
  if (!window.confirm('Regenerate this draft? Current edits are replaced when the new draft finishes.')) return;
  await withPanel(loreStatusEl, loreRedraftEl, async () => {
    await postJson(`/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/draft`, {});
    editorSnapshot = null;
    await refreshLoreSubmissions();
    setStatus(loreStatusEl, 'Regeneration started — reload the draft in a minute.');
  }, { loading: 'Regenerating…' });
}

export async function rejectLoreSubmission() {
  if (!selectedLoreId) return;
  const reason = (loreRejectReasonEl && loreRejectReasonEl.value || '').trim();
  const confirmText = reason
    ? 'Reject this submission with the reason above? The player will see it.'
    : 'Reject without a reason? (The player will only see "Rejected by DM".)';
  if (!window.confirm(confirmText)) return;
  await withPanel(loreStatusEl, loreRejectEl, async () => {
    await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/reject`,
      reason ? { reason } : {}
    );
    if (loreRejectReasonEl) loreRejectReasonEl.value = '';
    editorSnapshot = null;
    await refreshLoreSubmissions();
    setStatus(loreStatusEl, 'Rejected.');
  }, { loading: 'Rejecting…' });
}

export async function publishLoreSubmission(event) {
  event.preventDefault();
  if (!selectedLoreId) return;
  const confirmText = selectedLoreStatus === 'published'
    ? 'Republish and overwrite this wiki source file with the current draft?'
    : 'Publish this draft into the wiki source files?';
  if (!window.confirm(confirmText)) return;
  await withPanel(loreStatusEl, lorePublishEl, async () => {
    const payload = lorePayloadFromForm();
    if (selectedLoreStatus === 'published') {
      payload.overwrite = true;
    }
    const data = await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/publish`,
      payload
    );
    editorSnapshot = editorState();
    await refreshLoreSubmissions();
    followRebuild(loreStatusEl, `Published: ${data.url}.`, data.rebuild);
  }, { loading: 'Publishing…' });
}
