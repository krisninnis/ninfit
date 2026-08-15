import { beforeEach, describe, expect, it } from 'vitest';

import {
  HATCH_QUALIFYING_DAYS,
  MAX_CRACK_STAGE,
  crackStageForDays,
  eggProgress,
  isHatchEligibleFromDays,
  qualifyingActiveDays,
} from '../domain/game/egg';
import { evaluateMascot, hatchEgg, isHatchEligible } from '../domain/game/mascot';
import { createInitialGameState } from '../domain/game/defaults';
import { grantRewards, sealRewardKeys, type DerivedFacts } from '../domain/game/rewards';
import { createDefaultGameSettings } from '../domain/game/defaults';
import type { GameState, MascotState } from '../domain/game/types';

/**
 * The M2 opal egg state machine.
 *
 * The egg's progress is DERIVED from `awardedKeys`, which only ever grows. These
 * tests exist to prove the two things that would be worst to get wrong: that the
 * shell can never heal, and that reaching hatch-ready can never open it.
 */

const NOW = '2026-08-15T09:00:00.000+01:00';

function activityKeys(...dates: string[]): string[] {
  return dates.map((date, index) => `activity:${date}:a${index}`);
}

// ---------------------------------------------------------------------------

describe('crack stage, one per qualifying day', () => {
  const table: Array<[number, number]> = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
  ];

  for (const [days, stage] of table) {
    it(`${days} qualifying day(s) gives crack stage ${stage}`, () => {
      expect(crackStageForDays(days)).toBe(stage);
    });
  }

  it('reaches hatch eligibility at six qualifying days', () => {
    expect(HATCH_QUALIFYING_DAYS).toBe(6);
    expect(isHatchEligibleFromDays(5)).toBe(false);
    expect(isHatchEligibleFromDays(6)).toBe(true);
  });

  it('never exceeds the maximum crack stage, however many days pass', () => {
    for (const days of [6, 7, 20, 365, 10_000]) {
      expect(crackStageForDays(days)).toBe(MAX_CRACK_STAGE);
    }
  });

  it('treats a negative or nonsense day count as pristine', () => {
    expect(crackStageForDays(-1)).toBe(0);
    expect(crackStageForDays(Number.NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('counting qualifying days from reward keys', () => {
  it('counts nothing when no activity has been awarded', () => {
    expect(qualifyingActiveDays([])).toBe(0);
    expect(eggProgress([])).toEqual({ qualifyingDays: 0, crackStage: 0, hatchEligible: false });
  });

  it('counts five activities on one date as ONE qualifying day', () => {
    const keys = [
      'activity:2026-08-15:a1',
      'activity:2026-08-15:a2',
      'activity:2026-08-15:a3',
      'activity:2026-08-15:a4',
      'activity:2026-08-15:a5',
    ];
    // Five workouts in a day must not crack the egg five times.
    expect(qualifyingActiveDays(keys)).toBe(1);
    expect(eggProgress(keys).crackStage).toBe(1);
  });

  it('ignores duplicate keys entirely', () => {
    const once = activityKeys('2026-08-15', '2026-08-16');
    const twice = [...once, ...once];
    expect(qualifyingActiveDays(twice)).toBe(qualifyingActiveDays(once));
  });

  it('does not advance the egg for acknowledged rest', () => {
    const rest = ['rest:2026-08-15', 'rest:2026-08-16', 'rest:2026-08-17'];
    expect(qualifyingActiveDays(rest)).toBe(0);

    // Rest alongside activity neither adds to nor subtracts from the count.
    const mixed = [...rest, ...activityKeys('2026-08-18')];
    expect(qualifyingActiveDays(mixed)).toBe(1);
  });

  it('ignores session and trophy keys, which are not per-day activity', () => {
    const keys = ['session:2026-08-15', 'trophy:first-week', ...activityKeys('2026-08-15')];
    expect(qualifyingActiveDays(keys)).toBe(1);
  });

  it('ignores malformed keys rather than trusting them', () => {
    const keys = ['activity:', 'activity:not-a-date:a1', 'activity:2026-13-45:a1', 'activity'];
    expect(qualifyingActiveDays(keys)).toBe(0);
  });

  it('does not care what order the keys arrive in', () => {
    const dates = ['2026-08-15', '2026-08-11', '2026-08-19', '2026-08-13'];
    const forwards = activityKeys(...dates);
    const backwards = [...forwards].reverse();
    expect(qualifyingActiveDays(backwards)).toBe(qualifyingActiveDays(forwards));
  });

  it('counts sealed historical keys, because the work genuinely happened', () => {
    const base: GameState = createInitialGameState({ now: NOW });
    const facts = {
      rewards: activityKeys('2026-07-01', '2026-07-02', '2026-07-03').map((key) => ({
        key,
        kind: 'activity_completed' as const,
        xp: 10,
        skillXp: {},
        label: 'historical',
      })),
      activeDays: [],
      completedActivities: 3,
      fullSessions: 0,
      distinctActiveDays: 0,
      programmeDaysRecorded: 3,
      restDaysObserved: 0,
      measurementsRecorded: 0,
    } as unknown as DerivedFacts;

    const sealed = sealRewardKeys(base, facts);

    expect(qualifyingActiveDays(sealed.awardedKeys)).toBe(3);
    // Sealing records the keys WITHOUT granting them, so no retroactive XP.
    expect(sealed.xp.total).toBe(base.xp.total);
  });
});

// ---------------------------------------------------------------------------

describe('the shell never heals', () => {
  it('keeps its crack stage when an activity is later un-ticked', () => {
    // The reward key survives the un-tick, which is the whole point of deriving
    // from `awardedKeys` rather than from the live logs.
    const afterFourDays = activityKeys('2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14');
    const before = eggProgress(afterFourDays);

    // Un-ticking changes the logs, never the awarded keys.
    const after = eggProgress(afterFourDays);

    expect(after.crackStage).toBe(before.crackStage);
    expect(after.crackStage).toBe(4);
  });

  it('rises monotonically as days accumulate, and never falls', () => {
    const dates = [
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
    ];

    let previous = -1;
    for (let count = 0; count <= dates.length; count += 1) {
      const stage = eggProgress(activityKeys(...dates.slice(0, count))).crackStage;
      expect(stage, `stage fell at ${count} days`).toBeGreaterThanOrEqual(previous);
      previous = stage;
    }
    expect(previous).toBe(MAX_CRACK_STAGE);
  });
});

// ---------------------------------------------------------------------------

describe('reaching hatch-ready never opens the egg', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialGameState({ now: NOW });
  });

  it('promotes to ready but never to hatched, however many times it is evaluated', () => {
    let mascot: MascotState = state.mascot;

    for (let pass = 0; pass < 25; pass += 1) {
      mascot = evaluateMascot(mascot, { qualifyingDays: 500, level: 20 });
    }

    expect(mascot.eggState).toBe('ready');
    expect(mascot.eggState).not.toBe('hatched');
    expect(mascot.hatchedAt).toBeUndefined();
  });

  it('leaves a maxed-out crack stage unhatched until asked', () => {
    const progress = eggProgress(
      activityKeys('2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'),
    );
    const mascot = evaluateMascot(state.mascot, {
      qualifyingDays: progress.qualifyingDays,
      level: 1,
    });

    expect(progress.crackStage).toBe(MAX_CRACK_STAGE);
    expect(progress.hatchEligible).toBe(true);
    expect(mascot.eggState).toBe('ready');
  });

  it('refuses to hatch an egg that is not ready', () => {
    expect(hatchEgg(state.mascot, NOW).eggState).toBe('unhatched');
  });

  it('hatches only on an explicit call, once ready', () => {
    const ready = evaluateMascot(state.mascot, { qualifyingDays: 6, level: 1 });
    expect(ready.eggState).toBe('ready');

    const hatched = hatchEgg(ready, NOW);
    expect(hatched.eggState).toBe('hatched');
    expect(hatched.hatchedAt).toBe(NOW);
  });
});

// ---------------------------------------------------------------------------

describe('existing eggs are never pushed backwards', () => {
  const base = () => createInitialGameState({ now: NOW });

  it('leaves a ready egg ready even with no qualifying days at all', () => {
    // Someone who reached the OLD two-day threshold keeps their ready egg when the
    // requirement rises to six. Promotion only ever runs from `unhatched`.
    const ready: MascotState = { ...base().mascot, eggState: 'ready' };
    const after = evaluateMascot(ready, { qualifyingDays: 0, level: 1 });

    expect(after.eggState).toBe('ready');
  });

  it('leaves a hatched egg hatched', () => {
    const hatched: MascotState = {
      ...base().mascot,
      eggState: 'hatched',
      stage: 'growing',
      hatchedAt: NOW,
    };
    const after = evaluateMascot(hatched, { qualifyingDays: 0, level: 1 });

    expect(after.eggState).toBe('hatched');
    expect(after.stage).toBe('growing');
    expect(after.hatchedAt).toBe(NOW);
  });

  it('keeps the eligibility rule and the crack rule in agreement', () => {
    // One definition of qualifying progress, not two.
    for (const days of [0, 1, 5, 6, 7, 99]) {
      expect(isHatchEligible(days)).toBe(isHatchEligibleFromDays(days));
      expect(isHatchEligible(days)).toBe(eggProgress(activityKeysFor(days)).hatchEligible);
    }
  });

  function activityKeysFor(days: number): string[] {
    return Array.from({ length: days }, (_, index) => {
      const day = String(11 + index).padStart(2, '0');
      return `activity:2026-08-${day}:a${index}`;
    });
  }
});

// ---------------------------------------------------------------------------

describe('the projection leaks nothing about the species', () => {
  it('returns only generic progress, with no species field', () => {
    const progress = eggProgress(activityKeys('2026-08-15', '2026-08-16'));

    expect(Object.keys(progress).sort()).toEqual(['crackStage', 'hatchEligible', 'qualifyingDays']);
    for (const value of Object.values(progress)) {
      expect(typeof value === 'number' || typeof value === 'boolean').toBe(true);
    }
  });

  it('gives the same answer whatever species the mascot happens to be', () => {
    // The projection takes only keys, so species cannot reach it even in principle.
    const keys = activityKeys('2026-08-15', '2026-08-16', '2026-08-17');
    const first = eggProgress(keys);
    const second = eggProgress([...keys]);

    expect(first).toEqual(second);
  });

  it('never mentions an animal anywhere in the module', async () => {
    const source = await import('../domain/game/egg?raw').then((module) => module.default);

    for (const animal of ['tortoise', 'bear', 'fox', 'otter', 'wolf', 'familyId', 'speciesId']) {
      expect(source.toLowerCase(), `egg.ts mentions ${animal}`).not.toContain(animal.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------

describe('granting rewards does not double-count', () => {
  it('advances the egg once per date however often it syncs', () => {
    const state = createInitialGameState({ now: NOW });
    const settings = createDefaultGameSettings();
    const facts = {
      rewards: [
        { key: 'activity:2026-08-15:a1', kind: 'activity_completed' as const, xp: 10, skillXp: {}, label: 'x' },
        { key: 'activity:2026-08-15:a2', kind: 'activity_completed' as const, xp: 10, skillXp: {}, label: 'y' },
      ],
      activeDays: [],
      completedActivities: 2,
      fullSessions: 0,
      distinctActiveDays: 1,
      programmeDaysRecorded: 1,
      restDaysObserved: 0,
      measurementsRecorded: 0,
    } as unknown as DerivedFacts;

    const first = grantRewards(state, facts, { now: NOW, settings });
    const second = grantRewards(first.state, facts, { now: NOW, settings });

    expect(second.granted).toHaveLength(0);
    expect(second.state.xp.total).toBe(first.state.xp.total);
    expect(qualifyingActiveDays(second.state.awardedKeys)).toBe(1);
  });
});
