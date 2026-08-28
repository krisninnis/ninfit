import { useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyLaunchController } from '../../app/journeyLaunchController';
import { createDefaultGameSettings } from '../../domain/game/defaults';
import { visibleMascotFamily } from '../../domain/game/mascot';
import type { Journey, JourneyActivityType } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import { loadJourneyHistory } from '../../storage/journeyHistory';
import { JOURNEY_ACTIVE_HASH, journeyDetailHash, journeyLaunchHash } from '../tabs';
import {
  JOURNEY_ACTIVITY_FAMILIES,
  journeyActivityLabel,
  type JourneyActivityFamily,
} from '../journeyActivityFamilies';
import { JourneyCompanion } from '../components/JourneyCompanion';
import { journeyCompanionPresence } from '../journeyCompanionPresentation';
import { formatJourneyDistance, journeyDistanceM } from '../journeyPresentation';

/*
 * THE DOORS ARE FAMILIES; WHAT GETS RECORDED IS STILL AN ACTIVITY TYPE.
 *
 * Walk and Run share one door because that is one decision - am I going out on foot -
 * and two answers. They do NOT share a type: the launch screen behind that door asks
 * which, and a walk is recorded as a walk. Nothing here merges them, and nothing
 * downstream may either.
 *
 * Cycle and Swim keep the one-tap start they have always had. They record today, so
 * dressing them as "coming later" would be a lie in the other direction.
 */
function nowIso(): ISODateTime {
  return new Date().toISOString();
}

const activityLabel = journeyActivityLabel;

function openActiveJourney() {
  window.location.hash = JOURNEY_ACTIVE_HASH;
}

function RecentJourney({ journey }: { journey: Journey }) {
  const distance = journeyDistanceM(journey);
  const date = new Date(journey.endedAt ?? journey.startedAt);
  return (
    <li className="journey-home__recent-item">
      <button
        type="button"
        className="journey-home__recent-link"
        onClick={() => { window.location.hash = journeyDetailHash(journey.id); }}
      >
        <span className="journey-home__recent-copy">
          <strong>{activityLabel(journey.activityType)}</strong>
          <span>{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        </span>
        <span>{distance > 0 ? `${formatJourneyDistance(distance)} km` : 'Completed'}</span>
      </button>
    </li>
  );
}

export function JourneyScreen() {
  const storage = useMemo(() => getAppContext().adapter, []);
  const repository = useMemo(() => getAppContext().repository, []);
  const launch = useMemo(() => createJourneyLaunchController(storage), [storage]);
  const active = launch.loadActive();
  const history = loadJourneyHistory(storage);
  const recent = history.slice(0, 3);

  /*
   * THE COMPANION IS READ, NEVER SYNCED, FROM THIS SCREEN.
   *
   * `useGame()` is deliberately not used here. It calls `syncGame`, which derives and
   * GRANTS rewards and can write game state - and a screen about walking somewhere
   * has no business granting anything. `getGameState` and `getGameSettings` are plain
   * reads: no derivation, no grant, no write, and no fifth independent game instance
   * added to an architecture already carrying an open question about the four that
   * exist (see docs/CURRENT_STATE.md).
   *
   * Two booleans are all that crosses into the companion. Distance, duration, route
   * and every metric stay where they belong, on Journey's own presentation path.
   */
  const gameState = repository.getGameState();
  const settings = repository.getGameSettings() ?? createDefaultGameSettings();
  const companion = journeyCompanionPresence(
    gameState === undefined ? undefined : visibleMascotFamily(gameState.mascot),
    { hasActiveJourney: active !== null, hasCompletedJourney: history.length > 0 },
  );

  const start = (activityType: JourneyActivityType) => {
    launch.start(activityType, nowIso());
    openActiveJourney();
  };

  /*
   * A family with a companion screen goes THERE to choose its activity type. A family
   * without one starts exactly as it did before, with its single type. Journey Home
   * never picks between walk and run on the user's behalf - it only opens the door.
   */
  const open = (family: JourneyActivityFamily) => {
    if (family.launch === 'companion') {
      window.location.hash = journeyLaunchHash(family.id);
      return;
    }
    const [only] = family.activityTypes;
    if (only !== undefined) start(only);
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

      {/*
        THE PATH MASCOT IS JOURNEY HOME'S COMPANION PRESENCE.

        One low strip under the invitation, and nothing more. Opal is not a second
        character here for the same reason Opal is not one on Today: a guide who is
        permanently on screen saying nothing is furniture, and it would push the
        activity tiles - the reason this screen exists - further down the page.

        It is absent entirely before the egg hatches, because there is no companion to
        name yet and the animal is a secret until the user opens it themselves.
      */}
      {companion !== undefined ? (
        <JourneyCompanion
          presence={companion}
          personality={settings.mascotPersonality}
        />
      ) : null}

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
          {JOURNEY_ACTIVITY_FAMILIES.map((family) => (
            <button
              key={family.id}
              type="button"
              className="journey-home__activity"
              data-launch={family.launch}
              onClick={() => open(family)}
            >
              <span className="journey-home__activity-mark" aria-hidden="true">{family.mark}</span>
              <span>
                <strong>{family.label}</strong>
                <small>{family.note}</small>
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
