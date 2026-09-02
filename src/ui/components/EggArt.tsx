import type { CSSProperties } from 'react';

/**
 * The Mystery Egg.
 *
 * ONE COPY, DELIBERATELY. This was a local function inside GameHeader until Phase 5
 * needed it in onboarding too. Two copies of the egg would be two places for the
 * animal to leak out of, and the whole point of the egg is that it gives nothing
 * away. Everything about it is universal: the same shell, the same specks, the same
 * neutral tokens, whatever path the person is on.
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
  const style = energy === undefined ? undefined : ({ '--egg-energy': energy } as CSSProperties);
  const energised = energy === undefined ? '' : ' egg--energised';

  // Keep the presentation faithful to the domain's six values. Clamp defensively so
  // malformed callers cannot create a partially-rendered or species-specific state.
  const visibleStage = Number.isFinite(crackStage)
    ? Math.max(0, Math.min(5, Math.floor(crackStage)))
    : 0;
  const stageStyle = (stage: number) => ({ opacity: stage <= visibleStage ? 1 : 0 });

  return (
    <svg
      className={`egg${ready ? ' egg--ready' : ''}${energised}`}
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
