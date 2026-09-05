import type { StorageAdapter } from '../storage/StorageAdapter';
import { telemetryDistinctId } from './preferences';
import type { AnalyticsEvent, CrashReport, TelemetryTransport } from './types';

const POSTHOG_EU_CAPTURE_URL = 'https://eu.i.posthog.com/i/v0/e/';
const CRASH_EVENT = 'ninfit_crash';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface PostHogTransportOptions {
  projectToken: string;
  store: StorageAdapter;
  fetch?: FetchLike;
  createId?: () => string;
}

/**
 * A deliberately tiny PostHog integration.
 *
 * We use the documented capture endpoint rather than the browser SDK so PostHog
 * cannot add pageviews, autocapture, replay, URL/referrer fields, person properties,
 * feature flags or any other event outside NinFit's closed beta vocabulary.
 */
export function createPostHogTransport({
  projectToken,
  store,
  fetch: send = fetch,
  createId,
}: PostHogTransportOptions): TelemetryTransport {
  const capture = async (event: AnalyticsEvent): Promise<void> => {
    const distinctId = telemetryDistinctId(store, createId);
    if (distinctId === undefined || projectToken.length === 0) return;

    const properties =
      'properties' in event
        ? { ...event.properties, $process_person_profile: false }
        : { $process_person_profile: false };

    await postEvent(send, projectToken, distinctId, event.name, properties);
  };

  const captureCrash = async (report: CrashReport): Promise<void> => {
    const distinctId = telemetryDistinctId(store, createId);
    if (distinctId === undefined || projectToken.length === 0) return;

    // This is intentionally NOT PostHog's reserved `$exception` event. It is a small,
    // scrubbed NinFit diagnostic event. Error messages, user values, routes, current
    // URLs, referrers, health data and browser metadata are never added by this client.
    await postEvent(send, projectToken, distinctId, CRASH_EVENT, {
      error_name: report.name,
      ...(report.stack !== undefined ? { stack: report.stack } : {}),
      $process_person_profile: false,
    });
  };

  return { capture, captureCrash };
}

async function postEvent(
  send: FetchLike,
  projectToken: string,
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const response = await send(POSTHOG_EU_CAPTURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: projectToken,
      event,
      distinct_id: distinctId,
      properties,
    }),
  });

  if (!response.ok) throw new Error(`Telemetry transport rejected event (${response.status})`);
}
