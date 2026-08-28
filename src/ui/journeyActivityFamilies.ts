import type { JourneyActivityType } from '../domain/journey';

/**
 * How Journey GROUPS activities for navigation. Nothing more than that.
 *
 * THE RULE THIS FILE EXISTS TO PROTECT.
 *
 * Walking and running are one doorway and two different things. A person picks
 * "Walk / Run" because that is one decision - am I going out on foot - and then says
 * which. What gets recorded is `walk` or `run`, never a merged type, because a walked
 * 5K is not a run and must never become a running personal best, a running record or a
 * running leaderboard entry. The same holds in the other direction.
 *
 * So a family is a LABEL ON A DOOR. It is not stored, it is not a metric, it never
 * reaches a Journey, and no persisted value anywhere is of this type. If a family ever
 * needs to be written down, that is a different design and it needs its own decision.
 *
 * WHY THIS LIVES IN THE UI LAYER. Because grouping is a navigation choice, and putting
 * it in `src/domain` would say the opposite - that families are something the app knows
 * to be true about fitness. They are not. `JourneyActivityType` is the truth, it lives
 * in the domain, and it already distinguishes all four activities without help.
 */

export type JourneyActivityFamilyId = 'walk-run' | 'cycle' | 'swim';

/**
 * How a family's launch works today. Honest by construction: a family cannot claim a
 * flow it does not have, because the flow is named here and the screen dispatches on it.
 *
 *   'companion' — the mascot launch screen, where the activity is chosen explicitly
 *   'direct'    — the existing one-tap start, unchanged from before families existed
 */
export type JourneyFamilyLaunchKind = 'companion' | 'direct';

export interface JourneyActivityFamily {
  readonly id: JourneyActivityFamilyId;
  readonly label: string;
  readonly note: string;
  /** Temporary, like every other single-letter mark in this codebase. */
  readonly mark: string;
  /**
   * The activity types this door leads to, in the order they are offered.
   * NEVER collapsed: two entries here means two distinct kinds of Journey.
   */
  readonly activityTypes: readonly JourneyActivityType[];
  readonly launch: JourneyFamilyLaunchKind;
}

/**
 * The three doors, in the order Journey Home offers them.
 *
 * Cycle and Swim keep the direct launch they have always had. They are not "coming
 * later" - they record today, and taking that away to make room for a screen they do
 * not have yet would be removing working behaviour from someone mid-programme. What
 * they do not have yet is the companion launch screen, and the `launch` field says so
 * rather than the copy pretending either way.
 */
export const JOURNEY_ACTIVITY_FAMILIES: readonly JourneyActivityFamily[] = [
  {
    id: 'walk-run',
    label: 'Walk / Run',
    note: 'Choose walk or run, then head out',
    mark: 'W',
    activityTypes: ['walk', 'run'],
    launch: 'companion',
  },
  {
    id: 'cycle',
    label: 'Cycle',
    note: 'GPS route and distance',
    mark: 'C',
    activityTypes: ['cycle'],
    launch: 'direct',
  },
  {
    id: 'swim',
    label: 'Swim',
    note: 'Pool or wearable distance later',
    mark: 'S',
    activityTypes: ['swim'],
    launch: 'direct',
  },
];

export function journeyActivityFamily(
  id: JourneyActivityFamilyId,
): JourneyActivityFamily | undefined {
  return JOURNEY_ACTIVITY_FAMILIES.find((family) => family.id === id);
}

export function isJourneyActivityFamilyId(value: string): value is JourneyActivityFamilyId {
  return JOURNEY_ACTIVITY_FAMILIES.some((family) => family.id === value);
}

/**
 * The activity types a family may start, and the ONLY ones it may start.
 *
 * A launch screen asks this rather than deciding for itself, so the Walk/Run door can
 * never start a cycle and the Cycle door can never quietly start a run.
 */
export function activityTypesForFamily(
  id: JourneyActivityFamilyId,
): readonly JourneyActivityType[] {
  return journeyActivityFamily(id)?.activityTypes ?? [];
}

export function familyOffersActivityType(
  id: JourneyActivityFamilyId,
  activityType: JourneyActivityType,
): boolean {
  return activityTypesForFamily(id).includes(activityType);
}

/** Presentation label for one activity type. The type itself is the truth. */
export function journeyActivityLabel(activityType: JourneyActivityType): string {
  return activityType.charAt(0).toUpperCase() + activityType.slice(1);
}
