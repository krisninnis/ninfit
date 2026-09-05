import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import {
  captureAppOpenAfterGap,
  createTelemetryClient,
  gapBucket,
  toCrashReport,
} from '../telemetry/client';
import { setTelemetryEnabled, telemetryEnabled } from '../telemetry/preferences';
import type { AnalyticsEvent, CrashReport, TelemetryTransport } from '../telemetry/types';

function transport() {
  const events: AnalyticsEvent[] = [];
  const crashes: CrashReport[] = [];
  const value: TelemetryTransport = {
    capture(event) {
      events.push(event);
    },
    captureCrash(report) {
      crashes.push(report);
    },
  };
  return { value, events, crashes };
}

describe('privacy-safe telemetry', () => {
  it('is disabled by default and sends nothing before explicit opt-in', () => {
    const store = createMemoryStorageAdapter();
    const sent = transport();
    const client = createTelemetryClient(store, sent.value);

    expect(telemetryEnabled(store)).toBe(false);
    client.capture({ name: 'onboarding_completed' });
    client.captureCrash(new Error('private details must not leave'));

    expect(sent.events).toEqual([]);
    expect(sent.crashes).toEqual([]);
  });

  it('accepts exactly the six D-15 event shapes after opt-in', () => {
    const store = createMemoryStorageAdapter();
    const sent = transport();
    setTelemetryEnabled(store, true);
    const client = createTelemetryClient(store, sent.value);

    client.capture({ name: 'onboarding_completed' });
    client.capture({ name: 'hatch_completed' });
    client.capture({ name: 'first_activity_recorded' });
    client.capture({ name: 'activity_recorded', properties: { type: 'walk', is_rest: false } });
    client.capture({ name: 'journey_completed' });
    client.capture({ name: 'app_opened_after_gap', properties: { gap_bucket: '4-7_days' } });

    expect(sent.events).toEqual([
      { name: 'onboarding_completed' },
      { name: 'hatch_completed' },
      { name: 'first_activity_recorded' },
      { name: 'activity_recorded', properties: { type: 'walk', is_rest: false } },
      { name: 'journey_completed' },
      { name: 'app_opened_after_gap', properties: { gap_bucket: '4-7_days' } },
    ]);
  });

  it('buckets gaps coarsely and stores no exact gap in the emitted event', () => {
    expect(gapBucket(1)).toBeUndefined();
    expect(gapBucket(2)).toBe('2-3_days');
    expect(gapBucket(4)).toBe('4-7_days');
    expect(gapBucket(8)).toBe('8-14_days');
    expect(gapBucket(15)).toBe('15-21_days');
    expect(gapBucket(22)).toBe('22+_days');

    const store = createMemoryStorageAdapter();
    const sent = transport();
    setTelemetryEnabled(store, true);

    captureAppOpenAfterGap(store, sent.value, '2026-08-01');
    captureAppOpenAfterGap(store, sent.value, '2026-08-06');

    expect(sent.events).toEqual([
      { name: 'app_opened_after_gap', properties: { gap_bucket: '4-7_days' } },
    ]);
  });

  it('drops local gap metadata immediately when the user opts out', () => {
    const store = createMemoryStorageAdapter();
    const sent = transport();
    setTelemetryEnabled(store, true);
    captureAppOpenAfterGap(store, sent.value, '2026-08-01');

    setTelemetryEnabled(store, false);
    setTelemetryEnabled(store, true);
    captureAppOpenAfterGap(store, sent.value, '2026-08-20');

    expect(sent.events).toEqual([]);
  });

  it('reports an error class and scrubbed code locations without the error message or URL secrets', () => {
    const error = new TypeError('health note: secret words');
    error.stack = [
      'TypeError: health note: secret words',
      '    at save (https://ninfit.app/assets/index.js?token=secret#private:10:4)',
    ].join('\n');

    expect(toCrashReport(error)).toEqual({
      name: 'TypeError',
      stack: ['Error', 'at save (https://ninfit.app/assets/index.js'].join('\n'),
    });
  });

  it('never lets transport failures break a product action', async () => {
    const store = createMemoryStorageAdapter();
    setTelemetryEnabled(store, true);
    const failing: TelemetryTransport = {
      capture: vi.fn(() => Promise.reject(new Error('network down'))),
      captureCrash: vi.fn(() => {
        throw new Error('reporter down');
      }),
    };
    const client = createTelemetryClient(store, failing);

    expect(() => client.capture({ name: 'onboarding_completed' })).not.toThrow();
    expect(() => client.captureCrash(new Error('boom'))).not.toThrow();
    await Promise.resolve();
  });
});
