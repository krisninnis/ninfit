import type { Journey } from '../domain/journey';
import type { JourneyGpsSample } from '../domain/journeyGps';
import type { JourneyGpsRuntimeController } from './journeyGpsRuntimeController';
import {
  startJourneyGeolocationWatch,
  type JourneyGeolocationAdapterOptions,
  type JourneyGeolocationWatch,
} from './journeyGeolocationAdapter';

export interface ActiveJourneyGpsSessionOptions {
  initialJourney: Journey;
  runtimeController: JourneyGpsRuntimeController;
  onJourneyChanged?(journey: Journey): void;
  onError?(error: GeolocationPositionError): void;
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
 */
export function createActiveJourneyGpsSession(
  options: ActiveJourneyGpsSessionOptions,
): ActiveJourneyGpsSession {
  let currentJourney = options.initialJourney;
  let stopped = false;
  const startWatch = options.startWatch ?? startJourneyGeolocationWatch;

  const watch = startWatch({
    onSample(sample: JourneyGpsSample) {
      if (stopped) return;
      const result = options.runtimeController.ingest(currentJourney, sample);
      if (!result.accepted) return;
      currentJourney = result.journey;
      options.onJourneyChanged?.(currentJourney);
    },
    onError(error) {
      if (stopped) return;
      options.onError?.(error);
    },
  });

  return {
    getJourney() {
      return currentJourney;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      watch.stop();
    },
  };
}
