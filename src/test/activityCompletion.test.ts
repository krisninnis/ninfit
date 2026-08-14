import { beforeEach, describe, expect, it } from 'vitest';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import {
  applyDailyLogUpdate,
  completedActivityIds,
  createEmptyDailyLog,
  isActivityCompleted,
  isDayMarkedComplete,
  symptomFlags,
  toggleActivityCompletion,
  usesLegacyCompletion,
} from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { resolveToday, todaySessionCompletion } from '../domain/today';
import type { DailyLog, PlannedActivity, WeeklyPlan } from '../domain/types';
import { weekCompletion } from '../domain/weeklyPlan';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const DAY_1 = '2026-08-13'; // yoga + walk
const DAY_2 = '2026-08-14'; // one walk
const DAY_7 = '2026-08-19'; // rest

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];
let yoga: PlannedActivity;
let walk: PlannedActivity;

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

function session(date: string): TodaySession {
  const view = resolveToday(plans, PROGRAMME_START_DATE, date);
  return createTodaySession(newRepo(adapter, 'live'), date, {
    now: NOW,
    makeId: sequentialIdFactory(`s-${date}`),
    ...(view.planId !== undefined ? { weeklyPlanId: view.planId } : {}),
    ...(view.sessionId !== undefined ? { plannedSessionId: view.sessionId } : {}),
  });
}

/**
 * Completion as the screen derives it. Routed through the same helper the UI uses, so
 * a rest day (an empty session that exists) is never confused with an unplanned day
 * (no session at all).
 */
function statusVia(date: string, log: DailyLog | undefined) {
  return todaySessionCompletion(resolveToday(plans, PROGRAMME_START_DATE, date), log);
}

function tick(today: TodaySession, activity: PlannedActivity, completed = true): void {
  today.apply(toggleActivityCompletion(today.getLog(), activity.id, completed));
}

const statusFor = statusVia;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const activities = resolveToday(plans, PROGRAMME_START_DATE, DAY_1).activities;
  const foundYoga = activities.find((activity) => activity.type === 'yoga');
  const foundWalk = activities.find((activity) => activity.type === 'walk');
  if (!foundYoga || !foundWalk) throw new Error('expected day 1 to plan yoga and a walk');
  yoga = foundYoga;
  walk = foundWalk;
});

// ---------------------------------------------------------------------------

describe('activities complete independently', () => {
  it('completes the yoga without touching the walk', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    today.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(isActivityCompleted(stored, yoga.id)).toBe(true);
    expect(isActivityCompleted(stored, walk.id)).toBe(false);
    expect(completedActivityIds(stored)).toEqual([yoga.id]);
  });

  it('completes the walk without touching the yoga', () => {
    const today = session(DAY_1);
    tick(today, walk);
    today.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(isActivityCompleted(stored, walk.id)).toBe(true);
    expect(isActivityCompleted(stored, yoga.id)).toBe(false);
  });

  it('unticking one leaves the other completed', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, walk);
    tick(today, yoga, false);
    today.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(isActivityCompleted(stored, yoga.id)).toBe(false);
    expect(isActivityCompleted(stored, walk.id)).toBe(true);
    expect(completedActivityIds(stored)).toEqual([walk.id]);
  });

  it('does not mutate the log it was given when building the patch', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    const afterFirst = today.getLog();
    const snapshot = structuredClone(afterFirst);

    toggleActivityCompletion(afterFirst, walk.id, true);
    expect(afterFirst).toEqual(snapshot);
  });

  it('ticking the same activity twice does not duplicate the id', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, yoga);
    expect(completedActivityIds(today.getLog())).toEqual([yoga.id]);
  });

  it('records ids exactly as the plan defines them', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, walk);
    today.save();

    expect(completedActivityIds(repo.getDailyLog(DAY_1))).toEqual([yoga.id, walk.id]);
    expect(repo.getWeeklyPlans()[0]?.sessions[0]?.activities.map((a) => a.id)).toEqual([
      yoga.id,
      walk.id,
    ]);
  });
});

describe('derived session completion', () => {
  it('is complete when every activity is ticked', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, walk);
    today.save();

    expect(statusFor(DAY_1, repo.getDailyLog(DAY_1))).toEqual({
      status: 'complete',
      completedCount: 2,
      plannedCount: 2,
    });
  });

  it('is partial when only one is ticked', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    today.save();

    expect(statusFor(DAY_1, repo.getDailyLog(DAY_1))).toEqual({
      status: 'partial',
      completedCount: 1,
      plannedCount: 2,
    });
  });

  it('is not-yet when none is ticked', () => {
    expect(statusFor(DAY_1, undefined)).toEqual({
      status: 'not_yet',
      completedCount: 0,
      plannedCount: 2,
    });

    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, yoga, false);
    today.save();
    expect(statusFor(DAY_1, repo.getDailyLog(DAY_1)).status).toBe('not_yet');
  });

  it('treats a single-activity day as complete on one tick', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_2);
    const only = view.activities[0];
    if (!only) throw new Error('expected one planned activity');

    const today = session(DAY_2);
    tick(today, only);
    today.save();

    expect(statusFor(DAY_2, repo.getDailyLog(DAY_2))).toEqual({
      status: 'complete',
      completedCount: 1,
      plannedCount: 1,
    });
  });

  it('ignores ids that are not part of today, rather than miscounting', () => {
    const today = session(DAY_1);
    today.apply({ exercise: { completedActivityIds: [yoga.id, 'some-other-day-activity'] } });
    today.save();

    expect(statusFor(DAY_1, repo.getDailyLog(DAY_1))).toEqual({
      status: 'partial',
      completedCount: 1,
      plannedCount: 2,
    });
  });
});

describe('rest days', () => {
  it('stay rest, never incomplete, and offer no activity to tick', () => {
    expect(statusFor(DAY_7, undefined)).toEqual({
      status: 'rest',
      completedCount: 0,
      plannedCount: 0,
    });
    expect(resolveToday(plans, PROGRAMME_START_DATE, DAY_7).activities).toEqual([]);
  });

  it('stay rest even when the optional day-level flag is set', () => {
    const today = session(DAY_7);
    today.apply({ exercise: { completed: true } });
    today.save();

    expect(statusFor(DAY_7, repo.getDailyLog(DAY_7)).status).toBe('rest');
    expect(isDayMarkedComplete(repo.getDailyLog(DAY_7))).toBe(true);
  });

  it('never gain fabricated activity completion', () => {
    const today = session(DAY_7);
    today.apply({ exercise: { completed: true } });
    today.save();

    expect(completedActivityIds(repo.getDailyLog(DAY_7))).toEqual([]);
  });
});

describe('days with no plan', () => {
  it('use the day-level flag as the only answer', () => {
    const noPlanDate = '2026-08-20'; // week 2, unplanned
    const empty = createEmptyDailyLog(
      { date: noPlanDate },
      { now: NOW, makeId: sequentialIdFactory('n') },
    );

    expect(statusFor(noPlanDate, empty).status).toBe('unplanned');

    const marked = applyDailyLogUpdate(
      empty,
      { exercise: { completed: true } },
      { now: NOW, makeId: sequentialIdFactory('m') },
    );
    expect(statusFor(noPlanDate, marked).status).toBe('complete');
  });
});

describe('symptoms never affect completion', () => {
  it('leaves both ticks in place when everything is recorded as worse', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, walk);
    today.apply({
      symptoms: { backPainBefore: 3, backPainAfter: 8, legPain: true, toeSensation: 'worse' },
    });
    today.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(statusFor(DAY_1, stored).status).toBe('complete');
    expect(completedActivityIds(stored)).toEqual([yoga.id, walk.id]);
    expect(symptomFlags(stored)).toEqual(['leg_pain', 'toe_sensation_worse']);
  });

  it('gives the same completion with and without symptoms recorded', () => {
    const withSymptoms = session(DAY_1);
    tick(withSymptoms, yoga);
    withSymptoms.apply({ symptoms: { toeSensation: 'worse', legPain: true } });
    withSymptoms.save();
    const a = statusFor(DAY_1, repo.getDailyLog(DAY_1));

    const clean = createMemoryStorageAdapter();
    const cleanRepo = newRepo(clean, 'clean');
    cleanRepo.initialise();
    const plain = createTodaySession(cleanRepo, DAY_1, {
      now: NOW,
      makeId: sequentialIdFactory('p'),
    });
    plain.apply(toggleActivityCompletion(plain.getLog(), yoga.id, true));
    plain.save();
    const b = statusFor(DAY_1, cleanRepo.getDailyLog(DAY_1));

    expect(a).toEqual(b);
  });
});

describe('persistence', () => {
  it('restores the completed ids after a reload', () => {
    const first = session(DAY_1);
    tick(first, yoga);
    first.save();

    const reopened = session(DAY_1);
    expect(reopened.isPersisted()).toBe(true);
    expect(isActivityCompleted(reopened.getLog(), yoga.id)).toBe(true);
    expect(isActivityCompleted(reopened.getLog(), walk.id)).toBe(false);
  });

  it('keeps the id strings byte-for-byte through storage', () => {
    const first = session(DAY_1);
    tick(first, yoga);
    tick(first, walk);
    first.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(stored?.exercise?.completedActivityIds).toEqual([yoga.id, walk.id]);
    for (const id of completedActivityIds(stored)) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('writes only today when an activity is ticked', () => {
    const first = session(DAY_1);
    tick(first, yoga);
    first.save();

    const second = session(DAY_2);
    const walkTwo = resolveToday(plans, PROGRAMME_START_DATE, DAY_2).activities[0];
    if (!walkTwo) throw new Error('expected a planned walk');
    tick(second, walkTwo);
    second.save();

    expect(completedActivityIds(repo.getDailyLog(DAY_1))).toEqual([yoga.id]);
    expect(completedActivityIds(repo.getDailyLog(DAY_2))).toEqual([walkTwo.id]);
  });

  it('leaves other exercise fields alone when ticking', () => {
    const first = session(DAY_1);
    first.apply({ exercise: { durationMinutes: 15, effort: 3, steps: 3214 } });
    tick(first, yoga);
    first.save();

    expect(repo.getDailyLog(DAY_1)?.exercise).toMatchObject({
      durationMinutes: 15,
      effort: 3,
      steps: 3214,
      completedActivityIds: [yoga.id],
    });
  });
});

describe('legacy records without completedActivityIds', () => {
  /** A day written before per-activity completion existed. */
  function legacyLog(completed: boolean): DailyLog {
    return applyDailyLogUpdate(
      createEmptyDailyLog({ date: DAY_1 }, { now: NOW, makeId: sequentialIdFactory('legacy') }),
      { exercise: { completed, durationMinutes: 15 } },
      { now: NOW, makeId: sequentialIdFactory('legacy-x') },
    );
  }

  it('load without error and are recognised as legacy', () => {
    const log = legacyLog(true);
    repo.saveDailyLog(log);

    const stored = repo.getDailyLog(DAY_1);
    expect(stored).toEqual(log);
    expect(usesLegacyCompletion(stored)).toBe(true);
    expect(completedActivityIds(stored)).toEqual([]);
  });

  it('keep their meaning: a completed legacy day still reads as complete', () => {
    repo.saveDailyLog(legacyLog(true));
    expect(statusFor(DAY_1, repo.getDailyLog(DAY_1))).toEqual({
      status: 'complete',
      completedCount: 2,
      plannedCount: 2,
    });
  });

  it('an uncompleted legacy day reads as not-yet', () => {
    repo.saveDailyLog(legacyLog(false));
    expect(statusFor(DAY_1, repo.getDailyLog(DAY_1)).status).toBe('not_yet');
  });

  it('are neither migrated nor rewritten on read', () => {
    const log = legacyLog(true);
    repo.saveDailyLog(log);
    const rawBefore = JSON.stringify(repo.getDailyLog(DAY_1));

    statusFor(DAY_1, repo.getDailyLog(DAY_1));
    repo.getDailyLog(DAY_1);

    expect(JSON.stringify(repo.getDailyLog(DAY_1))).toBe(rawBefore);
    expect(repo.getDailyLog(DAY_1)?.exercise?.completedActivityIds).toBeUndefined();
  });

  it('hand over to per-activity completion as soon as the user ticks something', () => {
    repo.saveDailyLog(legacyLog(true));

    const today = session(DAY_1);
    expect(usesLegacyCompletion(today.getLog())).toBe(true);

    tick(today, yoga);
    today.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(usesLegacyCompletion(stored)).toBe(false);
    // The new field is authoritative from here on, so the day is now partial.
    expect(statusFor(DAY_1, stored).status).toBe('partial');
    // The old flag is left where it was rather than being scrubbed.
    expect(stored?.exercise?.completed).toBe(true);
  });
});

describe('weekly counts understand partial days', () => {
  it('counts complete, partial and rest separately', () => {
    const plan = plans[0];
    if (!plan) throw new Error('expected a seeded plan');

    const dayOne = session(DAY_1);
    tick(dayOne, yoga);
    tick(dayOne, walk);
    dayOne.save();

    const dayThree = session('2026-08-15');
    const third = resolveToday(plans, PROGRAMME_START_DATE, '2026-08-15').activities[0];
    if (!third) throw new Error('expected an activity on day 3');
    tick(dayThree, third);
    dayThree.save();

    const rest = session(DAY_7);
    rest.apply({ exercise: { completed: true } });
    rest.save();

    const counts = weekCompletion(plan, repo.listDailyLogs(), PROGRAMME_START_DATE);

    expect(counts.plannedSessions).toBe(6);
    expect(counts.restDays).toBe(1);
    expect(counts.completedPlannedSessions).toBe(1);
    expect(counts.partiallyCompletedSessions).toBe(1);
    expect(counts.completedRestDays).toBe(1);
  });

  it('still honours legacy whole-session completion in the weekly counts', () => {
    const plan = plans[0];
    if (!plan) throw new Error('expected a seeded plan');

    repo.saveDailyLog(
      applyDailyLogUpdate(
        createEmptyDailyLog({ date: DAY_1 }, { now: NOW, makeId: sequentialIdFactory('l') }),
        { exercise: { completed: true } },
        { now: NOW, makeId: sequentialIdFactory('l2') },
      ),
    );

    const counts = weekCompletion(plan, repo.listDailyLogs(), PROGRAMME_START_DATE);
    expect(counts.completedPlannedSessions).toBe(1);
    expect(counts.partiallyCompletedSessions).toBe(0);
  });
});
