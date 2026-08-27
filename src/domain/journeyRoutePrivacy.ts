import type { Journey, JourneyGpsPoint, JourneyPrivacy } from './journey';
import { journeyTrustedRouteSegments } from './journeyRouteSegments';

export const DEFAULT_JOURNEY_ROUTE_MASK_RADIUS_M = 200;

type JourneyForRoutePrivacy = Pick<Journey, 'route' | 'privacy'>;

export interface JourneyRoutePrivacyProjection {
  segments: JourneyGpsPoint[][];
  masked: boolean;
  hiddenPointCount: number;
}

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function distanceBetweenM(a: JourneyGpsPoint, b: JourneyGpsPoint): number {
  const earthRadiusM = 6_371_000;
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(b.longitude - a.longitude);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeMayBeDisclosed(privacy: JourneyPrivacy): boolean {
  return privacy.visibility === 'masked_route' || privacy.visibility === 'full_route';
}

function shouldMask(privacy: JourneyPrivacy): boolean {
  return privacy.visibility === 'masked_route' || privacy.maskSensitiveStartEnd;
}

/**
 * Builds route geometry that is safe to use outside the private recorder experience.
 *
 * This is a projection only. It never edits acceptedPoints, segmentStarts, metrics or
 * authoritative distance. Private/summary-only Journeys disclose no coordinates.
 *
 * Masking removes points within the privacy radius of either true accepted endpoint.
 * If a route later passes back through either sensitive zone, the visible run is split
 * rather than drawing a straight line across coordinates that were deliberately hidden.
 */
export function projectJourneyRouteForDisclosure(
  journey: JourneyForRoutePrivacy,
  radiusM: number = DEFAULT_JOURNEY_ROUTE_MASK_RADIUS_M,
): JourneyRoutePrivacyProjection {
  if (!routeMayBeDisclosed(journey.privacy)) {
    return { segments: [], masked: false, hiddenPointCount: 0 };
  }

  const segments = journeyTrustedRouteSegments(journey);
  if (!shouldMask(journey.privacy)) {
    return { segments, masked: false, hiddenPointCount: 0 };
  }

  if (!Number.isFinite(radiusM) || radiusM <= 0) {
    throw new Error('Journey route mask radius must be a positive finite number');
  }

  const accepted = journey.route?.acceptedPoints ?? [];
  const start = accepted[0];
  const end = accepted.at(-1);
  if (start === undefined || end === undefined) {
    return { segments: [], masked: true, hiddenPointCount: 0 };
  }

  let hiddenPointCount = 0;
  const visibleSegments: JourneyGpsPoint[][] = [];

  for (const segment of segments) {
    let run: JourneyGpsPoint[] = [];
    for (const point of segment) {
      const hidden = distanceBetweenM(point, start) < radiusM || distanceBetweenM(point, end) < radiusM;
      if (hidden) {
        hiddenPointCount += 1;
        if (run.length > 0) {
          visibleSegments.push(run);
          run = [];
        }
      } else {
        run.push(point);
      }
    }
    if (run.length > 0) visibleSegments.push(run);
  }

  return {
    segments: visibleSegments,
    masked: true,
    hiddenPointCount,
  };
}
