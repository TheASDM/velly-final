export const studio = {};

studio.API_BASE = '';
studio.STYLE_KEY = 'velly.artStudio.lastStyle';
studio.ACTIVE_JOB_KEY = 'velly.artStudio.activeJobId';
studio.SEEN_DONE_JOB_KEY = 'vos.studio.seenDoneJobId';
studio.POLL_MS = 2500;
studio.urlParams = new URLSearchParams(window.location.search);
studio.galleryFavoritesOnly = studio.urlParams.get('favorites') === '1';
/* `filter` is the name the app bar's menu uses; `gallery`/`scope` are the
   older ones that live in links people already shared. */
studio.requestedGalleryScope = (studio.urlParams.get('gallery')
    || studio.urlParams.get('scope')
    || studio.urlParams.get('filter')
    || '').toLowerCase();
studio.initialGalleryScope = (studio.galleryFavoritesOnly || studio.requestedGalleryScope === 'favorites')
    ? 'favorites'
    : (['mine', 'shared', 'all'].includes(studio.requestedGalleryScope) ? studio.requestedGalleryScope : 'shared');
studio.$ = (id) => document.getElementById(id);
studio.promptEl = studio.$('vos-art-prompt');
studio.styleSelectEl = studio.$('vos-art-style-select');
studio.styleSummaryEl = studio.$('vos-art-style-summary');
studio.enhanceEl = studio.$('vos-art-enhance');
studio.generateEl = studio.$('vos-art-generate');
studio.statusEl = studio.$('vos-art-status');
studio.latestEl = studio.$('vos-art-latest');
studio.latestImg = studio.$('vos-art-latest-img');
studio.latestCap = studio.$('vos-art-latest-caption');
studio.latestDetails = studio.$('vos-art-latest-details');
studio.latestEnhanced = studio.$('vos-art-latest-enhanced');
studio.pendingPromptEl = studio.$('vos-art-latest-pending-prompt');
studio.pendingStatusEl = studio.$('vos-art-latest-pending-status');
studio.galleryEl = studio.$('vos-art-gallery');
studio.countEl = studio.$('vos-art-gallery-count');
studio.gallerySection = studio.$('vos-art-gallery-section');
studio.refreshGalleryEl = studio.$('vos-art-gallery-refresh');
studio.galleryTitleEl = studio.$('vos-art-gallery-title');
studio.galleryTabsEl = studio.$('vos-art-gallery-tabs');
studio.galleryNoteEl = studio.$('vos-art-gallery-note');
studio.lightbox = studio.$('vos-art-lightbox');
studio.lightImg = studio.$('vos-art-lightbox-img');
studio.lightCap = studio.$('vos-art-lightbox-caption');
studio.lightDelete = studio.$('vos-art-lightbox-delete');
studio.ENHANCE_KEY = 'velly.artStudio.enhance';
studio.selectedStyle = null;
studio.defaultStyle = 'valley-scene';
studio.availableStyles = [];
studio.activeJobId = null;
studio.pollTimer = null;
studio.isSubmitting = false;
studio.galleryHasLoaded = false;
studio.statusTimer = null;
studio.currentGalleryScope = studio.initialGalleryScope;
studio.GALLERY_SCOPES = {
    mine: {
      title: 'My Submissions',
      noun: 'piece',
      note: 'New pieces start private to you and the DM. Share one to the campaign library when it is table-safe.',
      empty: 'Nothing here yet. Anything you make in Create lands here first.',
    },
    shared: {
      title: 'Campaign',
      noun: 'piece',
      note: 'Art the table can see.',
      empty: 'No campaign art yet.',
    },
    favorites: {
      title: 'Favorites',
      noun: 'favorite',
      note: 'Saved pieces you can still view.',
      empty: 'No favorites yet.',
    },
    all: {
      title: 'All — DM',
      noun: 'piece',
      note: 'DM view includes private and shared art from every creator.',
      empty: 'No Studio art has been generated yet.',
    },
  };
studio.GALLERY_PAGE = 40;
studio.loadMoreEl = document.getElementById('vos-art-load-more');
studio.galleryOffset = 0;
studio.galleryTotal = 0;
studio.favoriteIds = new Set();
studio.referencesLoaded = false;
studio.referencesEl = document.getElementById('vos-art-references');
studio.pendingOpenImageId = null;
studio.pullStartY = null;
studio.currentLightboxEntry = null;
studio.lightFavorite = document.getElementById('vos-art-lightbox-favorite');
studio.lightShare = document.getElementById('vos-art-lightbox-share');
studio.lightPin = document.getElementById('vos-art-lightbox-pin');
studio.pinMenuEl = document.getElementById('vos-art-pin-menu');
studio.wikiPagesByTitle = null;
studio.mode = 'view';
