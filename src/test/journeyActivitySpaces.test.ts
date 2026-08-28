import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('declares no artwork today, because none has been reviewed', () => {
    expect(Object.keys(MASCOT_ACTIVITY_ART)).toEqual([]);
    for (const family of JOURNEY_ACTIVITY_FAMILIES) {
      expect(mascotActivityArt('tortoise', family.id)).toBeUndefined();
    }
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
