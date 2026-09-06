import { appendPendingRewardDeliveries, pendingRewardDeliveriesOf } from '../domain/game/rewardDelivery';
import type { GameState, RewardEvent } from '../domain/game/types';
import { newId } from '../domain/ids';
import type { Journey } from '../domain/journey';
import type { ISODateTime } from '../domain/types';
import type { Repository } from '../storage/repository';

export const FIRST_WALK_RUNNERS_ID = 'tortoise:first-walk-runners:v1';
export const FIRST_WALK_RUNNERS_REWARD_KEY = 'journey:first-walk-runners:v1';

/**
 * The reward says "your first NinFit walk", so it only accepts a completed walk that
 * NinFit actually observed through phone GPS. Manual/imported records cannot silently
 * manufacture this milestone.
 */
export function isQualifyingFirstWalk(journey: Journey): boolean {
  return journey.status === 'completed'
    && journey.activityType === 'walk'
    && journey.sources.some((source) => source.kind === 'ninfit_phone_gps')
    && (journey.route?.acceptedPoints.length ?? 0) >= 2;
}

export function firstQualifyingWalk(journeys: readonly Journey[]): Journey | undefined {
  return [...journeys]
    .filter(isQualifyingFirstWalk)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
}

/**
 * Backfill-safe and idempotent. The fixed awarded key means the user's historical
 * first real walk earns the same runners once even if the UI did not exist that day.
 */
export function syncFirstWalkRunners(
  repository: Repository,
  journeys: readonly Journey[],
  now: ISODateTime = new Date().toISOString(),
): { state: GameState | undefined; granted: RewardEvent | undefined } {
  const qualifying = firstQualifyingWalk(journeys);
  const state = repository.getGameState();
  if (qualifying === undefined || state === undefined) return { state, granted: undefined };
  if (state.awardedKeys.includes(FIRST_WALK_RUNNERS_REWARD_KEY)) {
    return { state, granted: undefined };
  }

  const event: RewardEvent = {
    id: newId(),
    key: FIRST_WALK_RUNNERS_REWARD_KEY,
    kind: 'first_journey_runners',
    xp: 0,
    skillXp: {},
    label: 'First Journey runners',
    awardedAt: now,
  };

  const ownedIds = state.cosmetics.ownedIds.includes(FIRST_WALK_RUNNERS_ID)
    ? state.cosmetics.ownedIds
    : [...state.cosmetics.ownedIds, FIRST_WALK_RUNNERS_ID];

  const next: GameState = {
    ...state,
    awardedKeys: [...state.awardedKeys, FIRST_WALK_RUNNERS_REWARD_KEY],
    recentEvents: [event, ...state.recentEvents].slice(0, 20),
    pendingRewardDeliveries: appendPendingRewardDeliveries(
      pendingRewardDeliveriesOf(state),
      [event],
    ),
    cosmetics: {
      ownedIds,
      equipped: {
        ...state.cosmetics.equipped,
        footwear: FIRST_WALK_RUNNERS_ID,
      },
    },
  };

  repository.saveGameState(next);
  return { state: next, granted: event };
}
