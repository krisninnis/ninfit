import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyDailyLogUpdate,
  backPainChange,
  createEmptyDailyLog,
  dailyLogCompletion,
  exerciseMinutes,
  filledSections,
  findDailyLog,
  hasSymptomFlag,
  isDailyLogEmpty,
  isSectionEmpty,
  isDayMarkedComplete,
  sortDailyLogs,
  symptomFlags,
  upsertDailyLog,
  type DomainOptions,
} from '../domain/dailyLog';
import { sequentialIdFactory } from '../domain/ids';
import type { DailyLog, HydrationLog } from '../domain/types';

const CREATED_AT = '2026-08-13T08:00:00.000+01:00';
const UPDATED_AT = '2026-08-13T20:04:00.000+01:00';

let options: DomainOptions;

beforeEach(() => {
  options = { now: CREATED_AT, makeId: sequentialIdFactory('id') };
});

function newLog(date = '2026-08-13'): DailyLog {
  return createEmptyDailyLog({ date }, options);
}

describe('createEmptyDailyLog', () => {
  it('creates a log with an id, a date and matching timestamps', () => {
    const log = newLog();
    expect(log.id).toBe('id-1');
    expect(log.date).toBe('2026-08-13');
    expect(log.createdAt).toBe(CREATED_AT);
    expect(log.updatedAt).toBe(CREATED_AT);
  });

  it('starts with no sections at all', () => {
    const log = newLog();
    expect(log.exercise).toBeUndefined();
    expect(log.symptoms).toBeUndefined();
    expect(log.nutrition).toBeUndefined();
    expect(log.hydration).toBeUndefined();
    expect(log.recovery).toBeUndefined();
    expect(isDailyLogEmpty(log)).toBe(true);
    expect(dailyLogCompletion(log)).toEqual({ filled: 0, total: 5, sections: [] });
  });

  it('optionally links to a plan and session', () => {
    const log = createEmptyDailyLog(
      { date: '2026-08-13', weeklyPlanId: 'plan-1', plannedSessionId: 'session-1' },
      options,
    );
    expect(log.weeklyPlanId).toBe('plan-1');
    expect(log.plannedSessionId).toBe('session-1');
  });

  it('omits the plan links entirely when not supplied', () => {
    expect('weeklyPlanId' in newLog()).toBe(false);
  });

  it('rejects an invalid date', () => {
    expect(() => createEmptyDailyLog({ date: '2026-02-30' }, options)).toThrow(
      /Invalid daily log date/,
    );
    expect(() => createEmptyDailyLog({ date: '13-08-2026' }, options)).toThrow();
  });
});

describe('applyDailyLogUpdate', () => {
  it('creates a section lazily, with its own id', () => {
    const log = applyDailyLogUpdate(newLog(), { exercise: { steps: 4200 } }, options);
    expect(log.exercise?.id).toBe('id-2');
    expect(log.exercise?.steps).toBe(4200);
    expect(log.symptoms).toBeUndefined();
  });

  it('does not create a section for an empty patch', () => {
    const log = applyDailyLogUpdate(newLog(), { exercise: {} }, options);
    expect(log.exercise).toBeUndefined();
  });

  it('keeps the same section id across later updates', () => {
    const first = applyDailyLogUpdate(newLog(), { exercise: { steps: 100 } }, options);
    const second = applyDailyLogUpdate(first, { exercise: { effort: 3 } }, options);
    expect(second.exercise?.id).toBe(first.exercise?.id);
  });

  it('leaves unrelated sections untouched', () => {
    let log = newLog();
    log = applyDailyLogUpdate(log, { exercise: { steps: 4200, effort: 3 } }, options);
    log = applyDailyLogUpdate(log, { hydration: { glasses: 5 } }, options);
    log = applyDailyLogUpdate(log, { recovery: { sleepHours: 7.5 } }, options);

    expect(log.exercise?.steps).toBe(4200);
    expect(log.exercise?.effort).toBe(3);
    expect(log.hydration?.glasses).toBe(5);
    expect(log.recovery?.sleepHours).toBe(7.5);
  });

  it('leaves unrelated fields within the same section untouched', () => {
    let log = applyDailyLogUpdate(
      newLog(),
      { exercise: { completed: true, durationMinutes: 15, effort: 3, steps: 4200 } },
      options,
    );
    log = applyDailyLogUpdate(log, { exercise: { steps: 4800 } }, options);

    expect(log.exercise).toMatchObject({
      completed: true,
      durationMinutes: 15,
      effort: 3,
      steps: 4800,
    });
  });

  it('clears only the field explicitly set to undefined', () => {
    let log = applyDailyLogUpdate(
      newLog(),
      { exercise: { completed: true, effort: 3, steps: 4200 } },
      options,
    );
    log = applyDailyLogUpdate(log, { exercise: { effort: undefined } }, options);

    expect('effort' in (log.exercise ?? {})).toBe(false);
    expect(log.exercise?.completed).toBe(true);
    expect(log.exercise?.steps).toBe(4200);
  });

  it('preserves a genuine zero rather than treating it as missing', () => {
    const log = applyDailyLogUpdate(
      newLog(),
      { exercise: { steps: 0, durationMinutes: 0 }, symptoms: { backPainBefore: 0 } },
      options,
    );
    expect(log.exercise?.steps).toBe(0);
    expect(log.exercise?.durationMinutes).toBe(0);
    expect(log.symptoms?.backPainBefore).toBe(0);
    expect(isDailyLogEmpty(log)).toBe(false);
  });

  it('preserves a false value rather than dropping it', () => {
    const log = applyDailyLogUpdate(
      newLog(),
      { exercise: { completed: false }, nutrition: { morningFruit: false } },
      options,
    );
    expect(log.exercise?.completed).toBe(false);
    expect(log.nutrition?.morningFruit).toBe(false);
  });

  it('does not mutate the log it was given', () => {
    const original = applyDailyLogUpdate(newLog(), { exercise: { steps: 100 } }, options);
    const snapshot = structuredClone(original);
    applyDailyLogUpdate(original, { exercise: { steps: 999 }, hydration: { glasses: 3 } }, options);
    expect(original).toEqual(snapshot);
  });

  it('moves updatedAt but never createdAt', () => {
    const log = applyDailyLogUpdate(newLog(), { hydration: { glasses: 2 } }, {
      ...options,
      now: UPDATED_AT,
    });
    expect(log.createdAt).toBe(CREATED_AT);
    expect(log.updatedAt).toBe(UPDATED_AT);
  });

  it('returns the identical object for an empty update', () => {
    const log = newLog();
    expect(applyDailyLogUpdate(log, {}, options)).toBe(log);
  });

  it('updates the plan links, and can clear them', () => {
    let log = applyDailyLogUpdate(newLog(), { weeklyPlanId: 'plan-1' }, options);
    expect(log.weeklyPlanId).toBe('plan-1');
    log = applyDailyLogUpdate(log, { weeklyPlanId: undefined }, options);
    expect('weeklyPlanId' in log).toBe(false);
  });
});

describe('section and day emptiness', () => {
  it('treats a section holding only an id as empty', () => {
    const empty: HydrationLog = { id: 'x' };
    const filled: HydrationLog = { id: 'x', glasses: 1 };
    const cleared: HydrationLog = { id: 'x', glasses: undefined };

    expect(isSectionEmpty(undefined)).toBe(true);
    expect(isSectionEmpty(empty)).toBe(true);
    expect(isSectionEmpty(cleared)).toBe(true);
    expect(isSectionEmpty(filled)).toBe(false);
  });

  it('reports which sections have been filled, in screen order', () => {
    let log = newLog();
    log = applyDailyLogUpdate(log, { recovery: { energy: 6 } }, options);
    log = applyDailyLogUpdate(log, { exercise: { completed: true } }, options);

    expect(filledSections(log)).toEqual(['exercise', 'recovery']);
    expect(dailyLogCompletion(log)).toEqual({
      filled: 2,
      total: 5,
      sections: ['exercise', 'recovery'],
    });
  });
});

describe('completion is independent of symptom outcome', () => {
  it('stays completed when every symptom reading is worse', () => {
    const log = applyDailyLogUpdate(
      newLog(),
      {
        exercise: { completed: true, durationMinutes: 15, effort: 3 },
        symptoms: {
          backPainBefore: 3,
          backPainAfter: 7,
          legPain: true,
          toeSensation: 'worse',
        },
      },
      options,
    );

    expect(isDayMarkedComplete(log)).toBe(true);
    expect(hasSymptomFlag(log)).toBe(true);
    expect(symptomFlags(log)).toEqual(['leg_pain', 'toe_sensation_worse']);
    expect(backPainChange(log)).toBe(4);
    expect(log.exercise?.completed).toBe(true);
  });

  it('stays not-completed when every symptom reading improves', () => {
    const log = applyDailyLogUpdate(
      newLog(),
      {
        exercise: { completed: false },
        symptoms: { backPainBefore: 5, backPainAfter: 2, legPain: false, toeSensation: 'better' },
      },
      options,
    );
    expect(isDayMarkedComplete(log)).toBe(false);
    expect(hasSymptomFlag(log)).toBe(false);
  });

  it('reads completion from the exercise section alone', () => {
    expect(isDayMarkedComplete(undefined)).toBe(false);
    expect(isDayMarkedComplete(newLog())).toBe(false);
  });
});

describe('symptomFlags', () => {
  it('flags leg pain and worse toe sensation independently', () => {
    const legOnly = applyDailyLogUpdate(newLog(), { symptoms: { legPain: true } }, options);
    const toeOnly = applyDailyLogUpdate(
      newLog(),
      { symptoms: { toeSensation: 'worse' } },
      options,
    );
    expect(symptomFlags(legOnly)).toEqual(['leg_pain']);
    expect(symptomFlags(toeOnly)).toEqual(['toe_sensation_worse']);
  });

  it('does not flag "same" or "better"', () => {
    for (const trend of ['same', 'better'] as const) {
      const log = applyDailyLogUpdate(newLog(), { symptoms: { toeSensation: trend } }, options);
      expect(symptomFlags(log)).toEqual([]);
    }
  });
});

describe('backPainChange', () => {
  it('needs both readings before reporting a change', () => {
    const beforeOnly = applyDailyLogUpdate(
      newLog(),
      { symptoms: { backPainBefore: 4 } },
      options,
    );
    const afterOnly = applyDailyLogUpdate(newLog(), { symptoms: { backPainAfter: 4 } }, options);

    expect(backPainChange(beforeOnly)).toBeUndefined();
    expect(backPainChange(afterOnly)).toBeUndefined();
    expect(backPainChange(newLog())).toBeUndefined();
  });

  it('reports zero only when both readings are genuinely equal', () => {
    const log = applyDailyLogUpdate(
      newLog(),
      { symptoms: { backPainBefore: 4, backPainAfter: 4 } },
      options,
    );
    expect(backPainChange(log)).toBe(0);
  });
});

describe('exerciseMinutes', () => {
  it('returns undefined when nothing was recorded', () => {
    expect(exerciseMinutes(newLog())).toBeUndefined();
    expect(exerciseMinutes(undefined)).toBeUndefined();
  });

  it('returns a recorded zero', () => {
    const log = applyDailyLogUpdate(newLog(), { exercise: { durationMinutes: 0 } }, options);
    expect(exerciseMinutes(log)).toBe(0);
  });
});

describe('collection helpers', () => {
  const a = { date: '2026-08-15' } as DailyLog;
  const b = { date: '2026-08-13' } as DailyLog;
  const c = { date: '2026-08-14' } as DailyLog;

  it('finds a log by date', () => {
    expect(findDailyLog([a, b, c], '2026-08-14')).toBe(c);
    expect(findDailyLog([a, b, c], '2026-08-20')).toBeUndefined();
  });

  it('sorts by date without mutating the input', () => {
    const input = [a, b, c];
    expect(sortDailyLogs(input).map((log) => log.date)).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ]);
    expect(input.map((log) => log.date)).toEqual(['2026-08-15', '2026-08-13', '2026-08-14']);
  });

  it('replaces an existing day rather than duplicating it', () => {
    const replacement = { date: '2026-08-14', id: 'new' } as DailyLog;
    const result = upsertDailyLog([a, b, c], replacement);
    expect(result).toHaveLength(3);
    expect(findDailyLog(result, '2026-08-14')).toBe(replacement);
  });

  it('appends a new day and keeps the list sorted', () => {
    const result = upsertDailyLog([a, b, c], { date: '2026-08-12' } as DailyLog);
    expect(result.map((log) => log.date)).toEqual([
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ]);
  });
});
