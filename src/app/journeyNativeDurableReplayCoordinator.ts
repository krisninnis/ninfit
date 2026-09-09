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
  /**
   * Run one drain that this caller owns, serialised behind any drain already running.
   *
   * Pause and Finish must never *adopt* the polling drain's result. That drain belongs
   * to whichever session was live when it started, and a session swap mid-drain
   * (an auto-pause, a screen teardown) makes it stop early - which Pause and Finish
   * then reported as "could not reconcile", permanently, with no way for the person to
   * leave the Journey. Waiting for it and then reading again with their own live
   * session is both safe and terminating.
   */
  runExclusive(
    drain: () => Promise<NativeJourneyDurableReplayResult>,
  ): Promise<NativeJourneyDurableReplayResult>;
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

  function own(
    drain: () => Promise<NativeJourneyDurableReplayResult>,
  ): Promise<NativeJourneyDurableReplayResult> {
    const wrapped: Promise<NativeJourneyDurableReplayResult> = drain().finally(() => {
      if (inFlight === wrapped) inFlight = null;
    });
    inFlight = wrapped;
    return wrapped;
  }

  return {
    reconcile() {
      if (inFlight !== null) return inFlight;
      return own(() => reconcileNativeJourneyDurablePositions(options));
    },
    async runExclusive(drain) {
      // Wait out whoever holds the durable prefix, ignoring their outcome: it belongs to
      // their session, not ours. Then take the prefix ourselves.
      while (inFlight !== null) {
        try {
          await inFlight;
        } catch {
          // A rejected drain releases the prefix just as a resolved one does.
        }
      }
      return own(drain);
    },
  };
}
