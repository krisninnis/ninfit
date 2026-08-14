import { isDailyLogEmpty, isDayMarkedComplete } from './dailyLog';
import { compareISODate, isWithinRange } from './dates';
import type { AppData, DailyLog, ISODate } from './types';
import { roundTo } from './units';
import {
  isRestDay,
  programmeWeekNumber,
  resolveSessionForDate,
  summariseSessionCompletion,
  weekEndDate,
  weekStartDate,
} from './weeklyPlan';

/**
 * Aggregates for the Progress screen.
 *
 * The governing rule: a missing value stays missing. Nothing here substitutes a
 * zero for an absent reading, and an aggregate over no data is `undefined` rather
 * than `0`. A week with no recorded minutes has not recorded zero minutes.
 *
 * These are descriptive numbers only. Nothing in this module assesses, scores,
 * grades or interprets them.
 */

export interface MetricPoint {
  date: ISODate;
  value: number;
}

export interface MetricSeries {
  points: MetricPoint[];
  first?: MetricPoint;
  latest?: MetricPoint;
  /** latest - first. Undefined with fewer than two points. */
  change?: number;
}

export interface ProgressWindow {
  from?: ISODate;
  to?: ISODate;
}

/**
 * Ranges offered in v0.1. Deliberately two, and deliberately extensible: adding
 * '4_weeks' or '3_months' later means one more case here and one more button, with
 * no change to anything that consumes a window.
 */
export type ProgressRangeId = 'week' | 'all';

export function progressWindow(
  rangeId: ProgressRangeId,
  programmeStartDate: ISODate,
  today: ISODate,
): ProgressWindow {
  if (rangeId === 'all') return {};

  const weekNumber = programmeWeekNumber(programmeStartDate, today) ?? 1;
  return {
    from: weekStartDate(programmeStartDate, weekNumber),
    to: weekEndDate(programmeStartDate, weekNumber),
  };
}

/**
 * How many readings each aggregate rests on.
 *
 * Surfaced so the screen can say "over 3 days" rather than presenting an average of
 * three readings as though it were a settled fact.
 */
export interface ProgressSampleCounts {
  steps: number;
  exerciseMinutes: number;
  effort: number;
  backPain: number;
  sleep: number;
  energy: number;
  restingHeartRate: number;
  hrv: number;
  weight: number;
  waist: number;
}

/** Plain counts of what was recorded. No condition is named or assessed. */
export interface SymptomCounts {
  legPainDays: number;
  toeBetter: number;
  toeSame: number;
  toeWorse: number;
  daysWithSymptomRecord: number;
}

/**
 * Activity counts, with no denominator.
 *
 * Deliberately no "x% adherence": a rest day is not a shortfall, and a ratio invites
 * reading the week as a grade.
 */
export interface ActivityCounts {
  completedActivities: number;
  completeSessions: number;
  partialSessions: number;
  daysWithRecordedExercise: number;
  restDaysWithActivity: number;
}

export interface ProgressSummary {
  weightKg: MetricSeries;
  waistCm: MetricSeries;
  restingHeartRateBpm: MetricSeries;
  hrvMs: MetricSeries;
  steps: MetricSeries;
  /** Sum of recorded durations in the window. Undefined if none were recorded. */
  exerciseMinutes?: number;
  averageEffort?: number;
  /** Mean across days of that day's available back-pain readings. */
  averageBackPain?: number;
  averageSteps?: number;
  /**
   * The self-reported starting average from the baseline. Kept apart from the
   * steps series because it is an estimate of a typical day, not a day's reading.
   */
  baselineAverageDailySteps?: number;
  daysLogged: number;
  averageSleepHours?: number;
  averageEnergy?: number;
  sampleCounts: ProgressSampleCounts;
  symptoms: SymptomCounts;
  activity: ActivityCounts;
}

/** Rejects undefined, null, NaN, Infinity and non-numbers from imported data. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Mean of the finite values. Undefined when there are none. */
export function mean(values: readonly unknown[], decimalPlaces = 1): number | undefined {
  const numbers = values.filter(isFiniteNumber);
  if (numbers.length === 0) return undefined;
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return roundTo(total / numbers.length, decimalPlaces);
}

/** Sum of the finite values. Undefined when there are none. */
export function sum(values: readonly unknown[]): number | undefined {
  const numbers = values.filter(isFiniteNumber);
  if (numbers.length === 0) return undefined;
  return numbers.reduce((total, value) => total + value, 0);
}

export function buildSeries(points: readonly MetricPoint[]): MetricSeries {
  const sorted = [...points].sort((a, b) => compareISODate(a.date, b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  const series: MetricSeries = { points: sorted };
  if (first !== undefined) series.first = first;
  if (latest !== undefined) series.latest = latest;
  if (first !== undefined && latest !== undefined && sorted.length > 1) {
    series.change = roundTo(latest.value - first.value, 2);
  }
  return series;
}

function inWindow(date: ISODate, window: ProgressWindow): boolean {
  if (window.from !== undefined && window.to !== undefined) {
    return isWithinRange(date, window.from, window.to);
  }
  if (window.from !== undefined) return compareISODate(date, window.from) >= 0;
  if (window.to !== undefined) return compareISODate(date, window.to) <= 0;
  return true;
}

export function logsInWindow(
  logs: readonly DailyLog[],
  window: ProgressWindow = {},
): DailyLog[] {
  return logs
    .filter((log) => inWindow(log.date, window))
    .sort((a, b) => compareISODate(a.date, b.date));
}

/**
 * That day's representative back-pain reading: the mean of whichever of the
 * before and after values were recorded. Undefined when neither was.
 */
export function dailyBackPain(log: DailyLog): number | undefined {
  return mean([log.symptoms?.backPainBefore, log.symptoms?.backPainAfter]);
}

type BodyMetricKey = 'weightKg' | 'waistCm' | 'restingHeartRateBpm' | 'hrvMs';

/**
 * Body metrics come from three places. Where two sources report the same day, the
 * more deliberate one wins: an explicit Measurement beats the daily RecoveryLog,
 * which in turn beats the baseline.
 *
 * PROVISIONAL. This precedence is a rule for an all-manual world, where every source
 * is the same person typing. Once device-observed `MetricSample` data exists,
 * precedence must be redefined in terms of `DataSource.sourceType` rather than which
 * collection a value happens to live in - and a device value must take display
 * precedence without ever overwriting what the user entered.
 */
function collectBodyMetric(
  data: AppData,
  key: BodyMetricKey,
  window: ProgressWindow,
): MetricSeries {
  const byDate = new Map<ISODate, number>();

  const baselineValue = data.baseline[key];
  if (isFiniteNumber(baselineValue) && inWindow(data.baseline.recordedOn, window)) {
    byDate.set(data.baseline.recordedOn, baselineValue);
  }

  if (key === 'restingHeartRateBpm' || key === 'hrvMs') {
    for (const log of data.dailyLogs) {
      const value = log.recovery?.[key];
      if (isFiniteNumber(value) && inWindow(log.date, window)) {
        byDate.set(log.date, value);
      }
    }
  }

  for (const measurement of data.measurements) {
    const value = measurement[key];
    if (isFiniteNumber(value) && inWindow(measurement.recordedOn, window)) {
      byDate.set(measurement.recordedOn, value);
    }
  }

  return buildSeries([...byDate].map(([date, value]) => ({ date, value })));
}

function collectSteps(logs: readonly DailyLog[]): MetricSeries {
  const points: MetricPoint[] = [];
  for (const log of logs) {
    const value = log.exercise?.steps;
    if (isFiniteNumber(value)) points.push({ date: log.date, value });
  }
  return buildSeries(points);
}

function countRecorded(logs: readonly DailyLog[], read: (log: DailyLog) => unknown): number {
  return logs.filter((log) => isFiniteNumber(read(log))).length;
}

function countSymptoms(logs: readonly DailyLog[]): SymptomCounts {
  return {
    legPainDays: logs.filter((log) => log.symptoms?.legPain === true).length,
    toeBetter: logs.filter((log) => log.symptoms?.toeSensation === 'better').length,
    toeSame: logs.filter((log) => log.symptoms?.toeSensation === 'same').length,
    toeWorse: logs.filter((log) => log.symptoms?.toeSensation === 'worse').length,
    daysWithSymptomRecord: logs.filter(
      (log) => log.symptoms !== undefined && Object.keys(log.symptoms).length > 1,
    ).length,
  };
}

/**
 * Count what was done, against the plan each day was actually logged against.
 *
 * A rest day with activity is counted separately rather than folded in, so resting
 * never looks like a gap and an extra walk never looks like an obligation met.
 */
function countActivity(data: AppData, logs: readonly DailyLog[]): ActivityCounts {
  const startDate = data.profile.programmeStartDate;
  const counts: ActivityCounts = {
    completedActivities: 0,
    completeSessions: 0,
    partialSessions: 0,
    daysWithRecordedExercise: 0,
    restDaysWithActivity: 0,
  };

  for (const log of logs) {
    if (log.exercise !== undefined && Object.keys(log.exercise).length > 1) {
      counts.daysWithRecordedExercise += 1;
    }

    const resolved = resolveSessionForDate(data.weeklyPlans, startDate, log.date);
    const session = resolved?.session;

    if (isRestDay(session)) {
      if (isDayMarkedComplete(log)) counts.restDaysWithActivity += 1;
      continue;
    }

    const completion = summariseSessionCompletion(session, log);
    counts.completedActivities += completion.completedCount;
    if (completion.status === 'complete') counts.completeSessions += 1;
    else if (completion.status === 'partial') counts.partialSessions += 1;
  }

  return counts;
}

export function summariseProgress(
  data: AppData,
  window: ProgressWindow = {},
): ProgressSummary {
  const logs = logsInWindow(data.dailyLogs, window);
  const stepsSeries = collectSteps(logs);

  const weightSeries = collectBodyMetric(data, 'weightKg', window);
  const waistSeries = collectBodyMetric(data, 'waistCm', window);
  const rhrSeries = collectBodyMetric(data, 'restingHeartRateBpm', window);
  const hrvSeries = collectBodyMetric(data, 'hrvMs', window);

  const summary: ProgressSummary = {
    weightKg: weightSeries,
    waistCm: waistSeries,
    restingHeartRateBpm: rhrSeries,
    hrvMs: hrvSeries,
    steps: stepsSeries,
    daysLogged: logs.filter((log) => !isDailyLogEmpty(log)).length,
    sampleCounts: {
      steps: stepsSeries.points.length,
      exerciseMinutes: countRecorded(logs, (log) => log.exercise?.durationMinutes),
      effort: countRecorded(logs, (log) => log.exercise?.effort),
      backPain: logs.filter((log) => dailyBackPain(log) !== undefined).length,
      sleep: countRecorded(logs, (log) => log.recovery?.sleepHours),
      energy: countRecorded(logs, (log) => log.recovery?.energy),
      restingHeartRate: rhrSeries.points.length,
      hrv: hrvSeries.points.length,
      weight: weightSeries.points.length,
      waist: waistSeries.points.length,
    },
    symptoms: countSymptoms(logs),
    activity: countActivity(data, logs),
  };

  const sleep = mean(logs.map((log) => log.recovery?.sleepHours));
  if (sleep !== undefined) summary.averageSleepHours = sleep;

  const energy = mean(logs.map((log) => log.recovery?.energy));
  if (energy !== undefined) summary.averageEnergy = energy;

  const minutes = sum(logs.map((log) => log.exercise?.durationMinutes));
  if (minutes !== undefined) summary.exerciseMinutes = minutes;

  const effort = mean(logs.map((log) => log.exercise?.effort));
  if (effort !== undefined) summary.averageEffort = effort;

  const backPain = mean(logs.map((log) => dailyBackPain(log)));
  if (backPain !== undefined) summary.averageBackPain = backPain;

  const averageSteps = mean(stepsSeries.points.map((point) => point.value), 0);
  if (averageSteps !== undefined) summary.averageSteps = averageSteps;

  const baselineSteps = data.baseline.averageDailySteps;
  if (isFiniteNumber(baselineSteps)) summary.baselineAverageDailySteps = baselineSteps;

  return summary;
}
