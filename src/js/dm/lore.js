import { adminJson, getToken, loreBulkBarEl, loreBulkPublishEl, loreBulkRejectEl, loreForm, loreImageEl, loreImagePromptEl, loreListEl, loreMarkdownEl, lorePublishEl, loreRedraftEl, loreRefreshEl, loreRejectEl, loreRejectReasonEl, loreSaveEl, loreSelectAllEl, loreSelectCountEl, loreSlugEl, loreStatusEl, loreSummaryEl, loreTitleEl, pollRebuildStatus, postJson, selectedLoreIds, setStatus, setStatusWithRebuild, triggerRebuild } from './state.js';

export let selectedLoreId = null;

export let selectedLoreStatus = null;

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
  // Drop any selections that aren't in the new list anymore (e.g.,
  // after a refresh that removed published / rejected items).
  const incomingIds = new Set(submissions.map((s) => s.id));
  for (const id of Array.from(selectedLoreIds)) {
    if (!incomingIds.has(id)) selectedLoreIds.delete(id);
  }

  if (!submissions.length) {
    const empty = document.createElement('p');
    empty.className = 'vos-dm-empty';
    empty.textContent = 'No lore submissions yet.';
    loreListEl.appendChild(empty);
    loreForm.hidden = true;
    selectedLoreId = null;
    selectedLoreStatus = null;
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

export async function bulkPublishSelected() {
  const token = getToken(loreStatusEl);
  if (!token) return;
  const ids = Array.from(selectedLoreIds);
  if (!ids.length) return;
  const confirmText = ids.length === 1
    ? 'Publish 1 submission to the wiki?'
    : `Publish ${ids.length} submissions to the wiki?`;
  if (!window.confirm(confirmText)) return;

  loreBulkPublishEl.disabled = true;
  loreBulkRejectEl.disabled = true;
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    setStatus(loreStatusEl, `Publishing ${i + 1} / ${ids.length}...`);
    try {
      // Empty body — server falls back to stored title/slug/markdown/etc.
      // Retry once with overwrite=true so already-published rows refresh.
      try {
        await postJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}/publish`, token, { auto_rebuild: false });
      } catch (firstError) {
        await postJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}/publish`, token, { overwrite: true, auto_rebuild: false });
      }
      ok += 1;
    } catch (error) {
      failed += 1;
    }
  }
  selectedLoreIds.clear();
  await refreshLoreSubmissions();
  setStatus(
    loreStatusEl,
    failed
      ? `Published ${ok}, ${failed} failed.`
      : `Published ${ok}.`,
    failed > 0
  );
  if (ok > 0) {
    try {
      await triggerRebuild(loreStatusEl, `bulk lore publish: ${ok}`);
    } catch (error) {
      setStatus(loreStatusEl, error.message, true);
    }
  }
}

export async function bulkRejectSelected() {
  const token = getToken(loreStatusEl);
  if (!token) return;
  const ids = Array.from(selectedLoreIds);
  if (!ids.length) return;
  const reason = window.prompt(
    `Reject ${ids.length === 1 ? '1 submission' : ids.length + ' submissions'}. Reason shown to players (optional):`,
    ''
  );
  // prompt() returns null on Cancel, '' on empty OK
  if (reason === null) return;
  const trimmed = reason.trim();

  loreBulkPublishEl.disabled = true;
  loreBulkRejectEl.disabled = true;
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    setStatus(loreStatusEl, `Rejecting ${i + 1} / ${ids.length}...`);
    try {
      await postJson(
        `/api/admin/lore-submissions/${encodeURIComponent(id)}/reject`,
        token,
        trimmed ? { reason: trimmed } : {}
      );
      ok += 1;
    } catch (error) {
      failed += 1;
    }
  }
  selectedLoreIds.clear();
  await refreshLoreSubmissions();
  setStatus(
    loreStatusEl,
    failed
      ? `Rejected ${ok}, ${failed} failed.`
      : `Rejected ${ok}.`,
    failed > 0
  );
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
  setStatus(loreStatusEl, submission.error_message || `Loaded ${submission.status}.`, !!submission.error_message);
}

export async function refreshLoreSubmissions() {
  const token = getToken(loreStatusEl);
  if (!token) return;
  loreRefreshEl.disabled = true;
  setStatus(loreStatusEl, 'Loading...');
  try {
    const data = await adminJson('/api/admin/lore-submissions?limit=40', token);
    const submissions = data.submissions || [];
    renderLoreList(submissions);
    setStatus(loreStatusEl, 'Updated.');
    if (!selectedLoreId && submissions.length) {
      await selectLoreSubmission(submissions[0].id);
    } else if (selectedLoreId) {
      Array.from(loreListEl.querySelectorAll('.vos-dm-submission-item')).forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.id === selectedLoreId);
      });
    }
  } catch (error) {
    setStatus(loreStatusEl, error.message, true);
  } finally {
    loreRefreshEl.disabled = false;
  }
}

export async function selectLoreSubmission(id) {
  const token = getToken(loreStatusEl);
  if (!token) return;
  selectedLoreId = id;
  setStatus(loreStatusEl, 'Loading draft...');
  try {
    const data = await adminJson(`/api/admin/lore-submissions/${encodeURIComponent(id)}`, token);
    fillLoreForm(data.submission);
    Array.from(loreListEl.querySelectorAll('.vos-dm-submission-item')).forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.id === id);
    });
  } catch (error) {
    setStatus(loreStatusEl, error.message, true);
  }
}

export async function saveLoreSubmission() {
  if (!selectedLoreId) return;
  const token = getToken(loreStatusEl);
  if (!token) return;
  loreSaveEl.disabled = true;
  setStatus(loreStatusEl, 'Saving...');
  try {
    const data = await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/save`,
      token,
      lorePayloadFromForm()
    );
    fillLoreForm(data.submission);
    await refreshLoreSubmissions();
    setStatus(loreStatusEl, 'Saved.');
  } catch (error) {
    setStatus(loreStatusEl, error.message, true);
  } finally {
    loreSaveEl.disabled = false;
  }
}

export async function redraftLoreSubmission() {
  if (!selectedLoreId) return;
  const token = getToken(loreStatusEl);
  if (!token) return;
  if (!window.confirm('Regenerate this draft? Current edits are replaced when the new draft finishes.')) return;
  loreRedraftEl.disabled = true;
  setStatus(loreStatusEl, 'Regenerating...');
  try {
    await postJson(`/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/draft`, token, {});
    await refreshLoreSubmissions();
    setStatus(loreStatusEl, 'Regeneration started.');
  } catch (error) {
    setStatus(loreStatusEl, error.message, true);
  } finally {
    loreRedraftEl.disabled = false;
  }
}

export async function rejectLoreSubmission() {
  if (!selectedLoreId) return;
  const token = getToken(loreStatusEl);
  if (!token) return;
  const reason = (loreRejectReasonEl && loreRejectReasonEl.value || '').trim();
  const confirmText = reason
    ? `Reject this submission with the reason above? The player will see it.`
    : 'Reject without a reason? (The player will only see "Rejected by DM".)';
  if (!window.confirm(confirmText)) return;
  loreRejectEl.disabled = true;
  setStatus(loreStatusEl, 'Rejecting...');
  try {
    await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/reject`,
      token,
      reason ? { reason } : {}
    );
    if (loreRejectReasonEl) loreRejectReasonEl.value = '';
    await refreshLoreSubmissions();
    setStatus(loreStatusEl, 'Rejected.');
  } catch (error) {
    setStatus(loreStatusEl, error.message, true);
  } finally {
    loreRejectEl.disabled = false;
  }
}

export async function publishLoreSubmission(event) {
  event.preventDefault();
  if (!selectedLoreId) return;
  const token = getToken(loreStatusEl);
  if (!token) return;
  const confirmText = selectedLoreStatus === 'published'
    ? 'Republish and overwrite this wiki source file with the current draft?'
    : 'Publish this draft into the wiki source files?';
  if (!window.confirm(confirmText)) return;
  lorePublishEl.disabled = true;
  setStatus(loreStatusEl, 'Publishing...');
  try {
    const payload = lorePayloadFromForm();
    if (selectedLoreStatus === 'published') {
      payload.overwrite = true;
    }
    const data = await postJson(
      `/api/admin/lore-submissions/${encodeURIComponent(selectedLoreId)}/publish`,
      token,
      payload
    );
    await refreshLoreSubmissions();
    setStatusWithRebuild(loreStatusEl, `Published: ${data.url}.`, data.rebuild);
    if (data.rebuild && (data.rebuild.state === 'queued' || data.rebuild.state === 'running')) {
      pollRebuildStatus(loreStatusEl);
    }
  } catch (error) {
    setStatus(loreStatusEl, error.message, true);
  } finally {
    lorePublishEl.disabled = false;
  }
}
