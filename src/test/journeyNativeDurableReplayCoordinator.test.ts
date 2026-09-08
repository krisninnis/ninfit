import { describe, expect, it, vi } from 'vitest';
import { createNativeJourneyDurableReplayCoordinator } from '../app/journeyNativeDurableReplayCoordinator';
import type { JourneyMotionSession } from '../app/journeyMotionSession';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';

function session(): JourneyMotionSession {
  return {
    getJourney: vi.fn(),
    getMotionState: vi.fn(),
    processSample: vi.fn(),
    stop: vi.fn(),
  } as JourneyMotionSession;
}

describe('native Journey durable replay coordinator', () => {
  it('shares an in-flight reconciliation and allows a later fresh drain', async () => {
    let releaseFirst: (() => void) | null = null;
    const readPending = vi.fn(async () => {
      if (readPending.mock.calls.length === 1) {
        await new Promise<void>((resolve) => { releaseFirst = resolve; });
      }
      return [];
    });
    const queue: NativeJourneyDurablePositionQueue = {
      readPending,
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-1',
      queue,
      session: session(),
    });

    const first = coordinator.reconcile();
    const overlapping = coordinator.reconcile();
    expect(overlapping).toBe(first);
    expect(readPending).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    await first;

    await coordinator.reconcile();
    expect(readPending).toHaveBeenCalledTimes(2);
  });
});
