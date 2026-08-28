import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJourneyLaunchController } from '../app/journeyLaunchController';
import type { JourneyActivityType } from '../domain/journey';
import { sequentialIdFactory } from '../domain/ids';
import { loadJourneyHistory, saveJourneyToHistory } from '../storage/journeyHistory';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import {
  JOURNEY_ACTIVITY_FAMILIES,
  activityTypesForFamily,
  familyOffersActivityType,
  isJourneyActivityFamilyId,
  journeyActivityFamily,
  journeyActivityLabel,
} from '../ui/journeyActivityFamilies';
import {
  MASCOT_ACTIVITY_ART,
  mascotActivityArt,
  mascotActivityArtPath,
} from '../ui/mascotActivityArt';
import { journeyLaunchHash, parseRouteFromHash } from '../ui/tabs';

/**
 * Journey activity spaces: three doors, four activity types, one recorder.
 *
 * The rule every one of these protects is that grouping is navigation and nothing
 * more. Walk and Run share a door; they never share a type, because a walked five
 * kilometres must never be able to become a running record.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const launchScreen = read('ui', 'screens', 'JourneyLaunchScreen.tsx');
const home = read('ui', 'screens', 'JourneyScreen.tsx');
const families = read('ui', 'journeyActivityFamilies.ts');
const art = read('ui', 'mascotActivityArt.ts');

const NOW = '2026-08-14T12:42:00.000+01:00';

let adapter: StorageAdapter;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
});

function controller() {
  return createJourneyLaunchController(adapter, sequentialIdFactory('j'));
}

// --- 1. The families --------------------------------------------------------

describe('Journey offers exactly three activity families', () => {
  it('is walk-run, cycle and swim, in that order', () => {
    expect(JOURNEY_ACTIVITY_FAMILIES.map((family) => family.id)).toEqual([
      'walk-run',
      'cycle',
      'swim',
    ]);
  });

  it('recognises those ids and nothing else', () => {
    expect(isJourneyActivityFamilyId('walk-run')).toBe(true);
    expect(isJourneyActivityFamilyId('cycle')).toBe(true);
    expect(isJourneyActivityFamilyId('swim')).toBe(true);

    for (const wrong of ['walk', 'run', 'hike', 'other', 'walkrun', 'Walk/Run', '']) {
      expect(isJourneyActivityFamilyId(wrong), wrong).toBe(false);
    }
  });

  it('names every family it lists and lists every family it names', () => {
    for (const family of JOURNEY_ACTIVITY_FAMILIES) {
      expect(journeyActivityFamily(family.id)).toBe(family);
      expect(family.label.length).toBeGreaterThan(0);
      expect(family.activityTypes.length).toBeGreaterThan(0);
    }
  });
});

// --- 2. Walk and Run are one door and two truths ----------------------------

describe('walk and run share a door, never a type', () => {
  it('puts both behind walk-run, as separate activity types', () => {
    expect(activityTypesForFamily('walk-run')).toEqual(['walk', 'run']);
  });

  it('never collapses them into a single merged type', () => {
    const merged = ['walk-run', 'walkrun', 'walk_run', 'foot', 'running-walking'];
    const declared = JOURNEY_ACTIVITY_FAMILIES.flatMap((family) => family.activityTypes);
    for (const wrong of merged) {
      expect(declared as string[], wrong).not.toContain(wrong);
    }
  });

  it('keeps every activity type in exactly one family', () => {
    const declared = JOURNEY_ACTIVITY_FAMILIES.flatMap((family) => family.activityTypes);
    expect(new Set(declared).size).toBe(declared.length);
    expect([...declared].sort()).toEqual(['cycle', 'run', 'swim', 'walk']);
  });

  it('lets a family answer only for the types it owns', () => {
    expect(familyOffersActivityType('walk-run', 'walk')).toBe(true);
    expect(familyOffersActivityType('walk-run', 'run')).toBe(true);
    expect(familyOffersActivityType('walk-run', 'cycle')).toBe(false);
    expect(familyOffersActivityType('cycle', 'run')).toBe(false);
    expect(familyOffersActivityType('swim', 'walk')).toBe(false);
  });

  it('labels them separately', () => {
    expect(journeyActivityLabel('walk')).toBe('Walk');
    expect(journeyActivityLabel('run')).toBe('Run');
    expect(journeyActivityLabel('walk')).not.toBe(journeyActivityLabel('run'));
  });
});

// --- 3 & 4. Choosing walk records a walk; choosing run records a run --------

describe('the chosen activity is the recorded activity', () => {
  it('records a walk as a walk', () => {
    const result = controller().start('walk', NOW);
    expect(result.created).toBe(true);
    expect(result.journey.activityType).toBe('walk');
    expect(controller().loadActive()?.activityType).toBe('walk');
  });

  it('records a run as a run', () => {
    const result = controller().start('run', NOW);
    expect(result.journey.activityType).toBe('run');
    expect(controller().loadActive()?.activityType).toBe('run');
  });

  it('records cycle and swim as themselves', () => {
    for (const activityType of ['cycle', 'swim'] as JourneyActivityType[]) {
      const store = createMemoryStorageAdapter();
      const started = createJourneyLaunchController(store, sequentialIdFactory('x'))
        .start(activityType, NOW);
      expect(started.journey.activityType).toBe(activityType);
    }
  });

  it('passes the user\'s choice through untouched, with nothing in between', () => {
    // The screen holds one selection and hands exactly it to the shared controller.
    expect(strip(launchScreen)).toContain('launch.start(chosen, nowIso())');
    expect(strip(launchScreen)).toContain("useState<JourneyActivityType | undefined>(undefined)");
  });

  it('requires an explicit choice on any door that offers more than one activity', () => {
    /*
     * RE-POINTED, NOT WEAKENED. `chosen` is the selection for a door with two
     * activities and the door's own single type for a door with one. The rule this
     * protects is unchanged and is asserted below against the real families: no door
     * may start something the user did not choose, and Walk/Run still starts nothing
     * until they say which.
     */
    const code = strip(launchScreen);
    expect(code).toContain('if (chosen === undefined) return;');
    expect(code).toContain('disabled={chosen === undefined}');
    expect(code).toContain('const sole = choices.length === 1 ? choices[0] : undefined');
    expect(code).toContain('const chosen = sole ?? selected');
    // Still no seeded selection of any kind.
    expect(code).toContain("useState<JourneyActivityType | undefined>(undefined)");
    expect(code).not.toMatch(/useState<[^>]*>\(\s*'walk'|useState\(\s*'walk'|useState\(\s*'run'|useState\(\s*'cycle'/);
  });

  it('leaves a two-activity door unstartable until the user picks, and only those', () => {
    // The rule is the family's shape, never a list of exceptions.
    expect(activityTypesForFamily('walk-run')).toHaveLength(2);
    expect(activityTypesForFamily('cycle')).toEqual(['cycle']);
    expect(activityTypesForFamily('swim')).toEqual(['swim']);

    // So `sole` is undefined for Walk/Run - Start stays disabled - and defined for a
    // one-activity door, where the door itself was the choice.
    for (const family of JOURNEY_ACTIVITY_FAMILIES) {
      const types = activityTypesForFamily(family.id);
      const soleIsDefined = types.length === 1;
      expect(soleIsDefined, family.id).toBe(family.id !== 'walk-run');
    }
  });
});

// --- 5 & 6. The launch layer is a door, not a recorder ----------------------

describe('the launch layer builds no recorder of its own', () => {
  it('starts no watcher, owns no route, holds no session', () => {
    const code = strip(launchScreen);
    expect(code).not.toMatch(
      /navigator\.geolocation|watchPosition|getCurrentPosition|GeolocationPosition/,
    );
    expect(code).not.toMatch(
      /startForegroundJourneyGpsSession|createJourneyGpsRuntimeController|journeyGeolocationAdapter/,
    );
    expect(code).not.toMatch(/acceptedPoints|rawPoints|segmentStarts|distance_m/);
    expect(code).not.toMatch(/saveActiveJourneySnapshot|saveJourneyToHistory|replaceJourneyHistory/);
  });

  it('duplicates no pause, resume, stop or recovery logic', () => {
    const code = strip(launchScreen);
    expect(code).not.toMatch(/pause|resume|\bstop\b|recovery|recover/i);
  });

  it('touches no route privacy of its own', () => {
    const code = strip(launchScreen);
    expect(code).not.toMatch(/privacy|visibility|maskSensitiveStartEnd|preciseRouteCloudSync/);
  });

  it('hands off to the existing active Journey experience', () => {
    const code = strip(launchScreen);
    expect(code).toContain('createJourneyLaunchController');
    expect(code).toContain('JOURNEY_ACTIVE_HASH');
  });

  it('leaves an interrupted Journey alone, because the shared controller does', () => {
    // Recovery evidence must survive a stray Start. This is the controller's existing
    // guarantee; the launch screen inherits it by using the controller.
    const first = controller().start('run', NOW);
    const second = controller().start('walk', '2026-08-14T13:00:00.000+01:00');
    expect(second.created).toBe(false);
    expect(second.journey.id).toBe(first.journey.id);
    expect(second.journey.activityType).toBe('run');
  });
});

// --- 7. A door cannot open onto the wrong activity --------------------------

describe('a family cannot launch an activity it does not own', () => {
  it('routes only families that actually have a companion screen', () => {
    expect(parseRouteFromHash('#/journey/launch/walk-run')).toEqual({
      kind: 'journey-launch',
      family: 'walk-run',
    });
  });

  it('routes Cycle to its own companion screen, now that it has one', () => {
    expect(parseRouteFromHash('#/journey/launch/cycle')).toEqual({
      kind: 'journey-launch',
      family: 'cycle',
    });
  });

  it('routes Swim to its own companion screen, now that it has one', () => {
    expect(parseRouteFromHash('#/journey/launch/swim')).toEqual({
      kind: 'journey-launch',
      family: 'swim',
    });
  });

  it('still refuses a launch route to anything that is not a family', () => {
    /*
     * All three families have a companion screen today, so the gate below is what
     * keeps this honest: it reads each family's own `launch` field rather than
     * assuming every door has a screen. A fourth family added without one is sent
     * home, and the guard that proves it is the loop in the next test.
     */
    for (const hash of ['#/journey/launch/walk', '#/journey/launch/nonsense']) {
      expect(parseRouteFromHash(hash), hash).toEqual({ kind: 'journey-home' });
    }
  });

  it('gates the launch route on the family actually having a screen', () => {
    // Not on a hard-coded list of ids. Every family agrees with its own `launch`.
    for (const family of JOURNEY_ACTIVITY_FAMILIES) {
      const route = parseRouteFromHash(journeyLaunchHash(family.id));
      expect(route, family.id).toEqual(
        family.launch === 'companion'
          ? { kind: 'journey-launch', family: family.id }
          : { kind: 'journey-home' },
      );
    }
  });

  it('sends an unknown or empty family back to Journey Home', () => {
    for (const hash of [
      '#/journey/launch/walk',
      '#/journey/launch/run',
      '#/journey/launch/nonsense',
      '#/journey/launch/',
    ]) {
      expect(parseRouteFromHash(hash), hash).toEqual({ kind: 'journey-home' });
    }
  });

  it('builds the launch hash from the family id alone', () => {
    expect(journeyLaunchHash('walk-run')).toBe('#/journey/launch/walk-run');
  });

  it('offers the launch screen only the types its own family owns', () => {
    expect(strip(launchScreen)).toContain('activityTypesForFamily(family)');
    expect(strip(launchScreen)).not.toMatch(/\['walk', 'run'\]|"walk"|'walk'/);
  });
});

// --- 8. Nothing infers the activity -----------------------------------------

describe('nothing infers walk versus run', () => {
  it('reads no speed, pace, distance or position to decide', () => {
    for (const [name, source] of [
      ['launch screen', strip(launchScreen)],
      ['families', strip(families)],
      ['Journey Home', strip(home)],
    ] as const) {
      expect(source, name).not.toMatch(
        /speedMps|\bpace\b|averageSpeed|kmPerHour|\bmph\b|heartRate|cadence/i,
      );
    }
    /*
     * Narrow on purpose: the families module is a table of labels, and one of those
     * labels legitimately reads "GPS route and distance". What it must not do is READ
     * a measurement, so this forbids the identifiers rather than the words.
     */
    expect(strip(families)).not.toMatch(
      /\.metrics|journeyDistanceM|distance_m|elapsedSeconds|movingSeconds|\.route\b/,
    );
  });

  it('never lets the artwork or the species decide anything', () => {
    const code = strip(launchScreen);
    // The whole of what happens when Start is pressed.
    const startAt = code.indexOf('const start = () => {');
    const startBody = code.slice(startAt, code.indexOf('};', startAt));
    expect(startAt).toBeGreaterThan(-1);
    expect(startBody).toContain('launch.start(chosen, nowIso())');
    expect(startBody).not.toMatch(/\bart\b|mascot|glyph|species|familyId/);
    // And nothing in the whole screen derives an activity from speed or position.
    expect(code).not.toMatch(/speed|pace|velocity|coords|latitude|longitude|geolocation/i);

    // And selection is only ever set by the user's own change handler.
    expect(code.match(/setSelected\(/g) ?? []).toHaveLength(1);
    expect(code).toContain('onChange={() => setSelected(activityType)}');
  });
});

// --- 9. Existing Journey content still reachable ----------------------------

describe('nothing existing was taken away', () => {
  it('keeps completed Journeys readable and reachable from Journey Home', () => {
    const journey = { ...controller().start('walk', NOW).journey, status: 'completed' as const };
    saveJourneyToHistory(adapter, journey);

    expect(loadJourneyHistory(adapter)).toHaveLength(1);
    expect(strip(home)).toContain('loadJourneyHistory(storage)');
    expect(strip(home)).toContain('journeyDetailHash(journey.id)');
  });

  it('keeps cycle and swim startable rather than disabling working behaviour', () => {
    /*
     * Both gained a companion screen; neither lost the ability to record. One tap
     * became two and the second is Start.
     *
     * The direct branch on Journey Home is now unused by any shipped family, and it
     * stays on purpose: `launch` is data, a family without a screen is a state the
     * type system still permits, and deleting the branch would make adding one a
     * bigger change than it should be. The route gate is tested against every
     * family's own field rather than against a list, so this cannot silently rot.
     */
    expect(journeyActivityFamily('cycle')?.launch).toBe('companion');
    expect(journeyActivityFamily('swim')?.launch).toBe('companion');
    expect(strip(home)).toContain('launch.start(activityType, nowIso())');

    // Both still record their own type, through the same controller as always.
    for (const activityType of ['cycle', 'swim'] as const) {
      const store = createMemoryStorageAdapter();
      const started = createJourneyLaunchController(store, sequentialIdFactory('c'))
        .start(activityType, NOW);
      expect(started.journey.activityType, activityType).toBe(activityType);
    }
  });

  it('keeps the continue-in-progress affordance', () => {
    expect(strip(home)).toContain('journey-home__continue');
  });
});

// --- 10. No game layer in this slice ----------------------------------------

describe('this slice adds no game layer', () => {
  it('grants, values and prestiges nothing', () => {
    for (const [name, source] of [
      ['launch screen', strip(launchScreen)],
      ['families', strip(families)],
      ['mascot art', strip(art)],
    ] as const) {
      expect(source, name).not.toMatch(
        /\bxp\b|grantRewards|deriveRewards|syncGame|useGame|trophy|prestige|leaderboard|personalBest/i,
      );
    }
  });
});

// --- 11. Mascot artwork resolves by species and activity --------------------

describe('mascot artwork has one boundary, not scattered paths', () => {
  it('resolves by species and activity family', () => {
    const manifest = {
      'tortoise:walk-run': { src: '/mascots/tortoise/x.webp', alt: 'Tortoise' },
    } as const;
    expect(mascotActivityArt('tortoise', 'walk-run', manifest)?.src)
      .toBe('/mascots/tortoise/x.webp');
    expect(mascotActivityArt('tortoise', 'cycle', manifest)).toBeUndefined();
    expect(mascotActivityArt('bear', 'walk-run', manifest)).toBeUndefined();
  });

  it('declares exactly the artwork that has been reviewed, and no more', () => {
    // The tortoise on the Walk/Run door is the one reviewed asset. Every other key is
    // still absent, and this test is the thing that notices if a species quietly
    // acquires a manifest entry without a file behind it.
    expect(Object.keys(MASCOT_ACTIVITY_ART).sort())
      .toEqual(['tortoise:cycle', 'tortoise:swim', 'tortoise:walk-run']);
  });

  it('writes the intended location down once, keyed by species and family', () => {
    expect(mascotActivityArtPath('tortoise', 'walk-run'))
      .toBe('/mascots/tortoise/tortoise-journey-walk-run.webp');
    expect(mascotActivityArtPath('otter', 'swim'))
      .toBe('/mascots/otter/otter-journey-swim.webp');
  });

  it('lets no screen hardcode a mascot image path', () => {
    const uiSources = import.meta.glob('../ui/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    for (const [path, source] of Object.entries(uiSources)) {
      /*
       * The reviewed art registries are the ONE place a mascot asset URL may be
       * written down - that is their whole job. `mascotActivityArt` owns Journey
       * door artwork; `mascotStageArt` owns standing/companion stage artwork. Every
       * other module under ui/ must ask one of them rather than learn a path.
       */
      if (path.endsWith('mascotActivityArt.ts')) continue;
      if (path.endsWith('mascotStageArt.ts')) continue;
      expect(strip(source), `${path} hardcodes a mascot asset path`).not.toMatch(
        /['"`]\/mascots\/|assets\/mascots\//,
      );
    }
  });

  it('falls back to the existing temporary treatment when there is no artwork', () => {
    const code = strip(launchScreen);
    expect(code).toContain('art !== undefined');
    expect(code).toContain('mascot?.glyph');
  });
});

// --- 12. The tortoise Walk/Run asset is real, and reached through the boundary ---

/**
 * The first real Journey mascot asset.
 *
 * These guard two different failures. One is the manifest claiming a file that is not
 * there, which shows every tortoise user a broken image. The other is the screen
 * learning the path - which would work perfectly today and make the next four species
 * impossible to add without editing a component.
 */
describe('the tortoise Walk/Run artwork', () => {
  const ROOT = fileURLToPath(new URL('../..', import.meta.url));
  const PRODUCTION_SRC = '/mascots/tortoise/tortoise-journey-walk-run.webp';

  it('resolves for tortoise on the Walk/Run door', () => {
    const resolved = mascotActivityArt('tortoise', 'walk-run');
    expect(resolved?.src).toBe(PRODUCTION_SRC);
    expect(resolved?.alt.length).toBeGreaterThan(0);
  });

  it('sits at the location the path helper names, not somewhere near it', () => {
    // If these two ever drift, the README's contract is a lie and the next species
    // gets filed in the wrong place.
    expect(mascotActivityArt('tortoise', 'walk-run')?.src)
      .toBe(mascotActivityArtPath('tortoise', 'walk-run'));
  });

  it('points at a file that actually exists, and is actually a WebP', () => {
    const file = join(ROOT, 'public', PRODUCTION_SRC.replace(/^\//, ''));
    expect(existsSync(file), `${PRODUCTION_SRC} is declared but missing from public/`)
      .toBe(true);

    // Extension is a claim; the magic bytes are the fact. A PNG renamed to .webp
    // would pass an existence check and still be the wrong thing to ship.
    const head = readFileSync(file, 'latin1').slice(0, 12);
    expect(head.slice(0, 4)).toBe('RIFF');
    expect(head.slice(8, 12)).toBe('WEBP');

    // Well inside the per-image budget the asset pipeline sets for production art.
    expect(statSync(file).size).toBeLessThan(250 * 1024);
    expect(statSync(file).size).toBeGreaterThan(0);
  });

  it('is production art, served from public/ and never from the reference library', () => {
    for (const entry of Object.values(MASCOT_ACTIVITY_ART)) {
      expect(entry?.src).toMatch(/^\/mascots\//);
      expect(entry?.src).not.toMatch(/docs\/|reference|concept|sheet|\.verify/i);
    }
  });

  it('keeps its reviewed source in docs/, out of the runtime path', () => {
    const source = join(
      ROOT,
      'docs',
      'brand',
      'reference',
      'mascots',
      'ninfit-tortoise-journey-walk-run-reference-v1.png',
    );
    expect(existsSync(source), 'the reviewed source sheet should be preserved').toBe(true);
  });

  it('says who is pictured without claiming what the user is about to do', () => {
    // The alt text must not decide the activity. The user decides the activity.
    const alt = mascotActivityArt('tortoise', 'walk-run')?.alt ?? '';
    expect(alt).not.toMatch(/\b(walk|walking|run|running|jog|jogging|your)\b/i);
  });

  it('does not let the tortoise having art weaken the fallback for anyone else', () => {
    /*
     * The tortoise is complete, so it no longer exercises the `undefined` path at
     * all. That makes this guard MORE load-bearing rather than less: every remaining
     * species is the only thing still proving the fallback works, and twelve of the
     * fifteen keys are still empty.
     */
    for (const species of ['bear', 'fox', 'otter', 'wolf'] as const) {
      for (const family of JOURNEY_ACTIVITY_FAMILIES) {
        expect(mascotActivityArt(species, family.id), `${species}:${family.id}`)
          .toBeUndefined();
      }
    }

    // The screen still has both branches, and the letter is still the other one.
    const code = strip(launchScreen);
    expect(code).toContain('art !== undefined');
    expect(code).toContain('journey-launch__portrait-mark');
  });

  it('is never named by the screen that shows it', () => {
    const code = strip(launchScreen);
    expect(code).not.toContain('tortoise');
    expect(code).not.toContain('.webp');
    expect(code).not.toContain('/mascots/');
    // It asks the boundary instead.
    expect(code).toContain('mascotActivityArt(mascot.id, family)');
  });

  it('changed presentation only, and left the two activity truths alone', () => {
    // Walk and Run remain separate types behind one door, exactly as before the art.
    expect(activityTypesForFamily('walk-run')).toEqual(['walk', 'run']);
    expect(familyOffersActivityType('walk-run', 'walk')).toBe(true);
    expect(familyOffersActivityType('walk-run', 'run')).toBe(true);
    expect(familyOffersActivityType('walk-run', 'cycle')).toBe(false);

    // Recording still yields the chosen type, not a merged one.
    for (const activityType of ['walk', 'run'] as const) {
      const store = createMemoryStorageAdapter();
      const started = createJourneyLaunchController(store, sequentialIdFactory('a'))
        .start(activityType, NOW);
      expect(started.journey.activityType).toBe(activityType);
    }

    // And the art layer keys on the DOOR, never on the two activities behind it, so
    // no picture can ever become the thing that decides what got recorded.
    for (const key of Object.keys(MASCOT_ACTIVITY_ART)) {
      const family = key.split(':')[1] ?? '';
      expect(isJourneyActivityFamilyId(family), key).toBe(true);
    }
    expect(strip(art)).not.toMatch(/activityType|'walk'|'run'|personalBest/);
  });

  it('moved no recorder, privacy or schema concern into the presentation layer', () => {
    for (const [name, source] of [
      ['mascot art', strip(art)],
      ['launch screen', strip(launchScreen)],
    ] as const) {
      expect(source, name).not.toMatch(
        /geolocation|watchPosition|GpsSession|recorder|recovery|schemaVersion|SCHEMA_VERSION/i,
      );
      expect(source, name).not.toMatch(/\bxp\b|grantRewards|deriveRewards|trophy|prestige/i);
    }
  });
});

// --- 13. The Journey Home activity medallion --------------------------------

/**
 * The small door, wearing the picture behind it.
 *
 * Journey Home now shows the same artwork the launch screen shows, at doorway size.
 * The risk this creates is not that the picture is wrong - it is that Journey Home
 * learns where pictures live, or that one species' art starts appearing on another
 * species' door or another activity's. These guard the boundary, not the pixels.
 */
describe('Journey Home shows the activity medallion through the same boundary', () => {
  const homeCss = readFileSync(
    join(SRC, 'styles', 'screens', 'journey.css'),
    'utf8',
  );

  it('asks the central art boundary, keyed by species and family', () => {
    const code = strip(home);
    expect(code).toContain("from '../mascotActivityArt'");
    expect(code).toContain('mascotActivityArt(mascot.id, family.id)');
  });

  it('never names a species, a file or an asset folder', () => {
    const code = strip(home);
    expect(code).not.toContain('tortoise');
    expect(code).not.toContain('.webp');
    expect(code).not.toContain('/mascots/');
    expect(code).not.toContain('docs/');
  });

  it('renders the real artwork for tortoise on the Walk/Run door', () => {
    // The screen resolves `art` per family from this manifest; the manifest is what
    // decides. Both halves are asserted so neither can drift alone.
    expect(mascotActivityArt('tortoise', 'walk-run')?.src)
      .toBe(mascotActivityArtPath('tortoise', 'walk-run'));
    expect(strip(home)).toContain('art !== undefined ?');
  });

  it('keeps the letter for every door with no reviewed art', () => {
    // No tortoise door is on the fallback any more, so a species that has none is
    // what proves the branch is still reachable and still correct.
    for (const family of JOURNEY_ACTIVITY_FAMILIES) {
      expect(mascotActivityArt('bear', family.id), family.id).toBeUndefined();
    }

    // The branch that draws it still exists, and still draws the family's own mark.
    const code = strip(home);
    expect(code).toContain('family.mark');
    expect(code).toContain('journey-home__activity-mark');
  });

  it('never lends one door\'s artwork to another', () => {
    /*
     * Cycle has its own reviewed picture now, which makes this guard MORE important
     * rather than less: the failure it exists to catch is a door showing the wrong
     * activity's art, and there are now two real pictures that could be swapped.
     */
    const walkRun = mascotActivityArt('tortoise', 'walk-run')?.src;
    const cycle = mascotActivityArt('tortoise', 'cycle')?.src;
    expect(walkRun).toBeDefined();
    expect(cycle).toBeDefined();
    expect(cycle).not.toBe(walkRun);

    // Each names its own family in its own file, so neither can quietly be the other.
    expect(walkRun).toContain('walk-run');
    expect(cycle).toContain('cycle');
    expect(walkRun).not.toContain('journey-cycle');
    expect(cycle).not.toContain('journey-walk-run');

    // And the third door is its own picture too, not a copy of either.
    const swim = mascotActivityArt('tortoise', 'swim')?.src;
    expect(swim).toBeDefined();
    expect(swim).toContain('swim');
    expect(new Set([walkRun, cycle, swim]).size).toBe(3);
  });

  it('never lends the tortoise artwork to another species', () => {
    const tortoise = mascotActivityArt('tortoise', 'walk-run')?.src;
    for (const species of ['bear', 'fox', 'otter', 'wolf'] as const) {
      for (const family of JOURNEY_ACTIVITY_FAMILIES) {
        const resolved = mascotActivityArt(species, family.id);
        expect(resolved, `${species}:${family.id}`).toBeUndefined();
        expect(resolved?.src, `${species}:${family.id}`).not.toBe(tortoise);
      }
    }
  });

  it('still only opens the door, and starts nothing on the way through', () => {
    // The whole of what the tile's click handler does.
    const code = strip(home);
    const openAt = code.indexOf('const open = (family: JourneyActivityFamily) => {');
    expect(openAt).toBeGreaterThan(-1);
    const openBody = code.slice(openAt, code.indexOf('\n  };', openAt));

    // A companion family navigates. It does not start, and it never reads the art.
    expect(openBody).toContain('journeyLaunchHash(family.id)');
    expect(openBody).not.toMatch(/\bart\b|mascotActivityArt|\.src|glyph/);

    // And the route it navigates to is the existing launch route, unchanged.
    expect(parseRouteFromHash(journeyLaunchHash('walk-run')))
      .toEqual({ kind: 'journey-launch', family: 'walk-run' });
  });

  it('leaves the Walk/Run door with no way to record anything itself', () => {
    /*
     * The companion branch, on its own.
     *
     * Checking the whole of `open` is not enough, and a mutation proved it: a branch
     * that starts a walk AND THEN navigates satisfies every "does it navigate?"
     * assertion while quietly writing a Journey nobody chose. `open` legitimately
     * calls `start` for Cycle and Swim, so the only honest guard is to read the
     * companion branch alone and require that it does nothing but navigate.
     */
    expect(journeyActivityFamily('walk-run')?.launch).toBe('companion');

    const code = strip(home);
    const openAt = code.indexOf('const open = (family: JourneyActivityFamily) => {');
    expect(openAt).toBeGreaterThan(-1);
    const openBody = code.slice(openAt, code.indexOf('\n  };', openAt));

    const branchAt = openBody.indexOf("if (family.launch === 'companion') {");
    expect(branchAt, 'the companion branch has gone').toBeGreaterThan(-1);
    const branch = openBody.slice(branchAt, openBody.indexOf('\n    }', branchAt));

    // What it must do.
    expect(branch).toContain('window.location.hash = journeyLaunchHash(family.id)');
    expect(branch).toContain('return;');

    // And the whole of what it must not: no recording, no timestamp to record with,
    // no reward or game write on the way through a door.
    expect(branch).not.toMatch(/start\s*\(|nowIso|loadActive|saveJourney|grantRewards|syncGame/);
  });

  it('moves no recorder, privacy, schema or reward truth into Journey Home', () => {
    const code = strip(home);
    expect(code).not.toMatch(
      /geolocation|watchPosition|GpsSession|acceptedPoints|rawPoints|segmentStarts/i,
    );
    expect(code).not.toMatch(/maskSensitiveStartEnd|preciseRouteCloudSync|schemaVersion/i);
    expect(code).not.toMatch(/\bxp\b|grantRewards|deriveRewards|syncGame|useGame|trophy|prestige/i);
    // Reads, never syncs - the rule this screen already followed.
    expect(code).toContain('repository.getGameState()');
  });

  /** Just the medallion rules, so neighbouring CSS cannot satisfy these by accident. */
  const MEDALLION_FROM = homeCss.indexOf(".journey-home__activity-mark[data-art='true']");
  const MEDALLION_TO = homeCss.indexOf('.journey-home__activity span:last-child');
  const medallionCss = MEDALLION_FROM === -1 || MEDALLION_TO <= MEDALLION_FROM
    ? ''
    : homeCss.slice(MEDALLION_FROM, MEDALLION_TO);

  it('has a medallion rule at all, so the guards below cannot pass by vacuum', () => {
    expect(MEDALLION_FROM, 'medallion rule missing from journey.css').toBeGreaterThan(-1);
    expect(medallionCss.length).toBeGreaterThan(0);
  });

  it('cannot push the page sideways at any width', () => {
    // The medallion is capped by the tile rather than by a fixed square, so there is
    // no viewport at which it can be wider than the space it was given.
    expect(medallionCss).toContain('max-width: 100%');
    expect(medallionCss).toContain('aspect-ratio: 1');
    // And the artwork letterboxes inside that square rather than stretching to it.
    expect(medallionCss).toContain('object-fit: contain');
  });

  it('adds no motion of its own, and leaves the global reduced-motion rule intact', () => {
    // The tile's existing hover and press are the whole interaction language. A
    // medallion that animated by itself would be the arcade treatment this is not.
    expect(medallionCss).not.toMatch(/animation|transition|@keyframes/);

    // And the press affordance is still cancelled for anyone who asked for less.
    expect(homeCss).toContain('prefers-reduced-motion: reduce');
    const reduced = homeCss.slice(homeCss.indexOf('prefers-reduced-motion: reduce'));
    expect(reduced).toContain('transform: none');
  });

  it('keeps the medallion decorative and the door itself labelled', () => {
    const code = strip(home);
    // The picture is hidden from assistive tech and carries no text of its own.
    expect(code).toContain('aria-hidden="true"');
    expect(code).toContain('alt=""');
    // The door's name and note are what actually label it.
    expect(code).toContain('{family.label}');
    expect(code).toContain('{family.note}');
    // And nothing here claims the user did, earned or achieved anything.
    expect(mascotActivityArt('tortoise', 'walk-run')?.alt ?? '')
      .not.toMatch(/walked|ran|completed|earned|achieved|well done|congratulat/i);
  });
});
