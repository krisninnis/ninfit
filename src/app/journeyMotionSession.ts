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
import {
  createJourneyAutoResumeDiagnostics,
  type JourneyAutoResumeDiagnosticSnapshot,
} from './journeyAutoResumeDiagnostics';
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

export class JourneyMotionSessionStoppedError extends Error {
  constructor() {
    super('Journey motion session is stopped');
    this.name = 'JourneyMotionSessionStoppedError';
  }
}

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
  isStopped(): boolean;
  isProviderStopped(): boolean;
  processSample(sample: JourneyGpsSample): void;
  stopProvider(): void;
  resumeProvider(): boolean;
  stop(): void;
}

/**
 * Optional diagnostic capability carried by real field-trial sessions.
 *
 * Deliberately separate from JourneyMotionSession so production consumers and
 * existing test doubles are not required to implement temporary diagnostics.
 */
export interface JourneyAutoResumeDiagnosticSession extends JourneyMotionSession {
  getAutoResumeDiagnostics(): JourneyAutoResumeDiagnosticSnapshot;
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
 * The field-trial diagnostics observe only the already-computed auto-pause evaluation.
 * They have no authority over detector state, Journey state, provider lifecycle, route,
 * distance, persistence, or pause/resume decisions.
 */
export function startJourneyMotionSession(options: JourneyMotionSessionOptions): JourneyAutoResumeDiagnosticSession {
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
  const diagnostics = createJourneyAutoResumeDiagnostics();
  const nativeQueue = resolveInjectedNativeJourneyDurableQueue();
  const runtimeProvider = createRuntimeJourneyLocationProvider();
  const provider = options.provider
    ?? (nativeQueue !== null && runtimeProvider.kind === 'browser'
      ? createAndroidJourneyServiceLocationProvider({ journeyId: options.journey.id })
      : runtimeProvider);

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
    const previousDetector = detector;
    const evaluation = evaluateJourneyAutoPause(previousDetector, sample);
    diagnostics.observe(previousDetector, sample, evaluation);
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
    if (stopped) throw new JourneyMotionSessionStoppedError();
    if (motionState === 'auto_paused') handleAutoPausedSample(sample);
    else handleRecordingSample(sample);
  }

  function stopProvider(): void {
    if (providerStopped) return;
    providerStopped = true;
    providerSession?.stop();
    providerSession = null;
  }

  let providerStartFailed = false;

  function startProviderSession(): void {
    let starting = true;
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
          if (starting) providerStartFailed = true;
          if (!stopped && !providerStopped) options.onProviderError?.(error);
        },
      });
    } finally {
      starting = false;
    }
  }

  function resumeProvider(): boolean {
    if (stopped || !providerStopped) return false;
    providerStopped = false;
    providerStartFailed = false;
    try {
      startProviderSession();
    } catch (cause) {
      options.onRuntimeError?.(cause);
      providerStartFailed = true;
    }
    if (providerStartFailed) {
      providerSession = null;
      providerStopped = true;
      return false;
    }
    return true;
  }

  function stop(): void {
    if (stopped) return;
    stopProvider();
    stopped = true;
  }

  try {
    startProviderSession();
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
    getAutoResumeDiagnostics() {
      return diagnostics.snapshot();
    },
    isStopped() {
      return stopped;
    },
    isProviderStopped() {
      return providerStopped;
    },
    processSample,
    stopProvider,
    resumeProvider,
    stop,
  };
}
