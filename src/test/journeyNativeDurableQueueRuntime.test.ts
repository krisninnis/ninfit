import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';
import {
  getRuntimeNativeJourneyDurableQueue,
  installInjectedNativeJourneyDurableQueue,
  NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY,
  resetNativeJourneyDurableQueueRuntimeForTests,
} from '../app/journeyNativeDurableQueueRuntime';

function queue(): NativeJourneyDurablePositionQueue {
  return {
    readPending: vi.fn(async () => []),
    acknowledgeThrough: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

afterEach(() => resetNativeJourneyDurableQueueRuntimeForTests());

describe('native Journey durable queue runtime', () => {
  it('fails closed to no native queue in browser/PWA mode', () => {
    const host = {} as typeof globalThis;
    const dispose = installInjectedNativeJourneyDurableQueue(host);
    expect(getRuntimeNativeJourneyDurableQueue()).toBeNull();
    dispose();
  });

  it('installs a valid injected native queue and disposes it idempotently', () => {
    const nativeQueue = queue();
    const host = {
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: nativeQueue,
    } as unknown as typeof globalThis;

    const dispose = installInjectedNativeJourneyDurableQueue(host);
    expect(getRuntimeNativeJourneyDurableQueue()).toBe(nativeQueue);
    dispose();
    dispose();
    expect(getRuntimeNativeJourneyDurableQueue()).toBeNull();
  });

  it('rejects malformed injected queues', () => {
    const host = {
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: { readPending: vi.fn() },
    } as unknown as typeof globalThis;

    installInjectedNativeJourneyDurableQueue(host);
    expect(getRuntimeNativeJourneyDurableQueue()).toBeNull();
  });

  it('prevents an older disposer from removing a newer native queue', () => {
    const first = queue();
    const second = queue();
    const firstDispose = installInjectedNativeJourneyDurableQueue({
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: first,
    } as unknown as typeof globalThis);
    installInjectedNativeJourneyDurableQueue({
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: second,
    } as unknown as typeof globalThis);

    firstDispose();
    expect(getRuntimeNativeJourneyDurableQueue()).toBe(second);
  });
});
