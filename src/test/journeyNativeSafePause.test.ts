import { describe, expect, it, vi } from 'vitest';
import { pauseJourneyAfterNativeReconciliation } from '../app/journeyNativeSafePause';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import type { JourneyLocationProvider } from '../app/journeyLocationProvider';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { loadJourneyPauseOrigin } from '../storage/journeyPauseProvenance';

function recordingJourney(): Journey {
  return {
    id: 'journey-safe-pause',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-09-08T12:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-safe-pause',
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
    createdAt: '2026-09-08T12:00:00.000Z',
    updatedAt: '2026-09-08T12:00:00.000Z',
  };
}

function motionSession(storage: ReturnType<typeof createMemoryStorageAdapter>) {
  const journey = recordingJourney();
  saveActiveJourneySnapshot(storage, journey, journey.startedAt);
  const stop = vi.fn();
  const provider: JourneyLocationProvider = {
    kind: 'android_native',
    supportsBackground: true,
    start() { return { stop }; },
  };
  return {
    session: startJourneyMotionSession({
      storage,
      journey,
      provider,
      idFactory: () => 'distance-safe-pause',
    }),
    providerStop: stop,
  };
}

describe('durable-safe native Journey manual pause', () => {
  it('quiesces GPS, replays and clears the native suffix, then persists manual pause', async () => {
    const storage = createMemoryStorageAdapter();
    const { session, providerStop } = motionSession(storage);
    const calls: string[] = [];
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        calls.push('read');
        return [{
          sequence: 1,
          latitude: 51.5074,
          longitude: -3.5792,
          accuracyM: 5,
          timestampMs: Date.parse('2026-09-08T12:00:01.000Z'),
        }];
      },
      async acknowledgeThrough(_journeyId, sequence) { calls.push(`ack:${sequence}`); },
      async clear() { calls.push('clear'); },
    };

    const result = await pauseJourneyAfterNativeReconciliation({
      storage,
      session,
      queue,
      now: () => '2026-09-08T12:00:05.000Z',
    });

    expect(result.paused).toBe(true);
    expect(providerStop).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['read', 'ack:1', 'clear']);
    const active = loadActiveJourneySnapshot(storage)?.journey;
    expect(active?.status).toBe('paused');
    expect(active?.route?.acceptedPoints).toHaveLength(1);
    expect(loadJourneyPauseOrigin(storage, 'journey-safe-pause')).toBe('manual');
  });

  it('keeps explicit manual authority when replay itself reaches auto-pause', async () => {
    const storage = createMemoryStorageAdapter();
    const { session } = motionSession(storage);
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        return [
          {
            sequence: 1,
            latitude: 51.5074,
            longitude: -3.5792,
            accuracyM: 5,
            timestampMs: Date.parse('2026-09-08T12:00:01.000Z'),
          },
          {
            sequence: 2,
            latitude: 51.5074,
            longitude: -3.5792,
            accuracyM: 5,
            timestampMs: Date.parse('2026-09-08T12:00:06.000Z'),
          },
        ];
      },
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };

    const result = await pauseJourneyAfterNativeReconciliation({
      storage,
      session,
      queue,
      now: () => '2026-09-08T12:00:07.000Z',
    });

    expect(result.paused).toBe(true);
    if (!result.paused) throw new Error('expected pause success');
    expect(result.journey.status).toBe('paused');
    expect(result.journey.pauses).toHaveLength(1);
    expect(loadJourneyPauseOrigin(storage, 'journey-safe-pause')).toBe('manual');
  });

  it('does not pause or clear the queue when durable replay fails', async () => {
    const storage = createMemoryStorageAdapter();
    const { session, providerStop } = motionSession(storage);
    const clear = vi.fn(async () => undefined);
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() { throw new Error('native read failed'); },
      acknowledgeThrough: vi.fn(async () => undefined),
      clear,
    };

    const result = await pauseJourneyAfterNativeReconciliation({
      storage,
      session,
      queue,
      now: () => '2026-09-08T12:00:05.000Z',
    });

    expect(result).toMatchObject({ paused: false, reason: 'replay_failed' });
    expect(providerStop).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    expect(loadActiveJourneySnapshot(storage)?.journey.status).toBe('recording');
  });
});
