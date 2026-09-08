import type { Journey } from '../domain/journey';
import type { ISODateTime } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { saveJourneyPauseOrigin } from '../storage/journeyPauseProvenance';
import { createJourneyRecoveryController } from './journeyRecoveryController';
import type { JourneyMotionSession } from './journeyMotionSession';
import { reconcileNativeJourneyDurablePositions } from './journeyNativeDurableReconciliation';
import type { NativeJourneyDurableReplayCoordinator } from './journeyNativeDurableReplayCoordinator';
import type {
  NativeJourneyDurablePositionQueue,
  NativeJourneyDurableReplayResult,
} from './journeyNativeDurableQueue';

export type JourneyNativeSafePauseFailure =
  | 'replay_failed'
  | 'queue_clear_failed'
  | 'pause_failed';

export type JourneyNativeSafePauseResult =
  | { paused: true; journey: Journey; replay: NativeJourneyDurableReplayResult | null }
  | { paused: false; reason: JourneyNativeSafePauseFailure; replay: NativeJourneyDurableReplayResult | null };

/**
 * Manual Pause must not strand the native suffix collected immediately before the tap.
 *
 * Ordering mirrors durable-safe Finish but preserves manual-pause authority:
 * 1. quiesce new provider callbacks;
 * 2. reconcile already-durable fixes through the trusted Journey motion path;
 * 3. clear the reconciled Journey-scoped queue;
 * 4. persist a manual pause using the post-replay Journey;
 * 5. save explicit manual provenance and permanently stop the motion session.
 *
 * Failure before persistence leaves the Journey recording and recoverable with its
 * provider quiesced. A retry may safely reuse the same replay coordinator.
 */
export async function pauseJourneyAfterNativeReconciliation(options: {
  storage: StorageAdapter;
  session: JourneyMotionSession;
  queue?: NativeJourneyDurablePositionQueue | null;
  replayCoordinator?: NativeJourneyDurableReplayCoordinator | null;
  now: () => ISODateTime;
}): Promise<JourneyNativeSafePauseResult> {
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
      return { paused: false, reason: 'replay_failed', replay };
    }

    try {
      await options.queue.clear(journeyId);
    } catch {
      return { paused: false, reason: 'queue_clear_failed', replay };
    }
  }

  let paused: Journey;
  try {
    const recovery = createJourneyRecoveryController(options.storage);
    paused = recovery.pause(options.session.getJourney(), options.now());
    saveJourneyPauseOrigin(options.storage, paused.id, 'manual');
  } catch {
    return { paused: false, reason: 'pause_failed', replay };
  }

  options.session.stop();
  return { paused: true, journey: paused, replay };
}
