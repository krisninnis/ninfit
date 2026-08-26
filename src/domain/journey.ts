import type { ISODateTime, UUID } from './types';

export type JourneyActivityType = 'walk' | 'run' | 'hike' | 'cycle' | 'swim' | 'other';

export type JourneyStatus = 'recording' | 'paused' | 'completed' | 'imported';

export type JourneySourceKind =
  | 'ninfit_phone_gps'
  | 'fitbit'
  | 'health_connect'
  | 'apple_watch'
  | 'healthkit'
  | 'manual'
  | 'other';

export type JourneyTransportKind = 'direct' | 'health_connect' | 'healthkit' | 'manual' | 'other';

export type JourneyMetricKind =
  | 'distance_m'
  | 'heart_rate_bpm'
  | 'steps'
  | 'elevation_gain_m'
  | 'elapsed_seconds'
  | 'moving_seconds';

export type JourneyVisibility = 'private' | 'summary_only' | 'masked_route' | 'full_route';

export interface JourneySource {
  id: UUID;
  kind: JourneySourceKind;
  observedBy: string;
  transportedBy: JourneyTransportKind;
  importedBy: 'ninfit';
  externalRecordId?: string;
}

export interface JourneyMetricObservation {
  id: UUID;
  kind: JourneyMetricKind;
  value: number;
  observedAt?: ISODateTime;
  sourceId: UUID;
  derived?: boolean;
}

export interface JourneyGpsPoint {
  latitude: number;
  longitude: number;
  recordedAt: ISODateTime;
  accuracyM?: number;
  altitudeM?: number;
  speedMps?: number;
  headingDeg?: number;
}

export interface JourneyRoute {
  rawPoints: JourneyGpsPoint[];
  acceptedPoints: JourneyGpsPoint[];
}

export interface JourneyPrivacy {
  visibility: JourneyVisibility;
  maskSensitiveStartEnd: boolean;
  preciseRouteCloudSync: boolean;
}

export interface JourneyPause {
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
}

export interface Journey {
  id: UUID;
  activityType: JourneyActivityType;
  status: JourneyStatus;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  pauses: JourneyPause[];
  route?: JourneyRoute;
  metrics: JourneyMetricObservation[];
  sources: JourneySource[];
  privacy: JourneyPrivacy;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const DEFAULT_JOURNEY_PRIVACY: JourneyPrivacy = {
  visibility: 'private',
  maskSensitiveStartEnd: true,
  preciseRouteCloudSync: false,
};

function epochMs(value: ISODateTime): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISODateTime: ${value}`);
  return parsed;
}

/** Total wall-clock seconds from start to end (or now), independent of pauses. */
export function journeyElapsedSeconds(journey: Pick<Journey, 'startedAt' | 'endedAt'>, now?: ISODateTime): number {
  const end = journey.endedAt ?? now;
  if (!end) return 0;
  return Math.max(0, Math.floor((epochMs(end) - epochMs(journey.startedAt)) / 1000));
}

/** Explicit user-paused seconds. Open pauses use `now`; completed pauses require `endedAt`. */
export function journeyPausedSeconds(
  journey: Pick<Journey, 'pauses'>,
  now?: ISODateTime,
): number {
  let totalMs = 0;

  for (const pause of journey.pauses) {
    const end = pause.endedAt ?? now;
    if (!end) continue;
    totalMs += Math.max(0, epochMs(end) - epochMs(pause.startedAt));
  }

  return Math.floor(totalMs / 1000);
}

/** Elapsed time minus explicit pauses. It is not GPS-derived moving time. */
export function journeyActiveSeconds(
  journey: Pick<Journey, 'startedAt' | 'endedAt' | 'pauses'>,
  now?: ISODateTime,
): number {
  return Math.max(0, journeyElapsedSeconds(journey, now) - journeyPausedSeconds(journey, now));
}

export function sourceForObservation(
  journey: Pick<Journey, 'sources'>,
  observation: Pick<JourneyMetricObservation, 'sourceId'>,
): JourneySource | undefined {
  return journey.sources.find((source) => source.id === observation.sourceId);
}

/** Rewards and later reconciliation operate on Journey identity, never source count. */
export function hasDistinctSourceIds(journey: Pick<Journey, 'sources'>): boolean {
  return new Set(journey.sources.map((source) => source.id)).size === journey.sources.length;
}
