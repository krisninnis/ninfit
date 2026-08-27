import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOURNEY_ROUTE_MASK_RADIUS_M,
  projectJourneyRouteForDisclosure,
} from '../domain/journeyRoutePrivacy';
import type { Journey, JourneyGpsPoint, JourneyVisibility } from '../domain/journey';

function point(latitude: number, longitude: number, second: number): JourneyGpsPoint {
  return {
    latitude,
    longitude,
    recordedAt: `2026-08-27T12:00:${String(second).padStart(2, '0')}.000Z`,
    accuracyM: 5,
  };
}

function journey(
  acceptedPoints: JourneyGpsPoint[],
  visibility: JourneyVisibility,
  options: { segmentStarts?: number[]; maskSensitiveStartEnd?: boolean } = {},
): Pick<Journey, 'route' | 'privacy'> {
  return {
    route: {
      rawPoints: [...acceptedPoints],
      acceptedPoints,
      ...(options.segmentStarts === undefined ? {} : { segmentStarts: options.segmentStarts }),
    },
    privacy: {
      visibility,
      maskSensitiveStartEnd: options.maskSensitiveStartEnd ?? true,
      preciseRouteCloudSync: false,
    },
  };
}

describe('Journey route privacy projection', () => {
  // About 111 m of latitude per 0.001 degrees here. These points deliberately make
  // the default 200 m mask easy to reason about without coupling tests to GPS noise.
  const p0 = point(51.5000, -3.5000, 0);
  const p1 = point(51.5010, -3.5000, 1);
  const p2 = point(51.5030, -3.5000, 2);
  const p3 = point(51.5060, -3.5000, 3);
  const p4 = point(51.5090, -3.5000, 4);
  const p5 = point(51.5110, -3.5000, 5);
  const p6 = point(51.5120, -3.5000, 6);

  it('keeps precise coordinates undisclosed for private and summary-only Journeys', () => {
    for (const visibility of ['private', 'summary_only'] as const) {
      expect(projectJourneyRouteForDisclosure(journey([p0, p1, p2], visibility, { segmentStarts: [0] }))).toEqual({
        segments: [],
        masked: false,
        hiddenPointCount: 0,
      });
    }
  });

  it('masks both sensitive endpoints without changing the trusted route', () => {
    const value = journey([p0, p1, p2, p3, p4, p5, p6], 'masked_route', { segmentStarts: [0] });
    const before = structuredClone(value.route?.acceptedPoints);

    const projected = projectJourneyRouteForDisclosure(value);

    expect(DEFAULT_JOURNEY_ROUTE_MASK_RADIUS_M).toBe(200);
    expect(projected.masked).toBe(true);
    expect(projected.hiddenPointCount).toBe(4);
    expect(projected.segments).toEqual([[p2, p3, p4]]);
    expect(value.route?.acceptedPoints).toEqual(before);
  });

  it('never weakens masked_route when the independent start/end flag is false', () => {
    const value = journey([p0, p1, p2, p3, p4, p5, p6], 'masked_route', {
      segmentStarts: [0],
      maskSensitiveStartEnd: false,
    });

    expect(projectJourneyRouteForDisclosure(value).segments).toEqual([[p2, p3, p4]]);
  });

  it('allows full_route only when start/end masking is explicitly disabled', () => {
    const value = journey([p0, p1, p2], 'full_route', {
      segmentStarts: [0],
      maskSensitiveStartEnd: false,
    });

    expect(projectJourneyRouteForDisclosure(value)).toEqual({
      segments: [[p0, p1, p2]],
      masked: false,
      hiddenPointCount: 0,
    });
  });

  it('preserves observation gaps while masking', () => {
    const value = journey([p0, p1, p2, p3, p4, p5, p6], 'masked_route', {
      segmentStarts: [0, 4],
    });

    expect(projectJourneyRouteForDisclosure(value).segments).toEqual([[p2, p3], [p4]]);
  });

  it('splits a visible run instead of drawing across a hidden return to the start zone', () => {
    const away1 = point(51.5030, -3.5000, 10);
    const away2 = point(51.5060, -3.5000, 11);
    const returnsNearStart = point(51.5005, -3.5000, 12);
    const away3 = point(51.5070, -3.5000, 13);
    const farEnd = point(51.5100, -3.5000, 14);
    const value = journey(
      [p0, away1, away2, returnsNearStart, away3, farEnd],
      'masked_route',
      { segmentStarts: [0] },
    );

    expect(projectJourneyRouteForDisclosure(value).segments).toEqual([[away1, away2], [away3]]);
  });

  it('shows no geometry when masking consumes a short route', () => {
    const short1 = point(51.5005, -3.5000, 20);
    const short2 = point(51.5010, -3.5000, 21);
    expect(
      projectJourneyRouteForDisclosure(
        journey([p0, short1, short2], 'masked_route', { segmentStarts: [0] }),
      ).segments,
    ).toEqual([]);
  });

  it('stays conservative when segmentation evidence is absent or malformed', () => {
    expect(projectJourneyRouteForDisclosure(journey([p0, p2, p4], 'masked_route')).segments).toEqual([]);
    expect(
      projectJourneyRouteForDisclosure(
        journey([p0, p2, p4], 'masked_route', { segmentStarts: [0, 0] }),
      ).segments,
    ).toEqual([]);
  });

  it('rejects invalid mask radii rather than silently disabling privacy', () => {
    const value = journey([p0, p2, p4], 'masked_route', { segmentStarts: [0] });
    expect(() => projectJourneyRouteForDisclosure(value, 0)).toThrow('positive finite');
    expect(() => projectJourneyRouteForDisclosure(value, Number.NaN)).toThrow('positive finite');
  });
});
