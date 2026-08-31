import type { Journey } from '../domain/journey';
import { QUARANTINE_KEY_PREFIX } from './repository';
import type { StorageAdapter } from './StorageAdapter';

const ACTIVE_JOURNEY_KEY = 'ninfit:journey:active:v1';

export interface ActiveJourneySnapshot {
  schemaVersion: 1;
  savedAt: string;
  journey: Journey;
}

function isRecoverableJourney(journey: Journey): boolean {
  return journey.status === 'recording' || journey.status === 'paused';
}

function parseSnapshot(raw: string): ActiveJourneySnapshot | null {
  try {
    const candidate = JSON.parse(raw) as Partial<ActiveJourneySnapshot>;
    if (candidate.schemaVersion !== 1) return null;
    if (typeof candidate.savedAt !== 'string' || !candidate.journey) return null;
    if (!isRecoverableJourney(candidate.journey)) return null;
    return candidate as ActiveJourneySnapshot;
  } catch {
    return null;
  }
}

/**
 * Persists only the single unfinished Journey needed for interruption recovery.
 * Completed/imported Journeys belong in normal Journey history, not this short-lived slot.
 */
export function saveActiveJourneySnapshot(
  storage: StorageAdapter,
  journey: Journey,
  savedAt: string,
): ActiveJourneySnapshot {
  if (!isRecoverableJourney(journey)) {
    throw new Error('Only recording or paused Journeys can be saved as active recovery snapshots');
  }

  const snapshot: ActiveJourneySnapshot = {
    schemaVersion: 1,
    savedAt,
    journey,
  };

  storage.set(ACTIVE_JOURNEY_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function loadActiveJourneySnapshot(storage: StorageAdapter): ActiveJourneySnapshot | null {
  const raw = storage.get(ACTIVE_JOURNEY_KEY);
  if (raw === null) return null;
  return parseSnapshot(raw);
}

export function clearActiveJourneySnapshot(storage: StorageAdapter): void {
  storage.remove(ACTIVE_JOURNEY_KEY);
}

/**
 * Write a snapshot that came from a backup rather than from a live recording.
 *
 * Same validation as a live save - only a recording or paused Journey may occupy the
 * slot - but it takes the `savedAt` from the file, so a restored Journey keeps the age
 * it actually has instead of appearing to have been saved at import time.
 *
 * It writes recovery evidence and nothing else. No watcher is created here; GPS starts
 * only when the person opens the Active Journey screen and the status is still
 * `recording`, which is a deliberate act on their part rather than a side effect of
 * restoring a file.
 */
export function restoreActiveJourneySnapshot(
  storage: StorageAdapter,
  snapshot: ActiveJourneySnapshot,
): ActiveJourneySnapshot {
  return saveActiveJourneySnapshot(storage, snapshot.journey, snapshot.savedAt);
}

export function activeJourneySnapshotKey(): string {
  return ACTIVE_JOURNEY_KEY;
}


export type ActiveJourneySnapshotRead =
  | { ok: true; snapshot: ActiveJourneySnapshot | null }
  | { ok: false; detail: string; quarantinedAs?: string };

/**
 * Conservative read for backup/export.
 *
 * The ordinary runtime loader returns null for unreadable active-recovery state so the
 * Journey UI can degrade safely. A full backup asks a stricter question: "is this all
 * recoverable Journey state?" Silently treating corruption as "no active Journey"
 * would create a plausible but incomplete backup.
 */
export function readActiveJourneySnapshotForBackup(
  storage: StorageAdapter,
  options: { now?: () => string } = {},
): ActiveJourneySnapshotRead {
  const raw = storage.get(ACTIVE_JOURNEY_KEY);
  if (raw === null) return { ok: true, snapshot: null };

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    return quarantineActiveSnapshot(
      storage,
      raw,
      `Active Journey recovery is not valid JSON: ${String(error)}`,
      options,
    );
  }

  if (
    typeof candidate !== 'object'
    || candidate === null
    || Array.isArray(candidate)
  ) {
    return quarantineActiveSnapshot(
      storage,
      raw,
      'Active Journey recovery is not an object',
      options,
    );
  }

  const parsed = parseSnapshot(raw);
  if (parsed === null) {
    return quarantineActiveSnapshot(
      storage,
      raw,
      'Active Journey recovery has an unsupported schema or invalid Journey state',
      options,
    );
  }

  return { ok: true, snapshot: parsed };
}

function quarantineActiveSnapshot(
  storage: StorageAdapter,
  raw: string,
  detail: string,
  options: { now?: () => string },
): ActiveJourneySnapshotRead {
  const stamp = options.now?.() ?? new Date().toISOString();
  const quarantinedAs = `${QUARANTINE_KEY_PREFIX}${ACTIVE_JOURNEY_KEY}:${stamp}`;
  try {
    storage.set(quarantinedAs, raw);
    return { ok: false, detail, quarantinedAs };
  } catch {
    return { ok: false, detail };
  }
}
