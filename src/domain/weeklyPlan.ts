import {
  completedActivityIds,
  isDailyLogEmpty,
  isDayMarkedComplete,
  usesLegacyCompletion,
} from './dailyLog';
import { addDays, differenceInDays, isValidISODate, nowTimestamp } from './dates';
import { newId, type IdFactory } from './ids';
import type {
  ActivityIntensity,
  ActivityType,
  DailyLog,
  ExternalContentProvider,
  ISODate,
  ISODateTime,
  PlannedActivity,
  PlannedSession,
  WeeklyPlan,
} from './types';

/**
 * Rolling programme weeks.
 *
 * Week N runs from `programmeStartDate + (N-1)*7` for seven days. There is no
 * Monday-to-Sunday concept anywhere in this module: if the programme starts on a
 * Thursday, every week of it starts on a Thursday.
 */

export const DAYS_PER_WEEK = 7;

export interface CreateActivityInput {
  type: ActivityType;
  label: string;
  durationMinutes: number;
  intensity?: ActivityIntensity;
  externalUrl?: string;
  externalLabel?: string;
  provider?: ExternalContentProvider;
}

export interface CreateSessionInput {
  dayIndex: number;
  activities?: CreateActivityInput[];
  note?: string;
}

export interface CreateWeeklyPlanInput {
  programmeVersion: string;
  weekNumber: number;
  startDate: ISODate;
  label?: string;
  targetEffortMin: number;
  targetEffortMax: number;
  sessions: CreateSessionInput[];
}

export interface PlanOptions {
  now?: ISODateTime;
  makeId?: IdFactory;
}

export function createPlannedActivity(
  input: CreateActivityInput,
  makeId: IdFactory = newId,
): PlannedActivity {
  const activity: PlannedActivity = {
    id: makeId(),
    type: input.type,
    label: input.label,
    durationMinutes: input.durationMinutes,
    intensity: input.intensity ?? 'very_light',
  };
  // Optional link fields are only written when supplied, so activities without
  // linked content stay free of empty keys.
  if (input.externalUrl !== undefined) activity.externalUrl = input.externalUrl;
  if (input.externalLabel !== undefined) activity.externalLabel = input.externalLabel;
  if (input.provider !== undefined) activity.provider = input.provider;
  return activity;
}

export function createWeeklyPlan(
  input: CreateWeeklyPlanInput,
  options: PlanOptions = {},
): WeeklyPlan {
  if (!isValidISODate(input.startDate)) {
    throw new Error(`Invalid plan start date: ${JSON.stringify(input.startDate)}`);
  }
  const makeId = options.makeId ?? newId;

  const sessions: PlannedSession[] = input.sessions.map((session) => {
    if (session.dayIndex < 1 || session.dayIndex > DAYS_PER_WEEK) {
      throw new Error(`Session dayIndex must be 1-${DAYS_PER_WEEK}, got ${session.dayIndex}`);
    }
    const planned: PlannedSession = {
      id: makeId(),
      dayIndex: session.dayIndex,
      activities: (session.activities ?? []).map((activity) =>
        createPlannedActivity(activity, makeId),
      ),
    };
    if (session.note !== undefined) planned.note = session.note;
    return planned;
  });

  const plan: WeeklyPlan = {
    id: makeId(),
    programmeVersion: input.programmeVersion,
    weekNumber: input.weekNumber,
    startDate: input.startDate,
    targetEffortMin: input.targetEffortMin,
    targetEffortMax: input.targetEffortMax,
    sessions,
    createdAt: options.now ?? nowTimestamp(),
  };
  if (input.label !== undefined) plan.label = input.label;
  return plan;
}

// --- Position within the programme ----------------------------------------

/** 1-based day of the programme. Undefined before the start date. */
export function programmeDayNumber(
  programmeStartDate: ISODate,
  date: ISODate,
): number | undefined {
  const offset = differenceInDays(programmeStartDate, date);
  return offset < 0 ? undefined : offset + 1;
}

/** 1-based rolling week. Undefined before the start date. */
export function programmeWeekNumber(
  programmeStartDate: ISODate,
  date: ISODate,
): number | undefined {
  const day = programmeDayNumber(programmeStartDate, date);
  return day === undefined ? undefined : Math.floor((day - 1) / DAYS_PER_WEEK) + 1;
}

/** 1-7 within the rolling week. Undefined before the start date. */
export function dayIndexInWeek(
  programmeStartDate: ISODate,
  date: ISODate,
): number | undefined {
  const day = programmeDayNumber(programmeStartDate, date);
  return day === undefined ? undefined : ((day - 1) % DAYS_PER_WEEK) + 1;
}

export function weekStartDate(programmeStartDate: ISODate, weekNumber: number): ISODate {
  if (weekNumber < 1) throw new Error(`Week number must be 1 or greater, got ${weekNumber}`);
  return addDays(programmeStartDate, (weekNumber - 1) * DAYS_PER_WEEK);
}

export function weekEndDate(programmeStartDate: ISODate, weekNumber: number): ISODate {
  return addDays(weekStartDate(programmeStartDate, weekNumber), DAYS_PER_WEEK - 1);
}

/** The seven day keys of a rolling week, in order. */
export function rollingWeekDates(
  programmeStartDate: ISODate,
  weekNumber: number,
): ISODate[] {
  const start = weekStartDate(programmeStartDate, weekNumber);
  return Array.from({ length: DAYS_PER_WEEK }, (_unused, offset) => addDays(start, offset));
}

// --- Resolving plans and sessions -----------------------------------------

export function findWeeklyPlan(
  plans: readonly WeeklyPlan[],
  weekNumber: number,
): WeeklyPlan | undefined {
  return plans.find((plan) => plan.weekNumber === weekNumber);
}

export function sessionForDayIndex(
  plan: WeeklyPlan,
  dayIndex: number,
): PlannedSession | undefined {
  return plan.sessions.find((session) => session.dayIndex === dayIndex);
}

export interface ResolvedSession {
  plan: WeeklyPlan;
  session: PlannedSession;
  weekNumber: number;
  dayIndex: number;
}

/** What is planned for a given date, if anything is. */
export function resolveSessionForDate(
  plans: readonly WeeklyPlan[],
  programmeStartDate: ISODate,
  date: ISODate,
): ResolvedSession | undefined {
  const weekNumber = programmeWeekNumber(programmeStartDate, date);
  const dayIndex = dayIndexInWeek(programmeStartDate, date);
  if (weekNumber === undefined || dayIndex === undefined) return undefined;

  const plan = findWeeklyPlan(plans, weekNumber);
  if (plan === undefined) return undefined;

  const session = sessionForDayIndex(plan, dayIndex);
  if (session === undefined) return undefined;

  return { plan, session, weekNumber, dayIndex };
}

/** A session with no activities is a rest day. */
export function isRestDay(session: PlannedSession | undefined): boolean {
  return session !== undefined && session.activities.length === 0;
}

export function plannedMinutes(session: PlannedSession | undefined): number {
  if (session === undefined) return 0;
  return session.activities.reduce((total, activity) => total + activity.durationMinutes, 0);
}

export function plannedActivityLabels(session: PlannedSession | undefined): string[] {
  if (session === undefined) return [];
  return session.activities.map(
    (activity) => `${activity.durationMinutes}-minute ${activity.label}`,
  );
}

// --- Session completion ----------------------------------------------------

export type SessionCompletionStatus =
  /** A planned rest day. Complete by definition; resting is the activity. */
  | 'rest'
  /** Every planned activity ticked. */
  | 'complete'
  /** At least one, but not all, ticked. */
  | 'partial'
  /** None ticked yet. Not a failure, just not yet. */
  | 'not_yet'
  /** No plan covers this day, and the user has not said they did anything. */
  | 'unplanned';

export interface SessionCompletion {
  status: SessionCompletionStatus;
  completedCount: number;
  plannedCount: number;
}

/**
 * THE single source of truth for "was today's session completed".
 *
 * Precedence, in order:
 *   1. A planned rest day is 'rest'. There is nothing to tick and nothing missing.
 *   2. With planned activities, the answer is derived from `completedActivityIds`.
 *   3. With planned activities but a record predating that field, the day-level
 *      `completed` flag is honoured so old records keep their meaning.
 *   4. With no planned activities, the day-level flag is the answer.
 *
 * Symptoms are not consulted at any point. A session with every activity ticked stays
 * complete however the body responded.
 */
export function summariseSessionCompletion(
  session: PlannedSession | undefined,
  log: DailyLog | undefined,
): SessionCompletion {
  if (isRestDay(session)) {
    return { status: 'rest', completedCount: 0, plannedCount: 0 };
  }

  const activities = session?.activities ?? [];

  if (activities.length === 0) {
    // No plan for this day. The day-level flag is the only thing that can speak.
    return isDayMarkedComplete(log)
      ? { status: 'complete', completedCount: 1, plannedCount: 0 }
      : { status: 'unplanned', completedCount: 0, plannedCount: 0 };
  }

  if (usesLegacyCompletion(log)) {
    return isDayMarkedComplete(log)
      ? { status: 'complete', completedCount: activities.length, plannedCount: activities.length }
      : { status: 'not_yet', completedCount: 0, plannedCount: activities.length };
  }

  const ticked = completedActivityIds(log);
  const completedCount = activities.filter((activity) => ticked.includes(activity.id)).length;

  const status: SessionCompletionStatus =
    completedCount === 0
      ? 'not_yet'
      : completedCount === activities.length
        ? 'complete'
        : 'partial';

  return { status, completedCount, plannedCount: activities.length };
}

// --- Completion ------------------------------------------------------------

export interface WeekCompletion {
  weekNumber: number;
  startDate: ISODate;
  endDate: ISODate;
  /** Non-rest days in the plan. */
  plannedSessions: number;
  restDays: number;
  /** Planned days where every activity was completed. Symptoms play no part in this. */
  completedPlannedSessions: number;
  /** Planned days where some, but not all, activities were completed. */
  partiallyCompletedSessions: number;
  /** Activity recorded on a planned rest day. Recorded, not judged. */
  completedRestDays: number;
  /** Days with any data at all in any section. */
  loggedDays: number;
  /** Undefined when no duration was recorded all week, rather than 0. */
  totalExerciseMinutes: number | undefined;
}

/**
 * Counts for one rolling week.
 *
 * Completion is derived purely from `exercise.completed`. Worse back, leg or toe
 * symptoms never reduce these numbers.
 */
export function weekCompletion(
  plan: WeeklyPlan,
  logs: readonly DailyLog[],
  programmeStartDate: ISODate,
): WeekCompletion {
  const dates = rollingWeekDates(programmeStartDate, plan.weekNumber);
  const logsByDate = new Map(logs.map((log) => [log.date, log]));

  let plannedSessions = 0;
  let restDays = 0;
  let completedPlannedSessions = 0;
  let partiallyCompletedSessions = 0;
  let completedRestDays = 0;
  let loggedDays = 0;
  let minutesTotal = 0;
  let minutesRecorded = false;

  dates.forEach((date, offset) => {
    const dayIndex = offset + 1;
    const session = sessionForDayIndex(plan, dayIndex);
    const rest = isRestDay(session);

    if (session !== undefined) {
      if (rest) restDays += 1;
      else plannedSessions += 1;
    }

    const log = logsByDate.get(date);
    if (log === undefined) return;

    // An empty record is not a logged day.
    if (!isDailyLogEmpty(log)) loggedDays += 1;

    if (rest) {
      // Activity on a rest day is recorded, not judged, and never counted as a missed
      // session.
      if (isDayMarkedComplete(log)) completedRestDays += 1;
    } else {
      const completion = summariseSessionCompletion(session, log);
      if (completion.status === 'complete') completedPlannedSessions += 1;
      else if (completion.status === 'partial') partiallyCompletedSessions += 1;
    }

    const minutes = log.exercise?.durationMinutes;
    if (typeof minutes === 'number' && Number.isFinite(minutes)) {
      minutesTotal += minutes;
      minutesRecorded = true;
    }
  });

  const startDate = dates[0] ?? plan.startDate;
  const endDate = dates[dates.length - 1] ?? plan.startDate;

  return {
    weekNumber: plan.weekNumber,
    startDate,
    endDate,
    plannedSessions,
    restDays,
    completedPlannedSessions,
    partiallyCompletedSessions,
    completedRestDays,
    loggedDays,
    totalExerciseMinutes: minutesRecorded ? minutesTotal : undefined,
  };
}
