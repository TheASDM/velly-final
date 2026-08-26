const CACHE_VERSION = 'foglight-pwa-v66';
const PRECACHE = `${CACHE_VERSION}-precache`;
const PAGES = `${CACHE_VERSION}-pages`;
const ASSETS = `${CACHE_VERSION}-assets`;
const GALLERY = `${CACHE_VERSION}-gallery`;

const APP_SHELL = [
  '/',
  '/messages/',
  '/notes/',
  '/settings/',
  '/submit-lore/',
  '/art-submissions/',
  '/en/Tools/art/',
  '/dm/',
  '/offline/',
  '/js/pwa-client.js',
  '/manifest.webmanifest',
  '/css/app-shell.css',
  '/css/chatbot.css',
  '/css/art-submissions.css',
  '/css/dm.css',
  '/css/dossiers.css',
  '/css/gallery-carousel.css',
  '/css/home.css',
  '/css/notes.css',
  '/css/studio.css',
  '/css/submit-lore.css',
  '/js/chatbot.js',
  '/js/pwa-manager.js',
  '/js/enzo-widget.js',
  '/js/viewport-handler.js',
  '/js/search-init.js',
  '/js/settings.js',
  '/js/in-play-live.js',
  '/js/vos-calendar.js',
  '/js/vos-tabs.js',
  '/js/vos-dm.js',
  '/js/vos-questionnaire.js',
  '/js/vos-dossiers.js',
  '/js/gallery-carousel.js',
  '/js/vos-art-submissions.js',
  '/js/vos-home.js',
  '/js/vos-messages.js',
  '/js/vos-notes.js',
  '/js/vos-studio.js',
  '/js/vos-submit-lore.js',
  '/questionnaire/',
  '/dossiers/',
  '/data/questionnaire.json',
  '/data/players.json',
  '/pagefind/pagefind-ui.css',
  '/pagefind/pagefind-ui.js',
  '/images/app-icon/favicon.png',
  '/images/app-icon/apple-touch-icon.png',
  '/images/app-icon/icon-192.png',
  '/images/app-icon/icon-512.png',
  '/images/app-icon/icon-maskable-512.png',
  '/images/masklogosquare.png',
  '/images/vallombrosa-logo.png',
  '/images/smalltitle.png',
  '/images/topnav.png',
  '/images/masqueradebackground.png',
  '/images/masqueradeline.png',
  '/images/loremaster192x192.png',
  '/images/loremaster5e192x192.png',
  '/images/loremaster5eDM192x192.png',
  '/images/loremasterDM192x192.png',
  '/images/loremasterRocky192x192.png',
  '/images/loremasterYasQueen192x192.png',
  '/images/loremasterfabio192x192.png',
  '/images/app-profiles/avatar-caravel-asteri.png',
  '/images/app-profiles/avatar-kryton-novelli.png',
  '/images/app-profiles/avatar-lotan.png',
  '/images/app-profiles/avatar-noname.png',
  '/images/app-profiles/avatar-orabella.png',
  '/images/app-profiles/avatar-roxanya.png',
  '/images/app-profiles/avatar-valentro.png',
  '/images/app-profiles/dustin.png',
  '/images/app-profiles/unmapped.png'
];

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isGalleryImage(url) {
  return url.pathname.startsWith('/api/gallery/image/');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(PAGES);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await network;
  if (response) return response;

  return caches.match('/offline/');
}

async function notifyClients(type) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({ type, version: CACHE_VERSION });
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => !name.startsWith(CACHE_VERSION))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
    await notifyClients('VOS_SW_UPDATED');
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isGalleryImage(url)) {
    event.respondWith(cacheFirst(request, GALLERY));
    return;
  }

  if (isApiRequest(url)) {
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (['style', 'script', 'font', 'image'].includes(request.destination)) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data = { title: 'Foglight', body: event.data.text() };
    }
  }

  const title = data.title || 'Foglight';
  const options = {
    body: data.body || '',
    icon: '/images/app-icon/icon-192.png',
    badge: '/images/app-icon/icon-192.png',
    data: {
      url: data.url || '/',
      messageId: data.messageId || null,
      playerName: data.playerName || '',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const noteData = event.notification.data || {};
  const targetUrl = new URL(noteData.url || '/', self.location.origin);

  // Tap receipt — best effort, never blocks opening the app.
  if (noteData.messageId) {
    event.waitUntil(fetch('/api/push/opened', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: noteData.messageId,
        name: noteData.playerName || '',
      }),
    }).catch(() => {}));
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          return client.navigate(targetUrl.href);
        }
        return;
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
