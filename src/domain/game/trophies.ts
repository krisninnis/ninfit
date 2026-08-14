import type { TrophyDefinition, TrophyTier } from './types';

/**
 * Trophies, PlayStation style: Bronze through Platinum.
 *
 * Data-driven, and deliberately a small seed set. Bronze covers the first real wins,
 * Silver a reachable consistency milestone, Gold something that takes months, and
 * Platinum is reserved for completing a path.
 *
 * Every condition is a plain function of recorded facts, so evaluating them twice
 * cannot unlock anything twice.
 */

export interface TrophyFacts {
  completedActivities: number;
  fullSessions: number;
  distinctActiveDays: number;
  programmeDaysRecorded: number;
  restDaysObserved: number;
  measurementsRecorded: number;
}

export interface TrophyRule extends TrophyDefinition {
  isEarned: (facts: TrophyFacts) => boolean;
}

/**
 * Platinum is switched off for v0.1.
 *
 * It is meant to mark completing a path, which is a concept that does not exist yet.
 * Rather than leave a condition that might accidentally become satisfiable, it is
 * explicitly unreachable until there is something real to award it for.
 */
export const PLATINUM_AVAILABLE = false;

export const TROPHIES: readonly TrophyRule[] = [
  {
    id: 'first_steps',
    tier: 'bronze',
    name: 'First Steps',
    description: 'Complete your first planned activity.',
    isEarned: (facts) => facts.completedActivities >= 1,
  },
  {
    id: 'day_one',
    tier: 'bronze',
    name: 'Day One',
    description: 'Record your first programme day.',
    isEarned: (facts) => facts.programmeDaysRecorded >= 1,
  },
  {
    id: 'getting_started',
    tier: 'bronze',
    name: 'Getting Started',
    description: 'Complete every activity in a planned session.',
    isEarned: (facts) => facts.fullSessions >= 1,
  },
  {
    id: 'taking_it_seriously',
    tier: 'bronze',
    name: 'Taking It Seriously',
    description: 'Record your first progress measurement.',
    isEarned: (facts) => facts.measurementsRecorded >= 1,
  },
  {
    id: 'well_rested',
    tier: 'bronze',
    name: 'Well Rested',
    description: 'Take a planned rest day as part of the programme.',
    isEarned: (facts) => facts.restDaysObserved >= 1,
  },
  {
    id: 'ten_activities',
    tier: 'silver',
    name: 'Ten Down',
    description: 'Complete ten planned activities.',
    isEarned: (facts) => facts.completedActivities >= 10,
  },
  {
    id: 'twelve_active_days',
    tier: 'silver',
    name: 'Turning Up',
    description: 'Do something on twelve different programme days.',
    isEarned: (facts) => facts.distinctActiveDays >= 12,
  },
  {
    id: 'hundred_activities',
    tier: 'gold',
    name: 'The Long Game',
    description: 'Complete one hundred planned activities.',
    isEarned: (facts) => facts.completedActivities >= 100,
  },
  {
    id: 'ninety_active_days',
    tier: 'gold',
    name: 'Ninety Days',
    description: 'Do something on ninety different programme days.',
    isEarned: (facts) => facts.distinctActiveDays >= 90,
  },
  {
    id: 'path_complete',
    tier: 'platinum',
    name: 'Full Circle',
    description: 'Complete a fitness path.',
    secret: true,
    // Unreachable by design until paths have a defined end. See PLATINUM_AVAILABLE.
    isEarned: () => PLATINUM_AVAILABLE,
  },
] as const;

export function findTrophy(id: string): TrophyRule | undefined {
  return TROPHIES.find((trophy) => trophy.id === id);
}

export function trophiesOfTier(tier: TrophyTier): TrophyRule[] {
  return TROPHIES.filter((trophy) => trophy.tier === tier);
}

/** Every trophy the facts have earned. Order is stable, so awarding is repeatable. */
export function earnedTrophies(facts: TrophyFacts): TrophyRule[] {
  return TROPHIES.filter((trophy) => trophy.isEarned(facts));
}
