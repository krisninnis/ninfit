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
  createJourneyFlightRecorder,
  type JourneyFlightRecorderEntry,
} from './journeyFlightRecorder';
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

/**
 * Thrown when a sample is offered to a session the UI has already torn down.
 *
 * This is deliberately its own type. Durable replay must be able to tell "this drain
 * outlived its session" apart from "this sample broke the Journey runtime": the first
 * is an ordinary lifecycle boundary that leaves every unread sample durable and is
 * retryable against the live session, and the second is a real defect. Collapsing them
 * into one generic Error is what turned a routine session swap into a Journey the user
 * could neither pause nor finish.
 */
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
  /** True once `stop()` has run: no further sample can be processed by this session. */
  isStopped(): boolean;
  /** True while the provider is quiesced but replay is still allowed. */
  isProviderStopped(): boolean;
  /** Process one sample through the exact same trusted motion path used by the live provider. */
  processSample(sample: JourneyGpsSample): void;
  /** Stop new provider callbacks while keeping durable replay processing available. */
  stopProvider(): void;
  /**
   * Re-arm a provider quiesced by `stopProvider()`.
   *
   * Used only when a Pause or Finish could not complete: the Journey is still logically
   * recording, so leaving the native recorder stopped would keep a Recording state alive
   * over a recorder that can never produce another fix. Starting a provider never
   * requests a permission - the Android provider fails closed if one is missing - so
   * this cannot prompt without a user gesture. A session already permanently stopped
   * stays stopped.
   */
  resumeProvider(): boolean;
  /** Permanently stop both the provider and any further replay processing. */
  stop(): void;
}

export interface JourneyFlightRecorderSession extends JourneyMotionSession {
  /** Read-only, bounded, privacy-safe evidence from motion decisions observed by this session. */
  getFlightRecorderSnapshot(): JourneyFlightRecorderEntry[];
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
 * Installed Android chooses the foreground Journey service only when a durable native
 * queue exists and no already-installed native provider bridge is present. That preserves
 * explicit/test/native-provider overrides while preventing the installed shell from also
 * starting browser geolocation. The Android service emits no direct samples: SQLite replay
 * remains its sole route into `processSample`. Web/PWA stays browser-based.
 */
export function startJourneyMotionSession(options: JourneyMotionSessionOptions): JourneyFlightRecorderSession {
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
  const flightRecorder = createJourneyFlightRecorder();
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
    flightRecorder.record(evaluation.evidence);
    detector = evaluation.state;
    if (evaluation.signal !== 'auto_pause') return;

    const paused = recovery.pause(currentJourney, sample.recordedAt);
    saveJourneyPauseOrigin(options.storage, paused.id, 'auto_stationary');
    publishJourney(paused);
    publishMotion('auto_paused');
  }

  function handleAutoPausedSample(sample: JourneyGpsSample): void {
    const evaluation = evaluateJourneyAutoPause(detector, sample);
    flightRecorder.record(evaluation.evidence);
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

  /*
   * The native provider adapter deliberately does not throw when the native side refuses
   * to start: it reports through `onError` and hands back a session that does nothing.
   * That is right for the initial start - the screen surfaces the provider error - but it
   * means a caller cannot tell a working recorder from an inert one by return value
   * alone. This flag makes the distinction, so `resumeProvider` can never claim a
   * recorder is collecting again when the start it just made failed.
   */
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
    isStopped() {
      return stopped;
    },
    isProviderStopped() {
      return providerStopped;
    },
    getFlightRecorderSnapshot() {
      return flightRecorder.snapshot();
    },
    processSample,
    stopProvider,
    resumeProvider,
    stop,
  };
}
