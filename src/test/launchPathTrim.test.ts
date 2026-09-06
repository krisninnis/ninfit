import { describe, expect, it } from 'vitest';
import onboardingSource from '../ui/screens/OnboardingScreen.tsx?raw';
import { finishOnboarding } from '../app/game';
import { isLaunchMainGoalOption, recommendLaunchPath } from '../app/launchPathRecommendation';
import { FITNESS_PATHS, LAUNCH_FITNESS_PATH_IDS, MASCOT_FAMILIES } from '../domain/game/paths';
import { recommendPath } from '../domain/game/onboarding';
import type { OnboardingAnswers } from '../domain/game/types';
import { sequentialIdFactory } from '../domain/ids';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { createRepository } from '../storage/repository';

const NOW = '2026-09-05T12:00:00.000+01:00';

const BASE: Omit<OnboardingAnswers, 'mainGoal'> = {
  activityLevel: 'moderate',
  structuredExercise: 'regular',
  walkComfort: 'comfortable',
  previousExperience: 'some',
  returningAfterBreak: false,
  confidence: 'medium',
};

describe('launch path trim', () => {
  it('keeps the permanent five-path and five-family architecture intact', () => {
    expect(FITNESS_PATHS.map((path) => path.id)).toEqual([
      'start_moving',
      'build_strength',
      'build_stamina',
      'balanced_fitness',
      'return_to_fitness',
    ]);
    expect(MASCOT_FAMILIES.map((family) => family.id)).toEqual([
      'tortoise',
      'bear',
      'fox',
      'otter',
      'wolf',
    ]);
  });

  it('offers exactly the two launch-ready paths to new onboarding', () => {
    expect(LAUNCH_FITNESS_PATH_IDS).toEqual(['start_moving', 'return_to_fitness']);
    expect(isLaunchMainGoalOption('start_moving')).toBe(true);
    expect(isLaunchMainGoalOption('return')).toBe(true);
    expect(isLaunchMainGoalOption('strength')).toBe(false);
    expect(isLaunchMainGoalOption('stamina')).toBe(false);
    expect(isLaunchMainGoalOption('balanced')).toBe(false);
  });

  it.each([
    'start_moving',
    'strength',
    'stamina',
    'balanced',
    'return',
  ] as const)('never recommends a hidden launch path for mainGoal=%s', (mainGoal) => {
    const result = recommendLaunchPath({ ...BASE, mainGoal });
    expect(LAUNCH_FITNESS_PATH_IDS).toContain(result.pathId);
  });

  it('preserves the richer five-path recommender for legacy and future programme use', () => {
    const legacy = recommendPath({ ...BASE, mainGoal: 'strength' });
    expect(legacy.pathId).toBe('build_strength');
  });

  it('keeps old hidden-path state writable/readable instead of invalidating backups', () => {
    const repo = createRepository(createMemoryStorageAdapter(), {
      now: () => NOW,
      makeId: sequentialIdFactory('legacy'),
    });
    repo.initialise();

    finishOnboarding(
      repo,
      {
        answers: { ...BASE, mainGoal: 'stamina' },
        recommendedPathId: 'build_stamina',
        chosenPathId: 'build_stamina',
      },
      NOW,
    );

    expect(repo.getGameState()?.pathId).toBe('build_stamina');
    expect(repo.getGameState()?.mascot.familyId).toBe('fox');
  });

  it('uses the launch availability layer at the onboarding UI boundary', () => {
    expect(onboardingSource).toContain('isLaunchMainGoalOption');
    expect(onboardingSource).toContain('recommendLaunchPath');
    expect(onboardingSource).toContain('LAUNCH_FITNESS_PATHS');
    expect(onboardingSource).not.toMatch(/\bFITNESS_PATHS\b/);
  });
});
