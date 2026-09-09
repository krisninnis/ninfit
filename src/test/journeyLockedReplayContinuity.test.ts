import { describe, expect, it, vi } from 'vitest';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import type { JourneyLocationProvider } from '../app/journeyLocationProvider';
import { createJourneyNativeReplayMotionProcessor } from '../app/journeyNativeReplayMotionProcessor';
import {
  createNativeJourneyPositionBuffer,
  type NativeJourneyPositionBufferSnapshot,
} from '../app/journeyNativePositionBuffer';
import { replayNativeJourneyPositions } from '../app/journeyNativePositionReplay';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

function recordingWalk(): Journey {
  return {
    id: 'locked-walk-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-09-09T12:00:00.000Z',
    pauses: [],
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
    createdAt: '2026-09-09T12:00:00.000Z',
    updatedAt: '2026-09-09T12:00:00.000Z',
  };
}

function silentProvider(): JourneyLocationProvider {
  return {
    kind: 'browser',
    supportsBackground: false,
    start() {
      return { stop: vi.fn() };
    },
  };
}

describe('locked-screen durable replay continuity', () => {
  it('reconstructs auto-pause and auto-resume from historical fix timestamps after the WebView wakes', () => {
    const storage = createMemoryStorageAdapter();
    const initial = recordingWalk();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);

    const session = startJourneyMotionSession({
      storage,
      journey: initial,
      provider: silentProvider(),
      idFactory: () => 'distance-1',
    });

    const durable: { snapshot: NativeJourneyPositionBufferSnapshot | null } = { snapshot: null };
    const buffer = createNativeJourneyPositionBuffer({
      journeyId: initial.id,
      store: {
        load() { return durable.snapshot ? structuredClone(durable.snapshot) : null; },
        save(next) { durable.snapshot = structuredClone(next); },
        remove() { durable.snapshot = null; },
      },
    });

    // These observations represent fixes captured natively while the WebView is asleep.
    // Replay happens later, but the domain transitions must use the original fix times.
    for (const fix of [
      { latitude: 51.50000, longitude: -3.50000, accuracyM: 5, timestampMs: Date.parse('2026-09-09T12:00:01.000Z') },
      { latitude: 51.50000, longitude: -3.50000, accuracyM: 5, timestampMs: Date.parse('2026-09-09T12:00:06.000Z') },
      { latitude: 51.50007, longitude: -3.50000, accuracyM: 5, timestampMs: Date.parse('2026-09-09T12:00:07.000Z') },
      { latitude: 51.50008, longitude: -3.50000, accuracyM: 5, timestampMs: Date.parse('2026-09-09T12:00:08.000Z') },
    ]) {
      buffer.append(fix);
    }

    const result = replayNativeJourneyPositions({
      buffer,
      processor: createJourneyNativeReplayMotionProcessor(session),
    });

    expect(result.processed).toBe(4);
    expect(result.stoppedAtSequence).toBeNull();
    expect(buffer.pending()).toEqual([]);

    const reconstructed = session.getJourney();
    expect(reconstructed.status).toBe('recording');
    expect(reconstructed.pauses).toEqual([
      {
        startedAt: '2026-09-09T12:00:06.000Z',
        endedAt: '2026-09-09T12:00:08.000Z',
      },
    ]);

    const persisted = loadActiveJourneySnapshot(storage)?.journey;
    expect(persisted?.pauses).toEqual(reconstructed.pauses);
    expect(persisted?.status).toBe('recording');
  });

  it('does not let poor-accuracy locked-screen fixes manufacture a pause', () => {
    const storage = createMemoryStorageAdapter();
    const initial = recordingWalk();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);

    const session = startJourneyMotionSession({
      storage,
      journey: initial,
      provider: silentProvider(),
      idFactory: () => 'distance-1',
    });

    const durable: { snapshot: NativeJourneyPositionBufferSnapshot | null } = { snapshot: null };
    const buffer = createNativeJourneyPositionBuffer({
      journeyId: initial.id,
      store: {
        load() { return durable.snapshot ? structuredClone(durable.snapshot) : null; },
        save(next) { durable.snapshot = structuredClone(next); },
        remove() { durable.snapshot = null; },
      },
    });

    buffer.append({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 50,
      timestampMs: Date.parse('2026-09-09T12:00:01.000Z'),
    });
    buffer.append({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 50,
      timestampMs: Date.parse('2026-09-09T12:00:20.000Z'),
    });

    replayNativeJourneyPositions({
      buffer,
      processor: createJourneyNativeReplayMotionProcessor(session),
    });

    expect(session.getJourney().status).toBe('recording');
    expect(session.getJourney().pauses).toEqual([]);
  });
});
