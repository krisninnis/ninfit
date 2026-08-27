import type { Journey } from '../domain/journey';
import {
  projectJourneyRouteForDisclosure,
  type JourneyRoutePrivacyProjection,
} from '../domain/journeyRoutePrivacy';
import {
  journeyActivityLabel,
  journeyDetailFacts,
} from './journeyDetailPresentation';

export type JourneyPostcardRouteState =
  | 'private'
  | 'summary_only'
  | 'masked'
  | 'full'
  | 'no_drawable_route';

export interface JourneyPostcardModel {
  activityLabel: string;
  distanceM: number;
  activeSeconds: number;
  completedAt: string;
  route: JourneyRoutePrivacyProjection;
  routeState: JourneyPostcardRouteState;
}

function routeState(
  journey: Pick<Journey, 'privacy'>,
  projection: JourneyRoutePrivacyProjection,
): JourneyPostcardRouteState {
  if (journey.privacy.visibility === 'private') return 'private';
  if (journey.privacy.visibility === 'summary_only') return 'summary_only';
  if (projection.segments.length === 0) return 'no_drawable_route';
  return projection.masked ? 'masked' : 'full';
}

export function journeyPostcardModel(journey: Journey): JourneyPostcardModel {
  const facts = journeyDetailFacts(journey);
  const route = projectJourneyRouteForDisclosure(journey);

  return {
    activityLabel: journeyActivityLabel(journey.activityType),
    distanceM: facts.distanceM,
    activeSeconds: facts.activeSeconds,
    completedAt: journey.endedAt ?? journey.startedAt,
    route,
    routeState: routeState(journey, route),
  };
}

export function journeyPostcardRouteMessage(state: JourneyPostcardRouteState): string {
  switch (state) {
    case 'private':
      return 'Route hidden because this Journey is private.';
    case 'summary_only':
      return 'Route hidden because this Journey allows summary only.';
    case 'masked':
      return 'Sensitive start and end areas are hidden.';
    case 'full':
      return 'Full route allowed by the saved privacy settings.';
    case 'no_drawable_route':
      return 'No privacy-safe route is available to draw.';
  }
}
