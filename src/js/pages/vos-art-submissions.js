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
      gallery.href = '/studio/?image=' + encodeURIComponent(job.gallery_id);
      gallery.textContent = 'Open in Gallery';
      links.appendChild(gallery);
    } else if (job.result_url) {
      const image = document.createElement('a');
      image.href = assetUrl(job.result_url);
      image.textContent = 'Open Image';
      links.appendChild(image);
    }
    const studio = document.createElement('a');
    studio.href = '/studio/';
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
