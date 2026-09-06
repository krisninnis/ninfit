import type { JourneySourceKind, JourneyTransportKind } from '../journey';

/**
 * The boundary every wearable and health store enters NinFit through.
 *
 * WHY A BOUNDARY BEFORE A PROVIDER. The expensive version of this feature is the one
 * where a Fitbit response shape reaches a screen. Once a component knows what
 * `activityLevels[2].minutes` means, adding the second provider means editing every
 * component that learned the first one, and the fourth is a rewrite. So the shape of
 * the seam is decided here, once, and every provider is measured against it.
 *
 * NOTHING HERE TALKS TO ANYTHING. This module is types, a registry of what each
 * provider could offer, and the honest current status of each. There is no HTTP, no
 * OAuth, no token, no secret and no side effect anywhere in this folder, and there is
 * deliberately no provider implementation yet - see
 * `docs/architecture/ninfit-wearable-integration-v1.md` for the human-only setup that
 * has to happen before one can exist.
 *
 * EVIDENCE, NEVER AUTHORITY. A provider supplies observations. It does not get to
 * decide what a Journey was, how far it went, or whether it happened. That is
 * `journey.ts`'s job and the reconciliation module's, and it stays that way however
 * confident a device's own summary sounds.
 */

export type WearableProviderId =
  | 'fitbit'
  | 'google_health'
  | 'health_connect'
  | 'healthkit'
  | 'garmin'
  | 'samsung_health'
  | 'oura';

/**
 * A category of data a provider may be able to supply.
 *
 * Deliberately not "everything Fitbit's API documents". A capability exists here when
 * NinFit has somewhere honest to put it, so the list grows with the product rather
 * than with the vendor.
 */
export type WearableCapability =
  | 'activity_sessions'
  | 'steps'
  | 'distance'
  | 'active_minutes'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'heart_rate_zones'
  | 'hrv'
  | 'sleep'
  | 'elevation'
  | 'energy';

export type WearableProviderAvailability =
  /** Connectable by a user today. Nothing is in this state yet. */
  | 'available'
  /** The provider exists, but NinFit needs server-side work before it can connect. */
  | 'requires_backend_setup'
  /** Needs a native app NinFit does not ship; a browser cannot reach it. */
  | 'requires_native_app'
  /** The provider's interface is being withdrawn. Do not build against it. */
  | 'retired';

export interface WearableProviderDefinition {
  id: WearableProviderId;
  label: string;
  availability: WearableProviderAvailability;
  /**
   * What NinFit would read if this provider were connected. It is an intention, not
   * a promise about any particular watch: capability discovery per account and per
   * device happens at sync time, and a missing category stays visibly missing.
   */
  plannedCapabilities: readonly WearableCapability[];
  /** The provenance an observation from this provider carries into a Journey. */
  sourceKind: JourneySourceKind;
  transportedBy: JourneyTransportKind;
  /** One plain sentence a person could read. No jargon, no roadmap promises. */
  status: string;
}

/**
 * Every provider NinFit has a position on, and what that position currently is.
 *
 * THE FITBIT ENTRY IS THE INTERESTING ONE, AND IT IS MARKED RETIRED ON PURPOSE.
 *
 * Google is turning down the legacy Fitbit Web API in September 2026 and is no longer
 * issuing new Fitbit developer accounts; the replacement is the Google Health API,
 * which reads Fitbit and Pixel Watch data under Google OAuth. Building a
 * `FitbitWearableProvider` against the old API today would be writing an integration
 * with a known end date, against credentials that cannot be obtained. So Fitbit data
 * is reached through `google_health`, and the Fitbit row stays in this registry
 * because a person with a Fitbit needs to see an honest answer about their watch -
 * not because NinFit intends to implement that interface.
 */
export const WEARABLE_PROVIDERS: readonly WearableProviderDefinition[] = [
  {
    id: 'google_health',
    label: 'Google Health',
    availability: 'requires_backend_setup',
    plannedCapabilities: [
      'activity_sessions', 'steps', 'distance', 'active_minutes',
      'heart_rate', 'resting_heart_rate', 'sleep',
    ],
    sourceKind: 'health_connect',
    transportedBy: 'health_connect',
    status: 'Reads Fitbit and Pixel Watch data. NinFit needs approved access before this can be switched on.',
  },
  {
    id: 'fitbit',
    label: 'Fitbit',
    availability: 'retired',
    plannedCapabilities: [],
    sourceKind: 'fitbit',
    transportedBy: 'other',
    status: 'Fitbit’s own developer interface is being withdrawn. Fitbit watches will connect through Google Health instead.',
  },
  {
    id: 'health_connect',
    label: 'Health Connect',
    availability: 'requires_native_app',
    plannedCapabilities: ['activity_sessions', 'steps', 'distance', 'heart_rate', 'sleep'],
    sourceKind: 'health_connect',
    transportedBy: 'health_connect',
    status: 'Reachable only from an installed Android app, which NinFit does not ship yet.',
  },
  {
    id: 'healthkit',
    label: 'Apple Health',
    availability: 'requires_native_app',
    plannedCapabilities: ['activity_sessions', 'steps', 'distance', 'heart_rate', 'sleep'],
    sourceKind: 'healthkit',
    transportedBy: 'healthkit',
    status: 'Reachable only from an installed iPhone app, which NinFit does not ship yet.',
  },
  {
    id: 'garmin',
    label: 'Garmin',
    availability: 'requires_backend_setup',
    plannedCapabilities: ['activity_sessions', 'steps', 'distance', 'heart_rate'],
    sourceKind: 'other',
    transportedBy: 'other',
    status: 'Not started. Needs its own approved developer access.',
  },
  {
    id: 'samsung_health',
    label: 'Samsung Health',
    availability: 'requires_native_app',
    plannedCapabilities: ['activity_sessions', 'steps', 'heart_rate', 'sleep'],
    sourceKind: 'other',
    transportedBy: 'other',
    status: 'Not started. Reachable only from an installed Android app.',
  },
  {
    id: 'oura',
    label: 'Oura',
    availability: 'requires_backend_setup',
    plannedCapabilities: ['sleep', 'resting_heart_rate', 'hrv'],
    sourceKind: 'other',
    transportedBy: 'other',
    status: 'Not started. Needs its own approved developer access.',
  },
];

export function wearableProvider(id: WearableProviderId): WearableProviderDefinition | undefined {
  return WEARABLE_PROVIDERS.find((provider) => provider.id === id);
}

/** True only when a person could actually complete a connection today. */
export function wearableProviderIsConnectable(
  definition: Pick<WearableProviderDefinition, 'availability'>,
): boolean {
  return definition.availability === 'available';
}

export type WearableConnectionState =
  /** The only state NinFit can be in today. */
  | 'not_connected'
  /** An authorisation was started and has not completed. NEVER shown as connected. */
  | 'authorising'
  /** Authorisation completed and a token exists server-side. */
  | 'connected'
  /** Was connected; the authorisation has expired or been revoked. */
  | 'authorisation_expired'
  /** Connected, but the last sync failed. Previously synced data is untouched. */
  | 'sync_failed';

/**
 * What NinFit stores locally about a connection.
 *
 * WHAT IS NOT IN THIS TYPE IS THE POINT. No access token, no refresh token, no client
 * secret, no authorisation code, no scope grant string. Those live server-side or
 * they do not exist, and a type that cannot express them is a type that cannot leak
 * them into a backup file, an export, a log line or a screenshot.
 */
export interface WearableConnectionRecord {
  providerId: WearableProviderId;
  state: WearableConnectionState;
  /** ISO time of the last sync that completed successfully, if any. */
  lastSyncedAt?: string;
  /** Categories the provider confirmed at sync time. Never assumed from the model. */
  grantedCapabilities?: readonly WearableCapability[];
  /** Opaque marker for the next incremental sync. Never a credential. */
  syncCursor?: string;
}

/**
 * The one thing a connection state is allowed to say to a person.
 *
 * `authorising` deliberately does not read as connected. Starting an OAuth flow is
 * not finishing one, and a Settings screen that turns green the moment a browser tab
 * opens is a screen that lies about where somebody's data is.
 */
export function wearableConnectionIsEstablished(
  record: Pick<WearableConnectionRecord, 'state'>,
): boolean {
  return record.state === 'connected' || record.state === 'sync_failed';
}
