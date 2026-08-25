import type { JourneyGpsSample } from './journeyGps';

export type JourneySegmentRejectionReason =
  | 'non_forward_time'
  | 'impossible_speed';

export type JourneySegmentResult =
  | {
      accepted: true;
      distanceM: number;
      elapsedSeconds: number;
      speedMps: number;
    }
  | { accepted: false; reason: JourneySegmentRejectionReason };

export interface JourneySegmentPolicy {
  maxSpeedMps: number;
}

// Conservative walking/running/cycling ceiling for v1. Activity-specific policies can follow.
export const DEFAULT_JOURNEY_SEGMENT_POLICY: JourneySegmentPolicy = {
  maxSpeedMps: 20,
};

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function greatCircleDistanceM(
  from: Pick<JourneyGpsSample, 'latitude' | 'longitude'>,
  to: Pick<JourneyGpsSample, 'latitude' | 'longitude'>,
): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Evaluates a segment only after both endpoint samples have passed the GPS acceptance gate.
 * Rejected segments contribute zero distance and must not move the distance anchor forward.
 */
export function evaluateJourneySegment(
  from: JourneyGpsSample,
  to: JourneyGpsSample,
  policy: JourneySegmentPolicy = DEFAULT_JOURNEY_SEGMENT_POLICY,
): JourneySegmentResult {
  const fromMs = Date.parse(from.recordedAt);
  const toMs = Date.parse(to.recordedAt);
  const elapsedSeconds = (toMs - fromMs) / 1000;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return { accepted: false, reason: 'non_forward_time' };
  }

  const distanceM = greatCircleDistanceM(from, to);
  const speedMps = distanceM / elapsedSeconds;

  if (!Number.isFinite(speedMps) || speedMps > policy.maxSpeedMps) {
    return { accepted: false, reason: 'impossible_speed' };
  }

  return { accepted: true, distanceM, elapsedSeconds, speedMps };
}

export function accumulateJourneyDistanceM(samples: JourneyGpsSample[]): number {
  if (samples.length < 2) return 0;

  let total = 0;
  let anchor = samples[0];

  for (const candidate of samples.slice(1)) {
    const segment = evaluateJourneySegment(anchor, candidate);
    if (segment.accepted) {
      total += segment.distanceM;
      anchor = candidate;
    }
  }

  return total;
}
