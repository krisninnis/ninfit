import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import { createJourneyRecoveryController } from '../app/journeyRecoveryController';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { activeJourneySnapshotKey } from '../storage/activeJourneySnapshot';
import { journeyHistoryKey, loadJourneyHistory } from '../storage/journeyHistory';

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status,
    startedAt: '2026-08-25T12:00:00.000Z',
    pauses: status === 'paused' ? [{ startedAt: '2026-08-25T12:05:00.000Z' }] : [],
    metrics: [],
    sources: [],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
  };
}

describe('Journey recovery controller', () => {
  it('saves and loads an active Journey', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyRecoveryController(storage);
    const active = journey();

    controller.save(active, '2026-08-25T12:01:00.000Z');
    expect(controller.load()).toEqual(active);
  });

  it('persists paused state immediately after pausing', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyRecoveryController(storage);

    const paused = controller.pause(journey(), '2026-08-25T12:05:00.000Z');
    expect(paused.status).toBe('paused');
    expect(controller.load()?.status).toBe('paused');
  });

  it('persists resumed state immediately after resuming', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyRecoveryController(storage);

    const resumed = controller.resume(journey('paused'), '2026-08-25T12:07:00.000Z');
    expect(resumed.status).toBe('recording');
    expect(controller.load()?.pauses[0]?.endedAt).toBe('2026-08-25T12:07:00.000Z');
  });

  it('persists completed history before clearing active recovery evidence', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyRecoveryController(storage);
    const active = journey();

    controller.save(active, '2026-08-25T12:01:00.000Z');
    const completed = controller.complete(active, '2026-08-25T12:20:00.000Z');

    expect(completed.status).toBe('completed');
    expect(loadJourneyHistory(storage)).toEqual([completed]);
    expect(controller.load()).toBeNull();
    expect(storage.get(activeJourneySnapshotKey())).toBeNull();
  });

  it('retains active recovery evidence if completed history cannot be persisted', () => {
    const memory = createMemoryStorageAdapter();
    const storage: StorageAdapter = {
      ...memory,
      set(key, value) {
        if (key === journeyHistoryKey()) throw new Error('history unavailable');
        memory.set(key, value);
      },
    };
    const controller = createJourneyRecoveryController(storage);
    const active = journey();

    controller.save(active, '2026-08-25T12:01:00.000Z');

    expect(() => controller.complete(active, '2026-08-25T12:20:00.000Z')).toThrow(
      'history unavailable',
    );
    expect(controller.load()).toEqual(active);
    expect(storage.get(activeJourneySnapshotKey())).not.toBeNull();
  });

  it('clears active recovery evidence when discard is explicit', () => {
    const storage = createMemoryStorageAdapter();
    const controller = createJourneyRecoveryController(storage);

    controller.save(journey(), '2026-08-25T12:01:00.000Z');
    controller.discard();

    expect(controller.load()).toBeNull();
  });
});
