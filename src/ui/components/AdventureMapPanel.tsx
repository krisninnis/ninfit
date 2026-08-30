import { lazy, Suspense } from 'react';
import type { AdventureMapSnapshot } from '../../domain/adventureMap';

const JourneyRouteMap = lazy(async () => {
  const module = await import('./JourneyRouteMap');
  return { default: module.JourneyRouteMap };
});

interface AdventureMapPanelProps {
  snapshot: AdventureMapSnapshot;
}

export function AdventureMapPanel({ snapshot }: AdventureMapPanelProps) {
  const hasRoute = snapshot.segments.length > 0;

  return (
    <div data-adventure-map-panel="true" role="region" aria-label="Adventure Map">
      <div className="journey-detail__facts" aria-label="Adventure Map facts">
        <div>
          <span>Mapped Journeys</span>
          <strong>{snapshot.mappedJourneyCount}</strong>
        </div>
        <div>
          <span>Observed route runs</span>
          <strong>{snapshot.segmentCount}</strong>
        </div>
        <div>
          <span>Trusted route points</span>
          <strong>{snapshot.pointCount}</strong>
        </div>
        <div>
          <span>Storage</span>
          <strong>On this device</strong>
        </div>
      </div>

      {hasRoute ? (
        <div className="journey-detail__map-frame">
          <Suspense
            fallback={
              <div className="journey-detail__map-message" role="status" aria-live="polite">
                Building your Adventure Map...
              </div>
            }
          >
            <JourneyRouteMap
              segments={snapshot.segments}
              latestPoint={null}
              ariaLabel="Private map of trusted route segments from completed Journeys"
              unavailableMessage="Your saved Journey history is still available without the map."
              view="overview"
            />
          </Suspense>
        </div>
      ) : (
        <div className="journey-detail__map-message">
          Complete a Journey with a trusted route and it can begin to appear here.
        </div>
      )}

      <p className="journey-detail__privacy-note">
        Only trusted route segments already saved on this device are drawn. Gaps stay gaps; NinFit does not guess where you went.
      </p>
    </div>
  );
}
