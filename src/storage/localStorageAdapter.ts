import { createMemoryStorageAdapter, type StorageAdapter } from './StorageAdapter';

/**
 * The ONLY file in the app permitted to touch `localStorage` directly.
 *
 * Everything else - repository, domain, UI - goes through `StorageAdapter`. If you
 * find yourself reaching for `window.localStorage` anywhere else, the abstraction has
 * sprung a leak.
 */

/**
 * Probe for a usable `localStorage`.
 *
 * Presence is not enough. Safari in private mode has historically exposed the object
 * and then thrown on write, and a server-side or test environment may not define it at
 * all, so this does a real write-and-remove round trip.
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    const probeKey = '__ft_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wrap `localStorage`. Throws if it is unavailable, so callers that need persistence
 * find out immediately rather than writing into a void.
 */
export function createLocalStorageAdapter(): StorageAdapter {
  if (!isLocalStorageAvailable()) {
    throw new Error('localStorage is not available in this environment');
  }
  const storage = globalThis.localStorage;

  return {
    get(key) {
      return storage.getItem(key);
    },
    set(key, value) {
      // Propagates QuotaExceededError rather than swallowing it. A silently failed
      // write of health data is worse than a loud one.
      storage.setItem(key, value);
    },
    remove(key) {
      storage.removeItem(key);
    },
    keys() {
      const found: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) found.push(key);
      }
      return found;
    },
  };
}

export interface DefaultStorage {
  adapter: StorageAdapter;
  /**
   * False when we fell back to memory. The data will not survive a reload, and the
   * app should eventually say so - but that is a UI decision for a later step, not
   * something this module should decide.
   */
  isPersistent: boolean;
}

/**
 * Best available store: real `localStorage` where possible, an in-memory store
 * otherwise. Never throws, so an unavailable store degrades the app rather than
 * breaking it.
 */
export function createDefaultStorageAdapter(): DefaultStorage {
  if (isLocalStorageAvailable()) {
    return { adapter: createLocalStorageAdapter(), isPersistent: true };
  }
  return { adapter: createMemoryStorageAdapter(), isPersistent: false };
}
