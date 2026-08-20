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

  // Domain progression has five earned crack stages, while the current presentation
  // has three visible crack tiers. Keep that compression here, in presentation:
  // the domain remains one qualifying day -> one monotonic stage.
  const crackTier =
    crackStage <= 0
      ? 0
      : crackStage <= 2
        ? 1
        : crackStage <= 4
          ? 2
          : 3;

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

      {crackTier >= 1 ? (
        <path
          className="egg__crack"
          d="M40 21 L37 30 L42 35 L38 43"
        />
      ) : null}

      {crackTier >= 2 ? (
        <>
          <path
            className="egg__crack"
            d="M38 43 L29 48 L34 55 L25 62"
          />
          <path
            className="egg__crack"
            d="M42 35 L51 40 L47 48 L56 54"
          />
        </>
      ) : null}

      {crackTier >= 3 ? (
        <>
          <path
            className="egg__crack egg__crack--bright"
            d="M34 55 L42 61 L37 70 L45 78"
          />
          <path
            className="egg__crack egg__crack--bright"
            d="M47 48 L43 57 L52 64 L48 73"
          />
        </>
      ) : null}
    </svg>
  );
}
