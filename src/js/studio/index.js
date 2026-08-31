/* Art Studio page behavior. */
import { studio } from './state.js';
import { loadGallery, shareEntry, toggleFavorite } from './gallery-actions.js';
import { setGalleryScope, syncGalleryChrome } from './gallery-view.js';
import { generate } from './generation.js';
import { renderStyles, updateStyleSummary } from './identity.js';
import { deleteEntry, restoreStudioJobs, updateGenerateAccess } from './jobs.js';
import { closeLightbox, openLightbox, togglePinMenu } from './lightbox.js';
import { loadReferences } from './references.js';
import { initStudioModes } from './modes.js';
import { loadCompilerChoice } from './compiler.js';

function bootStudio() {
  initStudioModes();

  if (studio.lightbox && studio.lightbox.parentNode !== document.body) {
      document.body.appendChild(studio.lightbox);
    }

  try {
      const lastEnhance = localStorage.getItem(studio.ENHANCE_KEY);
      if (lastEnhance === '0') studio.enhanceEl.checked = false;
    } catch (e) {}

  studio.enhanceEl.addEventListener('change', () => {
      try { localStorage.setItem(studio.ENHANCE_KEY, studio.enhanceEl.checked ? '1' : '0'); } catch (e) {}
    });

  studio.styleSelectEl.addEventListener('change', () => {
      studio.selectedStyle = studio.styleSelectEl.value;
      try { localStorage.setItem(studio.STYLE_KEY, studio.selectedStyle); } catch (e) {}
      updateStyleSummary();
    });

  fetch(studio.API_BASE + '/api/art-styles')
      .then(r => r.json())
      .then(data => {
        studio.defaultStyle = data.default || studio.defaultStyle;
        renderStyles(data.styles || []);
      })
      .catch(() => {
        renderStyles([]);
      });

  if (studio.galleryTabsEl) {
      studio.galleryTabsEl.addEventListener('click', (evt) => {
        const button = evt.target.closest('[data-gallery-scope]');
        if (!button) return;
        setGalleryScope(button.dataset.galleryScope);
      });
    }

  loadCompilerChoice();

  loadGallery();

  studio.refreshGalleryEl.addEventListener('click', () => loadGallery({ quiet: true }));

  if (studio.loadMoreEl) {
      studio.loadMoreEl.addEventListener('click', () => loadGallery({ quiet: true, append: true }));
    }

  if (studio.referencesEl) {
      studio.referencesEl.addEventListener('toggle', () => {
        if (studio.referencesEl.open) loadReferences();
      });
    }

  try {
      const params = new URLSearchParams(window.location.search);
      studio.pendingOpenImageId = params.get('image') || null;
    } catch (e) {}

  studio.gallerySection.addEventListener('touchstart', (event) => {
      if (window.scrollY > studio.gallerySection.offsetTop - 20) return;
      studio.pullStartY = event.touches[0].clientY;
    }, { passive: true });

  studio.gallerySection.addEventListener('touchend', (event) => {
      if (studio.pullStartY === null) return;
      const endY = event.changedTouches[0].clientY;
      if (endY - studio.pullStartY > 72) loadGallery({ quiet: true });
      studio.pullStartY = null;
    }, { passive: true });

  document.addEventListener('vos:open-gallery-piece', (evt) => {
      if (!evt.detail) return;
      evt.preventDefault();
      openLightbox(evt.detail);
    });

  studio.lightDelete.addEventListener('click', () => {
      if (studio.currentLightboxEntry) deleteEntry(studio.currentLightboxEntry, studio.lightDelete);
    });

  if (studio.lightFavorite) {
      studio.lightFavorite.addEventListener('click', () => {
        if (studio.currentLightboxEntry) toggleFavorite(studio.currentLightboxEntry, studio.lightFavorite);
      });
    }

  if (studio.lightShare) {
      studio.lightShare.addEventListener('click', () => {
        if (studio.currentLightboxEntry) shareEntry(studio.currentLightboxEntry);
      });
    }

  if (studio.lightPin) {
      studio.lightPin.addEventListener('click', () => {
        if (studio.currentLightboxEntry) togglePinMenu(studio.currentLightboxEntry);
      });
    }

  if (studio.pinMenuEl) {
      document.addEventListener('click', (evt) => {
        if (studio.pinMenuEl.hidden) return;
        if (studio.pinMenuEl.contains(evt.target) || evt.target === studio.lightPin) return;
        studio.pinMenuEl.hidden = true;
      });
    }

  studio.lightbox.addEventListener('click', (e) => { if (e.target === studio.lightbox) closeLightbox(); });

  studio.lightbox.querySelector('.vos-art-lightbox-close').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  studio.generateEl.addEventListener('click', generate);

  window.addEventListener('DOMContentLoaded', () => {
      syncGalleryChrome();
      updateGenerateAccess();
      restoreStudioJobs();
    });

  window.addEventListener('vos:identity', () => {
      loadCompilerChoice();
      syncGalleryChrome();
      updateGenerateAccess();
      restoreStudioJobs();
      loadGallery({ quiet: true });
    });

  window.addEventListener('focus', () => {
      syncGalleryChrome();
      loadGallery({ quiet: true });
    });

  syncGalleryChrome();

  updateGenerateAccess();

  studio.promptEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!studio.generateEl.disabled) generate();
      }
    });
}

bootStudio();
