import type { Journey } from '../domain/journey';
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

export function activeJourneySnapshotKey(): string {
  return ACTIVE_JOURNEY_KEY;
}
