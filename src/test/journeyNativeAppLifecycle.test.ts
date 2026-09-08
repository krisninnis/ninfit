import { describe, expect, it, vi } from 'vitest';
import {
  NINFIT_NATIVE_APP_LIFECYCLE_KEY,
  subscribeInjectedJourneyAppLifecycle,
} from '../app/journeyNativeAppLifecycle';

describe('native Journey app lifecycle bridge', () => {
  it('fails closed to a no-op in browser/PWA mode', () => {
    const listener = vi.fn();
    const host = {} as typeof globalThis;

    const unsubscribe = subscribeInjectedJourneyAppLifecycle(listener, host);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it('forwards only valid foreground/background lifecycle states', () => {
    const listeners: Array<(state: string) => void> = [];
    const unsubscribe = vi.fn();
    const host = {
      [NINFIT_NATIVE_APP_LIFECYCLE_KEY]: {
        subscribe(listener: (state: string) => void) {
          listeners.push(listener);
          return unsubscribe;
        },
      },
    } as unknown as typeof globalThis;
    const listener = vi.fn();

    const dispose = subscribeInjectedJourneyAppLifecycle(listener, host);
    const emit = listeners[0];
    if (!emit) throw new Error('native lifecycle listener not registered');
    emit('backgrounded');
    emit('unexpected');
    emit('foregrounded');
    dispose();

    expect(listener.mock.calls).toEqual([['backgrounded'], ['foregrounded']]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('contains a native subscription failure', () => {
    const host = {
      [NINFIT_NATIVE_APP_LIFECYCLE_KEY]: {
        subscribe() { throw new Error('native unavailable'); },
      },
    } as unknown as typeof globalThis;

    expect(() => subscribeInjectedJourneyAppLifecycle(vi.fn(), host)()).not.toThrow();
  });
});
