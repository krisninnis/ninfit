import { nowTimestamp } from '../domain/dates';
import { createDefaultGameSettings, createInitialGameState } from '../domain/game/defaults';
import { withoutPendingRewardDeliveries } from '../domain/game/rewardDelivery';
import { deriveRewards, sealRewardKeys } from '../domain/game/rewards';
import type { GameSettings, GameState } from '../domain/game/types';
import {
  migrateExportEnvelope,
  validateExportEnvelope,
  type ExportEnvelope,
} from '../domain/schema';
import {
  clearActiveJourneySnapshot,
  restoreActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';
import { replaceJourneyHistory } from '../storage/journeyHistory';
import type { ExportJourneyBlock } from '../domain/schema';
import type { StorageAdapter } from '../storage/StorageAdapter';
import type { AppData, ISODate, ISODateTime } from '../domain/types';
import type { Repository } from '../storage/repository';
import { summariseBackup, type BackupSummary } from './exportJson';

/**
 * Restoring a backup, safely.
 *
 * THE SEQUENCING PROBLEM THIS SOLVES:
 * The domain exposes `validateExportEnvelope`, `migrateExportEnvelope` and
 * `normaliseAppData` separately, and a caller who validated but forgot to migrate
 * would be holding a legacy document whose type claims fields it does not have.
 * Those helpers stay available for tests, but the application path cannot get it
 * wrong: `commitImport` only accepts a `PreparedImport`, and the only way to obtain
 * one is `prepareImport`, which always parses, validates, migrates and normalises.
 * The type is the gate.
 *
 * ATOMICITY, HONESTLY:
 * `localStorage` has no transactions, so a genuinely atomic replace is impossible.
 * The risk is reduced as far as it practically can be:
 *   1. everything is validated in memory before anything is touched;
 *   2. a backup of the current data is taken first, and a failure to take it aborts
 *      the whole thing;
 *   3. all replacement values are serialised up front;
 *   4. new values are written before any old day is removed;
 *   5. the result is read back and verified;
 *   6. only then are days absent from the backup deleted.
 * A crash mid-write can still leave a mixed state. If that happens the pre-import
 * backup is on disk and the failure is reported rather than swallowed.
 */

export interface PreparedImport {
  /** Present only on the object this module produced. Not constructible elsewhere. */
  readonly prepared: true;
  envelope: ExportEnvelope;
  data: AppData;
  game: { state: GameState; settings: GameSettings } | undefined;
  /** Undefined when the file predates Journey backup support - see `restoreJourneys`. */
  journey: ExportJourneyBlock | undefined;
  summary: BackupSummary;
}

export type PrepareResult =
  | { ok: true; prepared: PreparedImport }
  | { ok: false; errors: string[] };

/**
 * Parse and check a file, touching no storage at all.
 *
 * Nothing is written here, so a rejected or merely inspected file leaves the current
 * data exactly as it was.
 */
export function prepareImport(text: string): PrepareResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['That file is not valid JSON.'] };
  }

  const validation = validateExportEnvelope(parsed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const envelope = validation.envelope;

  // Migration also normalises, so collections added after this file was written
  // (metricSamples, for one) arrive as empty rather than missing.
  let data: AppData;
  try {
    data = migrateExportEnvelope(envelope);
  } catch (error) {
    return { ok: false, errors: [String(error)] };
  }

  const dateErrors = checkDailyLogDates(data);
  if (dateErrors.length > 0) return { ok: false, errors: dateErrors };

  return {
    ok: true,
    prepared: {
      prepared: true,
      envelope,
      data,
      game: envelope.game === undefined ? undefined : { ...envelope.game },
      journey: envelope.journey === undefined ? undefined : { ...envelope.journey },
      summary: summariseBackup(envelope),
    },
  };
}

/**
 * Every log must know its own date, and no date may appear twice.
 *
 * Storage keys a day by its date, so a record disagreeing with itself would end up
 * unreadable. Refused rather than guessed at.
 */
function checkDailyLogDates(data: AppData): string[] {
  const errors: string[] = [];
  const seen = new Set<ISODate>();

  for (const log of data.dailyLogs) {
    if (typeof log.date !== 'string' || log.date === '') {
      errors.push('A daily record in the file has no date.');
      continue;
    }
    if (seen.has(log.date)) errors.push(`The file holds more than one record for ${log.date}.`);
    seen.add(log.date);
  }
  return errors;
}

export interface CommitOptions {
  now?: ISODateTime;
  /**
   * Takes the pre-import backup. Must throw or return false if it could not be
   * saved: a failure here aborts the import before anything is written.
   */
  backupCurrentData: () => boolean;
  /**
   * The raw store, needed because Journeys live outside the repository.
   *
   * Optional so existing callers are unaffected. When it is absent no Journey state is
   * touched at all, which is the same thing the code did before Journey backup existed.
   */
  storage?: StorageAdapter;
}

export type CommitResult =
  | { ok: true; dailyLogsWritten: number; dailyLogsRemoved: number; journeysRestored?: number; activeJourneyRestored?: boolean }
  | { ok: false; errors: string[]; phase: 'backup' | 'write' | 'verify' };

/**
 * Replace the stored data with the prepared backup.
 *
 * REPLACE, NOT MERGE. The backup becomes the whole dataset, so days present in
 * storage but absent from the file are removed. Merging two backups would silently
 * blend two histories, which is a far worse outcome than losing a day the user
 * chose to restore away from.
 */
export function commitImport(
  repository: Repository,
  prepared: PreparedImport,
  options: CommitOptions,
): CommitResult {
  const timestamp = options.now ?? nowTimestamp();
  let journeyOutcome: JourneyRestoreOutcome = { restored: 0, active: false, touched: false };

  // 1. Back up what is here now. No backup, no import.
  try {
    if (options.backupCurrentData() !== true) {
      return {
        ok: false,
        phase: 'backup',
        errors: ['Your current data could not be backed up, so nothing has been changed.'],
      };
    }
  } catch (error) {
    return {
      ok: false,
      phase: 'backup',
      errors: [`Your current data could not be backed up, so nothing has been changed. ${String(error)}`],
    };
  }

  const { data } = prepared;
  const incomingDates = new Set(data.dailyLogs.map((log) => log.date));
  const existingDates = repository.listDailyLogDates();

  // 2. Write the replacement. New days first; old ones are removed only afterwards.
  try {
    repository.saveProfile(data.profile);
    repository.saveHealthContext(data.healthContext);
    repository.saveBaseline(data.baseline);
    repository.saveMeasurements(data.measurements);
    repository.saveWeeklyPlans(data.weeklyPlans);
    repository.saveMetricSamples(data.metricSamples);

    for (const log of data.dailyLogs) {
      repository.saveDailyLog(log);
    }

    repository.saveGameState(resolveGameState(prepared, data, timestamp));
    repository.saveGameSettings(prepared.game?.settings ?? createDefaultGameSettings());
    journeyOutcome = restoreJourneys(prepared, options.storage);
  } catch (error) {
    return {
      ok: false,
      phase: 'write',
      errors: [
        `The import could not be completed. Your pre-import backup was saved first. ${String(error)}`,
      ],
    };
  }

  // 3. Read it back before removing anything.
  const verification = verifyWritten(repository, data);
  if (verification.length > 0) {
    return { ok: false, phase: 'verify', errors: verification };
  }

  // 4. Now drop the days the backup does not contain.
  let removed = 0;
  for (const date of existingDates) {
    if (!incomingDates.has(date)) {
      repository.removeDailyLog(date);
      removed += 1;
    }
  }

  repository.updateMeta({});

  const result: CommitResult = {
    ok: true,
    dailyLogsWritten: data.dailyLogs.length,
    dailyLogsRemoved: removed,
  };
  if (journeyOutcome.touched) {
    result.journeysRestored = journeyOutcome.restored;
    result.activeJourneyRestored = journeyOutcome.active;
  }
  return result;
}

interface JourneyRestoreOutcome {
  restored: number;
  active: boolean;
  /** False when the file said nothing about Journeys, so nothing was changed. */
  touched: boolean;
}

/**
 * Restore Journeys, or deliberately leave them alone.
 *
 * THE RULE, AND WHY IT IS THIS WAY ROUND:
 *
 * A backup with NO journey block predates Journey backup support. It is not a
 * statement that the device had no Journeys - it is a file that could not have
 * carried them. Wiping history on the strength of it would destroy real recordings
 * because of the file's age, so this leaves existing Journey state exactly as it is.
 * The cost is honest and small: the restored device keeps its own Journeys alongside
 * the imported fitness records, and the Data screen says so.
 *
 * A backup WITH a journey block is authoritative, including when its history is
 * empty. That is the case that fixes cross-device mixing: restoring device A's backup
 * onto device B replaces B's Journeys with A's rather than leaving both present. The
 * active slot follows the same rule - restored when the file carries one, cleared when
 * it does not, so a stale half-finished recording cannot outlive the restore.
 */
function restoreJourneys(
  prepared: PreparedImport,
  storage: StorageAdapter | undefined,
): JourneyRestoreOutcome {
  if (storage === undefined || prepared.journey === undefined) {
    return { restored: 0, active: false, touched: false };
  }

  const restored = replaceJourneyHistory(storage, prepared.journey.history);

  if (prepared.journey.active !== undefined) {
    restoreActiveJourneySnapshot(storage, {
      schemaVersion: 1,
      savedAt: prepared.journey.active.savedAt,
      journey: prepared.journey.active.journey,
    });
  } else {
    clearActiveJourneySnapshot(storage);
  }

  return {
    restored: restored.length,
    active: prepared.journey.active !== undefined,
    touched: true,
  };
}

/**
 * The game state to store.
 *
 * When the backup carries game state it is restored verbatim: XP, level, skills,
 * trophies, awardedKeys, mascot and onboarding all survive exactly, and because
 * `awardedKeys` comes with it a later sync grants nothing twice.
 *
 * When it does NOT - an export written before the game layer existed - fresh default
 * state is created and every reward the imported history would have earned is SEALED
 * as already awarded. Without that, the first sync after import would scan the whole
 * imported history and dump a retroactive pile of XP and trophies on someone for
 * work the game never saw. The deliberate rule for v0.1: history imports, progression
 * does not.
 */
function resolveGameState(
  prepared: PreparedImport,
  data: AppData,
  now: ISODateTime,
): GameState {
  /*
   * THE DELIVERY QUEUE DOES NOT SURVIVE A RESTORE.
   *
   * Whatever the file said about rewards that had not yet been shown, it said about
   * the machine and the moment it was written on. Restoring it here would mean the
   * first thing a user sees after a restore is a run of "here is what you just
   * earned" for work done somewhere else, possibly months ago - history dressed as a
   * fresh moment, which is the one thing reward delivery must never do.
   *
   * Nothing earned is affected. XP, level, skills, trophies, awardedKeys and
   * recentEvents all restore exactly as they did before this existed; only the
   * un-shown ticket is dropped. See
   * `docs/architecture/ninfit-durable-reward-delivery-v1.md` section 13.
   */
  if (prepared.game !== undefined) {
    return withoutPendingRewardDeliveries(prepared.game.state);
  }

  // Fresh state carries no queue at all, so the sealed path needs nothing further.
  const fresh = createInitialGameState({ now });
  const facts = deriveRewards({
    programmeStartDate: data.profile.programmeStartDate,
    plans: data.weeklyPlans,
    logs: data.dailyLogs,
    measurementCount: data.measurements.length,
  });
  return sealRewardKeys(fresh, facts);
}

/** Spot-check that the replacement actually landed. */
function verifyWritten(repository: Repository, data: AppData): string[] {
  const errors: string[] = [];

  const profile = repository.getProfile();
  if (profile?.id !== data.profile.id) {
    errors.push('The restored profile could not be read back from storage.');
  }

  const baseline = repository.getBaseline();
  if (baseline?.id !== data.baseline.id) {
    errors.push('The restored baseline could not be read back from storage.');
  }

  if (repository.getMeasurements().length !== data.measurements.length) {
    errors.push('The restored measurements could not be read back from storage.');
  }

  for (const log of data.dailyLogs) {
    const stored = repository.getDailyLog(log.date);
    if (stored?.id !== log.id) {
      errors.push(`The record for ${log.date} could not be read back from storage.`);
      break;
    }
  }

  if (repository.getGameState() === undefined) {
    errors.push('Game progress could not be read back from storage.');
  }

  return errors;
}
