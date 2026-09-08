import type { StorageAdapter } from './StorageAdapter';

export type JourneyPauseOrigin = 'manual' | 'auto_stationary';

const KEY_PREFIX = 'ft:journey-pause-origin:v1:';

function key(journeyId: string): string {
  return `${KEY_PREFIX}${journeyId}`;
}

/**
 * Reads the reason for the currently-open Journey pause.
 *
 * Missing or malformed evidence deliberately resolves to `manual`. That is the safe
 * recovery behaviour for older Journeys and corrupted sidecar state: NinFit must
 * never decide to auto-resume a pause unless it has explicit durable evidence that
 * NinFit itself created that pause from stationary GPS evidence.
 */
export function loadJourneyPauseOrigin(
  storage: StorageAdapter,
  journeyId: string,
): JourneyPauseOrigin {
  const raw = storage.get(key(journeyId));
  return raw === 'auto_stationary' ? 'auto_stationary' : 'manual';
}

export function saveJourneyPauseOrigin(
  storage: StorageAdapter,
  journeyId: string,
  origin: JourneyPauseOrigin,
): void {
  storage.set(key(journeyId), origin);
}

export function clearJourneyPauseOrigin(storage: StorageAdapter, journeyId: string): void {
  storage.remove(key(journeyId));
}
