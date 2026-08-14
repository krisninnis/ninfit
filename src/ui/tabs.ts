/**
 * The five screens of v0.1, and the hash-routing rules between them.
 *
 * Hash routing rather than a router dependency: there are exactly five fixed
 * destinations, and using the URL hash means the phone's back button works.
 */

export type TabId = 'today' | 'week' | 'progress' | 'profile' | 'data';

export interface TabDefinition {
  readonly id: TabId;
  /** Shown under the icon in the tab bar. */
  readonly label: string;
  /** Shown as the screen heading. */
  readonly title: string;
}

export const TABS: readonly TabDefinition[] = [
  { id: 'today', label: 'Today', title: 'Today' },
  { id: 'week', label: 'Week', title: 'This week' },
  { id: 'progress', label: 'Progress', title: 'Progress' },
  { id: 'profile', label: 'Profile', title: 'Profile & baseline' },
  { id: 'data', label: 'Data', title: 'Your data' },
] as const;

export const DEFAULT_TAB: TabId = 'today';

const TAB_IDS: ReadonlySet<string> = new Set(TABS.map((tab) => tab.id));

export function isTabId(value: string): value is TabId {
  return TAB_IDS.has(value);
}

/**
 * Turn a location hash into a tab. Anything unrecognised falls back to Today
 * rather than erroring — a bad hash should never leave the user on a blank screen.
 */
export function parseTabFromHash(hash: string): TabId {
  const normalised = hash.trim().replace(/^#/, '').replace(/^\//, '').replace(/\/$/, '').toLowerCase();
  return isTabId(normalised) ? normalised : DEFAULT_TAB;
}

export function hashForTab(id: TabId): string {
  return `#/${id}`;
}

export function tabDefinition(id: TabId): TabDefinition {
  const found = TABS.find((tab) => tab.id === id);
  if (!found) throw new Error(`Unknown tab: ${id}`);
  return found;
}
