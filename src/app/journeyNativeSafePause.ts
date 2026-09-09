import type { Journey } from '../domain/journey';
import type { ISODateTime } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { saveJourneyPauseOrigin } from '../storage/journeyPauseProvenance';
import { createJourneyRecoveryController } from './journeyRecoveryController';
import type { JourneyMotionSession } from './journeyMotionSession';
import { reconcileNativeJourneyDurablePositions } from './journeyNativeDurableReconciliation';
import { isRetryableNativeJourneyReplayStop } from './journeyNativeDurableQueue';
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
  | {
      paused: false;
      reason: JourneyNativeSafePauseFailure;
      replay: NativeJourneyDurableReplayResult | null;
      /**
       * Whether the native recorder is collecting again after the refusal.
       *
       * A refused Pause leaves the Journey logically recording. If the provider stayed
       * quiesced, that state would be a lie: a Recording Journey over a recorder that
       * can never produce another fix, with active time still climbing. False here is
       * the screen's signal to stop claiming healthy recording.
       */
      recording: boolean;
    };

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
 * Replay may itself cross the stationary threshold and auto-pause the Journey. The
 * user's explicit Pause still wins: that existing pause is re-labelled `manual` rather
 * than creating a duplicate pause interval. A later movement fix therefore cannot
 * auto-resume a Journey the user deliberately paused.
 *
 * Failure before persistence leaves the Journey active/recoverable with its provider
 * quiesced. A retry may safely reuse the same replay coordinator.
 */
export async function pauseJourneyAfterNativeReconciliation(options: {
  storage: StorageAdapter;
  session: JourneyMotionSession;
  queue?: NativeJourneyDurablePositionQueue | null;
  replayCoordinator?: NativeJourneyDurableReplayCoordinator | null;
  now: () => ISODateTime;
}): Promise<JourneyNativeSafePauseResult> {
  /*
   * A refusal must not silently end the recording it interrupted. The Journey is still
   * logically recording, so the provider quiesced for the drain is re-armed on the way
   * out. `resumeProvider` only restarts an existing provider; it never requests a
   * permission, so this cannot prompt outside a user gesture, and a session that was
   * permanently stopped stays stopped and reports it.
   */
  const failed = (
    reason: JourneyNativeSafePauseFailure,
    replay: NativeJourneyDurableReplayResult | null,
  ): JourneyNativeSafePauseResult => ({
    paused: false,
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

  let paused: Journey;
  try {
    const current = options.session.getJourney();
    paused = current.status === 'paused'
      ? current
      : createJourneyRecoveryController(options.storage).pause(current, options.now());
    saveJourneyPauseOrigin(options.storage, paused.id, 'manual');
  } catch {
    return failed('pause_failed', replay);
  }

  options.session.stop();
  return { paused: true, journey: paused, replay };
}
