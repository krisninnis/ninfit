import { newId, type IdFactory } from '../domain/ids';
import type { Journey } from '../domain/journey';
import type { StorageAdapter } from '../storage/StorageAdapter';
import {
  createActiveJourneyGpsSession,
  type ActiveJourneyGpsSession,
  type ActiveJourneyGpsSessionRuntimeError,
} from './activeJourneyGpsSession';
import type { JourneyGeolocationAdapterOptions, JourneyGeolocationWatch } from './journeyGeolocationAdapter';
import { createJourneyGpsRuntimeController } from './journeyGpsRuntimeController';

export interface ForegroundJourneyGpsSessionOptions {
  storage: StorageAdapter;
  journey: Journey;
  onJourneyChanged?(journey: Journey): void;
  onError?(error: GeolocationPositionError): void;
  onRuntimeError?(error: ActiveJourneyGpsSessionRuntimeError): void;
  idFactory?: IdFactory;
  startWatch?(options: JourneyGeolocationAdapterOptions): JourneyGeolocationWatch;
}

function directPhoneGpsSourceId(journey: Journey): string {
  const source = journey.sources.find(
    (candidate) =>
      candidate.kind === 'ninfit_phone_gps' && candidate.transportedBy === 'direct',
  );
  if (!source) throw new Error('Foreground Journey requires a direct ninfit_phone_gps source');
  return source.id;
}

/**
 * Binds a recoverable Journey to the already-hardened foreground GPS stack.
 * Runtime identifiers come from stored Journey evidence wherever possible, so a
 * reload/resume continues the same source and distance observation identity.
 */
export function startForegroundJourneyGpsSession(
  options: ForegroundJourneyGpsSessionOptions,
): ActiveJourneyGpsSession {
  if (options.journey.status !== 'recording') {
    throw new Error('Foreground GPS can only start for a recording Journey');
  }

  const idFactory = options.idFactory ?? newId;
  const phoneGpsSourceId = directPhoneGpsSourceId(options.journey);
  const distanceMetricId =
    options.journey.metrics.find((metric) => metric.kind === 'distance_m')?.id ?? idFactory();
  const runtimeController = createJourneyGpsRuntimeController(options.storage, {
    phoneGpsSourceId,
    distanceMetricId,
  });

  return createActiveJourneyGpsSession({
    initialJourney: options.journey,
    runtimeController,
    onJourneyChanged: options.onJourneyChanged,
    onError: options.onError,
    onRuntimeError: options.onRuntimeError,
    startWatch: options.startWatch,
  });
}
