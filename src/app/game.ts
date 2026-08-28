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

/**
 * What is waiting to be said, oldest first.
 *
 * The ONLY route by which a reward reaches presentation. A screen asks this; it does
 * not derive, grant, count or value anything, and it cannot - the answer is a list of
 * events the domain granted and persisted some time earlier, and the caller's whole
 * job is to render them and say when it has.
 *
 * Reads. Never writes: a screen mounting must not be able to change what is owed.
 * Stale tickets are filtered here as well as pruned by `syncGame`, so a queue that has
 * not been synced since the horizon passed still presents nothing.
 *
 * An unreadable queue answers with an empty list rather than a guess. Nothing is
 * repaired from here and nothing is fabricated - see `getGameState`, which is where
 * that decision is made and where the bad value is quarantined.
 */
export function pendingRewardDeliveries(
  repository: Repository,
  now: ISODateTime = nowTimestamp(),
): RewardEvent[] {
  const state = repository.getGameState();
  if (state === undefined) return [];
  return partitionPendingRewardDeliveries(pendingRewardDeliveriesOf(state), now).deliverable;
}

/**
 * Mark exactly these events as said, and persist it.
 *
 * IDS, NOT KINDS OR XP. The caller names what it actually put in front of the person,
 * and nothing else crosses this boundary. Presentation cannot express "acknowledge all
 * trophies" or "acknowledge everything", because neither is a thing it witnessed.
 *
 * IT RE-READS RATHER THAN TRUSTING THE CALLER'S COPY. A component holds a snapshot
 * from whenever it last rendered, and writing that snapshot back would quietly undo
 * anything granted since - XP, a trophy, an awarded key. So current state is read
 * here, at acknowledgement time, and only the delivery queue within it changes.
 *
 * REMOVAL ONLY, WHICH IS WHAT MAKES IT SAFE TO GET WRONG. Removals commute and repeat
 * harmlessly: acknowledging an unknown id, or the same id twice, is a no-op. Two tabs
 * doing this at once cannot resurrect an acknowledged reward or lose an unacknowledged
 * one - the worst they can manage is showing the same thing twice, which is the
 * honest v1 contract. See the architecture spec, section 14.
 */
export function acknowledgeRewardDeliveries(
  repository: Repository,
  ids: readonly string[],
): void {
  if (ids.length === 0) return;

  const state = repository.getGameState();
  if (state === undefined) return;

  const pending = pendingRewardDeliveriesOf(state);
  if (pending.length === 0) return;

  const acknowledged = new Set(ids);
  const remaining = pending.filter((event) => !acknowledged.has(event.id));

  // Nothing matched: an id from another tab, another batch, or a repeat. Not an error,
  // and not a reason to write.
  if (remaining.length === pending.length) return;

  repository.saveGameState(withPendingRewardDeliveries(state, remaining));
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
