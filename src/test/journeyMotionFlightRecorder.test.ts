import { describe, expect, it, vi } from 'vitest';
import {
  startJourneyMotionSession,
  type JourneyFlightRecorderSession,
} from '../app/journeyMotionSession';
import type {
  JourneyLocationProvider,
  JourneyLocationProviderCallbacks,
} from '../app/journeyLocationProvider';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

function journey(): Journey {
  return {
    id: 'journey-flight-recorder-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-09-11T10:00:00.000Z',
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
    createdAt: '2026-09-11T10:00:00.000Z',
    updatedAt: '2026-09-11T10:00:00.000Z',
  };
}

function fakeProvider() {
  let callbacks: JourneyLocationProviderCallbacks | null = null;

  const provider: JourneyLocationProvider = {
    kind: 'browser',
    supportsBackground: false,
    start(next) {
      callbacks = next;
      return { stop: vi.fn() };
    },
  };

  return {
    provider,
    sample(sample: Parameters<JourneyLocationProviderCallbacks['onSample']>[0]) {
      if (!callbacks) throw new Error('provider not started');
      callbacks.onSample(sample);
    },
  };
}

describe('Journey motion Flight Recorder integration', () => {
  it('records the chronological auto-pause and auto-resume decisions made by the real motion session', () => {
    const storage = createMemoryStorageAdapter();
    const initial = journey();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);
    const source = fakeProvider();

    const session: JourneyFlightRecorderSession = startJourneyMotionSession({
      storage,
      journey: initial,
      provider: source.provider,
      idFactory: () => 'distance-1',
    });

    source.sample({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:01.000Z',
    });

    source.sample({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:06.000Z',
    });

    source.sample({
      latitude: 51.50007,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:07.000Z',
    });

    source.sample({
      latitude: 51.50008,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:08.000Z',
    });

    expect(session.getJourney().status).toBe('recording');
    expect(session.getMotionState()).toBe('recording');

    expect(session.getFlightRecorderSnapshot().map((entry) => entry.reason)).toEqual([
      'anchor_initialized',
      'auto_pause',
      'resume_confirmation',
      'auto_resume',
    ]);
  });

  it('records rejected auto-resume evidence without changing paused Journey state', () => {
    const storage = createMemoryStorageAdapter();
    const initial = journey();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);
    const source = fakeProvider();

    const session: JourneyFlightRecorderSession = startJourneyMotionSession({
      storage,
      journey: initial,
      provider: source.provider,
      idFactory: () => 'distance-1',
    });

    source.sample({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:01.000Z',
    });

    source.sample({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:06.000Z',
    });

    expect(session.getMotionState()).toBe('auto_paused');

    source.sample({
      latitude: 51.501,
      longitude: -3.5,
      accuracyM: 25,
      recordedAt: '2026-09-11T10:00:07.000Z',
    });

    expect(session.getMotionState()).toBe('auto_paused');
    expect(session.getJourney().status).toBe('paused');

    expect(session.getFlightRecorderSnapshot().at(-1)).toMatchObject({
      reason: 'accuracy_outside_motion_policy',
      modeBefore: 'auto_paused',
      modeAfter: 'auto_paused',
      signal: 'none',
      resumeConfirmationsBefore: 0,
      resumeConfirmationsAfter: 0,
      displacementBand: 'unknown',
    });
  });

  it('exposes only privacy-safe detector evidence', () => {
    const storage = createMemoryStorageAdapter();
    const initial = journey();
    saveActiveJourneySnapshot(storage, initial, initial.startedAt);
    const source = fakeProvider();

    const session: JourneyFlightRecorderSession = startJourneyMotionSession({
      storage,
      journey: initial,
      provider: source.provider,
      idFactory: () => 'distance-1',
    });

    source.sample({
      latitude: 51.5,
      longitude: -3.5,
      accuracyM: 5,
      recordedAt: '2026-09-11T10:00:01.000Z',
    });

    const serialised = JSON.stringify(session.getFlightRecorderSnapshot());

    expect(serialised).not.toMatch(/latitude|longitude|recordedAt|timestamp/i);
    expect(serialised).not.toContain('51.5');
    expect(serialised).not.toContain('-3.5');
    expect(serialised).not.toContain('2026-09-11T10:00:01.000Z');
  });
});
