import { useCallback, useMemo, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import {
  evolveMascotNow,
  finishOnboarding,
  hatchEggNow,
  switchPath,
  syncGame,
  updateGameSettings,
  type FinishOnboardingInput,
} from '../../app/game';
import type { DerivedFacts } from '../../domain/game/rewards';
import type {
  FitnessPathId,
  GameSettings,
  GameState,
  RewardEvent,
} from '../../domain/game/types';

/**
 * The game layer, as the screens see it.
 *
 * Syncing is cheap and idempotent, so it simply runs whenever this recomputes.
 * Nothing is granted twice: the domain skips any reward key already recorded.
 */

export interface GameHook {
  state: GameState;
  settings: GameSettings;
  facts: DerivedFacts;
  /** Rewards granted by the most recent sync. Empty on a repeat. */
  granted: RewardEvent[];
  needsOnboarding: boolean;
  refresh: () => void;
  hatch: () => void;
  evolve: () => void;
  choosePath: (pathId: FitnessPathId) => void;
  completeOnboarding: (input: FinishOnboardingInput) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
}

export function useGame(): GameHook {
  const context = useMemo(() => getAppContext(), []);
  const repository = context.repository;
  const [revision, setRevision] = useState(0);

  const sync = useMemo(() => {
    void revision;
    return syncGame(repository);
  }, [repository, revision]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const hatch = useCallback(() => {
    hatchEggNow(repository);
    refresh();
  }, [repository, refresh]);

  const evolve = useCallback(() => {
    evolveMascotNow(repository);
    refresh();
  }, [repository, refresh]);

  const choosePathAndRefresh = useCallback(
    (pathId: FitnessPathId) => {
      switchPath(repository, pathId);
      refresh();
    },
    [repository, refresh],
  );

  const completeOnboardingAndRefresh = useCallback(
    (input: FinishOnboardingInput) => {
      finishOnboarding(repository, input);
      refresh();
    },
    [repository, refresh],
  );

  const updateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      updateGameSettings(repository, patch);
      refresh();
    },
    [repository, refresh],
  );

  return {
    state: sync.state,
    settings: sync.settings,
    facts: sync.facts,
    granted: sync.granted,
    needsOnboarding: !sync.state.onboarding.completed,
    refresh,
    hatch,
    evolve,
    choosePath: choosePathAndRefresh,
    completeOnboarding: completeOnboardingAndRefresh,
    updateSettings,
  };
}
