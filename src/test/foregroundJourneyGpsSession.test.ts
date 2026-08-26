import { describe, expect, it, vi } from 'vitest';
import { startForegroundJourneyGpsSession } from '../app/foregroundJourneyGpsSession';
import type { JourneyGeolocationAdapterOptions } from '../app/journeyGeolocationAdapter';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status,
    startedAt: '2026-08-26T15:00:00.000Z',
    pauses: status === 'paused' ? [{ startedAt: '2026-08-26T15:05:00.000Z' }] : [],
    metrics: [],
    sources: [
      {
        id: 'gps-source-1',
        kind: 'ninfit_phone_gps',
        observedBy: 'browser_geolocation',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-26T15:00:00.000Z',
    updatedAt: '2026-08-26T15:00:00.000Z',
  };
}

describe('foreground Journey GPS session', () => {
  it('feeds accepted samples through the runtime and recovery persistence', () => {
    const storage = createMemoryStorageAdapter();
    const initial = journey();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);
    let adapterOptions: JourneyGeolocationAdapterOptions | undefined;
    const stop = vi.fn();
    const changed = vi.fn();

    const session = startForegroundJourneyGpsSession({
      storage,
      journey: initial,
      idFactory: () => 'distance-1',
      startWatch(options) {
        adapterOptions = options;
        return { stop };
      },
      onJourneyChanged: changed,
    });

    adapterOptions?.onSample({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-08-26T15:00:05.000Z',
    });

    const current = session.getJourney();
    expect(current.route?.acceptedPoints).toHaveLength(1);
    expect(current.metrics.find((metric) => metric.kind === 'distance_m')).toMatchObject({
      id: 'distance-1',
      value: 0,
      sourceId: 'gps-source-1',
    });
    expect(loadActiveJourneySnapshot(storage)?.journey).toEqual(current);
    expect(changed).toHaveBeenCalledWith(current);
  });

  it('reuses an existing distance observation id after recovery', () => {
    const storage = createMemoryStorageAdapter();
    const initial: Journey = {
      ...journey(),
      metrics: [
        {
          id: 'stored-distance',
          kind: 'distance_m',
          value: 100,
          observedAt: '2026-08-26T15:01:00.000Z',
          sourceId: 'gps-source-1',
          derived: true,
        },
      ],
      route: {
        rawPoints: [
          { latitude: 51.5, longitude: -3.5, accuracyM: 5, recordedAt: '2026-08-26T15:01:00.000Z' },
        ],
        acceptedPoints: [
          { latitude: 51.5, longitude: -3.5, accuracyM: 5, recordedAt: '2026-08-26T15:01:00.000Z' },
        ],
      },
    };
    let adapterOptions: JourneyGeolocationAdapterOptions | undefined;

    startForegroundJourneyGpsSession({
      storage,
      journey: initial,
      idFactory: () => 'should-not-be-used',
      startWatch(options) {
        adapterOptions = options;
        return { stop: vi.fn() };
      },
    });

    adapterOptions?.onSample({
      latitude: 51.5001,
      longitude: -3.5001,
      accuracyM: 5,
      recordedAt: '2026-08-26T15:01:10.000Z',
    });

    expect(loadActiveJourneySnapshot(storage)?.journey.metrics).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'stored-distance', kind: 'distance_m' })]),
    );
  });

  it('refuses to start a watcher while the Journey is paused', () => {
    const startWatch = vi.fn();
    expect(() =>
      startForegroundJourneyGpsSession({
        storage: createMemoryStorageAdapter(),
        journey: journey('paused'),
        startWatch,
      }),
    ).toThrow('Foreground GPS can only start for a recording Journey');
    expect(startWatch).not.toHaveBeenCalled();
  });
});
