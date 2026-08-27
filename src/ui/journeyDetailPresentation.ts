import {
  journeyActiveSeconds,
  journeyElapsedSeconds,
  journeyPausedSeconds,
  sourceForObservation,
  type Journey,
  type JourneyActivityType,
  type JourneySourceKind,
} from '../domain/journey';
import { journeyDistanceM } from './journeyPresentation';

export function journeyActivityLabel(activityType: JourneyActivityType): string {
  switch (activityType) {
    case 'walk': return 'Walk';
    case 'run': return 'Run';
    case 'hike': return 'Hike';
    case 'cycle': return 'Cycle';
    case 'swim': return 'Swim';
    default: return 'Journey';
  }
}

export function journeySourceKindLabel(kind: JourneySourceKind): string {
  switch (kind) {
    case 'ninfit_phone_gps': return 'NinFit phone GPS';
    case 'fitbit': return 'Fitbit';
    case 'health_connect': return 'Health Connect';
    case 'apple_watch': return 'Apple Watch';
    case 'healthkit': return 'Apple Health';
    case 'manual': return 'Manual entry';
    default: return 'Other source';
  }
}

export interface JourneyDetailFacts {
  distanceM: number;
  activeSeconds: number;
  elapsedSeconds: number;
  pausedSeconds: number;
  distanceSource: string | null;
}

export function journeyDetailFacts(
  journey: Pick<Journey, 'startedAt' | 'endedAt' | 'pauses' | 'metrics' | 'sources'>,
): JourneyDetailFacts {
  const distanceObservation = journey.metrics.find((metric) => metric.kind === 'distance_m');
  const distanceSource = distanceObservation
    ? sourceForObservation(journey, distanceObservation)
    : undefined;

  return {
    distanceM: journeyDistanceM(journey),
    activeSeconds: journeyActiveSeconds(journey),
    elapsedSeconds: journeyElapsedSeconds(journey),
    pausedSeconds: journeyPausedSeconds(journey),
    distanceSource: distanceSource ? journeySourceKindLabel(distanceSource.kind) : null,
  };
}

export function journeyPrivacyLabel(journey: Pick<Journey, 'privacy'>): string {
  switch (journey.privacy.visibility) {
    case 'private':
      return 'Private on this device';
    case 'summary_only':
      return 'Summary only outside your private record';
    case 'masked_route':
      return 'Route masking enabled for disclosure';
    case 'full_route':
      return journey.privacy.maskSensitiveStartEnd
        ? 'Sensitive route ends masked for disclosure'
        : 'Full route allowed by privacy settings';
  }
}
