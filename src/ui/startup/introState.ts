import type { StorageAdapter } from '../../storage/StorageAdapter';

/**
 * Whether the startup cinematic should play, and remembering that it has.
 *
 * WHY THIS IS NOT IN THE DOMAIN OR THE REPOSITORY. Having watched an intro is not a
 * fitness fact. It has no bearing on rewards, programmes or history, it must never
 * appear in an export, and it must never require a schema version. So it is one
 * string under the existing `ft:v1:` prefix, written through the existing storage
 * seam, and the domain layer does not know it exists.
 *
 * NO ACCOUNT, EVER. This is local-first and device-local by design. A user who never
 * creates a NinFit ID gets exactly the same behaviour, and a user on a second device
 * simply sees the intro once there too - which is the correct trade against making
 * anybody sign in to skip a five-second video.
 *
 * Everything here is pure or takes the store as an argument, so it is all testable
 * without a browser.
 */

/** Deliberately outside `STORAGE_KEYS`: that map is the repository's, and this is not. */
export const INTRO_SEEN_KEY = 'ft:v1:introSeen';

const SEEN_VALUE = 'true';

export function hasSeenIntro(store: StorageAdapter): boolean {
  return store.get(INTRO_SEEN_KEY) === SEEN_VALUE;
}

/**
 * Record that the intro is done.
 *
 * Never throws. `set` can fail on a full or locked-down store, and a user who cannot
 * persist the flag should still get into the app - they will simply see the intro
 * again next time, which is a far better failure than a crash on first launch.
 */
export function markIntroSeen(store: StorageAdapter): void {
  try {
    store.set(INTRO_SEEN_KEY, SEEN_VALUE);
  } catch {
    // Intentionally swallowed. See above.
  }
}

export interface IntroDecision {
  /** True when this launch has already been recorded as having seen the intro. */
  seen: boolean;
  /** True once the user has completed onboarding. */
  onboardingComplete: boolean;
}

/**
 * Should this launch play the cinematic?
 *
 * Two conditions, and the second is the one that matters.
 *
 *   1. It has not been seen on this device.
 *   2. Onboarding has not been completed.
 *
 * The second exists for everyone who was already using NinFit before this feature
 * shipped. Their flag is absent, so condition 1 alone would greet a long-standing
 * user with a "welcome to NinFit" cinematic. Treating a completed onboarding as
 * implicit proof that they have already arrived keeps the intro to genuinely new
 * installs.
 *
 * Reduced motion is deliberately NOT consulted here. Someone who prefers less motion
 * still gets a welcome; what changes is the presentation, not whether they are
 * greeted. That decision lives in the component.
 */
export function shouldPlayIntro({ seen, onboardingComplete }: IntroDecision): boolean {
  return !seen && !onboardingComplete;
}
