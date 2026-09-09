import type { Journey } from '../domain/journey';
import type { ISODateTime } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { clearJourneyPauseOrigin } from '../storage/journeyPauseProvenance';
import { createJourneyRecoveryController } from './journeyRecoveryController';
import type { JourneyMotionSession } from './journeyMotionSession';
import { reconcileNativeJourneyDurablePositions } from './journeyNativeDurableReconciliation';
import { isRetryableNativeJourneyReplayStop } from './journeyNativeDurableQueue';
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
      /**
       * Whether the native recorder is collecting again after the refusal.
       *
       * A refused Finish leaves the Journey logically recording. If the provider stayed
       * quiesced, that state would be a lie: a Recording Journey over a recorder that
       * can never produce another fix, with active time still climbing. False here is
       * the screen's signal to stop claiming healthy recording.
       */
      recording: boolean;
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
  /*
   * A refusal must not silently end the recording it interrupted. See the same note in
   * journeyNativeSafePause: re-arming never prompts for a permission, and a permanently
   * stopped session stays stopped and reports it.
   */
  const failed = (
    reason: JourneyNativeSafeCompletionFailure,
    replay: NativeJourneyDurableReplayResult | null,
  ): JourneyNativeSafeCompletionResult => ({
    completed: false,
    reason,
    replay,
    recording: options.session.resumeProvider(),
  });

  options.session.stopProvider();

  let replay: NativeJourneyDurableReplayResult | null = null;
  const journeyId = options.session.getJourney().id;

  if (options.queue) {
    const queue = options.queue;
    const drain = () => reconcileNativeJourneyDurablePositions({
      journeyId,
      queue,
      session: options.session,
    });

    /*
     * Never adopt the polling drain's result. `runExclusive` waits for whatever drain is
     * already holding the durable prefix, discards its outcome, and then reads again with
     * the session THIS call was handed. A drain that stopped because its own session was
     * replaced says nothing about ours, and treating it as our failure is what left a
     * person unable to pause or finish a Journey at all.
     */
    replay = options.replayCoordinator
      ? await options.replayCoordinator.runExclusive(drain)
      : await drain();

    /*
     * One bounded retry, and only for the lifecycle boundary. Our own session was live
     * when this call started; if it was stopped underneath us mid-drain the durable
     * suffix is untouched and a single re-read settles it. Every other stop reason is a
     * real fault and still refuses - fail-closed is unchanged.
     */
    if (isRetryableNativeJourneyReplayStop(replay.stopReason) && !options.session.isStopped()) {
      replay = options.replayCoordinator
        ? await options.replayCoordinator.runExclusive(drain)
        : await drain();
    }

    if (replay.stopReason !== null) {
      return failed('replay_failed', replay);
    }

    try {
      await options.queue.clear(journeyId);
    } catch {
      return failed('queue_clear_failed', replay);
    }
  }

  let completed: Journey;
  try {
    const recovery = createJourneyRecoveryController(options.storage);
    completed = recovery.complete(options.session.getJourney(), options.now());
  } catch {
    return failed('completion_failed', replay);
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
