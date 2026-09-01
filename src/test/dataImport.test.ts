import { beforeEach, describe, expect, it } from 'vitest';
import { finishOnboarding, syncGame } from '../app/game';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { createMeasurement } from '../domain/measurement';
import { resolveToday } from '../domain/today';
import type { OnboardingAnswers } from '../domain/game/types';
import type { PlannedActivity, WeeklyPlan } from '../domain/types';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport, type PreparedImport } from '../io/importJson';
import { STORAGE_KEYS, createRepository, type Repository } from '../storage/repository';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';

const NOW = '2026-08-14T12:42:00.000+01:00';
const LATER = '2026-09-01T09:00:00.000+01:00';
const DAY_1 = '2026-08-13';
const DAY_2 = '2026-08-14';
const DAY_3 = '2026-08-15';

const ANSWERS: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'not_yet',
  mainGoal: 'start_moving',
};

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];
let yoga: PlannedActivity;
let walk: PlannedActivity;
let backupsTaken: number;

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

function record(date: string, update: Parameters<TodaySession['apply']>[0], store: Repository = repo): void {
  const entry = session(date, store);
  entry.apply(update);
  entry.save();
}

/** A backup taken from a second, independent store. */
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

function commit(prepared: PreparedImport, store: Repository = repo) {
  return commitImport(store, prepared, {
    now: LATER,
    backupCurrentData: () => {
      backupsTaken += 1;
      return true;
    },
  });
}

beforeEach(() => {
  backupsTaken = 0;
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const [first, second] = resolveToday(plans, PROGRAMME_START_DATE, DAY_1).activities;
  if (!first || !second) throw new Error('expected yoga and a walk');
  yoga = first;
  walk = second;
});

// ---------------------------------------------------------------------------

describe('preparing an import touches nothing', () => {
  it('accepts a current backup', () => {
    const text = backupFrom((store) => record(DAY_1, { exercise: { steps: 4000 } }, store));
    const result = prepareImport(text);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prepared.summary.dailyLogs).toBe(1);
  });

  it('rejects malformed JSON', () => {
    const result = prepareImport('{ not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it('rejects a structurally invalid document', () => {
    const result = prepareImport(JSON.stringify({ app: 'something-else', schemaVersion: 1 }));
    expect(result.ok).toBe(false);
  });

  it('rejects a newer schema rather than guessing', () => {
    const envelope = JSON.parse(backupFrom(() => undefined));
    envelope.schemaVersion = 99;

    const result = prepareImport(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/newer version/i);
  });

  it('rejects duplicate daily-log dates', () => {
    const envelope = JSON.parse(backupFrom((store) => record(DAY_1, { exercise: { steps: 1 } }, store)));
    envelope.data.dailyLogs.push({ ...envelope.data.dailyLogs[0] });

    const result = prepareImport(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/more than one/i);
  });

  it('rejects an invalid daily-log date', () => {
    const envelope = JSON.parse(backupFrom((store) => record(DAY_1, { exercise: { steps: 1 } }, store)));
    envelope.data.dailyLogs[0].date = '2026-02-30';

    expect(prepareImport(JSON.stringify(envelope)).ok).toBe(false);
  });

  it('leaves current data alone when validation fails', () => {
    record(DAY_1, { exercise: { steps: 7777 } });
    const before = JSON.stringify(repo.getDailyLog(DAY_1));

    prepareImport('{ broken');
    prepareImport(JSON.stringify({ app: 'nope' }));

    expect(JSON.stringify(repo.getDailyLog(DAY_1))).toBe(before);
    expect(backupsTaken).toBe(0);
  });
});

describe('committing an import', () => {
  it('takes the pre-import backup before writing anything', () => {
    record(DAY_1, { exercise: { steps: 1111 } });
    const text = backupFrom((store) => record(DAY_2, { exercise: { steps: 2222 } }, store));

    let stepsWhenBackupRan: number | undefined;
    const result = commitImport(repo, prepare(text), {
      now: LATER,
      backupCurrentData: () => {
        // The original data must still be intact at this moment.
        stepsWhenBackupRan = repo.getDailyLog(DAY_1)?.exercise?.steps;
        return true;
      },
    });

    expect(result.ok).toBe(true);
    expect(stepsWhenBackupRan).toBe(1111);
  });

  it('writes nothing if the backup cannot be taken', () => {
    record(DAY_1, { exercise: { steps: 1111 } });
    const text = backupFrom((store) => record(DAY_2, { exercise: { steps: 2222 } }, store));

    const result = commitImport(repo, prepare(text), {
      now: LATER,
      backupCurrentData: () => false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.phase).toBe('backup');
    expect(repo.getDailyLog(DAY_1)?.exercise?.steps).toBe(1111);
    expect(repo.getDailyLog(DAY_2)).toBeUndefined();
  });

  it('writes nothing if the backup throws', () => {
    record(DAY_1, { exercise: { steps: 1111 } });
    const text = backupFrom((store) => record(DAY_2, { exercise: { steps: 2222 } }, store));

    const result = commitImport(repo, prepare(text), {
      now: LATER,
      backupCurrentData: () => {
        throw new Error('no downloads here');
      },
    });

    expect(result.ok).toBe(false);
    expect(repo.getDailyLog(DAY_1)?.exercise?.steps).toBe(1111);
  });

  it('replaces rather than merging', () => {
    record(DAY_1, { exercise: { steps: 1111 } });
    record(DAY_3, { exercise: { steps: 3333 } });

    const text = backupFrom((store) => record(DAY_2, { exercise: { steps: 2222 } }, store));
    const result = commit(prepare(text));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dailyLogsWritten).toBe(1);
      expect(result.dailyLogsRemoved).toBe(2);
    }

    expect(repo.getDailyLog(DAY_2)?.exercise?.steps).toBe(2222);
    // Days absent from the backup are gone, not blended in.
    expect(repo.getDailyLog(DAY_1)).toBeUndefined();
    expect(repo.getDailyLog(DAY_3)).toBeUndefined();
    expect(repo.listDailyLogDates()).toEqual([DAY_2]);
  });

  it('restores every collection', () => {
    const text = backupFrom((store) => {
      record(DAY_1, { exercise: { steps: 4000, completed: false }, hydration: { glasses: 0 } }, store);
      store.saveMeasurements([
        createMeasurement({ recordedOn: DAY_2, weightKg: 68.1 }, { makeId: sequentialIdFactory('m') }),
      ]);
      store.saveMetricSamples([
        {
          id: 'sample-1',
          kind: 'steps',
          value: 4231,
          unit: 'count',
          date: DAY_2,
          source: { sourceType: 'health_connect', sourceApp: 'com.example.opaque' },
        },
      ]);
    });

    commit(prepare(text));

    expect(repo.getMeasurements()[0]?.weightKg).toBe(68.1);
    expect(repo.getMetricSamples()[0]?.source.sourceApp).toBe('com.example.opaque');
    expect(repo.getDailyLog(DAY_1)?.exercise?.steps).toBe(4000);
    // Explicit zero and false survive the round trip.
    expect(repo.getDailyLog(DAY_1)?.exercise?.completed).toBe(false);
    expect(repo.getDailyLog(DAY_1)?.hydration?.glasses).toBe(0);
  });

  it('survives a full export, import, export cycle unchanged', () => {
    finishOnboarding(repo, { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' }, NOW);
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const first = buildBackup(repo, { now: NOW, today: DAY_2 }).envelope;
    commit(prepare(JSON.stringify(first)));
    const second = buildBackup(repo, { now: NOW, today: DAY_2 }).envelope;

    // exportedAt is expected to be the same here because both use a fixed clock;
    // everything else must be identical too.
    expect(second.data).toEqual(first.data);
    expect(second.game?.state.xp).toEqual(first.game?.state.xp);
    expect(second.game?.state.awardedKeys.sort()).toEqual(first.game?.state.awardedKeys.sort());
    expect(second.game?.settings).toEqual(first.game?.settings);
  });
});

describe('game state on import', () => {
  it('restores XP, trophies and mascot state verbatim', () => {
    const text = backupFrom((store) => {
      finishOnboarding(store, { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'build_strength' }, NOW);
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      record(DAY_1, toggleActivityCompletion(store.getDailyLog(DAY_1), walk.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });

    const source = JSON.parse(text);
    commit(prepare(text));

    const state = repo.getGameState();
    expect(state?.xp).toEqual(source.game.state.xp);
    expect(state?.trophies).toEqual(source.game.state.trophies);
    expect(state?.mascot).toEqual(source.game.state.mascot);
    expect(state?.pathId).toBe('build_strength');
    expect(state?.skills).toEqual(source.game.state.skills);
  });

  it('does not duplicate XP when the game syncs afterwards', () => {
    const text = backupFrom((store) => {
      finishOnboarding(store, { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' }, NOW);
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });

    commit(prepare(text));
    const afterImport = repo.getGameState()?.xp.total ?? 0;

    const first = syncGame(repo, { now: LATER, today: DAY_1 });
    const second = syncGame(repo, { now: LATER, today: DAY_1 });

    expect(first.granted).toEqual([]);
    expect(second.granted).toEqual([]);
    expect(repo.getGameState()?.xp.total).toBe(afterImport);
  });

  it('does not duplicate trophies after import', () => {
    const text = backupFrom((store) => {
      finishOnboarding(store, { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' }, NOW);
      record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
      syncGame(store, { now: NOW, today: DAY_1 });
    });

    commit(prepare(text));
    syncGame(repo, { now: LATER, today: DAY_1 });

    const ids = repo.getGameState()?.trophies.map((entry) => entry.trophyId) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('legacy backups', () => {
  /** An export written before metricSamples existed. */
  function withoutMetricSamples(): string {
    const envelope = JSON.parse(backupFrom((store) => record(DAY_1, { exercise: { steps: 3000 } }, store)));
    delete envelope.data.metricSamples;
    return JSON.stringify(envelope);
  }

  /** An export written before the game layer existed. */
  function withoutGame(): string {
    const envelope = JSON.parse(
      backupFrom((store) => {
        record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true), store);
        record(DAY_2, { exercise: { completedActivityIds: [] } }, store);
        record(DAY_3, toggleActivityCompletion(undefined, yoga.id, true), store);
      }),
    );
    delete envelope.game;
    return JSON.stringify(envelope);
  }

  it('normalises a missing metricSamples array to empty', () => {
    const prepared = prepare(withoutMetricSamples());
    expect(prepared.data.metricSamples).toEqual([]);

    commit(prepared);
    expect(repo.getMetricSamples()).toEqual([]);
    expect(repo.getDailyLog(DAY_1)?.exercise?.steps).toBe(3000);
  });

  it('gives a game-less backup fresh default state and settings', () => {
    const prepared = prepare(withoutGame());
    expect(prepared.summary.hasGameData).toBe(false);

    commit(prepared);

    const state = repo.getGameState();
    expect(state?.xp).toEqual({ total: 0, level: 1 });
    expect(state?.trophies).toEqual([]);
    expect(state?.onboarding.completed).toBe(false);
    expect(repo.getGameSettings()?.socialMode).toBe('private');
  });

  it('does not hand out a retroactive XP burst for imported history', () => {
    commit(prepare(withoutGame()));

    // The history is all there.
    expect(repo.listDailyLogDates().length).toBeGreaterThan(1);

    // The game did not reward any of it, then or on any later sync.
    const first = syncGame(repo, { now: LATER, today: DAY_3 });
    expect(first.granted).toEqual([]);
    expect(first.state.xp.total).toBe(0);
    expect(first.state.trophies).toEqual([]);

    const second = syncGame(repo, { now: LATER, today: DAY_3 });
    expect(second.granted).toEqual([]);
    expect(second.state.xp.total).toBe(0);
  });

  it('still rewards new activity recorded after such an import', () => {
    commit(prepare(withoutGame()));
    syncGame(repo, { now: LATER, today: DAY_3 });

    // The imported backup brought its own plan, so the activity ids are the
    // restored ones rather than the ids captured before the import.
    const [walkTwo] = resolveToday(
      repo.getWeeklyPlans(),
      PROGRAMME_START_DATE,
      DAY_2,
    ).activities;
    if (!walkTwo) throw new Error('expected a walk on day 2');
    record(DAY_2, toggleActivityCompletion(repo.getDailyLog(DAY_2), walkTwo.id, true));

    const after = syncGame(repo, { now: LATER, today: DAY_3 });
    expect(after.granted.some((event) => event.kind === 'activity_completed')).toBe(true);
    expect(after.state.xp.total).toBeGreaterThan(0);
  });
});

describe('storage issues and import', () => {
  it('fails a full backup rather than turning corrupt stored data into an empty collection', () => {
    record(DAY_1, { exercise: { steps: 1000 } });
    adapter.set(STORAGE_KEYS.measurements, 'not json');

    // Runtime reads still degrade safely and report the problem.
    expect(repo.getMeasurements()).toEqual([]);
    expect(repo.getIssues().length).toBeGreaterThan(0);

    // A full backup asks the stricter question: was all authoritative data readable?
    // It must fail visibly rather than produce a plausible file with measurements omitted.
    expect(() => buildBackup(repo, { now: NOW, today: DAY_2 }))
      .toThrow(/could not be read safely for backup/i);
    expect(adapter.get(STORAGE_KEYS.measurements)).toBe('not json');
  });

  it('never repairs or deletes a quarantined value during import', () => {
    adapter.set(STORAGE_KEYS.measurements, 'not json');
    repo.getMeasurements();

    commit(prepare(backupFrom((store) => record(DAY_2, { exercise: { steps: 1 } }, store))));

    // The import replaced the key with valid data, and the quarantine copy survives.
    const quarantined = adapter.keys().filter((key) => key.startsWith('ft:v1:quarantine:'));
    expect(quarantined.length).toBeGreaterThan(0);
    expect(adapter.get(quarantined[0] as string)).toBe('not json');
  });
});

describe('write failures are reported, not hidden', () => {
  it('reports a failure phase rather than claiming success', () => {
    const text = backupFrom((store) => record(DAY_1, { exercise: { steps: 1 } }, store));
    const prepared = prepare(text);

    const failing = createRepository(
      {
        get: () => null,
        set: () => {
          throw new Error('QuotaExceededError');
        },
        remove: () => undefined,
        keys: () => [],
      },
      { now: () => NOW, makeId: sequentialIdFactory('f') },
    );

    const result = commitImport(failing, prepared, { now: LATER, backupCurrentData: () => true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.phase).toBe('write');
      expect(result.errors[0]).toMatch(/pre-import backup was saved first/);
    }
  });

  it('catches a write that silently did not land', () => {
    const text = backupFrom((store) => record(DAY_1, { exercise: { steps: 1 } }, store));
    const prepared = prepare(text);

    // A store that accepts writes and forgets them.
    const forgetful = createRepository(
      {
        get: () => null,
        set: () => undefined,
        remove: () => undefined,
        keys: () => [],
      },
      { now: () => NOW, makeId: sequentialIdFactory('v') },
    );

    const result = commitImport(forgetful, prepared, { now: LATER, backupCurrentData: () => true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.phase).toBe('verify');
  });
});
