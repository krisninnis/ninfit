import { beforeEach, describe, expect, it } from 'vitest';
import { applyDailyLogUpdate, createEmptyDailyLog, type DomainOptions } from '../domain/dailyLog';
import { parseISODate } from '../domain/dates';
import { PROGRAMME_START_DATE, createWeek1Plan } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import type { DailyLog, WeeklyPlan } from '../domain/types';
import {
  DAYS_PER_WEEK,
  createWeeklyPlan,
  dayIndexInWeek,
  isRestDay,
  plannedActivityLabels,
  plannedMinutes,
  programmeDayNumber,
  programmeWeekNumber,
  resolveSessionForDate,
  rollingWeekDates,
  sessionForDayIndex,
  weekCompletion,
  weekEndDate,
  weekStartDate,
} from '../domain/weeklyPlan';

const START = PROGRAMME_START_DATE; // 2026-08-13, a Thursday
const NOW = '2026-08-13T20:04:00.000+01:00';

let options: DomainOptions;
let week1: WeeklyPlan;

beforeEach(() => {
  options = { now: NOW, makeId: sequentialIdFactory('id') };
  week1 = createWeek1Plan(options);
});

function logFor(date: string, update: Parameters<typeof applyDailyLogUpdate>[1]): DailyLog {
  const log = createEmptyDailyLog({ date }, { now: NOW, makeId: sequentialIdFactory(date) });
  return applyDailyLogUpdate(log, update, { now: NOW, makeId: sequentialIdFactory(`s-${date}`) });
}

describe('position within the programme', () => {
  it('treats the start date as day 1 of week 1', () => {
    expect(programmeDayNumber(START, START)).toBe(1);
    expect(programmeWeekNumber(START, START)).toBe(1);
    expect(dayIndexInWeek(START, START)).toBe(1);
  });

  it('walks days 1 to 7 across the first rolling week', () => {
    const expected = [
      ['2026-08-13', 1],
      ['2026-08-14', 2],
      ['2026-08-15', 3],
      ['2026-08-16', 4],
      ['2026-08-17', 5],
      ['2026-08-18', 6],
      ['2026-08-19', 7],
    ] as const;

    for (const [date, dayIndex] of expected) {
      expect(dayIndexInWeek(START, date)).toBe(dayIndex);
      expect(programmeWeekNumber(START, date)).toBe(1);
    }
  });

  it('rolls into week 2 on day 8', () => {
    expect(programmeDayNumber(START, '2026-08-20')).toBe(8);
    expect(programmeWeekNumber(START, '2026-08-20')).toBe(2);
    expect(dayIndexInWeek(START, '2026-08-20')).toBe(1);
    expect(dayIndexInWeek(START, '2026-08-26')).toBe(7);
    expect(programmeWeekNumber(START, '2026-08-27')).toBe(3);
  });

  it('returns undefined before the programme started', () => {
    expect(programmeDayNumber(START, '2026-08-12')).toBeUndefined();
    expect(programmeWeekNumber(START, '2026-08-12')).toBeUndefined();
    expect(dayIndexInWeek(START, '2026-01-01')).toBeUndefined();
  });

  it('keeps counting correctly across a daylight-saving change', () => {
    // 2026-10-25 is day 74 of a programme that began on 13 August.
    expect(programmeDayNumber(START, '2026-10-25')).toBe(74);
    expect(programmeWeekNumber(START, '2026-10-25')).toBe(11);
    expect(dayIndexInWeek(START, '2026-10-25')).toBe(4);
  });
});

describe('rolling weeks are not calendar weeks', () => {
  it('starts every week on the same weekday as the programme start', () => {
    const thursday = parseISODate(START).getDay();
    for (const weekNumber of [1, 2, 3, 12, 53]) {
      const start = weekStartDate(START, weekNumber);
      expect(parseISODate(start).getDay()).toBe(thursday);
    }
  });

  it('computes week bounds seven days apart', () => {
    expect(weekStartDate(START, 1)).toBe('2026-08-13');
    expect(weekEndDate(START, 1)).toBe('2026-08-19');
    expect(weekStartDate(START, 2)).toBe('2026-08-20');
    expect(weekEndDate(START, 2)).toBe('2026-08-26');
  });

  it('lists the seven day keys of a week in order', () => {
    const dates = rollingWeekDates(START, 1);
    expect(dates).toHaveLength(DAYS_PER_WEEK);
    expect(dates[0]).toBe('2026-08-13');
    expect(dates[6]).toBe('2026-08-19');
  });

  it('rejects a week number below 1', () => {
    expect(() => weekStartDate(START, 0)).toThrow(/Week number must be 1 or greater/);
  });
});

describe('resolving the planned session for a date', () => {
  it('gives yoga plus a walk on day 1', () => {
    const resolved = resolveSessionForDate([week1], START, START);
    expect(resolved?.dayIndex).toBe(1);
    expect(resolved?.weekNumber).toBe(1);
    expect(plannedMinutes(resolved?.session)).toBe(15);
    expect(plannedActivityLabels(resolved?.session)).toEqual([
      '10-minute beginner yoga',
      '5-minute easy walk',
    ]);
  });

  it('gives a single walk on day 2', () => {
    const resolved = resolveSessionForDate([week1], START, '2026-08-14');
    expect(plannedActivityLabels(resolved?.session)).toEqual(['15-minute easy walk']);
    expect(plannedMinutes(resolved?.session)).toBe(15);
  });

  it('resolves day 7 as a rest day', () => {
    const resolved = resolveSessionForDate([week1], START, '2026-08-19');
    expect(resolved?.dayIndex).toBe(7);
    expect(isRestDay(resolved?.session)).toBe(true);
    expect(resolved?.session.activities).toEqual([]);
    expect(plannedMinutes(resolved?.session)).toBe(0);
    expect(plannedActivityLabels(resolved?.session)).toEqual([]);
  });

  it('returns nothing before the start date or for an unplanned week', () => {
    expect(resolveSessionForDate([week1], START, '2026-08-12')).toBeUndefined();
    expect(resolveSessionForDate([week1], START, '2026-08-20')).toBeUndefined();
  });

  it('treats a missing session as no plan rather than a rest day', () => {
    const sparse = createWeeklyPlan(
      {
        programmeVersion: 'week-1-v1',
        weekNumber: 1,
        startDate: START,
        targetEffortMin: 2,
        targetEffortMax: 4,
        sessions: [{ dayIndex: 1, activities: [] }],
      },
      options,
    );
    expect(sessionForDayIndex(sparse, 2)).toBeUndefined();
    expect(isRestDay(undefined)).toBe(false);
  });
});

describe('createWeeklyPlan validation', () => {
  const base = {
    programmeVersion: 'week-1-v1',
    weekNumber: 1,
    startDate: START,
    targetEffortMin: 2,
    targetEffortMax: 4,
  };

  it('rejects a day index outside 1-7', () => {
    for (const dayIndex of [0, 8, -1]) {
      expect(() =>
        createWeeklyPlan({ ...base, sessions: [{ dayIndex, activities: [] }] }, options),
      ).toThrow(/dayIndex must be 1-7/);
    }
  });

  it('rejects an invalid start date', () => {
    expect(() =>
      createWeeklyPlan({ ...base, startDate: '2026-02-30', sessions: [] }, options),
    ).toThrow(/Invalid plan start date/);
  });

  it('defaults activity intensity to very light', () => {
    const plan = createWeeklyPlan(
      {
        ...base,
        sessions: [
          { dayIndex: 1, activities: [{ type: 'walk', label: 'easy walk', durationMinutes: 5 }] },
        ],
      },
      options,
    );
    expect(plan.sessions[0]?.activities[0]?.intensity).toBe('very_light');
  });
});

describe('weekCompletion', () => {
  it('counts six planned sessions and one rest day for week 1', () => {
    const completion = weekCompletion(week1, [], START);
    expect(completion.plannedSessions).toBe(6);
    expect(completion.restDays).toBe(1);
    expect(completion.startDate).toBe('2026-08-13');
    expect(completion.endDate).toBe('2026-08-19');
  });

  it('reports undefined minutes when nothing was recorded, not zero', () => {
    expect(weekCompletion(week1, [], START).totalExerciseMinutes).toBeUndefined();
  });

  it('counts completed planned sessions', () => {
    const logs = [
      logFor('2026-08-13', { exercise: { completed: true, durationMinutes: 15 } }),
      logFor('2026-08-14', { exercise: { completed: true, durationMinutes: 15 } }),
      logFor('2026-08-15', { exercise: { completed: false } }),
    ];
    const completion = weekCompletion(week1, logs, START);

    expect(completion.completedPlannedSessions).toBe(2);
    expect(completion.completedRestDays).toBe(0);
    expect(completion.totalExerciseMinutes).toBe(30);
    expect(completion.loggedDays).toBe(3);
  });

  it('does not reduce completion because symptoms were worse', () => {
    const withWorseSymptoms = [
      logFor('2026-08-13', {
        exercise: { completed: true, durationMinutes: 15 },
        symptoms: { backPainBefore: 3, backPainAfter: 8, legPain: true, toeSensation: 'worse' },
      }),
    ];
    const withoutSymptoms = [
      logFor('2026-08-13', { exercise: { completed: true, durationMinutes: 15 } }),
    ];

    const a = weekCompletion(week1, withWorseSymptoms, START);
    const b = weekCompletion(week1, withoutSymptoms, START);

    expect(a.completedPlannedSessions).toBe(1);
    expect(a.completedPlannedSessions).toBe(b.completedPlannedSessions);
    expect(a.totalExerciseMinutes).toBe(b.totalExerciseMinutes);
  });

  it('records activity on a rest day separately, without penalty', () => {
    const logs = [logFor('2026-08-19', { exercise: { completed: true, durationMinutes: 20 } })];
    const completion = weekCompletion(week1, logs, START);

    expect(completion.completedRestDays).toBe(1);
    expect(completion.completedPlannedSessions).toBe(0);
    expect(completion.totalExerciseMinutes).toBe(20);
  });

  it('ignores days outside the rolling week', () => {
    const logs = [
      logFor('2026-08-12', { exercise: { completed: true, durationMinutes: 30 } }),
      logFor('2026-08-20', { exercise: { completed: true, durationMinutes: 30 } }),
    ];
    const completion = weekCompletion(week1, logs, START);

    expect(completion.completedPlannedSessions).toBe(0);
    expect(completion.loggedDays).toBe(0);
    expect(completion.totalExerciseMinutes).toBeUndefined();
  });

  it('does not count an empty record as a logged day', () => {
    const empty = createEmptyDailyLog({ date: '2026-08-13' }, options);
    expect(weekCompletion(week1, [empty], START).loggedDays).toBe(0);
  });

  it('counts a day logged even when only hydration was recorded', () => {
    const logs = [logFor('2026-08-13', { hydration: { glasses: 6 } })];
    const completion = weekCompletion(week1, logs, START);

    expect(completion.loggedDays).toBe(1);
    expect(completion.completedPlannedSessions).toBe(0);
    expect(completion.totalExerciseMinutes).toBeUndefined();
  });
});
