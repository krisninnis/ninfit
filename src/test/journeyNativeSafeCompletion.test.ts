import { describe, expect, it, vi } from 'vitest';
import { completeJourneyAfterNativeReconciliation } from '../app/journeyNativeSafeCompletion';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import type { JourneyLocationProvider } from '../app/journeyLocationProvider';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { loadJourneyHistory } from '../storage/journeyHistory';

function recordingJourney(): Journey {
  return {
    id: 'journey-safe-finish',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-09-08T11:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-safe-finish',
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
      idFactory: () => 'distance-safe-finish',
    }),
    providerStop: stop,
  };
}

describe('durable-safe native Journey completion', () => {
  it('quiesces live GPS, drains and clears native fixes, then persists completion', async () => {
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
          timestampMs: Date.parse('2026-09-08T11:00:01.000Z'),
        }];
      },
      async acknowledgeThrough(_journeyId, sequence) {
        calls.push(`ack:${sequence}`);
      },
      async clear() {
        calls.push('clear');
      },
    };

    const result = await completeJourneyAfterNativeReconciliation({
      storage,
      session,
      queue,
      now: () => '2026-09-08T11:00:05.000Z',
    });

    expect(result.completed).toBe(true);
    expect(providerStop).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['read', 'ack:1', 'clear']);
    expect(loadActiveJourneySnapshot(storage)).toBeNull();
    const completed = loadJourneyHistory(storage)[0];
    expect(completed?.status).toBe('completed');
    expect(completed?.endedAt).toBe('2026-09-08T11:00:05.000Z');
    expect(completed?.route?.acceptedPoints).toHaveLength(1);
  });

  it('does not complete or clear the native queue when durable replay fails', async () => {
    const storage = createMemoryStorageAdapter();
    const { session, providerStop } = motionSession(storage);
    const clear = vi.fn(async () => undefined);
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() { throw new Error('native read failed'); },
      acknowledgeThrough: vi.fn(async () => undefined),
      clear,
    };

    const result = await completeJourneyAfterNativeReconciliation({
      storage,
      session,
      queue,
      now: () => '2026-09-08T11:00:05.000Z',
    });

    expect(result).toMatchObject({ completed: false, reason: 'replay_failed' });
    expect(providerStop).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    expect(loadJourneyHistory(storage)).toEqual([]);
    expect(loadActiveJourneySnapshot(storage)?.journey.status).toBe('recording');

    // The provider is frozen, but the motion session remains recoverable for a retry.
    expect(() => session.processSample({
      latitude: 51.5074,
      longitude: -3.5792,
      accuracyM: 5,
      recordedAt: '2026-09-08T11:00:01.000Z',
    })).not.toThrow();
  });
});
