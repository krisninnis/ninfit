import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

type WorkerHandler = (event: Record<string, unknown>) => void;

function loadWorker(fetchResponse: () => Promise<Response>) {
  const handlers = new Map<string, WorkerHandler>();
  const stored = new Map<string, Response>([
    ['/', new Response('original offline shell', { status: 200 })],
  ]);

  const cache = {
    addAll: vi.fn(async () => undefined),
    put: vi.fn(async (key: string, response: Response) => {
      stored.set(key, response);
    }),
  };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async (key: string) => stored.get(key)?.clone()),
    keys: vi.fn(async () => ['ninfit-shell-v1']),
    delete: vi.fn(async () => true),
  };
  const self = {
    location: { origin: 'https://ninfit.test' },
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
    fetchResponse,
    URL,
    Response,
  );

  return { handlers, stored, cache };
}

async function navigate(
  handler: WorkerHandler,
  url = 'https://ninfit.test/',
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

describe('service-worker update safety', () => {
  it('refreshes the offline shell after a successful online launch', async () => {
    let online = true;
    const { handlers, stored, cache } = loadWorker(async () => {
      if (!online) throw new TypeError('offline');
      return new Response('current deployed shell', { status: 200 });
    });
    const fetchHandler = handlers.get('fetch');
    if (!fetchHandler) throw new Error('Missing fetch handler');

    expect(await (await navigate(fetchHandler)).text()).toBe('current deployed shell');
    expect(cache.put).toHaveBeenCalledWith('/', expect.any(Response));

    online = false;
    expect(await (await navigate(fetchHandler)).text()).toBe('current deployed shell');
    expect(await stored.get('/')?.text()).toBe('current deployed shell');
  });
});
