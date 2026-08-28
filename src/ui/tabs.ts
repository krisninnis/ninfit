import {
  isJourneyActivityFamilyId,
  journeyActivityFamily,
  type JourneyActivityFamilyId,
} from './journeyActivityFamilies';

/**
 * NinFit's primary destinations and hash-routing rules.
 *
 * Journey Home is a first-class navigation destination. The active recorder is a
 * separate immersive route so recording can hide normal app chrome without making
 * Journey itself disappear from the product's information architecture.
 */

export type TabId = 'today' | 'week' | 'progress' | 'profile' | 'data';
export type PrimaryNavId = TabId | 'journey';

export interface TabDefinition {
  readonly id: TabId;
  readonly label: string;
  readonly title: string;
}

export const TABS: readonly TabDefinition[] = [
  { id: 'today', label: 'Today', title: 'Today' },
  { id: 'week', label: 'Week', title: 'This week' },
  { id: 'progress', label: 'Progress', title: 'Progress' },
  { id: 'profile', label: 'Profile', title: 'Profile & baseline' },
  { id: 'data', label: 'Data', title: 'Your data' },
] as const;

export const PRIMARY_NAV: ReadonlyArray<{ id: PrimaryNavId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'journey', label: 'Journey' },
  { id: 'progress', label: 'Progress' },
  { id: 'profile', label: 'Profile' },
  { id: 'data', label: 'Data' },
];

export const DEFAULT_TAB: TabId = 'today';

const TAB_IDS: ReadonlySet<string> = new Set(TABS.map((tab) => tab.id));

export function isTabId(value: string): value is TabId {
  return TAB_IDS.has(value);
}

function pathFromHash(hash: string): string {
  return hash.trim().replace(/^#/, '').replace(/^\//, '').replace(/\/$/, '');
}

function normaliseHash(hash: string): string {
  return pathFromHash(hash).toLowerCase();
}

export function parseTabFromHash(hash: string): TabId {
  const normalised = normaliseHash(hash);
  return isTabId(normalised) ? normalised : DEFAULT_TAB;
}

export const JOURNEY_HASH = '#/journey';
export const JOURNEY_ACTIVE_HASH = '#/journey/active';
export const ACCOUNT_HASH = '#/account';
export const ACCOUNT_CONFIRMED_HASH = '#/account/confirmed';
export const PASSPORT_HASH = '#/passport';

export type AppRoute =
  | { readonly kind: 'account'; readonly confirmed: boolean }
  | { readonly kind: 'journey-home' }
  | { readonly kind: 'journey-active' }
  /**
   * The companion launch screen for one activity family. It chooses an activity type
   * and then hands off to the existing recorder; it starts nothing by itself.
   */
  | { readonly kind: 'journey-launch'; readonly family: JourneyActivityFamilyId }
  | { readonly kind: 'journey-detail'; readonly journeyId: string }
  | { readonly kind: 'journey-postcard'; readonly journeyId: string }
  | { readonly kind: 'passport' }
  | { readonly kind: 'tab'; readonly tab: TabId };

const AUTH_FRAGMENT = /(^|[#&?])(access_token|refresh_token|error_code|error_description)=/;
const AUTH_TYPE = /(^|[#&?])type=(signup|magiclink|recovery|invite|email_change)/;

export function looksLikeAuthReturn(hash: string): boolean {
  return AUTH_FRAGMENT.test(hash) || AUTH_TYPE.test(hash);
}

export function parseRouteFromHash(hash: string): AppRoute {
  const path = pathFromHash(hash);
  const normalised = path.toLowerCase();

  const detailPrefix = 'journey/detail/';
  if (normalised.startsWith(detailPrefix)) {
    const encodedId = path.slice(detailPrefix.length);
    if (encodedId.length > 0) {
      try {
        return { kind: 'journey-detail', journeyId: decodeURIComponent(encodedId) };
      } catch {
        return { kind: 'journey-home' };
      }
    }
  }

  const postcardPrefix = 'journey/postcard/';
  if (normalised.startsWith(postcardPrefix)) {
    const encodedId = path.slice(postcardPrefix.length);
    if (encodedId.length > 0) {
      try {
        return { kind: 'journey-postcard', journeyId: decodeURIComponent(encodedId) };
      } catch {
        return { kind: 'journey-home' };
      }
    }
  }

  /*
   * A family only gets a launch route if it actually HAS a companion launch screen.
   * `#/journey/launch/cycle` is a URL somebody can type, and answering it with a
   * Walk/Run screen would be the one mistake this route must not make - so anything
   * without a companion flow falls back to Journey Home rather than improvising.
   */
  const launchPrefix = 'journey/launch/';
  if (normalised === 'journey/launch' || normalised.startsWith(launchPrefix)) {
    const family = normalised.slice(launchPrefix.length);
    if (
      isJourneyActivityFamilyId(family)
      && journeyActivityFamily(family)?.launch === 'companion'
    ) {
      return { kind: 'journey-launch', family };
    }
    return { kind: 'journey-home' };
  }

  if (normalised === 'journey') return { kind: 'journey-home' };
  if (normalised === 'journey/active') return { kind: 'journey-active' };
  if (normalised === 'account') return { kind: 'account', confirmed: false };
  if (normalised === 'account/confirmed') return { kind: 'account', confirmed: true };
  if (normalised === 'passport') return { kind: 'passport' };

  if (looksLikeAuthReturn(hash)) return { kind: 'account', confirmed: true };

  return { kind: 'tab', tab: parseTabFromHash(hash) };
}

export function routeAfterHashChange(current: AppRoute, hash: string): AppRoute {
  const cleared = normaliseHash(hash) === '';
  if (cleared && current.kind === 'account' && current.confirmed) return current;
  return parseRouteFromHash(hash);
}

export function hashForTab(id: TabId): string {
  return `#/${id}`;
}

export function hashForPrimaryNav(id: PrimaryNavId): string {
  return id === 'journey' ? JOURNEY_HASH : hashForTab(id);
}

export function journeyLaunchHash(family: JourneyActivityFamilyId): string {
  return `#/journey/launch/${family}`;
}

export function journeyDetailHash(journeyId: string): string {
  return `#/journey/detail/${encodeURIComponent(journeyId)}`;
}

export function journeyPostcardHash(journeyId: string): string {
  return `#/journey/postcard/${encodeURIComponent(journeyId)}`;
}

export function tabDefinition(id: TabId): TabDefinition {
  const found = TABS.find((tab) => tab.id === id);
  if (!found) throw new Error(`Unknown tab: ${id}`);
  return found;
}
