import type { Journey } from '../../domain/journey';
import { journeyTrustedRouteSegments } from '../../domain/journeyRouteSegments';
import { journeyLatestTrustedPoint } from '../journeyMapPresentation';
import { JourneyRouteMap } from './JourneyRouteMap';

interface ActiveJourneyMapProps {
  journey: Pick<Journey, 'route'>;
  ariaLabel?: string;
  unavailableMessage?: string;
  view?: 'follow' | 'overview';
}

export function ActiveJourneyMap({
  journey,
  ariaLabel = 'Map of the trusted Journey route and latest trusted position',
  unavailableMessage = 'Your Journey recording continues safely.',
  view = 'follow',
}: ActiveJourneyMapProps) {
  return (
    <JourneyRouteMap
      segments={journeyTrustedRouteSegments(journey)}
      latestPoint={journeyLatestTrustedPoint(journey)}
      ariaLabel={ariaLabel}
      unavailableMessage={unavailableMessage}
      view={view}
    />
  );
}
