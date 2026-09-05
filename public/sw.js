const CACHE_VERSION = 'ninfit-shell-v3';
const OFFLINE_ASSET_MANIFEST = '/offline-assets.json';
const STABLE_SHELL = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const OFFLINE_ASSET_PREFIXES = ['/assets/', '/mascots/', '/egg/'];

/**
 * Load the build-generated list of assets required to boot and render the core app
 * offline. Vite owns hashed build assets; the build step also enumerates stable
 * app-owned public artwork used by the offline UI.
 */
async function fetchOfflineAssetManifest() {
  const response = await fetch(OFFLINE_ASSET_MANIFEST, { cache: 'no-store' });
  if (!response.ok) throw new Error('Offline asset manifest unavailable');

  const payload = await response.clone().json();
  if (payload === null || typeof payload !== 'object' || !Array.isArray(payload.assets)) {
    throw new Error('Offline asset manifest is malformed');
  }

  const assets = payload.assets.filter(
    (asset) => typeof asset === 'string'
      && OFFLINE_ASSET_PREFIXES.some((prefix) => asset.startsWith(prefix))
      && !asset.includes('..'),
  );
  if (assets.length === 0 || assets.length !== payload.assets.length) {
    throw new Error('Offline asset manifest contains invalid assets');
  }

  return { response, assets };
}

/**
 * Refresh the complete offline set atomically enough for our promise: all new assets
 * are cached before the cached root HTML is replaced. If any asset fails, the previous
 * offline root remains authoritative and an online launch still succeeds normally.
 *
 * Deliberately do not delete older hashed assets here. Another open tab or installed
 * client may still be executing the previous build and can request a lazy chunk later
 * (Profile's AccountSection is one concrete example). Removing that chunk underneath
 * a live client turns a safe background refresh into a runtime screen failure. Old
 * cache generations are still removed when CACHE_VERSION changes.
 */
async function refreshOfflineBoot(rootResponse) {
  const cache = await caches.open(CACHE_VERSION);
  const { response: manifestResponse, assets } = await fetchOfflineAssetManifest();

  await cache.addAll(assets);
  await cache.put(OFFLINE_ASSET_MANIFEST, manifestResponse.clone());
  await cache.put('/', rootResponse.clone());
}

/**
 * Installed-app launches prefer the live deployment. Every successful online launch
 * refreshes both the root HTML and the exact JS/CSS/art set needed by that build,
 * without reloading the running document or interrupting an active Journey.
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
