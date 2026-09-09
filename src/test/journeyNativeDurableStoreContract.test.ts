import { describe, expect, it } from 'vitest';
import {
  acknowledgeNativeJourneyDurableThrough,
  appendNativeJourneyDurablePosition,
  createEmptyNativeJourneyDurableStoreEnvelope,
  parseNativeJourneyDurableStoreEnvelope,
} from '../app/journeyNativeDurableStoreContract';

const fix = {
  latitude: 51.5074,
  longitude: -3.5792,
  accuracyM: 5,
  timestampMs: Date.parse('2026-09-08T17:40:00.000Z'),
};

describe('native Journey durable store contract', () => {
  it('persists a monotonic sequence even after every pending fix is acknowledged', () => {
    const empty = createEmptyNativeJourneyDurableStoreEnvelope('journey-1');
    const first = appendNativeJourneyDurablePosition(empty, fix);
    expect(first.positions[0]?.sequence).toBe(1);
    expect(first.nextSequence).toBe(2);

    const acknowledged = acknowledgeNativeJourneyDurableThrough(first, 1);
    expect(acknowledged.positions).toEqual([]);
    expect(acknowledged.nextSequence).toBe(2);

    const second = appendNativeJourneyDurablePosition(acknowledged, {
      ...fix,
      timestampMs: fix.timestampMs + 1_000,
    });
    expect(second.positions[0]?.sequence).toBe(2);
    expect(second.nextSequence).toBe(3);
  });

  it('fails closed on wrong Journey identity, unsupported version and sequence gaps', () => {
    const envelope = appendNativeJourneyDurablePosition(
      createEmptyNativeJourneyDurableStoreEnvelope('journey-1'),
      fix,
    );

    expect(parseNativeJourneyDurableStoreEnvelope(envelope, 'journey-2')).toBeNull();
    expect(parseNativeJourneyDurableStoreEnvelope({ ...envelope, version: 2 })).toBeNull();
    expect(parseNativeJourneyDurableStoreEnvelope({
      ...envelope,
      nextSequence: 4,
      positions: [
        envelope.positions[0],
        { ...envelope.positions[0], sequence: 3, timestampMs: fix.timestampMs + 2_000 },
      ],
    })).toBeNull();
  });

  it('rejects malformed GPS fields and a nextSequence that can reuse issued ids', () => {
    const envelope = appendNativeJourneyDurablePosition(
      createEmptyNativeJourneyDurableStoreEnvelope('journey-1'),
      fix,
    );

    expect(parseNativeJourneyDurableStoreEnvelope({
      ...envelope,
      positions: [{ ...envelope.positions[0], accuracyM: -1 }],
    })).toBeNull();
    expect(parseNativeJourneyDurableStoreEnvelope({ ...envelope, nextSequence: 1 })).toBeNull();
  });

  it('acknowledges only the durable prefix and leaves later fixes ordered', () => {
    let envelope = createEmptyNativeJourneyDurableStoreEnvelope('journey-1');
    for (let index = 0; index < 3; index += 1) {
      envelope = appendNativeJourneyDurablePosition(envelope, {
        ...fix,
        timestampMs: fix.timestampMs + index * 1_000,
      });
    }

    const acknowledged = acknowledgeNativeJourneyDurableThrough(envelope, 2);
    expect(acknowledged.positions.map((position) => position.sequence)).toEqual([3]);
    expect(acknowledged.nextSequence).toBe(4);
  });
});
