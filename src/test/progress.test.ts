import { beforeEach, describe, expect, it } from 'vitest';
import { applyDailyLogUpdate, createEmptyDailyLog } from '../domain/dailyLog';
import { PROGRAMME_START_DATE, createSeedAppData } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import {
  buildSeries,
  dailyBackPain,
  isFiniteNumber,
  logsInWindow,
  mean,
  sum,
  summariseProgress,
} from '../domain/progress';
import type { AppData, DailyLog, Measurement } from '../domain/types';

const NOW = '2026-08-13T20:04:00.000+01:00';
const START = PROGRAMME_START_DATE;

let data: AppData;

beforeEach(() => {
  data = createSeedAppData({ now: NOW, makeId: sequentialIdFactory('seed') });
});

function log(date: string, update: Parameters<typeof applyDailyLogUpdate>[1]): DailyLog {
  const empty = createEmptyDailyLog({ date }, { now: NOW, makeId: sequentialIdFactory(date) });
  return applyDailyLogUpdate(empty, update, { now: NOW, makeId: sequentialIdFactory(`s${date}`) });
}

function measurement(recordedOn: string, values: Partial<Measurement>): Measurement {
  return { id: `m-${recordedOn}`, recordedOn, ...values };
}

describe('isFiniteNumber', () => {
  it('rejects everything that is not a usable number', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-4.5)).toBe(true);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber('7')).toBe(false);
  });
});

describe('mean', () => {
  it('is undefined when there is nothing to average, not zero', () => {
    expect(mean([])).toBeUndefined();
    expect(mean([undefined, undefined])).toBeUndefined();
    expect(mean([null, Number.NaN, '4'])).toBeUndefined();
  });

  it('skips missing values instead of counting them as zero', () => {
    // If undefined were treated as 0 this would be 2, not 4.
    expect(mean([4, undefined, 4, undefined])).toBe(4);
    expect(mean([undefined, 6])).toBe(6);
  });

  it('counts genuine zeros', () => {
    expect(mean([0, 0])).toBe(0);
    expect(mean([0, 4])).toBe(2);
  });

  it('rounds to the requested precision', () => {
    expect(mean([1, 2])).toBe(1.5);
    expect(mean([1, 1, 2])).toBe(1.3);
    expect(mean([4000, 5000], 0)).toBe(4500);
  });
});

describe('sum', () => {
  it('is undefined when nothing was recorded', () => {
    expect(sum([])).toBeUndefined();
    expect(sum([undefined, null])).toBeUndefined();
  });

  it('adds only the recorded values', () => {
    expect(sum([15, undefined, 10])).toBe(25);
    expect(sum([0])).toBe(0);
  });
});

describe('buildSeries', () => {
  it('sorts by date and reports the ends', () => {
    const series = buildSeries([
      { date: '2026-08-20', value: 69.2 },
      { date: '2026-08-13', value: 69.9 },
    ]);
    expect(series.points.map((point) => point.date)).toEqual(['2026-08-13', '2026-08-20']);
    expect(series.first?.value).toBe(69.9);
    expect(series.latest?.value).toBe(69.2);
    expect(series.change).toBe(-0.7);
  });

  it('reports no change from a single point', () => {
    const series = buildSeries([{ date: '2026-08-13', value: 69.9 }]);
    expect(series.first).toEqual(series.latest);
    expect(series.change).toBeUndefined();
  });

  it('handles an empty series without inventing values', () => {
    const series = buildSeries([]);
    expect(series.points).toEqual([]);
    expect(series.first).toBeUndefined();
    expect(series.latest).toBeUndefined();
    expect(series.change).toBeUndefined();
  });
});

describe('dailyBackPain', () => {
  it('averages whichever readings exist', () => {
    expect(dailyBackPain(log('2026-08-13', { symptoms: { backPainBefore: 4, backPainAfter: 6 } }))).toBe(5);
    expect(dailyBackPain(log('2026-08-13', { symptoms: { backPainBefore: 3 } }))).toBe(3);
    expect(dailyBackPain(log('2026-08-13', { symptoms: { backPainAfter: 7 } }))).toBe(7);
  });

  it('is undefined when neither reading exists', () => {
    expect(dailyBackPain(log('2026-08-13', { hydration: { glasses: 4 } }))).toBeUndefined();
  });
});

describe('summariseProgress with no daily data', () => {
  it('leaves every aggregate undefined rather than zero', () => {
    const summary = summariseProgress(data);
    expect(summary.exerciseMinutes).toBeUndefined();
    expect(summary.averageEffort).toBeUndefined();
    expect(summary.averageBackPain).toBeUndefined();
    expect(summary.averageSteps).toBeUndefined();
    expect(summary.daysLogged).toBe(0);
    expect(summary.steps.points).toEqual([]);
  });

  it('still shows the baseline body measurements as the first point', () => {
    const summary = summariseProgress(data);
    expect(summary.weightKg.points).toEqual([{ date: START, value: 69.9 }]);
    expect(summary.waistCm.latest?.value).toBe(76.2);
    expect(summary.restingHeartRateBpm.latest?.value).toBe(72);
    expect(summary.hrvMs.latest?.value).toBe(37);
  });

  it('keeps the baseline step average out of the steps series', () => {
    const summary = summariseProgress(data);
    expect(summary.baselineAverageDailySteps).toBe(3000);
    expect(summary.steps.points).toHaveLength(0);
  });
});

describe('summariseProgress aggregates', () => {
  beforeEach(() => {
    data.dailyLogs = [
      log('2026-08-13', {
        exercise: { completed: true, durationMinutes: 15, effort: 3, steps: 4000 },
        symptoms: { backPainBefore: 4, backPainAfter: 6 },
      }),
      log('2026-08-14', {
        exercise: { completed: true, durationMinutes: 10, steps: 5000 },
        symptoms: { backPainBefore: 3 },
      }),
      log('2026-08-15', { hydration: { glasses: 6 } }),
    ];
  });

  it('sums only recorded minutes', () => {
    expect(summariseProgress(data).exerciseMinutes).toBe(25);
  });

  it('averages effort over the days that recorded it', () => {
    // Only one day recorded effort. Averaging over three days would give 1.
    expect(summariseProgress(data).averageEffort).toBe(3);
  });

  it('averages back pain per day, then across days', () => {
    // Day 1 averages 4 and 6 to 5; day 2 has only 3. Mean of 5 and 3 is 4.
    expect(summariseProgress(data).averageBackPain).toBe(4);
  });

  it('builds the steps series from recorded days only', () => {
    const summary = summariseProgress(data);
    expect(summary.steps.points).toEqual([
      { date: '2026-08-13', value: 4000 },
      { date: '2026-08-14', value: 5000 },
    ]);
    expect(summary.averageSteps).toBe(4500);
  });

  it('counts days that hold any data at all', () => {
    expect(summariseProgress(data).daysLogged).toBe(3);
  });

  it('ignores an empty record', () => {
    data.dailyLogs.push(
      createEmptyDailyLog({ date: '2026-08-16' }, { now: NOW, makeId: sequentialIdFactory('e') }),
    );
    expect(summariseProgress(data).daysLogged).toBe(3);
  });
});

describe('body metric sources', () => {
  it('takes resting heart rate and HRV from the daily recovery log', () => {
    data.dailyLogs = [log('2026-08-14', { recovery: { restingHeartRateBpm: 70, hrvMs: 41 } })];
    const summary = summariseProgress(data);

    expect(summary.restingHeartRateBpm.points).toEqual([
      { date: START, value: 72 },
      { date: '2026-08-14', value: 70 },
    ]);
    expect(summary.hrvMs.latest?.value).toBe(41);
  });

  it('lets an explicit measurement override the recovery log for the same day', () => {
    data.dailyLogs = [log('2026-08-14', { recovery: { restingHeartRateBpm: 70 } })];
    data.measurements = [measurement('2026-08-14', { restingHeartRateBpm: 68 })];

    const summary = summariseProgress(data);
    expect(summary.restingHeartRateBpm.points).toEqual([
      { date: START, value: 72 },
      { date: '2026-08-14', value: 68 },
    ]);
  });

  it('extends weight and waist from later measurements', () => {
    data.measurements = [
      measurement('2026-09-13', { weightKg: 69.2, waistCm: 75.0 }),
      measurement('2026-10-13', { weightKg: 68.8 }),
    ];
    const summary = summariseProgress(data);

    expect(summary.weightKg.points).toHaveLength(3);
    expect(summary.weightKg.latest).toEqual({ date: '2026-10-13', value: 68.8 });
    expect(summary.weightKg.change).toBe(-1.1);
    expect(summary.waistCm.points).toHaveLength(2);
  });

  it('skips a measurement that recorded nothing for that metric', () => {
    data.measurements = [measurement('2026-09-13', { notes: 'forgot the tape measure' })];
    expect(summariseProgress(data).waistCm.points).toHaveLength(1);
  });
});

describe('windowing', () => {
  beforeEach(() => {
    data.dailyLogs = [
      log('2026-08-13', { exercise: { durationMinutes: 15 } }),
      log('2026-08-20', { exercise: { durationMinutes: 20 } }),
      log('2026-08-27', { exercise: { durationMinutes: 25 } }),
    ];
  });

  it('filters logs inclusively at both ends', () => {
    const inRange = logsInWindow(data.dailyLogs, { from: '2026-08-13', to: '2026-08-20' });
    expect(inRange.map((entry) => entry.date)).toEqual(['2026-08-13', '2026-08-20']);
  });

  it('restricts aggregates to the window', () => {
    const summary = summariseProgress(data, { from: '2026-08-14', to: '2026-08-26' });
    expect(summary.exerciseMinutes).toBe(20);
    expect(summary.daysLogged).toBe(1);
  });

  it('applies an open-ended window', () => {
    expect(summariseProgress(data, { from: '2026-08-20' }).exerciseMinutes).toBe(45);
    expect(summariseProgress(data, { to: '2026-08-20' }).exerciseMinutes).toBe(35);
  });

  it('excludes the baseline point when it falls outside the window', () => {
    const summary = summariseProgress(data, { from: '2026-08-20' });
    expect(summary.weightKg.points).toEqual([]);
    expect(summary.weightKg.latest).toBeUndefined();
  });
});
