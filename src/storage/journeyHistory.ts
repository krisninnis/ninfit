import type { Journey } from '../domain/journey';
import { validateJourneyForStatuses } from '../domain/schema';
import { QUARANTINE_KEY_PREFIX } from './repository';
import type { StorageAdapter } from './StorageAdapter';

const JOURNEY_HISTORY_KEY = 'ninfit:journey:history:v1';

export interface JourneyHistoryEnvelope {
  schemaVersion: 1;
  journeys: Journey[];
}

function isPersistableJourney(journey: Journey): boolean {
  return journey.status === 'completed' || journey.status === 'imported';
}

function parseHistory(raw: string): JourneyHistoryEnvelope {
  try {
    const candidate = JSON.parse(raw) as Partial<JourneyHistoryEnvelope>;
    if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.journeys)) {
      return { schemaVersion: 1, journeys: [] };
    }

    return {
      schemaVersion: 1,
      journeys: candidate.journeys.filter((journey): journey is Journey =>
        Boolean(journey && isPersistableJourney(journey as Journey)),
      ),
    };
  } catch {
    return { schemaVersion: 1, journeys: [] };
  }
}

export function loadJourneyHistory(storage: StorageAdapter): Journey[] {
  const raw = storage.get(JOURNEY_HISTORY_KEY);
  if (raw === null) return [];
  return parseHistory(raw).journeys;
}

/**
 * Why this exists alongside `loadJourneyHistory`.
 *
 * `loadJourneyHistory` answers "what can I show?" and degrades an unreadable value to
 * an empty list, which is the right answer for a screen. A backup asks a different
 * question - "is this everything?" - and there the same degradation is dangerous: a
 * corrupt history would be exported as `history: []`, and restoring that file later
 * would turn a recoverable corruption into a permanent, deliberate-looking deletion.
 *
 * So the backup path reads through here instead. It reports corruption rather than
 * hiding it, and copies the unreadable value to a quarantine key first, following the
 * rule the repository already sets: nothing is ever destroyed.
 */
export type JourneyHistoryRead =
  | { ok: true; journeys: Journey[] }
  | { ok: false; detail: string; quarantinedAs?: string };

export function readJourneyHistoryForBackup(
  storage: StorageAdapter,
  options: { now?: () => string } = {},
): JourneyHistoryRead {
  const raw = storage.get(JOURNEY_HISTORY_KEY);
  if (raw === null) return { ok: true, journeys: [] };

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    return quarantineHistory(storage, raw, `Journey history is not valid JSON: ${String(error)}`, options);
  }

  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return quarantineHistory(storage, raw, 'Journey history is not an object', options);
  }

  const record = candidate as Record<string, unknown>;
  if (record['schemaVersion'] !== 1) {
    return quarantineHistory(
      storage,
      raw,
      `Journey history uses schema version ${JSON.stringify(record['schemaVersion'])}`,
      options,
    );
  }

  if (!Array.isArray(record['journeys'])) {
    return quarantineHistory(storage, raw, 'Journey history is not a list of Journeys', options);
  }

  const journeys = record['journeys'];
  const errors = journeys.flatMap((journey, index) =>
    validateJourneyForStatuses(journey, ['completed', 'imported']).map(
      (error) => `history[${index}]: ${error}`,
    ),
  );
  if (errors.length > 0) {
    return quarantineHistory(
      storage,
      raw,
      `Journey history contains invalid Journey data: ${errors.join('; ')}`,
      options,
    );
  }

  return { ok: true, journeys: journeys as Journey[] };
}

function quarantineHistory(
  storage: StorageAdapter,
  raw: string,
  detail: string,
  options: { now?: () => string },
): JourneyHistoryRead {
  const stamp = options.now?.() ?? new Date().toISOString();
  const quarantinedAs = `${QUARANTINE_KEY_PREFIX}${JOURNEY_HISTORY_KEY}:${stamp}`;
  try {
    storage.set(quarantinedAs, raw);
    return { ok: false, detail, quarantinedAs };
  } catch {
    // If even the copy fails the original is still where it was. Report without it.
    return { ok: false, detail };
  }
}

/**
 * Replace the whole history, for a restore.
 *
 * Deliberately not an upsert: a restore is "this device now holds what the backup
 * held", not "merge two devices". `saveJourneyToHistory` remains the upsert used by
 * normal recording.
 */
export function replaceJourneyHistory(storage: StorageAdapter, journeys: Journey[]): Journey[] {
  const persistable = journeys.filter(isPersistableJourney);
  const envelope: JourneyHistoryEnvelope = { schemaVersion: 1, journeys: persistable };
  storage.set(JOURNEY_HISTORY_KEY, JSON.stringify(envelope));
  return persistable;
}

/**
 * Upserts by Journey identity. Saving the same completed Journey twice must not create
 * duplicate history rows or duplicate later rewards.
 */
export function saveJourneyToHistory(storage: StorageAdapter, journey: Journey): Journey[] {
  if (!isPersistableJourney(journey)) {
    throw new Error('Only completed or imported Journeys can be saved to Journey history');
  }

  const current = loadJourneyHistory(storage);
  const withoutSameId = current.filter((existing) => existing.id !== journey.id);
  const next = [...withoutSameId, journey].sort((a, b) =>
    (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt),
  );

  const envelope: JourneyHistoryEnvelope = { schemaVersion: 1, journeys: next };
  storage.set(JOURNEY_HISTORY_KEY, JSON.stringify(envelope));
  return next;
}

export function removeJourneyFromHistory(storage: StorageAdapter, journeyId: string): Journey[] {
  const next = loadJourneyHistory(storage).filter((journey) => journey.id !== journeyId);
  storage.set(JOURNEY_HISTORY_KEY, JSON.stringify({ schemaVersion: 1, journeys: next }));
  return next;
}

export function journeyHistoryKey(): string {
  return JOURNEY_HISTORY_KEY;
}
