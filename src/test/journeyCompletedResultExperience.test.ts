import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JourneyActivityType } from '../domain/journey';
import type { JourneyPersonalResult } from '../domain/journeyPersonalResult';
import type { JourneyCommunityResultState } from '../domain/journeyPublicEligibility';
import { formatJourneyPace } from '../ui/journeyPresentation';
import {
  journeyCommunityResultLine,
  journeyFurthestMarker,
  journeyPersonalResultLine,
  journeyRankOrdinal,
} from '../ui/journeyResultPresentation';

/**
 * The words NinFit is allowed to say about somebody's effort.
 *
 * This is the file the superlative ban moved to when the completion moment learned to
 * report a standing. The rule did not soften: a ranking may be STATED, and it may
 * never be celebrated, scolded, inflated out of an empty set, or attached to a
 * comparison the domain refused to make.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
/** CSS has no line comments, and a URL in a declaration must survive the strip. */
const stripCss = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const wording = read('ui', 'journeyResultPresentation.ts');
const completion = read('ui', 'screens', 'JourneyCompletionScreen.tsx');
const css = read('styles', 'screens', 'journey-completion.css');

const ACTIVITIES: JourneyActivityType[] = ['walk', 'run', 'hike', 'cycle', 'swim', 'other'];

/** Every line this module can produce, for the copy rules below. */
function everyPersonalLine(): string[] {
  const results: JourneyPersonalResult[] = [
    { kind: 'not_comparable', reason: 'not_completed' },
    { kind: 'not_comparable', reason: 'no_trusted_distance' },
    { kind: 'not_comparable', reason: 'distance_not_measured' },
    { kind: 'not_comparable', reason: 'no_pace' },
    ...ACTIVITIES.map((activityType): JourneyPersonalResult => ({
      kind: 'first_comparable_effort', activityType,
    })),
    ...ACTIVITIES.flatMap((activityType): JourneyPersonalResult[] => [
      { kind: 'ranked', activityType, rank: 1, rankedCount: 2, personalBest: true, previousBestPaceSecondsPerKm: 500 },
      { kind: 'ranked', activityType, rank: 2, rankedCount: 2, personalBest: false, previousBestPaceSecondsPerKm: 400 },
      { kind: 'ranked', activityType, rank: 9, rankedCount: 9, personalBest: false, previousBestPaceSecondsPerKm: 300 },
    ]),
  ];
  return results.flatMap((result) => {
    const line = journeyPersonalResultLine(result);
    return [line.value, line.note];
  });
}

function everyCommunityLine(): string[] {
  const states: JourneyCommunityResultState[] = [
    { kind: 'no_community_routes_yet' },
    { kind: 'no_comparable_route' },
    { kind: 'private_by_choice' },
    { kind: 'not_eligible', failures: ['too_few_trusted_points'] },
    { kind: 'eligible', routeId: 'route-1' },
  ];
  return states.flatMap((state) => {
    const line = journeyCommunityResultLine(state);
    return [line.value, line.note];
  });
}

// --- A. Every domain answer gets a sentence ---------------------------------

describe('no domain answer is left without words', () => {
  it('produces a non-empty value and note for every personal result', () => {
    for (const text of everyPersonalLine()) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('produces a non-empty value and note for every community state', () => {
    for (const text of everyCommunityLine()) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('says plainly why a Journey could not be compared, rather than going blank', () => {
    expect(journeyPersonalResultLine({ kind: 'not_comparable', reason: 'no_trusted_distance' }).note)
      .toContain('No measured distance');
    expect(journeyPersonalResultLine({ kind: 'not_comparable', reason: 'distance_not_measured' }).note)
      .toContain('entered by hand');
  });
});

// --- B. A first effort is never dressed as a victory ------------------------

describe('a set of one produces no ranking', () => {
  it('names it a first recorded effort', () => {
    const line = journeyPersonalResultLine({ kind: 'first_comparable_effort', activityType: 'walk' });
    expect(line.value).toBe('First recorded effort');
    expect(line.note).toContain('first comparable Walk');
  });

  it('never calls a first effort a best, a win or a number one', () => {
    for (const activityType of ACTIVITIES) {
      const line = journeyPersonalResultLine({ kind: 'first_comparable_effort', activityType });
      const text = `${line.value} ${line.note}`.toLowerCase();
      /*
       * Word-bounded, and "record" is deliberately absent from the list. "First
       * recorded effort" is precisely the honest wording this branch needs, and a
       * naive substring ban would forbid the one sentence that stops an empty set
       * from becoming an achievement.
       */
      for (const forbidden of [
        'best', '1st', 'first place', 'fastest', 'personal record', 'new record',
        'win', '#1',
      ]) {
        expect(text, `${activityType}/${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

// --- C. A rank is stated, not performed -------------------------------------

describe('a ranking is stated the way a clock states a time', () => {
  it('gives the fastest effort a plain factual line', () => {
    const line = journeyPersonalResultLine({
      kind: 'ranked', activityType: 'walk', rank: 1, rankedCount: 4,
      personalBest: true, previousBestPaceSecondsPerKm: 500,
    });
    expect(line.value).toBe('Fastest Walk so far');
    expect(line.note).toBe('Fastest pace of 4 comparable Walks at a similar distance.');
  });

  it('gives a slower effort the same shape and no reproach', () => {
    const line = journeyPersonalResultLine({
      kind: 'ranked', activityType: 'walk', rank: 4, rankedCount: 4,
      personalBest: false, previousBestPaceSecondsPerKm: 400,
    });
    expect(line.value).toBe('4th fastest');
    expect(line.note).toBe('Of 4 comparable Walks at a similar distance.');
  });

  it('carries no praise, no reproach and no urgency anywhere', () => {
    const all = [...everyPersonalLine(), ...everyCommunityLine(), journeyFurthestMarker('walk')];
    const copy = all.join(' ').toLowerCase();
    for (const forbidden of [
      'well done', 'amazing', 'incredible', 'crushed', 'smashed', 'nailed',
      'only', 'just ', 'unfortunately', 'sadly', 'failed', 'poor', 'slow down',
      'keep it up', 'try harder', 'streak', 'in a row', 'don\'t stop',
      'beat', 'behind', 'catch up', 'lost', 'missed',
    ]) {
      expect(copy, forbidden).not.toContain(forbidden);
    }
    expect(all.join(' ')).not.toContain('!');
  });

  it('makes no health, calorie or reward claim', () => {
    const copy = [...everyPersonalLine(), ...everyCommunityLine()].join(' ').toLowerCase();
    for (const forbidden of [
      'calorie', 'kcal', 'burned', 'burnt', 'heart rate', 'fitter', 'healthier',
      'good for you', 'xp', 'trophy', 'badge', 'level up', 'prestige',
    ]) {
      expect(copy, forbidden).not.toContain(forbidden);
    }
  });

  it('always says the comparison was at a similar distance, never bare', () => {
    for (const activityType of ACTIVITIES) {
      for (const personalBest of [true, false]) {
        const line = journeyPersonalResultLine({
          kind: 'ranked', activityType, rank: personalBest ? 1 : 3, rankedCount: 5,
          personalBest, previousBestPaceSecondsPerKm: 450,
        });
        expect(line.note, activityType).toContain('at a similar distance');
      }
    }
  });

  it('pluralises the set without ever saying a set of one was ranked', () => {
    const single = journeyPersonalResultLine({
      kind: 'ranked', activityType: 'run', rank: 1, rankedCount: 2,
      personalBest: true, previousBestPaceSecondsPerKm: 300,
    });
    expect(single.note).toContain('2 comparable Runs');
  });

  it('produces ordinals that stay correct past the lookup table', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(journeyRankOrdinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });
});

// --- D. The community sentence never invents other people -------------------

describe('the community line describes NinFit, not the athlete', () => {
  it('blames the absence of community routes rather than the walk', () => {
    const line = journeyCommunityResultLine({ kind: 'no_community_routes_yet' });
    expect(line.value).toBe('No community route yet');
    expect(line.note).toContain('NinFit has no shared community routes');
  });

  it('never states a rank, a field size or another person', () => {
    const copy = everyCommunityLine().join(' ').toLowerCase();
    for (const forbidden of [
      // A number anywhere is the real ban - see the digit assertion below.
      '#', 'walkers', 'athletes', 'others', 'you are ', 'in place', 'place of',
      'out of',
    ]) {
      expect(copy, forbidden).not.toContain(forbidden);
    }
    expect(copy).not.toMatch(/\b\d+\b/);
  });

  it('is calm about a private Journey rather than treating it as a shortfall', () => {
    const line = journeyCommunityResultLine({ kind: 'private_by_choice' });
    expect(line.value).toBe('Private');
    expect(line.note.toLowerCase()).not.toContain('cannot');
    expect(line.note.toLowerCase()).not.toContain('not allowed');
  });

  it('does not name the failed checks at the user, only that evidence was short', () => {
    const line = journeyCommunityResultLine({
      kind: 'not_eligible', failures: ['too_few_trusted_points', 'implausible_average_speed'],
    });
    expect(line.note).not.toContain('too_few_trusted_points');
    expect(line.note).not.toContain('implausible');
  });
});

// --- E. Pace formatting ------------------------------------------------------

describe('pace is formatted only when the domain stated one', () => {
  it('passes a missing pace straight through as missing', () => {
    expect(formatJourneyPace(null)).toBeNull();
    expect(formatJourneyPace(0)).toBeNull();
    expect(formatJourneyPace(-1)).toBeNull();
    expect(formatJourneyPace(Number.NaN)).toBeNull();
    expect(formatJourneyPace(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('renders minutes and seconds per kilometre', () => {
    expect(formatJourneyPace(800)).toBe('13:20');
    expect(formatJourneyPace(600)).toBe('10:00');
    expect(formatJourneyPace(65)).toBe('01:05');
    expect(formatJourneyPace(59.6)).toBe('01:00');
  });
});

// --- F. The screen renders these, and nothing of its own --------------------

describe('the completion screen renders the reviewed lines', () => {
  const code = strip(completion);

  it('shows both standings, including when they mean "nothing to say"', () => {
    expect(code).toContain('Personal result');
    expect(code).toContain('Community result');
    expect(code).toContain('{personal.value}');
    expect(code).toContain('{personal.note}');
    expect(code).toContain('{community.value}');
    expect(code).toContain('{community.note}');
  });

  it('shows the furthest marker only when the domain said so', () => {
    expect(code).toContain('journeyIsFurthestOfType(journey, history)');
    expect(code).toContain('{furthest ?');
  });

  it('shows start and end clock times from the recorded Journey', () => {
    expect(code).toContain('new Date(journey.startedAt)');
    expect(code).toContain('journey.endedAt ?? journey.startedAt');
    expect(code).toContain('{clock(startedAt)}–{clock(completedAt)}');
  });

  it('reads local history for the comparison and nothing beyond this device', () => {
    expect(code).toContain('journeyPersonalResult(journey, history)');
    expect(code).not.toMatch(/fetch\(|supabase|http|leaderboard|api\./i);
  });

  it('passes no community routes, because there are none to pass', () => {
    expect(code).toContain('journeyCommunityResultState(journey)');
    expect(code).not.toMatch(/communityRoutes/);
  });
});

// --- F2. The wording module is the only vocabulary ---------------------------

describe('the wording lives in one reviewed place', () => {
  const code = strip(wording);

  it('reads nothing but the domain answer it was handed', () => {
    // No storage, no repository, no clock, no network. A sentence about an effort
    // cannot depend on anything that was not already decided.
    expect(code).not.toMatch(/getAppContext|StorageAdapter|localStorage|fetch\(|Date\.|new Date/);
    expect(code).not.toMatch(/loadJourneyHistory|journeyStatistics|journeyPersonalResult\(/);
  });

  it('exhausts both domain unions rather than falling back to a shrug', () => {
    for (const branch of [
      'not_completed', 'no_trusted_distance', 'distance_not_measured', 'no_pace',
      'first_comparable_effort', 'ranked',
      'no_community_routes_yet', 'no_comparable_route', 'private_by_choice',
      'not_eligible', 'eligible',
    ]) {
      expect(code, branch).toContain(branch);
    }
  });

  it('names no species, screen or asset, so any surface may ask it', () => {
    expect(code).not.toMatch(/tortoise|mascot|\.webp|Screen|className/i);
  });
});

// --- G. It stays calm, and stays inside the page ----------------------------

describe('the result screen is calm and cannot push the page sideways', () => {
  it('declares no animation, so reduced motion has nothing to switch off', () => {
    expect(css).not.toMatch(/@keyframes|animation:|animation-name/);
    expect(css).not.toMatch(/transition:/);
  });

  it('gives a first effort and a slower one the same visual weight', () => {
    /*
     * Comments stripped before the negative assertion. The comment that explains this
     * rule necessarily names the things the rule forbids, so a raw search would match
     * the explanation and report the opposite of the truth.
     */
    const rules = stripCss(css);
    const standingBlock = rules.slice(rules.indexOf('.journey-completion__standing-value'));
    expect(standingBlock).toContain('color: var(--ft-text-primary)');
    expect(rules).not.toMatch(/medal|podium|confetti|first-place|winner/i);
    // No variant class, so there is no hook for a celebratory treatment to attach to.
    expect(rules).not.toMatch(/\.journey-completion__standing-value--/);
  });

  it('wraps long standings and long numbers instead of widening', () => {
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toMatch(/\.journey-completion__standings\s*\{[^}]*display: grid/);
  });

  it('frames the map by ratio so it is sensible at every phone width', () => {
    expect(css).toContain('aspect-ratio: 4 / 3');
    expect(css).toMatch(/\.journey-completion__map-frame\s*\{[^}]*position: relative/);
    expect(css).toContain('min-height: 220px');
  });

  it('is wired into the cascade in the screens layer', () => {
    expect(css).toContain('@layer screens');
    expect(read('styles', 'index.css')).toContain("@import './screens/journey-completion.css';");
  });
});
