import { describe, expect, it } from 'vitest';
import { DEFAULT_JOURNEY_PRIVACY, type Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import {
  activeJourneySnapshotKey,
  clearActiveJourneySnapshot,
  loadActiveJourneySnapshot,
  saveActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';

function makeJourney(overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-08-25T10:00:00.000+01:00',
    pauses: [],
    metrics: [],
    sources: [],
    privacy: { ...DEFAULT_JOURNEY_PRIVACY },
    createdAt: '2026-08-25T10:00:00.000+01:00',
    updatedAt: '2026-08-25T10:00:00.000+01:00',
    ...overrides,
  };
}

describe('active Journey recovery snapshot', () => {
  it('round-trips a recording Journey through storage', () => {
    const storage = createMemoryStorageAdapter();
    const journey = makeJourney();

    saveActiveJourneySnapshot(storage, journey, '2026-08-25T10:02:00.000+01:00');

    expect(loadActiveJourneySnapshot(storage)).toEqual({
      schemaVersion: 1,
      savedAt: '2026-08-25T10:02:00.000+01:00',
      journey,
    });
  });

  it('allows a paused Journey to be recoverable', () => {
    const storage = createMemoryStorageAdapter();
    const journey = makeJourney({
      status: 'paused',
      pauses: [{ startedAt: '2026-08-25T10:05:00.000+01:00' }],
    });

    saveActiveJourneySnapshot(storage, journey, '2026-08-25T10:05:01.000+01:00');

    expect(loadActiveJourneySnapshot(storage)?.journey.status).toBe('paused');
  });

  it('refuses completed Journeys because history persistence is a separate concern', () => {
    const storage = createMemoryStorageAdapter();
    const completed = makeJourney({
      status: 'completed',
      endedAt: '2026-08-25T10:20:00.000+01:00',
    });

    expect(() =>
      saveActiveJourneySnapshot(storage, completed, '2026-08-25T10:20:01.000+01:00'),
    ).toThrow('Only recording or paused Journeys');
    expect(storage.get(activeJourneySnapshotKey())).toBeNull();
  });

  it('clears the recovery slot explicitly', () => {
    const storage = createMemoryStorageAdapter();
    saveActiveJourneySnapshot(storage, makeJourney(), '2026-08-25T10:02:00.000+01:00');

    clearActiveJourneySnapshot(storage);

    expect(loadActiveJourneySnapshot(storage)).toBeNull();
  });

  it('fails closed on malformed JSON instead of crashing recovery', () => {
    const storage = createMemoryStorageAdapter({
      [activeJourneySnapshotKey()]: '{broken-json',
    });

    expect(loadActiveJourneySnapshot(storage)).toBeNull();
  });

  it('fails closed on unknown snapshot schema versions', () => {
    const storage = createMemoryStorageAdapter({
      [activeJourneySnapshotKey()]: JSON.stringify({
        schemaVersion: 99,
        savedAt: '2026-08-25T10:02:00.000+01:00',
        journey: makeJourney(),
      }),
    });

    expect(loadActiveJourneySnapshot(storage)).toBeNull();
  });

  it('fails closed if stored data is not an unfinished Journey', () => {
    const storage = createMemoryStorageAdapter({
      [activeJourneySnapshotKey()]: JSON.stringify({
        schemaVersion: 1,
        savedAt: '2026-08-25T10:20:01.000+01:00',
        journey: makeJourney({ status: 'completed' }),
      }),
    });

    expect(loadActiveJourneySnapshot(storage)).toBeNull();
  });
});
