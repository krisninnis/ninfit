export type NativeJourneyAppLifecycleState = 'foregrounded' | 'backgrounded';

export interface NativeJourneyAppLifecycleBridge {
  subscribe(listener: (state: NativeJourneyAppLifecycleState) => void): () => void;
}

export const NINFIT_NATIVE_APP_LIFECYCLE_KEY = '__NINFIT_NATIVE_APP_LIFECYCLE__' as const;

type NativeLifecycleHost = typeof globalThis & {
  [NINFIT_NATIVE_APP_LIFECYCLE_KEY]?: unknown;
};

function isLifecycleBridge(value: unknown): value is NativeJourneyAppLifecycleBridge {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Partial<NativeJourneyAppLifecycleBridge>).subscribe === 'function';
}

/**
 * Subscribe to native app foreground/background state when running inside the installed
 * shell. Browser/PWA builds have no injected bridge and receive a no-op unsubscribe.
 *
 * The shell should emit `backgrounded` whenever the native app loses foreground due to
 * screen lock, home/app switch or other OS backgrounding. NinFit deliberately treats all
 * of those as reasons to protect Journey controls; returning to foreground does not
 * automatically unlock them.
 */
export function subscribeInjectedJourneyAppLifecycle(
  listener: (state: NativeJourneyAppLifecycleState) => void,
  host: NativeLifecycleHost = globalThis as NativeLifecycleHost,
): () => void {
  const candidate = host[NINFIT_NATIVE_APP_LIFECYCLE_KEY];
  if (!isLifecycleBridge(candidate)) return () => undefined;

  try {
    const unsubscribe = candidate.subscribe((state) => {
      if (state === 'foregrounded' || state === 'backgrounded') listener(state);
    });
    return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
  } catch {
    return () => undefined;
  }
}
