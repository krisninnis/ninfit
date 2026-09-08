import { describe, expect, it, vi } from 'vitest';
import { reconcileNativeJourneyDurablePositions } from '../app/journeyNativeDurableReconciliation';
import type { JourneyMotionSession } from '../app/journeyMotionSession';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';

describe('native durable Journey reconciliation', () => {
  it('routes native pending fixes through JourneyMotionSession.processSample before acknowledgement', async () => {
    const calls: string[] = [];
    const session = {
      getJourney: vi.fn(),
      getMotionState: vi.fn(),
      stop: vi.fn(),
      processSample(sample) {
        calls.push(`process:${sample.recordedAt}`);
      },
    } as JourneyMotionSession;
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        return [{
          sequence: 4,
          latitude: 51.5,
          longitude: -3.58,
          accuracyM: 5,
          timestampMs: 1_788_000_000_000,
        }];
      },
      async acknowledgeThrough(_journeyId, sequence) {
        calls.push(`ack:${sequence}`);
      },
      async clear() {},
    };

    const result = await reconcileNativeJourneyDurablePositions({
      journeyId: 'journey-1',
      queue,
      session,
    });

    expect(calls).toEqual(['process:2026-08-30T02:40:00.000Z', 'ack:4']);
    expect(result.processed).toBe(1);
    expect(result.stopReason).toBeNull();
  });
});
