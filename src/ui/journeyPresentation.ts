import type { Journey } from '../domain/journey';

export type JourneyGpsPresentationState = 'waiting' | 'receiving';
export type JourneyLiveGpsState =
  | 'connecting'
  | 'live'
  | 'searching'
  | 'permission_denied'
  | 'runtime_error'
  /**
   * The native recorder is quiesced and the Journey could not transition. The Journey is
   * still on the device and still finishable, but NinFit must stop presenting it as
   * healthy recording - and must stop its active time from climbing over a recorder that
   * cannot produce another fix.
   */
  | 'recorder_stopped'
  | 'not_applicable'
  | 'paused'
  | 'finished';

export function journeyDistanceM(journey: Pick<Journey, 'metrics'>): number {
  return journey.metrics.find((metric) => metric.kind === 'distance_m')?.value ?? 0;
}

export function formatJourneyDistance(distanceM: number): string {
  const safe = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  return (safe / 1000).toFixed(2);
}

/**
 * Pace as mm:ss, for a value the domain was willing to state.
 *
 * `null` in, `null` out, deliberately. The decision about whether a pace exists at
 * all belongs to `journeyStatistics` - it knows the distance, the source and the
 * active time - and a formatter that quietly turned a missing pace into "00:00"
 * would put a fabricated number on a screen with no way for anyone to tell.
 *
 * Hours are not handled because a pace slower than an hour per kilometre is not a
 * pace, it is a recording that should not have produced one.
 */
export function formatJourneyPace(secondsPerKm: number | null): string | null {
  if (secondsPerKm === null) return null;
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return null;

  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatJourneyDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Stored-route evidence only. This does not claim that a foreground watcher is live. */
export function journeyGpsPresentationState(
  journey: Pick<Journey, 'route'>,
): JourneyGpsPresentationState {
  return (journey.route?.acceptedPoints.length ?? 0) > 0 ? 'receiving' : 'waiting';
}

export function journeyGpsLabel(state: JourneyGpsPresentationState): string {
  return state === 'receiving' ? 'GPS points saved' : 'GPS waiting';
}

/**
 * Why a Finish attempt stopped without completing the Journey.
 *
 * Declared here rather than imported so the presentation layer keeps its domain-only
 * import boundary. It mirrors `JourneyNativeSafeCompletionFailure` exactly; the Active
 * Journey screen assigns one to the other, so a new failure reason in the application
 * layer fails typecheck here instead of reaching a user as a missing message.
 */
export type JourneyFinishFailure =
  | 'replay_failed'
  | 'queue_clear_failed'
  | 'completion_failed';

/**
 * Honest wording for a Finish that stopped safely.
 *
 * Every message says the same three things in the same order: nothing was lost, the
 * Journey is still on the device, and Finish can be tried again. A failed Finish never
 * persists completed history and never clears the native queue, so that is true - and
 * the calm-by-default contract means it is said without alarm or blame.
 */
export function journeyFinishFailureNote(reason: JourneyFinishFailure): string {
  switch (reason) {
    case 'replay_failed':
      return 'Finish stopped safely: GPS collected while your phone was locked could not be read back yet. This Journey is still recording on this device. Try Finish again.';
    case 'queue_clear_failed':
      return 'Finish stopped safely while tidying up background GPS. This Journey is still recording on this device. Try Finish again.';
    case 'completion_failed':
      return 'Finish could not be saved. This Journey is still recording on this device. Try Finish again.';
  }
}

/**
 * Why native Journey recording stopped, in the vocabulary the durable replay boundary
 * already uses.
 *
 * Declared here rather than imported, exactly like `JourneyFinishFailure`, so the
 * presentation layer keeps its domain-only import boundary. The Active Journey screen
 * assigns the application-layer union to this one, so a new stop reason fails typecheck
 * here instead of reaching a user as a missing sentence.
 */
export type JourneyRecorderStopReason =
  | 'invalid_position'
  | 'invalid_sequence'
  | 'sequence_gap'
  | 'processor_error'
  | 'acknowledgement_error'
  | 'queue_read_error'
  | 'session_stopped'
  | 'queue_unavailable';

/**
 * What to say when background GPS could not be read back.
 *
 * Three rules hold for every sentence: nothing collected has been lost, the Journey is
 * still on this device, and there is something the person can actually do. The reasons
 * are separated because they are not the same situation - a queue that cannot be reached
 * at all is a broken build, while a drain interrupted mid-way just needs another go -
 * and because a single sentence for all of them is what made a real device failure
 * impossible to diagnose. None of them names a class, a table or an exception.
 */
export function journeyRecorderStopNote(reason: JourneyRecorderStopReason): string {
  switch (reason) {
    case 'queue_unavailable':
      return 'This build cannot reach its background GPS recorder. Nothing already recorded has been lost, and this Journey is still on your phone.';
    case 'queue_read_error':
      return 'Background GPS could not be read back just now. Nothing has been lost - try again in a moment.';
    case 'session_stopped':
      return 'Background GPS is still being tidied up. Nothing has been lost - try again in a moment.';
    case 'acknowledgement_error':
      return 'Background GPS was read but could not be filed away yet. Nothing has been lost - try again in a moment.';
    case 'invalid_position':
    case 'invalid_sequence':
    case 'sequence_gap':
      return 'Some background GPS did not arrive in a state NinFit trusts, so it has been kept rather than used. Everything already on your route is safe.';
    case 'processor_error':
      return 'NinFit could not take in the newest background GPS. Nothing has been lost - try again in a moment.';
  }
}

export function journeyLiveGpsLabel(state: JourneyLiveGpsState): string {
  switch (state) {
    case 'connecting':
      return 'GPS connecting';
    case 'live':
      return 'GPS live';
    case 'searching':
      return 'GPS searching';
    case 'permission_denied':
      return 'Location permission needed';
    case 'runtime_error':
      return 'GPS stopped';
    case 'recorder_stopped':
      return 'Recording stopped';
    case 'not_applicable':
      return 'GPS not used';
    case 'paused':
      return 'GPS paused';
    case 'finished':
      return 'GPS finished';
  }
}

export function journeyLiveGpsNote(state: JourneyLiveGpsState): string {
  switch (state) {
    case 'connecting':
      return 'Waiting for a trusted GPS point.';
    case 'live':
      return 'Trusted GPS points are updating this Journey.';
    case 'searching':
      return 'GPS is temporarily unavailable. The watcher is still trying.';
    case 'permission_denied':
      return 'Location permission is off. Pause and resume after allowing location to retry.';
    case 'runtime_error':
      return 'GPS recording stopped safely. Pause and resume to retry.';
    case 'recorder_stopped':
      return 'Background recording has stopped, so this Journey is no longer collecting time or distance. Finish it when you are ready.';
    case 'not_applicable':
      return 'Phone GPS is not used for swimming. Pool and wearable distance can be added later.';
    case 'paused':
      return 'GPS collection is paused.';
    case 'finished':
      return 'GPS collection has stopped for this Journey.';
  }
}
