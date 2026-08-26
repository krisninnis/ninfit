import { useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyLaunchController } from '../../app/journeyLaunchController';
import type { Journey, JourneyActivityType } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import { loadJourneyHistory } from '../../storage/journeyHistory';
import { JOURNEY_ACTIVE_HASH } from '../tabs';
import { formatJourneyDistance, journeyDistanceM } from '../journeyPresentation';

const PRIMARY_ACTIVITIES: ReadonlyArray<{
  type: Extract<JourneyActivityType, 'walk' | 'run' | 'cycle' | 'swim'>;
  label: string;
  note: string;
  mark: string;
}> = [
  { type: 'walk', label: 'Walk', note: 'GPS route and distance', mark: 'W' },
  { type: 'run', label: 'Run', note: 'GPS route and distance', mark: 'R' },
  { type: 'cycle', label: 'Cycle', note: 'GPS route and distance', mark: 'C' },
  { type: 'swim', label: 'Swim', note: 'Pool or wearable distance later', mark: 'S' },
];

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

function activityLabel(activityType: JourneyActivityType): string {
  return activityType.charAt(0).toUpperCase() + activityType.slice(1);
}

function openActiveJourney() {
  window.location.hash = JOURNEY_ACTIVE_HASH;
}

function RecentJourney({ journey }: { journey: Journey }) {
  const distance = journeyDistanceM(journey);
  const date = new Date(journey.endedAt ?? journey.startedAt);
  return (
    <li className="journey-home__recent-item">
      <div>
        <strong>{activityLabel(journey.activityType)}</strong>
        <span>{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
      </div>
      <span>{distance > 0 ? `${formatJourneyDistance(distance)} km` : 'Completed'}</span>
    </li>
  );
}

export function JourneyScreen() {
  const storage = useMemo(() => getAppContext().adapter, []);
  const launch = useMemo(() => createJourneyLaunchController(storage), [storage]);
  const active = launch.loadActive();
  const recent = loadJourneyHistory(storage).slice(0, 3);

  const start = (activityType: JourneyActivityType) => {
    launch.start(activityType, nowIso());
    openActiveJourney();
  };

  return (
    <section className="journey-home" aria-labelledby="journey-home-title">
      <header className="journey-home__header">
        <p className="journey-home__eyebrow">Living Journey</p>
        <h1 id="journey-home-title">Journey</h1>
        {/*
         * The invitation, separated from the privacy line it used to share a sentence
         * with. One is the question the four tiles answer; the other is a reassurance
         * that belongs at the foot of the screen, not in second place.
         */}
        <p className="journey-home__invitation">
          {active ? 'You have a Journey still going.' : 'Where are we going today?'}
        </p>
      </header>

      {active ? (
        <button type="button" className="journey-home__continue" onClick={openActiveJourney}>
          <span>
            <small>Continue Journey</small>
            <strong>{activityLabel(active.activityType)}</strong>
          </span>
          <span>{formatJourneyDistance(journeyDistanceM(active))} km</span>
        </button>
      ) : (
        <div className="journey-home__activities" aria-label="Start a Journey">
          {PRIMARY_ACTIVITIES.map((activity) => (
            <button
              key={activity.type}
              type="button"
              className="journey-home__activity"
              onClick={() => start(activity.type)}
            >
              <span className="journey-home__activity-mark" aria-hidden="true">{activity.mark}</span>
              <span>
                <strong>{activity.label}</strong>
                <small>{activity.note}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="journey-home__recent" aria-labelledby="journey-recent-title">
        <div className="journey-home__section-heading">
          <h2 id="journey-recent-title">Recent Journeys</h2>
          <span>{recent.length > 0 ? `${recent.length} shown` : 'Your history starts here'}</span>
        </div>
        {recent.length > 0 ? (
          <ul className="journey-home__recent-list">
            {recent.map((journey) => <RecentJourney key={journey.id} journey={journey} />)}
          </ul>
        ) : (
          <p className="journey-home__empty">Completed walks, runs, cycles and swims will appear here.</p>
        )}
      </section>

      <p className="journey-home__note">
        Journeys stay private on this device by default.
      </p>
    </section>
  );
}
