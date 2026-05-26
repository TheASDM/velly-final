const CACHE_VERSION = 'vallombrosa-pwa-v9';
const PRECACHE = `${CACHE_VERSION}-precache`;
const PAGES = `${CACHE_VERSION}-pages`;
const ASSETS = `${CACHE_VERSION}-assets`;
const GALLERY = `${CACHE_VERSION}-gallery`;

const APP_SHELL = [
  '/',
  '/offline/',
  '/pwa-client.js',
  '/manifest.webmanifest',
  '/css/chatbot.css',
  '/js/chatbot.js',
  '/pagefind/pagefind-ui.css',
  '/pagefind/pagefind-ui.js',
  '/images/apple-touch-icon.png',
  '/images/pwa-icon-192.png',
  '/images/pwa-icon-512.png',
  '/images/pwa-maskable-512.png',
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
  '/images/loremasterfabio192x192.png'
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
      data = { title: 'Vallombrosa', body: event.data.text() };
    }
  }

  const title = data.title || 'Vallombrosa';
  const options = {
    body: data.body || '',
    icon: '/images/pwa-icon-192.png',
    badge: '/images/pwa-icon-192.png',
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data && event.notification.data.url || '/', self.location.origin);

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
