const CACHE_VERSION = 'ninfit-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

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
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('ninfit-shell-') && key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    // Installed-app launches prefer the live deployment. The cached root is only an
    // offline fallback, so a new main deployment is visible on the next real launch.
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match('/').then((response) => response || Response.error()),
      ),
    );
    return;
  }

  // The precache currently contains only stable shell metadata/icons. Vite's JS/CSS
  // assets are content-hashed and are not written to this runtime cache.
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
