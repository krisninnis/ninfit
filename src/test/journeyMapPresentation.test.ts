import { describe, expect, it } from 'vitest';
import type { Journey, JourneyGpsPoint } from '../domain/journey';
import {
  journeyLatestTrustedPoint,
  journeyPositionGeoJson,
  journeyRouteGeoJson,
  journeyTrustedRouteSegments,
} from '../ui/journeyMapPresentation';

function point(latitude: number, longitude: number, recordedAt: string): JourneyGpsPoint {
  return { latitude, longitude, accuracyM: 5, recordedAt };
}

function journey(
  acceptedPoints: JourneyGpsPoint[],
  segmentStarts?: number[],
): Pick<Journey, 'route'> {
  return {
    route: {
      rawPoints: [...acceptedPoints],
      acceptedPoints,
      ...(segmentStarts === undefined ? {} : { segmentStarts }),
    },
  };
}

describe('Journey map presentation consumes trusted route truth', () => {
  const a = point(51.5000, -3.5000, '2026-08-27T12:00:00.000Z');
  const b = point(51.5001, -3.5000, '2026-08-27T12:00:10.000Z');
  const c = point(51.5002, -3.5000, '2026-08-27T12:00:20.000Z');
  const d = point(51.5010, -3.5010, '2026-08-27T12:10:00.000Z');
  const e = point(51.5011, -3.5010, '2026-08-27T12:10:10.000Z');

  it('draws separate recorded segments without connecting the observation gap', () => {
    const value = journey([a, b, c, d, e], [0, 3]);

    expect(journeyTrustedRouteSegments(value)).toEqual([[a, b, c], [d, e]]);
    expect(journeyRouteGeoJson(value).features.map((feature) => feature.geometry.coordinates)).toEqual([
      [[-3.5, 51.5], [-3.5, 51.5001], [-3.5, 51.5002]],
      [[-3.501, 51.501], [-3.501, 51.5011]],
    ]);
  });

  it('never invents continuity for legacy accepted points before the first recorded start', () => {
    const value = journey([a, b, c, d, e], [3]);

    expect(journeyTrustedRouteSegments(value)).toEqual([[d, e]]);
    expect(journeyRouteGeoJson(value).features).toHaveLength(1);
    expect(journeyRouteGeoJson(value).features[0]?.geometry.coordinates).toEqual([
      [-3.501, 51.501],
      [-3.501, 51.5011],
    ]);
  });

  it('draws no route line when segmentation evidence is absent', () => {
    const value = journey([a, b, c]);

    expect(journeyTrustedRouteSegments(value)).toEqual([]);
    expect(journeyRouteGeoJson(value).features).toEqual([]);
  });

  it('fails visually conservative when segment metadata is malformed in memory', () => {
    expect(journeyTrustedRouteSegments(journey([a, b, c], [0, 0]))).toEqual([]);
    expect(journeyTrustedRouteSegments(journey([a, b, c], [2, 1]))).toEqual([]);
    expect(journeyTrustedRouteSegments(journey([a, b, c], [5]))).toEqual([]);
  });

  it('keeps a one-point observed segment as truth but does not fabricate a line', () => {
    const value = journey([a], [0]);

    expect(journeyTrustedRouteSegments(value)).toEqual([[a]]);
    expect(journeyRouteGeoJson(value).features).toEqual([]);
  });

  it('uses the exact latest accepted coordinate for the trusted-position marker', () => {
    const value = journey([a, b, c]);

    expect(journeyLatestTrustedPoint(value)).toBe(c);
    expect(journeyPositionGeoJson(value).features[0]?.geometry.coordinates).toEqual([
      c.longitude,
      c.latitude,
    ]);
  });

  it('does not mutate trusted coordinates while preparing map data', () => {
    const points = [a, b, c, d, e];
    const before = structuredClone(points);

    journeyRouteGeoJson(journey(points, [0, 3]));
    journeyPositionGeoJson(journey(points, [0, 3]));

    expect(points).toEqual(before);
  });
});