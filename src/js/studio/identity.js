import { studio } from './state.js';
import { updateGenerateAccess } from './jobs.js';

export function getCurrentCreatorName() {
    if (window.VOS_PWA && window.VOS_PWA.getPlayerName) {
      const name = window.VOS_PWA.getPlayerName();
      return name && typeof name === 'string' ? name.trim() : '';
    }
    try {
      return (localStorage.getItem('vos.playerName') || '').trim();
    } catch (e) {
      return '';
    }
  }

export function getCurrentAuthToken() {
    if (window.VOS_PWA && window.VOS_PWA.getAuthToken) {
      const token = window.VOS_PWA.getAuthToken();
      return token && typeof token === 'string' ? token.trim() : '';
    }
    try {
      return (localStorage.getItem('vos.authToken') || '').trim();
    } catch (e) {
      return '';
    }
  }

export function hasAuthenticatedCreator() {
    const pwa = window.VOS_PWA;
    if (pwa && typeof pwa.isAuthenticated === 'function') {
      return !!(getCurrentCreatorName() && pwa.isAuthenticated());
    }
    return !!(getCurrentCreatorName() && getCurrentAuthToken());
  }

export function isCurrentDm() {
    if (window.VOS_PWA && typeof window.VOS_PWA.isDm === 'function') {
      return !!window.VOS_PWA.isDm();
    }
    return getCurrentCreatorName() === 'DM';
  }

export async function openStudioLogin() {
    if (window.VOS_PWA && window.VOS_PWA.ensureIdentity) {
      await window.VOS_PWA.ensureIdentity({ force: true });
    }
    updateGenerateAccess();
  }

export async function getCreatorName() {
    return getCurrentCreatorName();
  }

export function requestHeaders(headers = {}) {
    if (window.VOS_PWA && typeof window.VOS_PWA.authHeaders === 'function') {
      return window.VOS_PWA.authHeaders(headers);
    }
    const token = window.VOS_PWA && window.VOS_PWA.getAuthToken
      ? window.VOS_PWA.getAuthToken()
      : '';
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

export function renderStyles(styles) {
    studio.availableStyles = Array.isArray(styles) ? styles : [];
    studio.styleSelectEl.innerHTML = '';
    let savedKey = null;
    try { savedKey = localStorage.getItem(studio.STYLE_KEY); } catch (e) {}
    studio.selectedStyle = savedKey && studio.availableStyles.some(s => s.key === savedKey)
      ? savedKey
      : studio.defaultStyle;

    if (!studio.availableStyles.length) {
      studio.selectedStyle = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Styles unavailable';
      studio.styleSelectEl.appendChild(opt);
      studio.styleSummaryEl.textContent = 'Could not load style choices.';
      return;
    }

    if (!studio.availableStyles.some(s => s.key === studio.selectedStyle)) {
      studio.selectedStyle = studio.availableStyles[0].key;
    }

    studio.availableStyles.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = s.label;
      studio.styleSelectEl.appendChild(opt);
    });
    studio.styleSelectEl.value = studio.selectedStyle;
    updateStyleSummary();
  }

export function updateStyleSummary() {
    const active = studio.availableStyles.find(s => s.key === studio.selectedStyle);
    studio.styleSummaryEl.textContent = active ? active.description : '';
  }
