import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import { ingestJourneyGpsSample } from '../domain/journeyGpsRuntime';
import { createJourneyGpsRuntimeController } from '../app/journeyGpsRuntimeController';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

const ids = { phoneGpsSourceId: 'source-phone', distanceMetricId: 'metric-distance' };

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status,
    startedAt: '2026-08-25T12:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [
      {
        id: ids.phoneGpsSourceId,
        kind: 'ninfit_phone_gps',
        observedBy: 'phone',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
  };
}

function sample(latitude: number, recordedAt: string, accuracyM = 5) {
  return { latitude, longitude: -0.1278, accuracyM, recordedAt };
}

describe('live Journey GPS runtime', () => {
  it('accepts the first trustworthy point and creates a zero distance metric', () => {
    const result = ingestJourneyGpsSample(
      journey(),
      sample(51.5074, '2026-08-25T12:00:05.000Z'),
      ids,
    );

    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.journey.route?.acceptedPoints).toHaveLength(1);
      expect(result.journey.metrics.find((metric) => metric.kind === 'distance_m')?.value).toBe(0);
    }
  });

  it('adds plausible segment distance to the derived distance metric', () => {
    const first = ingestJourneyGpsSample(
      journey(),
      sample(51.5074, '2026-08-25T12:00:05.000Z'),
      ids,
    );
    if (!first.accepted) throw new Error('first sample should be accepted');

    const second = ingestJourneyGpsSample(
      first.journey,
      sample(51.5079, '2026-08-25T12:01:05.000Z'),
      ids,
    );

    expect(second.accepted).toBe(true);
    if (second.accepted) {
      expect(second.distanceAddedM).toBeGreaterThan(50);
      expect(second.journey.route?.acceptedPoints).toHaveLength(2);
      expect(second.journey.metrics.find((metric) => metric.kind === 'distance_m')?.value).toBeGreaterThan(50);
    }
  });

  it('rejects low-quality samples without mutating route or distance', () => {
    const active = journey();
    const result = ingestJourneyGpsSample(
      active,
      sample(51.5074, '2026-08-25T12:00:05.000Z', 80),
      ids,
    );

    expect(result).toEqual({ accepted: false, journey: active, reason: 'accuracy_too_low' });
    expect(active.route).toBeUndefined();
  });

  it('rejects impossible jumps without advancing accepted route state', () => {
    const first = ingestJourneyGpsSample(
      journey(),
      sample(51.5074, '2026-08-25T12:00:05.000Z'),
      ids,
    );
    if (!first.accepted) throw new Error('first sample should be accepted');

    const jump = ingestJourneyGpsSample(
      first.journey,
      sample(52.5074, '2026-08-25T12:00:10.000Z'),
      ids,
    );

    expect(jump.accepted).toBe(false);
    if (!jump.accepted) expect(jump.reason).toBe('impossible_speed');
    expect(jump.journey.route?.acceptedPoints).toHaveLength(1);
  });

  it('does not collect GPS while explicitly paused', () => {
    const paused = journey('paused');
    const result = ingestJourneyGpsSample(
      paused,
      sample(51.5074, '2026-08-25T12:00:05.000Z'),
      ids,
    );
    expect(result).toEqual({ accepted: false, journey: paused, reason: 'journey_not_recording' });
  });

  it('persists accepted live updates to the recovery slot', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyGpsRuntimeController(storage, ids);
    const result = controller.ingest(
      journey(),
      sample(51.5074, '2026-08-25T12:00:05.000Z'),
    );

    expect(result.accepted).toBe(true);
    expect(loadActiveJourneySnapshot(storage)?.journey.route?.acceptedPoints).toHaveLength(1);
  });

  it('does not replace recovery state for a rejected observation', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyGpsRuntimeController(storage, ids);
    const first = controller.ingest(
      journey(),
      sample(51.5074, '2026-08-25T12:00:05.000Z'),
    );
    if (!first.accepted) throw new Error('first sample should be accepted');

    controller.ingest(
      first.journey,
      sample(51.5075, '2026-08-25T12:00:06.000Z', 90),
    );

    expect(loadActiveJourneySnapshot(storage)?.journey).toEqual(first.journey);
  });
});
