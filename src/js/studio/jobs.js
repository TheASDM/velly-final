import { studio } from './state.js';
import { loadGallery } from './gallery-actions.js';
import { clearObjectUrl, entryTitle, setImageSrc, syncGalleryChrome } from './gallery-view.js';
import { escapeHtml, generate } from './generation.js';
import { getCurrentCreatorName, hasAuthenticatedCreator, isCurrentDm, requestHeaders } from './identity.js';
import { closeLightbox } from './lightbox.js';

export function setStatus(text, isError, options = {}) {
    if (studio.statusTimer) {
      clearTimeout(studio.statusTimer);
      studio.statusTimer = null;
    }
    studio.statusEl.textContent = text || '';
    studio.statusEl.classList.toggle('is-error', !!isError);
    if (text && !isError && options.clearAfter) {
      studio.statusTimer = setTimeout(() => {
        studio.statusEl.textContent = '';
        studio.statusEl.classList.remove('is-error');
        studio.statusTimer = null;
      }, options.clearAfter);
    }
  }

export async function deleteEntry(entry, sourceButton) {
    if (!entry || !entry.can_delete || !isCurrentDm()) {
      setStatus('DM login required to delete gallery art.', true);
      return;
    }
    const ok = confirm(
      `Delete this image?\n\n"${entryTitle(entry)}"\n\n` +
      `This is permanent — the PNG and its manifest entry are removed from the server.`
    );
    if (!ok) return;
    if (sourceButton) sourceButton.disabled = true;
    try {
      const res = await fetch(studio.API_BASE + '/api/gallery/' + encodeURIComponent(entry.id), {
        method: 'DELETE',
        headers: requestHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // Optimistic UI removal of the lightbox + card before the reload.
      closeLightbox();
      const card = studio.galleryEl.querySelector(`[data-entry-id="${entry.id}"]`);
      if (card) card.remove();
      // Then re-sync from the server so counts and pagination stay honest.
      setTimeout(loadGallery, 150);
    } catch (e) {
      alert('Delete failed: ' + e.message);
      if (sourceButton) sourceButton.disabled = false;
    }
  }

export function storeActiveJob(jobId) {
    studio.activeJobId = jobId || null;
    try {
      if (studio.activeJobId) localStorage.setItem(studio.ACTIVE_JOB_KEY, studio.activeJobId);
      else localStorage.removeItem(studio.ACTIVE_JOB_KEY);
    } catch (e) {}
  }

export function getStoredActiveJob() {
    try { return localStorage.getItem(studio.ACTIVE_JOB_KEY) || ''; } catch (e) { return ''; }
  }

export function getSeenDoneJob() {
    try { return localStorage.getItem(studio.SEEN_DONE_JOB_KEY) || ''; } catch (e) { return ''; }
  }

export function clearPoll() {
    if (studio.pollTimer) clearInterval(studio.pollTimer);
    studio.pollTimer = null;
  }

export function setGenerateButton(disabled, text) {
    studio.generateEl.disabled = !!disabled;
    studio.generateEl.textContent = text || (hasAuthenticatedCreator() ? 'Generate' : 'Log in to Generate');
  }

export function updateGenerateAccess() {
    if (studio.isSubmitting || studio.pollTimer) return;
    setGenerateButton(false);
    if (!hasAuthenticatedCreator()) {
      setStatus('Log in before generating so the piece is tied to your account.', true);
      return;
    }
    if (studio.statusEl.textContent === 'Log in before generating so the piece is tied to your account.') {
      setStatus('');
    }
  }

export function showSubmitting() {
    studio.latestEl.classList.remove('is-shown', 'has-image', 'has-error');
    setGenerateButton(true, 'Submitting…');
    setStatus('Submitting job to the Studio.');
  }

export function showGenerating(job) {
    clearObjectUrl(studio.latestImg);
    studio.latestImg.removeAttribute('src');
    studio.latestImg.alt = '';
    studio.latestCap.innerHTML = '';
    studio.latestDetails.style.display = 'none';
    studio.latestEnhanced.innerHTML = '';
    studio.pendingPromptEl.textContent = job.prompt || studio.promptEl.value.trim();
    studio.pendingStatusEl.textContent = 'Enzo is composing';
    studio.latestEl.classList.remove('has-image', 'has-error');
    studio.latestEl.classList.add('is-shown');
    setGenerateButton(true, 'Generating…');
    setStatus('Generating. You can leave Studio and come back; this job is tracked on the server.');
  }

export function showJobDone(job) {
    try {
      localStorage.setItem(studio.SEEN_DONE_JOB_KEY, String(job.id || job.jobId));
      window.dispatchEvent(new CustomEvent('vos:avatar-badge-refresh'));
    } catch (e) {}
    storeActiveJob(null);
    setImageSrc(studio.latestImg, job.result_url, { visibility: 'private' }, true);
    studio.latestImg.alt = job.title || job.prompt || 'Generated art';
    studio.latestDetails.style.display = 'none';
    studio.latestEnhanced.innerHTML = '';
    const title = escapeHtml(job.title || job.prompt || 'Generated art');
    const privateHref = job.gallery_id
      ? `/Tools/art/?gallery=mine&image=${encodeURIComponent(job.gallery_id)}`
      : '#vos-art-gallery-section';
    studio.latestCap.innerHTML = `${title}<br><a href="${privateHref}">Open private piece &rarr;</a> · <a href="/art-submissions/">Art submissions &rarr;</a>`;
    studio.latestEl.classList.remove('has-error');
    studio.latestEl.classList.add('is-shown', 'has-image');
    setGenerateButton(false);
    setStatus('Done. Saved privately. Share it to the group gallery when it is table-safe.', false, { clearAfter: 6500 });
  }

export function copyForErrorCode(code, fallback, extras) {
    extras = extras || {};
    switch (code) {
      case 'quota': {
        const reset = extras.resets_at
          ? new Date(extras.resets_at + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
          : 'next month';
        return {
          title: 'Monthly limit reached',
          message: `You've used all your image generations for this month. Resets ${reset}.`,
          allowRetry: false,
        };
      }
      case 'auth':
        return {
          title: 'Log in to generate',
          message: 'Generation is tied to your player account. Log in and try again.',
          allowRetry: true,
        };
      case 'invalid_prompt':
        return {
          title: 'Prompt not accepted',
          message: fallback || 'The prompt was rejected — try rephrasing.',
          allowRetry: true,
        };
      case 'api_error':
        return {
          title: 'OpenAI is unavailable',
          message: 'The image API didn’t respond. Wait a minute and try again.',
          allowRetry: true,
        };
      default:
        return {
          title: 'Generation failed',
          message: fallback || 'The server marked this job as failed.',
          allowRetry: true,
        };
    }
  }

export function showJobError(job) {
    storeActiveJob(null);
    clearObjectUrl(studio.latestImg);
    studio.latestImg.removeAttribute('src');
    studio.latestImg.alt = '';
    studio.pendingPromptEl.textContent = '';
    studio.latestDetails.style.display = 'none';
    studio.latestEnhanced.innerHTML = '';
    studio.latestCap.innerHTML = '';
    const copy = copyForErrorCode(job.error_code, job.error_message, job.quota || {});
    const wrap = document.createElement('div');
    wrap.className = 'vos-art-latest-error';
    const title = document.createElement('strong');
    title.textContent = copy.title;
    const message = document.createElement('p');
    message.textContent = copy.message;
    wrap.append(title, message);
    if (copy.allowRetry) {
      const retry = document.createElement('button');
      retry.className = 'vos-art-retry';
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => {
        studio.promptEl.value = job.prompt || studio.promptEl.value;
        generate();
      });
      wrap.appendChild(retry);
    }
    studio.latestCap.appendChild(wrap);
    studio.latestEl.classList.remove('has-image');
    studio.latestEl.classList.add('is-shown', 'has-error');
    setGenerateButton(false);
    setStatus(copy.title + '.', true);
  }

export function showIdle() {
    studio.latestEl.classList.remove('is-shown', 'has-image');
    studio.latestEl.classList.remove('has-error');
    clearObjectUrl(studio.latestImg);
    studio.latestImg.removeAttribute('src');
    studio.latestCap.innerHTML = '';
    studio.pendingPromptEl.textContent = '';
    setGenerateButton(false);
  }

export function renderJob(job) {
    if (!job) {
      showIdle();
      return;
    }
    storeActiveJob(job.jobId || job.id);
    if (job.status === 'pending') {
      showGenerating(job);
      return;
    }
    clearPoll();
    if (job.status === 'done') {
      showJobDone(job);
      studio.currentGalleryScope = 'mine';
      syncGalleryChrome();
      loadGallery({ quiet: true });
      return;
    }
    if (job.status === 'error') {
      showJobError(job);
      return;
    }
    showIdle();
  }

export async function fetchJob(jobId) {
    const response = await fetch(studio.API_BASE + '/api/studio/jobs/' + encodeURIComponent(jobId), {
      cache: 'no-store',
      headers: requestHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

export function startPolling(jobId) {
    clearPoll();
    const poll = async () => {
      try {
        const job = await fetchJob(jobId);
        renderJob(job);
      } catch (error) {
        setStatus('Still checking the server for this job.', true);
      }
    };
    poll();
    studio.pollTimer = setInterval(poll, studio.POLL_MS);
  }

export async function restoreStudioJobs() {
    const creator = getCurrentCreatorName();
    if (!creator || !hasAuthenticatedCreator()) return;
    try {
      const url = studio.API_BASE + '/api/studio/jobs?mine=1&name=' + encodeURIComponent(creator);
      const response = await fetch(url, { cache: 'no-store', headers: requestHeaders() });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const stored = getStoredActiveJob();
      const job = jobs.find((candidate) => candidate.id === stored || candidate.jobId === stored)
        || jobs.find((candidate) => candidate.status === 'pending');
      if (!job) {
        if (stored) storeActiveJob(null);
        return;
      }
      const jobId = String(job.id || job.jobId || '');
      if (job.status === 'done' && stored) {
        const updatedAt = Date.parse(job.updated_at || job.created_at || '');
        const staleDone = Number.isFinite(updatedAt) && Date.now() - updatedAt > 15 * 60 * 1000;
        if (getSeenDoneJob() === jobId || staleDone) {
          storeActiveJob(null);
          return;
        }
      }
      renderJob(job);
      if (job.status === 'pending') startPolling(job.jobId || job.id);
    } catch (e) {}
  }
