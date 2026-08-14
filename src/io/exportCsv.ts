import {
  completedActivityIds,
  isDayMarkedComplete,
  isRestDayAcknowledged,
  usesLegacyCompletion,
} from '../domain/dailyLog';
import { todayISO } from '../domain/dates';
import type { AppData, DailyLog, ISODate, PlannedActivity } from '../domain/types';
import {
  dayIndexInWeek,
  isRestDay,
  programmeWeekNumber,
  resolveSessionForDate,
  summariseSessionCompletion,
} from '../domain/weeklyPlan';
import type { DownloadableFile } from './download';

/**
 * The daily CSV: one row per recorded day, for spreadsheets and analysis.
 *
 * This is NOT a backup. It is a flattened, lossy view aimed at fitness analysis, and
 * the Data screen says so. Game state deliberately stays out of it: XP and trophies
 * are not daily fitness facts, and forcing them into every row would only make the
 * sheet harder to read. The JSON backup carries them.
 *
 * The rule that matters most here: MISSING STAYS EMPTY. An unrecorded step count is
 * an empty cell, never a zero, because a spreadsheet cannot tell the difference once
 * we have lied about it.
 */

export const CSV_MIME_TYPE = 'text/csv';

/**
 * Excel on Windows assumes the system codepage for a .csv without a byte order mark,
 * which mangles anything non-ASCII in a note. The BOM is three bytes and fixes it;
 * every other tool tolerates it.
 */
export const UTF8_BOM = '﻿';

export const CSV_COLUMNS = [
  'date',
  'programme_week',
  'programme_day',
  'day_type',
  'planned_activities',
  'planned_minutes',
  'completed_activities',
  'session_state',
  'rest_day_acknowledged',
  'actual_activity',
  'minutes',
  'effort',
  'steps',
  'back_before',
  'back_after',
  'leg_pain',
  'toe_sensation',
  'fruit_before_midday',
  'protein_main_meal',
  'gousto',
  'fruit_veg_servings',
  'hydration_glasses',
  'sleep_hours',
  'energy',
  'resting_hr',
  'hrv',
  'exercise_notes',
  'symptom_notes',
  'nutrition_notes',
  'hydration_notes',
  'recovery_notes',
] as const;

/**
 * Escape one cell.
 *
 * A field is quoted when it contains a comma, a quote, a newline or leading/trailing
 * space, and inner quotes are doubled. `undefined` becomes an empty cell; `false`
 * and `0` are written out, because they are real answers.
 */
export function csvCell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';

  const text = typeof value === 'string' ? value : String(value);
  if (text === '') return '';

  const needsQuoting = /[",\r\n]/.test(text) || text !== text.trim();
  if (!needsQuoting) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(cells: ReadonlyArray<string | number | boolean | undefined | null>): string {
  return cells.map(csvCell).join(',');
}

function activityNames(activities: readonly PlannedActivity[]): string {
  return activities.map((activity) => `${activity.label} (${activity.durationMinutes}m)`).join('; ');
}

function completedNames(
  activities: readonly PlannedActivity[],
  log: DailyLog,
): string {
  if (usesLegacyCompletion(log)) {
    const completion = summariseSessionCompletion(
      { id: 'x', dayIndex: 1, activities: [...activities] },
      log,
    );
    return completion.status === 'complete' ? activityNames(activities) : '';
  }
  const ticked = completedActivityIds(log);
  return activityNames(activities.filter((activity) => ticked.includes(activity.id)));
}

function buildRow(data: AppData, log: DailyLog): string {
  const start = data.profile.programmeStartDate;
  const resolved = resolveSessionForDate(data.weeklyPlans, start, log.date);
  const session = resolved?.session;
  const activities = session?.activities ?? [];
  const rest = isRestDay(session);
  const completion = summariseSessionCompletion(session, log);

  const exercise = log.exercise;
  const symptoms = log.symptoms;
  const nutrition = log.nutrition;
  const hydration = log.hydration;
  const recovery = log.recovery;

  return csvRow([
    log.date,
    programmeWeekNumber(start, log.date),
    dayIndexInWeek(start, log.date),
    rest ? 'rest' : session === undefined ? 'unplanned' : 'session',
    activityNames(activities),
    activities.length > 0
      ? activities.reduce((total, activity) => total + activity.durationMinutes, 0)
      : undefined,
    completedNames(activities, log),
    completion.status,
    // Three distinct states: true, false, or never answered.
    exercise?.restDayAcknowledged,
    exercise?.actualActivity,
    exercise?.durationMinutes,
    exercise?.effort,
    exercise?.steps,
    symptoms?.backPainBefore,
    symptoms?.backPainAfter,
    symptoms?.legPain,
    symptoms?.toeSensation,
    nutrition?.morningFruit,
    nutrition?.proteinMainMeal,
    nutrition?.goustoMeal,
    nutrition?.fruitVegServings,
    hydration?.glasses,
    recovery?.sleepHours,
    recovery?.energy,
    recovery?.restingHeartRateBpm,
    recovery?.hrvMs,
    exercise?.notes,
    symptoms?.notes,
    nutrition?.snackNote,
    hydration?.extraFluidNote,
    recovery?.notes,
  ]);
}

export function dailyCsvFilename(date: ISODate = todayISO()): string {
  return `fitness-tracker-daily-${date}.csv`;
}

/** Days ascending, so the sheet reads like a diary. */
export function buildDailyCsv(
  data: AppData,
  options: { today?: ISODate } = {},
): DownloadableFile {
  const logs = [...data.dailyLogs].sort((a, b) => (a.date < b.date ? -1 : 1));

  const lines = [csvRow([...CSV_COLUMNS]), ...logs.map((log) => buildRow(data, log))];

  return {
    filename: dailyCsvFilename(options.today ?? todayISO()),
    mimeType: CSV_MIME_TYPE,
    contents: UTF8_BOM + lines.join('\r\n') + '\r\n',
  };
}

/** Exported for tests: the day-level flag, kept out of the row builder's way. */
export function restDayActivityRecorded(log: DailyLog): boolean {
  return isDayMarkedComplete(log);
}

export function restDayFollowed(log: DailyLog): boolean {
  return isRestDayAcknowledged(log);
}
