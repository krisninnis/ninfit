import type { Journey } from '../domain/journey';
import {
  ingestJourneyGpsSample,
  type JourneyGpsIngestOptions,
  type JourneyGpsRuntimeIds,
  type JourneyGpsRuntimeResult,
} from '../domain/journeyGpsRuntime';
import type { JourneyGpsSample } from '../domain/journeyGps';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

export interface JourneyGpsRuntimeController {
  ingest(
    journey: Journey,
    sample: JourneyGpsSample,
    options?: JourneyGpsIngestOptions,
  ): JourneyGpsRuntimeResult;
}

/**
 * Application-layer bridge from the live GPS stream to the active recovery slot.
 * Only accepted Journey mutations are persisted; rejected samples cannot overwrite
 * the last trustworthy recovery state.
 */
export function createJourneyGpsRuntimeController(
  storage: StorageAdapter,
  ids: JourneyGpsRuntimeIds,
): JourneyGpsRuntimeController {
  return {
    ingest(journey, sample, options) {
      const result = ingestJourneyGpsSample(journey, sample, ids, options);
      if (result.accepted) {
        saveActiveJourneySnapshot(storage, result.journey, sample.recordedAt);
      }
      return result;
    },
  };
}
