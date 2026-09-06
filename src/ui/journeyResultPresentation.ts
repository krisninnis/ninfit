import type { JourneyActivityType } from '../domain/journey';
import type { JourneyCommunityResultState } from '../domain/journeyPublicEligibility';
import type { JourneyPersonalResult } from '../domain/journeyPersonalResult';
import { journeyActivityLabel } from './journeyDetailPresentation';

/**
 * The reviewed wording for a finished effort's standing.
 *
 * ONE PLACE, BECAUSE THE WORDS ARE THE PRODUCT. What NinFit says about somebody's
 * walk is a product decision, not a rendering detail, and a screen that composed its
 * own sentence from a rank and a count would be making that decision quietly and
 * differently each time. Screens ask for a line; they never write one.
 *
 * WHAT THESE SENTENCES ARE NOT ALLOWED TO DO.
 *
 * Praise a number. Scold a slower one. Imply that a first walk was a victory, or
 * that a fifth-placed one was a failure. There is no "only", no "just", no "but",
 * and no exclamation mark. A rank is stated the way a clock states a time.
 *
 * They also never claim more than was measured. Every branch below corresponds to a
 * distinct domain answer, including the ones that mean "NinFit cannot say" - which
 * is a sentence this file is required to be able to speak plainly rather than hide
 * behind an empty panel.
 */

export interface JourneyResultLine {
  /** The short, prominent answer. */
  value: string;
  /** One plain sentence of context. Always present; never a slogan. */
  note: string;
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

/** Ordinals for small ranks, falling back to a plain suffix beyond the table. */
export function journeyRankOrdinal(rank: number): string {
  if (!Number.isInteger(rank) || rank < 1) return `${rank}`;
  const known = ORDINALS[rank];
  if (known !== undefined) return known;

  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1: return `${rank}st`;
    case 2: return `${rank}nd`;
    case 3: return `${rank}rd`;
    default: return `${rank}th`;
  }
}

function plural(activityType: JourneyActivityType, count: number): string {
  const label = journeyActivityLabel(activityType);
  return count === 1 ? label : `${label}s`;
}

export function journeyPersonalResultLine(result: JourneyPersonalResult): JourneyResultLine {
  switch (result.kind) {
    case 'not_comparable':
      switch (result.reason) {
        case 'not_completed':
          return {
            value: 'Not finished',
            note: 'This Journey has not been finished, so there is nothing to compare yet.',
          };
        case 'no_trusted_distance':
          return {
            value: 'No comparison',
            note: 'No measured distance was recorded, so this Journey is kept out of comparisons.',
          };
        case 'distance_not_measured':
          return {
            value: 'No comparison',
            note: 'This distance was entered by hand rather than measured, so it is kept out of comparisons.',
          };
        case 'no_pace':
          return {
            value: 'No comparison',
            note: 'No active time was recorded, so no pace could be worked out.',
          };
      }
      break;

    /*
     * The one sentence this whole module exists to get right. A first effort has
     * nothing above it and nothing below it, and calling that a number one would be
     * an achievement invented out of an empty set.
     */
    case 'first_comparable_effort':
      return {
        value: 'First recorded effort',
        note: `Your first comparable ${journeyActivityLabel(result.activityType)}. Later ones will have this to sit beside.`,
      };

    case 'ranked': {
      const set = `${result.rankedCount} comparable ${plural(result.activityType, result.rankedCount)}`;
      if (result.personalBest) {
        return {
          value: `Fastest ${journeyActivityLabel(result.activityType)} so far`,
          note: `Fastest pace of ${set} at a similar distance.`,
        };
      }
      return {
        value: `${journeyRankOrdinal(result.rank)} fastest`,
        note: `Of ${set} at a similar distance.`,
      };
    }
  }

  return { value: 'No comparison', note: 'NinFit has nothing comparable to place this Journey against.' };
}

export function journeyCommunityResultLine(
  state: JourneyCommunityResultState,
): JourneyResultLine {
  switch (state.kind) {
    /*
     * The honest structural answer, and the one that will be true for a long time.
     * It says NinFit has no community routes - not that this walk fell short of one.
     */
    case 'no_community_routes_yet':
      return {
        value: 'No community route yet',
        note: 'NinFit has no shared community routes, so no Journey is ranked against other people.',
      };
    case 'no_comparable_route':
      return {
        value: 'No comparable route',
        note: 'No community route matches this activity and distance.',
      };
    case 'private_by_choice':
      return {
        value: 'Private',
        note: 'This Journey is private to this device and is not entered into any community result.',
      };
    case 'not_eligible':
      return {
        value: 'Not entered',
        note: 'The recorded evidence is not strong enough to enter this Journey into a public result.',
      };
    case 'eligible':
      return {
        value: 'Eligible',
        note: 'This Journey matches a community route and may be ranked.',
      };
  }
}

/** The extra marker shown when this was also the furthest of its kind. */
export function journeyFurthestMarker(
  activityType: JourneyActivityType,
): string {
  return `Furthest ${journeyActivityLabel(activityType)} so far`;
}
