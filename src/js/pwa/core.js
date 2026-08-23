export const PLAYER_KEY = 'vos.playerName';

export const AUTH_TOKEN_KEY = 'vos.authToken';

export const PUSH_DISMISSED_KEY = 'vos.pushPromptDismissed';

export const DM_SEEN_KEY = 'vos.dmMessage.seenId';

export const STUDIO_SEEN_JOB_KEY = 'vos.studio.seenDoneJobId';

export const AUTH_CONFIG_CACHE_KEY = 'vos.authConfig.cache';

export const AUTH_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

export const ROSTER_URL = '/data/players.json';

export const PROFILE_AVATAR_FALLBACK = '/images/app-profiles/unmapped.png';

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

export function getStorage(key) {
  try { return localStorage.getItem(key); } catch (error) { return null; }
}

export function setStorage(key, value) {
  try { localStorage.setItem(key, value); } catch (error) {}
}

export function removeStorage(key) {
  try { localStorage.removeItem(key); } catch (error) {}
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function decodeMarkdownUrl(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function safeMarkdownUrl(value) {
  const url = decodeMarkdownUrl(value);
  if (!url || /[\u0000-\u001f\s]/.test(url)) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('#')) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url;
  } catch (error) {}
  return '';
}

export function renderMarkdownEmphasis(html) {
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  return html;
}

export function renderSafeMarkdownInline(value) {
  const tokens = [];
  const stashToken = (markup) => {
    const index = tokens.length;
    tokens.push(markup);
    return `\u0000MDTOKEN${index}\u0000`;
  };

  let html = escapeHtml(value);
  html = html.replace(/`([^`\n]+)`/g, (_match, code) => stashToken(`<code>${code}</code>`));
  html = html.replace(/\[([^\]\n]{1,180})\]\(([^)\n]{1,500})\)/g, (_match, label, url) => {
    const safeUrl = safeMarkdownUrl(url);
    const safeLabel = renderMarkdownEmphasis(label);
    if (!safeUrl) return safeLabel;
    const external = /^(https?:|mailto:)/i.test(safeUrl);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return stashToken(`<a href="${escapeAttr(safeUrl)}"${attrs}>${safeLabel}</a>`);
  });
  html = renderMarkdownEmphasis(html);
  tokens.forEach((token, index) => {
    html = html.replace(new RegExp(`\\u0000MDTOKEN${index}\\u0000`, 'g'), token);
  });
  return html;
}

export function renderSafeMarkdownBlocks(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((rawBlock) => {
      const block = rawBlock.trim();
      if (!block) return '';
      const lines = block.split('\n');
      if (/^---+$/.test(block)) {
        return '<hr>';
      }
      const heading = block.match(/^#{1,4}\s+(.+)$/);
      if (heading && lines.length === 1) {
        return `<h4>${renderSafeMarkdownInline(heading[1])}</h4>`;
      }
      if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${renderSafeMarkdownInline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${renderSafeMarkdownInline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }
      if (lines.every((line) => /^\s*>\s?/.test(line))) {
        const quote = lines
          .map((line) => renderSafeMarkdownInline(line.replace(/^\s*>\s?/, '')))
          .join('<br>');
        return `<blockquote>${quote}</blockquote>`;
      }
      return `<p>${lines.map(renderSafeMarkdownInline).join('<br>')}</p>`;
    })
    .join('');
}

export function renderSafeMarkdown(value) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const code = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
    return renderSafeMarkdownBlocks(part);
  }).join('');
}

window.VOS_RENDER_MARKDOWN = renderSafeMarkdown;

export function removeNode(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

export function trapFocus(element, options) {
  const opts = options || {};
  const previousFocus = document.activeElement;
  const focusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable() {
    return Array.from(element.querySelectorAll(focusableSelector));
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && typeof opts.onEscape === 'function') {
      event.preventDefault();
      opts.onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = getFocusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  element.addEventListener('keydown', onKeyDown);

  requestAnimationFrame(() => {
    const target = opts.initialFocus || getFocusable()[0];
    if (target && typeof target.focus === 'function') {
      try { target.focus(); } catch (e) {}
    }
  });

  return function release() {
    element.removeEventListener('keydown', onKeyDown);
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try { previousFocus.focus(); } catch (e) {}
    }
  };
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
