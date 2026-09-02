import { describe, expect, it } from 'vitest';
import { sequentialIdFactory } from '../domain/ids';
import type { DailyLog } from '../domain/types';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport } from '../io/importJson';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { createRepository } from '../storage/repository';

const NOW = '2026-08-30T12:00:00.000Z';
const LATER = '2026-08-30T12:05:00.000Z';

function repoFor(storage: StorageAdapter, prefix: string) {
  return createRepository(storage, {
    now: () => NOW,
    makeId: sequentialIdFactory(prefix),
  });
}

function log(id: string, date: string, steps: number): DailyLog {
  return {
    id,
    date,
    exercise: { id: `${id}-exercise`, completed: true, steps },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function sourceBackup(): string {
  const storage = createMemoryStorageAdapter();
  const repository = repoFor(storage, 'source');
  repository.initialise();

  const profile = repository.getProfile();
  if (profile === undefined) throw new Error('source profile missing');
  repository.saveProfile({
    ...profile,
    displayName: 'Incoming Pilot',
    updatedAt: NOW,
  });
  repository.saveDailyLog(log('incoming-log-a', '2026-08-28', 4200));
  repository.saveDailyLog(log('incoming-log-b', '2026-08-29', 5100));

  return buildBackup(repository, {
    storage,
    now: NOW,
    today: '2026-08-30',
  }).contents;
}

function preparedBackup() {
  const result = prepareImport(sourceBackup());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected prepared backup');
  return result.prepared;
}

function throwingAdapter(
  inner: StorageAdapter,
  failOnSetNumber: number,
): { adapter: StorageAdapter; writes: string[] } {
  let setCount = 0;
  const writes: string[] = [];

  return {
    writes,
    adapter: {
      get: (key) => inner.get(key),
      set: (key, value) => {
        setCount += 1;
        writes.push(key);
        if (setCount === failOnSetNumber) {
          throw new Error(`InjectedQuotaFailure:set:${failOnSetNumber}`);
        }
        inner.set(key, value);
      },
      remove: (key) => inner.remove(key),
      keys: () => inner.keys(),
    },
  };
}

describe('local-first pilot evidence — interrupted/failed import', () => {
  it.each([1, 2, 4, 7])(
    'reports a write failure at deterministic set #%i and never deletes the old day',
    (failOnSetNumber) => {
      const inner = createMemoryStorageAdapter();
      const original = repoFor(inner, `original-${failOnSetNumber}`);
      original.initialise();

      const originalProfile = original.getProfile();
      if (originalProfile === undefined) throw new Error('original profile missing');
      original.saveProfile({
        ...originalProfile,
        displayName: 'Original Pilot',
        updatedAt: NOW,
      });
      original.saveDailyLog(log('old-log', '2026-08-20', 1234));

      const beforeOldLog = original.getDailyLog('2026-08-20');
      let backupsTaken = 0;

      const failing = throwingAdapter(inner, failOnSetNumber);
      const destination = repoFor(failing.adapter, `dest-${failOnSetNumber}`);

      const result = commitImport(destination, preparedBackup(), {
        now: LATER,
        backupCurrentData: () => {
          backupsTaken += 1;
          expect(destination.getDailyLog('2026-08-20')).toEqual(beforeOldLog);
          return true;
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('injected failure unexpectedly succeeded');
      expect(result.phase).toBe('write');
      expect(result.errors.join(' ')).toContain('pre-import backup was saved first');
      expect(result.errors.join(' ')).toContain('InjectedQuotaFailure');
      expect(backupsTaken).toBe(1);

      // commitImport removes days absent from the backup only after all writes verify.
      // Therefore an interrupted write must never erase the pre-existing day as part
      // of the failed attempt.
      expect(destination.getDailyLog('2026-08-20')).toEqual(beforeOldLog);
      expect(failing.writes.length).toBe(failOnSetNumber);
    },
  );

  it('documents the accepted current limitation: localStorage cannot make replacement transactional', () => {
    const inner = createMemoryStorageAdapter();
    const original = repoFor(inner, 'mixed-original');
    original.initialise();

    const profile = original.getProfile();
    if (profile === undefined) throw new Error('original profile missing');
    original.saveProfile({
      ...profile,
      displayName: 'Original Pilot',
      updatedAt: NOW,
    });
    original.saveDailyLog(log('old-log', '2026-08-20', 1234));

    // The import writes profile first. Fail on the second storage set so the profile
    // replacement lands, but the remaining replacement does not. This proves the
    // limitation already documented in importJson.ts rather than pretending atomicity.
    const failing = throwingAdapter(inner, 2);
    const destination = repoFor(failing.adapter, 'mixed-destination');

    const result = commitImport(destination, preparedBackup(), {
      now: LATER,
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('injected failure unexpectedly succeeded');
    expect(result.phase).toBe('write');

    expect(destination.getProfile()?.displayName).toBe('Incoming Pilot');
    expect(destination.getDailyLog('2026-08-20')?.exercise?.steps).toBe(1234);

    // The important pilot truth: failure is explicit and the pre-import backup is the
    // recovery mechanism. The product must not claim this operation is transactional.
  });

  it('does not remove stale destination days until a fully successful import verifies', () => {
    const inner = createMemoryStorageAdapter();
    const destination = repoFor(inner, 'success-destination');
    destination.initialise();
    destination.saveDailyLog(log('old-log', '2026-08-20', 1234));

    const result = commitImport(destination, preparedBackup(), {
      now: LATER,
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(true);
    expect(destination.getDailyLog('2026-08-20')).toBeUndefined();
    expect(destination.getDailyLog('2026-08-28')?.exercise?.steps).toBe(4200);
    expect(destination.getDailyLog('2026-08-29')?.exercise?.steps).toBe(5100);
  });
});
