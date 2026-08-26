import type { Journey } from '../domain/journey';
import type { JourneyGpsSample } from '../domain/journeyGps';
import type { JourneyGpsRuntimeController } from './journeyGpsRuntimeController';
import {
  startJourneyGeolocationWatch,
  type JourneyGeolocationAdapterOptions,
  type JourneyGeolocationWatch,
} from './journeyGeolocationAdapter';

export interface ActiveJourneyGpsSessionRuntimeError {
  kind: 'runtime_ingest_failed';
  cause: unknown;
}

export interface ActiveJourneyGpsSessionOptions {
  initialJourney: Journey;
  runtimeController: JourneyGpsRuntimeController;
  onJourneyChanged?(journey: Journey): void;
  onError?(error: GeolocationPositionError): void;
  onRuntimeError?(error: ActiveJourneyGpsSessionRuntimeError): void;
  startWatch?(options: JourneyGeolocationAdapterOptions): JourneyGeolocationWatch;
}

export interface ActiveJourneyGpsSession {
  getJourney(): Journey;
  stop(): void;
}

/**
 * Owns the live in-memory Journey value while a foreground geolocation watch is active.
 * Accepted GPS samples replace the current Journey and are already recovery-persisted by
 * JourneyGpsRuntimeController. Rejected samples leave the current Journey untouched.
 * Runtime ingestion failures are fatal to the foreground GPS session: the watcher stops,
 * the last accepted Journey remains current, and consumers receive an explicit error.
 */
export function createActiveJourneyGpsSession(
  options: ActiveJourneyGpsSessionOptions,
): ActiveJourneyGpsSession {
  let currentJourney = options.initialJourney;
  let stopped = false;
  const startWatch = options.startWatch ?? startJourneyGeolocationWatch;
  let watch: JourneyGeolocationWatch | undefined;
  let stopWatchAfterStart = false;
  let pendingRuntimeError: ActiveJourneyGpsSessionRuntimeError | undefined;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (watch) watch.stop();
    else stopWatchAfterStart = true;
  }

  watch = startWatch({
    onSample(sample: JourneyGpsSample) {
      if (stopped) return;

      try {
        const result = options.runtimeController.ingest(currentJourney, sample);
        if (!result.accepted) return;
        currentJourney = result.journey;
        options.onJourneyChanged?.(currentJourney);
      } catch (cause) {
        const runtimeError: ActiveJourneyGpsSessionRuntimeError = {
          kind: 'runtime_ingest_failed',
          cause,
        };
        stop();
        if (watch) options.onRuntimeError?.(runtimeError);
        else pendingRuntimeError = runtimeError;
      }
    },
    onError(error) {
      if (stopped) return;
      options.onError?.(error);
    },
  });

  if (stopWatchAfterStart) watch.stop();
  if (pendingRuntimeError) options.onRuntimeError?.(pendingRuntimeError);

  return {
    getJourney() {
      return currentJourney;
    },
    stop,
  };
}
