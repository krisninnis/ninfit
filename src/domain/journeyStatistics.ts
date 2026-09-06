import {
  journeyActiveSeconds,
  journeyElapsedSeconds,
  journeyPausedSeconds,
  sourceForObservation,
  type Journey,
  type JourneySourceKind,
} from './journey';

/**
 * The authoritative numbers for one Journey, derived once and derived here.
 *
 * WHY THERE IS A SECOND OPINION PROBLEM AT ALL. Distance already exists as a recorded
 * observation with a source; time already exists as a pause-aware domain calculation.
 * Pace does not exist anywhere - and the tempting way to get it is to divide whatever
 * two numbers a screen happens to be holding. Do that twice, on two screens, and the
 * completion moment and the saved record eventually disagree about the same walk.
 *
 * So nothing here measures anything. It reads the recorded `distance_m` observation
 * and the recorder's own timeline, and it divides them once.
 *
 * A NUMBER THAT WAS NEVER MEASURED IS `null`, NEVER 0. Zero is a measurement. The
 * absence of one is not, and every consumer has to be able to tell them apart -
 * `journeyDistanceM` deliberately cannot, which is why it stays where it is for
 * presentation and why nothing here is built on it.
 */

/** Distance below which a derived pace is noise rather than a fact about someone. */
export const JOURNEY_MIN_PACE_DISTANCE_M = 100;

/**
 * Source kinds whose distance was actually measured by a device.
 *
 * A manually entered distance is a legitimate part of somebody's history and a poor
 * basis for comparing efforts, because it is a memory rather than a measurement. It
 * is preserved and displayed; it just does not get to decide who was faster.
 */
export const JOURNEY_MEASURED_SOURCE_KINDS: ReadonlySet<JourneySourceKind> = new Set<JourneySourceKind>([
  'ninfit_phone_gps',
  'fitbit',
  'health_connect',
  'apple_watch',
  'healthkit',
]);

export interface JourneyStatistics {
  /** Metres, or null when this Journey carries no distance observation at all. */
  distanceM: number | null;
  /** The kind of source that observed the distance, or null when there is none. */
  distanceSourceKind: JourneySourceKind | null;
  /** True when the distance came from a device rather than from somebody's memory. */
  distanceMeasured: boolean;
  elapsedSeconds: number;
  pausedSeconds: number;
  activeSeconds: number;
  /**
   * Seconds per kilometre over pause-aware active time, or null when NinFit cannot
   * state one honestly - no distance, no time, or too little distance to divide.
   *
   * It is not moving pace. NinFit does not derive moving time, and calling
   * pause-aware time "moving" would be a claim about standing still that nothing
   * here measured.
   */
  paceSecondsPerKm: number | null;
  /** Metres per second over the same basis, or null on the same conditions. */
  speedMps: number | null;
}

type JourneyForStatistics = Pick<
  Journey,
  'startedAt' | 'endedAt' | 'pauses' | 'metrics' | 'sources'
>;

export function journeyStatistics(journey: JourneyForStatistics): JourneyStatistics {
  const observation = journey.metrics.find((metric) => metric.kind === 'distance_m');
  const source = observation ? sourceForObservation(journey, observation) : undefined;

  const rawDistance = observation?.value;
  const distanceM =
    rawDistance !== undefined && Number.isFinite(rawDistance) && rawDistance >= 0
      ? rawDistance
      : null;

  const elapsedSeconds = journeyElapsedSeconds(journey);
  const pausedSeconds = journeyPausedSeconds(journey);
  const activeSeconds = journeyActiveSeconds(journey);

  const distanceSourceKind = source?.kind ?? null;
  const distanceMeasured =
    distanceSourceKind !== null && JOURNEY_MEASURED_SOURCE_KINDS.has(distanceSourceKind);

  const canDivide =
    distanceM !== null && distanceM >= JOURNEY_MIN_PACE_DISTANCE_M && activeSeconds > 0;

  return {
    distanceM,
    distanceSourceKind,
    distanceMeasured,
    elapsedSeconds,
    pausedSeconds,
    activeSeconds,
    paceSecondsPerKm: canDivide ? activeSeconds / (distanceM / 1000) : null,
    speedMps: canDivide ? distanceM / activeSeconds : null,
  };
}
