import { beforeEach, describe, expect, it } from 'vitest';
import progressScreenSource from '../ui/screens/ProgressScreen.tsx?raw';
import useProgressSource from '../ui/hooks/useProgress.ts?raw';
import { readAppData } from '../app/appData';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { createMeasurement } from '../domain/measurement';
import { progressWindow, summariseProgress, type ProgressSummary } from '../domain/progress';
import { resolveToday } from '../domain/today';
import type { PlannedActivity, WeeklyPlan } from '../domain/types';
import { cmToInches } from '../domain/units';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, STORAGE_KEYS, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const DAY_1 = '2026-08-13';
const DAY_2 = '2026-08-14';
const DAY_3 = '2026-08-15';
const DAY_7 = '2026-08-19';

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];
let yoga: PlannedActivity;

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

function record(date: string, update: Parameters<TodaySession['apply']>[0]): void {
  const entry = session(date);
  entry.apply(update);
  entry.save();
}

/** The summary as the screen computes it, over the whole recorded history. */
function summary(range: 'week' | 'all' = 'all'): ProgressSummary {
  const data = readAppData(repo);
  return summariseProgress(data, progressWindow(range, data.profile.programmeStartDate, DAY_7));
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const [first] = resolveToday(plans, PROGRAMME_START_DATE, DAY_1).activities;
  if (!first) throw new Error('expected a planned activity');
  yoga = first;
});

// ---------------------------------------------------------------------------

describe('baseline is the starting reference', () => {
  it('seeds the approved starting values into the series', () => {
    const view = summary();
    expect(view.weightKg.first).toEqual({ date: PROGRAMME_START_DATE, value: 69.9 });
    expect(view.waistCm.first?.value).toBe(76.2);
    expect(view.restingHeartRateBpm.first?.value).toBe(72);
    expect(view.hrvMs.first?.value).toBe(37);
    expect(view.baselineAverageDailySteps).toBe(3000);
  });

  it('keeps the baseline step estimate out of the recorded steps series', () => {
    const view = summary();
    expect(view.steps.points).toEqual([]);
    expect(view.sampleCounts.steps).toBe(0);
    expect(view.averageSteps).toBeUndefined();
  });

  it('converts the waist baseline to inches for display without restating storage', () => {
    expect(cmToInches(76.2)).toBeCloseTo(30, 9);
    expect(repo.getBaseline()?.waistCm).toBe(76.2);
  });
});

describe('steps', () => {
  it('averages over recorded days only', () => {
    record(DAY_1, { exercise: { steps: 3000 } });
    record(DAY_2, { exercise: { steps: 5000 } });
    record(DAY_3, { hydration: { glasses: 4 } });

    const view = summary();
    expect(view.averageSteps).toBe(4000);
    expect(view.sampleCounts.steps).toBe(2);
  });

  it('treats an explicitly recorded zero as a reading', () => {
    record(DAY_1, { exercise: { steps: 0 } });
    record(DAY_2, { exercise: { steps: 4000 } });

    const view = summary();
    expect(view.steps.points[0]).toEqual({ date: DAY_1, value: 0 });
    expect(view.averageSteps).toBe(2000);
    expect(view.sampleCounts.steps).toBe(2);
  });
});

describe('exercise', () => {
  it('sums recorded minutes within the current week', () => {
    record(DAY_1, { exercise: { durationMinutes: 15 } });
    record(DAY_2, { exercise: { durationMinutes: 12 } });

    expect(summary('week').exerciseMinutes).toBe(27);
    expect(summary('week').sampleCounts.exerciseMinutes).toBe(2);
  });

  it('reports nothing rather than zero when no duration was recorded', () => {
    record(DAY_1, { hydration: { glasses: 3 } });
    expect(summary().exerciseMinutes).toBeUndefined();
  });

  it('represents partial and full completion separately', () => {
    const one = session(DAY_1);
    one.apply(toggleActivityCompletion(one.getLog(), yoga.id, true));
    one.save();

    const three = session(DAY_3);
    const [yogaThree, walkThree] = resolveToday(plans, PROGRAMME_START_DATE, DAY_3).activities;
    if (!yogaThree || !walkThree) throw new Error('expected two activities on day 3');
    three.apply(toggleActivityCompletion(three.getLog(), yogaThree.id, true));
    three.apply(toggleActivityCompletion(three.getLog(), walkThree.id, true));
    three.save();

    const activity = summary().activity;
    expect(activity.partialSessions).toBe(1);
    expect(activity.completeSessions).toBe(1);
    expect(activity.completedActivities).toBe(3);
  });

  it('does not let a rest day count against anything', () => {
    record(DAY_7, { exercise: { completed: true, durationMinutes: 20 } });

    const activity = summary().activity;
    expect(activity.restDaysWithActivity).toBe(1);
    expect(activity.partialSessions).toBe(0);
    expect(activity.completeSessions).toBe(0);
  });

  it('offers no adherence ratio to read as a grade', () => {
    const keys = Object.keys(summary().activity);
    for (const key of keys) {
      expect(key).not.toMatch(/percent|adherence|rate|target|score/i);
    }
  });
});

describe('body measurements', () => {
  it('extends the baseline series with later measurements', () => {
    repo.saveMeasurements([
      createMeasurement(
        { recordedOn: '2026-09-13', weightKg: 69.2, waistCm: 75 },
        { makeId: sequentialIdFactory('m') },
      ),
    ]);

    const view = summary();
    expect(view.weightKg.points).toEqual([
      { date: PROGRAMME_START_DATE, value: 69.9 },
      { date: '2026-09-13', value: 69.2 },
    ]);
    expect(view.weightKg.first?.date).toBe(PROGRAMME_START_DATE);
    expect(view.weightKg.latest?.date).toBe('2026-09-13');
    expect(view.sampleCounts.weight).toBe(2);
  });

  it('ignores a measurement that recorded nothing for that metric', () => {
    repo.saveMeasurements([
      createMeasurement({ recordedOn: '2026-09-13', weightKg: 69.2 }, { makeId: sequentialIdFactory('m') }),
    ]);
    expect(summary().waistCm.points).toHaveLength(1);
  });
});

describe('resting heart rate and HRV precedence', () => {
  it('takes daily recovery readings above the baseline', () => {
    record(DAY_2, { recovery: { restingHeartRateBpm: 69, hrvMs: 41 } });

    const view = summary();
    expect(view.restingHeartRateBpm.points).toEqual([
      { date: PROGRAMME_START_DATE, value: 72 },
      { date: DAY_2, value: 69 },
    ]);
    expect(view.hrvMs.latest?.value).toBe(41);
  });

  it('lets an explicit measurement win over the recovery log for the same day', () => {
    record(DAY_2, { recovery: { restingHeartRateBpm: 69, hrvMs: 41 } });
    repo.saveMeasurements([
      createMeasurement(
        { recordedOn: DAY_2, restingHeartRateBpm: 66, hrvMs: 45 },
        { makeId: sequentialIdFactory('m') },
      ),
    ]);

    const view = summary();
    expect(view.restingHeartRateBpm.latest).toEqual({ date: DAY_2, value: 66 });
    expect(view.hrvMs.latest).toEqual({ date: DAY_2, value: 45 });
  });

  it('leaves a missing reading missing', () => {
    record(DAY_2, { recovery: { restingHeartRateBpm: 69 } }); // no HRV

    const view = summary();
    expect(view.restingHeartRateBpm.points).toHaveLength(2);
    expect(view.hrvMs.points).toHaveLength(1); // baseline only
    expect(view.sampleCounts.hrv).toBe(1);
  });
});

describe('sleep, energy and back pain', () => {
  it('averages sleep over recorded days only', () => {
    record(DAY_1, { recovery: { sleepHours: 7 } });
    record(DAY_2, { recovery: { sleepHours: 8 } });
    record(DAY_3, { hydration: { glasses: 4 } });

    const view = summary();
    expect(view.averageSleepHours).toBe(7.5);
    expect(view.sampleCounts.sleep).toBe(2);
  });

  it('averages energy over recorded days only', () => {
    record(DAY_1, { recovery: { energy: 6 } });
    record(DAY_2, { recovery: { sleepHours: 8 } }); // energy absent

    const view = summary();
    expect(view.averageEnergy).toBe(6);
    expect(view.sampleCounts.energy).toBe(1);
  });

  it('averages back pain within the day first, then across days', () => {
    record(DAY_1, { symptoms: { backPainBefore: 4, backPainAfter: 6 } }); // day value 5
    record(DAY_2, { symptoms: { backPainBefore: 3 } }); // day value 3

    const view = summary();
    expect(view.averageBackPain).toBe(4);
    expect(view.sampleCounts.backPain).toBe(2);
  });

  it('reports nothing when no readings exist at all', () => {
    const view = summary();
    expect(view.averageSleepHours).toBeUndefined();
    expect(view.averageEnergy).toBeUndefined();
    expect(view.averageBackPain).toBeUndefined();
  });
});

describe('symptoms are counted, never interpreted', () => {
  it('counts each recorded toe state', () => {
    record(DAY_1, { symptoms: { toeSensation: 'worse', legPain: true } });
    record(DAY_2, { symptoms: { toeSensation: 'same' } });
    record(DAY_3, { symptoms: { toeSensation: 'better' } });

    const symptoms = summary().symptoms;
    expect(symptoms).toMatchObject({
      toeWorse: 1,
      toeSame: 1,
      toeBetter: 1,
      legPainDays: 1,
      daysWithSymptomRecord: 3,
    });
  });

  it('produces no score of any kind', () => {
    const view = summary();
    for (const key of Object.keys(view)) {
      expect(key).not.toMatch(/readiness|fitness|health|score|grade|rating/i);
    }
    expect(progressScreenSource).not.toMatch(/readiness|fitness score|health score/i);
  });
});

describe('ranges', () => {
  it('limits the week range to the current rolling week', () => {
    record(DAY_1, { exercise: { durationMinutes: 15 } });

    const data = readAppData(repo);
    const window = progressWindow('week', data.profile.programmeStartDate, DAY_7);
    expect(window).toEqual({ from: DAY_1, to: DAY_7 });
  });

  it('places no bounds on the all-time range', () => {
    expect(progressWindow('all', PROGRAMME_START_DATE, DAY_7)).toEqual({});
  });
});

describe('storage issues are not mistaken for empty history', () => {
  it('reports an issue rather than silently showing no measurements', () => {
    repo.saveMeasurements([
      createMeasurement({ recordedOn: DAY_2, weightKg: 69.2 }, { makeId: sequentialIdFactory('m') }),
    ]);
    adapter.set(STORAGE_KEYS.measurements, 'not json');

    expect(repo.getMeasurements()).toEqual([]);
    expect(repo.getIssues().length).toBeGreaterThan(0);
    expect(repo.getIssues()[0]?.key).toBe(STORAGE_KEYS.measurements);
  });

  it('repairs nothing automatically and destroys nothing', () => {
    adapter.set(STORAGE_KEYS.measurements, 'not json');
    repo.getMeasurements();

    expect(adapter.get(STORAGE_KEYS.measurements)).toBe('not json');
    expect(adapter.get(STORAGE_KEYS.baseline)).not.toBeNull();
    expect(repo.getBaseline()?.weightKg).toBe(69.9);
  });

  it('surfaces the condition on the screen without exposing internals', () => {
    expect(progressScreenSource).toMatch(/could not be read/);
    expect(progressScreenSource).not.toMatch(/JSON\.stringify|issue\.detail|error/i);
  });
});

describe('architecture', () => {
  it('keeps localStorage out of the Progress UI', () => {
    expect(progressScreenSource).not.toMatch(/localStorage/);
    expect(useProgressSource).not.toMatch(/localStorage/);
  });

  it('adds no chart dependency', () => {
    expect(progressScreenSource).not.toMatch(/recharts|chart\.js|\bd3\b|victory|nivo/i);
  });

  it('derives from the same records as Today and Week, with no second store', () => {
    record(DAY_1, { exercise: { steps: 3500, durationMinutes: 15 }, recovery: { restingHeartRateBpm: 71 } });

    const view = summary();
    expect(view.steps.latest?.value).toBe(3500);
    expect(view.exerciseMinutes).toBe(15);
    expect(view.restingHeartRateBpm.latest?.value).toBe(71);
    // The same underlying record Today wrote.
    expect(repo.getDailyLog(DAY_1)?.exercise?.steps).toBe(3500);
  });
});
