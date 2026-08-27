import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import {
  journeyActivityLabel,
  journeyDetailFacts,
  journeyPrivacyLabel,
} from '../ui/journeyDetailPresentation';

function journey(overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'Journey-MixedCase-1',
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-08-27T10:00:00.000Z',
    endedAt: '2026-08-27T10:30:00.000Z',
    pauses: [{
      startedAt: '2026-08-27T10:10:00.000Z',
      endedAt: '2026-08-27T10:12:00.000Z',
    }],
    route: undefined,
    metrics: [{
      id: 'distance',
      kind: 'distance_m',
      value: 3200,
      sourceId: 'phone',
      derived: true,
    }],
    sources: [{
      id: 'phone',
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:30:00.000Z',
    ...overrides,
  };
}

describe('Journey detail presentation', () => {
  it('uses authoritative stored distance and pause-aware timing', () => {
    expect(journeyDetailFacts(journey())).toEqual({
      distanceM: 3200,
      elapsedSeconds: 1800,
      pausedSeconds: 120,
      activeSeconds: 1680,
      distanceSource: 'NinFit phone GPS',
    });
  });

  it('does not invent a distance source when no distance observation exists', () => {
    expect(journeyDetailFacts(journey({ metrics: [] })).distanceSource).toBeNull();
  });

  it('labels the existing activity identities without changing the domain', () => {
    expect(journeyActivityLabel('walk')).toBe('Walk');
    expect(journeyActivityLabel('swim')).toBe('Swim');
    expect(journeyActivityLabel('other')).toBe('Journey');
  });

  it('describes privacy without changing it', () => {
    expect(journeyPrivacyLabel(journey())).toBe('Private on this device');
    expect(journeyPrivacyLabel(journey({
      privacy: {
        visibility: 'masked_route',
        maskSensitiveStartEnd: false,
        preciseRouteCloudSync: false,
      },
    }))).toBe('Route masking enabled for disclosure');
  });
});
