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
    expect(strip(launchScreen)).toContain('launch.start(selected, nowIso())');
    expect(strip(launchScreen)).toContain("useState<JourneyActivityType | undefined>(undefined)");
  });

  it('requires an explicit choice before anything can start', () => {
    const code = strip(launchScreen);
    // No default selection, and Start cannot fire without one.
    expect(code).toContain('if (selected === undefined) return;');
    expect(code).toContain('disabled={selected === undefined}');
    expect(code).not.toMatch(/useState<[^>]*>\(\s*'walk'|useState\(\s*'walk'|useState\(\s*'run'/);
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

  it('sends a family with no companion screen back to Journey Home', () => {
    // Cycle and Swim launch directly today. A typed URL must not conjure a Walk/Run
    // screen for them, and must not crash either.
    expect(parseRouteFromHash('#/journey/launch/cycle')).toEqual({ kind: 'journey-home' });
    expect(parseRouteFromHash('#/journey/launch/swim')).toEqual({ kind: 'journey-home' });
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
    expect(startBody).toContain('launch.start(selected, nowIso())');
    expect(startBody).not.toMatch(/\bart\b|mascot|glyph|species|familyId/);

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
    expect(journeyActivityFamily('cycle')?.launch).toBe('direct');
    expect(journeyActivityFamily('swim')?.launch).toBe('direct');
    expect(strip(home)).toContain('launch.start(activityType, nowIso())');
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
    expect(Object.keys(MASCOT_ACTIVITY_ART).sort()).toEqual(['tortoise:walk-run']);
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
      if (path.endsWith('mascotActivityArt.ts')) continue;
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
    // Every other species on the same door.
    for (const species of ['bear', 'fox', 'otter', 'wolf'] as const) {
      expect(mascotActivityArt(species, 'walk-run'), species).toBeUndefined();
    }
    // And the tortoise's own doors that have no art yet.
    expect(mascotActivityArt('tortoise', 'cycle')).toBeUndefined();
    expect(mascotActivityArt('tortoise', 'swim')).toBeUndefined();

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
