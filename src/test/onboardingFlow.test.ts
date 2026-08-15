import { beforeEach, describe, expect, it } from 'vitest';
import onboardingSource from '../ui/screens/OnboardingScreen.tsx?raw';
import appSource from '../App.tsx?raw';
import eggSource from '../ui/components/EggArt.tsx?raw';
import { finishOnboarding, needsOnboarding, restartOnboarding } from '../app/game';
import {
  isRequiredQuestion,
  onboardingStages,
  prefillFromExistingData,
  recommendPath,
  stageProgress,
  type OnboardingStage,
} from '../domain/game/onboarding';
import { sequentialIdFactory } from '../domain/ids';
import type { OnboardingAnswers } from '../domain/game/types';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';

let adapter: StorageAdapter;
let repo: Repository;

const SEDENTARY: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'not_yet',
  mainGoal: 'start_moving',
};

const REGULAR: OnboardingAnswers = {
  activityLevel: 'moderate',
  structuredExercise: 'regular',
  walkComfort: 'comfortable',
  mainGoal: 'strength',
};

function questionIds(stages: readonly OnboardingStage[]): string[] {
  return stages.filter((stage) => stage.kind === 'question').map((stage) => stage.question.id);
}

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
});

// ---------------------------------------------------------------------------

describe('the stage model', () => {
  it('opens on the welcome screen', () => {
    expect(onboardingStages({})[0]).toEqual({ kind: 'welcome' });
  });

  it('ends on the recommendation', () => {
    const stages = onboardingStages(SEDENTARY);
    expect(stages[stages.length - 1]).toEqual({ kind: 'recommendation' });
  });

  it('gives every question its own stage', () => {
    const stages = onboardingStages(SEDENTARY);
    const questions = stages.filter((stage) => stage.kind === 'question');

    expect(questions.length).toBeGreaterThan(0);
    // One question per screen, never two.
    for (const stage of questions) {
      expect(stage.kind).toBe('question');
      expect(stage.question.prompt.length).toBeGreaterThan(0);
    }
  });

  it('keeps the flow to a handful of steps for a beginner', () => {
    const ids = questionIds(onboardingStages(SEDENTARY));
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(ids.length).toBeLessThanOrEqual(9);
  });

  it('starts with the four core questions in order', () => {
    expect(questionIds(onboardingStages({})).slice(0, 4)).toEqual([
      'activityLevel',
      'structuredExercise',
      'walkComfort',
      'mainGoal',
    ]);
  });
});

describe('adaptive questions', () => {
  it('asks about experience and breaks only when there is history to ask about', () => {
    const ids = questionIds(onboardingStages(REGULAR));
    expect(ids).toContain('previousExperience');
    expect(ids).toContain('returningAfterBreak');
  });

  it('skips those questions for someone doing nothing structured', () => {
    const ids = questionIds(onboardingStages(SEDENTARY));
    expect(ids).not.toContain('previousExperience');
    expect(ids).not.toContain('returningAfterBreak');
  });

  it('asks about equipment only where strength is on the table', () => {
    expect(questionIds(onboardingStages(REGULAR))).toContain('equipmentAccess');
    expect(questionIds(onboardingStages(SEDENTARY))).not.toContain('equipmentAccess');
  });

  it('grows the flow as an answer reveals a follow-up', () => {
    const before = questionIds(onboardingStages(SEDENTARY)).length;
    const after = questionIds(
      onboardingStages({ ...SEDENTARY, structuredExercise: 'regular' }),
    ).length;
    expect(after).toBeGreaterThan(before);
  });

  it('marks only the four core questions as required', () => {
    expect(isRequiredQuestion('activityLevel')).toBe(true);
    expect(isRequiredQuestion('mainGoal')).toBe(true);
    expect(isRequiredQuestion('confidence')).toBe(false);
    expect(isRequiredQuestion('anythingElse')).toBe(false);
  });
});

describe('progress reporting is truthful', () => {
  it('reports no question on the welcome screen', () => {
    const stages = onboardingStages(SEDENTARY);
    expect(stageProgress(stages, 0).questionNumber).toBe(0);
  });

  it('counts forward one question at a time', () => {
    const stages = onboardingStages(SEDENTARY);
    expect(stageProgress(stages, 1).questionNumber).toBe(1);
    expect(stageProgress(stages, 2).questionNumber).toBe(2);
    expect(stageProgress(stages, 3).questionNumber).toBe(3);
  });

  it('reaches a full bar on the recommendation', () => {
    const stages = onboardingStages(SEDENTARY);
    expect(stageProgress(stages, stages.length - 1).fraction).toBe(1);
  });

  it('never claims a fixed total, because the total can change', () => {
    // A bar, not "Step 2 of 6": the count is honest about being provisional.
    expect(onboardingSource).not.toMatch(/Step \d+ of/);
    expect(onboardingSource).toMatch(/role="progressbar"/);
  });

  it('clamps out-of-range positions rather than throwing', () => {
    const stages = onboardingStages(SEDENTARY);
    expect(() => stageProgress(stages, 99)).not.toThrow();
    expect(stageProgress(stages, 99).fraction).toBe(1);
  });
});

describe('the recommendation stage', () => {
  it('stays deterministic for the same completed answers', () => {
    const a = recommendPath(SEDENTARY);
    const b = recommendPath({ ...SEDENTARY });
    expect(a.pathId).toBe(b.pathId);
    expect(a.explanation).toBe(b.explanation);
  });

  it('keeps its evidence-based explanation', () => {
    const result = recommendPath(SEDENTARY);
    expect(result.explanation).toMatch(/because/);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(onboardingSource).toMatch(/recommendation\.explanation/);
  });

  it('offers accepting, browsing and overriding', () => {
    expect(onboardingSource).toMatch(/Start this path/);
    expect(onboardingSource).toMatch(/See other paths/);
    expect(onboardingSource).toMatch(/Choose \{path\.name\}/);
  });

  it('records an override and keeps the level at 1', () => {
    finishOnboarding(
      repo,
      { answers: SEDENTARY, recommendedPathId: 'start_moving', chosenPathId: 'build_stamina' },
      NOW,
    );

    const state = repo.getGameState();
    expect(state?.pathId).toBe('build_stamina');
    expect(state?.onboarding.overrodeRecommendation).toBe(true);
    expect(state?.xp.level).toBe(1);
    expect(state?.xp.total).toBe(0);
  });
});

describe('navigation preserves work in progress', () => {
  it('holds answers in component state, so Back cannot lose them', () => {
    expect(onboardingSource).toMatch(/const \[answers, setAnswers\] = useState/);
    expect(onboardingSource).toMatch(/const goBack =/);
    expect(onboardingSource).toMatch(/setIndex\(\(value\) => Math\.max\(0, value - 1\)\)/);
  });

  it('writes nothing until a path is accepted', () => {
    // The screen's only write path is onComplete; no repository saves happen inside it.
    expect(onboardingSource).not.toMatch(/saveGameState|saveProfile|saveBaseline|saveDailyLog/);
    expect(needsOnboarding(repo)).toBe(true);
  });

  it('offers Back and Continue', () => {
    expect(onboardingSource).toMatch(/>\s*Back\s*</);
    expect(onboardingSource).toMatch(/Continue/);
  });
});

describe('existing users', () => {
  it('is not forced on someone who has already completed it', () => {
    finishOnboarding(
      repo,
      { answers: SEDENTARY, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );

    expect(needsOnboarding(repo)).toBe(false);
    // App only shows the flow when the game says it is needed.
    expect(appSource).toMatch(/game\.needsOnboarding/);
  });

  it('can be rerun on demand, keeping everything earned', () => {
    finishOnboarding(
      repo,
      { answers: SEDENTARY, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
      NOW,
    );
    const state = repo.getGameState();
    if (!state) throw new Error('expected game state');
    repo.saveGameState({ ...state, xp: { total: 240, level: 3 } });

    restartOnboarding(repo);

    expect(needsOnboarding(repo)).toBe(true);
    expect(repo.getGameState()?.xp).toEqual({ total: 240, level: 3 });
  });

  it('prefills from the tracker without reading private health notes', () => {
    const prefilled = prefillFromExistingData(repo.getProfile(), repo.getBaseline());

    expect(prefilled.activityLevel).toBe('sedentary'); // 3,000 baseline steps
    expect(prefilled.structuredExercise).toBe('none');
    expect(prefilled.walkComfort).toBe('with_effort'); // 15-minute capacity

    // Nothing in the prefill or the screen touches health context.
    expect(JSON.stringify(prefilled)).not.toMatch(/disc|sciatica|prediabetes|toe/i);
    expect(onboardingSource).not.toMatch(/getHealthContext|healthContext|healthNote/);
  });

  it('leaves the tracker untouched when a path is chosen', () => {
    const before = {
      profile: JSON.stringify(repo.getProfile()),
      baseline: JSON.stringify(repo.getBaseline()),
      health: JSON.stringify(repo.getHealthContext()),
      plans: JSON.stringify(repo.getWeeklyPlans()),
    };

    finishOnboarding(
      repo,
      { answers: SEDENTARY, recommendedPathId: 'start_moving', chosenPathId: 'balanced_fitness' },
      NOW,
    );

    expect(JSON.stringify(repo.getProfile())).toBe(before.profile);
    expect(JSON.stringify(repo.getBaseline())).toBe(before.baseline);
    expect(JSON.stringify(repo.getHealthContext())).toBe(before.health);
    expect(JSON.stringify(repo.getWeeklyPlans())).toBe(before.plans);
  });
});

describe('the mascot stays secret', () => {
  it('names no animal anywhere in the flow', () => {
    expect(onboardingSource).not.toMatch(/Tortoise|Bear|\bFox\b|Otter|Wolf/);
    expect(onboardingSource).not.toMatch(/mascotFamily|familyId|glyph/);
  });

  /**
   * This test used to forbid the word "egg" outright, which was right while
   * onboarding had no egg in it. Phase 5 puts the Mystery Egg on every stage on
   * purpose - it is the narrative thread through the flow - so a blanket ban would
   * now forbid the intended design rather than protect anything.
   *
   * What actually has to stay secret is the ANIMAL, and hatching, which is a later
   * and explicit user action. So the ban narrows to those, and the egg is allowed
   * only as the shared neutral component that cannot vary by path.
   */
  it('never mentions hatching, and shows the egg only as the shared neutral art', () => {
    expect(onboardingSource).not.toMatch(/hatch/i);
    expect(onboardingSource).not.toMatch(/egg--|eggState|EggArt ready/);

    // The egg appears exactly once, via the shared component.
    expect(onboardingSource.match(/<EggArt\b/g)?.length ?? 0).toBe(1);
  });

  it('gives the egg no label, alt text or title that could hint at the animal', () => {
    expect(eggSource).not.toMatch(/aria-label|alt=|<title|<desc/);
    expect(eggSource).toMatch(/aria-hidden="true"/);
    expect(eggSource).not.toMatch(/Tortoise|Bear|\bFox\b|Otter|Wolf|familyId/);
  });
});

describe('accessibility and motion', () => {
  it('uses real buttons with pressed state, not colour alone', () => {
    expect(onboardingSource).toMatch(/type="button"/);
    expect(onboardingSource).toMatch(/aria-pressed=\{selected\}/);
    // A tick mark accompanies the colour change.
    expect(onboardingSource).toMatch(/step__optionMark/);
  });

  it('labels the option groups and the progress bar', () => {
    expect(onboardingSource).toMatch(/role="group"/);
    expect(onboardingSource).toMatch(/aria-labelledby=\{headingId\}/);
    expect(onboardingSource).toMatch(/aria-valuenow/);
    expect(onboardingSource).toMatch(/aria-label="Onboarding progress"/);
  });

  it('keeps a sensible heading hierarchy', () => {
    expect(onboardingSource).toMatch(/<h1 className="step__title">/);
    expect(onboardingSource).toMatch(/<h2 className="step__prompt"/);
  });

  it('respects reduced motion', () => {
    // The stage transition is a plain CSS class, so the global
    // prefers-reduced-motion rule in styles.css (which drops every animation to
    // 0.01ms) applies to it without the component doing anything.
    //
    // The stylesheet itself cannot be asserted here: Vite compiles CSS, so both
    // ?raw and ?inline return an empty string under the node test environment.
    // Rather than add a dependency to read the file, this checks what it can - that
    // the animation is CSS-driven and nothing imperative or library-based is used.
    expect(onboardingSource).toMatch(/className="step__body"/);
    expect(onboardingSource).not.toMatch(/framer-motion|lottie|gsap|<video/i);
    expect(onboardingSource).not.toMatch(/requestAnimationFrame|\.animate\(|setInterval/);
  });
});
