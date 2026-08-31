import { describe, expect, it } from 'vitest';
import { createDefaultGameSettings } from '../domain/game/defaults';
import { SCHEMA_VERSION } from '../domain/schema';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport } from '../io/importJson';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { createRepository } from '../storage/repository';
import {
  loadJourneyHistory,
  saveJourneyToHistory,
} from '../storage/journeyHistory';
import type { Journey } from '../domain/journey';

function device() {
  const storage = createMemoryStorageAdapter();
  const repository = createRepository(storage);
  repository.initialise();
  return { storage, repository };
}

function completedJourney(id = 'compat-journey'): Journey {
  return {
    id,
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-08-29T08:00:00.000Z',
    endedAt: '2026-08-29T08:30:00.000Z',
    pauses: [],
    route: { rawPoints: [], acceptedPoints: [] },
    metrics: [],
    sources: [
      {
        id: 'compat-source',
        kind: 'manual',
        observedBy: 'user',
        transportedBy: 'manual',
        importedBy: 'ninfit',
      },
    ],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-29T08:00:00.000Z',
    updatedAt: '2026-08-29T08:30:00.000Z',
  };
}

describe('local-first pilot evidence — schema/backward compatibility', () => {
  it('normalises an older v1 backup that predates metricSamples', () => {
    const source = device();
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    const legacy = structuredClone(envelope) as typeof envelope & {
      data: typeof envelope.data & { metricSamples?: typeof envelope.data.metricSamples };
    };

    delete legacy.data.metricSamples;

    const prepared = prepareImport(JSON.stringify(legacy));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('older v1 backup unexpectedly failed');

    expect(prepared.prepared.data.metricSamples).toEqual([]);
  });

  it('restores a game-less older backup without retroactively awarding history', () => {
    const source = device();
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    const legacy = { ...envelope };
    delete legacy.game;

    const prepared = prepareImport(JSON.stringify(legacy));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('game-less backup unexpectedly failed');

    const destination = device();
    const result = commitImport(destination.repository, prepared.prepared, {
      storage: destination.storage,
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(true);
    expect(destination.repository.getGameState()?.xp.total).toBe(0);
    expect(destination.repository.getGameState()?.awardedKeys).toEqual([]);
    expect(destination.repository.getGameSettings()).toEqual(createDefaultGameSettings());
  });

  it('keeps existing Journey history when an older backup has no Journey block', () => {
    const source = device();
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    const legacy = { ...envelope };
    delete legacy.journey;

    const destination = device();
    saveJourneyToHistory(destination.storage, completedJourney('must-survive'));

    const prepared = prepareImport(JSON.stringify(legacy));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('pre-Journey backup unexpectedly failed');

    const result = commitImport(destination.repository, prepared.prepared, {
      storage: destination.storage,
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(true);
    expect(loadJourneyHistory(destination.storage).map((journey) => journey.id)).toEqual([
      'must-survive',
    ]);
  });

  it('treats an explicit empty Journey block as authoritative', () => {
    const source = device();
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    expect(envelope.journey).toEqual({ history: [] });

    const destination = device();
    saveJourneyToHistory(destination.storage, completedJourney('remove-me'));

    const prepared = prepareImport(JSON.stringify(envelope));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('current backup unexpectedly failed');

    const result = commitImport(destination.repository, prepared.prepared, {
      storage: destination.storage,
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(true);
    expect(loadJourneyHistory(destination.storage)).toEqual([]);
  });

  it('normalises old game settings that predate the theme preference', () => {
    const source = device();
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    if (envelope.game === undefined) throw new Error('expected game block');

    const legacySettings = { ...envelope.game.settings } as Partial<typeof envelope.game.settings>;
    delete legacySettings.theme;

    const legacy = {
      ...envelope,
      game: {
        ...envelope.game,
        settings: legacySettings,
      },
    };

    const prepared = prepareImport(JSON.stringify(legacy));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('legacy settings backup unexpectedly failed');

    const destination = device();
    const result = commitImport(destination.repository, prepared.prepared, {
      storage: destination.storage,
      backupCurrentData: () => true,
    });

    expect(result.ok).toBe(true);
    expect(destination.repository.getGameSettings()?.theme).toBe('system');
  });

  it('rejects a newer schema version rather than guessing or mutating storage', () => {
    const source = device();
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    const newer = { ...envelope, schemaVersion: SCHEMA_VERSION + 1 };

    const destination = device();
    const beforeProfile = destination.repository.getProfile();
    saveJourneyToHistory(destination.storage, completedJourney('untouched'));

    const prepared = prepareImport(JSON.stringify(newer));

    expect(prepared.ok).toBe(false);
    if (prepared.ok) throw new Error('newer schema unexpectedly prepared');
    expect(prepared.errors.join(' ')).toMatch(/newer version/i);
    expect(destination.repository.getProfile()).toEqual(beforeProfile);
    expect(loadJourneyHistory(destination.storage).map((journey) => journey.id)).toEqual([
      'untouched',
    ]);
  });
});
