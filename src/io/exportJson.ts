import { readAppData } from '../app/appData';
import { nowTimestamp, todayISO } from '../domain/dates';
import { createDefaultGameSettings, createInitialGameState } from '../domain/game/defaults';
import { createExportEnvelope, type ExportEnvelope } from '../domain/schema';
import type { ISODate, ISODateTime } from '../domain/types';
import type { Repository } from '../storage/repository';
import type { DownloadableFile } from './download';

/**
 * The full backup: everything the app holds, in one portable file.
 *
 * Pure apart from reading the repository. Producing the file and saving the file are
 * deliberately separate steps, so `lastExportedAt` can be stamped only once the file
 * has actually been handed to the browser.
 */

export const JSON_MIME_TYPE = 'application/json';

export function backupFilename(date: ISODate = todayISO()): string {
  // Local calendar date, never a UTC-shifted one, and nothing personal in the name.
  return `fitness-tracker-backup-${date}.json`;
}

export interface BackupFile extends DownloadableFile {
  envelope: ExportEnvelope;
}

/**
 * Build the backup.
 *
 * Game state and settings ride alongside the fitness data as a sibling `game` block
 * rather than inside `AppData` - see the note on `ExportGameBlock`. If either is
 * somehow missing from storage, fresh defaults are used so the file is always
 * complete and restorable.
 */
export function buildBackup(
  repository: Repository,
  options: { now?: ISODateTime; today?: ISODate } = {},
): BackupFile {
  const exportedAt = options.now ?? nowTimestamp();

  const envelope = createExportEnvelope(readAppData(repository), {
    exportedAt,
    game: {
      state: repository.getGameState() ?? createInitialGameState({ now: exportedAt }),
      settings: repository.getGameSettings() ?? createDefaultGameSettings(),
    },
  });

  return {
    envelope,
    filename: backupFilename(options.today ?? todayISO()),
    mimeType: JSON_MIME_TYPE,
    // Indented: these files get opened in text editors by real people.
    contents: JSON.stringify(envelope, null, 2),
  };
}

export interface BackupSummary {
  exportedAt: ISODateTime;
  appVersion: string;
  schemaVersion: number;
  dailyLogs: number;
  measurements: number;
  weeklyPlans: number;
  metricSamples: number;
  programmeStartDate: ISODate;
  /** Whether the file carries XP, trophies and mascot state. */
  hasGameData: boolean;
  gameLevel?: number;
  trophies?: number;
}

/**
 * A factual description of a backup, for the import confirmation.
 *
 * Counts and dates only. No health note text, no measurements, nothing that would
 * put personal detail on screen just to confirm a file is the right one.
 */
export function summariseBackup(envelope: ExportEnvelope): BackupSummary {
  const summary: BackupSummary = {
    exportedAt: envelope.exportedAt,
    appVersion: envelope.appVersion,
    schemaVersion: envelope.schemaVersion,
    dailyLogs: envelope.data.dailyLogs.length,
    measurements: envelope.data.measurements.length,
    weeklyPlans: envelope.data.weeklyPlans.length,
    metricSamples: envelope.data.metricSamples?.length ?? 0,
    programmeStartDate: envelope.data.profile.programmeStartDate,
    hasGameData: envelope.game !== undefined,
  };

  if (envelope.game !== undefined) {
    summary.gameLevel = envelope.game.state.xp.level;
    summary.trophies = envelope.game.state.trophies.length;
  }
  return summary;
}
