import {
  applyDailyLogUpdate,
  createEmptyDailyLog,
  isDailyLogEmpty,
  type DailyLogUpdate,
  type DomainOptions,
} from '../domain/dailyLog';
import type { DailyLog, ISODate, UUID } from '../domain/types';
import type { Repository } from '../storage/repository';

/**
 * One day's editing session.
 *
 * Framework-free on purpose: React owns rendering and debouncing, this owns the rules
 * about what is in memory, what reaches storage, and when. Everything the Today screen
 * can do to a day can therefore be tested without a DOM.
 *
 * Two rules it exists to enforce:
 *
 *  1. Opening Today must not create a record. A day is written only once the user has
 *     actually entered something.
 *  2. An edit is a patch. `applyDailyLogUpdate` merges it, so touching hydration never
 *     disturbs what was recorded about the back.
 */

export type SaveStatus = 'saved' | 'skipped' | 'failed';

export interface SaveOutcome {
  status: SaveStatus;
  /** Present only when the store refused the write. */
  error?: unknown;
}

export interface TodaySessionOptions extends DomainOptions {
  /** Recorded on a newly created log so the day knows which plan it was logged against. */
  weeklyPlanId?: UUID;
  plannedSessionId?: UUID;
}

export interface TodaySession {
  readonly date: ISODate;
  /** The current in-memory log, saved or not. */
  getLog(): DailyLog;
  /** True once this day exists in storage. */
  isPersisted(): boolean;
  /** True when there are in-memory edits not yet written. */
  hasUnsavedChanges(): boolean;
  /** Merge a patch in memory. Never writes. */
  apply(update: DailyLogUpdate): DailyLog;
  /** Write if there is anything worth writing. Never throws. */
  save(): SaveOutcome;
}

export function createTodaySession(
  repository: Repository,
  date: ISODate,
  options: TodaySessionOptions = {},
): TodaySession {
  const stored = repository.getDailyLog(date);

  let log =
    stored ??
    createEmptyDailyLog(
      {
        date,
        ...(options.weeklyPlanId !== undefined ? { weeklyPlanId: options.weeklyPlanId } : {}),
        ...(options.plannedSessionId !== undefined
          ? { plannedSessionId: options.plannedSessionId }
          : {}),
      },
      options,
    );

  let persisted = stored !== undefined;
  let dirty = false;

  return {
    date,

    getLog() {
      return log;
    },

    isPersisted() {
      return persisted;
    },

    hasUnsavedChanges() {
      return dirty;
    },

    apply(update) {
      log = applyDailyLogUpdate(log, update, options);
      dirty = true;
      return log;
    },

    save() {
      if (!dirty) return { status: 'skipped' };

      // Never bring a day into existence with nothing in it. Once the day does exist,
      // an edit that empties it is a real change and must be written.
      if (!persisted && isDailyLogEmpty(log)) return { status: 'skipped' };

      try {
        repository.saveDailyLog(log);
        persisted = true;
        dirty = false;
        return { status: 'saved' };
      } catch (error) {
        // Reported to the caller rather than thrown. The entry stays on screen, and
        // the UI can say so calmly instead of the app falling over.
        return { status: 'failed', error };
      }
    },
  };
}
