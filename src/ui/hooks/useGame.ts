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
import type { FitnessPathId, GameSettings, GameState } from '../../domain/game/types';
import { telemetry } from '../../telemetry/runtime';

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
  /*
   * `granted` is deliberately NOT here.
   *
   * It used to be, and it was the reward delivery channel: the transient delta of
   * whichever instance of this hook rendered first. Since App always renders before
   * Today, Today's copy was empty on every cold load and the reward was never said.
   *
   * Delivery is now durable and lives in `GameState.pendingRewardDeliveries`, read
   * through `useRewardDelivery`. Re-exposing a transient delta here would hand a future
   * screen the same footgun back, so it stays off this surface. `syncGame` still
   * returns `granted` for the app layer and the tests that check granting itself.
   */
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
    const before = repository.getGameState()?.mascot.eggState;
    const next = hatchEggNow(repository);
    if (before !== 'hatched' && next.mascot.eggState === 'hatched') {
      telemetry().capture({ name: 'hatch_completed' });
    }
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
      telemetry().capture({ name: 'onboarding_completed' });
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
    needsOnboarding: !sync.state.onboarding.completed,
    refresh,
    hatch,
    evolve,
    choosePath: choosePathAndRefresh,
    completeOnboarding: completeOnboardingAndRefresh,
    updateSettings,
  };
}
