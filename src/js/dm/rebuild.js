/* Rebuild status rendering and polling.
 *
 * Polls are keyed per status element: the wiki tab and the lore tab can each
 * follow their own build without fighting over one shared timer (which used
 * to land status text in the wrong panel and poll a stuck 'running' state
 * forever). A poll also carries the job id it cares about, so 'complete'
 * means THIS job finished — not whichever job's status happened to be on
 * disk when the timer fired. */

import { setStatus } from './dom.js';
import { adminJson, postJson } from './http.js';

const pollTimers = new Map(); // statusTarget -> timeout id
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 20 * 60 * 1000; // a stuck 'running' stops polling eventually

export function rebuildStatusText(rebuild) {
  if (!rebuild) return '';
  const state = rebuild.state || 'idle';
  if (state === 'queued') return 'Rebuild queued.';
  if (state === 'running') {
    const step = rebuild.current_step && rebuild.current_step !== 'starting'
      ? ` (${rebuild.current_step})`
      : '';
    return `Rebuild running${step}.`;
  }
  if (state === 'succeeded') return 'Rebuild complete.';
  if (state === 'failed') return `Rebuild failed: ${rebuild.error || 'check logs'}`;
  if (state === 'disabled') return 'Auto rebuild is disabled.';
  if (state === 'scheduled') {
    const seconds = rebuild.debounce_seconds || 90;
    return `Publish scheduled — builds in ~${seconds}s (Rebuild Now publishes immediately).`;
  }
  return '';
}

export function setStatusWithRebuild(target, base, rebuild) {
  const extra = rebuildStatusText(rebuild);
  setStatus(target, [base, extra].filter(Boolean).join(' '), rebuild && rebuild.state === 'failed');
  // A failed build's cause is in the output tail — show it in place instead
  // of sending the DM to the server logs. setStatus cleared the element, so
  // this collapsible only ever exists alongside its own failure message.
  if (target && rebuild && rebuild.state === 'failed' && rebuild.error_detail) {
    const details = document.createElement('details');
    details.className = 'vos-dm-build-detail';
    const summary = document.createElement('summary');
    summary.textContent = 'Build output';
    const pre = document.createElement('pre');
    pre.textContent = rebuild.error_detail;
    details.append(summary, pre);
    target.appendChild(details);
  }
}

export function stopRebuildPoll(target) {
  const timer = pollTimers.get(target);
  if (timer) window.clearTimeout(timer);
  pollTimers.delete(target);
}

export function pollRebuildStatus(target, jobId, startedAt) {
  stopRebuildPoll(target);
  const began = startedAt || Date.now();
  const timer = window.setTimeout(async () => {
    pollTimers.delete(target);
    try {
      const data = await adminJson('/api/admin/rebuild');
      const rebuild = data.rebuild || {};
      // A different job on disk means ours was superseded (or is queued
      // behind it) — keep waiting quietly rather than reporting the other
      // job's outcome as ours.
      const isOurs = !jobId || rebuild.job_id === jobId;
      if (isOurs) setStatusWithRebuild(target, '', rebuild);
      const active = rebuild.state === 'queued' || rebuild.state === 'running' || !isOurs;
      if (active && Date.now() - began < POLL_MAX_MS) {
        pollRebuildStatus(target, jobId, began);
      } else if (active) {
        setStatus(target, 'Still building — check back with Rebuild Now.', false);
      }
    } catch (error) {
      setStatus(target, error.message, true);
    }
  }, POLL_INTERVAL_MS);
  pollTimers.set(target, timer);
}

/* Show a save/publish response's rebuild info and start following it when a
 * build is actually in flight. */
export function followRebuild(target, base, rebuild) {
  setStatusWithRebuild(target, base, rebuild);
  if (rebuild && (rebuild.state === 'queued' || rebuild.state === 'running')) {
    pollRebuildStatus(target, rebuild.job_id);
  }
}

export async function triggerRebuild(target, reason) {
  const data = await postJson('/api/admin/rebuild', { reason, knowledge: true });
  followRebuild(target, '', data.rebuild || {});
  return data.rebuild || {};
}
