import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Journey, JourneyGpsPoint } from '../domain/journey';
import { journeyTrustedRouteSegments } from '../domain/journeyRouteSegments';
import { journeySegmentsGeoJson } from './journeyMapGeometry';

type JourneyWithRoute = Pick<Journey, 'route'>;

export { journeyTrustedRouteSegments };

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
  return journeySegmentsGeoJson(journeyTrustedRouteSegments(journey));
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
