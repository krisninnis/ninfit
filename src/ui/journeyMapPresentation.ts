import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Journey, JourneyGpsPoint } from '../domain/journey';

type JourneyWithRoute = Pick<Journey, 'route'>;

function validSegmentStarts(
  points: readonly JourneyGpsPoint[],
  starts: readonly number[] | undefined,
): readonly number[] | null {
  if (starts === undefined || starts.length === 0) return null;

  let previous = -1;
  for (const start of starts) {
    if (!Number.isInteger(start) || start < 0 || start >= points.length || start <= previous) {
      return null;
    }
    previous = start;
  }

  return starts;
}

/**
 * Returns only route runs for which NinFit has explicit observation-boundary evidence.
 *
 * Legacy accepted points that predate `segmentStarts` stay trusted points, but they
 * are not silently connected into a line. If a legacy Journey later gains a recorded
 * start at index 3, only points 3 onward are drawable until another start is recorded.
 */
export function journeyTrustedRouteSegments(
  journey: JourneyWithRoute,
): JourneyGpsPoint[][] {
  const points = journey.route?.acceptedPoints ?? [];
  const starts = validSegmentStarts(points, journey.route?.segmentStarts);
  if (starts === null) return [];

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? points.length;
    return points.slice(start, end);
  });
}

/** Latest trusted stored position. This says nothing about whether GPS is live now. */
export function journeyLatestTrustedPoint(
  journey: JourneyWithRoute,
): JourneyGpsPoint | null {
  const points = journey.route?.acceptedPoints ?? [];
  return points.at(-1) ?? null;
}

export function journeyRouteGeoJson(
  journey: JourneyWithRoute,
): FeatureCollection<LineString> {
  const features = journeyTrustedRouteSegments(journey)
    .filter((segment) => segment.length >= 2)
    .map((segment, index) => ({
      type: 'Feature' as const,
      id: `journey-segment-${index}`,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: segment.map((point) => [point.longitude, point.latitude]),
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function journeyPositionGeoJson(
  journey: JourneyWithRoute,
): FeatureCollection<Point> {
  const latest = journeyLatestTrustedPoint(journey);

  return {
    type: 'FeatureCollection',
    features: latest === null
      ? []
      : [
          {
            type: 'Feature',
            id: 'journey-latest-position',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [latest.longitude, latest.latitude],
            },
          },
        ],
  };
}