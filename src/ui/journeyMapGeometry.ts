import type { FeatureCollection, LineString, Point } from 'geojson';
import type { JourneyGpsPoint } from '../domain/journey';

export function journeySegmentsGeoJson(
  segments: readonly (readonly JourneyGpsPoint[])[],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: segments
      .filter((segment) => segment.length >= 2)
      .map((segment, index) => ({
        type: 'Feature' as const,
        id: `journey-segment-${index}`,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: segment.map((point) => [point.longitude, point.latitude]),
        },
      })),
  };
}

export function journeyPointGeoJson(
  point: JourneyGpsPoint | null | undefined,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: point === null || point === undefined
      ? []
      : [{
          type: 'Feature',
          id: 'journey-latest-position',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
          },
        }],
  };
}
