import { useEffect, useRef, useState } from 'react';

/**
 * The hatch presentation, in one place.
 *
 * WHY THIS IS A HOOK RATHER THAN LIVING IN A SCREEN.
 *
 * Hatching now happens in TWO places for two different reasons: at the end of
 * onboarding, which is where almost everybody meets their companion, and on Today,
 * which is the recovery route for a save that reached Today still holding an egg.
 * Both need the same build, the same flash, the same reduced-motion behaviour and
 * the same double-activation guard.
 *
 * Two copies of that would be two chances to drift apart, and the thing most likely
 * to drift is the bit that matters: exactly when the real mutation is called.
 *
 * PRESENTATION ONLY, AND THAT IS LOAD-BEARING.
 *
 * Nothing here decides whether the egg may open. The caller passes `canHatch`, which
 * comes from domain state (`eggState === 'ready'`), and `onHatch`, which performs the
 * one real mutation. This hook chooses the moment, never the outcome. If the domain
 * says no, `request()` does nothing at all - there is no presentation-only "hatched"
 * state that could disagree with what is stored. The full ceremony commits at the
 * break and continues as an overlay over the already-hatched domain state.
 *
 * REDUCED MOTION IS A CEREMONY, NOT A SKIP.
 *
 * It uses three still states and opacity-only transitions. The domain mutation still
 * happens at the opening beat, matching the full-motion ceremony without requiring
 * scale, translation, shaking or particles.
 */

export type HatchPhase = 'idle' | 'cracking' | 'held' | 'flash' | 'emerging' | 'settling' | 'landing' | 'reduced-ready' | 'reduced-opening' | 'reduced-meet';

/** The shell shakes and strains before it gives. */
const GATHER_MS = 850;
const BREAK_MS = 1450;
const EMERGENCE_MS = 2900;
const LANDING_MS = 3600;
/** Total time to the real transition. The flash occupies the remainder. */
const HATCH_MS = 4200;
const REDUCED_READY_MS = 700;
const REDUCED_MEET_MS = 1400;
const REDUCED_TOTAL_MS = 2100;

export interface HatchCinematic {
  phase: HatchPhase;
  /** True while the presentation is running, so a control can disable itself. */
  isRunning: boolean;
  /** Start it. A no-op unless the domain allows hatching and nothing is running. */
  request: () => void;
  /** Skip the presentation while preserving the real commit point. */
  skip: () => void;
}

export function useHatchCinematic({
  canHatch,
  onHatch,
}: {
  canHatch: boolean;
  onHatch: () => void;
}): HatchCinematic {
  const [phase, setPhase] = useState<HatchPhase>('idle');
  const timers = useRef<number[]>([]);
  const committed = useRef(false);
  const running = useRef(false);
  const onHatchRef = useRef(onHatch);
  onHatchRef.current = onHatch;

  const clear = () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  };

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onHatchRef.current();
  };

  // Leaving mid-ceremony must not cancel the real hatch. Commit before teardown if
  // the break has not happened yet; the ref guard keeps every path exactly-once.
  useEffect(() => () => {
    clear();
    if (running.current) commit();
  }, []);

  const request = () => {
    // Both guards matter. `canHatch` is the domain's answer, and the phase check is
    // what stops a second tap starting a second run - and therefore a second call
    // to `onHatch`.
    if (!canHatch || phase !== 'idle') return;
    running.current = true;

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      clear();
      committed.current = false;
      setPhase('reduced-ready');
      timers.current.push(window.setTimeout(() => {
        commit();
        setPhase('reduced-opening');
      }, REDUCED_READY_MS));
      timers.current.push(window.setTimeout(() => setPhase('reduced-meet'), REDUCED_MEET_MS));
      timers.current.push(window.setTimeout(() => { setPhase('idle'); running.current = false; timers.current = []; }, REDUCED_TOTAL_MS));
      return;
    }

    clear();
    committed.current = false;
    setPhase('cracking');

    timers.current.push(window.setTimeout(() => setPhase('held'), GATHER_MS));
    timers.current.push(window.setTimeout(() => {
      commit();
      setPhase('flash');
    }, BREAK_MS));
    timers.current.push(window.setTimeout(() => setPhase('emerging'), BREAK_MS + 250));
    timers.current.push(window.setTimeout(() => setPhase('settling'), EMERGENCE_MS));
    timers.current.push(window.setTimeout(() => setPhase('landing'), LANDING_MS));
    timers.current.push(window.setTimeout(() => {
      setPhase('idle');
      running.current = false;
      timers.current = [];
    }, HATCH_MS));
  };

  const skip = () => {
    if (phase === 'idle') return;
    clear();
    commit();
    setPhase('reduced-meet');
    timers.current.push(window.setTimeout(() => { setPhase('idle'); running.current = false; timers.current = []; }, 500));
  };

  return { phase, isRunning: phase !== 'idle', request, skip };
}
