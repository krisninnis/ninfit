import {
  EVOLUTION_STATUS_LABELS,
  MASCOT_STAGE_LABELS,
  evolutionStatus,
  visibleMascotFamily,
} from '../../domain/game/mascot';
import { mascotMessage, type MascotContext } from '../../domain/game/messages';
import type { GameSettings, GameState, RewardEvent } from '../../domain/game/types';
import { levelProgress } from '../../domain/game/xp';

/**
 * The emotional hook, sitting above today's plan without replacing it.
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
function EggArt({ ready }: { ready: boolean }) {
  return (
    <svg className={`egg${ready ? ' egg--ready' : ''}`} viewBox="0 0 80 100" aria-hidden="true">
      <ellipse cx="40" cy="58" rx="32" ry="40" className="egg__shell" />
      <ellipse cx="30" cy="44" rx="6" ry="8" className="egg__speck" />
      <ellipse cx="50" cy="66" rx="5" ry="6" className="egg__speck" />
      <ellipse cx="42" cy="30" rx="4" ry="5" className="egg__speck" />
    </svg>
  );
}

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

  return (
    <section className="card card--reward game">
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
        <span className="game__xp">
          {progress.isMaxLevel
            ? `${state.xp.total} XP`
            : `${progress.xpIntoLevel} / ${progress.xpForLevel ?? 0} XP`}
        </span>

        {message !== undefined ? <p className="game__message">{message}</p> : null}

        {family !== undefined ? (
          <p className="game__stage">
            {MASCOT_STAGE_LABELS[state.mascot.stage]} ·{' '}
            {EVOLUTION_STATUS_LABELS[evolutionStatus(state.mascot, state.xp.level)]}
          </p>
        ) : null}

        {state.mascot.eggState === 'ready' ? (
          <button type="button" className="btn btn--primary btn--block game__action" onClick={onHatch}>
            Hatch egg
          </button>
        ) : null}

        {state.mascot.evolutionReady ? (
          <button type="button" className="btn btn--primary btn--block game__action" onClick={onEvolve}>
            See what changed
          </button>
        ) : null}
      </div>

      {latest !== undefined ? (
        <span className="xpfloat" key={latest.id}>
          +{latest.xp} XP
        </span>
      ) : null}
    </section>
  );
}
