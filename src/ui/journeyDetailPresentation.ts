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

/**
 * Label the Journey's disclosure policy without implying that the owner loses access
 * to their own saved route. Owner detail/completion views always use the private
 * trusted route; these settings only govern what may leave that private view later.
 */
export function journeyPrivacyLabel(journey: Pick<Journey, 'privacy'>): string {
  switch (journey.privacy.visibility) {
    case 'private':
      return 'Private · visible only to you on this device';
    case 'summary_only':
      return 'Full private view for you · summary only if disclosed';
    case 'masked_route':
      return 'Full private view for you · route masked if disclosed';
    case 'full_route':
      return journey.privacy.maskSensitiveStartEnd
        ? 'Full private view for you · route ends masked if disclosed'
        : 'Full private view for you · full route permitted if disclosed';
  }
}
