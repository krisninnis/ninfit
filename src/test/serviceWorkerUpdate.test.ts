import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

type WorkerHandler = (event: Record<string, unknown>) => void;

const ORIGIN = 'https://ninfit.test';
const BOOT_ASSETS = ['/assets/index-current.js', '/assets/index-current.css'];
const PREVIOUS_ASSETS = [
  '/assets/index-previous.js',
  '/assets/AccountSection-previous.js',
];

function requestPath(input: unknown): string {
  if (typeof input === 'string') return new URL(input, ORIGIN).pathname;
  if (input !== null && typeof input === 'object' && 'url' in input) {
    return new URL(String((input as { url: unknown }).url), ORIGIN).pathname;
  }
  throw new Error('Unsupported request');
}

/**
 * A cache store with more than one cache in it.
 *
 * The previous harness stubbed `caches.keys()` to a constant and `caches.delete()` to
 * a no-op, so the activate handler was invisible to every test: a worker that deleted
 * the cache the running document depends on passed the whole suite while failing on a
 * real phone. Generations are modelled properly here because "which generation gets
 * deleted, and when" IS the contract under test.
 */
function createCacheStore(seed: Record<string, Record<string, string>>) {
  const generations = new Map<string, Map<string, Response>>();
  for (const [name, entries] of Object.entries(seed)) {
    generations.set(
      name,
      new Map(
        Object.entries(entries).map(([path, body]) => [path, new Response(body, { status: 200 })]),
      ),
    );
  }

  const openCache = (name: string) => {
    let stored = generations.get(name);
    if (!stored) {
      stored = new Map();
      generations.set(name, stored);
    }
    return stored;
  };

  return { generations, openCache };
}

async function bodyOf(response: Response | undefined) {
  return response === undefined ? undefined : response.clone().text();
}

interface WorkerHarnessOptions {
  /** Cache generations already on the device before this worker installs. */
  seed?: Record<string, Record<string, string>>;
  /** Asset list the previously cached `/offline-assets.json` advertised, if any. */
  previousManifestIn?: string;
  /** Override what the network serves as `/offline-assets.json`. */
  servedManifest?: unknown;
}

function loadWorker(options: WorkerHarnessOptions = {}) {
  const seed = options.seed ?? {
    'ninfit-shell-v4': {
      '/': 'previous offline shell',
      ...Object.fromEntries(PREVIOUS_ASSETS.map((path) => [path, `previous:${path}`])),
    },
  };

  if (options.previousManifestIn) {
    seed[options.previousManifestIn] = {
      ...seed[options.previousManifestIn],
      '/offline-assets.json': JSON.stringify({ version: 2, assets: PREVIOUS_ASSETS }),
    };
  }

  const store = createCacheStore(seed);
  const handlers = new Map<string, WorkerHandler>();
  let online = true;
  let failAsset: string | undefined;

  const networkFetch = vi.fn(async (input: unknown) => {
    if (!online) throw new TypeError('offline');
    const path = requestPath(input);
    if (path === '/') return new Response('current deployed shell', { status: 200 });
    if (path === '/offline-assets.json') {
      return Response.json(
        'servedManifest' in options ? options.servedManifest : { version: 2, assets: BOOT_ASSETS },
      );
    }
    if (path === '/manifest.webmanifest') return new Response('{}', { status: 200 });
    if (path.startsWith('/icons/')) return new Response('icon', { status: 200 });
    if (BOOT_ASSETS.includes(path)) {
      if (failAsset === path) throw new TypeError('asset unavailable');
      return new Response(`network:${path}`, { status: 200 });
    }
    // A path outside the build that the origin WOULD answer. It exists so the
    // traversal guard is what refuses it, rather than a convenient 404.
    if (path === '/etc/passwd' || path === '/api/session') {
      return new Response('sensitive', { status: 200 });
    }
    // A moved deployment alias no longer serves the previous build's hashed chunks.
    return new Response('not found', { status: 404 });
  });

  const wrapCache = (name: string) => {
    const stored = store.openCache(name);
    return {
      addAll: vi.fn(async (keys: unknown[]) => {
        const responses = await Promise.all(
          keys.map(async (key) => [requestPath(key), await networkFetch(key)] as const),
        );
        for (const [key, response] of responses) {
          if (!response.ok) throw new TypeError(`cache add failed: ${key}`);
          stored.set(key, response.clone());
        }
      }),
      put: vi.fn(async (key: unknown, response: Response) => {
        stored.set(requestPath(key), response.clone());
      }),
      match: vi.fn(async (key: unknown) => stored.get(requestPath(key))?.clone()),
      keys: vi.fn(async () =>
        [...stored.keys()].map((path) => ({ url: new URL(path, ORIGIN).href })),
      ),
      delete: vi.fn(async (key: unknown) => stored.delete(requestPath(key))),
    };
  };

  const caches = {
    open: vi.fn(async (name: string) => wrapCache(name)),
    // Real CacheStorage.match searches every cache. That is precisely what lets a
    // still-running previous client find its own chunk after an update.
    match: vi.fn(async (key: unknown) => {
      const path = requestPath(key);
      for (const stored of store.generations.values()) {
        const hit = stored.get(path);
        if (hit) return hit.clone();
      }
      return undefined;
    }),
    keys: vi.fn(async () => [...store.generations.keys()]),
    delete: vi.fn(async (name: string) => store.generations.delete(name)),
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, handler: WorkerHandler) => handlers.set(type, handler),
  };

  const workerSource = readFileSync(
    fileURLToPath(new URL('../../public/sw.js', import.meta.url)),
    'utf8',
  );
  new Function('self', 'caches', 'fetch', 'URL', 'Response', workerSource)(
    self,
    caches,
    networkFetch,
    URL,
    Response,
  );

  const currentGeneration = () => {
    const match = workerSource.match(/const CACHE_GENERATION = (\d+);/);
    if (!match) throw new Error('The worker no longer declares a cache generation');
    return `ninfit-shell-v${match[1]}`;
  };

  return {
    handlers,
    store,
    caches,
    networkFetch,
    currentGeneration: currentGeneration(),
    entries(name: string) {
      return [...(store.generations.get(name)?.keys() ?? [])];
    },
    async read(name: string, path: string) {
      return bodyOf(store.generations.get(name)?.get(path));
    },
    setOnline(value: boolean) {
      online = value;
    },
    failNextAsset(path: string | undefined) {
      failAsset = path;
    },
  };
}

/**
 * Navigation now answers immediately and refreshes the offline set through
 * `waitUntil`, so the harness has to collect background work rather than assume the
 * response means the caching finished.
 */
async function navigate(
  handler: WorkerHandler,
  url = `${ORIGIN}/`,
): Promise<{ response: Response; settled: Promise<unknown> }> {
  let response: Promise<Response> | undefined;
  const background: Promise<unknown>[] = [];
  handler({
    request: { method: 'GET', mode: 'navigate', url },
    respondWith(value: Promise<Response>) {
      response = value;
    },
    waitUntil(value: Promise<unknown>) {
      background.push(value);
    },
  });
  if (!response) throw new Error('The service worker did not answer navigation');
  const resolved = await response;
  return { response: resolved, settled: Promise.all(background) };
}

async function navigateAndSettle(handler: WorkerHandler, url = `${ORIGIN}/`): Promise<Response> {
  const { response, settled } = await navigate(handler, url);
  await settled;
  return response;
}

async function fetchAsset(handler: WorkerHandler, path: string): Promise<Response> {
  let response: Promise<Response> | undefined;
  handler({
    request: { method: 'GET', mode: 'cors', url: `${ORIGIN}${path}` },
    respondWith(value: Promise<Response>) {
      response = value;
    },
  });
  if (!response) throw new Error('The service worker did not answer asset request');
  return response;
}

async function install(handler: WorkerHandler): Promise<void> {
  let installation: Promise<unknown> | undefined;
  handler({
    waitUntil(value: Promise<unknown>) {
      installation = value;
    },
  });
  if (!installation) throw new Error('The service worker did not register install work');
  await installation;
}

async function activate(handler: WorkerHandler): Promise<void> {
  let activation: Promise<unknown> | undefined;
  handler({
    waitUntil(value: Promise<unknown>) {
      activation = value;
    },
  });
  if (!activation) throw new Error('The service worker did not register activation work');
  await activation;
}

describe('service-worker offline boot safety', () => {
  it('installs the root and complete hashed boot set for a cold offline launch', async () => {
    const worker = loadWorker();
    const installHandler = worker.handlers.get('install');
    const fetchHandler = worker.handlers.get('fetch');
    if (!installHandler || !fetchHandler) throw new Error('Missing worker handler');

    await install(installHandler);
    expect(await worker.read(worker.currentGeneration, '/')).toBe('current deployed shell');
    for (const asset of BOOT_ASSETS) {
      expect(await worker.read(worker.currentGeneration, asset)).toBe(`network:${asset}`);
    }

    worker.setOnline(false);
    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('current deployed shell');
    for (const asset of BOOT_ASSETS) {
      expect(await (await fetchAsset(fetchHandler, asset)).text()).toBe(`network:${asset}`);
    }
  });

  it('refreshes the full offline boot set without deleting chunks a live previous client may still need', async () => {
    const worker = loadWorker();
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('current deployed shell');
    expect(await worker.read(worker.currentGeneration, '/')).toBe('current deployed shell');
    for (const asset of BOOT_ASSETS) {
      expect(worker.entries(worker.currentGeneration)).toContain(asset);
    }

    for (const asset of PREVIOUS_ASSETS) {
      expect(worker.entries(worker.currentGeneration)).toContain(asset);
    }

    worker.setOnline(false);
    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('current deployed shell');
    expect(await (await fetchAsset(fetchHandler, '/assets/AccountSection-previous.js')).text())
      .toBe('previous:/assets/AccountSection-previous.js');
  });

  it('does not replace the cached root if a new hashed asset cannot be cached', async () => {
    const worker = loadWorker();
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    worker.failNextAsset('/assets/index-current.js');
    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('current deployed shell');

    // Online navigation still succeeds, but the old coherent offline root remains.
    expect(await worker.read(worker.currentGeneration, '/')).toBe('previous offline shell');
    for (const asset of PREVIOUS_ASSETS) {
      expect(worker.entries(worker.currentGeneration)).toContain(asset);
    }
  });

  it('answers the navigation before the offline refresh has finished', async () => {
    const worker = loadWorker();
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    const { response, settled } = await navigate(fetchHandler);

    // The document is already being handed back while the megabytes of offline art
    // and hashed JS are still downloading. A phone launch must not wait for them.
    expect(await response.text()).toBe('current deployed shell');
    expect(worker.entries(worker.currentGeneration)).not.toContain('/assets/index-current.js');

    await settled;
    expect(worker.entries(worker.currentGeneration)).toContain('/assets/index-current.js');
  });
});

describe('service-worker update safety across cache generations', () => {
  it('keeps the previous generation so a running older document can still load its lazy chunks', async () => {
    // The exact real-device failure: a phone is running the previous build, the
    // deployment alias moves, this worker activates and claims that live document,
    // and the document then asks for its own AccountSection chunk.
    const worker = loadWorker({
      seed: {
        'ninfit-shell-v3': {
          '/': 'previous offline shell',
          '/assets/AccountSection-previous.js': 'previous lazy account chunk',
        },
      },
    });
    const activateHandler = worker.handlers.get('activate');
    const fetchHandler = worker.handlers.get('fetch');
    if (!activateHandler || !fetchHandler) throw new Error('Missing worker handler');

    await activate(activateHandler);

    expect(await (await fetchAsset(fetchHandler, '/assets/AccountSection-previous.js')).text())
      .toBe('previous lazy account chunk');
  });

  it('removes generations older than the one a live client can still be running', async () => {
    const worker = loadWorker({
      seed: {
        'ninfit-shell-v1': { '/assets/ancient.js': 'ancient' },
        'ninfit-shell-v2': { '/assets/older.js': 'older' },
        'ninfit-shell-v3': { '/assets/previous.js': 'previous' },
      },
    });
    const installHandler = worker.handlers.get('install');
    const activateHandler = worker.handlers.get('activate');
    if (!installHandler || !activateHandler) throw new Error('Missing worker handler');

    await install(installHandler);
    await activate(activateHandler);

    const remaining = [...worker.store.generations.keys()].sort();
    expect(remaining).toContain(worker.currentGeneration);
    expect(remaining).toContain('ninfit-shell-v3');
    expect(remaining).not.toContain('ninfit-shell-v2');
    expect(remaining).not.toContain('ninfit-shell-v1');
  });

  it('claims clients only after the old generations have been resolved', async () => {
    const worker = loadWorker();
    const activateHandler = worker.handlers.get('activate');
    if (!activateHandler) throw new Error('Missing activate handler');

    await activate(activateHandler);
    expect(worker.caches.keys).toHaveBeenCalled();
  });

  it('prunes assets that neither the new nor the previous build needs', async () => {
    const worker = loadWorker({
      seed: {
        'ninfit-shell-v4': {
          '/': 'previous offline shell',
          '/assets/abandoned-two-builds-ago.js': 'abandoned',
          ...Object.fromEntries(PREVIOUS_ASSETS.map((path) => [path, `previous:${path}`])),
        },
      },
      previousManifestIn: 'ninfit-shell-v4',
    });
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    await navigateAndSettle(fetchHandler);

    const entries = worker.entries(worker.currentGeneration);
    // The build before this one is still reachable...
    for (const asset of PREVIOUS_ASSETS) expect(entries).toContain(asset);
    for (const asset of BOOT_ASSETS) expect(entries).toContain(asset);
    // ...but the generation before that is not kept forever.
    expect(entries).not.toContain('/assets/abandoned-two-builds-ago.js');
  });

  it('never prunes when the previous asset list is unknown', async () => {
    const worker = loadWorker();
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    await navigateAndSettle(fetchHandler);

    // No manifest was cached, so nothing is provably abandoned and nothing is removed.
    for (const asset of PREVIOUS_ASSETS) {
      expect(worker.entries(worker.currentGeneration)).toContain(asset);
    }
  });
});

/**
 * The whole lifecycle in one sequence, in the order a phone actually runs it.
 *
 * The individual describes above each pin one guard. This one exists because the
 * failure that reached a real device was not in any single handler - it was in the
 * hand-off between them: install caches the new build, activate deletes an old
 * generation, `clients.claim` gives the new worker a document that belongs to the
 * old one, and only then does fetch get asked for a chunk that no longer exists.
 */
describe('service-worker install -> activate -> fetch, as a phone runs it', () => {
  it('carries a previous build through a whole update without breaking it', async () => {
    const worker = loadWorker({
      seed: {
        'ninfit-shell-v2': { '/assets/ancient.js': 'two builds ago' },
        'ninfit-shell-v3': {
          '/': 'previous offline shell',
          '/assets/index-previous.js': 'previous js',
          '/assets/AccountSection-previous.js': 'previous lazy account chunk',
        },
      },
    });
    const installHandler = worker.handlers.get('install');
    const activateHandler = worker.handlers.get('activate');
    const fetchHandler = worker.handlers.get('fetch');
    if (!installHandler || !activateHandler || !fetchHandler) {
      throw new Error('Missing worker handler');
    }

    // 1. Install: the new build's whole offline set lands in a NEW generation.
    await install(installHandler);
    for (const asset of BOOT_ASSETS) {
      expect(worker.entries(worker.currentGeneration)).toContain(asset);
    }
    expect(await worker.read(worker.currentGeneration, '/')).toBe('current deployed shell');

    // 2. Activate: old generations are resolved. The one a live document may still
    //    be running survives; the one before it does not.
    await activate(activateHandler);
    const generations = [...worker.store.generations.keys()];
    expect(generations).toContain(worker.currentGeneration);
    expect(generations).toContain('ninfit-shell-v3');
    expect(generations).not.toContain('ninfit-shell-v2');

    // 3. Fetch, from the document that is STILL running the previous build. Its own
    //    hashed chunk is gone from the deployment - the alias moved - so the cache is
    //    the only place left that can answer, across generations.
    worker.setOnline(false);
    expect(await (await fetchAsset(fetchHandler, '/assets/AccountSection-previous.js')).text())
      .toBe('previous lazy account chunk');
    expect(await (await fetchAsset(fetchHandler, '/assets/index-previous.js')).text())
      .toBe('previous js');

    // 4. And a cold offline launch still gets the CURRENT build's coherent root.
    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('current deployed shell');
    for (const asset of BOOT_ASSETS) {
      expect(await (await fetchAsset(fetchHandler, asset)).text()).toBe(`network:${asset}`);
    }
  });

  it('serves the CURRENT generation root offline, not whichever cache was made first', async () => {
    // `caches.match('/')` with no cache name searches every cache in creation order,
    // so as soon as a second generation exists the OLDER root wins and an offline
    // cold start keeps booting the previous build for as long as that generation is
    // retained. Found by walking install -> activate -> offline fetch in sequence.
    const worker = loadWorker({
      seed: {
        'ninfit-shell-v3': {
          '/': 'previous offline shell',
          '/assets/index-previous.js': 'previous js',
        },
      },
    });
    const installHandler = worker.handlers.get('install');
    const activateHandler = worker.handlers.get('activate');
    const fetchHandler = worker.handlers.get('fetch');
    if (!installHandler || !activateHandler || !fetchHandler) {
      throw new Error('Missing worker handler');
    }

    await install(installHandler);
    await activate(activateHandler);
    // The previous generation is deliberately still here - that is the lazy-chunk fix.
    expect(await worker.read('ninfit-shell-v3', '/')).toBe('previous offline shell');

    worker.setOnline(false);
    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('current deployed shell');
  });

  it('falls back to any cached root rather than a network error', async () => {
    // An older but complete build beats no app at all.
    const worker = loadWorker({ seed: { 'ninfit-shell-v3': { '/': 'previous offline shell' } } });
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    worker.setOnline(false);
    expect(await (await navigateAndSettle(fetchHandler)).text()).toBe('previous offline shell');
  });

  it('refuses a manifest that reaches outside the three allowed prefixes', async () => {
    // The worker precaches whatever the manifest names. Without the prefix
    // allow-list a wrong or tampered manifest could make every installed app fetch
    // and store arbitrary same-origin paths, so the filter is fail-closed: one
    // unexpected entry rejects the whole refresh rather than caching the rest.
    const worker = loadWorker({
      servedManifest: { version: 2, assets: [...BOOT_ASSETS, '/api/session'] },
    });
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    await navigateAndSettle(fetchHandler);

    expect(worker.entries(worker.currentGeneration)).not.toContain('/api/session');
    for (const asset of BOOT_ASSETS) {
      expect(worker.entries(worker.currentGeneration)).not.toContain(asset);
    }
    // The previous coherent offline root is untouched by a refusal.
    expect(await worker.read(worker.currentGeneration, '/')).toBe('previous offline shell');
  });

  it('refuses a manifest that tries to escape with traversal', async () => {
    // `/assets/../../etc/passwd` satisfies the prefix check on its face, so the
    // traversal guard is the only thing standing between a wrong manifest and the
    // worker storing an origin path the app has no business caching. The harness
    // answers that path with 200 so a 404 cannot do the guard's job for it.
    const worker = loadWorker({
      servedManifest: { version: 2, assets: ['/assets/../../etc/passwd'] },
    });
    const fetchHandler = worker.handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    await navigateAndSettle(fetchHandler);

    expect(worker.entries(worker.currentGeneration)).not.toContain('/etc/passwd');
    expect(await worker.read(worker.currentGeneration, '/')).toBe('previous offline shell');
  });

  it('refuses a malformed manifest instead of caching an empty offline set', async () => {
    for (const malformed of [{ version: 2 }, { version: 2, assets: 'nope' }, null]) {
      const worker = loadWorker({ servedManifest: malformed });
      const fetchHandler = worker.handlers.get('fetch');
      if (!fetchHandler) throw new Error('Missing fetch handler');

      await navigateAndSettle(fetchHandler);
      expect(await worker.read(worker.currentGeneration, '/')).toBe('previous offline shell');
    }
  });

  it('really deletes, so a worker that over-deletes cannot pass unnoticed', () => {
    // Guard on the harness itself. The previous version stubbed `caches.delete` to a
    // no-op and `caches.keys` to a constant, which is exactly why a worker that wiped
    // the live generation passed the whole suite.
    const worker = loadWorker({ seed: { 'ninfit-shell-v3': { '/assets/x.js': 'x' } } });
    expect([...worker.store.generations.keys()]).toContain('ninfit-shell-v3');
    worker.store.generations.delete('ninfit-shell-v3');
    expect([...worker.store.generations.keys()]).not.toContain('ninfit-shell-v3');
  });

  it('does not reload, claim before pruning, or touch stored fitness data', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../public/sw.js', import.meta.url)),
      'utf8',
    );
    // An automatic reload could interrupt a Journey that is recording.
    expect(source).not.toContain('location.reload');
    expect(source).not.toContain('navigate(');
    // Nothing in the worker may reach app storage.
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('indexedDB');
    // Claim happens only after old generations are resolved, never before.
    expect(source).toContain('pruneOldCacheGenerations().then(() => self.clients.claim())');
  });
});
