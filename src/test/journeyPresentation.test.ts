import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import {
  formatJourneyDistance,
  formatJourneyDuration,
  journeyDistanceM,
  journeyGpsLabel,
  journeyGpsPresentationState,
} from '../ui/journeyPresentation';

function journey(): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-08-26T12:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-26T12:00:00.000Z',
    updatedAt: '2026-08-26T12:00:00.000Z',
  };
}

describe('active Journey presentation', () => {
  it('formats distance in kilometres without inventing precision beyond metres', () => {
    expect(formatJourneyDistance(0)).toBe('0.00');
    expect(formatJourneyDistance(1842)).toBe('1.84');
    expect(formatJourneyDistance(Number.NaN)).toBe('0.00');
  });

  it('formats active duration for short and hour-plus Journeys', () => {
    expect(formatJourneyDuration(0)).toBe('00:00');
    expect(formatJourneyDuration(1122)).toBe('18:42');
    expect(formatJourneyDuration(3723)).toBe('01:02:03');
  });

  it('reads the distance metric without treating a missing metric as anything but zero', () => {
    const value = journey();
    expect(journeyDistanceM(value)).toBe(0);
    value.metrics.push({
      id: 'distance-1',
      kind: 'distance_m',
      value: 1250,
      sourceId: 'gps-1',
      derived: true,
    });
    expect(journeyDistanceM(value)).toBe(1250);
  });

  it('shows stored GPS evidence only after a trusted accepted route point exists', () => {
    const value = journey();
    expect(journeyGpsPresentationState(value)).toBe('waiting');
    expect(journeyGpsLabel('waiting')).toBe('GPS waiting');

    value.route = {
      rawPoints: [],
      acceptedPoints: [
        {
          latitude: 51.5,
          longitude: -3.5,
          accuracyM: 5,
          recordedAt: '2026-08-26T12:00:05.000Z',
        },
      ],
    };

    expect(journeyGpsPresentationState(value)).toBe('receiving');
    expect(journeyGpsLabel('receiving')).toBe('GPS points saved');
  });
});
