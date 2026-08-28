import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createJourneyLaunchController,
  journeyUsesPhoneGps,
} from '../app/journeyLaunchController';
import { createJourneyRecoveryController } from '../app/journeyRecoveryController';
import { sequentialIdFactory } from '../domain/ids';
import { loadActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { loadJourneyHistory } from '../storage/journeyHistory';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import {
  JOURNEY_ACTIVITY_FAMILIES,
  activityTypesForFamily,
  journeyActivityFamily,
  journeyActivityFamilyForType,
} from '../ui/journeyActivityFamilies';
import { MASCOT_ACTIVITY_ART, mascotActivityArt, mascotActivityArtPath } from '../ui/mascotActivityArt';
import { journeyCompleteHash, journeyLaunchHash, parseRouteFromHash } from '../ui/tabs';

/**
 * The tortoise Swim activity space - and the completion of the first mascot family.
 *
 * Swim is the one activity that never uses the phone's location, so this suite
 * carries a guard the other two did not need: the readiness copy must not claim a
 * location behaviour the recorder does not have.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const launchScreen = read('ui', 'screens', 'JourneyLaunchScreen.tsx');
const home = read('ui', 'screens', 'JourneyScreen.tsx');
const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
const active = read('ui', 'screens', 'ActiveJourneyScreen.tsx');

const SWIM_SRC = '/mascots/tortoise/tortoise-journey-swim.webp';
const NOW = '2026-08-28T09:00:00.000+01:00';
const END = '2026-08-28T09:40:00.000+01:00';

let adapter: StorageAdapter;
beforeEach(() => { adapter = createMemoryStorageAdapter(); });

// --- The reviewed asset ------------------------------------------------------

describe('the Swim medallion is a real reviewed asset', () => {
  it('resolves for tortoise on the Swim door', () => {
    const resolved = mascotActivityArt('tortoise', 'swim');
    expect(resolved?.src).toBe(SWIM_SRC);
    expect(resolved?.alt.length).toBeGreaterThan(0);
  });

  it('sits where the path helper says', () => {
    expect(mascotActivityArt('tortoise', 'swim')?.src)
      .toBe(mascotActivityArtPath('tortoise', 'swim'));
  });

  it('points at a file that exists, is genuinely a WebP, and is within budget', () => {
    const file = join(ROOT, 'public', SWIM_SRC.replace(/^\//, ''));
    expect(existsSync(file), `${SWIM_SRC} is declared but missing from public/`).toBe(true);

    const head = readFileSync(file, 'latin1').slice(0, 12);
    expect(head.slice(0, 4)).toBe('RIFF');
    expect(head.slice(8, 12)).toBe('WEBP');

    const bytes = statSync(file).size;
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(250 * 1024);
  });

  it('keeps its reviewed source in docs/, out of the runtime path', () => {
    const source = join(
      ROOT, 'docs', 'brand', 'reference', 'mascots',
      'ninfit-tortoise-journey-swim-reference-v1.png',
    );
    expect(existsSync(source)).toBe(true);
    expect(readFileSync(source, 'latin1').slice(1, 4)).toBe('PNG');
  });

  it('says who is pictured without claiming a distance, a place or a time', () => {
    const alt = mascotActivityArt('tortoise', 'swim')?.alt ?? '';
    expect(alt).not.toMatch(/\b(your|you|fast|far|distance|km|lengths?|laps?|pace|pool|best)\b/i);
  });

  it('every declared entry is served from public/, never from docs/', () => {
    for (const entry of Object.values(MASCOT_ACTIVITY_ART)) {
      expect(entry?.src).toMatch(/^\/mascots\//);
      expect(entry?.src).not.toMatch(/docs\/|reference|concept|sheet|\.verify/i);
    }
  });
});

// --- Isolation, now that the family is complete ------------------------------

describe('three pictures, three doors, no borrowing', () => {
  it('declares exactly one entry per tortoise door and nothing else', () => {
    expect(Object.keys(MASCOT_ACTIVITY_ART).sort())
      .toEqual(['tortoise:cycle', 'tortoise:swim', 'tortoise:walk-run']);
  });

  it('gives every door a picture no other door has', () => {
    const srcs = JOURNEY_ACTIVITY_FAMILIES.map((f) => mascotActivityArt('tortoise', f.id)?.src);
    expect(srcs.every((s) => s !== undefined)).toBe(true);
    expect(new Set(srcs).size).toBe(3);
  });

  it('names each file for the door it belongs to', () => {
    // A swapped pair would still be three distinct files; the names are what catch it.
    expect(mascotActivityArt('tortoise', 'walk-run')?.src).toContain('journey-walk-run');
    expect(mascotActivityArt('tortoise', 'cycle')?.src).toContain('journey-cycle');
    expect(mascotActivityArt('tortoise', 'swim')?.src).toContain('journey-swim');
  });

  it('never lets Swim show another activity\'s picture', () => {
    const swim = mascotActivityArt('tortoise', 'swim')?.src;
    expect(swim).not.toBe(mascotActivityArt('tortoise', 'walk-run')?.src);
    expect(swim).not.toBe(mascotActivityArt('tortoise', 'cycle')?.src);
    expect(swim).not.toContain('walk-run');
    expect(swim).not.toContain('journey-cycle');
  });

  it('gives no other species the Swim picture, or any tortoise picture', () => {
    const tortoise = new Set(
      JOURNEY_ACTIVITY_FAMILIES
        .map((f) => mascotActivityArt('tortoise', f.id)?.src)
        .filter((s): s is string => s !== undefined),
    );
    for (const species of ['bear', 'fox', 'otter', 'wolf'] as const) {
      for (const family of JOURNEY_ACTIVITY_FAMILIES) {
        const resolved = mascotActivityArt(species, family.id);
        expect(resolved, `${species}:${family.id}`).toBeUndefined();
        expect(tortoise.has(resolved?.src ?? '')).toBe(false);
      }
    }
  });

  it('keeps the fallback alive for the twelve keys that are still empty', () => {
    /*
     * The tortoise no longer exercises the `undefined` path at all, so the other four
     * species are now the ONLY thing proving the fallback still works. This guard is
     * the reason the letter branch cannot quietly rot.
     */
    let empty = 0;
    for (const species of ['tortoise', 'bear', 'fox', 'otter', 'wolf'] as const) {
      for (const family of JOURNEY_ACTIVITY_FAMILIES) {
        if (mascotActivityArt(species, family.id) === undefined) empty += 1;
      }
    }
    expect(empty).toBe(12);
    expect(strip(home)).toContain('family.mark');
    expect(strip(launchScreen)).toContain('journey-launch__portrait-mark');
  });
});

// --- No screen names the asset ----------------------------------------------

describe('no screen names the Swim asset, the species or the folder', () => {
  for (const [name, source] of [
    ['Journey Home', home],
    ['launch screen', launchScreen],
  ] as const) {
    it(`${name} goes through the one boundary`, () => {
      const code = strip(source);
      expect(code).not.toContain('tortoise');
      expect(code).not.toContain('.webp');
      expect(code).not.toContain('/mascots/');
      expect(code).not.toContain('docs/');
      expect(code).not.toMatch(/'swim'|"swim"/);
      expect(code).toContain("from '../mascotActivityArt'");
    });
  }

  it('maps the swim activity type to its own door', () => {
    expect(journeyActivityFamilyForType('swim')).toBe('swim');
  });
});

// --- The doorway -------------------------------------------------------------

describe('the Swim doorway opens a screen and records nothing on the way', () => {
  it('is a companion door', () => {
    expect(journeyActivityFamily('swim')?.launch).toBe('companion');
  });

  it('routes #/journey/launch/swim to the Swim launch screen', () => {
    expect(parseRouteFromHash(journeyLaunchHash('swim')))
      .toEqual({ kind: 'journey-launch', family: 'swim' });
  });

  it('navigates rather than records when the door is opened', () => {
    const code = strip(home);
    const openAt = code.indexOf('const open = (family: JourneyActivityFamily) => {');
    expect(openAt).toBeGreaterThan(-1);
    const openBody = code.slice(openAt, code.indexOf('\n  };', openAt));
    const branchAt = openBody.indexOf("if (family.launch === 'companion') {");
    expect(branchAt).toBeGreaterThan(-1);
    const branch = openBody.slice(branchAt, openBody.indexOf('\n    }', branchAt));

    expect(branch).toContain('window.location.hash = journeyLaunchHash(family.id)');
    expect(branch).toContain('return;');
    expect(branch).not.toMatch(/start\s*\(|nowIso|saveJourney|grantRewards|syncGame/);
  });

  it('offers no activity selector, because the door owns one activity', () => {
    expect(activityTypesForFamily('swim')).toEqual(['swim']);
    const code = strip(launchScreen);
    expect(code).toContain('const sole = choices.length === 1 ? choices[0] : undefined');
    expect(code).toContain('{sole === undefined ? (');
  });

  it('leaves Walk/Run with no default selection', () => {
    /*
     * The single-activity path must never leak into the two-activity door. Walk/Run
     * owns two types, so `sole` is undefined there and Start stays disabled until the
     * user says which - a default would write a guess into their fitness history.
     */
    expect(activityTypesForFamily('walk-run')).toHaveLength(2);
    const code = strip(launchScreen);
    expect(code).toContain('const chosen = sole ?? selected');
    expect(code).toContain('disabled={chosen === undefined}');
    expect(code).toContain("useState<JourneyActivityType | undefined>(undefined)");
    expect(code).not.toMatch(/useState\(\s*'(walk|run|cycle|swim)'/);
  });

  it('starts exactly `swim`, through the existing controller', () => {
    const started = createJourneyLaunchController(adapter, sequentialIdFactory('s'))
      .start('swim', NOW);
    expect(started.created).toBe(true);
    expect(started.journey.activityType).toBe('swim');
    expect(loadActiveJourneySnapshot(adapter)).not.toBeNull();

    const code = strip(launchScreen);
    expect(code).toContain('createJourneyLaunchController');
    expect(code).toContain('launch.start(chosen, nowIso())');
    expect(code).not.toContain("status: 'recording'");
    expect(code).not.toContain("kind: 'ninfit_phone_gps'");
  });
});

// --- The readiness copy must match what the recorder actually does -----------

describe('the launch screen tells the truth about location', () => {
  it('agrees with the recorder about which activities use phone GPS', () => {
    expect(journeyUsesPhoneGps('walk')).toBe(true);
    expect(journeyUsesPhoneGps('run')).toBe(true);
    expect(journeyUsesPhoneGps('cycle')).toBe(true);
    expect(journeyUsesPhoneGps('swim')).toBe(false);
  });

  it('asks that one predicate rather than naming a family', () => {
    const code = strip(launchScreen);
    expect(code).toContain('journeyUsesPhoneGps');
    expect(code).toContain('const usesLocation = choices.some(journeyUsesPhoneGps)');
    // Derived from the door's types, never from its id.
    expect(code).not.toMatch(/family === 'swim'|family !== 'swim'/);
  });

  it('does not tell a swimmer that location is used while recording', () => {
    // The GPS line is conditional, and the no-location wording exists.
    const code = strip(launchScreen);
    expect(code).toContain('usesLocation');
    expect(code).toContain('NinFit does not use location for this activity.');
    expect(code).toContain('Location is used only while a Journey is recording.');
  });

  it('gives a swim a manual source and no GPS source at all', () => {
    const started = createJourneyLaunchController(adapter, sequentialIdFactory('s'))
      .start('swim', NOW);
    const kinds = started.journey.sources.map((s) => s.kind);
    expect(kinds).toContain('manual');
    expect(kinds).not.toContain('ninfit_phone_gps');
  });

  it('still gives a walk a phone GPS source, unchanged', () => {
    const store = createMemoryStorageAdapter();
    const started = createJourneyLaunchController(store, sequentialIdFactory('w'))
      .start('walk', NOW);
    expect(started.journey.sources.map((s) => s.kind)).toContain('ninfit_phone_gps');
  });

  it('keeps the privacy line on every door', () => {
    expect(strip(launchScreen)).toContain('Journeys stay private on this device by default.');
  });
});

// --- No recorder in the presentation layer ----------------------------------

describe('the Swim presentation layer builds no recorder', () => {
  it('creates no watcher, session or geolocation of its own', () => {
    const code = strip(launchScreen);
    expect(code).not.toMatch(
      /navigator\.geolocation|watchPosition|clearWatch|GpsSession|GpsRuntime|journeyGeolocationAdapter/i,
    );
  });

  it('derives activity truth from the door, never from the water or the artwork', () => {
    for (const [name, source] of [
      ['launch screen', strip(launchScreen)],
      ['Journey Home', strip(home)],
    ] as const) {
      expect(source, name).not.toMatch(/speed|pace|velocity|stroke|cadence/i);
      expect(source, name).not.toMatch(/coords|latitude|longitude|accuracy/i);
    }
  });

  it('adds no reward, XP or schema logic', () => {
    for (const [name, source] of [
      ['launch screen', strip(launchScreen)],
      ['mascot art', strip(read('ui', 'mascotActivityArt.ts'))],
      ['families', strip(read('ui', 'journeyActivityFamilies.ts'))],
    ] as const) {
      expect(source, name).not.toMatch(
        /\bxp\b|grantRewards|deriveRewards|syncGame|useGame|trophy|prestige|leaderboard|personalBest/i,
      );
      expect(source, name).not.toMatch(/schemaVersion|SCHEMA_VERSION/);
    }
  });
});

// --- The full loop, through the one existing architecture -------------------

describe('a Swim Journey finishes through the existing architecture', () => {
  it('records, pauses, resumes and completes as `swim` throughout', () => {
    const launch = createJourneyLaunchController(adapter, sequentialIdFactory('s'));
    const recovery = createJourneyRecoveryController(adapter);

    const started = launch.start('swim', NOW).journey;
    expect(started.activityType).toBe('swim');

    const paused = recovery.pause(started, '2026-08-28T09:12:00.000+01:00');
    expect(paused.status).toBe('paused');

    const resumed = recovery.resume(paused, '2026-08-28T09:18:00.000+01:00');
    expect(resumed.status).toBe('recording');

    const completed = recovery.complete(resumed, END);
    expect(completed.status).toBe('completed');
    expect(completed.activityType).toBe('swim');

    const history = loadJourneyHistory(adapter);
    expect(history).toHaveLength(1);
    expect(history[0]?.activityType).toBe('swim');
    expect(loadActiveJourneySnapshot(adapter)).toBeNull();
  });

  it('reaches the one completion experience, not a Swim-specific one', () => {
    expect(app).toContain('onCompleted={(journeyId) => navigate(journeyCompleteHash(journeyId))}');
    expect(strip(active)).toContain('onCompleted?.(next.id)');
    expect(parseRouteFromHash(journeyCompleteHash('s-1')))
      .toEqual({ kind: 'journey-complete', journeyId: 's-1' });
    expect(app).not.toMatch(/SwimCompletion|SwimFinish|SwimSummary/);
  });

  it('shows the Swim medallion on the completion moment through the same boundary', () => {
    const completion = strip(read('ui', 'screens', 'JourneyCompletionScreen.tsx'));
    expect(completion).toContain('journeyActivityFamilyForType(journey.activityType)');
    expect(completion).toContain('mascotActivityArt(mascot.id, family)');
    expect(completion).not.toContain('swim');
  });
});

// --- Walk/Run and Cycle are untouched ---------------------------------------

describe('Walk/Run and Cycle behaviour is preserved exactly', () => {
  it('keeps both doors, both routes and both pictures', () => {
    for (const family of ['walk-run', 'cycle'] as const) {
      expect(journeyActivityFamily(family)?.launch).toBe('companion');
      expect(parseRouteFromHash(journeyLaunchHash(family)))
        .toEqual({ kind: 'journey-launch', family });
      expect(mascotActivityArt('tortoise', family)).toBeDefined();
    }
  });

  it('keeps every activity recording as itself', () => {
    for (const activityType of ['walk', 'run', 'cycle', 'swim'] as const) {
      const store = createMemoryStorageAdapter();
      const started = createJourneyLaunchController(store, sequentialIdFactory('a'))
        .start(activityType, NOW);
      expect(started.journey.activityType, activityType).toBe(activityType);
    }
  });

  it('keeps walk and run as two types behind one door', () => {
    expect(activityTypesForFamily('walk-run')).toEqual(['walk', 'run']);
  });
});
