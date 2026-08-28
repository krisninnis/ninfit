import { nowTimestamp, todayISO } from '../domain/dates';
import { createDefaultGameSettings, createInitialGameState, choosePath, completeOnboarding } from '../domain/game/defaults';
import { evolveMascot, hatchEgg } from '../domain/game/mascot';
import {
  partitionPendingRewardDeliveries,
  pendingRewardDeliveriesOf,
  withPendingRewardDeliveries,
} from '../domain/game/rewardDelivery';
import { deriveRewards, grantRewards, type DerivedFacts } from '../domain/game/rewards';
import type {
  FitnessPathId,
  GameSettings,
  GameState,
  OnboardingAnswers,
  RewardEvent,
} from '../domain/game/types';
import type { ISODate, ISODateTime } from '../domain/types';
import type { Repository } from '../storage/repository';
import { recommendFitnessStage } from '../domain/game/onboarding';

/**
 * Orchestration for the game layer: read the tracker, ask the domain what has been
 * earned, write back only when something actually changed.
 *
 * The tracker is read-only from here. Nothing in this file writes a DailyLog, a
 * measurement or a profile, so the game can never alter a fitness record.
 */

export interface GameSyncOptions {
  now?: ISODateTime;
  today?: ISODate;
}

export interface GameSyncResult {
  state: GameState;
  settings: GameSettings;
  /** Empty on every run after the first for a given set of facts. */
  granted: RewardEvent[];
  facts: DerivedFacts;
}

function loadState(repository: Repository, now: ISODateTime): GameState {
  return repository.getGameState() ?? createInitialGameState({ now });
}

function loadSettings(repository: Repository): GameSettings {
  return repository.getGameSettings() ?? createDefaultGameSettings();
}

/**
 * Bring the game up to date with what the tracker holds.
 *
 * Safe to call on every load and every screen mount: rewards already granted are
 * skipped by key, so repeat calls grant nothing and write nothing.
 */
export function syncGame(repository: Repository, options: GameSyncOptions = {}): GameSyncResult {
  const now = options.now ?? nowTimestamp();
  const settings = loadSettings(repository);
  const before = loadState(repository, now);

  const profile = repository.getProfile();
  const facts = deriveRewards({
    programmeStartDate: profile?.programmeStartDate ?? options.today ?? todayISO(),
    plans: repository.getWeeklyPlans(),
    logs: repository.listDailyLogs(),
    measurementCount: repository.getMeasurements().length,
  });

  const { state, granted } = grantRewards(before, facts, { now, settings });

  /*
   * PRUNING THE DELIVERY QUEUE HAPPENS HERE BECAUSE THIS ALREADY RUNS.
   *
   * A pending reward that has waited past the freshness horizon is retired: removed
   * without ever being presented, because an acknowledgement says "here is what you
   * just earned" and a fortnight-old reward is not that. Nothing the user earned is
   * touched - the XP, the skills, the trophy and the awarded key all stay exactly
   * where they were, and nothing anywhere says a word about the gap.
   *
   * No scheduler exists or is needed: `syncGame` runs on every mount, so the queue is
   * evaluated whenever the app is open and never when it is not.
   */
  const { deliverable, retired } = partitionPendingRewardDeliveries(
    pendingRewardDeliveriesOf(state),
    now,
  );
  const next = retired.length === 0 ? state : withPendingRewardDeliveries(state, deliverable);

  // Write only on a real change, so opening the app repeatedly does not churn storage.
  // Retiring a stale ticket is a real change: without it here, the horizon would only
  // ever filter on read and the queue would grow in storage for ever.
  const changed =
    granted.length > 0 ||
    next.mascot.eggState !== before.mascot.eggState ||
    next.mascot.evolutionReady !== before.mascot.evolutionReady ||
    repository.getGameState() === undefined ||
    retired.length > 0;

  if (changed) repository.saveGameState(next);

  return { state: next, settings, granted, facts };
}

/** Hatch, when the user asks. A no-op unless the egg is ready. */
export function hatchEggNow(repository: Repository, now: ISODateTime = nowTimestamp()): GameState {
  const state = loadState(repository, now);
  const mascot = hatchEgg(state.mascot, now);
  if (mascot === state.mascot) return state;

  const next: GameState = { ...state, mascot };
  repository.saveGameState(next);
  return next;
}

/** Evolve, when the user asks. A no-op unless evolution has been earned. */
export function evolveMascotNow(
  repository: Repository,
  now: ISODateTime = nowTimestamp(),
): GameState {
  const state = loadState(repository, now);
  const mascot = evolveMascot(state.mascot, now);
  if (mascot === state.mascot) return state;

  const next: GameState = { ...state, mascot };
  repository.saveGameState(next);
  return next;
}

export interface FinishOnboardingInput {
  answers: OnboardingAnswers;
  recommendedPathId: FitnessPathId;
  chosenPathId: FitnessPathId;
}

/**
 * Record the end of onboarding.
 *
 * Nothing about the tracker is touched: the profile, baseline, health notes and
 * programme are all left exactly as they were. Onboarding chooses a path, not a
 * medical anything.
 */
export function finishOnboarding(
  repository: Repository,
  input: FinishOnboardingInput,
  now: ISODateTime = nowTimestamp(),
): GameState {
  const state = loadState(repository, now);
  const next = completeOnboarding(
    state,
    {
      pathId: input.chosenPathId,
      recommendedPathId: input.recommendedPathId,
      fitnessStage: recommendFitnessStage(input.answers),
      answers: input.answers,
    },
    { now },
  );
  repository.saveGameState(next);
  return next;
}

/** Switch path at any time. Progress already earned is untouched. */
export function switchPath(repository: Repository, pathId: FitnessPathId): GameState {
  const state = loadState(repository, nowTimestamp());
  const next = choosePath(state, pathId);
  repository.saveGameState(next);
  return next;
}

export function updateGameSettings(
  repository: Repository,
  patch: Partial<GameSettings>,
): GameSettings {
  const next: GameSettings = { ...loadSettings(repository), ...patch };
  repository.saveGameSettings(next);
  return next;
}

/** True when the user has not been through onboarding yet. */
export function needsOnboarding(repository: Repository): boolean {
  const state = repository.getGameState();
  return state === undefined || !state.onboarding.completed;
}

/**
 * Run onboarding again.
 *
 * Only the onboarding flag is cleared. XP, trophies, the mascot and every fitness
 * record survive untouched, so reconsidering a path costs nothing.
 */
export function restartOnboarding(repository: Repository): GameState {
  const state = loadState(repository, nowTimestamp());
  const next: GameState = {
    ...state,
    onboarding: { ...state.onboarding, completed: false },
  };
  repository.saveGameState(next);
  return next;
}
