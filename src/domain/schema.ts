import { isValidISODate, isValidISODateTime, nowTimestamp } from './dates';
import type { GameSettings, GameState } from './game/types';
import type { Journey } from './journey';
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

/**
 * The unfinished Journey, if the device was mid-recording when the backup was taken.
 *
 * Shaped like the storage snapshot but declared here, in the domain, so `schema.ts`
 * keeps importing nothing from `src/storage`. The storage layer maps between the two.
 */
export interface ExportActiveJourney {
  savedAt: ISODateTime;
  journey: Journey;
}

/**
 * Journeys, carried as a third sibling block beside `data` and `game`.
 *
 * WHY A SIBLING KEY, AGAIN:
 * the same reason `game` is one. A Journey is neither a fitness record in the
 * `DailyLog` sense nor game state; it is its own aggregate with its own storage keys,
 * and folding it into `AppData` would blur a boundary that is currently clean.
 *
 * WHY ABSENT AND EMPTY MEAN DIFFERENT THINGS:
 * this is the load-bearing decision of the whole block. `journey: undefined` means
 * "this file predates Journey backup support and therefore says nothing about
 * Journeys". `journey: { history: [] }` means "this device had none". The first must
 * never be allowed to delete history the file could not have contained; the second
 * must. Collapsing the two would either strand stale Journeys forever or destroy real
 * ones on the first restore from an old file.
 */
export interface ExportJourneyBlock {
  /** Completed and imported Journeys. Order is preserved as written. */
  history: Journey[];
  /** Present only when a recording or paused Journey existed at export time. */
  active?: ExportActiveJourney;
}

export interface ExportEnvelope {
  app: typeof APP_ID;
  appVersion: string;
  schemaVersion: number;
  exportedAt: ISODateTime;
  data: AppData;
  /** Absent in exports written before the game layer existed. */
  game?: ExportGameBlock;
  /** Absent in exports written before Journey backup support existed. */
  journey?: ExportJourneyBlock;
}

export function isSupportedSchemaVersion(version: unknown): version is number {
  return typeof version === 'number' && SUPPORTED_SCHEMA_VERSIONS.includes(version);
}

export function createExportEnvelope(
  data: AppData,
  options: {
    exportedAt?: ISODateTime;
    game?: ExportGameBlock;
    journey?: ExportJourneyBlock;
  } = {},
): ExportEnvelope {
  const envelope: ExportEnvelope = {
    app: APP_ID,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? nowTimestamp(),
    data,
  };
  if (options.game !== undefined) envelope.game = options.game;
  if (options.journey !== undefined) envelope.journey = options.journey;
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
 * The Journey block, if the file carries one.
 *
 * Refused rather than repaired. A partially trusted Journey block is the worst
 * outcome available here: it would restore some routes and silently drop others,
 * and the user would have no way to tell which. Every problem below fails the whole
 * import, exactly as an unreadable `game` block does.
 *
 * Journeys themselves are checked for the fields the rest of the app relies on - an
 * id, a status that belongs in the block it was found in, and a start time. Route
 * points are checked to be an array of objects carrying finite coordinates, because
 * a route is the one part of a Journey that cannot be re-derived from anything else.
 */
function validateJourneyPoints(
  points: unknown,
  label: string,
  errors: string[],
): void {
  if (points === undefined) return;
  if (!Array.isArray(points)) {
    errors.push(`${label} must be an array when present`);
    return;
  }
  points.forEach((point, index) => {
    if (!isRecord(point)) {
      errors.push(`${label}[${index}] must be an object`);
      return;
    }
    for (const axis of ['latitude', 'longitude'] as const) {
      if (typeof point[axis] !== 'number' || !Number.isFinite(point[axis])) {
        errors.push(`${label}[${index}].${axis} must be a finite number`);
      }
    }
    if (!isValidISODateTime(point['recordedAt'])) {
      errors.push(`${label}[${index}].recordedAt must be an ISO timestamp`);
    }
  });
}

function validateJourney(
  value: unknown,
  label: string,
  allowedStatuses: readonly string[],
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return;
  }

  if (typeof value['id'] !== 'string' || value['id'].length === 0) {
    errors.push(`${label}.id must be a non-empty string`);
  }

  const status = value['status'];
  if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
    errors.push(
      `${label}.status must be one of ${allowedStatuses.join(', ')}, found ${JSON.stringify(status)}`,
    );
  }

  if (!isValidISODateTime(value['startedAt'])) {
    errors.push(`${label}.startedAt must be an ISO timestamp`);
  }

  for (const key of ['metrics', 'sources', 'pauses'] as const) {
    if (!Array.isArray(value[key])) errors.push(`${label}.${key} must be an array`);
  }

  const route = value['route'];
  if (route !== undefined) {
    if (!isRecord(route)) {
      errors.push(`${label}.route must be an object when present`);
    } else {
      validateJourneyPoints(route['acceptedPoints'], `${label}.route.acceptedPoints`, errors);
      validateJourneyPoints(route['rawPoints'], `${label}.route.rawPoints`, errors);
    }
  }
}

function validateJourneyBlock(value: unknown, errors: string[]): void {
  if (value === undefined) return;

  if (!isRecord(value)) {
    errors.push('journey must be an object when present');
    return;
  }

  const history = value['history'];
  if (!Array.isArray(history)) {
    errors.push('journey.history must be an array');
  } else {
    history.forEach((journey, index) => {
      validateJourney(journey, `journey.history[${index}]`, ['completed', 'imported'], errors);
    });
  }

  const active = value['active'];
  if (active !== undefined) {
    if (!isRecord(active)) {
      errors.push('journey.active must be an object when present');
    } else {
      if (!isValidISODateTime(active['savedAt'])) {
        errors.push('journey.active.savedAt must be an ISO timestamp');
      }
      validateJourney(active['journey'], 'journey.active.journey', ['recording', 'paused'], errors);
    }
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

  validateJourneyBlock(value['journey'], errors);

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
