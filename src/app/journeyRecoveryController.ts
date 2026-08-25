import type { ISODateTime } from '../domain/types';
import type { Journey } from '../domain/journey';
import { completeJourney, pauseJourney, resumeJourney } from '../domain/journeyRecorder';
import type { StorageAdapter } from '../storage/StorageAdapter';
import {
  clearActiveJourneySnapshot,
  loadActiveJourneySnapshot,
  saveActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';
import { saveJourneyToHistory } from '../storage/journeyHistory';

export interface JourneyRecoveryController {
  load(): Journey | null;
  save(journey: Journey, savedAt: ISODateTime): Journey;
  pause(journey: Journey, pausedAt: ISODateTime): Journey;
  resume(journey: Journey, resumedAt: ISODateTime): Journey;
  complete(journey: Journey, completedAt: ISODateTime): Journey;
  discard(): void;
}

/**
 * Small application-layer coordinator joining pure recorder transitions to local
 * persistence. Active recording state lives in the recovery slot; completion is first
 * written to durable Journey history and only then clears recovery evidence.
 */
export function createJourneyRecoveryController(storage: StorageAdapter): JourneyRecoveryController {
  return {
    load() {
      return loadActiveJourneySnapshot(storage)?.journey ?? null;
    },

    save(journey, savedAt) {
      saveActiveJourneySnapshot(storage, journey, savedAt);
      return journey;
    },

    pause(journey, pausedAt) {
      const next = pauseJourney(journey, pausedAt);
      saveActiveJourneySnapshot(storage, next, pausedAt);
      return next;
    },

    resume(journey, resumedAt) {
      const next = resumeJourney(journey, resumedAt);
      saveActiveJourneySnapshot(storage, next, resumedAt);
      return next;
    },

    complete(journey, completedAt) {
      const next = completeJourney(journey, completedAt);
      saveJourneyToHistory(storage, next);
      clearActiveJourneySnapshot(storage);
      return next;
    },

    discard() {
      clearActiveJourneySnapshot(storage);
    },
  };
}
