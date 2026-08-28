import { useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyLaunchController } from '../../app/journeyLaunchController';
import { createDefaultGameSettings } from '../../domain/game/defaults';
import { journeyCompanionMessage } from '../../domain/game/journeyCompanionContext';
import { visibleMascotFamily } from '../../domain/game/mascot';
import { loadJourneyHistory } from '../../storage/journeyHistory';
import { journeyActivityFamilyForType } from '../journeyActivityFamilies';
import { journeyCompanionPresence } from '../journeyCompanionPresentation';
import { journeyActivityLabel, journeyDetailFacts } from '../journeyDetailPresentation';
import { formatJourneyDistance, formatJourneyDuration } from '../journeyPresentation';
import { mascotActivityArt } from '../mascotActivityArt';

/**
 * The moment after Finish - and nothing more than a moment.
 *
 * WHAT THIS SCREEN IS. A calm bridge between the recorder stopping and the durable
 * record. It reads one Journey that has ALREADY been completed and persisted by
 * `journeyRecoveryController.complete`, and shows two facts from it. It is the last
 * step of an outing, not a second one.
 *
 * WHAT IT IS NOT, AND MUST NEVER BECOME.
 *
 * It creates nothing. There is no second Journey record, no completion record, no
 * acknowledgement state, no "seen" flag, no write of any kind. Completion already
 * happened before this component existed on screen, which is the whole reason it is
 * safe for this to be a plain read: rendering it twice, reloading it, or opening it
 * from a bookmark cannot produce a second history entry, because rendering writes
 * nothing at all.
 *
 * IT IS A URL, NOT AN EVENT. Someone can open `#/journey/complete/<id>` tomorrow. So
 * everything here has to be true of that Journey whenever it is read, never true only
 * in the seconds after Finish. That rules out "just now", "today", and every other
 * freshness claim, and it is why the date shown is the recorded completion time
 * rather than a relative phrase.
 *
 * THE TRUTH BOUNDARY.
 *
 * Two numbers, both already computed by the same helpers Journey detail uses:
 * recorded distance and pause-aware active time. Nothing else. No personal best, no
 * fastest, no longest, no calories, no pace, no streak, no comparison to any other
 * Journey - none of which this app computes, and none of which presentation is
 * allowed to invent. A Journey with no distance observation says so plainly rather
 * than presenting a confident 0.00 km, because a zero that was never measured is a
 * fabricated fact wearing a number's clothes.
 *
 * IT GRANTS NOTHING, AND SAYS NOTHING WAS GRANTED. Finishing a Journey does not
 * currently produce a reward: `deriveRewards` reads daily logs, weekly plans and
 * measurements, and cannot see a Journey at all. So there is no XP line, no trophy,
 * no badge and no reward presenter here. Adding one would mean either bypassing the
 * durable delivery queue or inventing a grant, and both are forbidden.
 *
 * IT STARTS NOTHING. No geolocation, no watcher, no recorder, no launch controller
 * start. The only two ways out are the durable detail record and Journey Home.
 */

interface JourneyCompletionScreenProps {
  journeyId: string;
  onViewJourney(): void;
  onClose(): void;
}

export function JourneyCompletionScreen({
  journeyId,
  onViewJourney,
  onClose,
}: JourneyCompletionScreenProps) {
  const storage = useMemo(() => getAppContext().adapter, []);
  const repository = useMemo(() => getAppContext().repository, []);

  /*
   * The same read Journey detail performs, against the same durable history. Not a
   * copy of the Journey handed through navigation state: if it is not in history,
   * completion did not durably happen, and this screen must say so rather than
   * describe an object that only exists in memory.
   */
  const history = loadJourneyHistory(storage);
  const journey = useMemo(
    () => history.find((item) => item.id === journeyId) ?? null,
    [history, journeyId],
  );

  /*
   * Read, never synced - the rule every Journey screen follows. `useGame()` calls
   * `syncGame`, which grants rewards, and a screen that exists because someone
   * finished a walk must not be the thing that hands out anything.
   */
  const gameState = repository.getGameState();
  const settings = repository.getGameSettings() ?? createDefaultGameSettings();
  const mascot = gameState === undefined ? undefined : visibleMascotFamily(gameState.mascot);

  /*
   * Derived from actual state rather than asserted. After Finish there is no active
   * Journey and history is non-empty, so this lands on the warm standing line - but
   * it is read, not assumed, so revisiting this URL mid-Journey cannot make the
   * companion say something that stopped being true.
   */
  const launch = useMemo(() => createJourneyLaunchController(storage), [storage]);
  const presence = journeyCompanionPresence(mascot, {
    hasActiveJourney: launch.loadActive() !== null,
    hasCompletedJourney: history.length > 0,
  });
  const companionLine =
    presence === undefined
      ? undefined
      : journeyCompanionMessage(presence.context, settings.mascotPersonality);

  if (journey === null) {
    return (
      <section className="journey-completion" aria-labelledby="journey-completion-title">
        <header className="journey-completion__header">
          <p className="journey-completion__eyebrow">Living Journey</p>
          <h1 id="journey-completion-title">Journey not found</h1>
        </header>
        <p className="journey-completion__missing">
          This Journey is no longer in local history on this device.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          Back to Journey
        </button>
      </section>
    );
  }

  const facts = journeyDetailFacts(journey);
  const family = journeyActivityFamilyForType(journey.activityType);
  /*
   * Through the one boundary, never a path. `undefined` is the ordinary answer for
   * every species and family without reviewed artwork, and the screen simply shows no
   * picture rather than a broken image or somebody else's mascot.
   */
  const art =
    mascot === undefined || family === undefined
      ? undefined
      : mascotActivityArt(mascot.id, family);

  const completedAt = new Date(journey.endedAt ?? journey.startedAt);
  const hasDistance = facts.distanceM > 0;

  return (
    <section className="journey-completion" aria-labelledby="journey-completion-title">
      <header className="journey-completion__header">
        <p className="journey-completion__eyebrow">Living Journey</p>
        {/*
          The activity, stated as the completed fact it is. `journeyActivityLabel` is
          the reviewed wording Journey detail already uses, so a Walk cannot become a
          Run here by way of a second copy of the mapping.
        */}
        <h1 id="journey-completion-title">
          {journeyActivityLabel(journey.activityType)} complete
        </h1>
        <p className="journey-completion__when">
          {completedAt.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          {' · '}
          {completedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      {/*
        The companion, present rather than congratulating. The line comes from the
        reviewed Journey table in the domain, which contains no streak, no score and
        no praise for a number - and is allowed to be silent for the quiet
        personality. The picture is decorative; the name beside it is the real answer
        to "who is this".
      */}
      {presence !== undefined ? (
        <div className="journey-completion__companion">
          <div className="journey-completion__portrait" data-art={art !== undefined ? 'true' : 'false'} aria-hidden="true">
            {art !== undefined ? (
              <img src={art.src} alt="" />
            ) : (
              <span className="journey-completion__portrait-mark">{presence.family.glyph}</span>
            )}
          </div>
          <p className="journey-completion__companion-name">{presence.family.name}</p>
          {companionLine !== undefined ? (
            <p className="journey-completion__companion-line">{companionLine}</p>
          ) : null}
        </div>
      ) : null}

      <dl className="journey-completion__facts">
        <div className="journey-completion__fact">
          <dt>Distance</dt>
          {/*
            A distance that was never observed is not zero. `journeyDistanceM` returns
            0 both for "measured nothing" and "no observation at all", so the honest
            treatment is the same em dash Journey detail uses rather than a confident
            0.00 km somebody might reasonably believe.
          */}
          <dd className="journey-completion__value">
            {hasDistance ? formatJourneyDistance(facts.distanceM) : '—'}
          </dd>
          <dd className="journey-completion__unit">
            {hasDistance ? 'km' : 'No distance recorded'}
          </dd>
        </div>
        <div className="journey-completion__fact">
          <dt>Active time</dt>
          <dd className="journey-completion__value">
            {formatJourneyDuration(facts.activeSeconds)}
          </dd>
          <dd className="journey-completion__unit">Pause-aware</dd>
        </div>
      </dl>

      <div className="journey-completion__actions">
        <button type="button" className="btn btn--primary btn--block" onClick={onViewJourney}>
          View Journey
        </button>
        <button type="button" className="btn btn--block" onClick={onClose}>
          Back to Journey
        </button>
      </div>

      <p className="journey-completion__note">
        This Journey is saved on this device.
      </p>
    </section>
  );
}
