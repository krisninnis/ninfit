import { useMemo, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyLaunchController } from '../../app/journeyLaunchController';
import { visibleMascotFamily } from '../../domain/game/mascot';
import type { JourneyActivityType } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import { JOURNEY_ACTIVE_HASH } from '../tabs';
import {
  activityTypesForFamily,
  journeyActivityFamily,
  journeyActivityLabel,
  type JourneyActivityFamilyId,
} from '../journeyActivityFamilies';
import { mascotActivityArt } from '../mascotActivityArt';

/**
 * "Your companion is ready to head out with you."
 *
 * A DOOR, NOT A RECORDER. Everything this screen does is choose an activity type and
 * then call the launch controller Journey Home has always called. It starts no
 * geolocation watcher, owns no route, holds no session, and knows nothing about pause,
 * resume, stop, recovery or privacy - all of which already exist and all of which stay
 * exactly where they are. Pressing Start lands the user in the same live Journey
 * experience they would have reached before this screen existed.
 *
 * THE ACTIVITY IS CHOSEN, NEVER INFERRED.
 *
 * Nothing here looks at speed, pace, distance, GPS or the artwork to decide whether
 * this is a walk or a run. The person says which, and that answer becomes the Journey's
 * activity type. That is the whole reason the two share a door but not a type: a walked
 * five kilometres must never be able to turn into a running personal best.
 *
 * AND THERE IS NO DEFAULT. Start stays unavailable until walk or run is chosen. A
 * default would be a guess about someone's activity written into their permanent
 * fitness history, and the screen it replaces never guessed either - it offered four
 * explicit tiles. Making the user tap once more is a much smaller cost than a
 * mis-recorded Journey they have to notice and correct.
 */

interface JourneyLaunchScreenProps {
  family: JourneyActivityFamilyId;
  onClose(): void;
}

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

export function JourneyLaunchScreen({ family, onClose }: JourneyLaunchScreenProps) {
  const storage = useMemo(() => getAppContext().adapter, []);
  const repository = useMemo(() => getAppContext().repository, []);
  const launch = useMemo(() => createJourneyLaunchController(storage), [storage]);

  const [selected, setSelected] = useState<JourneyActivityType | undefined>(undefined);

  const definition = journeyActivityFamily(family);
  const choices = activityTypesForFamily(family);

  /*
   * Read, never synced - the same rule Journey Home follows. `useGame()` would call
   * `syncGame`, which grants rewards, and a screen about heading out for a walk has no
   * business granting anything.
   */
  const gameState = repository.getGameState();
  const mascot = gameState === undefined ? undefined : visibleMascotFamily(gameState.mascot);
  const art = mascot === undefined ? undefined : mascotActivityArt(mascot.id, family);

  const start = () => {
    if (selected === undefined) return;
    /*
     * The existing controller, unchanged. It is also the reason this screen needs no
     * opinion about an interrupted recording: `start` returns the unfinished Journey
     * rather than overwriting it, so recovery evidence survives a stray tap here.
     */
    launch.start(selected, nowIso());
    window.location.hash = JOURNEY_ACTIVE_HASH;
  };

  return (
    <section className="journey-launch" aria-labelledby="journey-launch-title">
      <button type="button" className="journey-launch__back" onClick={onClose}>
        <span aria-hidden="true">←</span>
        <span>Journey</span>
      </button>

      <header className="journey-launch__header">
        <p className="journey-launch__eyebrow">Living Journey</p>
        <h1 id="journey-launch-title">{definition?.label ?? 'Journey'}</h1>
      </header>

      {/*
        THE COMPANION, AT THE SIZE THIS MOMENT DESERVES.

        `mascotActivityArt` answers `undefined` for every species and family without
        reviewed artwork, which is still almost all of them, and the letter below is
        the same temporary fallback the rest of the app uses. The tortoise having a
        picture does not make that branch dead code - it is what a bear still gets.
        Both are aria-hidden, because the name beside them is the real answer to
        "who is this".
      */}
      <div className="journey-launch__companion">
        {/*
          `data-art` is presentation only: it tells the stylesheet whether it is
          framing a finished picture or standing in for one. It is NOT a second way of
          asking whether artwork exists - `art` above is the only one - and nothing
          behavioural reads it.
        */}
        <div
          className="journey-launch__portrait"
          data-art={art !== undefined ? 'true' : 'false'}
          aria-hidden="true"
        >
          {art !== undefined ? (
            <img src={art.src} alt="" />
          ) : (
            <span className="journey-launch__portrait-mark">{mascot?.glyph ?? '·'}</span>
          )}
        </div>
        {mascot !== undefined ? (
          <p className="journey-launch__companion-name">{mascot.name} is ready.</p>
        ) : null}
      </div>

      <fieldset className="journey-launch__choice">
        <legend className="journey-launch__choice-legend">Choose your activity</legend>
        {choices.map((activityType) => (
          <label
            key={activityType}
            className="journey-launch__option"
            data-selected={selected === activityType ? 'true' : 'false'}
          >
            <input
              type="radio"
              name="journey-activity"
              value={activityType}
              checked={selected === activityType}
              onChange={() => setSelected(activityType)}
            />
            <span>{journeyActivityLabel(activityType)}</span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        className="btn btn--primary btn--block journey-launch__start"
        onClick={start}
        disabled={selected === undefined}
      >
        {selected === undefined ? 'Choose walk or run' : `Start ${journeyActivityLabel(selected)}`}
      </button>

      {/*
        Readiness, stated rather than promised. Both lines are facts about how the
        existing recorder behaves; neither claims anything this slice does not do.
      */}
      <p className="journey-launch__note">
        Location is used only while a Journey is recording.
      </p>
      <p className="journey-launch__note">
        Journeys stay private on this device by default.
      </p>
    </section>
  );
}
