const CACHE_VERSION = 'ninfit-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

/**
 * Installed-app launches prefer the live deployment, and the cached root is only an
 * offline fallback.
 *
 * The offline fallback also has to stay current. `sw.js` does not change on every
 * product deploy, so a root cached once at first installation would keep answering
 * offline launches with the first build the phone ever saw. Refresh it after every
 * successful online launch, without letting a cache write fail a launch.
 */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });

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
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  // The precache currently contains only stable shell metadata/icons. Vite's JS/CSS
  // assets are content-hashed and are not written to this runtime cache.
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
