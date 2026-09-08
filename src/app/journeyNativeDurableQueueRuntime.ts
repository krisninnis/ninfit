import type { NativeJourneyDurablePositionQueue } from './journeyNativeDurableQueue';

export const NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY = '__NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE__' as const;

type NativeQueueHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]?: unknown;
};

let installedQueue: NativeJourneyDurablePositionQueue | null = null;

function isNativeJourneyDurablePositionQueue(value: unknown): value is NativeJourneyDurablePositionQueue {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NativeJourneyDurablePositionQueue>;
  return typeof candidate.readPending === 'function'
    && typeof candidate.acknowledgeThrough === 'function'
    && typeof candidate.clear === 'function';
}

/**
 * Install the process-level native queue supplied by the Capacitor shell.
 * Browser/PWA builds have no injected queue and safely resolve to null.
 */
export function installInjectedNativeJourneyDurableQueue(
  host: NativeQueueHost = globalThis as NativeQueueHost,
): () => void {
  const candidate = host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
  if (!isNativeJourneyDurablePositionQueue(candidate)) return () => undefined;

  installedQueue = candidate;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (installedQueue === candidate) installedQueue = null;
  };
}

export function getRuntimeNativeJourneyDurableQueue(): NativeJourneyDurablePositionQueue | null {
  return installedQueue;
}

/** Test-only reset to prevent queue registration leaking between suites. */
export function resetNativeJourneyDurableQueueRuntimeForTests(): void {
  installedQueue = null;
}
