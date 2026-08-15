import {
  EVOLUTION_STATUS_LABELS,
  MASCOT_STAGE_LABELS,
  evolutionStatus,
  visibleMascotFamily,
} from '../../domain/game/mascot';
import { mascotMessage, type MascotContext } from '../../domain/game/messages';
import type { GameSettings, GameState, RewardEvent } from '../../domain/game/types';
import { levelProgress } from '../../domain/game/xp';
import { EggArt } from './EggArt';

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
 */

interface GameHeaderProps {
  state: GameState;
  settings: GameSettings;
  granted: readonly RewardEvent[];
  onHatch: () => void;
  onEvolve: () => void;
}

/** Placeholder art. Real mascot design is a separate piece of work. */
function contextFor(state: GameState): MascotContext {
  if (state.mascot.eggState === 'ready') return 'hatch_ready';
  if (state.mascot.eggState === 'unhatched') return 'egg_waiting';
  if (state.mascot.evolutionReady) return 'evolution_ready';
  return 'idle';
}

export function GameHeader({ state, settings, granted, onHatch, onEvolve }: GameHeaderProps) {
  const family = visibleMascotFamily(state.mascot);
  const progress = levelProgress(state.xp.total);
  const message = mascotMessage(contextFor(state), settings.mascotPersonality);
  const latest = granted[granted.length - 1];

  const action =
    state.mascot.eggState === 'ready'
      ? { label: 'Hatch egg', onClick: onHatch }
      : state.mascot.evolutionReady
        ? { label: 'See what changed', onClick: onEvolve }
        : undefined;

  return (
    <section className="game" aria-label="Your companion">
      <div className="game__art">
        {family === undefined ? (
          <EggArt ready={state.mascot.eggState === 'ready'} />
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
        <button type="button" className="btn btn--secondary game__action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}

      {latest !== undefined ? (
        <span className="xpfloat" key={latest.id}>
          +{latest.xp} XP
        </span>
      ) : null}
    </section>
  );
}
