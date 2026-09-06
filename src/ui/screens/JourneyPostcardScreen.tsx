import { lazy, Suspense, useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { RegionErrorBoundary } from '../components/RegionErrorBoundary';
import { loadJourneyHistory } from '../../storage/journeyHistory';
import { formatJourneyDistance, formatJourneyDuration } from '../journeyPresentation';
import {
  journeyPostcardModel,
  journeyPostcardRouteMessage,
} from '../journeyPostcardPresentation';

const JourneyRouteMap = lazy(async () => {
  const module = await import('../components/JourneyRouteMap');
  return { default: module.JourneyRouteMap };
});

interface JourneyPostcardScreenProps {
  journeyId: string;
  onClose(): void;
}

export function JourneyPostcardScreen({ journeyId, onClose }: JourneyPostcardScreenProps) {
  const storage = useMemo(() => getAppContext().adapter, []);
  const journey = useMemo(
    () => loadJourneyHistory(storage).find((item) => item.id === journeyId) ?? null,
    [journeyId, storage],
  );

  if (journey === null) {
    return (
      <section className="journey-postcard journey-postcard--missing" aria-labelledby="journey-postcard-title">
        <button type="button" className="journey-postcard__back" onClick={onClose}>
          <span aria-hidden="true">←</span>
          <span>Journey detail</span>
        </button>
        <div className="journey-postcard__missing-panel">
          <p className="journey-postcard__eyebrow">Journey Postcard</p>
          <h1 id="journey-postcard-title">Journey not found</h1>
          <p>This saved Journey is no longer available on this device.</p>
        </div>
      </section>
    );
  }

  const postcard = journeyPostcardModel(journey);
  const completed = new Date(postcard.completedAt);
  const hasRoute = postcard.route.segments.length > 0;

  return (
    <section className="journey-postcard" aria-labelledby="journey-postcard-title">
      <header className="journey-postcard__header">
        <button type="button" className="journey-postcard__back" onClick={onClose}>
          <span aria-hidden="true">←</span>
          <span>Journey detail</span>
        </button>
        <div>
          <p className="journey-postcard__eyebrow">Preview</p>
          <h1 id="journey-postcard-title">Journey Postcard</h1>
          <p className="journey-postcard__intro">
            A privacy-safe memory of this Journey. Sharing and export are not enabled yet.
          </p>
        </div>
      </header>

      <article className="journey-postcard__card" aria-label="Journey Postcard preview">
        <div className="journey-postcard__identity">
          <span>NinFit Journey</span>
          <strong>{postcard.activityLabel}</strong>
        </div>

        <div className="journey-postcard__route">
          {hasRoute ? (
            <RegionErrorBoundary
              fallback={
                <div className="journey-postcard__route-message" role="status">
                  <strong>Route not shown</strong>
                  <span>The Postcard remains available without its map.</span>
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="journey-postcard__route-message" role="status" aria-live="polite">
                    Loading privacy-safe route...
                  </div>
                }
              >
                <JourneyRouteMap
                  segments={postcard.route.segments}
                  latestPoint={null}
                  view="overview"
                  ariaLabel="Privacy-safe route preview for this Journey Postcard"
                  unavailableMessage="The Postcard remains available without its map."
                />
              </Suspense>
            </RegionErrorBoundary>
          ) : (
            <div className="journey-postcard__route-message">
              <span className="journey-postcard__route-mark" aria-hidden="true">N</span>
              <strong>Route not shown</strong>
              <span>{journeyPostcardRouteMessage(postcard.routeState)}</span>
            </div>
          )}
        </div>

        <div className="journey-postcard__stats">
          <div>
            <span>Distance</span>
            <strong>
              {postcard.distanceM > 0 ? `${formatJourneyDistance(postcard.distanceM)} km` : 'Not recorded'}
            </strong>
          </div>
          <div>
            <span>Active time</span>
            <strong>{formatJourneyDuration(postcard.activeSeconds)}</strong>
          </div>
        </div>

        <footer className="journey-postcard__footer">
          <span>
            {completed.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <span>{journeyPostcardRouteMessage(postcard.routeState)}</span>
        </footer>
      </article>

      <p className="journey-postcard__privacy-note">
        This preview is generated from the saved Journey and its privacy settings. It does not change the original fitness record.
      </p>
    </section>
  );
}
