import { lazy, Suspense, useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { journeyTrustedRouteSegments } from '../../domain/journeyRouteSegments';
import { loadJourneyHistory } from '../../storage/journeyHistory';
import {
  formatJourneyDistance,
  formatJourneyDuration,
} from '../journeyPresentation';
import {
  journeyActivityLabel,
  journeyDetailFacts,
  journeyPrivacyLabel,
} from '../journeyDetailPresentation';

const ActiveJourneyMap = lazy(async () => {
  const module = await import('../components/ActiveJourneyMap');
  return { default: module.ActiveJourneyMap };
});

interface JourneyDetailScreenProps {
  journeyId: string;
  onClose(): void;
  onPreviewPostcard(): void;
}

function completedDate(journey: { startedAt: string; endedAt?: string }): Date {
  return new Date(journey.endedAt ?? journey.startedAt);
}

export function JourneyDetailScreen({
  journeyId,
  onClose,
  onPreviewPostcard,
}: JourneyDetailScreenProps) {
  const storage = useMemo(() => getAppContext().adapter, []);
  const journey = useMemo(
    () => loadJourneyHistory(storage).find((item) => item.id === journeyId) ?? null,
    [journeyId, storage],
  );

  if (journey === null) {
    return (
      <section className="journey-detail journey-detail--missing" aria-labelledby="journey-detail-title">
        <button type="button" className="journey-detail__back" onClick={onClose}>
          <span aria-hidden="true">←</span>
          <span>Journey</span>
        </button>
        <div className="journey-detail__missing-panel">
          <p className="journey-detail__eyebrow">Saved Journey</p>
          <h1 id="journey-detail-title">Journey not found</h1>
          <p>This Journey is no longer in local history on this device.</p>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Back to Journey
          </button>
        </div>
      </section>
    );
  }

  const facts = journeyDetailFacts(journey);
  const when = completedDate(journey);
  const drawableRoute = journeyTrustedRouteSegments(journey)
    .some((segment) => segment.length >= 2);

  return (
    <section className="journey-detail" aria-labelledby="journey-detail-title">
      <header className="journey-detail__header">
        <button type="button" className="journey-detail__back" onClick={onClose}>
          <span aria-hidden="true">←</span>
          <span>Journey</span>
        </button>
        <div>
          <p className="journey-detail__eyebrow">Completed Journey</p>
          <h1 id="journey-detail-title">{journeyActivityLabel(journey.activityType)}</h1>
          <p className="journey-detail__date">
            {when.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {' · '}
            {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      <div className="journey-detail__hero">
        <div className="journey-detail__primary-stat">
          <span>Distance</span>
          <strong>{facts.distanceM > 0 ? formatJourneyDistance(facts.distanceM) : '—'}</strong>
          <small>{facts.distanceM > 0 ? 'km' : 'No distance recorded'}</small>
        </div>
        <div className="journey-detail__primary-stat">
          <span>Active time</span>
          <strong>{formatJourneyDuration(facts.activeSeconds)}</strong>
          <small>Pause-aware</small>
        </div>
      </div>

      <section className="journey-detail__route-section" aria-labelledby="journey-detail-route-title">
        <div className="journey-detail__section-heading">
          <div>
            <p className="journey-detail__eyebrow">Private local view</p>
            <h2 id="journey-detail-route-title">Route</h2>
          </div>
          <span>{journeyPrivacyLabel(journey)}</span>
        </div>

        {drawableRoute ? (
          <div className="journey-detail__map-frame">
            <Suspense
              fallback={
                <div className="journey-detail__map-message" role="status" aria-live="polite">
                  Loading saved route...
                </div>
              }
            >
              <ActiveJourneyMap
                journey={journey}
                ariaLabel="Map of this saved Journey's private trusted route"
                unavailableMessage="The saved Journey is still available without the map."
                view="overview"
              />
            </Suspense>
          </div>
        ) : (
          <div className="journey-detail__map-message">
            {journey.route?.acceptedPoints.length
              ? 'Route points are saved, but NinFit cannot prove enough continuous route to draw a truthful line.'
              : 'No trusted route was recorded for this Journey.'}
          </div>
        )}

        <p className="journey-detail__privacy-note">
          This exact route is visible only inside your private local Journey record. Any later disclosure must use the saved privacy rules.
        </p>
      </section>

      <div className="journey-detail__postcard-action">
        <button type="button" className="btn btn--primary" onClick={onPreviewPostcard}>
          Preview Journey Postcard
        </button>
        <p>Uses this Journey's saved privacy settings. Sharing is not enabled yet.</p>
      </div>

      <section className="journey-detail__facts" aria-label="Journey details">
        <div>
          <span>Elapsed time</span>
          <strong>{formatJourneyDuration(facts.elapsedSeconds)}</strong>
        </div>
        <div>
          <span>Paused time</span>
          <strong>{formatJourneyDuration(facts.pausedSeconds)}</strong>
        </div>
        <div>
          <span>Distance source</span>
          <strong>{facts.distanceSource ?? 'No distance source'}</strong>
        </div>
        <div>
          <span>Record type</span>
          <strong>{journey.status === 'imported' ? 'Imported Journey' : 'NinFit Journey'}</strong>
        </div>
      </section>
    </section>
  );
}
