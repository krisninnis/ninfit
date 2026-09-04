import type { OnboardingAnswers } from './game/types';
import type { PlannedActivity, UUID } from './types';

/**
 * A presentation-level recommendation for the first programme day.
 *
 * This module is deliberately pure. It chooses only among activities that already
 * exist in the authoritative programme; it never records completion, awards XP,
 * starts GPS, mutates the plan or invents an unsupported activity.
 */
export interface Day1FirstWinRecommendation {
  activityId: UUID;
  explanation: string;
  tinyDurationMinutes?: number;
  alternativeActivityIds: UUID[];
}

type SupportedPreference = 'walking' | 'yoga';

const PREFERENCE_ACTIVITY_TYPES: Readonly<Record<SupportedPreference, PlannedActivity['type']>> = {
  walking: 'walk',
  yoga: 'yoga',
};

function supportedPreferenceFor(
  activity: PlannedActivity,
  preferences: readonly NonNullable<OnboardingAnswers['preferredActivities']>[number][],
): SupportedPreference | undefined {
  for (const preference of preferences) {
    if (
      (preference === 'walking' || preference === 'yoga') &&
      PREFERENCE_ACTIVITY_TYPES[preference] === activity.type
    ) {
      return preference;
    }
  }
  return undefined;
}

function preferenceRank(
  activity: PlannedActivity,
  preferences: readonly NonNullable<OnboardingAnswers['preferredActivities']>[number][],
): number {
  for (let index = 0; index < preferences.length; index += 1) {
    const preference = preferences[index];
    if (
      (preference === 'walking' || preference === 'yoga') &&
      PREFERENCE_ACTIVITY_TYPES[preference] === activity.type
    ) {
      return index;
    }
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * A bounded smaller version of the same planned activity.
 *
 * Values stay on calm five-minute steps and never fall below five minutes. The
 * result is presentation/adaptation intent only; callers must not treat it as a
 * completed workout. Activities shorter than ten minutes have no smaller variant.
 */
export function tinyDurationFor(durationMinutes: number): number | undefined {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 10) return undefined;

  const halfRoundedUpToFive = Math.ceil(durationMinutes / 10) * 5;
  const tiny = Math.max(5, halfRoundedUpToFive);
  return tiny < durationMinutes ? tiny : undefined;
}

function explanationFor(
  activity: PlannedActivity,
  answers: OnboardingAnswers,
  matchedPreference: SupportedPreference | undefined,
): string {
  if (matchedPreference === 'walking') {
    return 'You picked walking as something you enjoy, so we’re starting with the walk already in today’s plan.';
  }
  if (matchedPreference === 'yoga') {
    return 'You picked yoga as something you enjoy, so we’re starting with the yoga already in today’s plan.';
  }
  if (
    answers.availableMinutes !== undefined &&
    activity.durationMinutes <= answers.availableMinutes
  ) {
    return `This ${activity.durationMinutes}-minute step fits within the time you said you can usually give it.`;
  }
  if (answers.confidence === 'low') {
    return 'We’re keeping the first step to something already in your plan and manageable to begin with.';
  }
  return 'We’re starting with the first activity already in today’s plan. You can make it smaller or choose another planned option.';
}

/**
 * Select the first-win activity from the authoritative activities already planned
 * for Day 1.
 *
 * Ordering rules, in priority order:
 *  1. A directly supported explicit preference that exists in today's plan.
 *  2. An existing activity that fits the user's stated available time.
 *  3. Stable plan order.
 *
 * Current tracker activity types can represent walking and yoga directly. Strength,
 * cycling and swimming onboarding preferences are intentionally NOT coerced to the
 * generic `other` type: doing so would invent programme meaning that does not exist.
 */
export function selectDay1FirstWin(
  activities: readonly PlannedActivity[],
  answers: OnboardingAnswers,
): Day1FirstWinRecommendation | undefined {
  const eligible = activities.filter((activity) => activity.type !== 'rest');
  if (eligible.length === 0) return undefined;

  const preferences = answers.preferredActivities ?? [];
  const indexed = eligible.map((activity, index) => ({ activity, index }));

  const preferenceMatches = indexed
    .filter(({ activity }) => Number.isFinite(preferenceRank(activity, preferences)))
    .sort((a, b) => {
      const rankDifference =
        preferenceRank(a.activity, preferences) - preferenceRank(b.activity, preferences);
      return rankDifference === 0 ? a.index - b.index : rankDifference;
    });

  let selected = preferenceMatches[0]?.activity;

  if (selected === undefined && answers.availableMinutes !== undefined) {
    selected = eligible.find(
      (activity) => activity.durationMinutes <= (answers.availableMinutes as number),
    );
  }

  selected ??= eligible[0];
  if (selected === undefined) return undefined;

  const tinyDurationMinutes = tinyDurationFor(selected.durationMinutes);
  const matchedPreference = supportedPreferenceFor(selected, preferences);
  const recommendation: Day1FirstWinRecommendation = {
    activityId: selected.id,
    explanation: explanationFor(selected, answers, matchedPreference),
    alternativeActivityIds: eligible
      .filter((activity) => activity.id !== selected.id)
      .map((activity) => activity.id),
  };

  if (tinyDurationMinutes !== undefined) {
    recommendation.tinyDurationMinutes = tinyDurationMinutes;
  }

  return recommendation;
}
