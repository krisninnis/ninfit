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

/** The dedicated active recording experience. It is deliberately not a tab. */
export const JOURNEY_HASH = '#/journey';

/**
 * The dedicated NinFit ID experience, which is deliberately NOT a tab.
 *
 * It has no place in the tab bar (the tab bar is hidden while it is open), it is
 * entered from two different places, and an email confirmation link has to be able
 * to point at it from outside the app. All three of those want a URL, so it gets one
 * rather than a second piece of navigation state living alongside the hash.
 *
 * `.../confirmed` is where a confirmation email returns. It carries no token and no
 * identity - it only says "you have just come back from an email link", which is
 * enough for the screen to go and ask Supabase whether a session now exists.
 */
export const ACCOUNT_HASH = '#/account';
export const ACCOUNT_CONFIRMED_HASH = '#/account/confirmed';

export type AppRoute =
  | { readonly kind: 'account'; readonly confirmed: boolean }
  | { readonly kind: 'journey' }
  | { readonly kind: 'tab'; readonly tab: TabId };

/**
 * Traces of Supabase having answered in the URL fragment.
 *
 * Under the implicit flow a confirmation link comes back as
 * `…#access_token=…&type=signup`, and that fragment can REPLACE the one we asked to
 * be returned to rather than appending to it. Recognising the tokens themselves means
 * the user lands in the NinFit ID experience either way, instead of on Today
 * wondering whether the link worked.
 *
 * Nothing here reads, stores or forwards a token. The presence of the parameter is
 * the only thing consulted; the Supabase client is what actually consumes the URL,
 * and it does so after this route has already decided where to send the user.
 */
const AUTH_FRAGMENT = /(^|[#&?])(access_token|refresh_token|error_code|error_description)=/;
const AUTH_TYPE = /(^|[#&?])type=(signup|magiclink|recovery|invite|email_change)/;

export function looksLikeAuthReturn(hash: string): boolean {
  return AUTH_FRAGMENT.test(hash) || AUTH_TYPE.test(hash);
}

/**
 * The whole of NinFit's routing: standalone experiences, or one of the five tabs.
 *
 * Layered over `parseTabFromHash` rather than replacing it, so tab parsing keeps its
 * existing behaviour exactly - including the fallback that sends anything
 * unrecognised to Today if it ever reaches that path.
 */
export function parseRouteFromHash(hash: string): AppRoute {
  const normalised = normaliseHash(hash);

  if (normalised === 'journey') return { kind: 'journey' };
  if (normalised === 'account') return { kind: 'account', confirmed: false };
  if (normalised === 'account/confirmed') return { kind: 'account', confirmed: true };

  // Checked after the explicit routes so a normal navigation is never mistaken for
  // a confirmation return, and before the tab fallback so an auth answer is never
  // silently swallowed into Today.
  if (looksLikeAuthReturn(hash)) return { kind: 'account', confirmed: true };

  return { kind: 'tab', tab: parseTabFromHash(hash) };
}

/**
 * The next route after a `hashchange` event.
 *
 * This exists for one event that is not a user navigation. Once auth-js has taken
 * the tokens out of the fragment it runs `window.location.hash = ''` to get them out
 * of the address bar, and assigning to `location.hash` fires `hashchange`. Parsing
 * that empty hash naively would take somebody who has just confirmed their email off
 * the account screen and drop them on Today, mid-flow, before they ever see that it
 * worked - with a session quietly established and nothing on screen saying so.
 *
 * So while the user is on a confirmation route, an empty hash is read as the
 * clean-up it is and the route is held. This cannot trap anybody: every real
 * navigation in the app sets a non-empty hash (`#/today`, `#/account`, and so on),
 * and the account screen always offers a way out.
 */
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
