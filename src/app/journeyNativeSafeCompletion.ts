import type { Journey } from '../domain/journey';
import type { ISODateTime } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { clearJourneyPauseOrigin } from '../storage/journeyPauseProvenance';
import { createJourneyRecoveryController } from './journeyRecoveryController';
import type { JourneyMotionSession } from './journeyMotionSession';
import { reconcileNativeJourneyDurablePositions } from './journeyNativeDurableReconciliation';
import type { NativeJourneyDurableReplayCoordinator } from './journeyNativeDurableReplayCoordinator';
import type {
  NativeJourneyDurablePositionQueue,
  NativeJourneyDurableReplayResult,
} from './journeyNativeDurableQueue';

export type JourneyNativeSafeCompletionFailure =
  | 'replay_failed'
  | 'queue_clear_failed'
  | 'completion_failed';

export type JourneyNativeSafeCompletionResult =
  | {
      completed: true;
      journey: Journey;
      replay: NativeJourneyDurableReplayResult | null;
    }
  | {
      completed: false;
      reason: JourneyNativeSafeCompletionFailure;
      replay: NativeJourneyDurableReplayResult | null;
    };

/**
 * Finish an active Journey without dropping native fixes that were already durably
 * captured while the WebView was suspended.
 *
 * Ordering is deliberate:
 * 1. quiesce the live provider so no new callbacks race final replay;
 * 2. reconcile the durable native suffix through the existing trusted motion path;
 * 3. clear the now-empty Journey-scoped native queue;
 * 4. choose completion time after replay so it cannot precede the newest native fix;
 * 5. persist completed history, then permanently stop replay processing.
 *
 * If startup/foreground reconciliation is already in flight, callers pass the same
 * coordinator used by the Active Journey screen. Completion then shares ownership of
 * that in-flight drain instead of starting a competing read/ack sequence. Once it has
 * resolved, the queue can be cleared safely before completed history becomes authoritative.
 *
 * Any replay/queue/persistence failure leaves the Journey active and recoverable. The
 * provider remains quiesced so a retry cannot race new observations. Completion never
 * silently discards an unreconciled native suffix.
 */
export async function completeJourneyAfterNativeReconciliation(options: {
  storage: StorageAdapter;
  session: JourneyMotionSession;
  queue?: NativeJourneyDurablePositionQueue | null;
  replayCoordinator?: NativeJourneyDurableReplayCoordinator | null;
  now: () => ISODateTime;
}): Promise<JourneyNativeSafeCompletionResult> {
  options.session.stopProvider();

  let replay: NativeJourneyDurableReplayResult | null = null;
  const journeyId = options.session.getJourney().id;

  if (options.queue) {
    replay = options.replayCoordinator
      ? await options.replayCoordinator.reconcile()
      : await reconcileNativeJourneyDurablePositions({
          journeyId,
          queue: options.queue,
          session: options.session,
        });
    if (replay.stopReason !== null) {
      return { completed: false, reason: 'replay_failed', replay };
    }

    try {
      await options.queue.clear(journeyId);
    } catch {
      return { completed: false, reason: 'queue_clear_failed', replay };
    }
  }

  let completed: Journey;
  try {
    const recovery = createJourneyRecoveryController(options.storage);
    completed = recovery.complete(options.session.getJourney(), options.now());
  } catch {
    return { completed: false, reason: 'completion_failed', replay };
  }

  // Completion has already made the sidecar irrelevant. Cleanup is best-effort so a
  // stale auxiliary key can never turn a successfully persisted completion into a
  // misleading failure result.
  try {
    clearJourneyPauseOrigin(options.storage, journeyId);
  } catch {
    // No-op by design; completed Journey history is authoritative.
  }

  options.session.stop();
  return { completed: true, journey: completed, replay };
}
