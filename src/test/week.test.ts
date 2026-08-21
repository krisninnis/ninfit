import { beforeEach, describe, expect, it } from 'vitest';
import weekScreenSource from '../ui/screens/WeekScreen.tsx?raw';
import useWeekSource from '../ui/hooks/useWeek.ts?raw';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { applyDailyLogUpdate, createEmptyDailyLog, toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { resolveToday, todaySessionCompletion } from '../domain/today';
import type { PlannedActivity, WeeklyPlan } from '../domain/types';
import {
  buildWeekView,
  trailNodeState,
  type DayState,
  type TrailNodeState,
  type WeekDay,
  type WeekView,
} from '../domain/week';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const DAY_1 = '2026-08-13'; // Thursday
const DAY_2 = '2026-08-14';
const DAY_3 = '2026-08-15';
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

function tick(today: TodaySession, activity: PlannedActivity, completed = true): void {
  today.apply(toggleActivityCompletion(today.getLog(), activity.id, completed));
}

/** The week as the screen would see it, with "today" injectable. */
function week(today: string = DAY_1): WeekView {
  return buildWeekView(plans, PROGRAMME_START_DATE, 1, repo.listDailyLogs(), today);
}

function day(view: WeekView, dayIndex: number): WeekDay {
  const found = view.days.find((entry) => entry.dayIndex === dayIndex);
  if (!found) throw new Error(`no day ${dayIndex}`);
  return found;
}

function activitiesOn(date: string): PlannedActivity[] {
  return resolveToday(plans, PROGRAMME_START_DATE, date).activities;
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const [first, second] = activitiesOn(DAY_1);
  if (!first || !second) throw new Error('expected two activities on day 1');
  yoga = first;
  walk = second;
});

// ---------------------------------------------------------------------------

describe('rolling week resolution', () => {
  it('runs Thursday 13 August to Wednesday 19 August', () => {
    const view = week();
    expect(view.days.map((entry) => entry.date)).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
    ]);
    expect(view.startDate).toBe('2026-08-13');
    expect(view.endDate).toBe('2026-08-19');
  });

  it('is not a Monday-to-Sunday calendar week', () => {
    // If this were a calendar week it would start on a Monday (getDay() === 1).
    const start = new Date(2026, 7, 13);
    expect(start.getDay()).toBe(4);
    expect(week().days[0]?.date).toBe(PROGRAMME_START_DATE);
  });

  it('numbers the days 1 to 7', () => {
    expect(week().days.map((entry) => entry.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('carries the plan label and effort band', () => {
    const view = week();
    expect(view.hasPlan).toBe(true);
    expect(view.programmeVersion).toBe('week-1-v1');
    expect([view.targetEffortMin, view.targetEffortMax]).toEqual([2, 4]);
  });
});

describe('the plan as shown', () => {
  it('day 1 lists yoga and a walk', () => {
    expect(day(week(), 1).activities.map((entry) => entry.activity.label)).toEqual([
      'beginner yoga',
      'easy walk',
    ]);
    expect(day(week(), 1).plannedMinutes).toBe(15);
  });

  it('day 2 lists a single 15-minute walk', () => {
    const entry = day(week(), 2);
    expect(entry.activities).toHaveLength(1);
    expect(entry.activities[0]?.activity.durationMinutes).toBe(15);
  });

  it('day 7 is rest, with nothing to tick', () => {
    const entry = day(week(), 7);
    expect(entry.state).toBe('rest');
    expect(entry.activities).toEqual([]);
    expect(entry.plannedMinutes).toBe(0);
  });
});

describe('today and future days', () => {
  it('marks exactly one day as today', () => {
    const view = week(DAY_3);
    expect(view.days.filter((entry) => entry.isToday).map((entry) => entry.dayIndex)).toEqual([3]);
  });

  it('marks nothing as today when today falls outside the week', () => {
    expect(week('2026-09-01').days.some((entry) => entry.isToday)).toBe(false);
  });

  it('shows later days as still to come, never as missed', () => {
    const view = week(DAY_1);
    expect(day(view, 2).state).toBe('future');
    expect(day(view, 6).state).toBe('future');
    // And the plan is still visible for them.
    expect(day(view, 2).activities).toHaveLength(1);
  });

  it('keeps a future rest day looking like rest, not a pending task', () => {
    expect(day(week(DAY_1), 7).state).toBe('rest');
  });

  it('shows an untouched past day as not-yet rather than failed', () => {
    expect(day(week(DAY_3), 1).state).toBe('not_yet');
  });
});

describe('completion agrees with Today', () => {
  it('yoga alone reads as partial on both screens', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    today.save();

    const entry = day(week(), 1);
    expect(entry.state).toBe('partial');
    expect(entry.completion.completedCount).toBe(1);
    expect(entry.activities.map((a) => a.completed)).toEqual([true, false]);

    const onToday = todaySessionCompletion(
      resolveToday(plans, PROGRAMME_START_DATE, DAY_1),
      repo.getDailyLog(DAY_1),
    );
    expect(onToday).toEqual(entry.completion);
  });

  it('both activities read as complete on both screens', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, walk);
    today.save();

    const entry = day(week(), 1);
    expect(entry.state).toBe('complete');
    expect(entry.activities.every((a) => a.completed)).toBe(true);
    expect(
      todaySessionCompletion(resolveToday(plans, PROGRAMME_START_DATE, DAY_1), repo.getDailyLog(DAY_1)),
    ).toEqual(entry.completion);
  });

  it('worse symptoms leave completion untouched', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    tick(today, walk);
    today.apply({
      symptoms: { backPainBefore: 3, backPainAfter: 8, legPain: true, toeSensation: 'worse' },
    });
    today.save();

    const entry = day(week(), 1);
    expect(entry.state).toBe('complete');
    expect(entry.symptomFlags).toEqual(['leg_pain', 'toe_sensation_worse']);
  });

  it('derives from the same stored record, not a second copy of the state', () => {
    const today = session(DAY_1);
    tick(today, yoga);
    today.save();

    // Nothing is cached: rebuilding from the repository reflects the change.
    expect(day(week(), 1).state).toBe('partial');

    const later = session(DAY_1);
    tick(later, walk);
    later.save();
    expect(day(week(), 1).state).toBe('complete');
  });
});

describe('rest days', () => {
  it('stay rest with no exercise recorded at all', () => {
    expect(day(week(DAY_7), 7).state).toBe('rest');
  });

  it('surface unplanned activity without becoming a normal workout day', () => {
    const rest = session(DAY_7);
    rest.apply({ exercise: { completed: true }, hydration: { glasses: 5 } });
    rest.save();

    const entry = day(week(DAY_7), 7);
    expect(entry.state).toBe('rest');
    expect(entry.unplannedRestDayActivity).toBe(true);
    expect(entry.activities).toEqual([]);
    expect(entry.glasses).toBe(5);
  });

  it('counts as a rest day in the summary, never as a missed session', () => {
    const view = week();
    expect(view.summary.restDays).toBe(1);
    expect(view.summary.plannedActivities).toBe(9); // 3 x (yoga+walk) + 3 x walk
  });
});

describe('weekly aggregates use only what was recorded', () => {
  it('sums recorded minutes and ignores days with none', () => {
    const one = session(DAY_1);
    one.apply({ exercise: { durationMinutes: 15 } });
    one.save();

    const two = session(DAY_2);
    two.apply({ exercise: { durationMinutes: 12 } });
    two.save();

    const three = session(DAY_3);
    three.apply({ hydration: { glasses: 4 } }); // no duration at all
    three.save();

    expect(week().summary.exerciseMinutes).toBe(27);
  });

  it('reports undefined rather than zero when no duration was recorded', () => {
    const one = session(DAY_1);
    one.apply({ hydration: { glasses: 4 } });
    one.save();

    expect(week().summary.exerciseMinutes).toBeUndefined();
  });

  it('averages steps over the recorded days only', () => {
    const values: Array<[string, number]> = [
      [DAY_1, 3000],
      [DAY_2, 4000],
      [DAY_3, 5000],
    ];
    for (const [date, steps] of values) {
      const entry = session(date);
      entry.apply({ exercise: { steps } });
      entry.save();
    }

    const summary = week().summary;
    // Four unrecorded days must not drag this down to 1714.
    expect(summary.averageSteps).toBe(4000);
    expect(summary.stepDaysRecorded).toBe(3);
  });

  it('treats an explicitly recorded zero as a real reading', () => {
    const one = session(DAY_1);
    one.apply({ exercise: { steps: 0 } });
    one.save();

    const two = session(DAY_2);
    two.apply({ exercise: { steps: 4000 } });
    two.save();

    const summary = week().summary;
    expect(day(week(), 1).steps).toBe(0);
    expect(summary.stepDaysRecorded).toBe(2);
    expect(summary.averageSteps).toBe(2000);
  });

  it('distinguishes no step data from a recorded zero', () => {
    const one = session(DAY_1);
    one.apply({ exercise: { steps: 0 } });
    one.save();

    expect(day(week(), 1).steps).toBe(0);
    expect(day(week(), 2).steps).toBeUndefined();
  });

  it('says nothing at all when there is not enough data', () => {
    const summary = week().summary;
    expect(summary.averageSteps).toBeUndefined();
    expect(summary.averageEffort).toBeUndefined();
    expect(summary.exerciseMinutes).toBeUndefined();
    expect(summary.daysLogged).toBe(0);
  });

  it('counts complete and partial sessions separately', () => {
    const one = session(DAY_1);
    tick(one, yoga);
    tick(one, walk);
    one.save();

    const three = session(DAY_3);
    const [yogaThree] = activitiesOn(DAY_3);
    if (!yogaThree) throw new Error('expected an activity on day 3');
    tick(three, yogaThree);
    three.save();

    const summary = week(DAY_7).summary;
    expect(summary.completeSessions).toBe(1);
    expect(summary.partialSessions).toBe(1);
    expect(summary.completedActivities).toBe(3);
  });

  it('produces no score, grade or percentage anywhere', () => {
    const keys = Object.keys(week().summary);
    for (const key of keys) {
      expect(key).not.toMatch(/score|grade|rating|readiness|percent|streak/i);
    }
  });
});

describe('symptoms are shown, never interpreted', () => {
  it('keeps before and after distinct', () => {
    const one = session(DAY_1);
    one.apply({ symptoms: { backPainBefore: 4, backPainAfter: 6 } });
    one.save();

    const entry = day(week(), 1);
    expect(entry.backPainBefore).toBe(4);
    expect(entry.backPainAfter).toBe(6);
  });

  it('leaves a missing reading missing rather than filling it in', () => {
    const one = session(DAY_1);
    one.apply({ symptoms: { backPainBefore: 4 } });
    one.save();

    const entry = day(week(), 1);
    expect(entry.backPainBefore).toBe(4);
    expect(entry.backPainAfter).toBeUndefined();
    expect(day(week(), 2).backPainBefore).toBeUndefined();
  });

  it('averages back pain over recorded days only', () => {
    const one = session(DAY_1);
    one.apply({ symptoms: { backPainBefore: 4, backPainAfter: 6 } });
    one.save();
    const two = session(DAY_2);
    two.apply({ symptoms: { backPainBefore: 2, backPainAfter: 4 } });
    two.save();

    const summary = week().summary;
    expect(summary.averageBackPainBefore).toBe(3);
    expect(summary.averageBackPainAfter).toBe(5);
  });

  it('surfaces a worse toe reading as a plain fact', () => {
    const one = session(DAY_1);
    one.apply({ symptoms: { toeSensation: 'worse' } });
    one.save();

    expect(day(week(), 1).symptomFlags).toEqual(['toe_sensation_worse']);
    expect(day(week(), 2).symptomFlags).toEqual([]);
  });

  it('does not let a worse reading change the day state', () => {
    const one = session(DAY_1);
    tick(one, yoga);
    tick(one, walk);
    one.apply({ symptoms: { toeSensation: 'worse' } });
    one.save();

    expect(day(week(), 1).state).toBe('complete');
  });
});

describe('hydration and nutrition', () => {
  it('shows only recorded hydration values', () => {
    const one = session(DAY_1);
    one.apply({ hydration: { glasses: 6 } });
    one.save();

    const view = week();
    expect(day(view, 1).glasses).toBe(6);
    expect(day(view, 2).glasses).toBeUndefined();
    expect(view.summary.hydrationDaysRecorded).toBe(1);
    expect(view.summary.averageGlasses).toBe(6);
  });

  it('counts a recorded zero glasses as recorded', () => {
    const one = session(DAY_1);
    one.apply({ hydration: { glasses: 0 } });
    one.save();

    const view = week();
    expect(day(view, 1).glasses).toBe(0);
    expect(view.summary.hydrationDaysRecorded).toBe(1);
  });

  it('keeps the fruit target as three distinct states', () => {
    const one = session(DAY_1);
    one.apply({ nutrition: { morningFruit: true } });
    one.save();

    const two = session(DAY_2);
    two.apply({ nutrition: { morningFruit: false } });
    two.save();

    const view = week();
    expect(day(view, 1).morningFruit).toBe(true);
    expect(day(view, 2).morningFruit).toBe(false);
    expect(day(view, 3).morningFruit).toBeUndefined();
    expect(view.summary.fruitTargetYes).toBe(1);
    expect(view.summary.fruitTargetNo).toBe(1);
  });

  it('carries the other nutrition fields through', () => {
    const one = session(DAY_1);
    one.apply({
      nutrition: { proteinMainMeal: true, goustoMeal: false, fruitVegServings: 4 },
    });
    one.save();

    const entry = day(week(), 1);
    expect(entry.proteinMainMeal).toBe(true);
    expect(entry.goustoMeal).toBe(false);
    expect(entry.fruitVegServings).toBe(4);
  });
});

describe('recovery', () => {
  it('ignores missing values when averaging', () => {
    const one = session(DAY_1);
    one.apply({ recovery: { sleepHours: 7, energy: 6, restingHeartRateBpm: 70, hrvMs: 40 } });
    one.save();

    const two = session(DAY_2);
    two.apply({ recovery: { sleepHours: 8 } }); // energy, RHR and HRV all absent
    two.save();

    const summary = week().summary;
    expect(summary.averageSleepHours).toBe(7.5);
    expect(summary.averageEnergy).toBe(6);
    expect(summary.averageRestingHeartRateBpm).toBe(70);
    expect(summary.averageHrvMs).toBe(40);
  });

  it('reports nothing when nothing was recorded', () => {
    const summary = week().summary;
    expect(summary.averageSleepHours).toBeUndefined();
    expect(summary.averageEnergy).toBeUndefined();
    expect(summary.averageRestingHeartRateBpm).toBeUndefined();
    expect(summary.averageHrvMs).toBeUndefined();
  });
});

describe('empty and edge states', () => {
  it('shows the programme normally when nothing has been logged', () => {
    const view = week();
    expect(view.days).toHaveLength(7);
    expect(view.summary.daysLogged).toBe(0);
    expect(view.days.every((entry) => entry.hasRecord === false)).toBe(true);
  });

  it('does not count an empty record as a logged day', () => {
    repo.saveDailyLog(
      createEmptyDailyLog({ date: DAY_1 }, { now: NOW, makeId: sequentialIdFactory('e') }),
    );
    expect(week().summary.daysLogged).toBe(0);
  });

  it('handles a week with no plan calmly', () => {
    const view = buildWeekView(plans, PROGRAMME_START_DATE, 2, repo.listDailyLogs(), '2026-08-21');
    expect(view.hasPlan).toBe(false);
    expect(view.days).toHaveLength(7);
    expect(view.days.every((entry) => entry.state === 'unplanned')).toBe(true);
    expect(view.startDate).toBe('2026-08-20');
  });

  it('still shows records made on an unplanned week', () => {
    const log = applyDailyLogUpdate(
      createEmptyDailyLog({ date: '2026-08-21' }, { now: NOW, makeId: sequentialIdFactory('u') }),
      { exercise: { steps: 5200 } },
      { now: NOW, makeId: sequentialIdFactory('u2') },
    );
    repo.saveDailyLog(log);

    const view = buildWeekView(plans, PROGRAMME_START_DATE, 2, repo.listDailyLogs(), '2026-08-21');
    expect(view.days[1]?.steps).toBe(5200);
    expect(view.summary.averageSteps).toBe(5200);
  });
});

// ---------------------------------------------------------------------------

/**
 * The seven-day journey trail.
 *
 * The trail is a light orientation device drawn from facts the week already holds.
 * These tests protect the two decisions in it that are easy to lose: that the two
 * empty-looking states are indistinguishable on the trail, and that being today is a
 * position rather than a state.
 */
describe('the trail maps days to nodes without inventing anything', () => {
  const node = (state: DayState): TrailNodeState => trailNodeState({ state } as WeekDay);

  it('passes the four named outcomes straight through', () => {
    expect(node('complete')).toBe('complete');
    expect(node('partial')).toBe('partial');
    expect(node('rest')).toBe('rest');
    expect(node('future')).toBe('future');
  });

  it('draws an untouched day and an unplanned one identically', () => {
    // The card still tells these two apart. The trail deliberately does not: the
    // only thing a reader could take from the distinction is blame.
    expect(node('not_yet')).toBe('quiet');
    expect(node('unplanned')).toBe('quiet');
  });

  it('covers every day state the domain can produce', () => {
    const states: DayState[] = [
      'complete',
      'partial',
      'not_yet',
      'rest',
      'future',
      'unplanned',
    ];
    for (const state of states) {
      expect(node(state), `no node for ${state}`).toBeDefined();
    }
  });

  it('yields only the five node shapes, never a sixth', () => {
    const allowed: TrailNodeState[] = ['complete', 'partial', 'rest', 'quiet', 'future'];
    for (const entry of week().days) {
      expect(allowed).toContain(trailNodeState(entry));
    }
  });
});

describe('the trail reads the same week the cards do', () => {
  it('has exactly one node per day, in order', () => {
    const view = week();
    expect(view.days.map(trailNodeState)).toHaveLength(7);
    expect(view.days.map((entry) => entry.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('fills a finished day and half-fills a started one', () => {
    const one = session(DAY_1);
    tick(one, yoga);
    tick(one, walk);
    one.save();

    // Day 3 carries two activities, so ticking one of them is genuinely partial.
    // Day 2 holds a single walk, where one tick is the whole session.
    const three = session(DAY_3);
    const [firstOnThree] = activitiesOn(DAY_3);
    if (!firstOnThree) throw new Error('expected an activity on day 3');
    tick(three, firstOnThree);
    three.save();

    const view = week(DAY_3);
    expect(trailNodeState(day(view, 1))).toBe('complete');
    expect(trailNodeState(day(view, 3))).toBe('partial');
  });

  it('marks a planned rest day as rest rather than as a gap', () => {
    const view = week(DAY_7);
    expect(day(view, 7).state).toBe('rest');
    expect(trailNodeState(day(view, 7))).toBe('rest');
  });

  it('keeps days still to come quiet without calling them anything else', () => {
    const view = week(DAY_1);
    expect(trailNodeState(day(view, 2))).toBe('future');
    expect(trailNodeState(day(view, 6))).toBe('future');
  });

  it('gives a past day with nothing ticked the same node as an unplanned one', () => {
    const past = week(DAY_3);
    expect(day(past, 1).state).toBe('not_yet');
    expect(trailNodeState(day(past, 1))).toBe('quiet');

    const noPlan = buildWeekView(plans, PROGRAMME_START_DATE, 2, repo.listDailyLogs(), '2026-08-21');
    expect(day(noPlan, 1).state).toBe('unplanned');
    expect(trailNodeState(day(noPlan, 1))).toBe('quiet');
  });
});

describe('today is a position on the trail, not a node state', () => {
  it('leaves a finished day finished on the day it happens', () => {
    const one = session(DAY_1);
    tick(one, yoga);
    tick(one, walk);
    one.save();

    const entry = day(week(DAY_1), 1);
    expect(entry.isToday).toBe(true);
    expect(trailNodeState(entry)).toBe('complete');
  });

  it('marks exactly one day as today, and none when the week is elsewhere', () => {
    expect(week(DAY_3).days.filter((entry) => entry.isToday)).toHaveLength(1);
    expect(week('2026-09-30').days.filter((entry) => entry.isToday)).toHaveLength(0);
  });

  it('does not change a rest day just because it is today', () => {
    expect(trailNodeState(day(week(DAY_7), 7))).toBe('rest');
    expect(day(week(DAY_7), 7).isToday).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('architecture', () => {
  it('keeps localStorage out of the Week UI', () => {
    expect(weekScreenSource).not.toMatch(/localStorage/);
    expect(useWeekSource).not.toMatch(/localStorage/);
  });

  it('keeps calculation out of the screen', () => {
    // The screen renders; the domain computes. No arithmetic over stored logs here.
    expect(weekScreenSource).not.toMatch(/\.reduce\(/);
    expect(weekScreenSource).toMatch(/useWeek\(\)/);
  });

  it('uses no charting dependency', () => {
    expect(weekScreenSource).not.toMatch(/recharts|chart\.js|d3/i);
  });

  it('never speaks in scores or failure', () => {
    expect(weekScreenSource).not.toMatch(/readiness|failed|missed|overdue|streak/i);
  });

  it('keeps the trail decorative rather than announcing the week twice', () => {
    // Every fact the trail draws is already written in words on the card below it.
    expect(weekScreenSource).toMatch(/className="weektrail"\s+aria-hidden="true"/);
  });

  it('takes the node mapping from the domain instead of restating it', () => {
    expect(weekScreenSource).toMatch(/import \{ trailNodeState \} from '\.\.\/\.\.\/domain\/week'/);
    expect(weekScreenSource).toMatch(/trailNodeState\(day\)/);
  });

  it('draws one node per day and tallies nothing', () => {
    const start = weekScreenSource.indexOf('function WeekTrail');
    expect(start).toBeGreaterThan(-1);
    const rest = weekScreenSource.slice(start + 1);
    const trail = rest.slice(0, rest.indexOf('\nfunction '));

    expect(trail).toMatch(/days\.map\(/);
    // No total, no fraction, no percentage anywhere inside the strip.
    expect(trail).not.toMatch(/\.length|formatCount|%/);
  });

  it('puts the trail above the records, and keeps the records', () => {
    const trail = weekScreenSource.indexOf('<WeekTrail');
    const cards = weekScreenSource.indexOf('className="week__days"');
    expect(trail).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(trail);
  });

  it('stays clear of the game layer entirely', () => {
    /*
     * Comments stripped first. The trail's own docstring explains at length why no
     * companion is drawn here yet, so it necessarily names the thing this test
     * forbids - and a scan of the raw source would match that explanation and report
     * the opposite of the truth.
     */
    const code = weekScreenSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    expect(code).not.toMatch(/domain\/game/);
    expect(code).not.toMatch(/glyph|mascot/i);
  });
});
