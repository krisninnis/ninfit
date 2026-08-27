import type { Journey, JourneyGpsPoint } from './journey';

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
 * Missing or malformed segmentation never becomes invented continuity.
 */
export function journeyTrustedRouteSegments(journey: JourneyWithRoute): JourneyGpsPoint[][] {
  const points = journey.route?.acceptedPoints ?? [];
  const starts = validSegmentStarts(points, journey.route?.segmentStarts);
  if (starts === null) return [];

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? points.length;
    return points.slice(start, end);
  });
}
