const CACHE_VERSION = 'ninfit-shell-v3';
const OFFLINE_ASSET_MANIFEST = '/offline-assets.json';
const STABLE_SHELL = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

/**
 * Load the build-generated list of Vite assets required to boot the application.
 * The list is generated from Vite's own production manifest, so the worker never
 * guesses content-hashed filenames.
 */
async function fetchOfflineAssetManifest() {
  const response = await fetch(OFFLINE_ASSET_MANIFEST, { cache: 'no-store' });
  if (!response.ok) throw new Error('Offline asset manifest unavailable');

  const payload = await response.clone().json();
  if (payload === null || typeof payload !== 'object' || !Array.isArray(payload.assets)) {
    throw new Error('Offline asset manifest is malformed');
  }

  const assets = payload.assets.filter(
    (asset) => typeof asset === 'string' && asset.startsWith('/assets/') && !asset.includes('..'),
  );
  if (assets.length === 0 || assets.length !== payload.assets.length) {
    throw new Error('Offline asset manifest contains invalid assets');
  }

  return { response, assets };
}

/**
 * Refresh the complete offline boot set atomically enough for our promise: all new
 * hashed assets are cached before the cached root HTML is replaced. If any asset
 * fails, the previous offline root remains authoritative and an online launch still
 * succeeds normally.
 */
async function refreshOfflineBoot(rootResponse) {
  const cache = await caches.open(CACHE_VERSION);
  const { response: manifestResponse, assets } = await fetchOfflineAssetManifest();

  await cache.addAll(assets);
  await cache.put(OFFLINE_ASSET_MANIFEST, manifestResponse.clone());
  await cache.put('/', rootResponse.clone());

  // Once a complete new boot set is present, remove obsolete hashed bundles so
  // repeated deployments do not grow the cache forever.
  const keep = new Set(assets.map((asset) => new URL(asset, self.location.origin).href));
  const requests = await cache.keys();
  await Promise.all(
    requests
      .filter((request) => {
        const url = new URL(request.url);
        return url.origin === self.location.origin
          && url.pathname.startsWith('/assets/')
          && !keep.has(url.href);
      })
      .map((request) => cache.delete(request)),
  );
}

/**
 * Installed-app launches prefer the live deployment. Every successful online launch
 * refreshes both the root HTML and the exact hashed JS/CSS build set needed by that
 * HTML, without reloading the running document or interrupting an active Journey.
 */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response.ok) {
      await refreshOfflineBoot(response).catch(() => undefined);
    }

    return response;
  } catch {
    return caches.match('/').then((response) => response || Response.error());
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(STABLE_SHELL);

      const rootResponse = await fetch('/', { cache: 'no-store' });
      if (!rootResponse.ok) throw new Error('App shell unavailable during service-worker install');
      await refreshOfflineBoot(rootResponse);
    })(),
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

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
