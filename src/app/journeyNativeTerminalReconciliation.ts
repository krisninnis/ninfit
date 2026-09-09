import type { JourneyMotionSession } from './journeyMotionSession';
import {
  reconcileNativeJourneyDurablePositions,
} from './journeyNativeDurableReconciliation';
import type {
  NativeJourneyDurablePositionQueue,
  NativeJourneyDurableReplayResult,
} from './journeyNativeDurableQueue';

export interface JourneyNativeTerminalReconciliationResult {
  replay: NativeJourneyDurableReplayResult | null;
}

/**
 * Quiesce live native callbacks before a manual pause/finish/leave boundary, then drain
 * the already-durable native suffix while JourneyMotionSession can still process it.
 *
 * The caller remains responsible for the actual domain transition and for calling
 * session.stop() afterwards. This split prevents the terminal transition from racing a
 * final background fix without granting native transport any Journey-state authority.
 */
export async function quiesceAndReconcileNativeJourney(options: {
  journeyId: string;
  session: JourneyMotionSession;
  queue: NativeJourneyDurablePositionQueue | null;
}): Promise<JourneyNativeTerminalReconciliationResult> {
  options.session.stopProvider();

  if (options.queue === null) return { replay: null };

  const replay = await reconcileNativeJourneyDurablePositions({
    journeyId: options.journeyId,
    queue: options.queue,
    session: options.session,
  });
  return { replay };
}
