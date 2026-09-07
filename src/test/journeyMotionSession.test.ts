import { describe, expect, it, vi } from 'vitest';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import type {
  JourneyLocationProvider,
  JourneyLocationProviderCallbacks,
} from '../app/journeyLocationProvider';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import {
  loadJourneyPauseOrigin,
  saveJourneyPauseOrigin,
} from '../storage/journeyPauseProvenance';

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status,
    startedAt: '2026-09-07T06:00:00.000Z',
    pauses: status === 'paused' ? [{ startedAt: '2026-09-07T06:00:05.000Z' }] : [],
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
    createdAt: '2026-09-07T06:00:00.000Z',
    updatedAt: '2026-09-07T06:00:00.000Z',
  };
}

function fakeProvider() {
  let callbacks: JourneyLocationProviderCallbacks | null = null;
  const stop = vi.fn();
  const provider: JourneyLocationProvider = {
    kind: 'browser',
    supportsBackground: false,
    start(next) {
      callbacks = next;
      return { stop };
    },
  };
  return {
    provider,
    stop,
    sample(sample: Parameters<JourneyLocationProviderCallbacks['onSample']>[0]) {
      if (!callbacks) throw new Error('provider not started');
      callbacks.onSample(sample);
    },
  };
}

describe('Journey motion session', () => {
  it('auto-pauses after five seconds of trusted stationary evidence and auto-resumes after repeated movement', () => {
    const storage = createMemoryStorageAdapter();
    const initial = journey();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);
    const source = fakeProvider();
    const states: string[] = [];

    const session = startJourneyMotionSession({
      storage,
      journey: initial,
      provider: source.provider,
      idFactory: () => 'distance-1',
      onMotionStateChanged: (state) => states.push(state),
    });

    source.sample({ latitude: 51.5000, longitude: -3.5000, accuracyM: 5, recordedAt: '2026-09-07T06:00:01.000Z' });
    source.sample({ latitude: 51.5000, longitude: -3.5000, accuracyM: 5, recordedAt: '2026-09-07T06:00:06.000Z' });

    expect(session.getJourney().status).toBe('paused');
    expect(session.getMotionState()).toBe('auto_paused');
    expect(loadJourneyPauseOrigin(storage, initial.id)).toBe('auto_stationary');

    source.sample({ latitude: 51.50007, longitude: -3.5000, accuracyM: 5, recordedAt: '2026-09-07T06:00:07.000Z' });
    expect(session.getJourney().status).toBe('paused');

    source.sample({ latitude: 51.50008, longitude: -3.5000, accuracyM: 5, recordedAt: '2026-09-07T06:00:08.000Z' });

    expect(session.getJourney().status).toBe('recording');
    expect(session.getMotionState()).toBe('recording');
    expect(states).toEqual(['auto_paused', 'recording']);
    expect(loadActiveJourneySnapshot(storage)?.journey.status).toBe('recording');
  });

  it('never starts automatic observation for a manual or unproven pause', () => {
    const storage = createMemoryStorageAdapter();
    const paused = journey('paused');
    const source = fakeProvider();

    expect(() => startJourneyMotionSession({ storage, journey: paused, provider: source.provider }))
      .toThrow('recording or auto-paused');
  });

  it('can recover an explicitly auto-paused Journey and keeps observing for resume', () => {
    const storage = createMemoryStorageAdapter();
    const paused: Journey = {
      ...journey('paused'),
      route: {
        rawPoints: [{ latitude: 51.5, longitude: -3.5, accuracyM: 5, recordedAt: '2026-09-07T06:00:05.000Z' }],
        acceptedPoints: [{ latitude: 51.5, longitude: -3.5, accuracyM: 5, recordedAt: '2026-09-07T06:00:05.000Z' }],
      },
    };
    saveActiveJourneySnapshot(storage, paused, paused.updatedAt);
    saveJourneyPauseOrigin(storage, paused.id, 'auto_stationary');
    const source = fakeProvider();

    const session = startJourneyMotionSession({ storage, journey: paused, provider: source.provider });
    expect(session.getMotionState()).toBe('auto_paused');
    expect(source.stop).not.toHaveBeenCalled();
  });
});
