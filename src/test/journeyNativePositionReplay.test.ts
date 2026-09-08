import { describe, expect, it } from 'vitest';
import {
  createNativeJourneyPositionBuffer,
  type NativeJourneyPositionBufferSnapshot,
  type NativeJourneyPositionBufferStore,
} from '../app/journeyNativePositionBuffer';
import { replayNativeJourneyPositions } from '../app/journeyNativePositionReplay';

function memoryStore(seed?: NativeJourneyPositionBufferSnapshot): NativeJourneyPositionBufferStore & {
  snapshot: NativeJourneyPositionBufferSnapshot | null;
} {
  return {
    snapshot: seed ?? null,
    load(journeyId) {
      return this.snapshot?.journeyId === journeyId ? structuredClone(this.snapshot) : null;
    },
    save(snapshot) {
      this.snapshot = structuredClone(snapshot);
    },
    remove(journeyId) {
      if (this.snapshot?.journeyId === journeyId) this.snapshot = null;
    },
  };
}

const positions = [
  { latitude: 51.5, longitude: -3.58, accuracyM: 4, timestampMs: 1_000 },
  { latitude: 51.5001, longitude: -3.5801, accuracyM: 5, timestampMs: 2_000 },
  { latitude: 51.5002, longitude: -3.5802, accuracyM: 5, timestampMs: 3_000 },
];

describe('native Journey position replay', () => {
  it('replays in sequence order and acknowledges the entire successful prefix', () => {
    const store = memoryStore();
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    positions.forEach((position) => buffer.append(position));
    const seen: number[] = [];

    const result = replayNativeJourneyPositions({
      buffer,
      processor: {
        process(position) {
          seen.push(position.timestampMs);
        },
      },
    });

    expect(seen).toEqual([1_000, 2_000, 3_000]);
    expect(result).toEqual({
      processed: 3,
      lastAcknowledgedSequence: 3,
      stoppedAtSequence: null,
    });
    expect(buffer.pending()).toEqual([]);
    expect(store.snapshot).toBeNull();
  });

  it('stops at the first processing failure without acknowledging the failed or later fixes', () => {
    const store = memoryStore();
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    positions.forEach((position) => buffer.append(position));

    const result = replayNativeJourneyPositions({
      buffer,
      processor: {
        process(position) {
          if (position.timestampMs === 2_000) throw new Error('runtime unavailable');
        },
      },
    });

    expect(result).toEqual({
      processed: 1,
      lastAcknowledgedSequence: 1,
      stoppedAtSequence: 2,
    });
    expect(buffer.pending().map((position) => position.sequence)).toEqual([2, 3]);
  });

  it('can retry the preserved suffix after a restart', () => {
    const store = memoryStore();
    let buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    positions.forEach((position) => buffer.append(position));

    replayNativeJourneyPositions({
      buffer,
      processor: {
        process(position) {
          if (position.timestampMs === 2_000) throw new Error('first pass failed');
        },
      },
    });

    buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    const seen: number[] = [];
    const result = replayNativeJourneyPositions({
      buffer,
      processor: {
        process(position) {
          seen.push(position.timestampMs);
        },
      },
    });

    expect(seen).toEqual([2_000, 3_000]);
    expect(result.processed).toBe(2);
    expect(buffer.pending()).toEqual([]);
  });

  it('acknowledges a fix even when the trusted runtime processes it as rejected', () => {
    const store = memoryStore();
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    buffer.append(positions[0]!);

    const result = replayNativeJourneyPositions({
      buffer,
      processor: {
        process() {
          // The real Journey runtime may reject a processed GPS sample for accuracy,
          // speed, continuity or another trust rule. That is still successful transport.
        },
      },
    });

    expect(result.processed).toBe(1);
    expect(buffer.pending()).toEqual([]);
  });
});
