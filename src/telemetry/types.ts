import type { ActivityType } from '../domain/types';

/**
 * The complete beta analytics vocabulary. Deliberately closed: adding an event is a
 * product/privacy decision, not an arbitrary string passed from a screen.
 */
export type AnalyticsEvent =
  | { name: 'onboarding_completed' }
  | { name: 'hatch_completed' }
  | { name: 'first_activity_recorded' }
  | { name: 'activity_recorded'; properties: { type: ActivityType; is_rest: boolean } }
  | { name: 'journey_completed' }
  | { name: 'app_opened_after_gap'; properties: { gap_bucket: GapBucket } };

/** Coarse on purpose: enough to understand return behaviour without storing dates. */
export type GapBucket = '2-3_days' | '4-7_days' | '8-14_days' | '15-21_days' | '22+_days';

export interface CrashReport {
  /** Error class only; no user-entered message is forwarded. */
  name: string;
  /** A scrubbed stack contains code locations only, never query/hash fragments. */
  stack?: string;
}

export interface TelemetryTransport {
  capture(event: AnalyticsEvent): void | Promise<void>;
  captureCrash(report: CrashReport): void | Promise<void>;
}
