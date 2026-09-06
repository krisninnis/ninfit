/**
 * Keeps the phone screen awake while a Journey is actually recording.
 *
 * WHY THIS IS A RECORDING CONCERN AND NOT A COSMETIC ONE. A browser tab behind a lock
 * screen stops receiving geolocation callbacks. The Journey does not fail - elapsed
 * time is derived from timestamps, the recovery snapshot is already on disk, and the
 * next fix is still accepted when the screen comes back. What is lost is the ground in
 * between: nobody watched it, so the route now carries an honest hole where a
 * continuous walk happened. The cheapest way to not have that hole is to not go dark.
 *
 * WHAT IT DOES NOT DO. It holds no opinion about the Journey, reads no route, writes
 * no storage and cannot keep a lock alive after Finish - the caller releases it. It
 * never asks for a permission prompt: the Screen Wake Lock API grants silently on a
 * visible page and rejects otherwise, and a rejection is a normal answer here rather
 * than an error worth telling anyone about.
 *
 * RE-ACQUISITION IS THE WHOLE TRICK. The platform drops a screen lock whenever the
 * page stops being visible, and does not give it back by itself. A recorder that asks
 * once has a wake lock for the first glance at the map and nothing afterwards, so the
 * handle re-asks on every return to visibility until it is released.
 */

type WakeLockSentinelLike = {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
};

export interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export interface JourneyScreenWakeLockOptions {
  wakeLock?: WakeLockLike | null;
  /** Injected so the visibility listener can be exercised without a DOM. */
  visibility?: {
    isVisible(): boolean;
    addEventListener(listener: () => void): void;
    removeEventListener(listener: () => void): void;
  };
}

export interface JourneyScreenWakeLock {
  /** Stops re-acquiring and releases anything currently held. Safe to call twice. */
  release(): void;
  /** Test/diagnostic view. Never used to decide anything the user can see. */
  isHeld(): boolean;
}

function browserWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const candidate = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  return candidate ?? null;
}

function documentVisibility(): JourneyScreenWakeLockOptions['visibility'] {
  if (typeof document === 'undefined') return undefined;
  return {
    isVisible: () => document.visibilityState === 'visible',
    addEventListener: (listener) => document.addEventListener('visibilitychange', listener),
    removeEventListener: (listener) => document.removeEventListener('visibilitychange', listener),
  };
}

/**
 * Requests a screen wake lock and keeps re-requesting it until released.
 *
 * Always returns a handle. A device without the API, a browser that refuses, or a
 * page that is not visible all produce a handle that simply never holds a lock -
 * recording is unaffected either way, so there is nothing here for a caller to branch
 * on and no failure state to render.
 */
export function keepJourneyScreenAwake(
  options: JourneyScreenWakeLockOptions = {},
): JourneyScreenWakeLock {
  const wakeLock = options.wakeLock === undefined ? browserWakeLock() : options.wakeLock;
  const visibility = options.visibility ?? documentVisibility();

  let released = false;
  let sentinel: WakeLockSentinelLike | null = null;

  const acquire = () => {
    if (released || wakeLock === null) return;
    if (sentinel !== null && sentinel.released !== true) return;
    if (visibility !== undefined && !visibility.isVisible()) return;

    void wakeLock
      .request('screen')
      .then((next) => {
        // Released while the request was in flight: honour the release, not the race.
        if (released) {
          void next.release().catch(() => undefined);
          return;
        }
        sentinel = next;
        next.addEventListener?.('release', () => {
          if (sentinel === next) sentinel = null;
        });
      })
      .catch(() => {
        // A refusal is an ordinary answer on this platform. Recording continues.
        sentinel = null;
      });
  };

  /**
   * Lets go of whatever we are holding without ending the handle.
   *
   * Used on the way back to visibility, because the sentinel we hold is stale by then
   * whether or not the platform bothered to tell us: a screen lock does not survive
   * the page being hidden. Trusting the `release` event alone would leave a browser
   * that fires it late - or not at all - looking to `acquire` like a lock we still
   * have, and the screen would quietly stop being held for the rest of the walk.
   * Releasing something already released is a resolved promise, so this is safe to do
   * every time rather than only when we can prove it is needed.
   */
  const discardSentinel = () => {
    const current = sentinel;
    sentinel = null;
    if (current !== null) void current.release().catch(() => undefined);
  };

  const onVisibilityChange = () => {
    if (released) return;
    if (visibility === undefined || !visibility.isVisible()) return;
    discardSentinel();
    acquire();
  };

  visibility?.addEventListener(onVisibilityChange);
  acquire();

  return {
    release() {
      if (released) return;
      released = true;
      visibility?.removeEventListener(onVisibilityChange);
      discardSentinel();
    },
    isHeld() {
      return sentinel !== null && sentinel.released !== true;
    },
  };
}
