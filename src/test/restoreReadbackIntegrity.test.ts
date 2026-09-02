import { describe, expect, it } from 'vitest';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport } from '../io/importJson';
import importSource from '../io/importJson.ts?raw';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS, createRepository } from '../storage/repository';

describe('restore read-back integrity', () => {
  it('verifies all repository-backed categories before reporting success', () => {
    expect(importSource).toContain('getProfile');
    expect(importSource).toContain('getHealthContext');
    expect(importSource).toContain('getBaseline');
    expect(importSource).toContain('getMeasurements');
    expect(importSource).toContain('getWeeklyPlans');
    expect(importSource).toContain('getMetricSamples');
    expect(importSource).toContain('getGameState');
    expect(importSource).toContain('getGameSettings');
  });

  it('keeps Journey verification inside the import boundary', () => {
    expect(importSource).toContain('loadJourneyHistory(storage)');
    expect(importSource).toContain('loadActiveJourneySnapshot(storage)');
    expect(importSource).toMatch(/Journey history could not be read back from storage/);
    expect(importSource).toMatch(/unfinished Journey recovery could not be read back from storage/);
  });

  it('verifies replacement before removing stale daily records', () => {
    const verifyAt = importSource.indexOf('const verification = verifyWritten');
    const removeAt = importSource.indexOf('repository.removeDailyLog');

    expect(verifyAt).toBeGreaterThan(-1);
    expect(removeAt).toBeGreaterThan(verifyAt);
  });

  it('rejects a stale same-count programme during read-back verification', () => {
    const sourceStorage = createMemoryStorageAdapter();
    const sourceRepository = createRepository(sourceStorage);
    sourceRepository.initialise();

    const incomingPlans = sourceRepository.getWeeklyPlans().map((plan, index) =>
      index === 0 ? { ...plan, id: `${plan.id}-incoming` } : plan,
    );
    sourceRepository.saveWeeklyPlans(incomingPlans);

    const prepared = prepareImport(
      buildBackup(sourceRepository, { storage: sourceStorage }).contents,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('source backup unexpectedly failed');

    const targetStorage = createMemoryStorageAdapter();
    const seededTarget = createRepository(targetStorage);
    seededTarget.initialise();
    const stalePlans = targetStorage.get(STORAGE_KEYS.plans);
    if (stalePlans === null) throw new Error('seed plans missing');

    const staleReadAdapter: StorageAdapter = {
      get: (key) => key === STORAGE_KEYS.plans ? stalePlans : targetStorage.get(key),
      set: (key, value) => targetStorage.set(key, value),
      remove: (key) => targetStorage.remove(key),
      keys: () => targetStorage.keys(),
    };
    const targetRepository = createRepository(staleReadAdapter);

    const result = commitImport(targetRepository, prepared.prepared, {
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.phase).toBe('verify');
      expect(result.errors.join(' ')).toMatch(/programme could not be read back/i);
    }
  });

  it('keeps restore honesty explicit rather than claiming transactionality', () => {
    expect(importSource).toMatch(/localStorage[\s\S]{0,8}has no transactions/i);
    expect(importSource).toMatch(/pre-import backup/i);
  });
});
