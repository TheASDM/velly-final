import { studio } from './state.js';
import { getCreatorName, hasAuthenticatedCreator, openStudioLogin, requestHeaders } from './identity.js';
import { setStatus, showGenerating, showIdle, showJobError, showSubmitting, startPolling, storeActiveJob } from './jobs.js';

export async function generate() {
    if (studio.isSubmitting || studio.generateEl.disabled) return;
    if (!hasAuthenticatedCreator()) {
      setStatus('Log in before generating so the piece is tied to your account.', true);
      await openStudioLogin();
      return;
    }
    const prompt = studio.promptEl.value.trim();
    if (!prompt) {
      setStatus('Add a description first.', true);
      studio.promptEl.focus();
      return;
    }
    if (prompt.length > 3000) {
      setStatus('That prompt is over the 3000-character limit.', true);
      return;
    }
    const creatorName = await getCreatorName();
    if (!creatorName || !hasAuthenticatedCreator()) {
      setStatus('Log in before generating so the piece is attributed correctly.', true);
      return;
    }
    studio.isSubmitting = true;
    const enhance = !!studio.enhanceEl.checked;
    showSubmitting();

    try {
      const res = await fetch(studio.API_BASE + '/api/studio/generate', {
        method: 'POST',
        headers: requestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          prompt,
          style: studio.selectedStyle,
          creator: creatorName,
          enhance,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Render the same error card the polling path uses so quota /
        // auth / invalid_prompt get the right copy.
        showJobError({
          prompt,
          error_message: err.error || `HTTP ${res.status}`,
          error_code: err.error_code,
          quota: err.quota,
        });
        return;
      }
      const data = await res.json();
      const jobId = data.jobId;
      if (!jobId) throw new Error('Server did not return a job id.');
      storeActiveJob(jobId);
      studio.promptEl.value = '';
      showGenerating({ jobId, prompt, status: 'pending' });
      startPolling(jobId);
    } catch (e) {
      console.error(e);
      showIdle();
      setStatus('Could not start generation: ' + e.message, true);
    } finally {
      studio.isSubmitting = false;
    }
  }

export function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
