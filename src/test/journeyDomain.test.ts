import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOURNEY_PRIVACY,
  hasDistinctSourceIds,
  journeyActiveSeconds,
  journeyElapsedSeconds,
  journeyPausedSeconds,
  sourceForObservation,
  type Journey,
} from '../domain/journey';

function makeJourney(overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-08-23T10:00:00.000+01:00',
    pauses: [],
    metrics: [],
    sources: [],
    privacy: { ...DEFAULT_JOURNEY_PRIVACY },
    createdAt: '2026-08-23T10:00:00.000+01:00',
    updatedAt: '2026-08-23T10:00:00.000+01:00',
    ...overrides,
  };
}

describe('Journey domain foundation', () => {
  it('is private by default and does not cloud-sync precise routes', () => {
    expect(DEFAULT_JOURNEY_PRIVACY).toEqual({
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    });
  });

  it('measures elapsed wall-clock time independently of pauses', () => {
    const journey = makeJourney({ endedAt: '2026-08-23T10:20:45.900+01:00' });
    expect(journeyElapsedSeconds(journey)).toBe(1245);
  });

  it('counts only explicit pause intervals as paused time', () => {
    const journey = makeJourney({
      pauses: [
        {
          startedAt: '2026-08-23T10:05:00.000+01:00',
          endedAt: '2026-08-23T10:06:30.000+01:00',
        },
        {
          startedAt: '2026-08-23T10:10:00.000+01:00',
          endedAt: '2026-08-23T10:12:00.000+01:00',
        },
      ],
    });

    expect(journeyPausedSeconds(journey)).toBe(210);
  });

  it('can account for an open pause without mutating the Journey', () => {
    const journey = makeJourney({
      pauses: [{ startedAt: '2026-08-23T10:10:00.000+01:00' }],
    });

    expect(journeyPausedSeconds(journey, '2026-08-23T10:11:15.000+01:00')).toBe(75);
    expect(journey.pauses[0].endedAt).toBeUndefined();
  });

  it('derives active time as elapsed time minus explicit pauses', () => {
    const journey = makeJourney({
      endedAt: '2026-08-23T10:20:00.000+01:00',
      pauses: [
        {
          startedAt: '2026-08-23T10:05:00.000+01:00',
          endedAt: '2026-08-23T10:07:30.000+01:00',
        },
      ],
    });

    expect(journeyElapsedSeconds(journey)).toBe(1200);
    expect(journeyPausedSeconds(journey)).toBe(150);
    expect(journeyActiveSeconds(journey)).toBe(1050);
  });

  it('never produces negative elapsed or active time for malformed ordering', () => {
    const journey = makeJourney({
      endedAt: '2026-08-23T09:59:00.000+01:00',
      pauses: [
        {
          startedAt: '2026-08-23T10:05:00.000+01:00',
          endedAt: '2026-08-23T10:04:00.000+01:00',
        },
      ],
    });

    expect(journeyElapsedSeconds(journey)).toBe(0);
    expect(journeyPausedSeconds(journey)).toBe(0);
    expect(journeyActiveSeconds(journey)).toBe(0);
  });

  it('preserves source lineage for metric observations', () => {
    const source = {
      id: 'source-fitbit',
      kind: 'fitbit' as const,
      observedBy: 'Fitbit wearable',
      transportedBy: 'health_connect' as const,
      importedBy: 'ninfit' as const,
    };
    const observation = {
      id: 'metric-hr',
      kind: 'heart_rate_bpm' as const,
      value: 118,
      sourceId: source.id,
    };
    const journey = makeJourney({ sources: [source], metrics: [observation] });

    expect(sourceForObservation(journey, observation)).toEqual(source);
  });

  it('detects duplicate source ids without conflating duplicate workouts', () => {
    const source = {
      id: 'source-1',
      kind: 'ninfit_phone_gps' as const,
      observedBy: 'Android phone',
      transportedBy: 'direct' as const,
      importedBy: 'ninfit' as const,
    };

    expect(hasDistinctSourceIds(makeJourney({ sources: [source] }))).toBe(true);
    expect(hasDistinctSourceIds(makeJourney({ sources: [source, { ...source }] }))).toBe(false);
  });

  it('keeps raw GPS evidence separate from accepted route points', () => {
    const noisy = {
      latitude: 51.5,
      longitude: -3.6,
      recordedAt: '2026-08-23T10:00:01.000+01:00',
      accuracyM: 80,
    };
    const accepted = {
      latitude: 51.5001,
      longitude: -3.6001,
      recordedAt: '2026-08-23T10:00:05.000+01:00',
      accuracyM: 6,
    };
    const journey = makeJourney({
      route: { rawPoints: [noisy, accepted], acceptedPoints: [accepted] },
    });

    expect(journey.route?.rawPoints).toHaveLength(2);
    expect(journey.route?.acceptedPoints).toEqual([accepted]);
  });

  it('rejects invalid timestamps loudly instead of fabricating duration', () => {
    const journey = makeJourney({ startedAt: 'not-a-date' });
    expect(() => journeyElapsedSeconds(journey, '2026-08-23T10:01:00.000+01:00')).toThrow(
      'Invalid ISODateTime',
    );
  });
});
