import { describe, expect, it } from 'vitest';
import type { Journey, JourneyActivityType, JourneySourceKind } from '../domain/journey';
import {
  JOURNEY_COMPARABLE_DISTANCE_TOLERANCE,
  journeyComparableEffort,
  journeyIsFurthestOfType,
  journeyPersonalResult,
} from '../domain/journeyPersonalResult';
import {
  JOURNEY_PUBLIC_MIN_DISTANCE_M,
  JOURNEY_PUBLIC_MIN_TRUSTED_POINTS,
  journeyCommunityResultState,
  journeyCompetitiveIntegrity,
  journeyPublicLeaderboardEligibility,
} from '../domain/journeyPublicEligibility';
import { JOURNEY_MIN_PACE_DISTANCE_M, journeyStatistics } from '../domain/journeyStatistics';

/**
 * The rules that decide what a finished effort is allowed to be told about itself.
 *
 * Two questions, kept apart on purpose. "How does this sit against my own earlier
 * walks?" is a private comparison and may be generous with what it counts. "May this
 * be ranked against other people?" is a public claim and fails closed on every doubt.
 */

const BASE = Date.parse('2026-09-06T10:00:00.000+01:00');

interface Build {
  id: string;
  activityType?: JourneyActivityType;
  distanceM?: number | null;
  seconds?: number;
  pausedSeconds?: number;
  sourceKind?: JourneySourceKind;
  status?: Journey['status'];
  points?: number;
  segmented?: boolean;
  visibility?: Journey['privacy']['visibility'];
  startOffsetMinutes?: number;
}

function journey(build: Build): Journey {
  const {
    id,
    activityType = 'walk',
    distanceM = 1200,
    seconds = 900,
    pausedSeconds = 0,
    sourceKind = 'ninfit_phone_gps',
    status = 'completed',
    points = 60,
    segmented = true,
    visibility = 'private',
    startOffsetMinutes = 0,
  } = build;

  const startedAt = new Date(BASE + startOffsetMinutes * 60_000).toISOString();
  const endedAt = new Date(BASE + startOffsetMinutes * 60_000 + (seconds + pausedSeconds) * 1000)
    .toISOString();
  const sourceId = `${id}-source`;

  const acceptedPoints = Array.from({ length: points }, (_, index) => ({
    latitude: 51.5 + index * 0.0001,
    longitude: -0.1,
    accuracyM: 8,
    recordedAt: new Date(BASE + startOffsetMinutes * 60_000 + index * 4000).toISOString(),
  }));

  return {
    id,
    activityType,
    status,
    startedAt,
    endedAt,
    pauses: pausedSeconds > 0
      ? [{
          startedAt: new Date(BASE + startOffsetMinutes * 60_000 + 60_000).toISOString(),
          endedAt: new Date(BASE + startOffsetMinutes * 60_000 + 60_000 + pausedSeconds * 1000).toISOString(),
        }]
      : [],
    route: points > 0
      ? {
          rawPoints: acceptedPoints,
          acceptedPoints,
          ...(segmented ? { segmentStarts: [0] } : {}),
        }
      : undefined,
    metrics: distanceM === null
      ? []
      : [{
          id: `${id}-distance`,
          kind: 'distance_m',
          value: distanceM,
          observedAt: endedAt,
          sourceId,
          derived: true,
        }],
    sources: [{
      id: sourceId,
      kind: sourceKind,
      observedBy: sourceKind === 'manual' ? 'user' : 'browser_geolocation',
      transportedBy: sourceKind === 'manual' ? 'manual' : 'direct',
      importedBy: 'ninfit',
    }],
    privacy: { visibility, maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: startedAt,
    updatedAt: endedAt,
  };
}

// --- Statistics --------------------------------------------------------------

describe('journey statistics derive once and never invent', () => {
  it('reads the recorded distance observation rather than measuring anything', () => {
    const stats = journeyStatistics(journey({ id: 'a', distanceM: 1234.5 }));
    expect(stats.distanceM).toBe(1234.5);
    expect(stats.distanceSourceKind).toBe('ninfit_phone_gps');
    expect(stats.distanceMeasured).toBe(true);
  });

  it('answers null - not zero - when no distance was ever observed', () => {
    const stats = journeyStatistics(journey({ id: 'a', distanceM: null }));
    expect(stats.distanceM).toBeNull();
    expect(stats.paceSecondsPerKm).toBeNull();
    expect(stats.speedMps).toBeNull();
    expect(stats.distanceMeasured).toBe(false);
  });

  it('divides pace over pause-aware active time, not wall clock', () => {
    const stats = journeyStatistics(
      journey({ id: 'a', distanceM: 2000, seconds: 1200, pausedSeconds: 300 }),
    );
    expect(stats.elapsedSeconds).toBe(1500);
    expect(stats.pausedSeconds).toBe(300);
    expect(stats.activeSeconds).toBe(1200);
    // 1200 s over 2 km = 600 s/km, i.e. 10:00 per km.
    expect(stats.paceSecondsPerKm).toBeCloseTo(600, 6);
    expect(stats.speedMps).toBeCloseTo(2000 / 1200, 6);
  });

  it('refuses a pace derived from a handful of metres', () => {
    const tooShort = journeyStatistics(
      journey({ id: 'a', distanceM: JOURNEY_MIN_PACE_DISTANCE_M - 1, seconds: 90 }),
    );
    expect(tooShort.distanceM).toBe(JOURNEY_MIN_PACE_DISTANCE_M - 1);
    expect(tooShort.paceSecondsPerKm).toBeNull();

    const enough = journeyStatistics(
      journey({ id: 'b', distanceM: JOURNEY_MIN_PACE_DISTANCE_M, seconds: 90 }),
    );
    expect(enough.paceSecondsPerKm).not.toBeNull();
  });

  it('turns a Journey into a comparable effort, or says which check stopped it', () => {
    const good = journeyComparableEffort(journey({ id: 'a', distanceM: 1200, seconds: 900 }));
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.effort.distanceM).toBe(1200);
      expect(good.effort.paceSecondsPerKm).toBeCloseTo(900 / 1.2, 6);
    }

    for (const [build, reason] of [
      [{ id: 'b', status: 'recording' as const }, 'not_completed'],
      [{ id: 'c', distanceM: null }, 'no_trusted_distance'],
      [{ id: 'd', sourceKind: 'manual' as const }, 'distance_not_measured'],
      [{ id: 'e', distanceM: 10, seconds: 60 }, 'no_trusted_distance'],
    ] as const) {
      const verdict = journeyComparableEffort(journey(build));
      expect(verdict.ok, reason).toBe(false);
      if (!verdict.ok) expect(verdict.reason, reason).toBe(reason);
    }
  });

  it('knows a typed distance from a measured one', () => {
    expect(journeyStatistics(journey({ id: 'a', sourceKind: 'manual' })).distanceMeasured)
      .toBe(false);
    expect(journeyStatistics(journey({ id: 'b', sourceKind: 'fitbit' })).distanceMeasured)
      .toBe(true);
  });
});

// --- Personal comparison -----------------------------------------------------

describe('a first effort is told it is a first effort', () => {
  it('reports no ranking when nothing comparable exists', () => {
    const walk = journey({ id: 'w1' });
    const result = journeyPersonalResult(walk, [walk]);
    expect(result).toEqual({ kind: 'first_comparable_effort', activityType: 'walk' });
  });

  it('does not outrank itself just because history already holds it', () => {
    const walk = journey({ id: 'w1' });
    // History is an upsert keyed on id, so the subject is normally already in it.
    expect(journeyPersonalResult(walk, [walk, walk]).kind).toBe('first_comparable_effort');
  });

  it('ignores a different activity entirely', () => {
    const walk = journey({ id: 'w1', distanceM: 1200, seconds: 900 });
    const run = journey({ id: 'r1', activityType: 'run', distanceM: 1200, seconds: 400 });
    expect(journeyPersonalResult(walk, [walk, run]).kind).toBe('first_comparable_effort');
  });

  it('ignores an effort at a materially different distance', () => {
    const walk = journey({ id: 'w1', distanceM: 1000, seconds: 900 });
    const tooFar = journey({
      id: 'w2',
      distanceM: 1000 * (1 + JOURNEY_COMPARABLE_DISTANCE_TOLERANCE) + 1,
      seconds: 600,
      startOffsetMinutes: -600,
    });
    expect(journeyPersonalResult(walk, [walk, tooFar]).kind).toBe('first_comparable_effort');
  });

  it('ignores a distance somebody typed', () => {
    const walk = journey({ id: 'w1', distanceM: 1000, seconds: 900 });
    const typed = journey({
      id: 'w2', distanceM: 1000, seconds: 300, sourceKind: 'manual', startOffsetMinutes: -600,
    });
    expect(journeyPersonalResult(walk, [walk, typed]).kind).toBe('first_comparable_effort');
  });

  it('says why an effort cannot be compared at all', () => {
    expect(journeyPersonalResult(journey({ id: 'w', distanceM: null }), []))
      .toEqual({ kind: 'not_comparable', reason: 'no_trusted_distance' });
    expect(journeyPersonalResult(journey({ id: 'w', sourceKind: 'manual' }), []))
      .toEqual({ kind: 'not_comparable', reason: 'distance_not_measured' });
    expect(journeyPersonalResult(journey({ id: 'w', status: 'recording' }), []))
      .toEqual({ kind: 'not_comparable', reason: 'not_completed' });
  });
});

describe('ranking places like against like', () => {
  const slower = journey({ id: 'w1', distanceM: 1000, seconds: 900, startOffsetMinutes: -2000 });
  const middle = journey({ id: 'w2', distanceM: 1050, seconds: 700, startOffsetMinutes: -1000 });
  const fastest = journey({ id: 'w3', distanceM: 980, seconds: 500, startOffsetMinutes: -500 });

  it('ranks a new fastest effort first and marks it', () => {
    const now = journey({ id: 'w4', distanceM: 1000, seconds: 400 });
    const result = journeyPersonalResult(now, [slower, middle, fastest, now]);
    expect(result).toMatchObject({ kind: 'ranked', rank: 1, rankedCount: 4, personalBest: true });
  });

  it('ranks an ordinary effort honestly and does not call it a best', () => {
    const now = journey({ id: 'w4', distanceM: 1000, seconds: 800 });
    const result = journeyPersonalResult(now, [slower, middle, fastest, now]);
    expect(result).toMatchObject({ kind: 'ranked', rank: 3, rankedCount: 4, personalBest: false });
  });

  it('reports the best of the OTHER efforts, never its own pace', () => {
    const now = journey({ id: 'w4', distanceM: 1000, seconds: 100 });
    const result = journeyPersonalResult(now, [slower, fastest, now]);
    if (result.kind !== 'ranked') throw new Error('expected a ranked result');
    // 500 s over 0.98 km, i.e. the previous best - not this Journey's own 100 s/km.
    expect(result.previousBestPaceSecondsPerKm).toBeCloseTo(500 / 0.98, 6);
  });

  it('does not hand a personal best to an exact repeat of an earlier effort', () => {
    const earlier = journey({ id: 'w1', distanceM: 1000, seconds: 600, startOffsetMinutes: -1000 });
    const repeat = journey({ id: 'w2', distanceM: 1000, seconds: 600 });
    const result = journeyPersonalResult(repeat, [earlier, repeat]);
    expect(result).toMatchObject({ kind: 'ranked', rank: 2, personalBest: false });
  });

  it('compares a cycle with cycles and a run with runs', () => {
    for (const activityType of ['run', 'cycle', 'hike'] as const) {
      const older = journey({ id: 'a', activityType, distanceM: 3000, seconds: 900, startOffsetMinutes: -900 });
      const now = journey({ id: 'b', activityType, distanceM: 3000, seconds: 800 });
      const cross = journey({ id: 'c', activityType: 'walk', distanceM: 3000, seconds: 10, startOffsetMinutes: -800 });
      const result = journeyPersonalResult(now, [older, now, cross]);
      expect(result, activityType).toMatchObject({ kind: 'ranked', rankedCount: 2, rank: 1 });
    }
  });
});

describe('furthest is its own question', () => {
  it('is true for the first measured effort of its kind', () => {
    const walk = journey({ id: 'w1' });
    expect(journeyIsFurthestOfType(walk, [walk])).toBe(true);
  });

  it('is false once something longer exists', () => {
    const now = journey({ id: 'w2', distanceM: 1000 });
    const longer = journey({ id: 'w1', distanceM: 1001, startOffsetMinutes: -900 });
    expect(journeyIsFurthestOfType(now, [longer, now])).toBe(false);
  });

  it('gives a tie to whoever got there first', () => {
    const earlier = journey({ id: 'w1', distanceM: 1000, startOffsetMinutes: -900 });
    const later = journey({ id: 'w2', distanceM: 1000 });
    expect(journeyIsFurthestOfType(later, [earlier, later])).toBe(false);
    expect(journeyIsFurthestOfType(earlier, [earlier, later])).toBe(true);
  });

  it('is not decided by a longer effort of another kind', () => {
    const walk = journey({ id: 'w1', distanceM: 1000 });
    const ride = journey({ id: 'c1', activityType: 'cycle', distanceM: 20_000, startOffsetMinutes: -900 });
    expect(journeyIsFurthestOfType(walk, [walk, ride])).toBe(true);
  });

  it('ignores an effort it could not compare in the first place', () => {
    const walk = journey({ id: 'w1', distanceM: 1000 });
    const typedLonger = journey({ id: 'w2', distanceM: 50_000, sourceKind: 'manual', startOffsetMinutes: -900 });
    expect(journeyIsFurthestOfType(walk, [walk, typedLonger])).toBe(true);
  });
});

// --- Public eligibility ------------------------------------------------------

describe('competitive integrity fails closed', () => {
  it('accepts a clean, device-recorded walk', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'w', distanceM: 1200, seconds: 900, points: 60 }),
    );
    expect(verdict).toEqual({ trustworthy: true, failures: [] });
  });

  it('rejects a route NinFit did not record itself', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'w', sourceKind: 'fitbit', points: 0 }),
    );
    expect(verdict.trustworthy).toBe(false);
    expect(verdict.failures).toContain('route_not_measured_by_device');
    expect(verdict.failures).toContain('no_trusted_route');
  });

  it('rejects a route with no continuity evidence at all', () => {
    const verdict = journeyCompetitiveIntegrity(journey({ id: 'w', segmented: false }));
    expect(verdict.failures).toContain('no_trusted_route');
  });

  it('rejects too few trusted points to be a route', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'w', points: JOURNEY_PUBLIC_MIN_TRUSTED_POINTS - 1 }),
    );
    expect(verdict.failures).toContain('too_few_trusted_points');
  });

  it('rejects a distance too short for a public result to mean anything', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'w', distanceM: JOURNEY_PUBLIC_MIN_DISTANCE_M - 1, seconds: 600 }),
    );
    expect(verdict.failures).toContain('distance_below_minimum');
  });

  it('rejects a Walk that moved at vehicle speed', () => {
    // 12 km in 10 minutes, filed as a walk.
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'w', distanceM: 12_000, seconds: 600 }),
    );
    expect(verdict.failures).toContain('implausible_average_speed');
  });

  it('accepts the same speed when the activity is a Cycle', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'c', activityType: 'cycle', distanceM: 12_000, seconds: 600 }),
    );
    expect(verdict.trustworthy).toBe(true);
  });

  it('rejects a Journey that barely moved for an hour', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 'w', distanceM: 420, seconds: 3600 }),
    );
    expect(verdict.failures).toContain('implausible_average_speed');
  });

  it('rejects a speed it could not work out at all', () => {
    const verdict = journeyCompetitiveIntegrity(journey({ id: 'w', distanceM: null }));
    expect(verdict.failures).toContain('implausible_average_speed');
    expect(verdict.failures).toContain('distance_below_minimum');
  });

  it('excludes an activity with no route basis rather than judging it', () => {
    const verdict = journeyCompetitiveIntegrity(
      journey({ id: 's', activityType: 'swim', sourceKind: 'manual', points: 0 }),
    );
    expect(verdict.failures).toContain('activity_has_no_route_basis');
  });

  it('rejects anything that is not a finished record', () => {
    expect(journeyCompetitiveIntegrity(journey({ id: 'w', status: 'recording' })).failures)
      .toContain('not_completed');
  });
});

describe('public leaderboard eligibility needs consent AND a basis AND clean data', () => {
  const clean = journey({ id: 'w', distanceM: 1200, seconds: 900, visibility: 'full_route' });

  it('is never eligible while there is nothing to be compared against', () => {
    const eligibility = journeyPublicLeaderboardEligibility(clean);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toEqual(['no_comparable_community_route']);
    expect(eligibility.matchedRouteId).toBeNull();
  });

  it('refuses a private Journey even when the data is perfect', () => {
    const priv = journey({ id: 'w', distanceM: 1200, seconds: 900, visibility: 'private' });
    const eligibility = journeyPublicLeaderboardEligibility(priv, {
      communityRoutes: [{ id: 'route-1', activityType: 'walk', distanceM: 1200 }],
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain('visibility_not_shared');
  });

  it('refuses a shared Journey whose evidence is weak', () => {
    const weak = journey({
      id: 'w', distanceM: 12_000, seconds: 600, visibility: 'full_route',
    });
    const eligibility = journeyPublicLeaderboardEligibility(weak, {
      communityRoutes: [{ id: 'route-1', activityType: 'walk', distanceM: 12_000 }],
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain('implausible_average_speed');
  });

  it('will not match a community route for a different activity', () => {
    const eligibility = journeyPublicLeaderboardEligibility(clean, {
      communityRoutes: [{ id: 'route-1', activityType: 'run', distanceM: 1200 }],
    });
    expect(eligibility.reasons).toContain('no_comparable_community_route');
  });

  it('is eligible only when consent, basis and evidence all hold', () => {
    const eligibility = journeyPublicLeaderboardEligibility(clean, {
      communityRoutes: [{ id: 'route-1', activityType: 'walk', distanceM: 1250 }],
    });
    expect(eligibility).toEqual({ eligible: true, reasons: [], matchedRouteId: 'route-1' });
  });
});

describe('the community sentence names the real situation', () => {
  it('says NinFit has no community routes, not that the walk fell short', () => {
    const clean = journey({ id: 'w', distanceM: 1200, seconds: 900, visibility: 'full_route' });
    expect(journeyCommunityResultState(clean)).toEqual({ kind: 'no_community_routes_yet' });
    // Even for a Journey with nothing else going for it.
    expect(journeyCommunityResultState(journey({ id: 'x', distanceM: null, points: 0 })))
      .toEqual({ kind: 'no_community_routes_yet' });
  });

  it('distinguishes a private choice from a failed check', () => {
    const routes = [{ id: 'route-1', activityType: 'walk' as const, distanceM: 1200 }];
    expect(
      journeyCommunityResultState(journey({ id: 'w', distanceM: 1200, seconds: 900 }), {
        communityRoutes: routes,
      }),
    ).toEqual({ kind: 'private_by_choice' });

    const state = journeyCommunityResultState(
      journey({ id: 'w', distanceM: 1200, seconds: 900, visibility: 'full_route', points: 3 }),
      { communityRoutes: routes },
    );
    expect(state.kind).toBe('not_eligible');
  });

  it('never fabricates a rank, a field size or another athlete', () => {
    const state = journeyCommunityResultState(
      journey({ id: 'w', distanceM: 1200, seconds: 900, visibility: 'full_route' }),
      { communityRoutes: [{ id: 'route-1', activityType: 'walk', distanceM: 1200 }] },
    );
    expect(state).toEqual({ kind: 'eligible', routeId: 'route-1' });
    // Eligible is as far as the domain goes. There is no standing, because there is
    // no other athlete anywhere in this codebase to have one against.
    expect(Object.keys(state)).toEqual(['kind', 'routeId']);
  });
});
