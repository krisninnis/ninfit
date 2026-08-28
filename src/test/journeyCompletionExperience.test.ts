import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { createJourneyRecoveryController } from '../app/journeyRecoveryController';
import { createJourneyLaunchController } from '../app/journeyLaunchController';
import { sequentialIdFactory } from '../domain/ids';
import { journeyActiveSeconds } from '../domain/journey';
import { loadActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { loadJourneyHistory } from '../storage/journeyHistory';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { journeyActivityFamilyForType } from '../ui/journeyActivityFamilies';
import { journeyDetailFacts } from '../ui/journeyDetailPresentation';
import { journeyDistanceM } from '../ui/journeyPresentation';
import { journeyCompleteHash, journeyDetailHash, parseRouteFromHash } from '../ui/tabs';

/**
 * The completion moment.
 *
 * Every guard here protects the same sentence: completion is PRESENTATION around an
 * event that already happened durably, and it may state only what that Journey
 * actually recorded. The screen writes nothing, grants nothing, starts nothing, and
 * claims nothing the domain did not measure.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const completion = read('ui', 'screens', 'JourneyCompletionScreen.tsx');
const completionCss = read('styles', 'screens', 'journey-completion.css');
const app = read('App.tsx');
const active = read('ui', 'screens', 'ActiveJourneyScreen.tsx');

const START = '2026-08-28T09:00:00.000+01:00';
const END = '2026-08-28T09:28:36.000+01:00';

let adapter: StorageAdapter;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
});

function recovery() {
  return createJourneyRecoveryController(adapter);
}

function launched(activityType: 'walk' | 'run' | 'cycle' | 'swim') {
  return createJourneyLaunchController(adapter, sequentialIdFactory('j'))
    .start(activityType, START).journey;
}

// --- A. Finish uses the existing durable completion path --------------------

describe('completion runs through the existing durable path, not a new one', () => {
  it('is still the recovery controller that completes a Journey', () => {
    const code = strip(active);
    expect(code).toContain('recovery.complete(');
    expect(code).toContain('onCompleted?.(next.id)');

    // The completion screen owns no completion mechanism of its own.
    const screen = strip(completion);
    expect(screen).not.toContain('createJourneyRecoveryController');
    expect(screen).not.toContain('completeJourney');
    expect(screen).not.toContain('saveJourneyToHistory');
    expect(screen).not.toContain('clearActiveJourneySnapshot');
  });

  it('persists history and clears the active snapshot, exactly as before', () => {
    const journey = launched('walk');
    const completed = recovery().complete(journey, END);

    expect(completed.status).toBe('completed');
    expect(loadJourneyHistory(adapter).map((j) => j.id)).toEqual([completed.id]);
    expect(loadActiveJourneySnapshot(adapter)).toBeNull();
  });
});

// --- B + G. It reads the record; it cannot create or duplicate one ----------

describe('the completion moment creates no record and can duplicate none', () => {
  it('reads the completed Journey out of durable history by id', () => {
    const code = strip(completion);
    expect(code).toContain('loadJourneyHistory(storage)');
    expect(code).toContain('item.id === journeyId');
  });

  it('writes nothing at all', () => {
    const code = strip(completion);
    // No storage writes, no journey construction, no acknowledgement state.
    expect(code).not.toMatch(/\.set\(|\.remove\(|replaceJourneyHistory|removeJourneyFromHistory/);
    expect(code).not.toMatch(/startJourney|createJourney\(|launch\.start|recovery\./);
    expect(code).not.toMatch(/useState|useEffect|localStorage/);
  });

  it('survives being read again and again without growing history', () => {
    const completed = recovery().complete(launched('run'), END);

    // Whatever a render does, it can only re-read. Ten reads, one record.
    for (let i = 0; i < 10; i += 1) {
      const history = loadJourneyHistory(adapter);
      expect(history).toHaveLength(1);
      expect(history.find((item) => item.id === completed.id)?.id).toBe(completed.id);
    }
    expect(loadJourneyHistory(adapter)).toHaveLength(1);
  });

  it('leaves no active Journey behind for a reload to resurrect', () => {
    recovery().complete(launched('walk'), END);
    expect(loadActiveJourneySnapshot(adapter)).toBeNull();
    // A fresh controller over the same storage - i.e. a reload - agrees.
    expect(createJourneyLaunchController(adapter).loadActive()).toBeNull();
  });
});

// --- C. Walk stays walk; Run stays run --------------------------------------

describe('the completed activity identity is preserved', () => {
  it('completes each activity as its own type', () => {
    for (const activityType of ['walk', 'run', 'cycle', 'swim'] as const) {
      const store = createMemoryStorageAdapter();
      const journey = createJourneyLaunchController(store, sequentialIdFactory('x'))
        .start(activityType, START).journey;
      const completed = createJourneyRecoveryController(store).complete(journey, END);
      expect(completed.activityType, activityType).toBe(activityType);
      expect(loadJourneyHistory(store)[0]?.activityType, activityType).toBe(activityType);
    }
  });

  it('reads the activity off the Journey rather than off the route or the artwork', () => {
    const code = strip(completion);
    expect(code).toContain('journeyActivityLabel(journey.activityType)');
    // No second mapping from anything else to an activity word.
    expect(code).not.toMatch(/'Walk'|'Run'|"Walk"|"Run"/);
  });
});

// --- D. Facts come from the existing helpers --------------------------------

describe('distance and time come from the existing Journey facts', () => {
  it('uses the same helpers Journey detail uses', () => {
    const code = strip(completion);
    expect(code).toContain('journeyDetailFacts(journey)');
    expect(code).toContain('formatJourneyDistance(facts.distanceM)');
    expect(code).toContain('formatJourneyDuration(facts.activeSeconds)');
  });

  it('computes no distance and no duration of its own', () => {
    const code = strip(completion);
    expect(code).not.toMatch(/distanceBetween|haversine|rawPoints|acceptedPoints/);
    expect(code).not.toMatch(/Date\.now\(\)|setInterval|elapsed\s*=|\/\s*1000/);
  });

  it('keeps active time pause-aware', () => {
    const journey = launched('walk');
    const paused = recovery().pause(journey, '2026-08-28T09:10:00.000+01:00');
    const resumed = recovery().resume(paused, '2026-08-28T09:15:00.000+01:00');
    const completed = recovery().complete(resumed, END);

    const facts = journeyDetailFacts(completed);
    expect(facts.pausedSeconds).toBe(300);
    expect(facts.activeSeconds).toBe(facts.elapsedSeconds - 300);
    // And it agrees with the domain rather than holding a second opinion.
    expect(facts.activeSeconds).toBe(journeyActiveSeconds(completed));
  });
});

// --- E. A distance that was never measured is not a zero achievement --------

describe('an unmeasured distance is stated as unmeasured', () => {
  it('has no distance observation on a Journey that recorded none', () => {
    const completed = recovery().complete(launched('walk'), END);
    expect(completed.metrics.some((m) => m.kind === 'distance_m')).toBe(false);
    expect(journeyDistanceM(completed)).toBe(0);
    expect(journeyDetailFacts(completed).distanceSource).toBeNull();
  });

  it('shows the honest unavailable state rather than a confident 0.00 km', () => {
    const code = strip(completion);
    // The screen branches on whether a distance exists at all.
    expect(code).toContain('facts.distanceM > 0');
    expect(code).toContain('No distance recorded');
    // And the number is only formatted on the branch where there is one.
    expect(code).toMatch(/hasDistance \? formatJourneyDistance\(facts\.distanceM\) : '—'/);
  });
});

// --- F + 9. Viewing completion starts nothing -------------------------------

describe('the completion moment starts no recorder and no GPS', () => {
  it('cannot reach geolocation, a watcher or a session', () => {
    const code = strip(completion);
    expect(code).not.toMatch(
      /geolocation|watchPosition|clearWatch|GpsSession|GpsRuntime|journeyGeolocationAdapter/i,
    );
  });

  it('cannot start an activity', () => {
    const code = strip(completion);
    // The launch controller is read for `loadActive` only - never to start.
    expect(code).toContain('launch.loadActive()');
    expect(code).not.toMatch(/\.start\(/);
  });

  it('cannot mutate game or fitness state merely by being looked at', () => {
    const code = strip(completion);
    expect(code).toContain('repository.getGameState()');
    expect(code).not.toMatch(/useGame|syncGame|grantRewards|deriveRewards|saveGameState|setGameState/);
  });
});

// --- H. Route and privacy rules are untouched -------------------------------

describe('route and privacy truth is left where it is', () => {
  it('does not read, draw, mask or restate the route', () => {
    const code = strip(completion);
    expect(code).not.toMatch(
      /journeyTrustedRouteSegments|journeyRoutePrivacy|maskSensitiveStartEnd|preciseRouteCloudSync|ActiveJourneyMap|JourneyRouteMap/,
    );
    expect(code).not.toMatch(/journey\.route|journey\.privacy|visibility/);
  });

  it('preserves the saved privacy of a completed Journey', () => {
    const journey = launched('walk');
    const completed = recovery().complete(journey, END);
    expect(completed.privacy).toEqual(journey.privacy);
    expect(loadJourneyHistory(adapter)[0]?.privacy).toEqual(journey.privacy);
  });
});

// --- I. No hard-coded asset path or species logic ---------------------------

describe('artwork arrives through the one boundary', () => {
  it('names no species, no file and no asset folder', () => {
    const code = strip(completion);
    expect(code).not.toContain('tortoise');
    expect(code).not.toContain('.webp');
    expect(code).not.toContain('/mascots/');
    expect(code).not.toContain('docs/');
  });

  it('asks the central manifest, keyed by species and activity family', () => {
    const code = strip(completion);
    expect(code).toContain("from '../mascotActivityArt'");
    expect(code).toContain('mascotActivityArt(mascot.id, family)');
    expect(code).toContain('journeyActivityFamilyForType(journey.activityType)');
  });

  it('maps an activity type to its door without inventing one', () => {
    expect(journeyActivityFamilyForType('walk')).toBe('walk-run');
    expect(journeyActivityFamilyForType('run')).toBe('walk-run');
    expect(journeyActivityFamilyForType('cycle')).toBe('cycle');
    expect(journeyActivityFamilyForType('swim')).toBe('swim');
    // Recordable, but behind no door today. `undefined` is the honest answer.
    expect(journeyActivityFamilyForType('hike')).toBeUndefined();
    expect(journeyActivityFamilyForType('other')).toBeUndefined();
  });

  it('keeps a fallback for every species and activity without reviewed art', () => {
    const code = strip(completion);
    expect(code).toContain('art !== undefined ?');
    expect(code).toContain('presence.family.glyph');
  });
});

// --- J. Reward delivery is neither bypassed nor fabricated ------------------

describe('completion presents no reward, because completing grants none', () => {
  it('does not touch the durable reward queue or its presenter', () => {
    const code = strip(completion);
    expect(code).not.toMatch(
      /RewardAcknowledgement|useRewardDelivery|pendingRewardDeliveries|acknowledgeRewardDeliveries|rewardBatchKey|nextRewardBatch/,
    );
  });

  it('states no XP, trophy, badge, level or streak', () => {
    const code = strip(completion);
    expect(code).not.toMatch(/\bxp\b|trophy|badge|prestige|streak|level\b/i);
  });

  it('is not registered as a reward delivery consumer', () => {
    // The allowlist in rewardDelivery.test.ts is the real guard; this asserts the
    // intent from this side, so a future edit here fails in the file that made it.
    const consumers = read('test', 'rewardDelivery.test.ts');
    expect(consumers).not.toContain('JourneyCompletionScreen');
  });
});

// --- K. No claim the domain does not ground ---------------------------------

describe('the copy claims nothing the domain did not measure', () => {
  /** Every string literal the screen can render. */
  const literals = strip(completion).match(/'[^'\n]*'|"[^"\n]*"|>[^<>{}\n]+</g) ?? [];
  const copy = literals.join(' ').toLowerCase();

  it('makes no personal-best, ranking or superlative claim', () => {
    /*
     * Word-bounded, not substring. "No distance recorded" is exactly the honest
     * wording this slice needed, and a naive `record` ban would forbid the one
     * sentence that keeps an unmeasured distance from becoming a number.
     */
    for (const forbidden of [
      'personal best', 'personal record', 'new record', 'best ever', 'new best',
      'fastest', 'quickest', 'slowest', 'longest', 'furthest', 'farthest',
      'faster than', 'further than', 'beat', 'streak', 'in a row',
    ]) {
      expect(copy, forbidden).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it('makes no calorie, pace or health-benefit claim', () => {
    for (const forbidden of [
      'calorie', 'kcal', 'burned', 'burnt', 'pace', 'min/km', 'heart rate',
      'fitter', 'healthier', 'good for you',
    ]) {
      expect(copy, forbidden).not.toContain(forbidden);
    }
  });

  it('makes no freshness claim, because the URL outlives the moment', () => {
    for (const forbidden of ['just now', 'today you', 'moments ago', 'you just']) {
      expect(copy, forbidden).not.toContain(forbidden);
    }
  });

  it('composes no companion line of its own', () => {
    const code = strip(completion);
    // The line comes from the reviewed domain table, which cannot interpolate a
    // number, and may be undefined for the quiet personality.
    expect(code).toContain('journeyCompanionMessage(presence.context');
    expect(code).toContain('companionLine !== undefined');
  });
});

// --- L. Cycle and Swim are unaffected ---------------------------------------

describe('Cycle and Swim behaviour is unchanged', () => {
  it('routes every completed activity through the same completion moment', () => {
    for (const activityType of ['cycle', 'swim'] as const) {
      const store = createMemoryStorageAdapter();
      const journey = createJourneyLaunchController(store, sequentialIdFactory('y'))
        .start(activityType, START).journey;
      const completed = createJourneyRecoveryController(store).complete(journey, END);
      expect(loadJourneyHistory(store)[0]?.activityType).toBe(activityType);
      expect(parseRouteFromHash(journeyCompleteHash(completed.id)))
        .toEqual({ kind: 'journey-complete', journeyId: completed.id });
    }
  });

  it('leaves the Journey Home one-tap start for Cycle and Swim alone', () => {
    const home = strip(read('ui', 'screens', 'JourneyScreen.tsx'));
    expect(home).toContain('launch.start(activityType, nowIso())');
    expect(home).not.toContain('journeyCompleteHash');
  });
});

// --- Routing ----------------------------------------------------------------

describe('the completion route is an addressable view of one Journey', () => {
  it('round-trips an id, including one needing encoding', () => {
    for (const id of ['j-1', 'a b/c', 'ID-With-Case']) {
      expect(parseRouteFromHash(journeyCompleteHash(id)))
        .toEqual({ kind: 'journey-complete', journeyId: id });
    }
  });

  it('never improvises a Journey when the id is unusable', () => {
    // A truncated percent-escape cannot be decoded, so there is no id to show.
    expect(parseRouteFromHash('#/journey/complete/%E0%A4%A')).toEqual({ kind: 'journey-home' });
  });

  it('treats a missing id exactly as its sibling id-routes do', () => {
    /*
     * Detail and postcard both fall through to the default tab when the id is absent
     * entirely. Completion is a third route of the same shape, so it must behave the
     * same way - one of three siblings answering differently is a trap, and the place
     * to change that convention is all three at once, not here.
     */
    for (const bare of ['complete', 'detail', 'postcard']) {
      const withoutId = parseRouteFromHash(`#/journey/${bare}`);
      const withTrailingSlash = parseRouteFromHash(`#/journey/${bare}/`);
      expect(withoutId, bare).toEqual(parseRouteFromHash('#/journey/detail'));
      expect(withTrailingSlash, bare).toEqual(parseRouteFromHash('#/journey/detail/'));
    }
  });

  it('does not disturb the routes either side of it', () => {
    expect(parseRouteFromHash('#/journey')).toEqual({ kind: 'journey-home' });
    expect(parseRouteFromHash('#/journey/active')).toEqual({ kind: 'journey-active' });
    expect(parseRouteFromHash(journeyDetailHash('j-1')))
      .toEqual({ kind: 'journey-detail', journeyId: 'j-1' });
  });

  it('offers exactly two ways out, and neither starts anything', () => {
    expect(app).toContain('onViewJourney={() => navigate(journeyDetailHash(route.journeyId))}');
    expect(strip(completion)).toContain('onClose');
    expect(strip(completion)).not.toContain('JOURNEY_ACTIVE_HASH');
  });
});

// --- Presentation calm ------------------------------------------------------

describe('the completion moment is calm by construction', () => {
  it('declares no animation, so reduced motion has nothing to switch off', () => {
    expect(completionCss).not.toMatch(/@keyframes|animation:|animation-name/);
    expect(completionCss).not.toMatch(/transition:/);
  });

  it('cannot push the page sideways', () => {
    // The artwork is capped by its container, and long values wrap rather than widen.
    expect(completionCss).toContain('max-width: 100%');
    expect(completionCss).toContain('aspect-ratio: 1');
    expect(completionCss).toContain('object-fit: contain');
    expect(completionCss).toContain('overflow-wrap: anywhere');
    expect(completionCss).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('is wired into the cascade in the screens layer', () => {
    expect(completionCss).toContain('@layer screens');
    expect(read('styles', 'index.css')).toContain("@import './screens/journey-completion.css';");
  });
});
