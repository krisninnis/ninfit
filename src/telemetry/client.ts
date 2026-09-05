import type { StorageAdapter } from '../storage/StorageAdapter';
import {
  saveTelemetryLastOpenDate,
  telemetryEnabled,
  telemetryLastOpenDate,
} from './preferences';
import type { AnalyticsEvent, CrashReport, GapBucket, TelemetryTransport } from './types';

const DAY_MS = 86_400_000;

function ignoreFailure(result: void | Promise<void>): void {
  void Promise.resolve(result).catch(() => undefined);
}

export function createTelemetryClient(store: StorageAdapter, transport: TelemetryTransport) {
  return {
    capture(event: AnalyticsEvent): void {
      if (!telemetryEnabled(store)) return;
      try {
        ignoreFailure(transport.capture(event));
      } catch {
        // Instrumentation must never break the product it is observing.
      }
    },

    captureCrash(error: unknown): void {
      if (!telemetryEnabled(store)) return;
      try {
        ignoreFailure(transport.captureCrash(toCrashReport(error)));
      } catch {
        // Crash reporting is best-effort and may not create a second crash.
      }
    },
  };
}

export function gapBucket(days: number): GapBucket | undefined {
  if (!Number.isFinite(days) || days < 2) return undefined;
  if (days <= 3) return '2-3_days';
  if (days <= 7) return '4-7_days';
  if (days <= 14) return '8-14_days';
  if (days <= 21) return '15-21_days';
  return '22+_days';
}

/**
 * Records only a coarse return event and the current local date. No timestamp, route,
 * referrer, screen, health value or user-entered field leaves the device.
 */
export function captureAppOpenAfterGap(
  store: StorageAdapter,
  transport: TelemetryTransport,
  localDate: string,
): void {
  if (!telemetryEnabled(store)) return;

  const previous = telemetryLastOpenDate(store);
  if (previous !== undefined) {
    const previousMs = Date.parse(`${previous}T00:00:00Z`);
    const currentMs = Date.parse(`${localDate}T00:00:00Z`);
    const bucket = gapBucket(Math.floor((currentMs - previousMs) / DAY_MS));
    if (bucket !== undefined) {
      createTelemetryClient(store, transport).capture({
        name: 'app_opened_after_gap',
        properties: { gap_bucket: bucket },
      });
    }
  }

  saveTelemetryLastOpenDate(store, localDate);
}

export function toCrashReport(error: unknown): CrashReport {
  if (!(error instanceof Error)) return { name: 'UnknownError' };

  const report: CrashReport = { name: safeErrorName(error.name) };
  const stack = scrubStack(error.stack);
  return stack === undefined ? report : { ...report, stack };
}

function safeErrorName(value: string): string {
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value) ? value : 'Error';
}

function scrubStack(stack: string | undefined): string | undefined {
  if (stack === undefined) return undefined;

  const scrubbed = stack
    .split('\n')
    .slice(0, 20)
    .map((line) =>
      line
        // Drop URL query/hash fragments: they can contain tokens or user-controlled values.
        .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1')
        // Strip message text from the first Error line; the class is already captured separately.
        .replace(/^\s*[A-Za-z][A-Za-z0-9_.-]*(?:Error|Exception):.*$/, 'Error'),
    )
    .join('\n')
    .slice(0, 4_000)
    .trim();

  return scrubbed.length > 0 ? scrubbed : undefined;
}
