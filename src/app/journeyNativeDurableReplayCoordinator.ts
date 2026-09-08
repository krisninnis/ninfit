import type { JourneyMotionSession } from './journeyMotionSession';
import {
  reconcileNativeJourneyDurablePositions,
} from './journeyNativeDurableReconciliation';
import type {
  NativeJourneyDurablePositionQueue,
  NativeJourneyDurableReplayResult,
} from './journeyNativeDurableQueue';

export interface NativeJourneyDurableReplayCoordinator {
  reconcile(): Promise<NativeJourneyDurableReplayResult>;
}

/**
 * Prevent overlapping native queue drains when app startup and a foreground lifecycle
 * event occur close together. At most one reconciliation may own the durable prefix at
 * a time; concurrent callers share the same result.
 */
export function createNativeJourneyDurableReplayCoordinator(options: {
  journeyId: string;
  queue: NativeJourneyDurablePositionQueue;
  session: JourneyMotionSession;
}): NativeJourneyDurableReplayCoordinator {
  let inFlight: Promise<NativeJourneyDurableReplayResult> | null = null;

  return {
    reconcile() {
      if (inFlight !== null) return inFlight;
      const run = reconcileNativeJourneyDurablePositions(options);
      const wrapped = run.finally(() => {
        if (inFlight === wrapped) inFlight = null;
      });
      inFlight = wrapped;
      return wrapped;
    },
  };
}
