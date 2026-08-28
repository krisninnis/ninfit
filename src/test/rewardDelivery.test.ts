import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finishOnboarding, syncGame } from '../app/game';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { createDefaultGameSettings, createInitialGameState } from '../domain/game/defaults';
import {
  MAX_PENDING_REWARD_DELIVERIES,
  REWARD_DELIVERY_HORIZON_DAYS,
  appendPendingRewardDeliveries,
  isPendingRewardDeliveries,
  partitionPendingRewardDeliveries,
  pendingRewardDeliveriesOf,
  withPendingRewardDeliveries,
  withoutPendingRewardDeliveries,
} from '../domain/game/rewardDelivery';
import { deriveRewards, grantRewards } from '../domain/game/rewards';
import { GAME_SCHEMA_VERSION, type GameState, type RewardEvent } from '../domain/game/types';
import { sequentialIdFactory } from '../domain/ids';
import { createMeasurement } from '../domain/measurement';
import { SCHEMA_VERSION } from '../domain/schema';
import { resolveToday } from '../domain/today';
import type { OnboardingAnswers } from '../domain/game/types';
import type { PlannedActivity, WeeklyPlan } from '../domain/types';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport, type PreparedImport } from '../io/importJson';
import { STORAGE_KEYS, createRepository, type Repository } from '../storage/repository';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';

/**
 * Slice 1 of durable reward delivery: the persisted queue.
 *
 * `docs/architecture/ninfit-durable-reward-delivery-v1.md` is the contract these
 * assertions protect. Nothing here touches presentation - no UI consumes the queue
 * yet, and one test below keeps it that way.
 */

const NOW = '2026-08-14T12:42:00.000+01:00';
const LATER = '2026-09-01T09:00:00.000+01:00';
const DAY_1 = '2026-08-13';
const DAY_2 = '2026-08-14';

const ANSWERS: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'not_yet',
  mainGoal: 'start_moving',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HORIZON_MS = REWARD_DELIVERY_HORIZON_DAYS * MS_PER_DAY;

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

function pendingOf(store: Repository = repo): RewardEvent[] {
  const state = store.getGameState();
  return state === undefined ? [] : pendingRewardDeliveriesOf(state);
}

function event(overrides: Partial<RewardEvent> = {}): RewardEvent {
  return {
    id: 'e-1',
    key: 'k-1',
    kind: 'activity_completed',
    xp: 20,
    skillXp: {},
    label: 'Something completed',
    awardedAt: NOW,
    ...overrides,
  };
}

/** An event stamped `days` before `from`, to the millisecond. */
function agedEvent(from: string, ms: number, overrides: Partial<RewardEvent> = {}): RewardEvent {
  return event({ awardedAt: new Date(Date.parse(from) - ms).toISOString(), ...overrides });
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

// --- The field itself -------------------------------------------------------

describe('absent and empty mean the same thing', () => {
  it('reads a state with no queue as an empty queue', () => {
    expect(pendingRewardDeliveriesOf({ pendingRewardDeliveries: undefined })).toEqual([]);
    expect(pendingRewardDeliveriesOf({ pendingRewardDeliveries: [] })).toEqual([]);
  });

  it('does not write an empty queue into a fresh save', () => {
    // Absent is the smaller of two identical meanings, so defaults carry nothing.
    expect(createInitialGameState({ now: NOW }).pendingRewardDeliveries).toBeUndefined();
    expect('pendingRewardDeliveries' in createInitialGameState({ now: NOW })).toBe(false);
  });

  it('removes the field rather than storing an empty array', () => {
    const state = withPendingRewardDeliveries(createInitialGameState({ now: NOW }), [event()]);
    expect(state.pendingRewardDeliveries).toHaveLength(1);
    expect('pendingRewardDeliveries' in withPendingRewardDeliveries(state, [])).toBe(false);
    expect('pendingRewardDeliveries' in withoutPendingRewardDeliveries(state)).toBe(false);
  });

  it('loads an older save that predates the queue entirely', () => {
    onboard();
    const stored = repo.getGameState();
    if (stored === undefined) throw new Error('expected game state');
    expect(stored.pendingRewardDeliveries).toBeUndefined();

    // And syncing on top of it still works, granting and enqueueing normally.
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    const result = syncGame(repo, { now: NOW, today: DAY_1 });
    expect(result.granted.length).toBeGreaterThan(0);
    expect(pendingOf().length).toBe(result.granted.length);
  });
});

// --- Enqueue ----------------------------------------------------------------

describe('newly granted rewards are enqueued', () => {
  it('puts every granted event in the queue', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    const { granted } = syncGame(repo, { now: NOW, today: DAY_1 });

    expect(granted.length).toBeGreaterThan(0);
    expect(pendingOf().map((e) => e.key).sort()).toEqual(granted.map((e) => e.key).sort());
  });

  it('keeps the queue in the domain derivation order, oldest first', () => {
    onboard();
    const before = repo.getGameState();
    if (before === undefined) throw new Error('expected game state');

    const facts = deriveRewards({
      programmeStartDate: PROGRAMME_START_DATE,
      plans,
      logs: repo.listDailyLogs(),
      measurementCount: 1,
    });
    const { state } = grantRewards(before, facts, { now: NOW, settings: createDefaultGameSettings() });

    expect(facts.rewards.length).toBeGreaterThan(1);
    expect(state.pendingRewardDeliveries?.map((e) => e.key)).toEqual(
      facts.rewards.map((r) => r.key),
    );
  });

  it('is not corrupted by the in-place reversal that builds recentEvents', () => {
    /*
     * `grantRewards` builds `recentEvents` from `granted.reverse()`, which mutates.
     * That is a known, separately-tracked defect and is NOT fixed here - this test
     * pins that the queue is unaffected by it either way, so the two slices stay
     * independent. If someone later fixes the reversal, this test must still pass.
     */
    onboard();
    const before = repo.getGameState();
    if (before === undefined) throw new Error('expected game state');

    const facts = deriveRewards({
      programmeStartDate: PROGRAMME_START_DATE,
      plans,
      logs: repo.listDailyLogs(),
      measurementCount: 1,
    });
    const derivedOrder = facts.rewards.map((r) => r.key);
    const result = grantRewards(before, facts, { now: NOW, settings: createDefaultGameSettings() });

    // The queue follows the domain.
    expect(result.state.pendingRewardDeliveries?.map((e) => e.key)).toEqual(derivedOrder);
    // recentEvents is newest-first, which is the opposite order, and stays that way.
    expect(result.state.recentEvents.map((e) => e.key)).toEqual([...derivedOrder].reverse());
    // The queue is a copy: mutating what `granted` returned cannot reach it.
    result.granted.reverse();
    expect(result.state.pendingRewardDeliveries?.map((e) => e.key)).toEqual(derivedOrder);
  });

  it('does not duplicate entries when the same truth syncs twice', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));

    const first = syncGame(repo, { now: NOW, today: DAY_1 });
    const afterFirst = pendingOf().map((e) => e.key);
    const second = syncGame(repo, { now: NOW, today: DAY_1 });

    expect(first.granted.length).toBeGreaterThan(0);
    expect(second.granted).toEqual([]);
    expect(pendingOf().map((e) => e.key)).toEqual(afterFirst);
  });

  it('refuses a duplicate key defensively, even if one arrives twice', () => {
    const pending = [event({ id: 'a', key: 'dup' })];
    const next = appendPendingRewardDeliveries(pending, [
      event({ id: 'b', key: 'dup' }),
      event({ id: 'c', key: 'fresh' }),
      event({ id: 'd', key: 'fresh' }),
    ]);

    expect(next.map((e) => e.key)).toEqual(['dup', 'fresh']);
    expect(next[0]?.id).toBe('a');
  });

  it('appends after what is already waiting, never before it', () => {
    const pending = [event({ id: 'old', key: 'old' })];
    const next = appendPendingRewardDeliveries(pending, [event({ id: 'new', key: 'new' })]);
    expect(next.map((e) => e.id)).toEqual(['old', 'new']);
  });

  it('never mutates the queue it was given', () => {
    const pending = [event({ id: 'a', key: 'a' })];
    appendPendingRewardDeliveries(pending, [event({ id: 'b', key: 'b' })]);
    expect(pending).toHaveLength(1);
  });
});

// --- Freshness and retirement ----------------------------------------------

describe('the freshness horizon', () => {
  it('is seven days', () => {
    expect(REWARD_DELIVERY_HORIZON_DAYS).toBe(7);
  });

  it('keeps everything inside the horizon', () => {
    const pending = [agedEvent(NOW, 0, { key: 'a' }), agedEvent(NOW, MS_PER_DAY * 6, { key: 'b' })];
    const { deliverable, retired } = partitionPendingRewardDeliveries(pending, NOW);
    expect(deliverable.map((e) => e.key)).toEqual(['a', 'b']);
    expect(retired).toEqual([]);
  });

  it('retires anything past the horizon', () => {
    const pending = [
      agedEvent(NOW, MS_PER_DAY * 30, { key: 'ancient' }),
      agedEvent(NOW, MS_PER_DAY, { key: 'recent' }),
    ];
    const { deliverable, retired } = partitionPendingRewardDeliveries(pending, NOW);
    expect(deliverable.map((e) => e.key)).toEqual(['recent']);
    expect(retired.map((e) => e.key)).toEqual(['ancient']);
  });

  it('pins the boundary: exactly on the horizon still counts, a millisecond past does not', () => {
    const onIt = agedEvent(NOW, HORIZON_MS, { key: 'exactly' });
    const pastIt = agedEvent(NOW, HORIZON_MS + 1, { key: 'just_past' });

    expect(partitionPendingRewardDeliveries([onIt], NOW).deliverable).toHaveLength(1);
    expect(partitionPendingRewardDeliveries([pastIt], NOW).retired).toHaveLength(1);
  });

  it('keeps a reward stamped in the future rather than destroying it', () => {
    // A device clock that moved, or a backup written on another machine.
    const ahead = agedEvent(NOW, -MS_PER_DAY * 3, { key: 'future' });
    const { deliverable, retired } = partitionPendingRewardDeliveries([ahead], NOW);
    expect(deliverable.map((e) => e.key)).toEqual(['future']);
    expect(retired).toEqual([]);
  });

  it('retires nothing at all when the clock cannot be read', () => {
    const pending = [agedEvent(NOW, MS_PER_DAY * 400, { key: 'ancient' })];
    const { deliverable, retired } = partitionPendingRewardDeliveries(pending, 'not-a-time');
    expect(deliverable.map((e) => e.key)).toEqual(['ancient']);
    expect(retired).toEqual([]);
  });

  it('retires an entry whose own timestamp cannot be read', () => {
    const broken = event({ key: 'broken', awardedAt: 'whenever' });
    const { deliverable, retired } = partitionPendingRewardDeliveries([broken], NOW);
    expect(deliverable).toEqual([]);
    expect(retired.map((e) => e.key)).toEqual(['broken']);
  });

  it('prunes stale tickets through syncGame, and persists the pruning', () => {
    onboard();
    const stored = repo.getGameState();
    if (stored === undefined) throw new Error('expected game state');
    repo.saveGameState(
      withPendingRewardDeliveries(stored, [
        agedEvent(LATER, MS_PER_DAY * 30, { key: 'ancient' }),
        agedEvent(LATER, MS_PER_DAY, { key: 'recent' }),
      ]),
    );

    syncGame(repo, { now: LATER, today: DAY_1 });
    expect(pendingOf().map((e) => e.key)).toEqual(['recent']);
  });
});

describe('retirement takes nothing the user earned', () => {
  it('leaves XP, skills, trophies, awardedKeys and recentEvents exactly as they were', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    record(DAY_1, toggleActivityCompletion(repo.getDailyLog(DAY_1), walk.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const earned = repo.getGameState();
    if (earned === undefined) throw new Error('expected game state');
    expect(pendingOf().length).toBeGreaterThan(0);

    // Age every waiting ticket past the horizon, then sync.
    repo.saveGameState(
      withPendingRewardDeliveries(
        earned,
        pendingRewardDeliveriesOf(earned).map((e) =>
          ({ ...e, awardedAt: new Date(Date.parse(LATER) - MS_PER_DAY * 30).toISOString() })),
      ),
    );
    syncGame(repo, { now: LATER, today: DAY_1 });

    const after = repo.getGameState();
    if (after === undefined) throw new Error('expected game state');
    expect(pendingRewardDeliveriesOf(after)).toEqual([]);
    expect(after.xp).toEqual(earned.xp);
    expect(after.skills).toEqual(earned.skills);
    expect(after.trophies).toEqual(earned.trophies);
    expect([...after.awardedKeys].sort()).toEqual([...earned.awardedKeys].sort());
    expect(after.recentEvents).toEqual(earned.recentEvents);
  });

  it('does not re-grant a retired reward on the next sync', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    const xpAfterGrant = repo.getGameState()?.xp.total ?? 0;

    const earned = repo.getGameState();
    if (earned === undefined) throw new Error('expected game state');
    repo.saveGameState(
      withPendingRewardDeliveries(
        earned,
        pendingRewardDeliveriesOf(earned).map((e) =>
          ({ ...e, awardedAt: new Date(Date.parse(LATER) - MS_PER_DAY * 30).toISOString() })),
      ),
    );

    syncGame(repo, { now: LATER, today: DAY_1 });
    syncGame(repo, { now: LATER, today: DAY_1 });

    expect(pendingOf()).toEqual([]);
    expect(repo.getGameState()?.xp.total).toBe(xpAfterGrant);
  });
});

// --- The defensive ceiling --------------------------------------------------

describe('the queue ceiling', () => {
  it('is far above anything the domain can produce', () => {
    expect(MAX_PENDING_REWARD_DELIVERIES).toBe(50);
  });

  it('does not fire for any realistic queue', () => {
    const pending = Array.from({ length: MAX_PENDING_REWARD_DELIVERIES }, (_, index) =>
      agedEvent(NOW, index * 1000, { id: `e-${index}`, key: `k-${index}` }));
    expect(partitionPendingRewardDeliveries(pending, NOW).retired).toEqual([]);
  });

  it('retires oldest first when it does fire, keeping the newest moments', () => {
    const pending = Array.from({ length: 4 }, (_, index) =>
      event({ id: `e-${index}`, key: `k-${index}` }));
    const { deliverable, retired } = partitionPendingRewardDeliveries(
      pending,
      NOW,
      REWARD_DELIVERY_HORIZON_DAYS,
      2,
    );
    expect(retired.map((e) => e.key)).toEqual(['k-0', 'k-1']);
    expect(deliverable.map((e) => e.key)).toEqual(['k-2', 'k-3']);
  });

  it('applies the horizon before the ceiling, so the ceiling only ever sees fresh entries', () => {
    const pending = [
      agedEvent(NOW, MS_PER_DAY * 30, { id: 'stale', key: 'stale' }),
      agedEvent(NOW, 2000, { id: 'a', key: 'a' }),
      agedEvent(NOW, 1000, { id: 'b', key: 'b' }),
    ];
    const { deliverable, retired } = partitionPendingRewardDeliveries(
      pending,
      NOW,
      REWARD_DELIVERY_HORIZON_DAYS,
      1,
    );
    // 'stale' went on the horizon; the ceiling then trimmed the older of the two fresh ones.
    expect(deliverable.map((e) => e.key)).toEqual(['b']);
    expect(retired.map((e) => e.key)).toEqual(['stale', 'a']);
  });
});

// --- Malformed data ---------------------------------------------------------

describe('malformed queue data fails safe', () => {
  it('rejects anything that is not a list of granted rewards', () => {
    expect(isPendingRewardDeliveries([])).toBe(true);
    expect(isPendingRewardDeliveries([event()])).toBe(true);

    expect(isPendingRewardDeliveries(undefined)).toBe(false);
    expect(isPendingRewardDeliveries(null)).toBe(false);
    expect(isPendingRewardDeliveries('nope')).toBe(false);
    expect(isPendingRewardDeliveries({ 0: event() })).toBe(false);
    expect(isPendingRewardDeliveries([null])).toBe(false);
    expect(isPendingRewardDeliveries([{ ...event(), id: '' }])).toBe(false);
    expect(isPendingRewardDeliveries([{ ...event(), key: undefined }])).toBe(false);
    expect(isPendingRewardDeliveries([{ ...event(), label: '' }])).toBe(false);
    expect(isPendingRewardDeliveries([{ ...event(), xp: Number.NaN }])).toBe(false);
    expect(isPendingRewardDeliveries([{ ...event(), xp: '20' }])).toBe(false);
    expect(isPendingRewardDeliveries([{ ...event(), awardedAt: undefined }])).toBe(false);
    // One bad entry condemns the whole field: we cannot tell which survivors to trust.
    expect(isPendingRewardDeliveries([event(), null])).toBe(false);
  });

  it('reads a malformed queue as empty rather than presenting it', () => {
    expect(pendingRewardDeliveriesOf({
      pendingRewardDeliveries: 'broken' as unknown as RewardEvent[],
    })).toEqual([]);
  });

  it('keeps XP, trophies and awardedKeys when the stored queue is unreadable', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const earned = repo.getGameState();
    if (earned === undefined) throw new Error('expected game state');
    adapter.set(
      STORAGE_KEYS.game,
      JSON.stringify({ ...earned, pendingRewardDeliveries: 'not a list' }),
    );

    const reloaded = newRepo(adapter, 'reload');
    const state = reloaded.getGameState();
    if (state === undefined) throw new Error('the whole game state must survive');

    expect(state.xp).toEqual(earned.xp);
    expect(state.trophies).toEqual(earned.trophies);
    expect([...state.awardedKeys].sort()).toEqual([...earned.awardedKeys].sort());
    expect(state.recentEvents).toEqual(earned.recentEvents);
    expect(state.pendingRewardDeliveries).toBeUndefined();
  });

  it('surfaces the condition and keeps a copy rather than destroying anything', () => {
    onboard();
    const earned = repo.getGameState();
    if (earned === undefined) throw new Error('expected game state');
    const raw = JSON.stringify({ ...earned, pendingRewardDeliveries: [{ nope: true }] });
    adapter.set(STORAGE_KEYS.game, raw);

    const reloaded = newRepo(adapter, 'reload');
    reloaded.getGameState();

    const issue = reloaded.getIssues().find((entry) => entry.key === STORAGE_KEYS.game);
    expect(issue?.kind).toBe('invalid_shape');
    expect(issue?.detail).toMatch(/pendingRewardDeliveries/);
    expect(issue?.quarantinedAs).toBeTruthy();
    // Copied, never moved: the original value is still exactly where it was.
    expect(adapter.get(STORAGE_KEYS.game)).toBe(raw);
    expect(adapter.get(issue?.quarantinedAs ?? '')).toBe(raw);
  });

  it('quarantines once per session, however often the state is read', () => {
    onboard();
    const earned = repo.getGameState();
    if (earned === undefined) throw new Error('expected game state');
    adapter.set(STORAGE_KEYS.game, JSON.stringify({ ...earned, pendingRewardDeliveries: 7 }));

    const reloaded = newRepo(adapter, 'reload');
    for (let i = 0; i < 5; i += 1) reloaded.getGameState();

    const quarantined = adapter.keys().filter((key) => key.includes('quarantine'));
    expect(quarantined).toHaveLength(1);
    expect(reloaded.getIssues()).toHaveLength(1);
  });
});

// --- Import and export ------------------------------------------------------

describe('import never restores a delivery queue', () => {
  function backupFrom(build: (store: Repository) => void): string {
    const other = createMemoryStorageAdapter();
    const store = newRepo(other, 'other');
    store.initialise();
    build(store);
    return buildBackup(store, { now: NOW, today: DAY_2 }).contents;
  }

  function prepare(text: string): PreparedImport {
    const result = prepareImport(text);
    if (!result.ok) throw new Error(`expected a valid backup: ${result.errors.join(', ')}`);
    return result.prepared;
  }

  function commit(prepared: PreparedImport): void {
    commitImport(repo, prepared, { now: LATER, backupCurrentData: () => true });
  }

  it('clears a queue carried by a same-version backup', () => {
    const text = backupFrom((store) => {
      finishOnboarding(
        store,
        { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
        NOW,
      );
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });

    // The file really does carry one, so the clearing below is meaningful.
    const source = JSON.parse(text) as { game?: { state: GameState } };
    expect(source.game?.state.pendingRewardDeliveries?.length).toBeGreaterThan(0);

    commit(prepare(text));

    expect(repo.getGameState()?.pendingRewardDeliveries).toBeUndefined();
    expect(pendingOf()).toEqual([]);
  });

  it('restores everything the user earned while clearing only the queue', () => {
    const text = backupFrom((store) => {
      finishOnboarding(
        store,
        { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
        NOW,
      );
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });
    const source = (JSON.parse(text) as { game: { state: GameState } }).game.state;

    commit(prepare(text));
    const state = repo.getGameState();

    expect(state?.xp).toEqual(source.xp);
    expect(state?.trophies).toEqual(source.trophies);
    expect([...(state?.awardedKeys ?? [])].sort()).toEqual([...source.awardedKeys].sort());
    expect(state?.recentEvents).toEqual(source.recentEvents);
    expect(state?.pendingRewardDeliveries).toBeUndefined();
  });

  it('leaves imported history as history: recentEvents is never queued', () => {
    const text = backupFrom((store) => {
      finishOnboarding(
        store,
        { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
        NOW,
      );
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });

    commit(prepare(text));
    const state = repo.getGameState();

    expect(state?.recentEvents.length).toBeGreaterThan(0);
    expect(pendingOf()).toEqual([]);
  });

  it('imports a pre-game-layer backup with no queue and grants nothing to present', () => {
    const text = backupFrom((store) => {
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
    });
    const envelope = JSON.parse(text) as Record<string, unknown>;
    delete envelope['game'];

    commit(prepare(JSON.stringify(envelope)));
    syncGame(repo, { now: LATER, today: DAY_1 });

    // Keys were sealed, so nothing is granted and nothing is waiting to be said.
    expect(pendingOf()).toEqual([]);
  });

  it('does not present anything after a restore, even once the app syncs', () => {
    const text = backupFrom((store) => {
      finishOnboarding(
        store,
        { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
        NOW,
      );
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });

    commit(prepare(text));
    syncGame(repo, { now: LATER, today: DAY_1 });
    syncGame(repo, { now: LATER, today: DAY_1 });

    expect(pendingOf()).toEqual([]);
  });
});

describe('export carries the queue without special handling', () => {
  it('includes a pending queue in the backup it writes', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const envelope = buildBackup(repo, { now: NOW, today: DAY_2 }).envelope;
    expect(envelope.game?.state.pendingRewardDeliveries?.length).toBe(pendingOf().length);
  });
});

// --- Boundaries -------------------------------------------------------------

describe('slice boundaries', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));

  /** Every presentation source, read through Vite rather than the filesystem. */
  const uiSources = import.meta.glob('../ui/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  /*
   * Slice 1 asserted that NOTHING in the UI knew the queue existed. Slice 2 is the
   * slice that changes that, so the guard is inverted rather than deleted: exactly two
   * presentation modules may reach the queue, and both must actually do so - otherwise
   * this passes vacuously the day someone renames one of them.
   */
  const DELIVERY_CONSUMERS = ['hooks/useRewardDelivery.ts', 'screens/TodayScreen.tsx'];

  it('lets only the sanctioned presentation modules reach the queue', () => {
    expect(Object.keys(uiSources).length).toBeGreaterThan(20);

    // Comments stripped: `useGame` documents at length what it moved away from, and a
    // sentence about the queue is not a dependency on it.
    const executable = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    const consumers: string[] = [];
    for (const [path, source] of Object.entries(uiSources)) {
      const sanctioned = DELIVERY_CONSUMERS.some((name) => path.endsWith(name));
      const reaches = /pendingRewardDeliveries|rewardDelivery|useRewardDelivery/
        .test(executable(source));
      if (reaches) consumers.push(path);
      if (!sanctioned) {
        expect(reaches, `${path} reaches the delivery queue`).toBe(false);
      }
    }

    expect(consumers).toHaveLength(DELIVERY_CONSUMERS.length);
  });

  it('keeps the acknowledgement component itself unaware of the queue', () => {
    const component = Object.entries(uiSources).find(([path]) =>
      path.endsWith('components/RewardAcknowledgement.tsx'));
    if (component === undefined) throw new Error('expected RewardAcknowledgement');
    // It renders what it is handed and reports what it showed. It never asks.
    expect(component[1]).not.toMatch(
      /pendingRewardDeliveries|rewardDelivery|getAppContext|repository/,
    );
  });

  it('the delivery module creates no reward and reads no fitness truth', () => {
    const source = readFileSync(join(SRC, 'domain', 'game', 'rewardDelivery.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    expect(source).not.toMatch(/deriveRewards|grantRewards|XP_REWARDS|earnedTrophies/);
    expect(source).not.toMatch(/DailyLog|WeeklyPlan|Measurement|repository|localStorage/);
    // It may name RewardEvent and GameState as types, and nothing else from storage.
    expect(source).not.toMatch(/StorageAdapter|Repository/);
  });

  it('bumps no schema version', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(GAME_SCHEMA_VERSION).toBe(1);
  });

  it('leaves recentEvents as history, with no delivery state attached', () => {
    onboard();
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const state = repo.getGameState();
    if (state === undefined) throw new Error('expected game state');
    for (const entry of state.recentEvents) {
      expect('seen' in entry).toBe(false);
      expect('acknowledged' in entry).toBe(false);
      expect('delivered' in entry).toBe(false);
    }
    // Opposite orderings, still.
    expect(state.recentEvents.map((e) => e.key)).toEqual(
      pendingRewardDeliveriesOf(state).map((e) => e.key).reverse(),
    );
  });
});

// --- A measurement earned away from Today ----------------------------------

describe('a reward earned where nothing can present it', () => {
  it('is waiting in the queue afterwards instead of being lost', () => {
    onboard();
    repo.saveMeasurements([createMeasurement({ recordedOn: DAY_1, weightKg: 80 })]);

    // Whoever syncs first grants it - and now the delta survives that.
    const first = syncGame(repo, { now: NOW, today: DAY_1 });
    const second = syncGame(repo, { now: NOW, today: DAY_1 });

    expect(first.granted.map((e) => e.kind)).toContain('first_measurement');
    expect(second.granted).toEqual([]);
    expect(pendingOf().map((e) => e.kind)).toContain('first_measurement');
  });
});
