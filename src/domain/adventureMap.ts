import type { Journey, JourneyGpsPoint } from './journey';
import { journeyTrustedRouteSegments } from './journeyRouteSegments';

export interface AdventureMapSnapshot {
  /** Trusted observed runs only. Separate runs stay separate so gaps are never invented. */
  segments: JourneyGpsPoint[][];
  /** Journey identities are kept for later memory/presentation work without duplicating truth. */
  mappedJourneyIds: string[];
  mappedJourneyCount: number;
  segmentCount: number;
  pointCount: number;
}

function isDurableJourney(journey: Journey): boolean {
  return journey.status === 'completed' || journey.status === 'imported';
}

/**
 * Builds the first Living Fitness Adventure map from existing Journey truth.
 *
 * This is intentionally a projection, not a second store. Journey history remains
 * authoritative. A route contributes only when NinFit has explicit segmentation
 * evidence and at least two trusted points in that observed run. Missing evidence
 * stays missing, and runs from different Journeys are never joined together.
 */
export function adventureMapSnapshot(journeys: readonly Journey[]): AdventureMapSnapshot {
  const segments: JourneyGpsPoint[][] = [];
  const mappedJourneyIds: string[] = [];
  let pointCount = 0;

  for (const journey of journeys) {
    if (!isDurableJourney(journey)) continue;

    const drawable = journeyTrustedRouteSegments(journey)
      .filter((segment) => segment.length >= 2);

    if (drawable.length === 0) continue;

    mappedJourneyIds.push(journey.id);
    for (const segment of drawable) {
      segments.push(segment);
      pointCount += segment.length;
    }
  }

  return {
    segments,
    mappedJourneyIds,
    mappedJourneyCount: mappedJourneyIds.length,
    segmentCount: segments.length,
    pointCount,
  };
}
