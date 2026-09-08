import { afterEach, describe, expect, it, vi } from 'vitest';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import {
  installNativeJourneyLocationBridge,
  resetJourneyLocationProviderRuntimeForTests,
} from '../app/journeyLocationProviderRuntime';
import type { NativeJourneyLocationBridge } from '../app/journeyNativeLocationProvider';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

afterEach(() => resetJourneyLocationProviderRuntimeForTests());

function recordingJourney(): Journey {
  return {
    id: 'journey-runtime-provider',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-09-08T10:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-source-runtime',
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
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
  };
}

describe('Journey motion runtime provider wiring', () => {
  it('uses the startup-installed native bridge when no provider is explicitly injected', () => {
    const storage = createMemoryStorageAdapter();
    const journey = recordingJourney();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);

    let nativeCallbacks: Parameters<NativeJourneyLocationBridge['start']>[0] | null = null;
    const nativeStop = vi.fn();
    const bridge: NativeJourneyLocationBridge = {
      platform: 'android',
      supportsLockedScreen: true,
      start(callbacks) {
        nativeCallbacks = callbacks;
        return { stop: nativeStop };
      },
    };
    const uninstall = installNativeJourneyLocationBridge(bridge);

    const session = startJourneyMotionSession({
      storage,
      journey,
      idFactory: () => 'distance-runtime',
    });

    expect(nativeCallbacks).not.toBeNull();
    nativeCallbacks!.onPosition({
      latitude: 51.5074,
      longitude: -3.5792,
      accuracyM: 5,
      timestampMs: Date.parse('2026-09-08T10:00:01.000Z'),
    });

    expect(session.getJourney().route?.acceptedPoints).toHaveLength(1);

    session.stop();
    uninstall();
    expect(nativeStop).toHaveBeenCalledTimes(1);
  });
});
