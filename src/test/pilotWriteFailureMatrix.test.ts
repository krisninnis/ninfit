import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import { createInitialGameState } from '../domain/game/defaults';
import type { DailyLog, Measurement, MetricSample } from '../domain/types';
import {
  activeJourneySnapshotKey,
  loadActiveJourneySnapshot,
  saveActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';
import {
  journeyHistoryKey,
  loadJourneyHistory,
  saveJourneyToHistory,
} from '../storage/journeyHistory';
import {
  STORAGE_KEYS,
  StorageWriteError,
  createRepository,
  dailyLogKey,
} from '../storage/repository';
import {
  createMemoryStorageAdapter,
  type StorageAdapter,
} from '../storage/StorageAdapter';

const NOW = '2026-08-31T08:00:00.000Z';

function failWritesTo(inner: StorageAdapter, targetKey: string): StorageAdapter {
  return {
    get: (key) => inner.get(key),
    set: (key, value) => {
      if (key === targetKey) throw new Error(`InjectedQuotaFailure:${targetKey}`);
      inner.set(key, value);
    },
    remove: (key) => inner.remove(key),
    keys: () => inner.keys(),
  };
}

function seeded() {
  const storage = createMemoryStorageAdapter();
  const repository = createRepository(storage, { now: () => NOW });
  repository.initialise();
  return { storage, repository };
}

function completedJourney(): Journey {
  return {
    id: 'pilot-write-journey',
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-08-30T08:00:00.000Z',
    endedAt: '2026-08-30T08:30:00.000Z',
    pauses: [],
    sources: [
      {
        id: 'pilot-source',
        kind: 'ninfit_phone_gps',
        observedBy: 'browser_geolocation',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ],
    metrics: [
      {
        id: 'pilot-distance',
        kind: 'distance_m',
        value: 2200.5,
        observedAt: '2026-08-30T08:30:00.000Z',
        sourceId: 'pilot-source',
        derived: true,
      },
    ],
    route: {
      rawPoints: [],
      acceptedPoints: [],
    },
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-30T08:00:00.000Z',
    updatedAt: '2026-08-30T08:30:00.000Z',
  };
}

function recordingJourney(): Journey {
  return {
    ...completedJourney(),
    id: 'pilot-active-journey',
    status: 'recording',
    endedAt: undefined,
    updatedAt: '2026-08-30T08:10:00.000Z',
  };
}

describe('local-first pilot evidence — write-failure matrix', () => {
  it('surfaces profile write failure and preserves the previous profile', () => {
    const { storage, repository } = seeded();
    const before = repository.getProfile();
    expect(before).toBeDefined();
    if (before === undefined) throw new Error('seed profile missing');

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.profile), {
      now: () => NOW,
    });

    expect(() =>
      failing.saveProfile({ ...before, displayName: 'Should not persist', updatedAt: NOW }),
    ).toThrow(StorageWriteError);

    expect(repository.getProfile()).toEqual(before);
  });

  it('surfaces baseline write failure and preserves the previous baseline', () => {
    const { storage, repository } = seeded();
    const before = repository.getBaseline();
    expect(before).toBeDefined();
    if (before === undefined) throw new Error('seed baseline missing');

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.baseline), {
      now: () => NOW,
    });

    expect(() =>
      failing.saveBaseline({ ...before, waistCm: (before.waistCm ?? 0) + 1 }),
    ).toThrow(StorageWriteError);

    expect(repository.getBaseline()).toEqual(before);
  });

  it('surfaces measurement-list write failure and preserves the old list', () => {
    const { storage, repository } = seeded();
    const before = repository.getMeasurements();

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.measurements), {
      now: () => NOW,
    });

    const next: Measurement[] = [
      { id: 'pilot-m', recordedOn: '2026-08-31', weightKg: 69.2 },
    ];

    expect(() => failing.saveMeasurements(next)).toThrow(StorageWriteError);
    expect(repository.getMeasurements()).toEqual(before);
  });

  it('surfaces weekly-plan write failure and preserves the old plans', () => {
    const { storage, repository } = seeded();
    const before = repository.getWeeklyPlans();

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.plans), {
      now: () => NOW,
    });

    expect(() =>
      failing.saveWeeklyPlans(before.map((plan) => ({ ...plan, label: 'Should not persist' }))),
    ).toThrow(StorageWriteError);

    expect(repository.getWeeklyPlans()).toEqual(before);
  });

  it('surfaces metric-sample write failure and preserves the old samples', () => {
    const { storage, repository } = seeded();
    const before = repository.getMetricSamples();

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.metricSamples), {
      now: () => NOW,
    });

    const sample: MetricSample = {
      id: 'pilot-sample',
      kind: 'steps',
      value: 1234,
      unit: 'count',
      date: '2026-08-31',
      source: { sourceType: 'manual' },
    };

    expect(() => failing.saveMetricSamples([sample])).toThrow(StorageWriteError);
    expect(repository.getMetricSamples()).toEqual(before);
  });

  it('surfaces DailyLog write failure and does not create a false saved day', () => {
    const { storage, repository } = seeded();
    const date = '2026-08-31';
    const key = dailyLogKey(date);

    const failing = createRepository(failWritesTo(storage, key), { now: () => NOW });
    const log: DailyLog = {
      id: 'pilot-log',
      date,
      exercise: {
        id: 'pilot-exercise',
        completed: true,
        steps: 3456,
      },
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(() => failing.saveDailyLog(log)).toThrow(StorageWriteError);
    expect(repository.getDailyLog(date)).toBeUndefined();
    expect(storage.get(key)).toBeNull();
  });

  it('surfaces game-state write failure without replacing earned state', () => {
    const { storage, repository } = seeded();
    const before = repository.getGameState();
    expect(before).toBeDefined();
    if (before === undefined) throw new Error('seed game state missing');

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.game), {
      now: () => NOW,
    });

    const next = {
      ...createInitialGameState({ now: NOW }),
      xp: { total: 999, level: 9 },
    };

    expect(() => failing.saveGameState(next)).toThrow(StorageWriteError);
    expect(repository.getGameState()).toEqual(before);
  });

  it('surfaces game-settings write failure and preserves the previous settings', () => {
    const { storage, repository } = seeded();
    const before = repository.getGameSettings();
    expect(before).toBeDefined();
    if (before === undefined) throw new Error('seed game settings missing');

    const failing = createRepository(failWritesTo(storage, STORAGE_KEYS.gameSettings), {
      now: () => NOW,
    });

    expect(() => failing.saveGameSettings({ ...before, theme: 'dark' })).toThrow(
      StorageWriteError,
    );
    expect(repository.getGameSettings()).toEqual(before);
  });

  it('surfaces Journey-history write failure and preserves existing history', () => {
    const inner = createMemoryStorageAdapter();
    const original = completedJourney();
    saveJourneyToHistory(inner, original);
    const before = loadJourneyHistory(inner);

    const failing = failWritesTo(inner, journeyHistoryKey());
    expect(() =>
      saveJourneyToHistory(failing, { ...original, id: 'pilot-write-journey-2' }),
    ).toThrow(/InjectedQuotaFailure/);

    expect(loadJourneyHistory(inner)).toEqual(before);
  });

  it('surfaces active-Journey snapshot failure and preserves the previous snapshot', () => {
    const inner = createMemoryStorageAdapter();
    const first = recordingJourney();
    saveActiveJourneySnapshot(inner, first, NOW);
    const before = loadActiveJourneySnapshot(inner);

    const failing = failWritesTo(inner, activeJourneySnapshotKey());
    expect(() =>
      saveActiveJourneySnapshot(
        failing,
        { ...first, updatedAt: '2026-08-31T08:05:00.000Z' },
        '2026-08-31T08:05:00.000Z',
      ),
    ).toThrow(/InjectedQuotaFailure/);

    expect(loadActiveJourneySnapshot(inner)).toEqual(before);
  });
});
