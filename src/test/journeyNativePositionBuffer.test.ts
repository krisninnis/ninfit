import { describe, expect, it } from 'vitest';
import {
  createNativeJourneyPositionBuffer,
  type NativeJourneyPositionBufferSnapshot,
  type NativeJourneyPositionBufferStore,
} from '../app/journeyNativePositionBuffer';

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

const first = { latitude: 51.5, longitude: -3.58, accuracyM: 4, timestampMs: 1_000 };
const second = { latitude: 51.5001, longitude: -3.5801, accuracyM: 5, timestampMs: 2_000 };

describe('native Journey position buffer', () => {
  it('persists fixes before acknowledgement and restores them after a restart', () => {
    const store = memoryStore();
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });

    expect(buffer.append(first).sequence).toBe(1);
    expect(buffer.append(second).sequence).toBe(2);

    const restored = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    expect(restored.pending().map((position) => position.sequence)).toEqual([1, 2]);
  });

  it('acknowledges only the processed prefix so later fixes survive', () => {
    const store = memoryStore();
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    buffer.append(first);
    buffer.append(second);

    buffer.acknowledgeThrough(1);

    expect(buffer.pending()).toEqual([{ ...second, sequence: 2 }]);
    expect(store.snapshot?.positions).toEqual([{ ...second, sequence: 2 }]);
  });

  it('continues sequence numbers after restoring a partially acknowledged queue', () => {
    const store = memoryStore({
      journeyId: 'journey-1',
      positions: [{ ...second, sequence: 7 }],
    });
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });

    expect(buffer.append({ ...second, timestampMs: 3_000 }).sequence).toBe(8);
  });

  it('fails closed on invalid positions and ignores malformed restored entries', () => {
    const store = memoryStore({
      journeyId: 'journey-1',
      positions: [
        { ...first, sequence: 2 },
        { ...first, latitude: 999, sequence: 3 },
      ],
    });
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });

    expect(buffer.pending()).toEqual([{ ...first, sequence: 2 }]);
    expect(() => buffer.append({ ...first, accuracyM: -1 })).toThrow(/invalid native Journey position/i);
  });

  it('does not leak buffered fixes between Journey ids', () => {
    const store = memoryStore({ journeyId: 'journey-old', positions: [{ ...first, sequence: 1 }] });
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-new', store });

    expect(buffer.pending()).toEqual([]);
    expect(buffer.append(second).sequence).toBe(1);
    expect(store.snapshot?.journeyId).toBe('journey-new');
  });

  it('clears durable state after successful completion cleanup', () => {
    const store = memoryStore();
    const buffer = createNativeJourneyPositionBuffer({ journeyId: 'journey-1', store });
    buffer.append(first);

    buffer.clear();

    expect(buffer.pending()).toEqual([]);
    expect(store.snapshot).toBeNull();
  });
});
