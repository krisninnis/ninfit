import type { Journey, JourneyActivityType } from './journey';
import { journeyTrustedRouteSegments } from './journeyRouteSegments';
import { journeyStatistics } from './journeyStatistics';

/**
 * Whether a finished Journey may be ranked against other people, and why not.
 *
 * THIS MODULE ONLY EVER SAYS NO MORE OFTEN. It is a gate in front of a public
 * ranking, so every uncertainty resolves to "not eligible". A questionable Journey is
 * still the person's own record, still in their history, still shown back to them on
 * their map - it simply does not get to be a competitive result, because a
 * leaderboard that admits doubtful efforts is worth nothing to the people on it.
 *
 * IT MAKES NOTHING PUBLIC. Nothing here shares, uploads, transmits or changes a
 * Journey's privacy. It reads a Journey and returns an opinion. Publication is a
 * separate, explicit consent decision that does not exist in NinFit yet.
 *
 * WHY TWO FUNCTIONS AND NOT ONE.
 *
 * "Is this effort trustworthy?" and "is there anything to compare it against?" fail
 * for completely different reasons and deserve completely different sentences. An
 * honest walk with nothing to compare it to has done nothing wrong, and telling
 * somebody their perfectly good walk was rejected would be both wrong and unkind.
 * So integrity is judged on its own, and the comparison basis is asked separately.
 *
 * THE SPEED CEILING IS A SANITY CHECK, NOT A JUDGEMENT OF ANYONE'S FITNESS. It exists
 * to catch a Journey that was recorded in a car, or one whose GPS invented a
 * kilometre. The values are set well above what a person does on foot, so beating
 * them is evidence about the data rather than about the athlete.
 */

export type JourneyIntegrityFailure =
  | 'not_completed'
  | 'route_not_measured_by_device'
  | 'no_trusted_route'
  | 'too_few_trusted_points'
  | 'distance_below_minimum'
  | 'implausible_average_speed'
  | 'activity_has_no_route_basis';

export type JourneyPublicIneligibility =
  | JourneyIntegrityFailure
  | 'visibility_not_shared'
  | 'no_comparable_community_route';

/** Minimum trusted, drawable points before a route is competitive evidence. */
export const JOURNEY_PUBLIC_MIN_TRUSTED_POINTS = 20;

/** Minimum recorded distance before a public ranking means anything. */
export const JOURNEY_PUBLIC_MIN_DISTANCE_M = 400;

/**
 * Average speed above which the activity type is almost certainly wrong, or the data
 * is. `null` means this activity has no route-based competitive form in NinFit at
 * all - a pool swim has no GPS route to compare, so it is not judged, it is excluded.
 */
export const JOURNEY_PUBLIC_MAX_AVERAGE_SPEED_MPS: Readonly<
  Record<JourneyActivityType, number | null>
> = {
  walk: 3.0,
  hike: 3.0,
  run: 7.0,
  cycle: 22.0,
  swim: null,
  other: null,
};

/** Below this, nothing meaningful moved, whatever the distance total says. */
export const JOURNEY_PUBLIC_MIN_AVERAGE_SPEED_MPS = 0.2;

export interface JourneyIntegrityVerdict {
  trustworthy: boolean;
  /** Empty exactly when `trustworthy` is true. Ordered most structural first. */
  failures: JourneyIntegrityFailure[];
}

function trustedRoutePointCount(journey: Pick<Journey, 'route'>): number {
  return journeyTrustedRouteSegments(journey)
    .filter((segment) => segment.length >= 2)
    .reduce((total, segment) => total + segment.length, 0);
}

/**
 * Whether NinFit itself observed this route with the phone's own GPS.
 *
 * A summary imported from a wearable can be a completely honest record of a walk and
 * still carry no route at all. It belongs in history and in daily totals; it cannot
 * be a route leaderboard result, because there is no route to place.
 */
function routeMeasuredByDevice(journey: Pick<Journey, 'sources'>): boolean {
  return journey.sources.some(
    (source) => source.kind === 'ninfit_phone_gps' && source.transportedBy === 'direct',
  );
}

export function journeyCompetitiveIntegrity(journey: Journey): JourneyIntegrityVerdict {
  const failures: JourneyIntegrityFailure[] = [];

  if (journey.status !== 'completed' && journey.status !== 'imported') {
    failures.push('not_completed');
  }

  const ceiling = JOURNEY_PUBLIC_MAX_AVERAGE_SPEED_MPS[journey.activityType];
  if (ceiling === null) failures.push('activity_has_no_route_basis');

  if (!routeMeasuredByDevice(journey)) failures.push('route_not_measured_by_device');

  const points = trustedRoutePointCount(journey);
  if (points === 0) failures.push('no_trusted_route');
  else if (points < JOURNEY_PUBLIC_MIN_TRUSTED_POINTS) failures.push('too_few_trusted_points');

  const statistics = journeyStatistics(journey);
  if (statistics.distanceM === null || statistics.distanceM < JOURNEY_PUBLIC_MIN_DISTANCE_M) {
    failures.push('distance_below_minimum');
  }

  const speed = statistics.speedMps;
  if (
    speed === null
    || speed < JOURNEY_PUBLIC_MIN_AVERAGE_SPEED_MPS
    || (ceiling !== null && speed > ceiling)
  ) {
    /*
     * A missing speed lands here rather than being waved through. "We could not work
     * out how fast this was" is not a reason to publish it.
     */
    failures.push('implausible_average_speed');
  }

  return { trustworthy: failures.length === 0, failures };
}

/**
 * A route or challenge other people's efforts are also measured against.
 *
 * The type exists so the eligibility contract is already shaped for the day NinFit
 * has one. There is deliberately no implementation, no store and no seeded example:
 * a sample community route would put a fabricated competition in front of a real
 * person, and every ranking drawn from it would be a lie about other people.
 */
export interface CommunityRouteRef {
  id: string;
  activityType: JourneyActivityType;
  /** Nominal distance of the route, used for the same comparable-effort band. */
  distanceM: number;
}

export interface JourneyPublicEligibility {
  eligible: boolean;
  /** Empty exactly when `eligible` is true. */
  reasons: JourneyPublicIneligibility[];
  /** The route this effort would be ranked on, when one exists. */
  matchedRouteId: string | null;
}

export interface JourneyPublicEligibilityOptions {
  /**
   * The community routes available to compare against. Defaults to none, which is
   * the current and honest state of the product: NinFit has no community routes, so
   * no Journey is ranked publicly, and the reason given is that rather than a fault
   * of the walk.
   */
  communityRoutes?: readonly CommunityRouteRef[];
  /** Same band as personal comparison, so the two cannot drift apart. */
  distanceTolerance?: number;
}

export function journeyPublicLeaderboardEligibility(
  journey: Journey,
  options: JourneyPublicEligibilityOptions = {},
): JourneyPublicEligibility {
  const reasons: JourneyPublicIneligibility[] = [];

  /*
   * Consent first, and consent alone is never enough. A Journey the person has not
   * chosen to share is not eligible no matter how clean its data is, and a Journey
   * they HAVE chosen to share is still checked on every other count below.
   */
  const shared = journey.privacy.visibility === 'masked_route'
    || journey.privacy.visibility === 'full_route';
  if (!shared) reasons.push('visibility_not_shared');

  reasons.push(...journeyCompetitiveIntegrity(journey).failures);

  const tolerance = options.distanceTolerance ?? 0.2;
  const statistics = journeyStatistics(journey);
  const routes = options.communityRoutes ?? [];
  const match = statistics.distanceM === null
    ? undefined
    : routes.find(
        (route) =>
          route.activityType === journey.activityType
          && statistics.distanceM !== null
          && route.distanceM >= statistics.distanceM * (1 - tolerance)
          && route.distanceM <= statistics.distanceM * (1 + tolerance),
      );

  if (match === undefined) reasons.push('no_comparable_community_route');

  return {
    eligible: reasons.length === 0,
    reasons,
    matchedRouteId: match?.id ?? null,
  };
}

export type JourneyCommunityResultState =
  /** No community routes exist to be compared against. The walk is not at fault. */
  | { kind: 'no_community_routes_yet' }
  /** Routes exist, but nothing comparable to this effort. */
  | { kind: 'no_comparable_route' }
  /** The person has not chosen to share this Journey. The default, and calm. */
  | { kind: 'private_by_choice' }
  /** Shared, comparable, but the recorded evidence is not competitive. */
  | { kind: 'not_eligible'; failures: JourneyIntegrityFailure[] }
  /** Everything holds. NinFit cannot reach this state until a registry exists. */
  | { kind: 'eligible'; routeId: string };

/**
 * The single sentence a screen is allowed to say about community standing.
 *
 * Ordered so the most structural truth wins. Telling somebody their walk failed a
 * quality check, when the real situation is that NinFit has no community routes at
 * all, would be an accusation standing in for an absence.
 */
export function journeyCommunityResultState(
  journey: Journey,
  options: JourneyPublicEligibilityOptions = {},
): JourneyCommunityResultState {
  const routes = options.communityRoutes ?? [];
  if (routes.length === 0) return { kind: 'no_community_routes_yet' };

  const eligibility = journeyPublicLeaderboardEligibility(journey, options);
  if (eligibility.eligible && eligibility.matchedRouteId !== null) {
    return { kind: 'eligible', routeId: eligibility.matchedRouteId };
  }

  if (eligibility.reasons.includes('no_comparable_community_route')) {
    return { kind: 'no_comparable_route' };
  }
  if (eligibility.reasons.includes('visibility_not_shared')) {
    return { kind: 'private_by_choice' };
  }

  return {
    kind: 'not_eligible',
    failures: journeyCompetitiveIntegrity(journey).failures,
  };
}
