/**
 * The persistence seam.
 *
 * Deliberately tiny: a string-keyed store with get, set, remove and keys. Nothing
 * here knows what a DailyLog is. Serialisation, validation and all domain meaning
 * live in the repository, so swapping the adapter swaps only the mechanism.
 *
 * WHY SYNCHRONOUS
 * ---------------
 * `localStorage` is synchronous, so a synchronous interface is the honest shape for
 * what we actually use in v0.1. Making it async now would add promise ceremony to
 * every call site for no present benefit, and it would rule out
 * `useSyncExternalStore` in the UI, which is the natural fit for a local store.
 *
 * The known cost, stated plainly: IndexedDB and Capacitor Preferences are both async,
 * so moving to either later means making this interface async and updating the
 * repository plus its call sites. That is a contained, mechanical refactor of a small
 * surface, and it is the right trade against complicating everything we write between
 * now and then. This comment exists so that decision is visible rather than accidental.
 */
export interface StorageAdapter {
  /** The stored string, or null when the key has never been written. */
  get(key: string): string | null;
  /** May throw when the backing store is full or unavailable. */
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Every key currently held. Order is not guaranteed. */
  keys(): string[];
}

/**
 * In-memory reference implementation.
 *
 * Used by tests for determinism, and used at runtime as the fallback when
 * `localStorage` is unavailable - for example in a locked-down private browsing mode.
 * In that fallback role the data does not survive a reload, which is why
 * `createDefaultStorageAdapter` reports whether the store it returned is persistent.
 */
export function createMemoryStorageAdapter(
  initial: Readonly<Record<string, string>> = {},
): StorageAdapter {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    get(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    set(key, value) {
      store.set(key, value);
    },
    remove(key) {
      store.delete(key);
    },
    keys() {
      return [...store.keys()];
    },
  };
}
