import type { Journey, JourneyActivityType } from './journey';
import { journeyStatistics, type JourneyStatistics } from './journeyStatistics';

/**
 * How one finished effort compares with the person's own previous efforts.
 *
 * THE ONLY COMPETITOR IS THE PERSON THEMSELVES. Nothing here reads another athlete,
 * a community, a network or a device that is not already part of this Journey's own
 * record. It is a pure function of one Journey and the local history beside it.
 *
 * LIKE IS COMPARED WITH LIKE, OR NOTHING IS COMPARED AT ALL.
 *
 * Three filters, and a result is only produced when all three hold.
 *
 * 1. SAME ACTIVITY. A walk is compared with walks. Letting a walked kilometre place
 *    on a running board is the single mistake that would make every number here
 *    worthless, and the activity type is a thing the person chose rather than
 *    something inferred from speed - so this filter is exact, not fuzzy.
 *
 * 2. MEASURED DISTANCE. A remembered distance is a fine history entry and a bad
 *    referee. Comparison uses distances a device observed.
 *
 * 3. COMPARABLE EFFORT. Pace over 800 m and pace over 8 km are different questions,
 *    and ranking them together would reward the shortest outing every time. Only
 *    efforts within a distance band of each other are ranked against one another.
 *
 * WHEN THERE IS NOTHING TO COMPARE, IT SAYS SO. A first walk is a first walk. It is
 * not a personal best, not a number one, and not an achievement - it is the honest
 * beginning of a history, and inventing a ranking out of a set of one would be the
 * first lie a fitness record ever told this person.
 *
 * IT AWARDS NOTHING. No XP, no trophy, no badge, no streak. This module answers a
 * question; it does not hand anything out, and the reward architecture does not read
 * it.
 */

/** How far two efforts' distances may differ and still be ranked against each other. */
export const JOURNEY_COMPARABLE_DISTANCE_TOLERANCE = 0.2;

export type JourneyEffortRejection =
  /** Still recording, paused, or otherwise not a finished record. */
  | 'not_completed'
  /** No distance observation at all, or one too short to derive a pace from. */
  | 'no_trusted_distance'
  /** A distance somebody typed rather than one a device observed. */
  | 'distance_not_measured'
  /** No pause-aware active time to divide by. */
  | 'no_pace';

export type JourneyPersonalResult =
  | { kind: 'not_comparable'; reason: JourneyEffortRejection }
  | { kind: 'first_comparable_effort'; activityType: JourneyActivityType }
  | {
      kind: 'ranked';
      activityType: JourneyActivityType;
      /** 1 is the fastest pace among comparable efforts, including this one. */
      rank: number;
      /** How many efforts were ranked, this one included. Always 2 or more. */
      rankedCount: number;
      personalBest: boolean;
      /** The best pace among the OTHER comparable efforts. Never this Journey's own. */
      previousBestPaceSecondsPerKm: number;
    };

export interface JourneyEffort {
  journey: Journey;
  statistics: JourneyStatistics;
  paceSecondsPerKm: number;
  distanceM: number;
}

function completedRecord(journey: Pick<Journey, 'status'>): boolean {
  return journey.status === 'completed' || journey.status === 'imported';
}

/**
 * Turns one Journey into a comparable effort, or explains exactly why it is not one.
 *
 * Exported because the reason is the product: a screen that can say "no distance was
 * recorded" is telling the truth, and one that can only say "no result" is hiding it.
 */
export function journeyComparableEffort(
  journey: Journey,
): { ok: true; effort: JourneyEffort } | { ok: false; reason: JourneyEffortRejection } {
  if (!completedRecord(journey)) return { ok: false, reason: 'not_completed' };

  const statistics = journeyStatistics(journey);
  if (statistics.distanceM === null) return { ok: false, reason: 'no_trusted_distance' };
  if (!statistics.distanceMeasured) return { ok: false, reason: 'distance_not_measured' };
  if (statistics.paceSecondsPerKm === null) {
    // Either the distance was too short to divide, or there is no active time.
    return {
      ok: false,
      reason: statistics.activeSeconds > 0 ? 'no_trusted_distance' : 'no_pace',
    };
  }

  return {
    ok: true,
    effort: {
      journey,
      statistics,
      paceSecondsPerKm: statistics.paceSecondsPerKm,
      distanceM: statistics.distanceM,
    },
  };
}

function withinComparableBand(subjectDistanceM: number, otherDistanceM: number): boolean {
  const lower = subjectDistanceM * (1 - JOURNEY_COMPARABLE_DISTANCE_TOLERANCE);
  const upper = subjectDistanceM * (1 + JOURNEY_COMPARABLE_DISTANCE_TOLERANCE);
  return otherDistanceM >= lower && otherDistanceM <= upper;
}

/**
 * Every other effort this one may fairly be ranked against.
 *
 * The subject is excluded BY IDENTITY, not by value. History is an upsert keyed on
 * Journey id, so the Journey being examined is normally already in the list it is
 * being compared with - and a walk that outranked itself would report every first
 * effort as a second-fastest one.
 */
export function journeyComparableEfforts(
  subject: JourneyEffort,
  history: readonly Journey[],
): JourneyEffort[] {
  const comparable: JourneyEffort[] = [];

  for (const candidate of history) {
    if (candidate.id === subject.journey.id) continue;
    if (candidate.activityType !== subject.journey.activityType) continue;

    const effort = journeyComparableEffort(candidate);
    if (!effort.ok) continue;
    if (!withinComparableBand(subject.distanceM, effort.effort.distanceM)) continue;

    comparable.push(effort.effort);
  }

  return comparable;
}

export function journeyPersonalResult(
  journey: Journey,
  history: readonly Journey[],
): JourneyPersonalResult {
  const subject = journeyComparableEffort(journey);
  if (!subject.ok) return { kind: 'not_comparable', reason: subject.reason };

  const others = journeyComparableEfforts(subject.effort, history);
  if (others.length === 0) {
    return { kind: 'first_comparable_effort', activityType: journey.activityType };
  }

  /*
   * Rank by pace, and break a tie by the earlier start.
   *
   * The tie-break matters more than it looks. Two identical paces are rare outdoors
   * and common in a test, and a rule that silently favours the newest effort would
   * report a personal best every time somebody repeated themselves exactly. The
   * earlier effort holds the place it already had.
   */
  const faster = others.filter((other) => {
    if (other.paceSecondsPerKm < subject.effort.paceSecondsPerKm) return true;
    if (other.paceSecondsPerKm > subject.effort.paceSecondsPerKm) return false;
    return other.journey.startedAt < journey.startedAt;
  });

  const previousBestPaceSecondsPerKm = others.reduce(
    (best, other) => Math.min(best, other.paceSecondsPerKm),
    Number.POSITIVE_INFINITY,
  );

  return {
    kind: 'ranked',
    activityType: journey.activityType,
    rank: faster.length + 1,
    rankedCount: others.length + 1,
    personalBest: faster.length === 0,
    previousBestPaceSecondsPerKm,
  };
}

/**
 * Whether this is the furthest the person has gone in this activity.
 *
 * Kept separate from the pace ranking on purpose: distance and pace are different
 * achievements and a screen may honestly show one without the other. A tie is not a
 * new furthest - the first Journey to reach that distance keeps it.
 */
export function journeyIsFurthestOfType(
  journey: Journey,
  history: readonly Journey[],
): boolean {
  const subject = journeyComparableEffort(journey);
  if (!subject.ok) return false;

  return !history.some((candidate) => {
    if (candidate.id === journey.id) return false;
    if (candidate.activityType !== journey.activityType) return false;
    const other = journeyComparableEffort(candidate);
    if (!other.ok) return false;
    if (other.effort.distanceM > subject.effort.distanceM) return true;
    return (
      other.effort.distanceM === subject.effort.distanceM
      && candidate.startedAt < journey.startedAt
    );
  });
}
