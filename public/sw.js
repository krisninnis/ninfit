/**
 * Cache generations, not a single cache name.
 *
 * `CACHE_GENERATION` is bumped whenever the caching contract itself changes. The
 * previous generation is deliberately RETAINED rather than deleted, because the
 * document that is running right now was served by it and can still ask for one of
 * its hashed lazy chunks (Profile's AccountSection, the Journey maps, the NinFit ID
 * auth client). Deleting the generation underneath a live client is what turned a
 * routine update into "This screen couldn't open" on a real device.
 *
 * Two generations is the whole budget: current, plus the one a live client may still
 * be executing. Anything older is removed so the cache cannot grow without limit.
 */
const CACHE_PREFIX = 'ninfit-shell-v';
const CACHE_GENERATION = 4;
const CACHE_VERSION = `${CACHE_PREFIX}${CACHE_GENERATION}`;
const RETAINED_GENERATIONS = 2;

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
 * The asset list the PREVIOUS deployment booted from, read out of this cache before
 * the new manifest overwrites it. It is the allow-list that keeps a still-running
 * previous client working; without it there would be no way to tell a chunk that is
 * merely superseded from one that is genuinely abandoned.
 *
 * Unknown - no manifest cached yet, or an unreadable one - means "prune nothing". A
 * cache we cannot describe is never trimmed on a guess.
 */
async function cachedManifestAssets(cache) {
  try {
    const cached = await cache.match(OFFLINE_ASSET_MANIFEST);
    if (!cached) return undefined;
    const payload = await cached.json();
    if (payload === null || typeof payload !== 'object' || !Array.isArray(payload.assets)) {
      return undefined;
    }
    return payload.assets.filter((asset) => typeof asset === 'string');
  } catch {
    return undefined;
  }
}

/**
 * Drop hashed assets that neither the new build nor the immediately previous build
 * needs. Every deployment adds a fresh set of hashed files; without this the cache
 * grows by a whole build on every release until the browser evicts the origin's
 * storage - which would take the offline boot with it.
 */
async function pruneSupersededAssets(cache, currentAssets, previousAssets) {
  if (previousAssets === undefined) return;

  const keep = new Set([...currentAssets, ...previousAssets]);
  const cached = await cache.keys();

  for (const request of cached) {
    const path = new URL(request.url).pathname;
    if (!OFFLINE_ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    if (keep.has(path)) continue;
    await cache.delete(request);
  }
}

/**
 * Refresh the complete offline set atomically enough for our promise: all new assets
 * are cached before the cached root HTML is replaced. If any asset fails, the previous
 * offline root remains authoritative and an online launch still succeeds normally.
 *
 * Deliberately do not delete the assets the previous build booted from. Another open
 * tab or installed client may still be executing that build and can request one of
 * its lazy chunks later. Removing that chunk underneath a live client turns a safe
 * background refresh into a runtime screen failure.
 */
async function refreshOfflineBoot(rootResponse) {
  const cache = await caches.open(CACHE_VERSION);
  const previousAssets = await cachedManifestAssets(cache);
  const { response: manifestResponse, assets } = await fetchOfflineAssetManifest();

  await cache.addAll(assets);
  await cache.put(OFFLINE_ASSET_MANIFEST, manifestResponse.clone());
  await cache.put('/', rootResponse.clone());
  await pruneSupersededAssets(cache, assets, previousAssets);
}

/**
 * Installed-app launches prefer the live deployment. Every successful online launch
 * refreshes both the root HTML and the exact JS/CSS/art set needed by that build,
 * without reloading the running document or interrupting an active Journey.
 *
 * The refresh runs through `waitUntil`, NOT in front of the response. Precaching the
 * build plus its artwork is megabytes of work; holding the navigation response until
 * that finished made every launch on a phone connection wait for the entire offline
 * set before the app could paint.
 */
function networkFirstNavigation(event) {
  return (async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });

      if (response.ok) {
        const rootForCache = response.clone();
        event.waitUntil(refreshOfflineBoot(rootForCache).catch(() => undefined));
      }

      return response;
    } catch {
      const cached = await caches.match('/');
      return cached || Response.error();
    }
  })();
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

/**
 * Keep the newest `RETAINED_GENERATIONS` cache generations. `skipWaiting` plus
 * `clients.claim` means this worker takes over documents that are still running the
 * previous build, so the previous generation must survive activation.
 */
async function pruneOldCacheGenerations() {
  const keys = await caches.keys();
  const ninfitKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));

  const retained = new Set([CACHE_VERSION]);
  ninfitKeys
    .filter((key) => key !== CACHE_VERSION)
    .map((key) => ({ key, generation: Number.parseInt(key.slice(CACHE_PREFIX.length), 10) }))
    .filter((entry) => Number.isInteger(entry.generation))
    .sort((left, right) => right.generation - left.generation)
    .slice(0, RETAINED_GENERATIONS - 1)
    .forEach((entry) => retained.add(entry.key));

  await Promise.all(
    ninfitKeys.filter((key) => !retained.has(key)).map((key) => caches.delete(key)),
  );
}

self.addEventListener('activate', (event) => {
  event.waitUntil(pruneOldCacheGenerations().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
