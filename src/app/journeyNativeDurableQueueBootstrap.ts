import type { NativeJourneyDurablePositionQueue } from './journeyNativeDurableQueue';

export const NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY = '__NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE__' as const;

type NativeDurableQueueHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]?: unknown;
};

function isNativeJourneyDurablePositionQueue(value: unknown): value is NativeJourneyDurablePositionQueue {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NativeJourneyDurablePositionQueue>;
  return typeof candidate.readPending === 'function'
    && typeof candidate.acknowledgeThrough === 'function'
    && typeof candidate.clear === 'function';
}

/**
 * Resolve the process-level durable location queue injected by the installed shell.
 *
 * Browser/PWA builds have no queue and return null. A malformed native object also
 * returns null rather than weakening replay ordering/acknowledgement guarantees.
 */
export function resolveInjectedNativeJourneyDurableQueue(
  host: NativeDurableQueueHost = globalThis as NativeDurableQueueHost,
): NativeJourneyDurablePositionQueue | null {
  const candidate = host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
  return isNativeJourneyDurablePositionQueue(candidate) ? candidate : null;
}
