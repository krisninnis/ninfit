const CACHE_VERSION = 'ninfit-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    // The original worker cached `/` only during its first-ever installation.
    // Because sw.js does not change on every product deploy, that left the offline
    // fallback pointing at the first installed build indefinitely. Refresh it after
    // every successful online launch without making cache writes a launch blocker.
    if (response.ok) {
      await caches
        .open(CACHE_VERSION)
        .then((cache) => cache.put('/', response.clone()))
        .catch(() => undefined);
    }

    return response;
  } catch {
    return caches.match('/').then((response) => response || Response.error());
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
