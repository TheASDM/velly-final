const CACHE_NAME = 'enzo-v1';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/css/chatbot.css',
    '/js/chatbot.js',
    '/images/loremaster192x192.png',
    '/images/loremaster512x512.png',
    '/images/loremasterDM192x192.png',
    '/images/loremaster5e192x192.png',
    '/images/loremasterYasQueen192x192.png'
];

// Install: pre-cache app shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean up old cache versions
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch strategy
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API requests: network only — never cache
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Same-origin static assets: cache-first
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached =>
                cached || fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
            )
        );
        return;
    }

    // Cross-origin (Google Fonts, etc.): cache-first
    event.respondWith(
        caches.match(event.request).then(cached =>
            cached || fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
        )
    );
});
