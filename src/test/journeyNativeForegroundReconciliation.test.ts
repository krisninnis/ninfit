import { describe, expect, it, vi } from 'vitest';
import { createNativeJourneyForegroundReconciliation } from '../app/journeyNativeForegroundReconciliation';
import type { JourneyMotionSession } from '../app/journeyMotionSession';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';

function motionSession(processSample = vi.fn()): JourneyMotionSession {
  return {
    getJourney: vi.fn(),
    getMotionState: vi.fn(),
    processSample,
    stopProvider: vi.fn(),
    stop: vi.fn(),
  } as JourneyMotionSession;
}

describe('native Journey foreground reconciliation', () => {
  it('does not drain while backgrounding and drains when foregrounded', async () => {
    const readPending = vi.fn(async () => []);
    const queue: NativeJourneyDurablePositionQueue = {
      readPending,
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    const reconciliation = createNativeJourneyForegroundReconciliation({
      journeyId: 'journey-1',
      queue,
      session: motionSession(),
    });

    reconciliation.onLifecycleState('backgrounded');
    await Promise.resolve();
    expect(readPending).not.toHaveBeenCalled();

    reconciliation.onLifecycleState('foregrounded');
    await vi.waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
  });

  it('routes durable foreground fixes through the Journey motion session before acknowledgement', async () => {
    const calls: string[] = [];
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        return [{
          sequence: 1,
          latitude: 51.5,
          longitude: -3.58,
          accuracyM: 5,
          timestampMs: Date.parse('2026-09-08T12:00:01.000Z'),
        }];
      },
      async acknowledgeThrough(_journeyId, sequence) {
        calls.push(`ack:${sequence}`);
      },
      clear: vi.fn(async () => undefined),
    };
    const session = motionSession(vi.fn((sample) => calls.push(`process:${sample.recordedAt}`)));
    const reconciliation = createNativeJourneyForegroundReconciliation({
      journeyId: 'journey-1',
      queue,
      session,
    });

    const result = await reconciliation.reconcileNow();

    expect(calls).toEqual(['process:2026-09-08T12:00:01.000Z', 'ack:1']);
    expect(result.processed).toBe(1);
    expect(result.stopReason).toBeNull();
  });

  it('coalesces overlapping startup and foreground drains', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const readPending = vi.fn(async () => {
      await gate;
      return [];
    });
    const queue: NativeJourneyDurablePositionQueue = {
      readPending,
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    const reconciliation = createNativeJourneyForegroundReconciliation({
      journeyId: 'journey-1',
      queue,
      session: motionSession(),
    });

    const startup = reconciliation.reconcileNow();
    reconciliation.onLifecycleState('foregrounded');
    expect(readPending).toHaveBeenCalledTimes(1);

    release();
    await startup;
  });
});
