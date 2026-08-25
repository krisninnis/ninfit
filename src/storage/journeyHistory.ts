import type { Journey } from '../domain/journey';
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
