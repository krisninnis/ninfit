import { beforeEach, describe, expect, it } from 'vitest';
import gameHeaderSource from '../ui/components/GameHeader.tsx?raw';
import onboardingSource from '../ui/screens/OnboardingScreen.tsx?raw';
import {
  finishOnboarding,
  hatchEggNow,
  evolveMascotNow,
  restartOnboarding,
  switchPath,
  syncGame,
  updateGameSettings,
} from '../app/game';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { acknowledgeRestDay, toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { createDefaultGameSettings } from '../domain/game/defaults';
import {
  HATCH_ACTIVE_DAYS_REQUIRED,
  evolutionStatus,
  visibleMascotFamily,
} from '../domain/game/mascot';
import { recommendPath } from '../domain/game/onboarding';
import { highlightedSkillsForPath, mascotFamilyForPath } from '../domain/game/paths';
import { PLATINUM_AVAILABLE, TROPHIES, findTrophy } from '../domain/game/trophies';
import { SKILL_KINDS, type OnboardingAnswers } from '../domain/game/types';
import { TROPHY_XP, XP_REWARDS, findSkill, levelForXp } from '../domain/game/xp';
import { createMeasurement } from '../domain/measurement';
import { sequentialIdFactory } from '../domain/ids';
import { resolveToday } from '../domain/today';
import type { PlannedActivity, WeeklyPlan } from '../domain/types';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const DAY_1 = '2026-08-13';
const DAY_2 = '2026-08-14';
const DAY_3 = '2026-08-15';
const DAY_7 = '2026-08-19';

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];
let yoga: PlannedActivity;
let walk: PlannedActivity;

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

function reload(): Repository {
  const next = newRepo(adapter, 'reload');
  next.initialise();
  return next;
}

function session(date: string, store: Repository = repo): TodaySession {
  const view = resolveToday(plans, PROGRAMME_START_DATE, date);
  return createTodaySession(store, date, {
    now: NOW,
    makeId: sequentialIdFactory(`s-${date}`),
    ...(view.planId !== undefined ? { weeklyPlanId: view.planId } : {}),
    ...(view.sessionId !== undefined ? { plannedSessionId: view.sessionId } : {}),
  });
}

function tick(date: string, activity: PlannedActivity, completed = true): void {
  const today = session(date);
  today.apply(toggleActivityCompletion(today.getLog(), activity.id, completed));
  today.save();
}

function activitiesOn(date: string): PlannedActivity[] {
  return resolveToday(plans, PROGRAMME_START_DATE, date).activities;
}

function sync(store: Repository = repo) {
  return syncGame(store, { now: NOW, today: DAY_1 });
}

const BEGINNER_ANSWERS: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'with_effort',
  mainGoal: 'start_moving',
  confidence: 'medium',
};

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const [first, second] = activitiesOn(DAY_1);
  if (!first || !second) throw new Error('expected yoga and a walk on day 1');
  yoga = first;
  walk = second;
});

// ---------------------------------------------------------------------------

describe('onboarding', () => {
  it('recommends the same path for the same answers, every time', () => {
    const a = recommendPath(BEGINNER_ANSWERS);
    const b = recommendPath({ ...BEGINNER_ANSWERS });
    expect(a.pathId).toBe(b.pathId);
    expect(a.explanation).toBe(b.explanation);
    expect(a.pathId).toBe('start_moving');
  });

  it('explains itself in words drawn from the answers', () => {
    const result = recommendPath(BEGINNER_ANSWERS);
    expect(result.explanation).toMatch(/Start Moving/);
    expect(result.explanation).toMatch(/because/);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('recommends other paths when the answers point elsewhere', () => {
    expect(
      recommendPath({ ...BEGINNER_ANSWERS, mainGoal: 'strength', activityLevel: 'moderate', walkComfort: 'comfortable' })
        .pathId,
    ).toBe('build_strength');

    expect(
      recommendPath({
        activityLevel: 'moderate',
        structuredExercise: 'occasional',
        walkComfort: 'comfortable',
        mainGoal: 'return',
        previousExperience: 'lots',
        returningAfterBreak: true,
      }).pathId,
    ).toBe('return_to_fitness');
  });

  it('lets the user override, and records that they did', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'build_stamina' },
      NOW,
    );

    const state = reload().getGameState();
    expect(state?.pathId).toBe('build_stamina');
    expect(state?.onboarding.overrodeRecommendation).toBe(true);
    expect(state?.onboarding.recommendedPathId).toBe('start_moving');
  });

  it('persists an accepted recommendation across a reload', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );

    const state = reload().getGameState();
    expect(state?.onboarding.completed).toBe(true);
    expect(state?.onboarding.overrodeRecommendation).toBe(false);
  });

  it('changes nothing about the fitness data', () => {
    const profileBefore = JSON.stringify(repo.getProfile());
    const baselineBefore = JSON.stringify(repo.getBaseline());
    const healthBefore = JSON.stringify(repo.getHealthContext());
    const plansBefore = JSON.stringify(repo.getWeeklyPlans());

    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'build_strength' },
      NOW,
    );

    expect(JSON.stringify(repo.getProfile())).toBe(profileBefore);
    expect(JSON.stringify(repo.getBaseline())).toBe(baselineBefore);
    expect(JSON.stringify(repo.getHealthContext())).toBe(healthBefore);
    expect(JSON.stringify(repo.getWeeklyPlans())).toBe(plansBefore);
  });

  it('starts everyone at level 1, however fit they already are', () => {
    const fit: OnboardingAnswers = {
      activityLevel: 'active',
      structuredExercise: 'regular',
      walkComfort: 'comfortable',
      mainGoal: 'strength',
      previousExperience: 'lots',
    };
    const recommendation = recommendPath(fit);
    expect(recommendation.fitnessStage).toBe('experienced');

    finishOnboarding(
      repo,
      { answers: fit, recommendedPathId: recommendation.pathId, chosenPathId: recommendation.pathId },
      NOW,
    );

    const state = repo.getGameState();
    expect(state?.xp.level).toBe(1);
    expect(state?.xp.total).toBe(0);
    // Fitness stage and game level are separate concepts, and stay separate.
    expect(state?.fitnessStage).toBe('experienced');
  });

  it('can be rerun without losing anything already earned', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    tick(DAY_1, yoga);
    const earned = sync().state.xp.total;

    restartOnboarding(repo);

    const state = repo.getGameState();
    expect(state?.onboarding.completed).toBe(false);
    expect(state?.xp.total).toBe(earned);
    expect(state?.trophies.length).toBeGreaterThan(0);
  });
});

describe('the egg', () => {
  beforeEach(() => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
  });

  it('starts unhatched', () => {
    expect(sync().state.mascot.eggState).toBe('unhatched');
  });

  it('does not expose the animal before hatching', () => {
    const state = sync().state;
    expect(visibleMascotFamily(state.mascot)).toBeUndefined();
    // The screen asks the domain rather than reading familyId, so it cannot leak.
    expect(gameHeaderSource).not.toMatch(/Tortoise|Bear|\bFox\b|Otter|Wolf/);
    expect(gameHeaderSource).toMatch(/visibleMascotFamily/);
    expect(onboardingSource).not.toMatch(/Tortoise|Bear|\bFox\b|Otter|Wolf/);
  });

  it('becomes ready only after the required number of active days', () => {
    tick(DAY_1, yoga);
    expect(sync().state.mascot.eggState).toBe('unhatched');

    const [walkTwo] = activitiesOn(DAY_2);
    if (!walkTwo) throw new Error('expected a walk on day 2');
    tick(DAY_2, walkTwo);

    expect(HATCH_ACTIVE_DAYS_REQUIRED).toBe(2);
    expect(sync().state.mascot.eggState).toBe('ready');
  });

  it('never hatches on its own', () => {
    tick(DAY_1, yoga);
    const [walkTwo] = activitiesOn(DAY_2);
    if (!walkTwo) throw new Error('expected a walk on day 2');
    tick(DAY_2, walkTwo);

    sync();
    sync();
    sync();
    expect(repo.getGameState()?.mascot.eggState).toBe('ready');
  });

  it('hatches when asked, and stays hatched after a reload', () => {
    tick(DAY_1, yoga);
    const [walkTwo] = activitiesOn(DAY_2);
    if (!walkTwo) throw new Error('expected a walk on day 2');
    tick(DAY_2, walkTwo);
    sync();

    const hatched = hatchEggNow(repo, NOW);
    expect(hatched.mascot.eggState).toBe('hatched');
    expect(hatched.mascot.hatchedAt).toBe(NOW);

    const after = reload();
    expect(after.getGameState()?.mascot.eggState).toBe('hatched');
    expect(sync(after).state.mascot.eggState).toBe('hatched');
  });

  it('ignores a hatch request before the egg is ready', () => {
    expect(hatchEggNow(repo, NOW).mascot.eggState).toBe('unhatched');
  });

  it('reveals the animal only after hatching', () => {
    tick(DAY_1, yoga);
    const [walkTwo] = activitiesOn(DAY_2);
    if (!walkTwo) throw new Error('expected a walk on day 2');
    tick(DAY_2, walkTwo);
    sync();
    const state = hatchEggNow(repo, NOW);

    expect(visibleMascotFamily(state.mascot)?.id).toBe('tortoise');
  });
});

describe('XP is granted once and cannot be farmed', () => {
  beforeEach(() => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
  });

  it('awards a completed activity exactly once', () => {
    tick(DAY_1, yoga);

    const first = sync();
    const activityAwards = first.granted.filter((event) => event.kind === 'activity_completed');
    expect(activityAwards).toHaveLength(1);
    expect(activityAwards[0]?.xp).toBe(XP_REWARDS.activity_completed);

    const second = sync();
    expect(second.granted).toEqual([]);
    expect(second.state.xp.total).toBe(first.state.xp.total);
  });

  it('grants nothing extra on a reload', () => {
    tick(DAY_1, yoga);
    const total = sync().state.xp.total;

    const after = reload();
    const resynced = sync(after);
    expect(resynced.granted).toEqual([]);
    expect(resynced.state.xp.total).toBe(total);
  });

  it('rewards a partial session, without a completion bonus', () => {
    tick(DAY_1, yoga);
    const result = sync();

    expect(result.granted.some((event) => event.kind === 'activity_completed')).toBe(true);
    expect(result.granted.some((event) => event.kind === 'session_completed')).toBe(false);
  });

  it('adds the session bonus once when everything is done', () => {
    tick(DAY_1, yoga);
    tick(DAY_1, walk);

    const first = sync();
    const bonuses = first.granted.filter((event) => event.kind === 'session_completed');
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]?.xp).toBe(XP_REWARDS.session_completed);

    expect(sync().granted).toEqual([]);
  });

  it('does not pay again for unticking and reticking', () => {
    tick(DAY_1, yoga);
    const afterFirst = sync().state.xp.total;

    tick(DAY_1, yoga, false);
    const afterUntick = sync();
    // Earned XP is kept rather than clawed back.
    expect(afterUntick.state.xp.total).toBe(afterFirst);

    tick(DAY_1, yoga, true);
    const afterRetick = sync();
    expect(afterRetick.granted).toEqual([]);
    expect(afterRetick.state.xp.total).toBe(afterFirst);
  });

  it('gives nothing for repeatedly toggling', () => {
    tick(DAY_1, yoga);
    const baseline = sync().state.xp.total;

    for (let round = 0; round < 20; round += 1) {
      tick(DAY_1, yoga, round % 2 === 0);
      sync();
    }

    expect(repo.getGameState()?.xp.total).toBe(baseline);
  });

  it('gives no XP for logging that is not a completed activity', () => {
    const today = session(DAY_1);
    today.apply({
      hydration: { glasses: 8 },
      nutrition: { morningFruit: true },
      recovery: { sleepHours: 7, energy: 6 },
      symptoms: { backPainBefore: 3 },
    });
    today.save();

    const result = sync();
    expect(result.granted.some((event) => event.kind === 'activity_completed')).toBe(false);
    expect(result.granted.some((event) => event.kind === 'session_completed')).toBe(false);
  });

  it('rewards the first recorded day once', () => {
    tick(DAY_1, yoga);
    const first = sync();
    expect(first.granted.filter((event) => event.kind === 'first_programme_day')).toHaveLength(1);

    const [walkTwo] = activitiesOn(DAY_2);
    if (!walkTwo) throw new Error('expected a walk on day 2');
    tick(DAY_2, walkTwo);
    expect(sync().granted.filter((event) => event.kind === 'first_programme_day')).toHaveLength(0);
  });

  it('rewards a rest day only when it is explicitly acknowledged', () => {
    // Ordinary tracking on a rest day is not an acknowledgement.
    const tracked = session(DAY_7);
    tracked.apply({ hydration: { glasses: 5 } });
    tracked.save();
    expect(sync().granted.filter((event) => event.kind === 'rest_day_observed')).toHaveLength(0);

    const rest = session(DAY_7);
    rest.apply(acknowledgeRestDay(true));
    rest.save();

    const restAwards = sync().granted.filter((event) => event.kind === 'rest_day_observed');
    expect(restAwards).toHaveLength(1);
    expect(restAwards[0]?.xp).toBe(XP_REWARDS.rest_day_observed);
  });

  it('rewards the first measurement once', () => {
    repo.saveMeasurements([
      createMeasurement({ recordedOn: DAY_2, weightKg: 69.2 }, { makeId: sequentialIdFactory('m') }),
    ]);
    expect(sync().granted.filter((event) => event.kind === 'first_measurement')).toHaveLength(1);

    repo.saveMeasurements([
      ...repo.getMeasurements(),
      createMeasurement({ recordedOn: DAY_3, weightKg: 69.0 }, { makeId: sequentialIdFactory('m2') }),
    ]);
    expect(sync().granted.filter((event) => event.kind === 'first_measurement')).toHaveLength(0);
  });

  it('raises the level from accumulated XP alone', () => {
    tick(DAY_1, yoga);
    tick(DAY_1, walk);
    const state = sync().state;
    expect(state.xp.level).toBe(levelForXp(state.xp.total));
    expect(state.xp.level).toBeGreaterThanOrEqual(1);
  });
});

describe('skills', () => {
  beforeEach(() => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
  });

  it('has all five tracks from the start', () => {
    const state = sync().state;
    expect(state.skills.map((skill) => skill.kind).sort()).toEqual([...SKILL_KINDS].sort());
    expect(state.skills.every((skill) => skill.level === 1)).toBe(true);
  });

  it('maps walking to stamina and consistency', () => {
    const [walkTwo] = activitiesOn(DAY_2);
    if (!walkTwo) throw new Error('expected a walk on day 2');
    tick(DAY_2, walkTwo);

    const skills = sync().state.skills;
    expect(findSkill(skills, 'stamina')?.xp).toBeGreaterThan(0);
    expect(findSkill(skills, 'consistency')?.xp).toBeGreaterThan(0);
    expect(findSkill(skills, 'mobility')?.xp).toBe(0);
    expect(findSkill(skills, 'strength')?.xp).toBe(0);
  });

  it('maps yoga to mobility, with a little recovery', () => {
    tick(DAY_1, yoga);

    const skills = sync().state.skills;
    expect(findSkill(skills, 'mobility')?.xp).toBeGreaterThan(0);
    expect(findSkill(skills, 'recovery')?.xp).toBeGreaterThan(0);
    expect(findSkill(skills, 'strength')?.xp).toBe(0);
  });

  it('leaves untouched skills at zero rather than inventing a value', () => {
    const skills = sync().state.skills;
    for (const skill of skills) {
      expect(skill.xp).toBe(0);
      expect(skill.level).toBe(1);
    }
  });

  it('highlights different skills for different paths, without hiding the rest', () => {
    expect(highlightedSkillsForPath('build_strength')).toContain('strength');
    expect(highlightedSkillsForPath('build_stamina')).toContain('stamina');
    expect(highlightedSkillsForPath('start_moving')).toContain('consistency');
    expect(highlightedSkillsForPath('build_strength')).not.toEqual(
      highlightedSkillsForPath('build_stamina'),
    );

    // Highlighting is emphasis only: every track still exists and can progress.
    expect(sync().state.skills).toHaveLength(SKILL_KINDS.length);
  });
});

describe('trophies', () => {
  beforeEach(() => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
  });

  it('unlocks the first bronze trophy once', () => {
    tick(DAY_1, yoga);

    const first = sync();
    const unlocks = first.granted.filter((event) => event.kind === 'trophy_unlocked');
    expect(unlocks.some((event) => event.label === 'First Steps')).toBe(true);
    expect(unlocks[0]?.xp).toBe(TROPHY_XP.bronze);

    expect(sync().granted).toEqual([]);
    const ids = repo.getGameState()?.trophies.map((entry) => entry.trophyId) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not duplicate on repeated evaluation', () => {
    tick(DAY_1, yoga);
    sync();
    sync();
    sync();

    const trophies = repo.getGameState()?.trophies ?? [];
    expect(trophies.filter((entry) => entry.trophyId === 'first_steps')).toHaveLength(1);
  });

  it('unlocks new trophies as they are earned, and only then', () => {
    tick(DAY_1, yoga);
    sync();
    expect(repo.getGameState()?.trophies.some((entry) => entry.trophyId === 'getting_started')).toBe(
      false,
    );

    tick(DAY_1, walk);
    sync();
    expect(repo.getGameState()?.trophies.some((entry) => entry.trophyId === 'getting_started')).toBe(
      true,
    );
  });

  it('makes every trophy private on unlock', () => {
    tick(DAY_1, yoga);
    sync();

    const trophies = repo.getGameState()?.trophies ?? [];
    expect(trophies.length).toBeGreaterThan(0);
    expect(trophies.every((entry) => entry.visibility === 'private')).toBe(true);
  });

  it('defines all four tiers', () => {
    const tiers = new Set(TROPHIES.map((trophy) => trophy.tier));
    expect(tiers).toEqual(new Set(['bronze', 'silver', 'gold', 'platinum']));
  });

  it('keeps platinum out of reach in this version', () => {
    expect(PLATINUM_AVAILABLE).toBe(false);

    const platinum = TROPHIES.filter((trophy) => trophy.tier === 'platinum');
    expect(platinum.length).toBeGreaterThan(0);
    for (const trophy of platinum) {
      expect(
        trophy.isEarned({
          completedActivities: 100000,
          fullSessions: 100000,
          distinctActiveDays: 100000,
          programmeDaysRecorded: 100000,
          restDaysObserved: 100000,
          measurementsRecorded: 100000,
        }),
      ).toBe(false);
    }
  });

  it('sets gold well beyond casual reach', () => {
    const gold = findTrophy('hundred_activities');
    expect(gold?.tier).toBe('gold');
    expect(
      gold?.isEarned({
        completedActivities: 20,
        fullSessions: 10,
        distinctActiveDays: 20,
        programmeDaysRecorded: 20,
        restDaysObserved: 3,
        measurementsRecorded: 1,
      }),
    ).toBe(false);
  });
});

describe('mascot', () => {
  it('maps each path to its own family', () => {
    expect(mascotFamilyForPath('start_moving')).toBe('tortoise');
    expect(mascotFamilyForPath('build_strength')).toBe('bear');
    expect(mascotFamilyForPath('build_stamina')).toBe('fox');
    expect(mascotFamilyForPath('balanced_fitness')).toBe('otter');
    expect(mascotFamilyForPath('return_to_fitness')).toBe('wolf');
  });

  it('takes the family from the chosen path, not the recommended one', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'build_strength' },
      NOW,
    );
    expect(repo.getGameState()?.mascot.familyId).toBe('bear');
  });

  it('follows a later path switch', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    switchPath(repo, 'balanced_fitness');
    expect(reload().getGameState()?.mascot.familyId).toBe('otter');
  });

  it('persists its stage across a reload', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    expect(reload().getGameState()?.mascot.stage).toBe('starter');
  });

  it('never evolves by itself', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    const state = repo.getGameState();
    if (!state) throw new Error('expected game state');

    // Force the conditions for evolution and sync repeatedly.
    repo.saveGameState({
      ...state,
      xp: { total: 100000, level: 20 },
      mascot: { ...state.mascot, eggState: 'hatched' },
    });
    sync();
    sync();

    const after = repo.getGameState();
    expect(after?.mascot.evolutionReady).toBe(true);
    // Ready is not the same as evolved.
    expect(after?.mascot.stage).toBe('starter');
  });

  it('evolves only when asked, and clears the flag afterwards', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    const state = repo.getGameState();
    if (!state) throw new Error('expected game state');
    repo.saveGameState({
      ...state,
      xp: { total: 100000, level: 20 },
      mascot: { ...state.mascot, eggState: 'hatched', evolutionReady: true },
    });

    const evolved = evolveMascotNow(repo, NOW);
    expect(evolved.mascot.stage).toBe('growing');
    expect(evolved.mascot.evolutionReady).toBe(false);
    expect(evolved.mascot.lastEvolvedAt).toBe(NOW);
  });

  it('describes evolution progress in words, never a percentage', () => {
    const mascot = {
      familyId: 'tortoise' as const,
      eggState: 'hatched' as const,
      stage: 'starter' as const,
      evolutionReady: false,
    };

    expect(evolutionStatus(mascot, 1)).toBe('settling_in');
    expect(evolutionStatus(mascot, 3)).toBe('getting_stronger');
    expect(evolutionStatus(mascot, 4)).toBe('nearly_ready');
    expect(evolutionStatus({ ...mascot, evolutionReady: true }, 5)).toBe('evolution_close');

    // No numeric progress is exposed anywhere in the mascot UI.
    expect(gameHeaderSource).not.toMatch(/evolutionPercent|toNextEvolution|% to/);
  });
});

describe('settings', () => {
  it('starts private and quiet about it', () => {
    const settings = repo.getGameSettings() ?? createDefaultGameSettings();
    expect(settings.socialMode).toBe('private');
    expect(settings.defaultTrophyVisibility).toBe('private');
    expect(settings.soundEnabled).toBe(false);
    expect(settings.hapticsEnabled).toBe(false);
    expect(settings.challenges.friends).toBe(false);
    expect(settings.challenges.community).toBe(false);
    expect(settings.mascotPersonality).toBe('normal');
  });

  it('persists each preference', () => {
    updateGameSettings(repo, { mascotPersonality: 'chatty', soundEnabled: true, hapticsEnabled: true });
    updateGameSettings(repo, { socialMode: 'friends' });

    const stored = reload().getGameSettings();
    expect(stored?.mascotPersonality).toBe('chatty');
    expect(stored?.soundEnabled).toBe(true);
    expect(stored?.hapticsEnabled).toBe(true);
    expect(stored?.socialMode).toBe('friends');
  });

  it('keeps the three challenge toggles independent', () => {
    updateGameSettings(repo, { challenges: { personal: true, friends: true, community: false } });
    const stored = reload().getGameSettings();

    expect(stored?.challenges).toEqual({ personal: true, friends: true, community: false });
  });

  it('does not let social mode change trophy visibility already granted', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    tick(DAY_1, yoga);
    sync();

    updateGameSettings(repo, { socialMode: 'community' });

    const trophies = reload().getGameState()?.trophies ?? [];
    expect(trophies.every((entry) => entry.visibility === 'private')).toBe(true);
  });
});

describe('the tracker is left alone', () => {
  it('adds game state without disturbing existing fitness records', () => {
    tick(DAY_1, yoga);
    const logBefore = JSON.stringify(repo.getDailyLog(DAY_1));

    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    sync();
    hatchEggNow(repo, NOW);

    expect(JSON.stringify(repo.getDailyLog(DAY_1))).toBe(logBefore);
    expect(repo.getBaseline()?.weightKg).toBe(69.9);
    expect(repo.getWeeklyPlans()[0]?.programmeVersion).toBe('week-1-v1');
  });

  it('keeps no game state inside the daily log', () => {
    tick(DAY_1, yoga);
    sync();

    const log = repo.getDailyLog(DAY_1);
    const serialised = JSON.stringify(log);
    expect(serialised).not.toMatch(/xp|trophy|mascot|level|egg/i);
  });

  it('seeds game state for an install that already has fitness data', () => {
    // A store created before the game layer existed.
    const legacyStore = createMemoryStorageAdapter();
    const legacyRepo = newRepo(legacyStore, 'legacy');
    legacyRepo.initialise();
    legacyStore.remove('ft:v1:game');
    legacyStore.remove('ft:v1:gameSettings');

    const upgraded = newRepo(legacyStore, 'upgraded');
    const result = upgraded.initialise();

    expect(result.seeded).toEqual(['ft:v1:game', 'ft:v1:gameSettings']);
    expect(upgraded.getGameState()?.xp.level).toBe(1);
    expect(upgraded.getBaseline()?.weightKg).toBe(69.9);
  });

  it('leaves symptoms with no influence over game rewards', () => {
    finishOnboarding(
      repo,
      { answers: BEGINNER_ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    tick(DAY_1, yoga);
    tick(DAY_1, walk);
    const withoutSymptoms = sync().state.xp.total;

    const today = session(DAY_1);
    today.apply({
      symptoms: { backPainBefore: 3, backPainAfter: 9, legPain: true, toeSensation: 'worse' },
    });
    today.save();

    const after = sync();
    expect(after.granted).toEqual([]);
    expect(after.state.xp.total).toBe(withoutSymptoms);
  });
});
