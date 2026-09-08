import type { JourneyMotionSession } from './journeyMotionSession';
import {
  replayNativeJourneyDurableQueue,
  type NativeJourneyDurablePositionQueue,
  type NativeJourneyDurableReplayResult,
} from './journeyNativeDurableQueue';
import { createJourneyNativeReplayMotionProcessor } from './journeyNativeReplayMotionProcessor';

/**
 * One production-facing reconciliation entry point for a native process queue.
 * Every durable fix enters the same JourneyMotionSession sample method as live GPS.
 */
export function reconcileNativeJourneyDurablePositions(options: {
  journeyId: string;
  queue: NativeJourneyDurablePositionQueue;
  session: JourneyMotionSession;
}): Promise<NativeJourneyDurableReplayResult> {
  return replayNativeJourneyDurableQueue({
    journeyId: options.journeyId,
    queue: options.queue,
    processor: createJourneyNativeReplayMotionProcessor(options.session),
  });
}
