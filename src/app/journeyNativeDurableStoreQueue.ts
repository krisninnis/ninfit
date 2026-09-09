import type { NativeJourneyDurablePositionQueue } from './journeyNativeDurableQueue';
import {
  acknowledgeNativeJourneyDurableThrough,
  parseNativeJourneyDurableStoreEnvelope,
  type NativeJourneyDurableStoreEnvelopeV1,
} from './journeyNativeDurableStoreContract';

export interface NativeJourneyDurableEnvelopeStore {
  load(journeyId: string): Promise<unknown | null>;
  save(envelope: NativeJourneyDurableStoreEnvelopeV1): Promise<void>;
  remove(journeyId: string): Promise<void>;
}

/**
 * Adapter used by a concrete native shell to expose its crash-safe local store through
 * NinFit's existing durable queue bridge.
 *
 * An empty/missing store means no pending suffix. A malformed existing envelope is an
 * error, not an empty queue, so corruption can never be mistaken for successful replay.
 */
export function createNativeJourneyDurableStoreQueue(
  store: NativeJourneyDurableEnvelopeStore,
): NativeJourneyDurablePositionQueue {
  return {
    async readPending(journeyId) {
      const raw = await store.load(journeyId);
      if (raw === null) return [];
      const envelope = parseNativeJourneyDurableStoreEnvelope(raw, journeyId);
      if (envelope === null) throw new Error('Malformed native Journey durable store');
      return envelope.positions.map((position) => ({ ...position }));
    },

    async acknowledgeThrough(journeyId, sequence) {
      const raw = await store.load(journeyId);
      if (raw === null) return;
      const envelope = parseNativeJourneyDurableStoreEnvelope(raw, journeyId);
      if (envelope === null) throw new Error('Malformed native Journey durable store');
      const next = acknowledgeNativeJourneyDurableThrough(envelope, sequence);
      // Save even when positions becomes empty. The monotonic nextSequence cursor is
      // part of crash/restart correctness and must survive until terminal clear().
      await store.save(next);
    },

    async clear(journeyId) {
      await store.remove(journeyId);
    },
  };
}
