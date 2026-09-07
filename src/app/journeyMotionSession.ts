import { newId, type IdFactory } from '../domain/ids';
import type { Journey } from '../domain/journey';
import type { JourneyGpsSample } from '../domain/journeyGps';
import {
  evaluateJourneyAutoPause,
  INITIAL_JOURNEY_AUTO_PAUSE_STATE,
  type JourneyAutoPauseState,
} from '../domain/journeyAutoPause';
import type { StorageAdapter } from '../storage/StorageAdapter';
import {
  clearJourneyPauseOrigin,
  loadJourneyPauseOrigin,
  saveJourneyPauseOrigin,
  type JourneyPauseOrigin,
} from '../storage/journeyPauseProvenance';
import { createJourneyGpsRuntimeController } from './journeyGpsRuntimeController';
import {
  createBrowserJourneyLocationProvider,
  type JourneyLocationProvider,
  type JourneyLocationProviderError,
  type JourneyLocationProviderSession,
} from './journeyLocationProvider';
import { createJourneyRecoveryController } from './journeyRecoveryController';

export type JourneyMotionState = 'recording' | 'auto_paused';

export interface JourneyMotionSessionOptions {
  storage: StorageAdapter;
  journey: Journey;
  provider?: JourneyLocationProvider;
  idFactory?: IdFactory;
  onJourneyChanged?(journey: Journey): void;
  onMotionStateChanged?(state: JourneyMotionState): void;
  onProviderError?(error: JourneyLocationProviderError): void;
  onRuntimeError?(cause: unknown): void;
}

export interface JourneyMotionSession {
  getJourney(): Journey;
  getMotionState(): JourneyMotionState;
  stop(): void;
}

function directPhoneGpsSourceId(journey: Journey): string {
  const source = journey.sources.find(
    (candidate) => candidate.kind === 'ninfit_phone_gps' && candidate.transportedBy === 'direct',
  );
  if (!source) throw new Error('Journey motion session requires a direct ninfit_phone_gps source');
  return source.id;
}

function toSample(point: NonNullable<Journey['route']>['acceptedPoints'][number]): JourneyGpsSample {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracyM: point.accuracyM ?? Number.POSITIVE_INFINITY,
    recordedAt: point.recordedAt,
  };
}

function initialDetectorState(journey: Journey, pauseOrigin: JourneyPauseOrigin): JourneyAutoPauseState {
  const lastPoint = journey.route?.acceptedPoints.at(-1);
  if (!lastPoint) return INITIAL_JOURNEY_AUTO_PAUSE_STATE;

  const anchor = toSample(lastPoint);
  if (journey.status === 'paused' && pauseOrigin === 'auto_stationary') {
    return {
      mode: 'auto_paused',
      anchor,
      stationarySinceMs: journey.pauses.at(-1)?.startedAt
        ? Date.parse(journey.pauses.at(-1)!.startedAt)
        : Date.parse(lastPoint.recordedAt),
      resumeConfirmations: 0,
    };
  }

  return {
    mode: 'moving',
    anchor,
    stationarySinceMs: Date.parse(lastPoint.recordedAt),
    resumeConfirmations: 0,
  };
}

/**
 * Owns the trusted-GPS motion lifecycle for an active Walk/Run/Hike/Cycle Journey.
 *
 * Recording samples still pass through the existing hardened GPS runtime before they
 * can affect route or distance. Auto-pause is evaluated only from samples the runtime
 * accepted. While automatically paused, the provider stays alive solely to look for
 * conservative movement evidence; samples are not added to distance/route until the
 * recorder has been resumed. A manual pause is never auto-resumed because this session
 * refuses to start for a paused Journey without explicit `auto_stationary` provenance.
 */
export function startJourneyMotionSession(options: JourneyMotionSessionOptions): JourneyMotionSession {
  const pauseOrigin = options.journey.status === 'paused'
    ? loadJourneyPauseOrigin(options.storage, options.journey.id)
    : 'manual';

  if (
    options.journey.status !== 'recording'
    && !(options.journey.status === 'paused' && pauseOrigin === 'auto_stationary')
  ) {
    throw new Error('Journey motion session requires recording or auto-paused Journey state');
  }

  const idFactory = options.idFactory ?? newId;
  const phoneGpsSourceId = directPhoneGpsSourceId(options.journey);
  const distanceMetricId =
    options.journey.metrics.find((metric) => metric.kind === 'distance_m')?.id ?? idFactory();
  const runtime = createJourneyGpsRuntimeController(options.storage, {
    phoneGpsSourceId,
    distanceMetricId,
  });
  const recovery = createJourneyRecoveryController(options.storage);
  const provider = options.provider ?? createBrowserJourneyLocationProvider();

  let currentJourney = options.journey;
  let detector = initialDetectorState(currentJourney, pauseOrigin);
  let motionState: JourneyMotionState =
    currentJourney.status === 'paused' ? 'auto_paused' : 'recording';
  let stopped = false;
  let providerSession: JourneyLocationProviderSession | null = null;
  let startsNewSegment = true;

  function publishJourney(next: Journey): void {
    currentJourney = next;
    options.onJourneyChanged?.(next);
  }

  function publishMotion(next: JourneyMotionState): void {
    motionState = next;
    options.onMotionStateChanged?.(next);
  }

  function handleRecordingSample(sample: JourneyGpsSample): void {
    const result = runtime.ingest(currentJourney, sample, { startsNewSegment });
    if (!result.accepted) return;

    startsNewSegment = false;
    publishJourney(result.journey);

    const evaluation = evaluateJourneyAutoPause(detector, sample);
    detector = evaluation.state;
    if (evaluation.signal !== 'auto_pause') return;

    const paused = recovery.pause(currentJourney, sample.recordedAt);
    saveJourneyPauseOrigin(options.storage, paused.id, 'auto_stationary');
    publishJourney(paused);
    publishMotion('auto_paused');
  }

  function handleAutoPausedSample(sample: JourneyGpsSample): void {
    const evaluation = evaluateJourneyAutoPause(detector, sample);
    detector = evaluation.state;
    if (evaluation.signal !== 'auto_resume') return;

    const resumed = recovery.resume(currentJourney, sample.recordedAt);
    clearJourneyPauseOrigin(options.storage, resumed.id);
    publishJourney(resumed);
    publishMotion('recording');

    // The movement-confirming sample belongs to the resumed Journey. It is still
    // subjected to the normal GPS acceptance/speed/distance gates before persistence.
    const result = runtime.ingest(resumed, sample, { startsNewSegment: false });
    if (result.accepted) publishJourney(result.journey);
  }

  try {
    providerSession = provider.start({
      onSample(sample) {
        if (stopped) return;
        try {
          if (motionState === 'auto_paused') handleAutoPausedSample(sample);
          else handleRecordingSample(sample);
        } catch (cause) {
          options.onRuntimeError?.(cause);
          stop();
        }
      },
      onError(error) {
        if (!stopped) options.onProviderError?.(error);
      },
    });
  } catch (cause) {
    options.onRuntimeError?.(cause);
    throw cause;
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    providerSession?.stop();
    providerSession = null;
  }

  return {
    getJourney() {
      return currentJourney;
    },
    getMotionState() {
      return motionState;
    },
    stop,
  };
}
