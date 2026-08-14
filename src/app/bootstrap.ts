import { createDefaultStorageAdapter } from '../storage/localStorageAdapter';
import { createRepository, type InitialiseResult, type Repository } from '../storage/repository';

/**
 * Application startup, done once.
 *
 * This is the only place that builds a storage adapter and a repository. React
 * components ask for the repository from here and never construct one, which is what
 * keeps `localStorage` out of the component tree entirely.
 */

export interface AppContext {
  repository: Repository;
  /** False when we fell back to in-memory storage; data will not survive a reload. */
  isPersistent: boolean;
  initialisation: InitialiseResult;
}

let cached: AppContext | undefined;

/**
 * Build (or return) the application context, seeding first-run data if the store is
 * empty. Existing stored data always wins - see `Repository.initialise`.
 */
export function getAppContext(): AppContext {
  if (cached === undefined) {
    const { adapter, isPersistent } = createDefaultStorageAdapter();
    const repository = createRepository(adapter);
    cached = { repository, isPersistent, initialisation: repository.initialise() };
  }
  return cached;
}

/** Test-only escape hatch, so a suite can start from a clean context. */
export function resetAppContextForTests(): void {
  cached = undefined;
}
