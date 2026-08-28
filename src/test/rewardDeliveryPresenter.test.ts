import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acknowledgeRewardDeliveries,
  finishOnboarding,
  pendingRewardDeliveries,
  syncGame,
} from '../app/game';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import {
  pendingRewardDeliveriesOf,
  withPendingRewardDeliveries,
} from '../domain/game/rewardDelivery';
import type { OnboardingAnswers, RewardEvent } from '../domain/game/types';
import { sequentialIdFactory } from '../domain/ids';
import { createMeasurement } from '../domain/measurement';
import { resolveToday } from '../domain/today';
import type { PlannedActivity, WeeklyPlan } from '../domain/types';
import { nextRewardBatch, rewardBatchKey } from '../ui/rewardDeliveryPresentation';
import { createRepository, type Repository } from '../storage/repository';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';

/**
 * Slice 2 of durable reward delivery: the presenter reads the queue and drains it.
 *
 * `docs/architecture/ninfit-durable-reward-delivery-v1.md` is the contract. The proven
 * defect these close is that a granted reward could be persisted and never said,
 * because the transient delta belonged to whichever `useGame()` instance rendered
 * first - which on a cold load is always App, never Today.
 */

const NOW = '2026-08-14T12:42:00.000+01:00';
const LATER = '2026-09-01T09:00:00.000+01:00';
const DAY_1 = '2026-08-13';

const ANSWERS: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'not_yet',
  mainGoal: 'start_moving',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];
let yoga: PlannedActivity;
let walk: PlannedActivity;

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
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

function record(
  date: string,
  update: Parameters<TodaySession['apply']>[0],
  store: Repository = repo,
): void {
  const entry = session(date, store);
  entry.apply(update);
  entry.save();
}

function onboard(store: Repository = repo): void {
  finishOnboarding(
    store,
    { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
    NOW,
  );
}

function event(id: string, overrides: Partial<RewardEvent> = {}): RewardEvent {
  return {
    id,
    key: `k:${id}`,
    kind: 'activity_completed',
    xp: 20,
    skillXp: {},
    label: `${id} label`,
    awardedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const [first, second] = resolveToday(plans, PROGRAMME_START_DATE, DAY_1).activities;
  if (!first || !second) throw new Error('expected yoga and a walk');
  yoga = first;
  walk = second;
});

// --- The durable read -------------------------------------------------------

describe('reading what is waiting to be said', () => {
  it('returns the queue oldest first', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    const { granted } = syncGame(repo, { now: NOW, today: DAY_1 });

    const pending = pendingRewardDeliveries(repo, NOW);
    expect(pending.map((e) => e.key)).toEqual(
      pendingRewardDeliveriesOf(repo.getGameState() ?? { pendingRewardDeliveries: [] })
        .map((e) => e.key),
    );
    expect(pending.length).toBe(granted.length);
  });

  it('answers with nothing when there is no game state at all', () => {
    expect(pendingRewardDeliveries(repo, NOW)).toEqual([]);
  });

  it('applies the freshness horizon even when nothing has pruned yet', () => {
    onboard();
    const state = repo.getGameState();
    if (state === undefined) throw new Error('expected game state');
    repo.saveGameState(
      withPendingRewardDeliveries(state, [
        event('ancient', { awardedAt: new Date(Date.parse(LATER) - MS_PER_DAY * 30).toISOString() }),
        event('recent', { awardedAt: new Date(Date.parse(LATER) - MS_PER_DAY).toISOString() }),
      ]),
    );

    expect(pendingRewardDeliveries(repo, LATER).map((e) => e.id)).toEqual(['recent']);
    // A read must not write: the stale ticket is still stored until a sync prunes it.
    expect(repo.getGameState()?.pendingRewardDeliveries).toHaveLength(2);
  });

  it('fabricates nothing from a malformed queue', () => {
    onboard();
    const state = repo.getGameState();
    if (state === undefined) throw new Error('expected game state');
    adapter.set('ft:v1:game', JSON.stringify({ ...state, pendingRewardDeliveries: 'broken' }));

    expect(pendingRewardDeliveries(newRepo(adapter, 'reload'), NOW)).toEqual([]);
  });
});

// --- Acknowledgement --------------------------------------------------------

describe('acknowledging what was said', () => {
  function seed(events: RewardEvent[]): void {
    onboard();
    const state = repo.getGameState();
    if (state === undefined) throw new Error('expected game state');
    repo.saveGameState(withPendingRewardDeliveries(state, events));
  }

  it('removes exactly the ids it was given', () => {
    seed([event('a'), event('b'), event('c')]);
    acknowledgeRewardDeliveries(repo, ['b']);
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('preserves the order of what remains', () => {
    seed([event('a'), event('b'), event('c'), event('d')]);
    acknowledgeRewardDeliveries(repo, ['b']);
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.id)).toEqual(['a', 'c', 'd']);
  });

  /**
   * Counts real writes, not just changed content.
   *
   * An earlier version of these two tests compared the serialised state before and
   * after. That passes even when a pointless write happens, because writing the same
   * queue back produces the same bytes - so it could not tell "did nothing" from "did
   * nothing visible". Mutation testing caught it. Storage writes are the thing being
   * asserted, so the test counts storage writes.
   */
  function countingWrites(): () => number {
    let writes = 0;
    const real = repo.saveGameState.bind(repo);
    repo.saveGameState = (state) => {
      writes += 1;
      return real(state);
    };
    return () => writes;
  }

  it('treats an unknown id as a no-op and writes nothing', () => {
    seed([event('a')]);
    const writes = countingWrites();
    acknowledgeRewardDeliveries(repo, ['never-existed']);
    expect(writes()).toBe(0);
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.id)).toEqual(['a']);
  });

  it('writes nothing when the queue is already empty', () => {
    seed([]);
    const writes = countingWrites();
    acknowledgeRewardDeliveries(repo, ['a', 'b']);
    expect(writes()).toBe(0);
  });

  it('writes exactly once for a batch that really was pending', () => {
    seed([event('a'), event('b')]);
    const writes = countingWrites();
    acknowledgeRewardDeliveries(repo, ['a', 'b']);
    expect(writes()).toBe(1);
    // And a repeat of the same acknowledgement writes nothing further.
    acknowledgeRewardDeliveries(repo, ['a', 'b']);
    expect(writes()).toBe(1);
  });

  it('is idempotent: acknowledging the same batch twice is safe', () => {
    seed([event('a'), event('b')]);
    acknowledgeRewardDeliveries(repo, ['a', 'b']);
    acknowledgeRewardDeliveries(repo, ['a', 'b']);
    expect(pendingRewardDeliveries(repo, NOW)).toEqual([]);
  });

  it('does nothing at all when given no ids', () => {
    seed([event('a')]);
    const writes = countingWrites();
    acknowledgeRewardDeliveries(repo, []);
    expect(writes()).toBe(0);
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.id)).toEqual(['a']);
  });

  it('takes nothing the user earned', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    record(DAY_1, toggleActivityCompletion(repo.getDailyLog(DAY_1), walk.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const earned = repo.getGameState();
    if (earned === undefined) throw new Error('expected game state');
    const ids = pendingRewardDeliveries(repo, NOW).map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);

    acknowledgeRewardDeliveries(repo, ids);
    const after = repo.getGameState();
    if (after === undefined) throw new Error('expected game state');

    expect(pendingRewardDeliveries(repo, NOW)).toEqual([]);
    expect(after.xp).toEqual(earned.xp);
    expect(after.skills).toEqual(earned.skills);
    expect(after.trophies).toEqual(earned.trophies);
    expect([...after.awardedKeys].sort()).toEqual([...earned.awardedKeys].sort());
    expect(after.recentEvents).toEqual(earned.recentEvents);
    expect(after.mascot).toEqual(earned.mascot);
    expect(after.onboarding).toEqual(earned.onboarding);
  });

  it('re-reads current state, so a write made since is never clobbered', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    const firstBatch = pendingRewardDeliveries(repo, NOW).map((e) => e.id);
    const xpAtSelection = repo.getGameState()?.xp.total ?? 0;

    // Something else is earned between the batch being chosen and it being acknowledged.
    record(DAY_1, toggleActivityCompletion(repo.getDailyLog(DAY_1), walk.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    const xpAfterSecondGrant = repo.getGameState()?.xp.total ?? 0;
    expect(xpAfterSecondGrant).toBeGreaterThan(xpAtSelection);

    acknowledgeRewardDeliveries(repo, firstBatch);

    // The later XP survives, and the later reward is still waiting to be said.
    expect(repo.getGameState()?.xp.total).toBe(xpAfterSecondGrant);
    const left = pendingRewardDeliveries(repo, NOW);
    expect(left.length).toBeGreaterThan(0);
    expect(left.map((e) => e.id)).not.toContain(firstBatch[0]);
  });

  it('never adds a reward', () => {
    seed([event('a')]);
    acknowledgeRewardDeliveries(repo, ['a']);
    acknowledgeRewardDeliveries(repo, ['b', 'c']);
    expect(pendingRewardDeliveries(repo, NOW)).toEqual([]);
  });
});

// --- Batch policy -----------------------------------------------------------

describe('a batch is a moment, and a moment does not grow', () => {
  const A = event('a');
  const B = event('b');
  const C = event('c');

  it('adopts everything pending when nothing is being said', () => {
    expect(nextRewardBatch([A, B], [], '').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('holds the displayed batch while it is on screen', () => {
    // C arrives mid-dwell. It waits; the batch on screen is not extended.
    expect(nextRewardBatch([A, B, C], [A, B], '').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('presents the leftovers once the first batch has been acknowledged', () => {
    expect(nextRewardBatch([C], [], rewardBatchKey([A, B])).map((e) => e.id)).toEqual(['c']);
  });

  it('does not immediately re-present the batch it has just acknowledged', () => {
    // Only reachable if the removal write failed. Offered again next visit, not now.
    expect(nextRewardBatch([A, B], [], rewardBatchKey([A, B]))).toEqual([]);
  });

  it('says nothing when nothing is pending', () => {
    expect(nextRewardBatch([], [], '')).toEqual([]);
  });

  it('copies rather than aliasing, so a caller cannot mutate the queue', () => {
    const pending = [A, B];
    const batch = nextRewardBatch(pending, [], '');
    batch.pop();
    expect(pending).toHaveLength(2);
  });
});

describe('the batch key is opaque', () => {
  it('is built from ids and nothing else', () => {
    const key = rewardBatchKey([event('a'), event('b', { kind: 'trophy_unlocked', xp: 999 })]);
    expect(key).toBe('a|b');
    expect(key).not.toMatch(/trophy|999|label/);
  });

  it('distinguishes one moment from the next', () => {
    expect(rewardBatchKey([event('a')])).not.toBe(rewardBatchKey([event('b')]));
    expect(rewardBatchKey([])).toBe('');
  });
});

// --- The proven defects -----------------------------------------------------

describe('the defects this closes', () => {
  it('COLD LOAD: an earlier sync grants, and the reward is still waiting for Today', () => {
    onboard();
    repo.saveMeasurements([createMeasurement({ recordedOn: DAY_1, weightKg: 80 })]);

    // App renders first and takes the transient delta.
    const app = syncGame(repo, { now: NOW, today: DAY_1 });
    expect(app.granted.map((e) => e.kind)).toContain('first_measurement');

    // Today renders next. Its own delta is empty - and that no longer matters.
    const today = syncGame(repo, { now: NOW, today: DAY_1 });
    expect(today.granted).toEqual([]);
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.kind)).toContain('first_measurement');
  });

  it('EARNED AWAY FROM TODAY: a measurement added on Profile is still owed', () => {
    onboard();
    repo.saveMeasurements([createMeasurement({ recordedOn: DAY_1, weightKg: 80 })]);

    // Profile, then Passport, then Today - any of them may sync.
    syncGame(repo, { now: NOW, today: DAY_1 });
    syncGame(repo, { now: NOW, today: DAY_1 });
    const owed = pendingRewardDeliveries(repo, NOW);

    expect(owed.map((e) => e.kind)).toContain('first_measurement');
    acknowledgeRewardDeliveries(repo, owed.map((e) => e.id));
    expect(pendingRewardDeliveries(repo, NOW)).toEqual([]);
  });

  it('LEFT MID-DWELL: not acknowledging leaves the reward exactly where it was', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    const owed = pendingRewardDeliveries(repo, NOW).map((e) => e.id);
    expect(owed.length).toBeGreaterThan(0);

    // The dwell was cancelled: nothing is acknowledged.
    // Returning to Today - a fresh read - offers exactly the same batch again.
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.id)).toEqual(owed);
  });

  it('RELOAD: the queue is storage, so it survives a fresh repository', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    const owed = pendingRewardDeliveries(repo, NOW).map((e) => e.id);

    const reloaded = newRepo(adapter, 'reload');
    expect(pendingRewardDeliveries(reloaded, NOW).map((e) => e.id)).toEqual(owed);
  });

  it('FULL DWELL THEN RELOAD: an acknowledged reward never comes back', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    acknowledgeRewardDeliveries(repo, pendingRewardDeliveries(repo, NOW).map((e) => e.id));

    const reloaded = newRepo(adapter, 'reload');
    syncGame(reloaded, { now: NOW, today: DAY_1 });
    expect(pendingRewardDeliveries(reloaded, NOW)).toEqual([]);
  });

  it('duplicate syncs do not duplicate what is owed', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    const first = pendingRewardDeliveries(repo, NOW).map((e) => e.id);
    syncGame(repo, { now: NOW, today: DAY_1 });
    syncGame(repo, { now: NOW, today: DAY_1 });
    expect(pendingRewardDeliveries(repo, NOW).map((e) => e.id)).toEqual(first);
  });
});

// --- Boundaries -------------------------------------------------------------

describe('slice boundaries', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));
  const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
  const strip = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const today = strip(read('ui', 'screens', 'TodayScreen.tsx'));
  const component = strip(read('ui', 'components', 'RewardAcknowledgement.tsx'));
  const hook = strip(read('ui', 'hooks', 'useRewardDelivery.ts'));
  const policy = strip(read('ui', 'rewardDeliveryPresentation.ts'));

  it('keeps Today as the only acknowledgement surface', () => {
    for (const screen of [
      'ProfileScreen.tsx',
      'PassportScreen.tsx',
      'WeekScreen.tsx',
      'ProgressScreen.tsx',
      'JourneyScreen.tsx',
      'DataScreen.tsx',
    ]) {
      expect(strip(read('ui', 'screens', screen)), screen).not.toMatch(
        /RewardAcknowledgement|useRewardDelivery|pendingRewardDeliveries|acknowledgeRewardDeliveries/,
      );
    }
    expect(strip(read('App.tsx'))).not.toMatch(
      /RewardAcknowledgement|useRewardDelivery|acknowledgeRewardDeliveries/,
    );
  });

  it('lets the companion and the acknowledgement share one moment', () => {
    expect(today).toContain('const delivery = useRewardDelivery(game.state);');
    expect(today).toContain('grantedKinds: delivery.batch.map((event) => event.kind)');
    expect(today).toContain('freshMomentKey={delivery.batchKey}');
    expect(today).toContain('granted={delivery.batch}');
  });

  it('passes GameHeader an opaque key and nothing else about the reward', () => {
    /*
     * Narrow on purpose. GameHeader legitimately renders its own XP bar and its own
     * button label; what it must never see is what was EARNED. So this forbids the
     * reward vocabulary and pins the key's type as a plain string, rather than banning
     * the words "xp" and "label" outright - which would fail on the companion strip's
     * own furniture and prove nothing.
     */
    const header = strip(read('ui', 'components', 'GameHeader.tsx'));
    expect(header).not.toMatch(/RewardEvent|RewardKind|granted|pendingReward|rewardDelivery/);
    expect(header).toMatch(/freshMomentKey: string;/);
    expect(today).toMatch(/freshMomentKey=\{delivery\.batchKey\}/);
  });

  it('lets no presentation module derive, grant or value a reward', () => {
    for (const [name, source] of [
      ['RewardAcknowledgement', component],
      ['useRewardDelivery', hook],
      ['rewardDeliveryPresentation', policy],
      ['TodayScreen', today],
    ] as const) {
      expect(source, `${name} derives reward truth`).not.toMatch(
        /deriveRewards|grantRewards|earnedTrophies|XP_REWARDS|sealRewardKeys|awardedKeys/,
      );
    }
  });

  it('lets no presentation module append to the queue', () => {
    for (const source of [component, hook, policy, today]) {
      expect(source).not.toMatch(/appendPendingRewardDeliveries|withPendingRewardDeliveries|saveGameState/);
    }
  });

  it('keeps the pure policy free of React, storage and time', () => {
    expect(policy).not.toMatch(/useState|useEffect|useRef|setTimeout|Date\.|repository|localStorage/);
  });

  it('adds no cross-tab mechanism', () => {
    for (const source of [component, hook, policy, today]) {
      expect(source).not.toMatch(/BroadcastChannel|addEventListener\('storage'|navigator\.locks/);
    }
  });

  it('leaves the known separate defects alone', () => {
    const rewards = read('domain', 'game', 'rewards.ts');
    // The in-place reversal is still exactly as it was: its own slice.
    expect(rewards).toContain(
      'recentEvents: [...granted.reverse(), ...state.recentEvents].slice(0, MAX_RECENT_EVENTS),',
    );
    // No schema or version movement.
    expect(read('domain', 'schema.ts')).toContain('export const SCHEMA_VERSION = 1;');
    expect(read('domain', 'game', 'types.ts')).toContain('export const GAME_SCHEMA_VERSION = 1;');
  });
});

// --- History is not delivery ------------------------------------------------

describe('history never becomes something to say', () => {
  it('does not read recentEvents as a delivery source', () => {
    const SRC = fileURLToPath(new URL('..', import.meta.url));
    const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
    for (const path of [
      ['ui', 'components', 'RewardAcknowledgement.tsx'],
      ['ui', 'hooks', 'useRewardDelivery.ts'],
      ['ui', 'rewardDeliveryPresentation.ts'],
      ['ui', 'screens', 'TodayScreen.tsx'],
    ]) {
      expect(read(...path), path.join('/')).not.toMatch(/recentEvents/);
    }
  });

  it('an imported backup owes nothing, however many times the app syncs', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    // Import clears the queue (slice 1). A later sync must not resurrect it.
    const state = repo.getGameState();
    if (state === undefined) throw new Error('expected game state');
    repo.saveGameState(withPendingRewardDeliveries(state, []));

    syncGame(repo, { now: LATER, today: DAY_1 });
    syncGame(repo, { now: LATER, today: DAY_1 });

    expect(pendingRewardDeliveries(repo, LATER)).toEqual([]);
    expect((repo.getGameState()?.recentEvents ?? []).length).toBeGreaterThan(0);
  });
});
