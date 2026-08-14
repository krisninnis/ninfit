import { isValidISODate, isValidISODateTime, nowTimestamp } from './dates';
import type { GameSettings, GameState } from './game/types';
import type { AppData, ISODateTime } from './types';

/**
 * Schema identity, export envelope shape, and version handling.
 *
 * The version ships in v0.1 even though there is nothing yet to migrate from.
 * Retrofitting versioning onto files that are already in the wild is the painful
 * version of this problem, so it is paid for up front.
 *
 * This module is pure: it validates and shapes data. Reading files, writing files
 * and triggering downloads all belong to the io layer.
 */

export const APP_ID = 'fitness-tracker';

/**
 * Injected from package.json at build time. The fallback keeps plain `tsc` and any
 * non-Vite consumer working; nothing else in the app hardcodes a version.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

export const SCHEMA_VERSION = 1;

/** Versions this build can read. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1];

/**
 * The game layer, carried alongside the fitness data rather than inside it.
 *
 * WHY A SIBLING KEY, NOT PART OF AppData:
 * `AppData` is the fitness aggregate, and the whole game layer was built on the rule
 * that game state lives separately from fitness records. Folding it into `AppData`
 * would blur exactly the boundary that keeps `DailyLog` a fitness journal. A sibling
 * key says plainly "these are two different things that travel together".
 *
 * It is OPTIONAL, which is also why no new version number was invented: adding it is
 * purely additive, a reader that predates it ignores it, and an export written before
 * it existed is still a perfectly valid schema-1 document. A second version number
 * would only create ambiguity about which one governs what.
 */
export interface ExportGameBlock {
  state: GameState;
  settings: GameSettings;
}

export interface ExportEnvelope {
  app: typeof APP_ID;
  appVersion: string;
  schemaVersion: number;
  exportedAt: ISODateTime;
  data: AppData;
  /** Absent in exports written before the game layer existed. */
  game?: ExportGameBlock;
}

export function isSupportedSchemaVersion(version: unknown): version is number {
  return typeof version === 'number' && SUPPORTED_SCHEMA_VERSIONS.includes(version);
}

export function createExportEnvelope(
  data: AppData,
  options: { exportedAt?: ISODateTime; game?: ExportGameBlock } = {},
): ExportEnvelope {
  const envelope: ExportEnvelope = {
    app: APP_ID,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? nowTimestamp(),
    data,
  };
  if (options.game !== undefined) envelope.game = options.game;
  return envelope;
}

export type SchemaValidationResult =
  | { ok: true; envelope: ExportEnvelope }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateAppData(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('data must be an object');
    return;
  }

  for (const key of ['profile', 'healthContext', 'baseline', 'meta'] as const) {
    if (!isRecord(value[key])) errors.push(`data.${key} must be an object`);
  }

  for (const key of ['measurements', 'weeklyPlans', 'dailyLogs'] as const) {
    if (!Array.isArray(value[key])) errors.push(`data.${key} must be an array`);
  }

  // `metricSamples` was added after the first v1 exports were possible. It is
  // OPTIONAL on the way in and defaulted to [] by the migration, so early files stay
  // importable. That is why this did not warrant a schema version bump: the change is
  // purely additive and older documents remain valid v1 documents.
  if (value['metricSamples'] !== undefined && !Array.isArray(value['metricSamples'])) {
    errors.push('data.metricSamples must be an array when present');
  }

  const profile = value['profile'];
  if (isRecord(profile) && !isValidISODate(profile['programmeStartDate'])) {
    errors.push('data.profile.programmeStartDate must be a YYYY-MM-DD date');
  }

  const logs = value['dailyLogs'];
  if (Array.isArray(logs)) {
    const seen = new Set<string>();
    logs.forEach((log, index) => {
      if (!isRecord(log)) {
        errors.push(`data.dailyLogs[${index}] must be an object`);
        return;
      }
      const date = log['date'];
      if (!isValidISODate(date)) {
        errors.push(`data.dailyLogs[${index}].date must be a YYYY-MM-DD date`);
        return;
      }
      if (seen.has(date)) {
        errors.push(`data.dailyLogs contains more than one entry for ${date}`);
      }
      seen.add(date);
    });
  }
}

/**
 * Structural validation of something claiming to be one of our exports.
 *
 * Deliberately shallow: it checks identity, version and shape so a wrong or
 * corrupt file is refused, without trying to be a full schema validator.
 */
export function validateExportEnvelope(value: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['File does not contain a JSON object'] };
  }

  if (value['app'] !== APP_ID) {
    errors.push(`Expected an export from "${APP_ID}", found ${JSON.stringify(value['app'])}`);
  }

  const version = value['schemaVersion'];
  if (typeof version !== 'number') {
    errors.push('schemaVersion is missing or is not a number');
  } else if (!isSupportedSchemaVersion(version)) {
    errors.push(
      version > SCHEMA_VERSION
        ? `This file uses schema version ${version}, which was written by a newer version of the app`
        : `Schema version ${version} is not supported by this version of the app`,
    );
  }

  if (!isValidISODateTime(value['exportedAt'])) {
    errors.push('exportedAt is missing or is not an ISO timestamp');
  }

  validateAppData(value['data'], errors);

  // Optional, but if it is there it has to be the right shape. An unreadable game
  // block is refused rather than quietly dropped, because losing XP and trophies
  // silently would be worse than refusing the file.
  const game = value['game'];
  if (game !== undefined) {
    if (!isRecord(game)) {
      errors.push('game must be an object when present');
    } else {
      if (!isRecord(game['state'])) errors.push('game.state must be an object');
      if (!isRecord(game['settings'])) errors.push('game.settings must be an object');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, envelope: value as unknown as ExportEnvelope };
}

/**
 * Bring a validated envelope up to the current schema and fill in anything additive
 * that an older file predates.
 *
 * Version 1 remains the only version. Additive optional collections are normalised
 * here rather than by bumping the version, so a file written before `metricSamples`
 * existed still imports cleanly.
 */
export function migrateExportEnvelope(envelope: ExportEnvelope): AppData {
  switch (envelope.schemaVersion) {
    case 1:
      return normaliseAppData(envelope.data);
    default:
      throw new Error(`No migration path from schema version ${envelope.schemaVersion}`);
  }
}

/**
 * Fill in collections that older v1 documents may not carry. Never mutates the input,
 * and never invents anything beyond an empty collection.
 */
export function normaliseAppData(data: AppData): AppData {
  const incoming = data as AppData & { metricSamples?: AppData['metricSamples'] };
  if (Array.isArray(incoming.metricSamples)) return data;
  return { ...data, metricSamples: [] };
}
