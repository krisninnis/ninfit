import { describe, expect, it, vi } from 'vitest';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import type {
  JourneyLocationProvider,
  JourneyLocationProviderCallbacks,
} from '../app/journeyLocationProvider';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

function recordingJourney(): Journey {
  return {
    id: 'journey-quiesce',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-09-08T11:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-quiesce',
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
    createdAt: '2026-09-08T11:00:00.000Z',
    updatedAt: '2026-09-08T11:00:00.000Z',
  };
}

describe('Journey motion provider quiesce', () => {
  it('stops live callbacks but keeps trusted replay available until permanent stop', () => {
    const storage = createMemoryStorageAdapter();
    const journey = recordingJourney();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);

    let callbacks: JourneyLocationProviderCallbacks | null = null;
    const providerStop = vi.fn();
    const provider: JourneyLocationProvider = {
      kind: 'android_native',
      supportsBackground: true,
      start(next) {
        callbacks = next;
        return { stop: providerStop };
      },
    };

    const session = startJourneyMotionSession({
      storage,
      journey,
      provider,
      idFactory: () => 'distance-quiesce',
    });

    session.stopProvider();
    session.stopProvider();
    expect(providerStop).toHaveBeenCalledTimes(1);

    callbacks!.onSample({
      latitude: 51.5074,
      longitude: -3.5792,
      accuracyM: 5,
      recordedAt: '2026-09-08T11:00:01.000Z',
    });
    expect(session.getJourney().route).toBeUndefined();

    session.processSample({
      latitude: 51.5074,
      longitude: -3.5792,
      accuracyM: 5,
      recordedAt: '2026-09-08T11:00:01.000Z',
    });
    expect(session.getJourney().route?.acceptedPoints).toHaveLength(1);

    session.stop();
    expect(providerStop).toHaveBeenCalledTimes(1);
    expect(() => session.processSample({
      latitude: 51.5075,
      longitude: -3.5792,
      accuracyM: 5,
      recordedAt: '2026-09-08T11:00:02.000Z',
    })).toThrow('Journey motion session is stopped');
  });
});
