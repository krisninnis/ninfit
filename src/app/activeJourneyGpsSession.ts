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
  /*
   * One session is one continuously observed run, so the marker is latched here and
   * cleared only when something is actually accepted.
   *
   * Holding it across rejections is the point: a watcher that wakes up and offers two
   * useless fixes before a good one has still only begun observing at the good one.
   * Clearing it on the first *sample* would file the segment against a point the route
   * never kept, and clearing it when the watcher starts would file an empty segment
   * against a run that produced nothing.
   */
  let startsNewSegment = true;
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
        const result = options.runtimeController.ingest(currentJourney, sample, {
          startsNewSegment,
        });
        if (!result.accepted) return;
        startsNewSegment = false;
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
      /*
       * A REPORTED ERROR IS DELIBERATELY NOT TREATED AS A BREAK IN THE ROUTE.
       *
       * The obvious move here is to latch `startsNewSegment` again: the watcher has
       * just said it is not seeing anything, so surely the next point begins a new
       * run. A browser proof showed why that is wrong. Transient POSITION_UNAVAILABLE
       * and TIMEOUT reports arrive BETWEEN perfectly good fixes on real hardware, and
       * a rule that breaks the run on each one turns a continuous walk into a string
       * of one-point runs - none of which is two points, so none of which is drawable,
       * so a route that was recorded perfectly well renders as nothing at all.
       *
       * The question that actually matters is not "did the watcher complain" but "did
       * we stop seeing the ground for long enough to have missed some". That is
       * answered by the gap between accepted timestamps, in `ingestJourneyGpsSample`,
       * where an error that really did cost observation shows up as a silence and one
       * that cost nothing correctly shows up as nothing.
       *
       * So the error is passed on for the screen to describe, and the route is left
       * exactly as it was.
       */
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
