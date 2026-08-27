import { describe, expect, it } from 'vitest';
import type { Journey, JourneyGpsPoint, JourneyVisibility } from '../domain/journey';
import {
  journeyPostcardModel,
  journeyPostcardRouteMessage,
} from '../ui/journeyPostcardPresentation';

function point(latitude: number, longitude: number, second: number): JourneyGpsPoint {
  return {
    latitude,
    longitude,
    recordedAt: `2026-08-27T10:00:${String(second).padStart(2, '0')}.000Z`,
    accuracyM: 5,
  };
}

function journey(
  visibility: JourneyVisibility,
  options: { maskSensitiveStartEnd?: boolean } = {},
): Journey {
  const points = [
    point(51.5000, -3.5000, 0),
    point(51.5010, -3.5000, 1),
    point(51.5030, -3.5000, 2),
    point(51.5060, -3.5000, 3),
    point(51.5090, -3.5000, 4),
    point(51.5110, -3.5000, 5),
    point(51.5120, -3.5000, 6),
  ];

  return {
    id: 'Journey-Postcard-1',
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-08-27T10:00:00.000Z',
    endedAt: '2026-08-27T10:30:00.000Z',
    pauses: [],
    route: {
      rawPoints: [...points],
      acceptedPoints: points,
      segmentStarts: [0],
    },
    metrics: [{
      id: 'distance',
      kind: 'distance_m',
      value: 4200,
      sourceId: 'phone',
    }],
    sources: [{
      id: 'phone',
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: {
      visibility,
      maskSensitiveStartEnd: options.maskSensitiveStartEnd ?? true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:30:00.000Z',
  };
}

describe('Journey Postcard privacy-safe model', () => {
  it('never exposes route geometry for private Journeys', () => {
    const postcard = journeyPostcardModel(journey('private'));
    expect(postcard.routeState).toBe('private');
    expect(postcard.route.segments).toEqual([]);
    expect(journeyPostcardRouteMessage(postcard.routeState)).toContain('private');
  });

  it('never exposes route geometry for summary-only Journeys', () => {
    const postcard = journeyPostcardModel(journey('summary_only'));
    expect(postcard.routeState).toBe('summary_only');
    expect(postcard.route.segments).toEqual([]);
  });

  it('uses the dedicated masking projection for masked-route Journeys', () => {
    const postcard = journeyPostcardModel(journey('masked_route'));
    expect(postcard.routeState).toBe('masked');
    expect(postcard.route.masked).toBe(true);
    expect(postcard.route.hiddenPointCount).toBeGreaterThan(0);
    expect(postcard.route.segments).toHaveLength(1);
    expect(postcard.route.segments[0]?.[0]?.latitude).toBe(51.503);
  });

  it('allows a full route only when the saved privacy settings allow it', () => {
    const postcard = journeyPostcardModel(
      journey('full_route', { maskSensitiveStartEnd: false }),
    );
    expect(postcard.routeState).toBe('full');
    expect(postcard.route.masked).toBe(false);
    expect(postcard.route.segments[0]).toHaveLength(7);
  });

  it('keeps summary fitness facts truthful and independent of route disclosure', () => {
    const postcard = journeyPostcardModel(journey('private'));
    expect(postcard.activityLabel).toBe('Walk');
    expect(postcard.distanceM).toBe(4200);
    expect(postcard.activeSeconds).toBe(1800);
    expect(postcard.completedAt).toBe('2026-08-27T10:30:00.000Z');
  });
});
