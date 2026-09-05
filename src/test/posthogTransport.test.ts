import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { createPostHogTransport } from '../telemetry/posthogTransport';
import { setTelemetryEnabled } from '../telemetry/preferences';

function fakeResponse(status = 200): Response {
  return new Response('', { status });
}

type RecordedFetch = readonly [RequestInfo | URL, RequestInit | undefined];

function recordingFetch() {
  const calls: RecordedFetch[] = [];
  const send = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);
    return fakeResponse();
  });
  return { send, calls };
}

function firstFetch(calls: RecordedFetch[]): RecordedFetch {
  const call = calls.at(0);
  if (call === undefined) throw new Error('Expected one telemetry fetch');
  return call;
}

describe('PostHog EU telemetry transport', () => {
  it('sends an anonymous analytics event with only the closed event payload', async () => {
    const store = createMemoryStorageAdapter();
    setTelemetryEnabled(store, true);
    const { send, calls } = recordingFetch();
    const transport = createPostHogTransport({
      projectToken: 'phc_public_test',
      store,
      fetch: send,
      createId: () => 'device-random-id',
    });

    await transport.capture({
      name: 'activity_recorded',
      properties: { type: 'walk', is_rest: false },
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = firstFetch(calls);
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      api_key: 'phc_public_test',
      event: 'activity_recorded',
      distinct_id: 'device-random-id',
      properties: {
        type: 'walk',
        is_rest: false,
        $process_person_profile: false,
      },
    });
  });

  it('sends scrubbed crash diagnostics outside the six analytics event names', async () => {
    const store = createMemoryStorageAdapter();
    setTelemetryEnabled(store, true);
    const { send, calls } = recordingFetch();
    const transport = createPostHogTransport({
      projectToken: 'phc_public_test',
      store,
      fetch: send,
      createId: () => 'device-random-id',
    });

    await transport.captureCrash({
      name: 'TypeError',
      stack: 'Error\nat save (https://ninfit.app/assets/index.js:10:4)',
    });

    const [, init] = firstFetch(calls);
    expect(JSON.parse(String(init?.body))).toEqual({
      api_key: 'phc_public_test',
      event: 'ninfit_crash',
      distinct_id: 'device-random-id',
      properties: {
        error_name: 'TypeError',
        stack: 'Error\nat save (https://ninfit.app/assets/index.js:10:4)',
        $process_person_profile: false,
      },
    });
  });

  it('does not create an ID or request before opt-in', async () => {
    const store = createMemoryStorageAdapter();
    const { send } = recordingFetch();
    const createId = vi.fn(() => 'should-not-exist');
    const transport = createPostHogTransport({
      projectToken: 'phc_public_test',
      store,
      fetch: send,
      createId,
    });

    await transport.capture({ name: 'onboarding_completed' });
    await transport.captureCrash({ name: 'Error' });

    expect(createId).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('fails closed when the public project token is absent', async () => {
    const store = createMemoryStorageAdapter();
    setTelemetryEnabled(store, true);
    const { send } = recordingFetch();
    const transport = createPostHogTransport({
      projectToken: '',
      store,
      fetch: send,
      createId: () => 'device-random-id',
    });

    await transport.capture({ name: 'journey_completed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('surfaces provider rejection to the telemetry client rather than pretending delivery', async () => {
    const store = createMemoryStorageAdapter();
    setTelemetryEnabled(store, true);
    const transport = createPostHogTransport({
      projectToken: 'phc_public_test',
      store,
      fetch: async () => fakeResponse(503),
      createId: () => 'device-random-id',
    });

    await expect(transport.capture({ name: 'hatch_completed' })).rejects.toThrow(
      'Telemetry transport rejected event (503)',
    );
  });
});
