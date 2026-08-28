import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { createJourneyLaunchController } from '../app/journeyLaunchController';
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
 * The tortoise Cycle activity space.
 *
 * Cycle reaches parity with Walk/Run: its own reviewed medallion, its own doorway,
 * its own launch screen. What must NOT change is the truth underneath - a cycle is
 * recorded as `cycle`, chosen by the user opening that door and pressing Start, and
 * finished through the one completion path that already exists.
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

const CYCLE_SRC = '/mascots/tortoise/tortoise-journey-cycle.webp';
const NOW = '2026-08-28T09:00:00.000+01:00';
const END = '2026-08-28T09:42:00.000+01:00';

let adapter: StorageAdapter;
beforeEach(() => { adapter = createMemoryStorageAdapter(); });

// --- 1-4. The reviewed asset ------------------------------------------------

describe('the Cycle medallion is a real reviewed asset', () => {
  it('resolves for tortoise on the Cycle door', () => {
    const resolved = mascotActivityArt('tortoise', 'cycle');
    expect(resolved?.src).toBe(CYCLE_SRC);
    expect(resolved?.alt.length).toBeGreaterThan(0);
  });

  it('sits where the path helper says, not somewhere near it', () => {
    expect(mascotActivityArt('tortoise', 'cycle')?.src)
      .toBe(mascotActivityArtPath('tortoise', 'cycle'));
  });

  it('points at a file that exists and is genuinely a WebP', () => {
    const file = join(ROOT, 'public', CYCLE_SRC.replace(/^\//, ''));
    expect(existsSync(file), `${CYCLE_SRC} is declared but missing from public/`).toBe(true);

    // Extension is a claim; the magic bytes are the fact.
    const head = readFileSync(file, 'latin1').slice(0, 12);
    expect(head.slice(0, 4)).toBe('RIFF');
    expect(head.slice(8, 12)).toBe('WEBP');

    const bytes = statSync(file).size;
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(250 * 1024);
  });

  it('is served from public/ and never from the reference library', () => {
    for (const entry of Object.values(MASCOT_ACTIVITY_ART)) {
      expect(entry?.src).toMatch(/^\/mascots\//);
      expect(entry?.src).not.toMatch(/docs\/|reference|concept|sheet|\.verify/i);
    }
  });

  it('keeps its reviewed source in docs/, out of the runtime path', () => {
    const source = join(
      ROOT, 'docs', 'brand', 'reference', 'mascots',
      'ninfit-tortoise-journey-cycle-reference-v1.png',
    );
    expect(existsSync(source), 'the reviewed source sheet should be preserved').toBe(true);
    expect(readFileSync(source, 'latin1').slice(1, 4)).toBe('PNG');
  });

  it('ships exactly one copy of each production asset', () => {
    // The same picture must not be duplicated under a second name or a second folder.
    const srcs = Object.values(MASCOT_ACTIVITY_ART).map((e) => e?.src);
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it('says who is pictured without claiming what the ride will be', () => {
    const alt = mascotActivityArt('tortoise', 'cycle')?.alt ?? '';
    expect(alt).not.toMatch(/\b(your|you|fast|far|distance|km|pace|speed|best)\b/i);
  });
});

// --- 6-10. The boundary holds in every direction ----------------------------

describe('species x family isolation still holds with three pictures declared', () => {
  it('declares exactly the reviewed entries', () => {
    expect(Object.keys(MASCOT_ACTIVITY_ART).sort())
      .toEqual(['tortoise:cycle', 'tortoise:swim', 'tortoise:walk-run']);
  });

  it('gives Walk/Run and Cycle different pictures', () => {
    const walkRun = mascotActivityArt('tortoise', 'walk-run')?.src;
    const cycle = mascotActivityArt('tortoise', 'cycle')?.src;
    expect(walkRun).toBeDefined();
    expect(cycle).toBeDefined();
    expect(cycle).not.toBe(walkRun);
  });

  it('never lets Cycle borrow the Walk/Run picture', () => {
    expect(mascotActivityArt('tortoise', 'cycle')?.src)
      .not.toBe(mascotActivityArt('tortoise', 'walk-run')?.src);
    expect(mascotActivityArt('tortoise', 'cycle')?.src).not.toContain('walk-run');
  });

  it('keeps Cycle distinct from Swim, now that Swim has its own picture too', () => {
    const cycle = mascotActivityArt('tortoise', 'cycle')?.src;
    const swim = mascotActivityArt('tortoise', 'swim')?.src;
    expect(cycle).toBeDefined();
    expect(swim).toBeDefined();
    expect(cycle).not.toBe(swim);
    expect(cycle).toContain('cycle');
    expect(swim).toContain('swim');
  });

  it('gives no other species the tortoise pictures, on any door', () => {
    const tortoiseArt = new Set(
      JOURNEY_ACTIVITY_FAMILIES
        .map((f) => mascotActivityArt('tortoise', f.id)?.src)
        .filter((s): s is string => s !== undefined),
    );
    expect(tortoiseArt.size).toBe(3);

    for (const species of ['bear', 'fox', 'otter', 'wolf'] as const) {
      for (const family of JOURNEY_ACTIVITY_FAMILIES) {
        const resolved = mascotActivityArt(species, family.id);
        expect(resolved, `${species}:${family.id}`).toBeUndefined();
        expect(tortoiseArt.has(resolved?.src ?? '')).toBe(false);
      }
    }
  });
});

// --- 5. No screen learns a path ---------------------------------------------

describe('no screen names the asset, the species or the folder', () => {
  for (const [name, source] of [
    ['Journey Home', home],
    ['launch screen', launchScreen],
  ] as const) {
    it(`${name} goes through the boundary instead`, () => {
      const code = strip(source);
      expect(code).not.toContain('tortoise');
      expect(code).not.toContain('.webp');
      expect(code).not.toContain('/mascots/');
      expect(code).not.toContain('docs/');
      expect(code).toContain("from '../mascotActivityArt'");
      expect(code).toMatch(/mascotActivityArt\(mascot\.id, family(\.id)?\)/);
    });
  }

  it('resolves Cycle art by the family the door already knows', () => {
    // Journey Home maps over the families and asks per door - no cycle special case.
    const code = strip(home);
    expect(code).toContain('mascotActivityArt(mascot.id, family.id)');
    expect(code).not.toMatch(/'cycle'|"cycle"/);
    expect(journeyActivityFamilyForType('cycle')).toBe('cycle');
  });
});

// --- 11-14. The doorway, and what Start actually starts ---------------------

describe('the Cycle doorway opens a screen and starts nothing on the way', () => {
  it('is a companion door', () => {
    expect(journeyActivityFamily('cycle')?.launch).toBe('companion');
  });

  it('routes #/journey/launch/cycle to the Cycle launch screen', () => {
    expect(parseRouteFromHash(journeyLaunchHash('cycle')))
      .toEqual({ kind: 'journey-launch', family: 'cycle' });
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
    // The whole of what it must not do on the way through a door.
    expect(branch).not.toMatch(/start\s*\(|nowIso|saveJourney|grantRewards|syncGame/);
  });

  it('starts exactly `cycle`, through the existing controller', () => {
    // The door owns one type, and that is the type the screen would hand over.
    expect(activityTypesForFamily('cycle')).toEqual(['cycle']);

    const started = createJourneyLaunchController(adapter, sequentialIdFactory('c'))
      .start('cycle', NOW);
    expect(started.created).toBe(true);
    expect(started.journey.activityType).toBe('cycle');
    expect(loadActiveJourneySnapshot(adapter)).not.toBeNull();

    // And the screen reaches the controller rather than building a Journey itself.
    const code = strip(launchScreen);
    expect(code).toContain('createJourneyLaunchController');
    expect(code).toContain('launch.start(chosen, nowIso())');
    expect(code).not.toContain("status: 'recording'");
    expect(code).not.toContain("kind: 'ninfit_phone_gps'");
  });

  it('offers no activity selector for a door that owns one activity', () => {
    const code = strip(launchScreen);
    expect(code).toContain('const sole = choices.length === 1 ? choices[0] : undefined');
    // The fieldset is rendered only when there is something to choose between.
    expect(code).toContain('{sole === undefined ? (');
    // And Walk/Run, which owns two, still has one.
    expect(activityTypesForFamily('walk-run')).toHaveLength(2);
  });
});

// --- 15 + 20. No GPS and no heuristic in the presentation layer -------------

describe('the Cycle presentation layer builds no recorder', () => {
  it('creates no watcher, session or geolocation of its own', () => {
    const code = strip(launchScreen);
    expect(code).not.toMatch(
      /geolocation|watchPosition|clearWatch|GpsSession|GpsRuntime|journeyGeolocationAdapter/i,
    );
  });

  it('derives activity truth from the door, never from speed or position', () => {
    for (const [name, source] of [
      ['launch screen', strip(launchScreen)],
      ['Journey Home', strip(home)],
    ] as const) {
      expect(source, name).not.toMatch(/speed|pace|velocity|kmPerHour|\bmph\b|cadence/i);
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

// --- 16-17. Cycle finishes through the one existing path --------------------

describe('a Cycle Journey finishes through the existing architecture', () => {
  it('records, pauses, resumes and completes as `cycle` throughout', () => {
    const launch = createJourneyLaunchController(adapter, sequentialIdFactory('c'));
    const recovery = createJourneyRecoveryController(adapter);

    const started = launch.start('cycle', NOW).journey;
    expect(started.activityType).toBe('cycle');

    const paused = recovery.pause(started, '2026-08-28T09:10:00.000+01:00');
    expect(paused.status).toBe('paused');
    expect(paused.activityType).toBe('cycle');

    const resumed = recovery.resume(paused, '2026-08-28T09:15:00.000+01:00');
    expect(resumed.status).toBe('recording');

    const completed = recovery.complete(resumed, END);
    expect(completed.status).toBe('completed');
    expect(completed.activityType).toBe('cycle');

    // One durable record, no active snapshot left behind.
    const history = loadJourneyHistory(adapter);
    expect(history).toHaveLength(1);
    expect(history[0]?.activityType).toBe('cycle');
    expect(loadActiveJourneySnapshot(adapter)).toBeNull();
  });

  it('reaches the one completion experience, not a Cycle-specific one', () => {
    // There is exactly one completion route, and Finish routes every activity to it.
    expect(app).toContain('onCompleted={(journeyId) => navigate(journeyCompleteHash(journeyId))}');
    expect(strip(active)).toContain('onCompleted?.(next.id)');
    expect(parseRouteFromHash(journeyCompleteHash('c-1')))
      .toEqual({ kind: 'journey-complete', journeyId: 'c-1' });

    // No second completion screen was introduced for Cycle.
    expect(app).not.toMatch(/CycleCompletion|CycleFinish|CycleSummary/);
  });

  it('shows the Cycle medallion on the completion moment through the same boundary', () => {
    const completion = strip(read('ui', 'screens', 'JourneyCompletionScreen.tsx'));
    expect(completion).toContain('journeyActivityFamilyForType(journey.activityType)');
    expect(completion).toContain('mascotActivityArt(mascot.id, family)');
    expect(completion).not.toContain('cycle');
  });
});

// --- 19. Swim is untouched ---------------------------------------------------

describe('Cycle is unaffected by Swim gaining a door of its own', () => {
  it('keeps its own route, its own picture and its own type', () => {
    expect(parseRouteFromHash(journeyLaunchHash('cycle')))
      .toEqual({ kind: 'journey-launch', family: 'cycle' });
    expect(mascotActivityArt('tortoise', 'cycle')?.src).toBe(CYCLE_SRC);

    const started = createJourneyLaunchController(adapter, sequentialIdFactory('s'))
      .start('cycle', NOW);
    expect(started.journey.activityType).toBe('cycle');
  });
});
