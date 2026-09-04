import { useState } from 'react';

import type { HatchPhase } from '../hooks/useHatchCinematic';

/**
 * Presentation-only media for the post-break companion reveal.
 *
 * The caller cannot mount this until the domain has revealed a family. That keeps
 * species media out of the DOM and out of network requests before the authoritative
 * hatch. Full-motion phases may use a one-shot motion asset; reduced motion and media
 * failure always fall back to the reviewed standing frame (or the existing glyph).
 */
export function HatchCompanionMedia({
  phase,
  standingSrc,
  motionSrc,
  fallbackMark,
}: {
  phase: HatchPhase;
  standingSrc?: string;
  motionSrc?: string;
  fallbackMark?: string;
}) {
  const [motionFailed, setMotionFailed] = useState(false);
  const fullMotionReveal =
    phase === 'emerging' || phase === 'settling' || phase === 'landing';
  const showMotion = fullMotionReveal && motionSrc !== undefined && !motionFailed;

  return (
    <>
      {standingSrc !== undefined ? (
        <img
          className={`egg-hatch__companion${showMotion ? ' egg-hatch__companion--under-wave' : ''}`}
          src={standingSrc}
          alt=""
          aria-hidden="true"
        />
      ) : fallbackMark !== undefined ? (
        <span
          className={`egg-hatch__companion egg-hatch__companion--fallback${showMotion ? ' egg-hatch__companion--under-wave' : ''}`}
          aria-hidden="true"
        >
          {fallbackMark}
        </span>
      ) : null}

      {showMotion ? (
        <video
          className="egg-hatch__wave"
          src={motionSrc}
          autoPlay
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setMotionFailed(true)}
        />
      ) : null}
    </>
  );
}
