import { useState, type CSSProperties } from 'react';

import {
  EGG_CRACK_STAGES,
  eggStageArt,
  hasCompleteEggStageArt,
} from '../eggStageArt';

/**
 * The Mystery Egg.
 *
 * ONE COPY, DELIBERATELY. This was a local function inside GameHeader until Phase 5
 * needed it in onboarding too. Two copies of the egg would be two places for the
 * animal to leak out of, and the whole point of the egg is that it gives nothing
 * away. Everything about it is universal: the same shell, the same specks, the same
 * neutral tokens, whatever path the person is on.
 *
 * TWO PRESENTATIONS, ONE CONTRACT.
 *
 * Since #195 the shell is the reviewed premium artwork: six SVG stages derived from
 * one canonical master, resolved through `eggStageArt`. The code-drawn shell below is
 * no longer the presentation - it is the FALLBACK, and it is load-bearing in exactly
 * two situations: the reviewed set is incomplete, or a stage failed to load on the
 * person's device.
 *
 * That second case is why the drawing is kept rather than deleted. `docs/CURRENT_STATE`
 * requires that a failed asset still leaves the authoritative hatched companion
 * reachable - never a reroll, never a trap, never a lost answer. The hatch mutation
 * already lives in `useHatchCinematic`/`hatchEgg` and is independent of any media, so
 * an image that 404s costs the person some polish and nothing else. A component that
 * rendered nothing when its artwork failed would turn that guarantee into a blank
 * square in the middle of the one moment the product exists for.
 *
 * `crackStage` is unchanged: 0 to 5, the domain's own range. The artwork replaced the
 * drawing, not the API.
 *
 * All six stages are mounted at once and cross-faded on opacity. Two reasons, both
 * about the same 1,450ms: swapping one element's `src` shows a decode gap, and the
 * gap would land on the break - the single frame that has to be perfect. Mounting
 * them together also means the ceremony never waits on a network request it could
 * have made during the questionnaire. The whole set is ~69KB, which is what the
 * budget in `docs/specs/active/premium-egg-production-assets-v1.md` was set for.
 *
 * The specks use `--ft-accent`, which is the neutral sage everywhere the egg is
 * shown before a path exists. It is never rendered inside a `[data-path]` subtree.
 *
 * `energy` (0 to 1) lets the egg gain presence through onboarding - a slight scale
 * and a slightly stronger neutral glow. It changes how alive the egg looks, never
 * what it is. There is no per-path variant and there must never be one.
 *
 * Nothing here is announced: it is `aria-hidden`, because a screen reader user is
 * told about the egg in the surrounding copy rather than being handed a decorative
 * SVG. No label, alt text or title can therefore leak either.
 */
export function EggArt({
  ready = false,
  energy,
  crackStage = 0,
}: {
  ready?: boolean;
  energy?: number;
  crackStage?: number;
}) {
  /*
   * One failure sends the whole presentation back to the drawing, rather than leaving
   * reviewed artwork at stage 2 and a code drawing at stage 3. A shell that changes
   * rendering language halfway through the questionnaire reads as a bug even when
   * every individual asset is fine.
   */
  const [artFailed, setArtFailed] = useState(false);
  const style = energy === undefined ? undefined : ({ '--egg-energy': energy } as CSSProperties);
  const energised = energy === undefined ? '' : ' egg--energised';

  // Keep the presentation faithful to the domain's six values. Clamp defensively so
  // malformed callers cannot create a partially-rendered or species-specific state.
  const visibleStage = Number.isFinite(crackStage)
    ? Math.max(0, Math.min(5, Math.floor(crackStage)))
    : 0;
  const stageStyle = (stage: number) => ({ opacity: stage <= visibleStage ? 1 : 0 });
  const className = `egg${ready ? ' egg--ready' : ''}${energised}`;

  if (!artFailed && hasCompleteEggStageArt()) {
    return (
      <div className={className} data-egg-art="production" aria-hidden="true" style={style}>
        {EGG_CRACK_STAGES.map((stage) => {
          const art = eggStageArt(stage);
          if (art === undefined) return null;
          return (
            <img
              key={stage}
              className="egg__art"
              data-egg-art-stage={stage}
              style={{ opacity: stage === visibleStage ? 1 : 0 }}
              src={art.src}
              alt=""
              aria-hidden="true"
              decoding="async"
              draggable={false}
              onError={() => setArtFailed(true)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 80 100"
      aria-hidden="true"
      style={style}
    >
      <ellipse cx="40" cy="58" rx="32" ry="40" className="egg__shell" />
      <ellipse cx="30" cy="44" rx="6" ry="8" className="egg__speck" />
      <ellipse cx="50" cy="66" rx="5" ry="6" className="egg__speck" />
      <ellipse cx="42" cy="30" rx="4" ry="5" className="egg__speck" />

      <g className="egg__stage" data-egg-stage="1" style={stageStyle(1)}>
        <path className="egg__crack" d="M40 21 L37 30 L42 35 L38 43" />
      </g>
      <g className="egg__stage" data-egg-stage="2" style={stageStyle(2)}>
        <path className="egg__crack-light" d="M38 43 L29 48 L34 55 L25 62" />
        <path className="egg__crack" d="M38 43 L29 48 L34 55 L25 62" />
        <path className="egg__crack-light" d="M42 35 L51 40 L47 48 L56 54" />
        <path className="egg__crack" d="M42 35 L51 40 L47 48 L56 54" />
      </g>
      <g className="egg__stage" data-egg-stage="3" style={stageStyle(3)}>
        <path className="egg__crack-light" d="M34 55 L42 61 L37 70 L45 78" />
        <path className="egg__crack" d="M34 55 L42 61 L37 70 L45 78" />
      </g>
      <g className="egg__stage" data-egg-stage="4" style={stageStyle(4)}>
        <path className="egg__crack-light" d="M25 62 L22 70 L29 76 L26 84" />
        <path className="egg__crack" d="M25 62 L22 70 L29 76 L26 84" />
        <path className="egg__fragment" d="M25 84 L30 88 L27 92" />
      </g>
      <g className="egg__stage" data-egg-stage="5" style={stageStyle(5)}>
        <path className="egg__crack-light" d="M47 48 L43 57 L52 64 L48 73" />
        <path className="egg__crack" d="M47 48 L43 57 L52 64 L48 73" />
        <path className="egg__crack-light" d="M29 48 L40 51 L51 40" />
        <path className="egg__crack" d="M29 48 L40 51 L51 40" />
      </g>
    </svg>
  );
}
