import type { ISODate } from '../types';
import type { SessionCompletionStatus } from '../weeklyPlan';
import type { RewardKind } from './types';

/**
 * The only fitness-facing input a companion reaction may consume.
 *
 * This is deliberately a projection of truth owned elsewhere. It cannot inspect a
 * DailyLog, count activities, interpret symptoms, calculate XP, grant rewards or
 * write state. Presentation receives these facts and may only decide which already
 * reviewed reaction fits them.
 */
export interface FitnessCompanionFacts {
  completion: SessionCompletionStatus;
  grantedKinds: readonly RewardKind[];
  today: ISODate;
  lastActiveDate?: ISODate;
}

export type FitnessCompanionReaction =
  | 'trophy'
  | 'session_complete'
  | 'rest_day'
  | 'partial_complete'
  | 'returning'
  | 'none';

export type IsReturningFromFitnessFacts = (
  today: ISODate,
  lastActiveDate: ISODate | undefined,
) => boolean;

/**
 * Select a reaction from supplied facts without deriving or mutating fitness truth.
 *
 * A newly granted trophy is the one game event admitted here because it is itself a
 * result of persisted fitness truth. Everything else is a read-only completion or
 * history fact. "Not yet" and unplanned days intentionally produce no reaction.
 */
export function fitnessCompanionReaction(
  facts: FitnessCompanionFacts,
  isReturning: IsReturningFromFitnessFacts,
): FitnessCompanionReaction {
  if (facts.grantedKinds.includes('trophy_unlocked')) return 'trophy';
  if (facts.completion === 'complete') return 'session_complete';
  if (facts.completion === 'rest') return 'rest_day';
  if (facts.completion === 'partial') return 'partial_complete';
  if (isReturning(facts.today, facts.lastActiveDate)) return 'returning';
  return 'none';
}
