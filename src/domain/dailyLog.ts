import { isValidISODate, nowTimestamp } from './dates';
import { newId, type IdFactory } from './ids';
import {
  DAILY_LOG_SECTIONS,
  type DailyLog,
  type DailyLogSection,
  type ExerciseLog,
  type HydrationLog,
  type ISODate,
  type ISODateTime,
  type NutritionLog,
  type RecoveryLog,
  type SymptomLog,
  type UUID,
} from './types';

/**
 * Creating and updating a day's record.
 *
 * Two invariants matter more than anything else here:
 *
 *  1. A partial update touches only the fields it names. Absent keys are left
 *     exactly as they were; a key present with the value `undefined` clears that
 *     one field. Nothing is ever defaulted to zero on the way through.
 *
 *  2. Exercise completion is independent of symptom outcome. Completion is read from
 *     `completedActivityIds` (or, for days with no plan, `completed`) and from nothing
 *     else. A day can be completed and have worse symptoms at the same time, and that
 *     is not a contradiction.
 */

export interface DomainOptions {
  now?: ISODateTime;
  makeId?: IdFactory;
}

type SectionPatch<T extends { id: UUID }> = Partial<Omit<T, 'id'>>;

export interface DailyLogUpdate {
  weeklyPlanId?: UUID;
  plannedSessionId?: UUID;
  exercise?: SectionPatch<ExerciseLog>;
  symptoms?: SectionPatch<SymptomLog>;
  nutrition?: SectionPatch<NutritionLog>;
  hydration?: SectionPatch<HydrationLog>;
  recovery?: SectionPatch<RecoveryLog>;
}

export interface CreateDailyLogInput {
  date: ISODate;
  weeklyPlanId?: UUID;
  plannedSessionId?: UUID;
}

export function createEmptyDailyLog(
  input: CreateDailyLogInput,
  options: DomainOptions = {},
): DailyLog {
  if (!isValidISODate(input.date)) {
    throw new Error(`Invalid daily log date: ${JSON.stringify(input.date)}`);
  }
  const timestamp = options.now ?? nowTimestamp();
  const makeId = options.makeId ?? newId;

  const log: DailyLog = {
    id: makeId(),
    date: input.date,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (input.weeklyPlanId !== undefined) log.weeklyPlanId = input.weeklyPlanId;
  if (input.plannedSessionId !== undefined) log.plannedSessionId = input.plannedSessionId;
  return log;
}

function mergeSection<T extends { id: UUID }>(
  existing: T | undefined,
  patch: SectionPatch<T> | undefined,
  makeId: IdFactory,
): T | undefined {
  if (patch === undefined) return existing;

  const keys = Object.keys(patch);
  if (keys.length === 0) return existing;

  const source = patch as Record<string, unknown>;
  const next = { ...(existing ?? { id: makeId() }) } as Record<string, unknown>;

  for (const key of keys) {
    if (source[key] === undefined) {
      delete next[key];
    } else {
      next[key] = source[key];
    }
  }

  return next as T;
}

/**
 * Returns a new `DailyLog` with the update applied. The input is never mutated.
 * `updatedAt` moves only when the update actually names something.
 */
export function applyDailyLogUpdate(
  log: DailyLog,
  update: DailyLogUpdate,
  options: DomainOptions = {},
): DailyLog {
  const makeId = options.makeId ?? newId;
  const touchedKeys = Object.keys(update);
  if (touchedKeys.length === 0) return log;

  const next: DailyLog = { ...log };

  if ('weeklyPlanId' in update) {
    if (update.weeklyPlanId === undefined) delete next.weeklyPlanId;
    else next.weeklyPlanId = update.weeklyPlanId;
  }
  if ('plannedSessionId' in update) {
    if (update.plannedSessionId === undefined) delete next.plannedSessionId;
    else next.plannedSessionId = update.plannedSessionId;
  }

  const exercise = mergeSection<ExerciseLog>(log.exercise, update.exercise, makeId);
  const symptoms = mergeSection<SymptomLog>(log.symptoms, update.symptoms, makeId);
  const nutrition = mergeSection<NutritionLog>(log.nutrition, update.nutrition, makeId);
  const hydration = mergeSection<HydrationLog>(log.hydration, update.hydration, makeId);
  const recovery = mergeSection<RecoveryLog>(log.recovery, update.recovery, makeId);

  if (exercise !== undefined) next.exercise = exercise;
  if (symptoms !== undefined) next.symptoms = symptoms;
  if (nutrition !== undefined) next.nutrition = nutrition;
  if (hydration !== undefined) next.hydration = hydration;
  if (recovery !== undefined) next.recovery = recovery;

  next.updatedAt = options.now ?? nowTimestamp();
  return next;
}

/** True when a section holds nothing but its id. */
export function isSectionEmpty(section: { id: UUID } | undefined): boolean {
  if (section === undefined) return true;
  return Object.entries(section).every(
    ([key, value]) => key === 'id' || value === undefined,
  );
}

export function filledSections(log: DailyLog): DailyLogSection[] {
  return DAILY_LOG_SECTIONS.filter((section) => !isSectionEmpty(log[section]));
}

export function isDailyLogEmpty(log: DailyLog): boolean {
  return filledSections(log).length === 0;
}

export interface DailyLogCompletion {
  filled: number;
  total: number;
  sections: DailyLogSection[];
}

/**
 * How much of the day has been touched. Purely informational: there is no target
 * here, and an incomplete day is not a failed one.
 */
export function dailyLogCompletion(log: DailyLog): DailyLogCompletion {
  const sections = filledSections(log);
  return { filled: sections.length, total: DAILY_LOG_SECTIONS.length, sections };
}

/**
 * The day-level "I did something active today" flag.
 *
 * Meaningful only for days with no planned activities - a rest day, or a date the
 * programme does not cover. For a planned day use `summariseSessionCompletion`, which
 * derives the answer from `completedActivityIds`.
 *
 * Symptom outcome is deliberately not consulted here or anywhere else.
 */
export function isDayMarkedComplete(log: DailyLog | undefined): boolean {
  return log?.exercise?.completed === true;
}

/**
 * True when this record predates per-activity completion, so the day-level flag is
 * the only completion information it carries.
 */
export function usesLegacyCompletion(log: DailyLog | undefined): boolean {
  return log?.exercise?.completedActivityIds === undefined;
}

/** The ids ticked today. Empty for a record that has none, or that predates the field. */
export function completedActivityIds(log: DailyLog | undefined): UUID[] {
  const ids = log?.exercise?.completedActivityIds;
  return Array.isArray(ids) ? ids : [];
}

export function isActivityCompleted(log: DailyLog | undefined, activityId: UUID): boolean {
  return completedActivityIds(log).includes(activityId);
}

/**
 * The patch for ticking or unticking one activity.
 *
 * The resulting array is always written, even when empty, so that presence stays an
 * unambiguous signal that this record understands per-activity completion. Ticking
 * one activity never touches another.
 */
export function toggleActivityCompletion(
  log: DailyLog | undefined,
  activityId: UUID,
  completed: boolean,
): DailyLogUpdate {
  const current = completedActivityIds(log);
  const next = completed
    ? current.includes(activityId)
      ? current
      : [...current, activityId]
    : current.filter((id) => id !== activityId);
  return { exercise: { completedActivityIds: next } };
}

/**
 * Did the user say they followed the planned rest?
 *
 * Reads one explicit field and nothing else. Water, food, sleep, heart rate,
 * symptoms and notes are all ordinary tracking and none of them implies this.
 */
export function isRestDayAcknowledged(log: DailyLog | undefined): boolean {
  return log?.exercise?.restDayAcknowledged === true;
}

/** The patch for the rest-day acknowledgement control. */
export function acknowledgeRestDay(acknowledged: boolean): DailyLogUpdate {
  return { exercise: { restDayAcknowledged: acknowledged } };
}

export type SymptomFlag = 'leg_pain' | 'toe_sensation_worse';

/**
 * Symptom changes worth surfacing in the day's record.
 *
 * This is a plain readback of what was entered. The app does not assess it, grade
 * it, or attach any instruction to it, and it never alters completion state.
 */
export function symptomFlags(log: DailyLog | undefined): SymptomFlag[] {
  const flags: SymptomFlag[] = [];
  if (log?.symptoms?.legPain === true) flags.push('leg_pain');
  if (log?.symptoms?.toeSensation === 'worse') flags.push('toe_sensation_worse');
  return flags;
}

export function hasSymptomFlag(log: DailyLog | undefined): boolean {
  return symptomFlags(log).length > 0;
}

/**
 * After minus before. Undefined unless BOTH readings exist, so a single
 * recorded value never implies a change of zero.
 */
export function backPainChange(log: DailyLog | undefined): number | undefined {
  const before = log?.symptoms?.backPainBefore;
  const after = log?.symptoms?.backPainAfter;
  if (typeof before !== 'number' || typeof after !== 'number') return undefined;
  return after - before;
}

export function exerciseMinutes(log: DailyLog | undefined): number | undefined {
  const minutes = log?.exercise?.durationMinutes;
  return typeof minutes === 'number' ? minutes : undefined;
}

// --- Collection helpers (pure; storage lives elsewhere) --------------------

export function findDailyLog(logs: readonly DailyLog[], date: ISODate): DailyLog | undefined {
  return logs.find((log) => log.date === date);
}

export function sortDailyLogs(logs: readonly DailyLog[]): DailyLog[] {
  return [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Replaces the log for that date, or appends it. Sorted by date on the way out. */
export function upsertDailyLog(logs: readonly DailyLog[], log: DailyLog): DailyLog[] {
  const withoutDate = logs.filter((existing) => existing.date !== log.date);
  return sortDailyLogs([...withoutDate, log]);
}
