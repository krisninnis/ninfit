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
import { createAndroidJourneyServiceLocationProvider } from './journeyAndroidServiceLocationProvider';
import { resolveInjectedNativeJourneyDurableQueue } from './journeyNativeDurableQueueBootstrap';
import { createJourneyGpsRuntimeController } from './journeyGpsRuntimeController';
import type {
  JourneyLocationProvider,
  JourneyLocationProviderError,
  JourneyLocationProviderSession,
} from './journeyLocationProvider';
import { createRuntimeJourneyLocationProvider } from './journeyLocationProviderRuntime';
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
  /** Process one sample through the exact same trusted motion path used by the live provider. */
  processSample(sample: JourneyGpsSample): void;
  /** Stop new provider callbacks while keeping durable replay processing available. */
  stopProvider(): void;
  /** Permanently stop both the provider and any further replay processing. */
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
 *
 * `processSample` is deliberately exposed so durable native replay can enter this exact
 * same path. Replay therefore cannot bypass GPS trust, route, distance or auto-pause rules.
 *
 * `stopProvider` is deliberately weaker than `stop`: completion/pause coordination can
 * first quiesce new native callbacks, drain the already-durable native suffix through
 * `processSample`, and only then permanently stop the motion session. Late callbacks
 * from a provider that races its own stop are ignored.
 *
 * When the installed Android queue exists, provider selection deliberately chooses the
 * Android foreground Journey service rather than browser geolocation. That service emits
 * no direct samples: GPS observations enter SQLite first and the durable replay path is
 * the sole route into `processSample`. Web/PWA continues to use the normal runtime/browser
 * provider. An explicitly injected provider still wins for tests and controlled callers.
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
  const nativeQueue = resolveInjectedNativeJourneyDurableQueue();
  const provider = options.provider
    ?? (nativeQueue === null
      ? createRuntimeJourneyLocationProvider()
      : createAndroidJourneyServiceLocationProvider(options.journey.id));

  let currentJourney = options.journey;
  let detector = initialDetectorState(currentJourney, pauseOrigin);
  let motionState: JourneyMotionState =
    currentJourney.status === 'paused' ? 'auto_paused' : 'recording';
  let stopped = false;
  let providerStopped = false;
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

    const result = runtime.ingest(resumed, sample, { startsNewSegment: false });
    if (result.accepted) publishJourney(result.journey);
  }

  function processSample(sample: JourneyGpsSample): void {
    if (stopped) throw new Error('Journey motion session is stopped');
    if (motionState === 'auto_paused') handleAutoPausedSample(sample);
    else handleRecordingSample(sample);
  }

  function stopProvider(): void {
    if (providerStopped) return;
    providerStopped = true;
    providerSession?.stop();
    providerSession = null;
  }

  function stop(): void {
    if (stopped) return;
    stopProvider();
    stopped = true;
  }

  try {
    providerSession = provider.start({
      onSample(sample) {
        if (stopped || providerStopped) return;
        try {
          processSample(sample);
        } catch (cause) {
          options.onRuntimeError?.(cause);
          stop();
        }
      },
      onError(error) {
        if (!stopped && !providerStopped) options.onProviderError?.(error);
      },
    });
  } catch (cause) {
    options.onRuntimeError?.(cause);
    throw cause;
  }

  return {
    getJourney() {
      return currentJourney;
    },
    getMotionState() {
      return motionState;
    },
    processSample,
    stopProvider,
    stop,
  };
}
