import { describe, expect, it, vi } from 'vitest';
import {
  appendNativeJourneyDurablePosition,
  createEmptyNativeJourneyDurableStoreEnvelope,
  type NativeJourneyDurableStoreEnvelopeV1,
} from '../app/journeyNativeDurableStoreContract';
import {
  createNativeJourneyDurableStoreQueue,
  type NativeJourneyDurableEnvelopeStore,
} from '../app/journeyNativeDurableStoreQueue';

const fix = {
  latitude: 51.5074,
  longitude: -3.5792,
  accuracyM: 5,
  timestampMs: Date.parse('2026-09-08T17:45:00.000Z'),
};

function memoryStore(initial: NativeJourneyDurableStoreEnvelopeV1 | null = null) {
  let value: NativeJourneyDurableStoreEnvelopeV1 | null = initial;
  const store: NativeJourneyDurableEnvelopeStore = {
    load: vi.fn(async () => value),
    save: vi.fn(async (next) => { value = next; }),
    remove: vi.fn(async () => { value = null; }),
  };
  return { store, current: () => value };
}

describe('native Journey durable store queue adapter', () => {
  it('exposes pending fixes and preserves nextSequence after acknowledging all of them', async () => {
    const initial = appendNativeJourneyDurablePosition(
      createEmptyNativeJourneyDurableStoreEnvelope('journey-1'),
      fix,
    );
    const memory = memoryStore(initial);
    const queue = createNativeJourneyDurableStoreQueue(memory.store);

    expect((await queue.readPending('journey-1')).map((position) => position.sequence)).toEqual([1]);
    await queue.acknowledgeThrough('journey-1', 1);

    expect(memory.current()?.positions).toEqual([]);
    expect(memory.current()?.nextSequence).toBe(2);
  });

  it('treats missing storage as an empty queue but fails closed on malformed existing storage', async () => {
    const missing = memoryStore(null);
    const missingQueue = createNativeJourneyDurableStoreQueue(missing.store);
    await expect(missingQueue.readPending('journey-1')).resolves.toEqual([]);

    const malformedStore: NativeJourneyDurableEnvelopeStore = {
      load: vi.fn(async () => ({ version: 1, journeyId: 'journey-1', nextSequence: 1, positions: [{ nope: true }] })),
      save: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const malformedQueue = createNativeJourneyDurableStoreQueue(malformedStore);
    await expect(malformedQueue.readPending('journey-1')).rejects.toThrow('Malformed native Journey durable store');
    await expect(malformedQueue.acknowledgeThrough('journey-1', 1)).rejects.toThrow('Malformed native Journey durable store');
  });

  it('uses terminal clear to remove the Journey-scoped native store', async () => {
    const initial = appendNativeJourneyDurablePosition(
      createEmptyNativeJourneyDurableStoreEnvelope('journey-1'),
      fix,
    );
    const memory = memoryStore(initial);
    const queue = createNativeJourneyDurableStoreQueue(memory.store);

    await queue.clear('journey-1');
    expect(memory.store.remove).toHaveBeenCalledWith('journey-1');
    expect(memory.current()).toBeNull();
  });
});
