---
title: Art Submissions
description: Review your generated Studio art with the original prompt, Enzo prompt, and saved image.
published: true
date: 2026-05-28T00:00:00.000Z
tags: tools, art, submissions
permalink: /art-submissions/
---

<style>
.vos-art-submissions {
  --sub-gold: #ddb77f;
  --sub-border: rgba(176, 143, 100, 0.26);
  --sub-border-strong: rgba(221, 183, 127, 0.54);
  max-width: 1100px;
  margin: clamp(0.35rem, 2vw, 1.2rem) auto 2.5rem;
  padding: 0 clamp(0.15rem, 1.5vw, 1rem);
}
.vos-art-submissions-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 1rem;
  margin-bottom: 1.15rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(176, 143, 100, 0.18);
}
.vos-art-submissions-kicker {
  color: rgba(221, 183, 127, 0.72);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vos-art-submissions h1 {
  margin: 0.1rem 0 0;
  padding: 0;
  border: 0;
  color: #f0d4a5;
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.9rem, 4vw, 3.2rem);
  letter-spacing: 0.04em;
  line-height: 1;
}
.vos-art-submissions h1::after { content: none; }
.vos-art-submissions-actions {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.vos-art-submissions-action,
.vos-art-submissions-refresh,
.vos-art-submissions-login {
  appearance: none;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(221, 183, 127, 0.38);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(221, 183, 127, 0.13), rgba(221, 183, 127, 0.04));
  color: var(--sub-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.vos-art-submissions-action,
.vos-art-submissions-login {
  padding: 0.58rem 0.92rem;
}
.vos-art-submissions-refresh {
  width: 40px;
  padding: 0;
  border-radius: 50%;
  font-size: 1rem;
}
.vos-art-submissions-refresh:disabled { opacity: 0.55; cursor: progress; }
.vos-art-submissions-status {
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 0.72rem 0.85rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(176, 143, 100, 0.18);
  border-radius: 8px;
  background: rgba(7, 6, 10, 0.42);
  color: rgba(221, 183, 127, 0.78);
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
}
.vos-art-submissions-status:empty { display: none; }
.vos-art-submissions-status.is-error { color: #d8645c; }
.vos-art-submissions-list {
  display: grid;
  gap: 0.95rem;
}
.vos-art-submission {
  display: grid;
  grid-template-columns: minmax(180px, 280px) minmax(0, 1fr);
  gap: 1rem;
  padding: 0.9rem;
  border: 1px solid var(--sub-border);
  border-radius: 8px;
  background:
    radial-gradient(ellipse 80% 50% at 0% 0%, rgba(221, 183, 127, 0.08), transparent 64%),
    linear-gradient(180deg, rgba(16, 14, 20, 0.92), rgba(7, 6, 10, 0.96));
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.42);
}
.vos-art-submission-image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid rgba(221, 183, 127, 0.22);
  background: rgba(4, 4, 8, 0.65);
}
.vos-art-submission-placeholder {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: 6px;
  border: 1px dashed rgba(221, 183, 127, 0.25);
  color: rgba(221, 183, 127, 0.6);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-art-submission-title {
  margin: 0;
  color: #f0d4a5;
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1rem, 2vw, 1.35rem);
  letter-spacing: 0.04em;
}
.vos-art-submission-meta {
  margin-top: 0.3rem;
  color: rgba(221, 183, 127, 0.66);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-art-submission-prompts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 0.85rem;
}
.vos-art-submission-prompt {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid rgba(176, 143, 100, 0.18);
  border-radius: 6px;
  background: rgba(4, 4, 8, 0.38);
}
.vos-art-submission-label {
  margin-bottom: 0.35rem;
  color: var(--sub-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.vos-art-submission-text {
  color: rgba(232, 220, 200, 0.84);
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.vos-art-submission-status {
  margin-top: 0.85rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(216, 100, 92, 0.34);
  border-radius: 6px;
  background: rgba(80, 28, 28, 0.22);
  color: #d8645c;
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
}
.vos-art-submission-links {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-top: 0.85rem;
}
.vos-art-submission-links a {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0.42rem 0.68rem;
  border: 1px solid rgba(221, 183, 127, 0.28);
  border-radius: 6px;
  color: var(--sub-gold);
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vos-art-submissions-empty {
  padding: 2rem 1.4rem;
  text-align: center;
  border: 1px dashed var(--sub-border);
  border-radius: 8px;
  background: rgba(7, 6, 10, 0.42);
  color: rgba(221, 183, 127, 0.62);
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
}
@media (max-width: 760px) {
  .vos-art-submissions {
    margin-top: 0;
    padding: 0;
  }
  .vos-art-submissions-head {
    align-items: center;
    grid-template-columns: 1fr;
    gap: 0.7rem;
  }
  .vos-art-submissions-actions {
    justify-content: flex-start;
  }
  .vos-art-submission {
    grid-template-columns: 1fr;
  }
  .vos-art-submission-prompts {
    grid-template-columns: 1fr;
  }
}
</style>

<div class="vos-art-submissions">
  <header class="vos-art-submissions-head">
    <div>
      <div class="vos-art-submissions-kicker">Studio</div>
      <h1>Art Submissions</h1>
    </div>
    <div class="vos-art-submissions-actions">
      <a class="vos-art-submissions-action" href="/en/Tools/art/">Studio</a>
      <button id="vos-art-submissions-refresh" class="vos-art-submissions-refresh" type="button" aria-label="Refresh art submissions" title="Refresh">↻</button>
    </div>
  </header>

  <div id="vos-art-submissions-status" class="vos-art-submissions-status" role="status" aria-live="polite"></div>
  <div id="vos-art-submissions-list" class="vos-art-submissions-list"></div>
</div>

<script>
(function () {
  const API_BASE = '';
  const listEl = document.getElementById('vos-art-submissions-list');
  const statusEl = document.getElementById('vos-art-submissions-status');
  const refreshEl = document.getElementById('vos-art-submissions-refresh');

  function getAuthToken() {
    if (window.VOS_PWA && window.VOS_PWA.getAuthToken) {
      return window.VOS_PWA.getAuthToken() || '';
    }
    try { return localStorage.getItem('vos.authToken') || ''; } catch (e) { return ''; }
  }

  function isAuthenticated() {
    const pwa = window.VOS_PWA;
    if (pwa && typeof pwa.isAuthenticated === 'function') return pwa.isAuthenticated();
    return !!getAuthToken();
  }

  function requestHeaders(headers) {
    const token = getAuthToken();
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  function assetUrl(url) {
    if (!url) return '';
    return /^https?:\/\//i.test(url) || url.startsWith('data:')
      ? url
      : API_BASE + url;
  }

  function titleFor(job) {
    return (job && (job.title || job.prompt)) || 'Untitled piece';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (e) {
      return iso;
    }
  }

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderEmpty(message, includeLogin) {
    listEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'vos-art-submissions-empty';
    empty.textContent = message;
    if (includeLogin) {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '0.9rem';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vos-art-submissions-login';
      btn.textContent = 'Log in';
      btn.addEventListener('click', async () => {
        if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
          await window.VOS_PWA.ensureIdentity({ force: true });
          loadSubmissions();
        }
      });
      wrap.appendChild(btn);
      empty.appendChild(wrap);
    }
    listEl.appendChild(empty);
  }

  function renderJob(job) {
    const article = document.createElement('article');
    article.className = 'vos-art-submission';

    const media = document.createElement('div');
    if (job.result_url) {
      const img = document.createElement('img');
      img.className = 'vos-art-submission-image';
      img.loading = 'lazy';
      img.alt = titleFor(job);
      img.src = assetUrl(job.result_url);
      media.appendChild(img);
    } else {
      const pending = document.createElement('div');
      pending.className = 'vos-art-submission-placeholder';
      pending.textContent = job.status === 'error' ? 'Error' : 'Pending';
      media.appendChild(pending);
    }

    const body = document.createElement('div');
    const heading = document.createElement('h2');
    heading.className = 'vos-art-submission-title';
    heading.textContent = titleFor(job);
    body.appendChild(heading);

    const meta = document.createElement('div');
    meta.className = 'vos-art-submission-meta';
    meta.textContent = `${job.status || 'pending'}${job.updated_at ? ' / ' + fmtDate(job.updated_at) : ''}`;
    body.appendChild(meta);

    const prompts = document.createElement('div');
    prompts.className = 'vos-art-submission-prompts';
    prompts.innerHTML = `
      <section class="vos-art-submission-prompt">
        <div class="vos-art-submission-label">Your Prompt</div>
        <div class="vos-art-submission-text">${escapeHtml(job.prompt || 'No prompt recorded.')}</div>
      </section>
      <section class="vos-art-submission-prompt">
        <div class="vos-art-submission-label">Enzo Prompt</div>
        <div class="vos-art-submission-text">${escapeHtml(job.enhanced_prompt || 'No Enzo prompt recorded for this submission.')}</div>
      </section>
    `;
    body.appendChild(prompts);

    if (job.error_message) {
      const error = document.createElement('div');
      error.className = 'vos-art-submission-status is-error';
      error.textContent = job.error_message;
      body.appendChild(error);
    }

    const links = document.createElement('div');
    links.className = 'vos-art-submission-links';
    if (job.gallery_id) {
      const gallery = document.createElement('a');
      gallery.href = '/en/Tools/art/?image=' + encodeURIComponent(job.gallery_id);
      gallery.textContent = 'Open in Gallery';
      links.appendChild(gallery);
    } else if (job.result_url) {
      const image = document.createElement('a');
      image.href = assetUrl(job.result_url);
      image.textContent = 'Open Image';
      links.appendChild(image);
    }
    const studio = document.createElement('a');
    studio.href = '/en/Tools/art/';
    studio.textContent = 'Studio';
    links.appendChild(studio);
    body.appendChild(links);

    article.append(media, body);
    return article;
  }

  function renderJobs(jobs) {
    listEl.innerHTML = '';
    if (!jobs.length) {
      renderEmpty('No art submissions yet.');
      return;
    }
    const frag = document.createDocumentFragment();
    jobs.forEach((job) => frag.appendChild(renderJob(job)));
    listEl.appendChild(frag);
  }

  async function loadSubmissions() {
    if (!isAuthenticated()) {
      setStatus('Log in to see your art submissions.', true);
      renderEmpty('Art submissions are tied to your player account.', true);
      return;
    }
    refreshEl.disabled = true;
    setStatus('Loading art submissions.');
    try {
      const response = await fetch(API_BASE + '/api/studio/jobs?mine=1&limit=100', {
        cache: 'no-store',
        headers: requestHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      renderJobs(jobs);
      setStatus(jobs.length ? `${jobs.length} submissions loaded.` : '');
    } catch (error) {
      renderEmpty('Could not load art submissions.');
      setStatus('Could not load art submissions: ' + error.message, true);
    } finally {
      refreshEl.disabled = false;
    }
  }

  refreshEl.addEventListener('click', loadSubmissions);
  window.addEventListener('vos:identity', loadSubmissions);
  window.addEventListener('DOMContentLoaded', loadSubmissions);
})();
</script>
