import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import { createInitialGameState } from '../domain/game/defaults';
import { withoutPendingRewardDeliveries } from '../domain/game/rewardDelivery';
import type { RewardEvent } from '../domain/game/types';
import type { DailyLog, Measurement } from '../domain/types';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport } from '../io/importJson';
import { readAppData } from '../app/appData';
import {
  loadJourneyHistory,
  saveJourneyToHistory,
} from '../storage/journeyHistory';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { createRepository } from '../storage/repository';

function point(latitude: number, longitude: number, recordedAt: string) {
  return {
    latitude,
    longitude,
    accuracyM: 7,
    recordedAt,
  };
}

function journey(
  id: string,
  status: 'completed' | 'imported',
  startedAt: string,
  endedAt: string,
  distanceM: number,
  sourceId: string,
): Journey {
  const points = [
    point(51.50000, -3.50000, startedAt),
    point(51.50018, -3.50003, '2026-08-28T08:10:00.000Z'),
    point(51.50035, -3.50007, endedAt),
  ];

  return {
    id,
    activityType: status === 'imported' ? 'cycle' : 'walk',
    status,
    startedAt,
    endedAt,
    pauses: [],
    route: {
      rawPoints: points,
      acceptedPoints: points,
      segmentStarts: [0, 2],
    },
    metrics: [
      {
        id: `${id}-distance`,
        kind: 'distance_m',
        value: distanceM,
        observedAt: endedAt,
        sourceId,
        derived: status === 'completed',
      },
    ],
    sources: [
      {
        id: sourceId,
        kind: status === 'imported' ? 'fitbit' : 'ninfit_phone_gps',
        observedBy: status === 'imported' ? 'fitbit' : 'browser_geolocation',
        transportedBy: status === 'imported' ? 'health_connect' : 'direct',
        importedBy: 'ninfit',
        externalRecordId: status === 'imported' ? 'fitbit-record-42' : undefined,
      },
    ],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: startedAt,
    updatedAt: endedAt,
  };
}

function device() {
  const storage = createMemoryStorageAdapter();
  const repository = createRepository(storage);
  repository.initialise();
  return { storage, repository };
}

describe('local-first pilot evidence — realistic backup and restore', () => {
  it('round-trips realistic fitness, Journey, provenance and earned game truth', () => {
    const source = device();

    const profile = source.repository.getProfile();
    expect(profile).toBeDefined();
    if (profile === undefined) throw new Error('seeded profile missing');
    source.repository.saveProfile({
      ...profile,
      displayName: 'Pilot User',
      preferredUnits: { weight: 'kg', length: 'cm' },
      updatedAt: '2026-08-30T09:00:00.000Z',
    });

    const measurement: Measurement = {
      id: 'measurement-pilot-1',
      recordedOn: '2026-08-29',
      weightKg: 69.4,
      waistCm: 75.8,
      restingHeartRateBpm: 70,
      hrvMs: 39,
      notes: 'Manual pilot check.',
    };
    source.repository.saveMeasurements([measurement]);

    const dailyLogs: DailyLog[] = [
      {
        id: 'log-2026-08-28',
        date: '2026-08-28',
        exercise: {
          id: 'exercise-2026-08-28',
          completed: true,
          actualActivity: 'easy walk',
          durationMinutes: 18,
          effort: 3,
          steps: 4210,
        },
        hydration: { id: 'hydration-2026-08-28', glasses: 7 },
        recovery: { id: 'recovery-2026-08-28', sleepHours: 7.25, energy: 6 },
        createdAt: '2026-08-28T19:00:00.000Z',
        updatedAt: '2026-08-28T19:05:00.000Z',
      },
      {
        id: 'log-2026-08-29',
        date: '2026-08-29',
        exercise: {
          id: 'exercise-2026-08-29',
          completed: true,
          actualActivity: 'beginner yoga',
          durationMinutes: 10,
          effort: 2,
        },
        symptoms: {
          id: 'symptoms-2026-08-29',
          backPainBefore: 4,
          backPainAfter: 3,
          legPain: false,
          toeSensation: 'same',
        },
        createdAt: '2026-08-29T18:00:00.000Z',
        updatedAt: '2026-08-29T18:10:00.000Z',
      },
    ];
    for (const log of dailyLogs) source.repository.saveDailyLog(log);

    const completed = journey(
      'journey-pilot-walk',
      'completed',
      '2026-08-28T08:00:00.000Z',
      '2026-08-28T08:42:00.000Z',
      3120.472,
      'src-phone-pilot',
    );
    const imported = journey(
      'journey-pilot-imported',
      'imported',
      '2026-08-27T07:30:00.000Z',
      '2026-08-27T08:05:00.000Z',
      8450.25,
      'src-fitbit-pilot',
    );
    saveJourneyToHistory(source.storage, completed);
    saveJourneyToHistory(source.storage, imported);

    const reward: RewardEvent = {
      id: 'reward-pilot-1',
      key: 'pilot:activity:2026-08-28',
      kind: 'activity_completed',
      xp: 10,
      skillXp: { consistency: 4 },
      label: 'Activity completed',
      date: '2026-08-28',
      awardedAt: '2026-08-28T19:05:00.000Z',
    };

    const game = createInitialGameState({ now: '2026-08-13T08:00:00.000Z' });
    const gameWithHistory = {
      ...game,
      onboarding: {
        completed: true,
        completedAt: '2026-08-13T08:15:00.000Z',
        answers: { mainGoal: 'start_moving' as const },
        recommendedPathId: 'start_moving' as const,
        overrodeRecommendation: false,
      },
      pathId: 'start_moving' as const,
      mascot: {
        ...game.mascot,
        familyId: 'tortoise' as const,
        eggState: 'hatched' as const,
        stage: 'starter' as const,
        hatchedAt: '2026-08-13T08:16:00.000Z',
      },
      xp: { total: 10, level: 1 },
      awardedKeys: [reward.key],
      recentEvents: [reward],
      pendingRewardDeliveries: [reward],
    };
    source.repository.saveGameState(gameWithHistory);
    source.repository.saveGameSettings({
      ...source.repository.getGameSettings()!,
      theme: 'dark',
      soundEnabled: true,
    });

    const sourceAppData = readAppData(source.repository);
    const sourceJourneys = loadJourneyHistory(source.storage);
    const sourceGame = source.repository.getGameState();
    const sourceSettings = source.repository.getGameSettings();

    const firstBackup = buildBackup(source.repository, {
      storage: source.storage,
      now: '2026-08-30T12:00:00.000Z',
      today: '2026-08-30',
    });
    const prepared = prepareImport(firstBackup.contents);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('realistic backup did not prepare');

    const destination = device();
    const destinationMetaBefore = destination.repository.getMeta();
    const result = commitImport(destination.repository, prepared.prepared, {
      storage: destination.storage,
      now: '2026-08-30T12:05:00.000Z',
      backupCurrentData: () => true,
    });
    expect(result.ok).toBe(true);

    // Re-read from storage rather than trusting the in-memory source objects.
    const restoredAppData = readAppData(destination.repository);
    const restoredJourneys = loadJourneyHistory(destination.storage);
    const restoredGame = destination.repository.getGameState();
    const restoredSettings = destination.repository.getGameSettings();

    const { meta: restoredMeta, ...restoredAuthoritativeData } = restoredAppData;
    const { meta: _sourceMeta, ...sourceAuthoritativeData } = sourceAppData;
    expect(restoredAuthoritativeData).toEqual(sourceAuthoritativeData);
    // Metadata describes this installation/session rather than imported fitness truth.
    expect(restoredMeta.createdAt).toBe(destinationMetaBefore?.createdAt);
    expect(restoredMeta.schemaVersion).toBe(sourceAppData.meta.schemaVersion);
    expect(restoredJourneys).toEqual(sourceJourneys);

    // Earned history survives exactly, while the delivery queue intentionally does not:
    // pending notifications describe the old machine/moment and are not replayed.
    expect(restoredGame).toEqual(withoutPendingRewardDeliveries(sourceGame!));
    expect(restoredGame?.xp).toEqual(sourceGame?.xp);
    expect(restoredGame?.awardedKeys).toEqual(sourceGame?.awardedKeys);
    expect(restoredGame?.recentEvents).toEqual(sourceGame?.recentEvents);
    expect(restoredGame?.mascot).toEqual(sourceGame?.mascot);
    expect(restoredGame?.pendingRewardDeliveries).toBeUndefined();
    expect(restoredSettings).toEqual(sourceSettings);

    const restoredWalk = restoredJourneys.find((item) => item.id === completed.id);
    expect(restoredWalk?.route?.acceptedPoints).toEqual(completed.route?.acceptedPoints);
    expect(restoredWalk?.route?.segmentStarts).toEqual([0, 2]);
    expect(restoredWalk?.metrics.find((metric) => metric.kind === 'distance_m')).toEqual(
      completed.metrics[0],
    );
    expect(restoredWalk?.sources).toEqual(completed.sources);

    const restoredImported = restoredJourneys.find((item) => item.id === imported.id);
    expect(restoredImported?.status).toBe('imported');
    expect(restoredImported?.sources).toEqual(imported.sources);
    expect(restoredImported?.metrics[0]?.value).toBe(8450.25);

    // A second export from the restored device remains a complete, valid backup.
    const secondBackup = buildBackup(destination.repository, {
      storage: destination.storage,
      now: '2026-08-30T12:10:00.000Z',
      today: '2026-08-30',
    });
    const secondPrepared = prepareImport(secondBackup.contents);
    expect(secondPrepared.ok).toBe(true);
    if (!secondPrepared.ok) throw new Error('restored backup did not prepare');
    const { meta: secondMeta, ...secondAuthoritativeData } = secondPrepared.prepared.data;
    expect(secondAuthoritativeData).toEqual(sourceAuthoritativeData);
    expect(secondMeta.createdAt).toBe(destinationMetaBefore?.createdAt);
    expect(secondPrepared.prepared.journey?.history).toEqual(sourceJourneys);
    expect(secondPrepared.prepared.game?.state).toEqual(
      withoutPendingRewardDeliveries(sourceGame!),
    );
    expect(secondPrepared.prepared.game?.settings).toEqual(sourceSettings);
  });
});
