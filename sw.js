const CACHE_VERSION = 'foglight-pwa-v132';
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
  '/studio/',
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
  '/css/monsters.css',
  '/css/notes.css',
  '/css/sheet.css',
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
  '/js/vos-sheet.js',
  '/js/vos-sheets.js',
  '/js/vos-party.js',
  '/js/vos-monsters.js',
  '/js/gallery-carousel.js',
  '/js/vos-art-submissions.js',
  '/js/vos-home.js',
  '/js/vos-messages.js',
  '/js/vos-notes.js',
  '/js/vos-studio.js',
  '/js/vos-submit-lore.js',
  '/questionnaire/',
  '/dossiers/',
  '/sheet/',
  '/sheets/',
  '/party/',
  '/monsters/',
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
  '/images/app-profiles/avatar-lotan.png',
  '/images/app-profiles/avatar-noname.png',
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

/* Serve the cached asset now, fetch a fresh one for next time.
 *
 * Styles and scripts used to be cacheFirst, which returns the cached copy and
 * never asks again. Their URLs are stable — /css/app-shell.css is always
 * /css/app-shell.css — so the only thing that could ever replace them was a
 * new CACHE_VERSION taking control, and a new worker waits for every window to
 * close or for someone to press Refresh. An installed app that is never fully
 * closed is therefore pinned to the stylesheet it first cached, and a shipped
 * visual fix is invisible on the one device that matters most.
 *
 * One load behind is the honest trade: the page still paints instantly from
 * cache and still works offline, and the fix lands the next time it opens
 * rather than never. Whole loads stay coherent — every asset answers from the
 * same generation of cache and refreshes together.
 */
async function staleWhileRevalidateAsset(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  return (await network) || Response.error();
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
  /* Deduplicated, because addAll() rejects outright on a repeated URL and a
     rejected install is invisible: the worker goes straight to redundant, no
     version ever ships, and every client silently keeps the build it already
     had. That happened — /sheet/ and /party/ were added to the list above
     while already in it, and updates stopped for everyone until someone
     noticed the icon had not changed. A Set is cheaper than that. */
  const shell = [...new Set(APP_SHELL)];
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(shell))
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
    return;
  }
  /* Settings asks the *controlling* worker what it is, rather than reading
     caches.keys() and guessing: during a handover both the old and new caches
     exist, and the one that answers here is the one actually serving. */
  if (event.data && event.data.type === 'VOS_VERSION') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ version: CACHE_VERSION });
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

  // Code revalidates; fonts and images do not need to — they are effectively
  // immutable, and re-fetching them would cost bandwidth for nothing.
  if (['style', 'script'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidateAsset(request, ASSETS));
    return;
  }

  if (['font', 'image'].includes(request.destination)) {
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
    // A conversation collapses into one banner instead of stacking: same
    // tag replaces the previous notification, renotify still buzzes.
    tag: data.tag || undefined,
    renotify: data.tag ? true : undefined,
    data: {
      url: data.url || '/',
      messageId: data.messageId || null,
      playerName: data.playerName || '',
      threadKey: data.threadKey || null,
    },
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // The count on the installed app's icon, and a live nudge to any open
    // tab so the bubble moves while you are reading a wiki page.
    if (typeof data.unread === 'number' && self.navigator) {
      try {
        if (data.unread > 0 && self.navigator.setAppBadge) {
          await self.navigator.setAppBadge(data.unread);
        } else if (self.navigator.clearAppBadge) {
          await self.navigator.clearAppBadge();
        }
      } catch (error) { /* unsupported, or denied */ }
    }
    if (data.threadKey) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => client.postMessage({
        type: 'VOS_IM_PUSH',
        threadKey: data.threadKey,
        unread: typeof data.unread === 'number' ? data.unread : null,
      }));
    }
  })());
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
        // A chat tap opens the overlay in place — the page you were on
        // stays put. Only a cold start has to navigate.
        if (noteData.threadKey) {
          client.postMessage({ type: 'VOS_IM_OPEN', threadKey: noteData.threadKey });
          return;
        }
        if ('navigate' in client) {
          return client.navigate(targetUrl.href);
        }
        return;
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
