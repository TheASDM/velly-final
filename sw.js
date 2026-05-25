const CACHE_VERSION = 'vallombrosa-pwa-v1';
const PRECACHE = `${CACHE_VERSION}-precache`;
const PAGES = `${CACHE_VERSION}-pages`;
const ASSETS = `${CACHE_VERSION}-assets`;
const GALLERY = `${CACHE_VERSION}-gallery`;

const APP_SHELL = [
  '/',
  '/offline/',
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
  '/images/masqueradeline.png'
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
