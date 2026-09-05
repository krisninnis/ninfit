import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

type WorkerHandler = (event: Record<string, unknown>) => void;

const ORIGIN = 'https://ninfit.test';
const BOOT_ASSETS = ['/assets/index-current.js', '/assets/index-current.css'];

function requestPath(input: unknown): string {
  if (typeof input === 'string') return new URL(input, ORIGIN).pathname;
  if (input !== null && typeof input === 'object' && 'url' in input) {
    return new URL(String((input as { url: unknown }).url), ORIGIN).pathname;
  }
  throw new Error('Unsupported request');
}

function loadWorker() {
  const handlers = new Map<string, WorkerHandler>();
  const stored = new Map<string, Response>([
    ['/', new Response('previous offline shell', { status: 200 })],
    ['/assets/index-previous.js', new Response('previous js', { status: 200 })],
  ]);
  let online = true;
  let failAsset: string | undefined;

  const networkFetch = vi.fn(async (input: unknown) => {
    if (!online) throw new TypeError('offline');
    const path = requestPath(input);
    if (path === '/') return new Response('current deployed shell', { status: 200 });
    if (path === '/offline-assets.json') {
      return Response.json({ version: 1, assets: BOOT_ASSETS });
    }
    if (path === '/manifest.webmanifest') return new Response('{}', { status: 200 });
    if (path.startsWith('/icons/')) return new Response('icon', { status: 200 });
    if (BOOT_ASSETS.includes(path)) {
      if (failAsset === path) throw new TypeError('asset unavailable');
      return new Response(`network:${path}`, { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });

  const normalizeKey = (key: unknown) => requestPath(key);
  const cache = {
    addAll: vi.fn(async (keys: unknown[]) => {
      const responses = await Promise.all(
        keys.map(async (key) => [normalizeKey(key), await networkFetch(key)] as const),
      );
      for (const [key, response] of responses) {
        if (!response.ok) throw new TypeError(`cache add failed: ${key}`);
        stored.set(key, response.clone());
      }
    }),
    put: vi.fn(async (key: unknown, response: Response) => {
      stored.set(normalizeKey(key), response.clone());
    }),
    keys: vi.fn(async () =>
      [...stored.keys()].map((path) => ({ url: new URL(path, ORIGIN).href })),
    ),
    delete: vi.fn(async (key: unknown) => stored.delete(normalizeKey(key))),
  };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async (key: unknown) => stored.get(normalizeKey(key))?.clone()),
    keys: vi.fn(async () => ['ninfit-shell-v2']),
    delete: vi.fn(async () => true),
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

  return {
    handlers,
    stored,
    cache,
    networkFetch,
    setOnline(value: boolean) {
      online = value;
    },
    failNextAsset(path: string | undefined) {
      failAsset = path;
    },
  };
}

async function navigate(
  handler: WorkerHandler,
  url = `${ORIGIN}/`,
): Promise<Response> {
  let response: Promise<Response> | undefined;
  handler({
    request: { method: 'GET', mode: 'navigate', url },
    respondWith(value: Promise<Response>) {
      response = value;
    },
  });
  if (!response) throw new Error('The service worker did not answer navigation');
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

describe('service-worker offline boot safety', () => {
  it('installs the root and complete hashed boot set for a cold offline launch', async () => {
    const { handlers, stored, setOnline } = loadWorker();
    const installHandler = handlers.get('install');
    const fetchHandler = handlers.get('fetch');
    if (!installHandler || !fetchHandler) throw new Error('Missing worker handler');

    await install(installHandler);
    expect(await stored.get('/')?.text()).toBe('current deployed shell');
    for (const asset of BOOT_ASSETS) {
      expect(await stored.get(asset)?.text()).toBe(`network:${asset}`);
    }

    setOnline(false);
    expect(await (await navigate(fetchHandler)).text()).toBe('current deployed shell');
    for (const asset of BOOT_ASSETS) {
      expect(await (await fetchAsset(fetchHandler, asset)).text()).toBe(`network:${asset}`);
    }
  });

  it('refreshes the full offline boot set after a successful online launch', async () => {
    const { handlers, stored, setOnline } = loadWorker();
    const fetchHandler = handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    expect(await (await navigate(fetchHandler)).text()).toBe('current deployed shell');
    expect(await stored.get('/')?.text()).toBe('current deployed shell');
    expect(stored.has('/assets/index-previous.js')).toBe(false);
    for (const asset of BOOT_ASSETS) expect(stored.has(asset)).toBe(true);

    setOnline(false);
    expect(await (await navigate(fetchHandler)).text()).toBe('current deployed shell');
  });

  it('does not replace the cached root if a new hashed asset cannot be cached', async () => {
    const { handlers, stored, failNextAsset } = loadWorker();
    const fetchHandler = handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    failNextAsset('/assets/index-current.js');
    expect(await (await navigate(fetchHandler)).text()).toBe('current deployed shell');

    // Online navigation still succeeds, but the old coherent offline root remains.
    expect(await stored.get('/')?.text()).toBe('previous offline shell');
    expect(stored.has('/assets/index-previous.js')).toBe(true);
  });
});
