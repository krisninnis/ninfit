import { readAppData } from '../app/appData';
import { nowTimestamp, todayISO } from '../domain/dates';
import { createDefaultGameSettings, createInitialGameState } from '../domain/game/defaults';
import { createExportEnvelope, type ExportEnvelope } from '../domain/schema';
import type { ExportJourneyBlock } from '../domain/schema';
import { readActiveJourneySnapshotForBackup } from '../storage/activeJourneySnapshot';
import { readJourneyHistoryForBackup } from '../storage/journeyHistory';
import type { StorageAdapter } from '../storage/StorageAdapter';
import type { ISODate, ISODateTime } from '../domain/types';
import { createRepository, type Repository } from '../storage/repository';
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
/**
 * Journeys live under their own storage keys rather than in the repository, so the
 * backup needs the raw store to reach them. It is an option rather than a parameter
 * so that every existing caller and test keeps working unchanged; when it is absent
 * the file simply carries no Journey block, which older readers already handle.
 *
 * Unreadable history is NOT exported as an empty list - see
 * `readJourneyHistoryForBackup`. The corruption is quarantined and reported through
 * `journeyIssue` so the Data screen can say so, and the block is omitted rather than
 * asserting a false "there were none".
 */
export function buildJourneyBlock(
  storage: StorageAdapter,
  options: { now?: () => string } = {},
): { block?: ExportJourneyBlock; issue?: string } {
  const history = readJourneyHistoryForBackup(storage, options);
  if (!history.ok) {
    return {
      issue: history.quarantinedAs
        ? `${history.detail}. A copy was kept at ${history.quarantinedAs}.`
        : history.detail,
    };
  }

  const active = readActiveJourneySnapshotForBackup(storage, options);
  if (!active.ok) {
    return {
      issue: active.quarantinedAs
        ? `${active.detail}. A copy was kept at ${active.quarantinedAs}.`
        : active.detail,
    };
  }

  const block: ExportJourneyBlock = { history: history.journeys };
  if (active.snapshot !== null) {
    block.active = {
      savedAt: active.snapshot.savedAt,
      journey: active.snapshot.journey,
    };
  }
  return { block };
}

export function buildBackup(
  repository: Repository,
  options: { now?: ISODateTime; today?: ISODate; storage?: StorageAdapter } = {},
): BackupFile {
  const exportedAt = options.now ?? nowTimestamp();

  let journey: ExportJourneyBlock | undefined;
  if (options.storage !== undefined) {
    const journeyResult = buildJourneyBlock(options.storage);
    if (journeyResult.issue !== undefined) {
      throw new Error(
        `Journey data could not be included safely in this backup. ${journeyResult.issue}`,
      );
    }
    journey = journeyResult.block;
  }

  // When the backing store is available, read through a fresh repository so backup
  // integrity reflects the values that exist now rather than historical issues
  // remembered earlier in the app session. The ordinary runtime repository keeps
  // issues deliberately sticky for diagnostics; a repaired value must nevertheless
  // be exportable once the current stored value is valid.
  const readRepository = options.storage === undefined
    ? repository
    : createRepository(options.storage);

  const data = readAppData(readRepository);
  const gameState = readRepository.getGameState();
  const gameSettings = readRepository.getGameSettings();

  const unsafeIssues = readRepository.getIssues().filter((issue) => {
    return !(
      issue.key.endsWith(':game')
      && issue.kind === 'invalid_shape'
      && issue.detail.includes('pendingRewardDeliveries')
    );
  });

  if (unsafeIssues.length > 0) {
    const labels = unsafeIssues.map((issue) => issue.key).join(', ');
    throw new Error(
      `Some stored NinFit data could not be read safely for backup: ${labels}. `
        + 'The original values have not been replaced.',
    );
  }

  const envelope = createExportEnvelope(data, {
    exportedAt,
    game: {
      state: gameState ?? createInitialGameState({ now: exportedAt }),
      settings: gameSettings ?? createDefaultGameSettings(),
    },
    journey,
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
  /**
   * False for a backup written before Journey support. That is a different statement
   * from "this device had no Journeys", and the restore treats it differently.
   */
  hasJourneyData: boolean;
  journeys?: number;
  hasActiveJourney?: boolean;
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
    hasJourneyData: envelope.journey !== undefined,
  };

  if (envelope.game !== undefined) {
    summary.gameLevel = envelope.game.state.xp.level;
    summary.trophies = envelope.game.state.trophies.length;
  }
  if (envelope.journey !== undefined) {
    summary.journeys = envelope.journey.history.length;
    summary.hasActiveJourney = envelope.journey.active !== undefined;
  }
  return summary;
}
