import { nowTimestamp } from '../dates';
import { newId, type IdFactory } from '../ids';
import type { ISODateTime } from '../types';
import { mascotFamilyForPath } from './paths';
import {
  GAME_SCHEMA_VERSION,
  type FitnessPathId,
  type FitnessStageId,
  type GameSettings,
  type GameState,
} from './types';
import { createInitialSkills } from './xp';

/**
 * The starting state of the game layer.
 *
 * Every social setting is off and every visibility is private. That is the product
 * principle rather than a default someone happened to pick: social participation is
 * opt-in and granular, and health data is private regardless of anything else.
 */

export interface GameSeedOptions {
  now?: ISODateTime;
  makeId?: IdFactory;
}

export function createDefaultGameSettings(): GameSettings {
  return {
    theme: 'system',
    mascotPersonality: 'normal',
    soundEnabled: false,
    hapticsEnabled: false,
    socialMode: 'private',
    challenges: {
      // Personal challenges need nobody else, so they are the only one on by default.
      personal: true,
      friends: false,
      community: false,
    },
    defaultTrophyVisibility: 'private',
  };
}

/** Fill additive preferences when an older local save or backup predates them. */
export function normaliseGameSettings(
  stored: Partial<GameSettings> | undefined,
): GameSettings {
  const defaults = createDefaultGameSettings();
  const theme = stored?.theme;

  return {
    ...defaults,
    ...stored,
    theme: theme === 'light' || theme === 'dark' || theme === 'system'
      ? theme
      : defaults.theme,
    challenges: {
      ...defaults.challenges,
      ...stored?.challenges,
    },
  };
}

/**
 * A fresh game state.
 *
 * Level 1 for everyone, always. Onboarding can place someone at a later FITNESS
 * stage, but the game journey measures time spent with this app, so it starts at the
 * beginning no matter how fit the person already is.
 */
export function createInitialGameState(options: GameSeedOptions = {}): GameState {
  const timestamp = options.now ?? nowTimestamp();
  void (options.makeId ?? newId);

  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    createdAt: timestamp,
    onboarding: {
      completed: false,
      answers: {},
      overrodeRecommendation: false,
    },
    fitnessStage: 'settling_in',
    mascot: {
      // Chosen when a path is picked. Never shown until the egg hatches.
      familyId: 'tortoise',
      eggState: 'unhatched',
      stage: 'starter',
      evolutionReady: false,
    },
    xp: { total: 0, level: 1 },
    skills: createInitialSkills(),
    trophies: [],
    awardedKeys: [],
    recentEvents: [],
    cosmetics: { ownedIds: [], equipped: {} },
  };
}

export interface CompleteOnboardingInput {
  pathId: FitnessPathId;
  recommendedPathId: FitnessPathId;
  fitnessStage: FitnessStageId;
  answers: GameState['onboarding']['answers'];
}

/**
 * Record the outcome of onboarding.
 *
 * Before hatch, the final chosen path decides which family is waiting inside the
 * egg, so overriding the recommendation is a real choice.
 *
 * After hatch, the companion's identity is permanent. Re-running onboarding may
 * change the fitness path and programme direction, but it must never transform an
 * established companion into a different species.
 */
export function completeOnboarding(
  state: GameState,
  input: CompleteOnboardingInput,
  options: GameSeedOptions = {},
): GameState {
  const timestamp = options.now ?? nowTimestamp();

  return {
    ...state,
    pathId: input.pathId,
    fitnessStage: input.fitnessStage,
    onboarding: {
      completed: true,
      completedAt: timestamp,
      answers: input.answers,
      recommendedPathId: input.recommendedPathId,
      overrodeRecommendation: input.pathId !== input.recommendedPathId,
    },
    mascot: {
      ...state.mascot,
      // Before hatch this comes from the FINAL chosen path, not the
      // recommendation, and `visibleMascotFamily` refuses to reveal it until the
      // egg opens - so recording it here leaks nothing. Once the companion
      // exists its species is permanent, and a later path change moves the
      // programme only.
      familyId:
        state.mascot.eggState === 'hatched'
          ? state.mascot.familyId
          : mascotFamilyForPath(input.pathId),
      /*
       * Finishing onboarding is what makes the egg ready. The explicit
       * "Start my journey" action then runs the presentation and calls `hatchEgg`,
       * which stays the one and only place the egg actually opens.
       *
       * Guarded to `unhatched` so re-running onboarding later can never reset a
       * mascot that already exists, nor its stage, XP or evolution.
       */
      eggState: state.mascot.eggState === 'unhatched' ? 'ready' : state.mascot.eggState,
    },
    // Level is untouched on purpose. Onboarding never grants progression.
    xp: state.xp,
  };
}

/**
 * Change path later without disturbing anything already earned.
 *
 * Before hatch, changing path also changes the hidden family. After hatch, the
 * programme may change but the established companion's species does not.
 */
export function choosePath(state: GameState, pathId: FitnessPathId): GameState {
  return {
    ...state,
    pathId,
    onboarding: {
      ...state.onboarding,
      overrodeRecommendation:
        state.onboarding.recommendedPathId !== undefined &&
        state.onboarding.recommendedPathId !== pathId,
    },
    mascot: {
      ...state.mascot,
      familyId:
        state.mascot.eggState === 'hatched'
          ? state.mascot.familyId
          : mascotFamilyForPath(pathId),
    },
  };
}
