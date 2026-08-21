import {
  EVOLUTION_STATUS_LABELS,
  MASCOT_STAGE_LABELS,
  evolutionStatus,
  visibleMascotFamily,
} from '../../domain/game/mascot';
import { mascotMessage, type MascotContext } from '../../domain/game/messages';
import type { GameSettings, GameState } from '../../domain/game/types';
import { levelProgress } from '../../domain/game/xp';
import { EggArt } from './EggArt';
import { useHatchCinematic } from '../hooks/useHatchCinematic';

/**
 * The companion strip: "I'm progressing", not "this is what you came here to manage".
 *
 * PHASE 6 REDUCED THIS DELIBERATELY. It used to be a full reward card and the first
 * and largest thing on Today - a 68px egg, a name, a level, an XP bar, an XP count,
 * a message, a stage line and sometimes a full-width button, all above the workout.
 * That is the shape the benchmark warned about: the dashboard that answers every
 * question except "what am I doing today?".
 *
 * It is now a strip. Same information hierarchy inside it, a third of the height,
 * and it no longer wears the reward surface - a reward surface should mark a reward,
 * not the permanent furniture. Nothing was deleted: the stage line still appears once
 * there is a mascot, and hatching and evolving are still offered here, because those
 * are real moments and burying them would be its own mistake.
 *
 * Before the egg hatches this component cannot name or draw the animal: it asks the
 * domain for the visible family and gets `undefined`, so there is nothing to leak
 * through a label, an alt attribute or a glyph.
 *
 * IT NO LONGER DECIDES WHAT THE COMPANION HAS NOTICED.
 *
 * This component used to hold a private `contextFor(state)` that looked only at the
 * egg and the evolution flag, so the message could never acknowledge a finished
 * session, a planned rest day, a trophy or a return after time away - even though
 * the copy for all four already existed. Worse, it was a screen deciding for itself
 * what was true about the day, which is the one thing the architecture rule forbids:
 * domain, then game state, then presentation.
 *
 * The choice now belongs to `todayCompanionContext` in the domain, and arrives as a
 * prop. This component's whole job with it is to look up the wording and render it.
 *
 * IT NO LONGER ANNOUNCES WHAT WAS EARNED EITHER.
 *
 * A floating pill used to show the XP of the LAST granted event and nothing else -
 * no name for it, and no sign that three other things had been earned at the same
 * time. Saying what happened is `RewardAcknowledgement`'s job now. What stays here
 * is the standing picture: level, bar, total, message, stage, and the controls for
 * hatching and evolving.
 */

interface GameHeaderProps {
  state: GameState;
  settings: GameSettings;
  /**
   * What the companion has noticed, decided by the domain. Passed in rather than
   * computed here so the message can reflect the day, and so there is exactly one
   * place the precedence between "you finished" and "welcome back" is written down.
   */
  context: MascotContext;
  crackStage: number;
  onHatch: () => void;
  onEvolve: () => void;
}

export function GameHeader({
  state,
  settings,
  context,
  crackStage,
  onHatch,
  onEvolve,
}: GameHeaderProps) {
  const family = visibleMascotFamily(state.mascot);
  const progress = levelProgress(state.xp.total);

  /*
   * The same cinematic onboarding uses. Today is the RECOVERY route into it - for a
   * save that arrived here still holding an egg - so it must behave identically, and
   * sharing the hook is what guarantees that rather than hoping two copies match.
   */
  const hatch = useHatchCinematic({
    canHatch: state.mascot.eggState === 'ready',
    onHatch,
  });

  const message = mascotMessage(context, settings.mascotPersonality);

  const action =
    state.mascot.eggState === 'ready'
      ? {
          label: hatch.isRunning ? 'Hatching…' : 'Hatch egg',
          onClick: hatch.request,
          disabled: hatch.isRunning,
        }
      : state.mascot.evolutionReady
        ? { label: 'See what changed', onClick: onEvolve }
        : undefined;

  return (
    <section className="game" aria-label="Your companion">
      <div
        className={`game__art${hatch.isRunning ? ` egg-hatch--${hatch.phase}` : ''}`}
      >
        {/*
          TEMPORARY PRESENTATION FALLBACK.

          `EggArt` is drawn in code and `family.glyph` is a single letter - neither is
          mascot artwork, and neither defines anything. The family name beside it is
          the real answer to "who is this", which is why the glyph is `aria-hidden`.
          Both are placeholders until the mascot art pipeline produces real assets,
          and both should be replaced rather than refined.
        */}
        {family === undefined ? (
          <>
            <EggArt
              ready={state.mascot.eggState === 'ready' && !hatch.isRunning}
              crackStage={crackStage}
            />
            {hatch.phase === 'flash' ? (
              <span className="egg__hatchFlash" aria-hidden="true" />
            ) : null}
          </>
        ) : (
          <span className="mascot" aria-hidden="true">
            {family.glyph}
          </span>
        )}
      </div>

      <div className="game__body">
        <div className="game__titles">
          <span className="game__name">
            {family === undefined ? 'Mystery Egg' : family.name}
          </span>
          <span className="game__level">Level {progress.level}</span>
        </div>

        {/*
          The bar carries the whole XP story visually; the count is a small aside.
          The accessible name holds both, so nothing is lost by shrinking the text.
        */}
        <div
          className="xpbar"
          role="img"
          aria-label={
            progress.isMaxLevel
              ? `Level ${progress.level}, maximum reached`
              : `Level ${progress.level}, ${progress.xpIntoLevel} of ${progress.xpForLevel ?? 0} XP`
          }
        >
          <span
            className="xpbar__fill"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>

        <p className="game__line">
          <span className="game__xp">
            {progress.isMaxLevel
              ? `${state.xp.total} XP`
              : `${progress.xpIntoLevel} / ${progress.xpForLevel ?? 0} XP`}
          </span>
          {message !== undefined ? <span className="game__message">{message}</span> : null}
        </p>

        {family !== undefined ? (
          <p className="game__stage">
            {MASCOT_STAGE_LABELS[state.mascot.stage]} ·{' '}
            {EVOLUTION_STATUS_LABELS[evolutionStatus(state.mascot, state.xp.level)]}
          </p>
        ) : null}
      </div>

      {/*
        Hatching and evolving stay here, but as a compact secondary control. They are
        real moments and must remain reachable - they are simply not allowed to be the
        biggest button on a screen whose job is today's session.
      */}
      {action !== undefined ? (
        <button
          type="button"
          className="btn btn--secondary game__action"
          onClick={action.onClick}
          disabled={'disabled' in action ? action.disabled : false}
        >
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
