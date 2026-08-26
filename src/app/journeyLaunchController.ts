import { DEFAULT_JOURNEY_PRIVACY, type Journey, type JourneyActivityType, type JourneySource } from '../domain/journey';
import { newId, type IdFactory } from '../domain/ids';
import type { ISODateTime } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';

export interface JourneyLaunchResult {
  journey: Journey;
  created: boolean;
}

export interface JourneyLaunchController {
  loadActive(): Journey | null;
  start(activityType: JourneyActivityType, startedAt: ISODateTime): JourneyLaunchResult;
}

export function journeyUsesPhoneGps(activityType: JourneyActivityType): boolean {
  return activityType !== 'swim';
}

function sourceForActivity(activityType: JourneyActivityType, idFactory: IdFactory): JourneySource {
  if (!journeyUsesPhoneGps(activityType)) {
    return {
      id: idFactory(),
      kind: 'manual',
      observedBy: 'user',
      transportedBy: 'manual',
      importedBy: 'ninfit',
    };
  }

  return {
    id: idFactory(),
    kind: 'ninfit_phone_gps',
    observedBy: 'browser_geolocation',
    transportedBy: 'direct',
    importedBy: 'ninfit',
  };
}

/**
 * Creates the single unfinished Journey owned by this device, or returns the one that
 * already exists. Starting again must never overwrite recovery evidence from an
 * interrupted recording.
 */
export function createJourneyLaunchController(
  storage: StorageAdapter,
  idFactory: IdFactory = newId,
): JourneyLaunchController {
  return {
    loadActive() {
      return loadActiveJourneySnapshot(storage)?.journey ?? null;
    },

    start(activityType, startedAt) {
      const existing = loadActiveJourneySnapshot(storage)?.journey;
      if (existing) return { journey: existing, created: false };

      const journey: Journey = {
        id: idFactory(),
        activityType,
        status: 'recording',
        startedAt,
        pauses: [],
        metrics: [],
        sources: [sourceForActivity(activityType, idFactory)],
        privacy: { ...DEFAULT_JOURNEY_PRIVACY },
        createdAt: startedAt,
        updatedAt: startedAt,
      };

      saveActiveJourneySnapshot(storage, journey, startedAt);
      return { journey, created: true };
    },
  };
}
