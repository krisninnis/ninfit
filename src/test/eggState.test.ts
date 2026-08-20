import { describe, expect, it } from 'vitest';

import { MAX_CRACK_STAGE, crackStageForProgress, isCrackComplete } from '../domain/game/egg';
import eggSource from '../domain/game/egg.ts?raw';
import { evaluateMascot, hatchEgg, isHatchEligible, visibleMascotFamily } from '../domain/game/mascot';
import {
  completeOnboarding,
  createDefaultGameSettings,
  createInitialGameState,
} from '../domain/game/defaults';
import { mascotFamilyForPath } from '../domain/game/paths';
import { grantRewards, type DerivedFacts } from '../domain/game/rewards';
import { onboardingStages, stageProgress } from '../domain/game/onboarding';
import type { FitnessPathId, GameState, MascotState, OnboardingAnswers } from '../domain/game/types';

/**
 * The Mystery Egg contract.
 *
 * THE RULE THESE TESTS NOW PROTECT, AND THE ONE THEY REPLACED.
 *
 * The egg used to crack one stage per qualifying activity day and become hatchable
 * after six of them. That meant nobody met their companion in their first week, and
 * it spent real fitness records buying an introduction.
 *
 * Hatching is now the payoff for FINISHING ONBOARDING and choosing a path. Real
 * fitness starts the moment the mascot exists and drives everything after it: XP,
 * growth, evolution, Champion, Legacy. The tests below exist to stop either half of
 * that drifting - onboarding must not grant fitness, and fitness must not be spent
 * on the introduction.
 */

const NOW = '2026-08-15T09:00:00.000+01:00';

const CORE_ANSWERS: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'not_yet',
  mainGoal: 'start_moving',
};

function readyState(pathId: FitnessPathId = 'start_moving'): GameState {
  return completeOnboarding(
    createInitialGameState({ now: NOW }),
    {
      pathId,
      recommendedPathId: 'start_moving',
      fitnessStage: 'settling_in',
      answers: CORE_ANSWERS,
    },
    { now: NOW },
  );
}

function noFacts(): DerivedFacts {
  return {
    rewards: [],
    activeDays: [],
    completedActivities: 0,
    fullSessions: 0,
    restDaysObserved: 0,
    programmeDaysRecorded: 0,
    measurementCount: 0,
    consistency: { currentRun: 0, longestRun: 0, milestones: [] },
  } as unknown as DerivedFacts;
}

// ---------------------------------------------------------------------------

describe('cracking is driven by onboarding progress, not by activity', () => {
  it('reads no reward keys, no activity and no dates', () => {
    // Comments stripped first: the module's docstring explains what it no longer
    // reads, and a naive search would match that explanation and report the
    // opposite of the truth.
    const code = eggSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    expect(code).not.toMatch(/awardedKeys|qualifyingDays|activity:/);
    expect(code).not.toMatch(/import/);
  });

  it('starts pristine and finishes fully cracked', () => {
    expect(crackStageForProgress(0)).toBe(0);
    expect(crackStageForProgress(1)).toBe(MAX_CRACK_STAGE);
    expect(isCrackComplete(crackStageForProgress(1))).toBe(true);
    expect(isCrackComplete(crackStageForProgress(0.5))).toBe(false);
  });

  it('rises monotonically with progress and never falls', () => {
    let previous = 0;
    for (let step = 0; step <= 100; step += 1) {
      const stage = crackStageForProgress(step / 100);
      expect(stage).toBeGreaterThanOrEqual(previous);
      expect(stage).toBeLessThanOrEqual(MAX_CRACK_STAGE);
      previous = stage;
    }
  });

  it('treats nonsense progress as pristine rather than painting NaN cracks', () => {
    expect(crackStageForProgress(Number.NaN)).toBe(0);
    expect(crackStageForProgress(-1)).toBe(0);
    // Infinity is not a real fraction, so it is treated like any other nonsense
    // input: pristine, rather than silently maxed out.
    expect(crackStageForProgress(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('travels visibly across a real questionnaire', () => {
    // Not a fixed question count: the flow is adaptive, so this walks whatever
    // stages the domain actually produces and checks the shell keeps moving.
    const stages = onboardingStages(CORE_ANSWERS);
    const seen = stages.map((_, index) =>
      crackStageForProgress(stageProgress(stages, index).fraction),
    );

    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(MAX_CRACK_STAGE);
    expect(new Set(seen).size).toBeGreaterThan(2);
  });
});

// ---------------------------------------------------------------------------

describe('readiness comes from finishing onboarding', () => {
  it('is exactly that, with nothing else consulted', () => {
    expect(isHatchEligible(true)).toBe(true);
    expect(isHatchEligible(false)).toBe(false);
  });

  it('leaves the egg shut for someone who has not finished onboarding', () => {
    const fresh = createInitialGameState({ now: NOW });
    expect(fresh.mascot.eggState).toBe('unhatched');

    const evaluated = evaluateMascot(fresh.mascot, { onboardingCompleted: false, level: 20 });
    expect(evaluated.eggState).toBe('unhatched');
  });

  it('readies the egg the moment onboarding is recorded', () => {
    expect(readyState().mascot.eggState).toBe('ready');
  });

  it('never opens it by itself, however many times it is evaluated', () => {
    let mascot: MascotState = readyState().mascot;
    for (let pass = 0; pass < 25; pass += 1) {
      mascot = evaluateMascot(mascot, { onboardingCompleted: true, level: 20 });
    }

    expect(mascot.eggState).toBe('ready');
    expect(mascot.hatchedAt).toBeUndefined();
  });

  it('refuses to hatch an egg that is not ready', () => {
    const fresh = createInitialGameState({ now: NOW });
    expect(hatchEgg(fresh.mascot, NOW).eggState).toBe('unhatched');
  });
});

// ---------------------------------------------------------------------------

describe('migration: nobody is left holding an egg that cannot open', () => {
  /**
   * Anyone who finished onboarding under the old rule and never reached six
   * qualifying days would, without this, hold an egg forever. One deterministic rule
   * rescues them and serves the new flow at the same time.
   */
  it('readies a stranded egg on the next evaluation', () => {
    const stranded: MascotState = {
      ...createInitialGameState({ now: NOW }).mascot,
      eggState: 'unhatched',
    };

    expect(evaluateMascot(stranded, { onboardingCompleted: true, level: 1 }).eggState).toBe('ready');
  });

  it('never pushes an already-hatched mascot backwards', () => {
    const hatched = hatchEgg(readyState().mascot, NOW);
    expect(hatched.eggState).toBe('hatched');

    const evaluated = evaluateMascot(hatched, { onboardingCompleted: true, level: 12 });
    expect(evaluated.eggState).toBe('hatched');
    expect(evaluated.stage).toBe('starter');
    expect(evaluated.hatchedAt).toBe(NOW);
  });

  it('survives re-running onboarding with its progression intact', () => {
    const hatched: GameState = { ...readyState(), mascot: hatchEgg(readyState().mascot, NOW) };
    const grown: GameState = {
      ...hatched,
      xp: { total: 900, level: 7 },
      mascot: { ...hatched.mascot, stage: 'capable' },
    };

    const again = completeOnboarding(
      grown,
      {
        pathId: 'build_strength',
        recommendedPathId: 'start_moving',
        fitnessStage: 'developing',
        answers: CORE_ANSWERS,
      },
      { now: '2026-09-01T09:00:00.000+01:00' },
    );

    // The path may change. The companion, its growth and its XP may not be reset.
    expect(again.mascot.eggState).toBe('hatched');
    expect(again.mascot.stage).toBe('capable');
    expect(again.mascot.hatchedAt).toBe(NOW);
    expect(again.xp).toEqual({ total: 900, level: 7 });
  });
});

// ---------------------------------------------------------------------------

describe('the chosen path decides the companion, and only at the reveal', () => {
  it('takes the family from the FINAL chosen path, not the recommendation', () => {
    const overridden = completeOnboarding(
      createInitialGameState({ now: NOW }),
      {
        pathId: 'build_strength',
        recommendedPathId: 'start_moving',
        fitnessStage: 'settling_in',
        answers: CORE_ANSWERS,
      },
      { now: NOW },
    );

    expect(overridden.mascot.familyId).toBe(mascotFamilyForPath('build_strength'));
    expect(overridden.onboarding.overrodeRecommendation).toBe(true);
  });

  it('keeps the species hidden until the egg is genuinely hatched', () => {
    const ready = readyState('build_stamina');
    expect(ready.mascot.familyId).toBe(mascotFamilyForPath('build_stamina'));
    // Recorded, but unreadable: this is the only accessor the UI is given.
    expect(visibleMascotFamily(ready.mascot)).toBeUndefined();

    const hatched = hatchEgg(ready.mascot, NOW);
    expect(visibleMascotFamily(hatched)?.id).toBe(mascotFamilyForPath('build_stamina'));
  });

  it('starts every companion at the starter stage', () => {
    for (const pathId of [
      'start_moving',
      'build_strength',
      'build_stamina',
      'balanced_fitness',
      'return_to_fitness',
    ] as const) {
      const hatched = hatchEgg(readyState(pathId).mascot, NOW);
      expect(hatched.stage).toBe('starter');
      expect(hatched.evolutionReady).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------

describe('hatching is a journey-start event, never a fitness reward', () => {
  it('grants no XP, no level and no trophies', () => {
    const ready = readyState();
    const hatched: GameState = { ...ready, mascot: hatchEgg(ready.mascot, NOW) };

    expect(hatched.xp).toEqual(ready.xp);
    expect(hatched.xp.total).toBe(0);
    expect(hatched.xp.level).toBe(1);
    expect(hatched.trophies).toEqual(ready.trophies);
    expect(hatched.awardedKeys).toEqual(ready.awardedKeys);
  });

  it('fabricates no activity, and finishing onboarding awards nothing either', () => {
    const ready = readyState();
    expect(ready.awardedKeys).toEqual([]);
    expect(ready.xp.total).toBe(0);

    // A sync with no fitness facts must still grant nothing at all.
    const { state, granted } = grantRewards(ready, noFacts(), {
      now: NOW,
      settings: createDefaultGameSettings(),
    });

    expect(granted).toEqual([]);
    expect(state.xp.total).toBe(0);
    expect(state.awardedKeys).toEqual([]);
  });

  it('leaves real fitness rewards working after the hatch', () => {
    const ready = readyState();
    const hatched: GameState = { ...ready, mascot: hatchEgg(ready.mascot, NOW) };

    const facts = {
      ...noFacts(),
      rewards: [
        {
          key: 'activity:2026-08-16:a1',
          kind: 'activity_completed' as const,
          xp: 20,
          skillXp: {},
          label: 'Walk',
          date: '2026-08-16',
        },
      ],
    } as unknown as DerivedFacts;

    const { state, granted } = grantRewards(hatched, facts, {
      now: NOW,
      settings: createDefaultGameSettings(),
    });

    expect(granted).toHaveLength(1);
    expect(state.xp.total).toBe(20);
    expect(state.mascot.eggState).toBe('hatched');

    // Idempotency is untouched: the same facts grant nothing a second time.
    const repeat = grantRewards(state, facts, { now: NOW, settings: createDefaultGameSettings() });
    expect(repeat.granted).toEqual([]);
    expect(repeat.state.xp.total).toBe(20);
  });
});
