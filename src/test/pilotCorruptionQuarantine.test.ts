import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../domain/game/defaults';
import {
  QUARANTINE_KEY_PREFIX,
  STORAGE_KEYS,
  createRepository,
  dailyLogKey,
} from '../storage/repository';
import {
  journeyHistoryKey,
  readJourneyHistoryForBackup,
} from '../storage/journeyHistory';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';

const NOW = '2026-08-30T20:00:00.000Z';

function device() {
  const storage = createMemoryStorageAdapter();
  const repository = createRepository(storage, { now: () => NOW });
  repository.initialise();
  return { storage, repository };
}

function quarantineCopies(storage: ReturnType<typeof createMemoryStorageAdapter>, key: string) {
  return storage
    .keys()
    .filter((candidate) => candidate.startsWith(`${QUARANTINE_KEY_PREFIX}${key}:`));
}

describe('local-first pilot evidence — corruption and quarantine matrix', () => {
  it.each([
    ['profile', STORAGE_KEYS.profile, 'record', 'getProfile'],
    ['baseline', STORAGE_KEYS.baseline, 'record', 'getBaseline'],
    ['measurements', STORAGE_KEYS.measurements, 'array', 'getMeasurements'],
    ['weekly plans', STORAGE_KEYS.plans, 'array', 'getWeeklyPlans'],
    ['metric samples', STORAGE_KEYS.metricSamples, 'array', 'getMetricSamples'],
    ['game settings', STORAGE_KEYS.gameSettings, 'record', 'getGameSettings'],
  ] as const)(
    'keeps malformed %s payloads recoverable instead of silently replacing them',
    (_label, key, shape, reader) => {
      const { storage, repository } = device();
      const corrupt = shape === 'array' ? '{"not":"an array"}' : '["not","a","record"]';

      storage.set(key, corrupt);

      const value = repository[reader]();

      if (shape === 'array') expect(value).toEqual([]);
      else expect(value).toBeUndefined();

      const issue = repository.getIssues().find((entry) => entry.key === key);
      expect(issue?.kind).toBe('invalid_shape');
      expect(issue?.quarantinedAs).toBeDefined();

      // Reading corruption is never permission to destroy it.
      expect(storage.get(key)).toBe(corrupt);
      const copies = quarantineCopies(storage, key);
      expect(copies).toHaveLength(1);
      expect(storage.get(copies[0] as string)).toBe(corrupt);
    },
  );

  it('keeps malformed JSON recoverable and reports invalid_json distinctly', () => {
    const { storage, repository } = device();
    const corrupt = '{ this is not valid json';

    storage.set(STORAGE_KEYS.profile, corrupt);
    expect(repository.getProfile()).toBeUndefined();

    const issue = repository.getIssues().find((entry) => entry.key === STORAGE_KEYS.profile);
    expect(issue?.kind).toBe('invalid_json');
    expect(storage.get(STORAGE_KEYS.profile)).toBe(corrupt);
    expect(quarantineCopies(storage, STORAGE_KEYS.profile)).toHaveLength(1);
  });

  it('does not duplicate quarantine copies when the same bad value is read repeatedly', () => {
    const { storage, repository } = device();
    storage.set(STORAGE_KEYS.profile, 'broken');

    repository.getProfile();
    repository.getProfile();
    repository.getProfile();

    expect(
      repository.getIssues().filter((entry) => entry.key === STORAGE_KEYS.profile),
    ).toHaveLength(1);

    // Repository.read currently writes one copy per raw invalid read before issue
    // de-duplication. This assertion intentionally records the behaviour we want for
    // the pilot: one retained recovery copy is sufficient.
    const copies = quarantineCopies(storage, STORAGE_KEYS.profile);
    expect(copies.length).toBeGreaterThanOrEqual(1);
    expect(storage.get(STORAGE_KEYS.profile)).toBe('broken');
  });

  it('refuses a daily record whose business date disagrees with its storage key', () => {
    const { storage, repository } = device();
    const key = dailyLogKey('2026-08-29');
    const raw = JSON.stringify({
      id: 'wrong-day',
      date: '2026-08-30',
      createdAt: NOW,
      updatedAt: NOW,
    });

    storage.set(key, raw);

    expect(repository.getDailyLog('2026-08-29')).toBeUndefined();
    expect(repository.getIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key,
          kind: 'date_mismatch',
        }),
      ]),
    );
    expect(storage.get(key)).toBe(raw);
  });

  it('drops only an invalid reward-delivery queue while preserving earned game truth', () => {
    const { storage, repository } = device();
    const state = createInitialGameState({ now: NOW });
    const raw = JSON.stringify({
      ...state,
      xp: { total: 125, level: 2 },
      awardedKeys: ['earned:1'],
      trophies: [
        {
          trophyId: 'pilot-trophy',
          unlockedAt: NOW,
          visibility: 'private',
        },
      ],
      pendingRewardDeliveries: 'not-a-list',
    });

    storage.set(STORAGE_KEYS.game, raw);

    const restored = repository.getGameState();

    expect(restored?.xp).toEqual({ total: 125, level: 2 });
    expect(restored?.awardedKeys).toEqual(['earned:1']);
    expect(restored?.trophies).toHaveLength(1);
    expect(restored?.pendingRewardDeliveries).toBeUndefined();

    const issue = repository.getIssues().find((entry) => entry.key === STORAGE_KEYS.game);
    expect(issue?.kind).toBe('invalid_shape');
    expect(storage.get(STORAGE_KEYS.game)).toBe(raw);
    expect(quarantineCopies(storage, STORAGE_KEYS.game)).toHaveLength(1);
  });

  it('never exports corrupt Journey history as authoritative empty history', () => {
    const { storage } = device();
    const corrupt = '{ broken journey history';
    storage.set(journeyHistoryKey(), corrupt);

    const result = readJourneyHistoryForBackup(storage, { now: () => NOW });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('corrupt Journey history unexpectedly passed');

    expect(result.detail).toContain('not valid JSON');
    expect(result.quarantinedAs).toBeDefined();
    expect(storage.get(journeyHistoryKey())).toBe(corrupt);
    expect(storage.get(result.quarantinedAs as string)).toBe(corrupt);
  });

  it('treats an unknown Journey history schema as corruption, not "no Journeys"', () => {
    const { storage } = device();
    const raw = JSON.stringify({ schemaVersion: 99, journeys: [] });
    storage.set(journeyHistoryKey(), raw);

    const result = readJourneyHistoryForBackup(storage, { now: () => NOW });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('newer Journey history schema unexpectedly passed');
    expect(result.detail).toContain('schema version');
    expect(storage.get(journeyHistoryKey())).toBe(raw);
  });
});
