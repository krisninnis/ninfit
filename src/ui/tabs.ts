/**
 * NinFit's primary destinations and hash-routing rules.
 *
 * Journey Home is a normal destination. The active recorder is a separate immersive
 * route so recording can hide normal app chrome without making Journey itself
 * disappear from the product's information architecture.
 */

export type TabId = 'today' | 'week' | 'journey' | 'progress' | 'profile' | 'data';

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
  { id: 'journey', label: 'Journey', title: 'Journey' },
  { id: 'progress', label: 'Progress', title: 'Progress' },
  { id: 'profile', label: 'Profile', title: 'Profile & baseline' },
  { id: 'data', label: 'Data', title: 'Your data' },
] as const;

export const DEFAULT_TAB: TabId = 'today';

const TAB_IDS: ReadonlySet<string> = new Set(TABS.map((tab) => tab.id));

export function isTabId(value: string): value is TabId {
  return TAB_IDS.has(value);
}

function normaliseHash(hash: string): string {
  return hash.trim().replace(/^#/, '').replace(/^\//, '').replace(/\/$/, '').toLowerCase();
}

/**
 * Turn a location hash into a tab. Anything unrecognised falls back to Today
 * rather than erroring — a bad hash should never leave the user on a blank screen.
 */
export function parseTabFromHash(hash: string): TabId {
  const normalised = normaliseHash(hash);
  return isTabId(normalised) ? normalised : DEFAULT_TAB;
}

// --- Standalone routes -----------------------------------------------------

/** Journey Home is the normal Journey tab. */
export const JOURNEY_HASH = '#/journey';

/** The immersive active recording experience. Normal navigation is hidden here. */
export const JOURNEY_ACTIVE_HASH = '#/journey/active';

/**
 * The dedicated NinFit ID experience, which is deliberately NOT a tab.
 */
export const ACCOUNT_HASH = '#/account';
export const ACCOUNT_CONFIRMED_HASH = '#/account/confirmed';

export type AppRoute =
  | { readonly kind: 'account'; readonly confirmed: boolean }
  | { readonly kind: 'journey-active' }
  | { readonly kind: 'tab'; readonly tab: TabId };

/**
 * Traces of Supabase having answered in the URL fragment.
 * Nothing here reads, stores or forwards a token.
 */
const AUTH_FRAGMENT = /(^|[#&?])(access_token|refresh_token|error_code|error_description)=/;
const AUTH_TYPE = /(^|[#&?])type=(signup|magiclink|recovery|invite|email_change)/;

export function looksLikeAuthReturn(hash: string): boolean {
  return AUTH_FRAGMENT.test(hash) || AUTH_TYPE.test(hash);
}

/** The whole of NinFit's routing: standalone experiences, or a primary tab. */
export function parseRouteFromHash(hash: string): AppRoute {
  const normalised = normaliseHash(hash);

  if (normalised === 'journey/active') return { kind: 'journey-active' };
  if (normalised === 'account') return { kind: 'account', confirmed: false };
  if (normalised === 'account/confirmed') return { kind: 'account', confirmed: true };

  if (looksLikeAuthReturn(hash)) return { kind: 'account', confirmed: true };

  return { kind: 'tab', tab: parseTabFromHash(hash) };
}

/** Hold the account confirmation route while auth-js clears its token fragment. */
export function routeAfterHashChange(current: AppRoute, hash: string): AppRoute {
  const cleared = normaliseHash(hash) === '';
  if (cleared && current.kind === 'account' && current.confirmed) return current;
  return parseRouteFromHash(hash);
}

export function hashForTab(id: TabId): string {
  return `#/${id}`;
}

export function tabDefinition(id: TabId): TabDefinition {
  const found = TABS.find((tab) => tab.id === id);
  if (!found) throw new Error(`Unknown tab: ${id}`);
  return found;
}
