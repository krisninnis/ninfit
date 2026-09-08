import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../domain/game/defaults';
import type { Journey } from '../domain/journey';
import {
  FIRST_WALK_RUNNERS_ID,
  FIRST_WALK_RUNNERS_REWARD_KEY,
  syncFirstWalkRunners,
} from '../app/journeyFirstWalkReward';
import { Repository } from '../storage/repository';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { journeyName, saveJourneyName } from '../storage/journeyNames';

function walk(): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-09-06T12:00:00.000Z',
    endedAt: '2026-09-06T12:20:00.000Z',
    pauses: [],
    route: {
      rawPoints: [],
      acceptedPoints: [
        { latitude: 51.50, longitude: -3.58, recordedAt: '2026-09-06T12:00:10.000Z' },
        { latitude: 51.501, longitude: -3.579, recordedAt: '2026-09-06T12:00:20.000Z' },
      ],
      segmentStarts: [0],
    },
    metrics: [],
    sources: [
      {
        id: 'source-1',
        kind: 'ninfit_phone_gps',
        observedBy: 'ninfit',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-09-06T12:00:00.000Z',
    updatedAt: '2026-09-06T12:20:00.000Z',
  } as Journey;
}

describe('first Journey runners', () => {
  it('backfills once, equips footwear and queues one durable reward', () => {
    const adapter = createMemoryStorageAdapter();
    const repository = new Repository(adapter);
    repository.saveGameState(createInitialGameState({ now: '2026-09-06T11:00:00.000Z' }));

    const first = syncFirstWalkRunners(repository, [walk()], '2026-09-06T12:21:00.000Z');
    const second = syncFirstWalkRunners(repository, [walk()], '2026-09-06T12:22:00.000Z');

    expect(first.granted?.key).toBe(FIRST_WALK_RUNNERS_REWARD_KEY);
    expect(first.granted?.xp).toBe(0);
    expect(second.granted).toBeUndefined();

    const state = repository.getGameState();
    expect(state?.awardedKeys.filter((key) => key === FIRST_WALK_RUNNERS_REWARD_KEY)).toHaveLength(1);
    expect(state?.cosmetics.ownedIds).toContain(FIRST_WALK_RUNNERS_ID);
    expect(state?.cosmetics.equipped.footwear).toBe(FIRST_WALK_RUNNERS_ID);
    expect(state?.pendingRewardDeliveries?.filter((event) => event.kind === 'first_journey_runners')).toHaveLength(1);
  });

  it('refuses imported/manual walks without NinFit phone-GPS evidence', () => {
    const candidate = walk();
    candidate.sources = [];
    const adapter = createMemoryStorageAdapter();
    const repository = new Repository(adapter);
    repository.saveGameState(createInitialGameState({ now: '2026-09-06T11:00:00.000Z' }));

    const result = syncFirstWalkRunners(repository, [candidate], '2026-09-06T12:21:00.000Z');

    expect(result.granted).toBeUndefined();
    expect(repository.getGameState()?.cosmetics.ownedIds).not.toContain(FIRST_WALK_RUNNERS_ID);
  });
});

describe('Journey names', () => {
  it('stores a compact local label without rewriting Journey history', () => {
    const adapter = createMemoryStorageAdapter();
    expect(saveJourneyName(adapter, 'journey-1', '  Sunday   walk around Bettws  ')).toBe('Sunday walk around Bettws');
    expect(journeyName(adapter, 'journey-1')).toBe('Sunday walk around Bettws');

    saveJourneyName(adapter, 'journey-1', '   ');
    expect(journeyName(adapter, 'journey-1')).toBeUndefined();
  });
});
