import type { Journey, JourneyGpsPoint, JourneyMetricObservation, JourneyRoute } from './journey';
import { evaluateJourneySegment } from './journeyDistance';
import {
  acceptJourneyGpsSample,
  type JourneyGpsRejectionReason,
  type JourneyGpsSample,
} from './journeyGps';

export type JourneyGpsRuntimeRejectionReason =
  | JourneyGpsRejectionReason
  | 'journey_not_recording'
  | 'non_forward_time'
  | 'impossible_speed';

export type JourneyGpsRuntimeResult =
  | { accepted: true; journey: Journey; distanceAddedM: number }
  | { accepted: false; journey: Journey; reason: JourneyGpsRuntimeRejectionReason };

export interface JourneyGpsRuntimeIds {
  phoneGpsSourceId: string;
  distanceMetricId: string;
}

export interface JourneyObservationContinuityPolicy {
  /**
   * The longest silence between two accepted points that NinFit will still call one
   * continuously observed run.
   *
   * A phone watcher offers a fix every one to a few seconds. A minute of nothing is
   * not a slow walker - it is the app frozen behind a lock screen, a tunnel, a tab
   * the browser suspended, or a watcher that quietly stopped. NinFit did not see that
   * stretch of ground, so it must not later draw a line across it.
   */
  maxObservationGapSeconds: number;
}

export const DEFAULT_JOURNEY_OBSERVATION_CONTINUITY_POLICY: JourneyObservationContinuityPolicy = {
  maxObservationGapSeconds: 60,
};

export interface JourneyGpsIngestOptions {
  /**
   * True when this sample is the first offered by a freshly started watcher run.
   *
   * The caller latches it, not this function: a rejected sample must not consume the
   * marker, so the flag stays true until something is actually accepted. The index is
   * then recorded against the point that begins the run rather than against whichever
   * bad fix happened to arrive first.
   */
  startsNewSegment?: boolean;

  /**
   * How long a silence may be before the next accepted point is treated as the start
   * of a NEW observed run rather than the continuation of the current one.
   *
   * This exists because the caller cannot always tell it stopped observing. A watcher
   * that reports an error latches `startsNewSegment` itself; a page frozen by a lock
   * screen reports nothing at all and simply resumes minutes later. The gap in the
   * timestamps is then the only evidence there is, and it is enough.
   */
  continuity?: JourneyObservationContinuityPolicy;
}

function toPoint(sample: JourneyGpsSample): JourneyGpsPoint {
  return {
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracyM: sample.accuracyM,
    recordedAt: sample.recordedAt,
  };
}

function currentDistance(journey: Journey): number {
  return journey.metrics.find((metric) => metric.kind === 'distance_m')?.value ?? 0;
}

function upsertDistanceMetric(
  journey: Journey,
  value: number,
  ids: JourneyGpsRuntimeIds,
  observedAt: string,
): JourneyMetricObservation[] {
  const nextMetric: JourneyMetricObservation = {
    id: ids.distanceMetricId,
    kind: 'distance_m',
    value,
    observedAt,
    sourceId: ids.phoneGpsSourceId,
    derived: true,
  };

  const withoutDistance = journey.metrics.filter((metric) => metric.kind !== 'distance_m');
  return [...withoutDistance, nextMetric];
}

function sourceIsValid(journey: Journey, sourceId: string): boolean {
  return journey.sources.some(
    (source) => source.id === sourceId && source.kind === 'ninfit_phone_gps' && source.transportedBy === 'direct',
  );
}

/**
 * Integrates one live phone-GPS observation into an active Journey.
 *
 * Raw GPS quality is checked first. A later accepted sample must also form a plausible
 * segment from the last accepted point before it can influence route distance.
 * Rejected observations leave the Journey unchanged.
 */
export function ingestJourneyGpsSample(
  journey: Journey,
  sample: JourneyGpsSample,
  ids: JourneyGpsRuntimeIds,
  options: JourneyGpsIngestOptions = {},
): JourneyGpsRuntimeResult {
  if (journey.status !== 'recording') {
    return { accepted: false, journey, reason: 'journey_not_recording' };
  }

  if (!sourceIsValid(journey, ids.phoneGpsSourceId)) {
    throw new Error('Journey GPS runtime requires a direct ninfit_phone_gps source');
  }

  const acceptedPoints = journey.route?.acceptedPoints ?? [];
  const previousPoint = acceptedPoints[acceptedPoints.length - 1];
  const previousSample: JourneyGpsSample | null = previousPoint
    ? {
        latitude: previousPoint.latitude,
        longitude: previousPoint.longitude,
        accuracyM: previousPoint.accuracyM ?? 0,
        recordedAt: previousPoint.recordedAt,
      }
    : null;

  const quality = acceptJourneyGpsSample(sample, previousSample);
  if (!quality.accepted) {
    return { accepted: false, journey, reason: quality.reason };
  }

  const continuity = options.continuity ?? DEFAULT_JOURNEY_OBSERVATION_CONTINUITY_POLICY;

  let distanceAddedM = 0;
  /*
   * Whether the ground between the last accepted point and this one was WATCHED, which
   * is a different question from whether both endpoints are trustworthy. Both can be
   * perfectly good fixes with four minutes of unobserved walking between them.
   */
  let unobservedGap = false;
  if (previousSample) {
    const segment = evaluateJourneySegment(previousSample, sample);
    if (!segment.accepted) {
      return { accepted: false, journey, reason: segment.reason };
    }
    distanceAddedM = segment.distanceM;
    unobservedGap = segment.elapsedSeconds > continuity.maxObservationGapSeconds;
  }

  const point = toPoint(sample);
  const route = journey.route ?? { rawPoints: [], acceptedPoints: [] };
  const totalDistance = currentDistance(journey) + distanceAddedM;

  /*
   * Recorded only now, on the accepted path, and only against the index this point is
   * about to occupy. A route that already held points and no segmentation gains just
   * this one start - the earlier points were observed by a run nobody recorded, and
   * claiming index 0 for them would manufacture evidence of continuity that does not
   * exist.
   */
  const nextRoute: JourneyRoute = {
    rawPoints: [...route.rawPoints, point],
    acceptedPoints: [...route.acceptedPoints, point],
  };
  /*
   * DISTANCE IS DELIBERATELY NOT AFFECTED BY THE GAP.
   *
   * The two questions are separate and get separate answers. "Did they move from here
   * to there?" is answered by the speed gate above, which already refuses a teleport;
   * the displacement across a real gap is honest evidence of movement and is the
   * LOWEST distance that walk can have had, so dropping it would invent a shortfall
   * exactly as surely as drawing the line would invent a path. "Did we watch them do
   * it?" is answered here, and only presentation may read the answer.
   */
  const beginsObservedRun = options.startsNewSegment === true || unobservedGap;
  if (beginsObservedRun) {
    nextRoute.segmentStarts = [...(route.segmentStarts ?? []), route.acceptedPoints.length];
  } else if (route.segmentStarts !== undefined) {
    nextRoute.segmentStarts = [...route.segmentStarts];
  }

  const next: Journey = {
    ...journey,
    route: nextRoute,
    metrics: upsertDistanceMetric(journey, totalDistance, ids, sample.recordedAt),
    updatedAt: sample.recordedAt,
  };

  return { accepted: true, journey: next, distanceAddedM };
}
