import {
  dayIndexInWeek,
  isRestDay,
  plannedMinutes,
  programmeWeekNumber,
  resolveSessionForDate,
  summariseSessionCompletion,
  type SessionCompletion,
} from './weeklyPlan';
import type { DailyLog, ISODate, PlannedActivity, UUID, WeeklyPlan } from './types';

/**
 * What today looks like, resolved from the rolling programme.
 *
 * Pure and UI-free, so every "day 1 shows yoga and a walk" style question can be
 * answered in a plain Node test without rendering anything.
 */

export type TodayStatus =
  /** There is a session with activities. */
  | 'planned'
  /** There is a session, and it is deliberately empty. */
  | 'rest'
  /** The date is before the programme started. */
  | 'before_programme'
  /** Inside the programme, but no plan covers this week or day yet. */
  | 'no_plan';

export interface TodayView {
  date: ISODate;
  status: TodayStatus;
  /** Present whenever the date is on or after the programme start. */
  weekNumber?: number;
  dayIndex?: number;
  planId?: UUID;
  sessionId?: UUID;
  programmeVersion?: string;
  label?: string;
  activities: PlannedActivity[];
  /** Total planned minutes. 0 on a rest day. */
  plannedMinutes: number;
  targetEffortMin?: number;
  targetEffortMax?: number;
  sessionNote?: string;
}

/**
 * Resolve the day.
 *
 * Rolling weeks throughout: week and day are counted from the programme start date,
 * never from a Monday. A date with no plan is a calm, ordinary state - not an error -
 * so the caller gets a status to render rather than an exception to handle.
 */
export function resolveToday(
  plans: readonly WeeklyPlan[],
  programmeStartDate: ISODate,
  date: ISODate,
): TodayView {
  const weekNumber = programmeWeekNumber(programmeStartDate, date);
  const dayIndex = dayIndexInWeek(programmeStartDate, date);

  if (weekNumber === undefined || dayIndex === undefined) {
    return { date, status: 'before_programme', activities: [], plannedMinutes: 0 };
  }

  const resolved = resolveSessionForDate(plans, programmeStartDate, date);
  if (resolved === undefined) {
    return { date, status: 'no_plan', weekNumber, dayIndex, activities: [], plannedMinutes: 0 };
  }

  const { plan, session } = resolved;
  const view: TodayView = {
    date,
    status: isRestDay(session) ? 'rest' : 'planned',
    weekNumber,
    dayIndex,
    planId: plan.id,
    sessionId: session.id,
    programmeVersion: plan.programmeVersion,
    activities: session.activities,
    plannedMinutes: plannedMinutes(session),
    targetEffortMin: plan.targetEffortMin,
    targetEffortMax: plan.targetEffortMax,
  };
  if (plan.label !== undefined) view.label = plan.label;
  if (session.note !== undefined) view.sessionNote = session.note;
  return view;
}

/**
 * Completion for the day the view describes.
 *
 * The mapping matters and is easy to get wrong: a rest day is a session that exists
 * and happens to be empty, whereas an unplanned day has NO session at all. Passing an
 * empty session for an unplanned day would report it as a rest day, so the distinction
 * is made here once rather than at each call site.
 */
export function todaySessionCompletion(
  view: TodayView,
  log: DailyLog | undefined,
): SessionCompletion {
  if (view.status === 'planned' || view.status === 'rest') {
    return summariseSessionCompletion(
      {
        id: view.sessionId ?? 'session',
        dayIndex: view.dayIndex ?? 1,
        activities: view.activities,
      },
      log,
    );
  }
  return summariseSessionCompletion(undefined, log);
}

/** Activities that carry a link to third-party instructional content. */
export function activitiesWithExternalContent(view: TodayView): PlannedActivity[] {
  return view.activities.filter((activity) => activity.externalUrl !== undefined);
}
