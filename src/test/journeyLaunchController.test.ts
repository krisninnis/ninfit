import { describe, expect, it } from 'vitest';
import { createJourneyLaunchController } from '../app/journeyLaunchController';
import { sequentialIdFactory } from '../domain/ids';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

describe('Journey launch controller', () => {
  it('creates and persists a recording Journey with one direct phone GPS source', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyLaunchController(storage, sequentialIdFactory('journey'));
    const startedAt = '2026-08-26T15:00:00.000Z';

    const result = controller.start('walk', startedAt);

    expect(result.created).toBe(true);
    expect(result.journey).toMatchObject({
      id: 'journey-1',
      activityType: 'walk',
      status: 'recording',
      startedAt,
      createdAt: startedAt,
      updatedAt: startedAt,
      pauses: [],
      metrics: [],
    });
    expect(result.journey.sources).toEqual([
      {
        id: 'journey-2',
        kind: 'ninfit_phone_gps',
        observedBy: 'browser_geolocation',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ]);
    expect(result.journey.privacy).toEqual({
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    });
    expect(loadActiveJourneySnapshot(storage)?.journey).toEqual(result.journey);
  });

  it('returns existing recovery evidence rather than overwriting an unfinished Journey', () => {
    const storage = createMemoryStorageAdapter();
    const ids = sequentialIdFactory('journey');
    const controller = createJourneyLaunchController(storage, ids);
    const first = controller.start('walk', '2026-08-26T15:00:00.000Z');

    const second = controller.start('run', '2026-08-26T16:00:00.000Z');

    expect(second.created).toBe(false);
    expect(second.journey).toEqual(first.journey);
    expect(controller.loadActive()).toEqual(first.journey);
  });
});
