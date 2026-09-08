import { describe, expect, it, vi } from 'vitest';
import {
  replayNativeJourneyDurableQueue,
  type NativeJourneyDurablePositionQueue,
} from '../app/journeyNativeDurableQueue';
import type { NativeJourneyBufferedPosition } from '../app/journeyNativePositionBuffer';

function point(sequence: number, timestampMs = sequence * 1_000): NativeJourneyBufferedPosition {
  return {
    sequence,
    latitude: 51.5 + sequence * 0.00001,
    longitude: -3.58,
    accuracyM: 5,
    timestampMs,
  };
}

function queue(positions: NativeJourneyBufferedPosition[]) {
  let pending = positions.map((position) => ({ ...position }));
  const acknowledgeThrough = vi.fn(async (_journeyId: string, sequence: number) => {
    pending = pending.filter((position) => position.sequence > sequence);
  });
  const clear = vi.fn(async () => { pending = []; });
  const readPending = vi.fn(async () => pending.map((position) => ({ ...position })));
  const bridge: NativeJourneyDurablePositionQueue = { readPending, acknowledgeThrough, clear };
  return { bridge, acknowledgeThrough, clear, pending: () => pending };
}

describe('native process durable Journey queue replay', () => {
  it('processes and acknowledges a contiguous pending suffix in order', async () => {
    const source = queue([point(8), point(7)]);
    const process = vi.fn();

    const result = await replayNativeJourneyDurableQueue({
      journeyId: 'journey-1',
      queue: source.bridge,
      processor: { process },
    });

    expect(process.mock.calls.map(([position]) => position.timestampMs)).toEqual([7_000, 8_000]);
    expect(source.acknowledgeThrough.mock.calls.map(([, sequence]) => sequence)).toEqual([7, 8]);
    expect(source.pending()).toEqual([]);
    expect(result).toEqual({
      processed: 2,
      lastAcknowledgedSequence: 8,
      stoppedAtSequence: null,
      stopReason: null,
    });
  });

  it('stops at a sequence gap instead of silently skipping missing native evidence', async () => {
    const source = queue([point(4), point(6)]);
    const process = vi.fn();

    const result = await replayNativeJourneyDurableQueue({
      journeyId: 'journey-1', queue: source.bridge, processor: { process },
    });

    expect(process).toHaveBeenCalledTimes(1);
    expect(source.pending()).toEqual([point(6)]);
    expect(result.stopReason).toBe('sequence_gap');
    expect(result.stoppedAtSequence).toBe(6);
  });

  it('keeps a processor failure and later fixes pending for retry', async () => {
    const source = queue([point(1), point(2), point(3)]);
    const process = vi.fn((position) => {
      if (position.timestampMs === 2_000) throw new Error('runtime interrupted');
    });

    const result = await replayNativeJourneyDurableQueue({
      journeyId: 'journey-1', queue: source.bridge, processor: { process },
    });

    expect(source.pending().map((position) => position.sequence)).toEqual([2, 3]);
    expect(result).toEqual({
      processed: 1,
      lastAcknowledgedSequence: 1,
      stoppedAtSequence: 2,
      stopReason: 'processor_error',
    });
  });

  it('reports acknowledgement failure without pretending the processed fix is durable-acked', async () => {
    const source = queue([point(1)]);
    source.acknowledgeThrough.mockRejectedValueOnce(new Error('native store busy'));

    const result = await replayNativeJourneyDurableQueue({
      journeyId: 'journey-1', queue: source.bridge, processor: { process: vi.fn() },
    });

    expect(source.pending()).toEqual([point(1)]);
    expect(result).toEqual({
      processed: 0,
      lastAcknowledgedSequence: null,
      stoppedAtSequence: 1,
      stopReason: 'acknowledgement_error',
    });
  });

  it('fails closed on malformed native positions without acknowledging them', async () => {
    const invalid = { ...point(1), latitude: 999 };
    const source = queue([invalid]);

    const result = await replayNativeJourneyDurableQueue({
      journeyId: 'journey-1', queue: source.bridge, processor: { process: vi.fn() },
    });

    expect(source.acknowledgeThrough).not.toHaveBeenCalled();
    expect(result.stopReason).toBe('invalid_position');
  });

  it('contains a native queue read failure', async () => {
    const source = queue([]);
    source.bridge.readPending = vi.fn(async () => { throw new Error('native unavailable'); });

    await expect(replayNativeJourneyDurableQueue({
      journeyId: 'journey-1', queue: source.bridge, processor: { process: vi.fn() },
    })).resolves.toEqual({
      processed: 0,
      lastAcknowledgedSequence: null,
      stoppedAtSequence: null,
      stopReason: 'queue_read_error',
    });
  });
});
