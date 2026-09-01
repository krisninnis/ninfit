import { describe, expect, it } from 'vitest';
import { buildBackup } from '../io/exportJson';
import {
  activeJourneySnapshotKey,
  loadActiveJourneySnapshot,
  readActiveJourneySnapshotForBackup,
} from '../storage/activeJourneySnapshot';
import { journeyHistoryKey } from '../storage/journeyHistory';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS, createRepository } from '../storage/repository';

function device() {
  const storage = createMemoryStorageAdapter();
  const repository = createRepository(storage);
  repository.initialise();
  return { storage, repository };
}

describe('complete JSON backup integrity', () => {
  it('fails closed when Journey history is unreadable', () => {
    const source = device();
    source.storage.set(journeyHistoryKey(), '{ corrupt journey history');

    expect(() => buildBackup(source.repository, { storage: source.storage }))
      .toThrow(/Journey data could not be included safely/i);

    expect(source.storage.get(journeyHistoryKey())).toBe('{ corrupt journey history');
    expect(
      source.storage.keys().some((key) =>
        key.startsWith('ft:v1:quarantine:ninfit:journey:history:v1:'),
      ),
    ).toBe(true);
  });

  it('keeps runtime active-Journey loading fail-soft while backup loading fails closed', () => {
    const source = device();
    source.storage.set(activeJourneySnapshotKey(), '{ corrupt active journey');

    expect(loadActiveJourneySnapshot(source.storage)).toBeNull();

    const strict = readActiveJourneySnapshotForBackup(source.storage, {
      now: () => '2026-09-01T12:00:00.000Z',
    });
    expect(strict.ok).toBe(false);

    expect(() => buildBackup(source.repository, { storage: source.storage }))
      .toThrow(/Journey data could not be included safely/i);
    expect(source.storage.get(activeJourneySnapshotKey())).toBe('{ corrupt active journey');
  });

  it('does not turn unreadable repository-backed data into seeded defaults', () => {
    const source = device();
    source.storage.set(STORAGE_KEYS.profile, '{ corrupt profile');

    expect(() => buildBackup(source.repository, { storage: source.storage }))
      .toThrow(/stored NinFit data could not be read safely for backup/i);

    expect(source.storage.get(STORAGE_KEYS.profile)).toBe('{ corrupt profile');
  });

  it('permits the existing scoped pending-reward-delivery sanitisation', () => {
    const source = device();
    const state = source.repository.getGameState();
    if (state === undefined) throw new Error('seed game state missing');

    source.storage.set(
      STORAGE_KEYS.game,
      JSON.stringify({
        ...state,
        xp: { total: 77, level: 2 },
        awardedKeys: ['earned:pilot'],
        pendingRewardDeliveries: 'not-a-list',
      }),
    );

    const backup = buildBackup(source.repository, { storage: source.storage });
    expect(backup.envelope.game?.state.xp.total).toBe(77);
    expect(backup.envelope.game?.state.awardedKeys).toEqual(['earned:pilot']);
    expect(backup.envelope.game?.state.pendingRewardDeliveries).toBeUndefined();
  });
});
