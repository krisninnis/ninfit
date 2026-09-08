import { describe, expect, it, vi } from 'vitest';
import {
  NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY,
  resolveInjectedNativeJourneyDurableQueue,
} from '../app/journeyNativeDurableQueueBootstrap';

describe('native Journey durable queue bootstrap', () => {
  it('returns null for browser/PWA and malformed injected values', () => {
    expect(resolveInjectedNativeJourneyDurableQueue({} as typeof globalThis)).toBeNull();
    expect(resolveInjectedNativeJourneyDurableQueue({
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: { readPending: vi.fn() },
    } as unknown as typeof globalThis)).toBeNull();
  });

  it('exposes only a complete native durable queue contract', async () => {
    const queue = {
      readPending: vi.fn(async () => []),
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    const resolved = resolveInjectedNativeJourneyDurableQueue({
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: queue,
    } as unknown as typeof globalThis);

    expect(resolved).toBe(queue);
    await resolved!.readPending('journey-1');
    expect(queue.readPending).toHaveBeenCalledWith('journey-1');
  });
});
