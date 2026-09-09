import { journeyActiveSeconds, type Journey } from '../domain/journey';
import type { ISODateTime } from '../domain/types';

export type JourneyNativeLockScreenState = 'recording' | 'auto_paused' | 'manual_paused';

export interface JourneyNativeLockScreenStatus {
  /** Transport identity only. Native uses it to reject stale cross-Journey updates. */
  journeyId: string;
  brandMark: 'NF';
  title: 'NinFit Journey';
  activityLabel: string;
  state: JourneyNativeLockScreenState;
  stateLabel: string;
  activeSeconds: number;
  distanceM: number;
  privacy: 'summary_only';
  showRoute: false;
  allowTerminalControls: false;
}

function activityLabel(journey: Journey): string {
  switch (journey.activityType) {
    case 'walk': return 'Walk';
    case 'run': return 'Run';
    case 'hike': return 'Hike';
    case 'cycle': return 'Cycle';
    case 'swim': return 'Swim';
    default: return 'Journey';
  }
}

function distanceM(journey: Journey): number {
  return journey.metrics.find((metric) => metric.kind === 'distance_m')?.value ?? 0;
}

/**
 * Privacy-safe summary data for Android's ongoing Journey notification / lock-screen
 * surface and the future iOS Live Activity equivalent.
 *
 * The Journey id is transport identity, not display content. Exact coordinates and
 * route geometry are deliberately absent. Pause/Finish actions also stay inside the
 * unlocked NinFit UI so waking a phone cannot accidentally end or alter a Journey from
 * the system lock screen.
 */
export function createJourneyNativeLockScreenStatus(options: {
  journey: Journey;
  now: ISODateTime;
  autoPaused: boolean;
}): JourneyNativeLockScreenStatus {
  const state: JourneyNativeLockScreenState = options.journey.status === 'paused'
    ? options.autoPaused ? 'auto_paused' : 'manual_paused'
    : 'recording';

  return {
    journeyId: options.journey.id,
    brandMark: 'NF',
    title: 'NinFit Journey',
    activityLabel: activityLabel(options.journey),
    state,
    stateLabel: state === 'auto_paused'
      ? 'Auto-paused · stationary'
      : state === 'manual_paused'
        ? 'Paused'
        : 'Recording',
    activeSeconds: journeyActiveSeconds(options.journey, options.now),
    distanceM: distanceM(options.journey),
    privacy: 'summary_only',
    showRoute: false,
    allowTerminalControls: false,
  };
}
