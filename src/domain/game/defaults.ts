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
 * The chosen path sets the mascot family, so overriding the recommendation changes
 * which animal is waiting inside the egg. The user is never locked in: running
 * onboarding again simply produces a new outcome.
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
      // Only meaningful once hatched; held privately until then.
      familyId: mascotFamilyForPath(input.pathId),
    },
    // Level is untouched on purpose. Onboarding never grants progression.
    xp: state.xp,
  };
}

/** Change path later without disturbing anything already earned. */
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
    mascot: { ...state.mascot, familyId: mascotFamilyForPath(pathId) },
  };
}
