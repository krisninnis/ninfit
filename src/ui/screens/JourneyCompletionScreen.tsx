import { lazy, Suspense, useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyLaunchController } from '../../app/journeyLaunchController';
import { createDefaultGameSettings } from '../../domain/game/defaults';
import { journeyCompanionMessage } from '../../domain/game/journeyCompanionContext';
import { visibleMascotFamily } from '../../domain/game/mascot';
import {
  journeyIsFurthestOfType,
  journeyPersonalResult,
} from '../../domain/journeyPersonalResult';
import { journeyCommunityResultState } from '../../domain/journeyPublicEligibility';
import { journeyTrustedRouteSegments } from '../../domain/journeyRouteSegments';
import { journeyStatistics } from '../../domain/journeyStatistics';
import { loadJourneyHistory } from '../../storage/journeyHistory';
import { journeyActivityFamilyForType } from '../journeyActivityFamilies';
import { journeyCompanionPresence } from '../journeyCompanionPresentation';
import {
  journeyActivityLabel,
  journeyDetailFacts,
  journeyPrivacyLabel,
} from '../journeyDetailPresentation';
import {
  formatJourneyDistance,
  formatJourneyDuration,
  formatJourneyPace,
} from '../journeyPresentation';
import {
  journeyCommunityResultLine,
  journeyFurthestMarker,
  journeyPersonalResultLine,
} from '../journeyResultPresentation';
import { mascotActivityArt } from '../mascotActivityArt';

const ActiveJourneyMap = lazy(async () => {
  const module = await import('../components/ActiveJourneyMap');
  return { default: module.ActiveJourneyMap };
});

/**
 * The moment after Finish - the result of one outing, and nothing beyond it.
 *
 * WHAT THIS SCREEN IS. A calm read of one Journey that has ALREADY been completed and
 * persisted by `journeyRecoveryController.complete`. It shows what that Journey
 * recorded, where it went, and how it sits against the person's own earlier efforts.
 * It is the last step of an outing, not a second one.
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
 * THE TRUTH BOUNDARY, AND WHY IT MOVED.
 *
 * The first version of this screen showed two numbers and deliberately refused
 * everything else, because nothing in the app could work out anything else honestly.
 * That is no longer the situation: `journeyStatistics` derives pace once from the
 * recorded distance observation and the recorder's own pause-aware timeline, and
 * `journeyPersonalResult` compares like with like against local history. So the rule
 * has not changed - state only what the domain established - the domain simply
 * establishes more than it did.
 *
 * Everything shown still arrives already decided. This file divides nothing, ranks
 * nothing, and composes no sentence about anybody's performance: the wording comes
 * from `journeyResultPresentation`, which is reviewed as product copy. A Journey with
 * no distance observation still says so plainly rather than presenting a confident
 * 0.00 km, because a zero that was never measured is a fabricated fact wearing a
 * number's clothes - and a Journey with nothing to compare against is told it is a
 * first effort rather than sold a personal best out of a set of one.
 *
 * THE ROUTE IS SHOWN TO ITS OWNER, ON THEIR OWN DEVICE, AND GOES NO FURTHER.
 *
 * The same private local view the saved Journey record already offers, drawn from the
 * same trusted segments by the same component. `journeyTrustedRouteSegments` is the
 * only route question asked, and it answers with the stretches NinFit actually
 * watched - a Journey without that evidence gets a plain honest message instead of an
 * invented line. Nothing here shares, uploads, masks or publishes: the disclosure
 * projection belongs to the postcard path, and community standing is reported by
 * `journeyCommunityResultState`, which today can only say that NinFit has no
 * community routes at all.
 *
 * IT GRANTS NOTHING, AND SAYS NOTHING WAS GRANTED. Finishing a Journey does not
 * currently produce a reward: `deriveRewards` reads daily logs, weekly plans and
 * measurements, and cannot see a Journey at all. So there is no XP line, no trophy,
 * no badge and no reward presenter here. Adding one would mean either bypassing the
 * durable delivery queue or inventing a grant, and both are forbidden. A personal
 * ranking is a statement about recorded facts, not a prize.
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
  const statistics = journeyStatistics(journey);
  const pace = formatJourneyPace(statistics.paceSecondsPerKm);
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

  const startedAt = new Date(journey.startedAt);
  const completedAt = new Date(journey.endedAt ?? journey.startedAt);
  const hasDistance = facts.distanceM > 0;

  /*
   * The only route question this screen asks. A run of one point is not a line, and a
   * Journey whose segmentation evidence is missing produces no runs at all - both
   * cases land on the honest message rather than on a drawn shape.
   */
  const drawableRoute = journeyTrustedRouteSegments(journey).some(
    (segment) => segment.length >= 2,
  );

  const personal = journeyPersonalResultLine(journeyPersonalResult(journey, history));
  const furthest = journeyIsFurthestOfType(journey, history);
  const community = journeyCommunityResultLine(journeyCommunityResultState(journey));

  const clock = (value: Date) =>
    value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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
          {clock(startedAt)}–{clock(completedAt)}
        </p>
      </header>

      {/*
        WHERE THEY ACTUALLY WENT.

        The same component, the same trusted segments and the same overview framing
        the saved Journey record uses, so the shape here and the shape there cannot
        disagree about one walk. It is lazy for the same reason detail's is: a map
        engine is a large download, and a Journey with no drawable route never pays
        for it.
      */}
      <section className="journey-completion__route" aria-labelledby="journey-completion-route-title">
        <h2 id="journey-completion-route-title" className="journey-completion__route-title">
          Route
        </h2>
        {drawableRoute ? (
          <div className="journey-completion__map-frame">
            <Suspense
              fallback={
                <div className="journey-completion__map-message" role="status" aria-live="polite">
                  Loading your route...
                </div>
              }
            >
              <ActiveJourneyMap
                journey={journey}
                ariaLabel="Map of the route recorded for this Journey"
                unavailableMessage="This Journey is saved without the map."
                view="overview"
              />
            </Suspense>
          </div>
        ) : (
          <div className="journey-completion__map-message">
            No continuous route was recorded for this Journey.
          </div>
        )}
        <p className="journey-completion__route-note">{journeyPrivacyLabel(journey)}</p>
      </section>

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
        <div className="journey-completion__fact">
          <dt>Average pace</dt>
          {/*
            `formatJourneyPace` answers null whenever the domain declined to state a
            pace - too little distance, no active time, no observation at all - and
            the em dash is what that looks like. This screen never fills the gap.
          */}
          <dd className="journey-completion__value">{pace ?? '—'}</dd>
          <dd className="journey-completion__unit">
            {pace === null ? 'Not enough recorded' : 'per km'}
          </dd>
        </div>
      </dl>

      {/*
        HOW IT SITS BESIDE THEIR OWN EARLIER OUTINGS.

        Both blocks render whatever the domain answered, including the answers that
        mean "nothing to say". An absent panel would let somebody assume a comparison
        was made and quietly withheld; a stated "first recorded effort" tells them
        exactly where they are.
      */}
      <section className="journey-completion__standings" aria-label="How this Journey compares">
        <div className="journey-completion__standing">
          <p className="journey-completion__standing-label">Personal result</p>
          <p className="journey-completion__standing-value">{personal.value}</p>
          <p className="journey-completion__standing-note">{personal.note}</p>
          {furthest ? (
            <p className="journey-completion__standing-extra">
              {journeyFurthestMarker(journey.activityType)}
            </p>
          ) : null}
        </div>
        <div className="journey-completion__standing">
          <p className="journey-completion__standing-label">Community result</p>
          <p className="journey-completion__standing-value">{community.value}</p>
          <p className="journey-completion__standing-note">{community.note}</p>
        </div>
      </section>

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
