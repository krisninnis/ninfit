import {
  completedActivityIds,
  isDailyLogEmpty,
  isDayMarkedComplete,
  isRestDayAcknowledged,
  symptomFlags,
  type SymptomFlag,
} from './dailyLog';
import { compareISODate } from './dates';
import { mean, sum } from './progress';
import type { DailyLog, ISODate, PlannedActivity, WeeklyPlan } from './types';
import {
  findWeeklyPlan,
  isRestDay,
  plannedMinutes,
  rollingWeekDates,
  sessionForDayIndex,
  summariseSessionCompletion,
  weekEndDate,
  weekStartDate,
  type SessionCompletion,
} from './weeklyPlan';

/**
 * The week, as a set of facts.
 *
 * Pure and UI-free. Everything here is either something the user recorded or a plain
 * count of those recordings. There is no score, no grade, no percentage of a target,
 * and nothing that could be read as an assessment.
 *
 * The two rules that shape the aggregates:
 *   - A day with no reading contributes nothing. It is never counted as a zero.
 *   - An aggregate over no readings at all is `undefined`, so the screen can say
 *     "nothing recorded yet" rather than print a number nobody entered.
 */

export type DayState =
  /** Every planned activity ticked. */
  | 'complete'
  /** Some, but not all, ticked. */
  | 'partial'
  /** Nothing ticked yet. Not a failure. */
  | 'not_yet'
  /** A planned rest day. Intentional, never a gap. */
  | 'rest'
  /** Still to come. Cannot be behind. */
  | 'future'
  /** No plan covers this day. */
  | 'unplanned';

export interface WeekDayActivity {
  activity: PlannedActivity;
  completed: boolean;
}

export interface WeekDay {
  date: ISODate;
  /** 1-7 within the rolling week. */
  dayIndex: number;
  isToday: boolean;
  state: DayState;
  activities: WeekDayActivity[];
  completion: SessionCompletion;
  plannedMinutes: number;

  /** Everything below is present only where the user actually recorded it. */
  recordedMinutes?: number;
  effort?: number;
  steps?: number;
  backPainBefore?: number;
  backPainAfter?: number;
  symptomFlags: SymptomFlag[];
  glasses?: number;
  morningFruit?: boolean;
  proteinMainMeal?: boolean;
  goustoMeal?: boolean;
  fruitVegServings?: number;
  sleepHours?: number;
  energy?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;

  /** True when the day holds anything at all. */
  hasRecord: boolean;
  /** Activity recorded on a planned rest day. Shown as a fact; the day stays rest. */
  unplannedRestDayActivity: boolean;
  /**
   * The user said they followed the planned rest. Distinct from doing something
   * active anyway, and its absence is never a shortfall.
   */
  restDayAcknowledged: boolean;
}

export interface WeekSummary {
  daysLogged: number;
  plannedActivities: number;
  completedActivities: number;
  completeSessions: number;
  partialSessions: number;
  restDays: number;

  /** Undefined when no duration was recorded all week, rather than 0. */
  exerciseMinutes?: number;
  /** Averaged over the days that recorded steps only. */
  averageSteps?: number;
  stepDaysRecorded: number;
  averageEffort?: number;
  averageBackPainBefore?: number;
  averageBackPainAfter?: number;
  averageGlasses?: number;
  hydrationDaysRecorded: number;
  /** Counts of the three distinct states for the Week 1 fruit target. */
  fruitTargetYes: number;
  fruitTargetNo: number;
  averageSleepHours?: number;
  averageEnergy?: number;
  averageRestingHeartRateBpm?: number;
  averageHrvMs?: number;
}

export interface WeekView {
  weekNumber: number;
  startDate: ISODate;
  endDate: ISODate;
  /** False when no plan covers this week. The days still render, calmly. */
  hasPlan: boolean;
  label?: string;
  programmeVersion?: string;
  targetEffortMin?: number;
  targetEffortMax?: number;
  days: WeekDay[];
  summary: WeekSummary;
}

function stateFor(
  isRest: boolean,
  isFuture: boolean,
  hasSession: boolean,
  completion: SessionCompletion,
): DayState {
  // Rest is checked first: a rest day that has not happened yet is still a rest day,
  // not a pending obligation.
  if (isRest) return 'rest';
  if (!hasSession) return 'unplanned';
  if (isFuture) return 'future';
  if (completion.status === 'complete') return 'complete';
  if (completion.status === 'partial') return 'partial';
  return 'not_yet';
}

function buildDay(
  date: ISODate,
  dayIndex: number,
  plan: WeeklyPlan | undefined,
  log: DailyLog | undefined,
  today: ISODate,
): WeekDay {
  const session = plan === undefined ? undefined : sessionForDayIndex(plan, dayIndex);
  const rest = isRestDay(session);
  const isFuture = compareISODate(date, today) > 0;
  const completion = summariseSessionCompletion(session, log);
  const ticked = completedActivityIds(log);

  const activities: WeekDayActivity[] = (session?.activities ?? []).map((activity) => ({
    activity,
    // A legacy record has no per-activity detail, so a completed legacy day shows all
    // of its activities as done rather than pretending none were.
    completed:
      completion.status === 'complete' && ticked.length === 0
        ? true
        : ticked.includes(activity.id),
  }));

  const day: WeekDay = {
    date,
    dayIndex,
    isToday: date === today,
    state: stateFor(rest, isFuture, session !== undefined, completion),
    activities,
    completion,
    plannedMinutes: plannedMinutes(session),
    symptomFlags: symptomFlags(log),
    hasRecord: log !== undefined && !isDailyLogEmpty(log),
    unplannedRestDayActivity: rest && isDayMarkedComplete(log),
    restDayAcknowledged: rest && isRestDayAcknowledged(log),
  };

  const assign = <K extends keyof WeekDay>(key: K, value: WeekDay[K] | undefined) => {
    if (value !== undefined) day[key] = value;
  };

  assign('recordedMinutes', log?.exercise?.durationMinutes);
  assign('effort', log?.exercise?.effort);
  assign('steps', log?.exercise?.steps);
  assign('backPainBefore', log?.symptoms?.backPainBefore);
  assign('backPainAfter', log?.symptoms?.backPainAfter);
  assign('glasses', log?.hydration?.glasses);
  assign('morningFruit', log?.nutrition?.morningFruit);
  assign('proteinMainMeal', log?.nutrition?.proteinMainMeal);
  assign('goustoMeal', log?.nutrition?.goustoMeal);
  assign('fruitVegServings', log?.nutrition?.fruitVegServings);
  assign('sleepHours', log?.recovery?.sleepHours);
  assign('energy', log?.recovery?.energy);
  assign('restingHeartRateBpm', log?.recovery?.restingHeartRateBpm);
  assign('hrvMs', log?.recovery?.hrvMs);

  return day;
}

function summarise(days: readonly WeekDay[]): WeekSummary {
  const stepDays = days.filter((day) => day.steps !== undefined);
  const hydrationDays = days.filter((day) => day.glasses !== undefined);

  const summary: WeekSummary = {
    daysLogged: days.filter((day) => day.hasRecord).length,
    plannedActivities: days.reduce((total, day) => total + day.activities.length, 0),
    completedActivities: days.reduce(
      (total, day) => total + day.activities.filter((entry) => entry.completed).length,
      0,
    ),
    completeSessions: days.filter((day) => day.state === 'complete').length,
    partialSessions: days.filter((day) => day.state === 'partial').length,
    restDays: days.filter((day) => day.state === 'rest').length,
    stepDaysRecorded: stepDays.length,
    hydrationDaysRecorded: hydrationDays.length,
    fruitTargetYes: days.filter((day) => day.morningFruit === true).length,
    fruitTargetNo: days.filter((day) => day.morningFruit === false).length,
  };

  const optional: Array<[keyof WeekSummary, number | undefined]> = [
    ['exerciseMinutes', sum(days.map((day) => day.recordedMinutes))],
    ['averageSteps', mean(stepDays.map((day) => day.steps), 0)],
    ['averageEffort', mean(days.map((day) => day.effort))],
    ['averageBackPainBefore', mean(days.map((day) => day.backPainBefore))],
    ['averageBackPainAfter', mean(days.map((day) => day.backPainAfter))],
    ['averageGlasses', mean(hydrationDays.map((day) => day.glasses))],
    ['averageSleepHours', mean(days.map((day) => day.sleepHours))],
    ['averageEnergy', mean(days.map((day) => day.energy))],
    ['averageRestingHeartRateBpm', mean(days.map((day) => day.restingHeartRateBpm), 0)],
    ['averageHrvMs', mean(days.map((day) => day.hrvMs), 0)],
  ];

  // Optional aggregates are assigned only when they have a value, so "no readings"
  // stays absent rather than becoming a zero.
  const writable = summary as unknown as Record<string, number>;
  for (const [key, value] of optional) {
    if (value !== undefined) writable[key] = value;
  }

  return summary;
}

/**
 * Assemble one rolling week.
 *
 * Days come from the programme start date, never from a Monday, so week 1 of a
 * programme begun on a Thursday runs Thursday to Wednesday.
 */
export function buildWeekView(
  plans: readonly WeeklyPlan[],
  programmeStartDate: ISODate,
  weekNumber: number,
  logs: readonly DailyLog[],
  today: ISODate,
): WeekView {
  const plan = findWeeklyPlan(plans, weekNumber);
  const dates = rollingWeekDates(programmeStartDate, weekNumber);
  const logsByDate = new Map(logs.map((log) => [log.date, log]));

  const days = dates.map((date, offset) =>
    buildDay(date, offset + 1, plan, logsByDate.get(date), today),
  );

  const view: WeekView = {
    weekNumber,
    startDate: weekStartDate(programmeStartDate, weekNumber),
    endDate: weekEndDate(programmeStartDate, weekNumber),
    hasPlan: plan !== undefined,
    days,
    summary: summarise(days),
  };

  if (plan?.label !== undefined) view.label = plan.label;
  if (plan !== undefined) {
    view.programmeVersion = plan.programmeVersion;
    view.targetEffortMin = plan.targetEffortMin;
    view.targetEffortMax = plan.targetEffortMax;
  }
  return view;
}
