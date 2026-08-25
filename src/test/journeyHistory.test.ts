import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import {
  journeyHistoryKey,
  loadJourneyHistory,
  removeJourneyFromHistory,
  saveJourneyToHistory,
} from '../storage/journeyHistory';

function journey(id: string, status: Journey['status'], endedAt?: string): Journey {
  return {
    id,
    activityType: 'walk',
    status,
    startedAt: '2026-08-25T12:00:00.000Z',
    ...(endedAt ? { endedAt } : {}),
    pauses: [],
    metrics: [],
    sources: [],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: endedAt ?? '2026-08-25T12:00:00.000Z',
  };
}

describe('Journey history persistence', () => {
  it('starts empty', () => {
    expect(loadJourneyHistory(createMemoryStorageAdapter())).toEqual([]);
  });

  it('persists a completed Journey', () => {
    const storage = createMemoryStorageAdapter();
    const completed = journey('j1', 'completed', '2026-08-25T12:30:00.000Z');
    saveJourneyToHistory(storage, completed);
    expect(loadJourneyHistory(storage)).toEqual([completed]);
  });

  it('accepts imported Journey history', () => {
    const storage = createMemoryStorageAdapter();
    const imported = journey('j2', 'imported', '2026-08-24T12:30:00.000Z');
    expect(saveJourneyToHistory(storage, imported)).toEqual([imported]);
  });

  it.each(['recording', 'paused'] as const)('rejects active %s Journeys', (status) => {
    const storage = createMemoryStorageAdapter();
    expect(() => saveJourneyToHistory(storage, journey('active', status))).toThrow(
      'Only completed or imported Journeys can be saved to Journey history',
    );
  });

  it('upserts by Journey id instead of duplicating history', () => {
    const storage = createMemoryStorageAdapter();
    const original = journey('j1', 'completed', '2026-08-25T12:20:00.000Z');
    const updated = { ...original, endedAt: '2026-08-25T12:25:00.000Z', updatedAt: '2026-08-25T12:25:00.000Z' };
    saveJourneyToHistory(storage, original);
    saveJourneyToHistory(storage, updated);
    expect(loadJourneyHistory(storage)).toEqual([updated]);
  });

  it('orders newest Journeys first', () => {
    const storage = createMemoryStorageAdapter();
    const older = journey('old', 'completed', '2026-08-24T12:30:00.000Z');
    const newer = journey('new', 'completed', '2026-08-25T12:30:00.000Z');
    saveJourneyToHistory(storage, older);
    expect(saveJourneyToHistory(storage, newer).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('removes a Journey explicitly', () => {
    const storage = createMemoryStorageAdapter();
    saveJourneyToHistory(storage, journey('j1', 'completed', '2026-08-25T12:30:00.000Z'));
    saveJourneyToHistory(storage, journey('j2', 'completed', '2026-08-24T12:30:00.000Z'));
    expect(removeJourneyFromHistory(storage, 'j1').map((item) => item.id)).toEqual(['j2']);
  });

  it('fails closed to an empty history for corrupt storage', () => {
    const storage = createMemoryStorageAdapter({ [journeyHistoryKey()]: '{bad json' });
    expect(loadJourneyHistory(storage)).toEqual([]);
  });
});
